/**
// 注意：运行输出勿重定向入工作区（Vite watch 会对工作区文件写入 full-reload，杀掉运行中页面的弹层）——用管道或写 /tmp。
 * 端到端流程验证（headless chromium + CDP，独立 profile）
 *
 * 主线：未建档 → 页面不显示任何人体数字 → 立档 → 派生 BMI/代谢/目标 → 记录流程照常。
 *   1. 清空档案 → 「体征档 · 未建档」与「下一膳」不出建议
 *   2. 立档（男/1990/175/轻/腰围 84）→ BMI、RMR、TDEE、每日目标、抗阻处方出现
 *   3. 进食：填分子分母 → 入账 → 回执
 *   3b. 进食：搜库选物 → 按克折算 → items+脂肪随账入册
 *   4. 体征：就寝/起身 → 时长由时刻推得；异常体重二次确认后原样保存
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';

const profile = mkdtempSync('/tmp/phc-prof-');
const port = 9780 + Math.floor(Math.random() * 20);
const chrome = spawn(
  '/usr/bin/chromium',
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=' + profile,
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = l.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const p = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && p.has(m.id)) {
    p.get(m.id)(m);
    p.delete(m.id);
  }
};
const send = (m, q = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    p.set(i, (x) => (x.error ? rej(new Error(x.error.message)) : res(x.result)));
    ws.send(JSON.stringify({ id: i, method: m, params: q }));
  });
/** 求值并把页面里的异常显式抛出（否则 undefined 会静默吞掉失败原因）。 */
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error('page eval failed: ' + (r.exceptionDetails.exception?.description || '').split('\n')[0]);
  }
  return r.result.value;
};

const waitFor = async (expr, timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await ev(expr)) return true;
    await sleep(150);
  }
  return false;
};

const setInput = (selectorIndexExpr, value) => `(() => {
  const input = ${selectorIndexExpr};
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`;

const clickText = (text) =>
  `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(${JSON.stringify(
    text
  )})); if (!b) return 'no-button'; b.click(); return 'clicked'; })()`;

const clickExact = (text) =>
  `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(
    text
  )})?.click()`;

const load = async () => {
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await waitFor(`document.querySelectorAll("main section").length >= 5`, 12000);
  await sleep(600);
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await load();

// --- 1. 清空档案：页面不得再显示任何人体数字 -----------------------------
await ev(`localStorage.setItem('phc_profile_v3', '{}')`);
await load();
const noProfileText = await ev(`document.body.innerText`);
console.log('未建档：体征档显示未建档:', noProfileText.includes('未建档'));
console.log('未建档：下一膳不出建议:', noProfileText.includes('未建档：先录身高'));
const fakeLines = noProfileText
  .split('\n')
  .filter((l) => l.includes('体重指数') || l.includes('每日热量') || l.includes('每周抗阻'));
console.log('未建档：不显示伪造的人体数字:', fakeLines.length === 0, fakeLines.slice(0, 3).join(' // '));

// --- 2. 立档 → 派生 BMI / 代谢 / 目标 ------------------------------------
console.log('立档点击:', await ev(clickText('立档')));
await waitFor(`!!document.querySelector('form')`);
console.log('档案表单已开:', await ev(`document.querySelector('form').innerText.includes('出生年')`));
await ev(clickExact('男'));
console.log('立档表不收会变之数（无腰围）:', await ev(`!document.querySelector('form').innerText.includes('腰围')`));
await ev(setInput(`document.getElementById('ps-birth-year')`, '1990'));
await ev(setInput(`document.getElementById('ps-height')`, '175'));
await ev(clickText('轻'));
await sleep(200);
console.log('表单可提交:', !(await ev(`document.querySelector('form button[type=submit]').disabled`)));
await ev(`document.querySelector('form button[type=submit]').click()`);
const closed = await waitFor(`!document.querySelector('form')`, 5000);
console.log('表单已存并关闭:', closed);
await sleep(900);
console.log('档案已落盘:', await ev(`(localStorage.getItem('phc_profile_v3')||'').includes('heightCm')`));
const profiled = await ev(`document.body.innerText`);
console.log('立档后出现体重指数:', /体重指数/.test(profiled) && /正常|超重|偏瘦|肥胖/.test(profiled));
console.log('立档后出现静息/总消耗:', profiled.includes('静息代谢') && profiled.includes('总消耗'));
console.log('立档后出现每日目标与抗阻:', profiled.includes('每日热量') && profiled.includes('每周抗阻'));
console.log('立档后下一膳给建议:', !profiled.includes('未建档：先录身高'));

// --- 3. 进食：填数入账 ---------------------------------------------------
await ev(clickText('别录一品')); // 入口已就地：营养·别录一品 → 进食表
await waitFor(`!!document.querySelector('form')`);
console.log('进食表题头为录一膳:', await ev(`document.querySelector('form').closest('[role=dialog]').innerText.includes('录一膳')`));
console.log('进食表无餐别选择（时钟判定）:', await ev(`!document.querySelector('form').innerText.includes('餐别')`));
console.log('进食表一屏放下（无表内下拉）:', await ev(`(() => { const f = document.querySelector('form'); return f.scrollHeight <= f.clientHeight + 4; })()`));
await ev(setInput(`[...document.querySelectorAll('form input[type=text]')][0]`, '测试餐 · 三文鱼'));
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][0]`, '520'));
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][1]`, '38'));
await sleep(200);
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 5000);
console.log(
  'toast:',
  await ev(
    `[...document.querySelectorAll('span')].map(s=>s.textContent).find(t=>t&&t.includes('已录于册'))||'none'`
  )
);
await sleep(600);
console.log(
  '膳别由保存时刻的时钟判定（非用户选择）:',
  await ev(`(() => {
    const rows = JSON.parse(localStorage.getItem('phc_meals_v3') || '[]');
    const last = rows[rows.length - 1];
    return ['breakfast', 'lunch', 'dinner', 'snack'].includes(last && last.category);
  })()`)
);

// --- 3b. 进食：库选折算入账（搜 → 选 → 合计回填 → 随账入册） -------------
await ev(clickText('别录一品')); // 同上（库选折算流程）
await waitFor(`!!document.querySelector('form')`);
await ev(setInput(`[...document.querySelectorAll('form input[type=text]')][0]`, '鸡胸'));
await sleep(250);
console.log('库选建议浮现:', await ev(`document.body.innerText.includes('每 100g')`));
console.log('点选建议:', await ev(clickText('鸡胸肉 (熟)')));
await sleep(200);
console.log(
  '合计回填约计:',
  await ev(`[...document.querySelectorAll('form input[type=number]')][0].value`) !== '' &&
    (await ev(`document.querySelector('form').innerText.includes('已回填约计')`))
);
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 5000);
await sleep(600);
console.log(
  '库选之账带明细与脂肪:',
  await ev(`(() => {
    const rows = JSON.parse(localStorage.getItem('phc_meals_v3') || '[]');
    const hit = rows.filter(r => (r.items || []).some(i => i.foodId === 'f-chicken-breast')).pop();
    if (!hit) return 'no-items-row';
    const it = hit.items[0];
    return (it.grams === 120 && it.kcal === 198 && hit.estimatedFatG === 4.3)
      ? 'ok ' + hit.estimatedCalories + 'kcal fat ' + hit.estimatedFatG
      : 'mismatch ' + JSON.stringify(it) + ' fat=' + hit.estimatedFatG;
  })()`)
);

// --- 3c. 习练：另择动作直开独立表（无页签，一屏放下） ----------------------
await ev(clickText('另择动作'));
await waitFor(`!!document.querySelector('form')`);
console.log('习练表题头为录一练:', await ev(`document.querySelector('form').closest('[role=dialog]').innerText.includes('录一练')`));
console.log('习练表带实际计时:', await ev(`document.querySelector('form').innerText.includes('实际计时')`));
console.log('习练表一屏放下（无表内下拉）:', await ev(`(() => { const f = document.querySelector('form'); return f.scrollHeight <= f.clientHeight + 4; })()`));
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 5000);
await sleep(600);

// --- 4. 体征：时刻推时长 + 异常体重二次确认 ------------------------------
await ev(clickText('录新体重')); // 入口已就地：体征·录新体重 → 直开体征表（无页签）
await waitFor(`!!document.querySelector('form')`);
console.log('体征表题头为录体征:', await ev(`document.querySelector('form').closest('[role=dialog]').innerText.includes('录体征')`));
console.log('体征表一屏放下（无表内下拉）:', await ev(`(() => { const f = document.querySelector('form'); return f.scrollHeight <= f.clientHeight + 4; })()`));
await waitFor(`document.querySelector('form').innerText.includes('昨夜之眠')`);
await ev(setInput(`[...document.querySelectorAll('form input[type=time]')][0]`, '00:55'));
await ev(setInput(`[...document.querySelectorAll('form input[type=time]')][1]`, '08:15'));
await sleep(300);
console.log(
  'sleep duration derived from clocks:',
  await ev(`document.querySelector('form').innerText.includes('7h20m')`)
);

// 腰围是会变之数：在体征表录（不入档案表），随保存写入档中最新值
await ev(setInput(`document.getElementById('rs-waist')`, '84'));
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][0]`, '57'));
await sleep(300);
const firstLabel = await ev(`document.querySelector('form button[type=submit]').textContent.trim()`);
await ev(`document.querySelector('form button[type=submit]').click()`);
await sleep(400);
const secondLabel = await ev(`document.querySelector('form button[type=submit]').textContent.trim()`);
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 5000);
console.log(
  'anomaly weight asks confirmation (仍要录之 → 照准):',
  firstLabel === '仍要录之' && secondLabel === '照准'
);
await sleep(800);
const bodyText = await ev(`document.body.innerText`);
console.log('weight kept verbatim (57) and flagged:', bodyText.includes('待核') && bodyText.includes('57'));
console.log('sleep shown as 7h20m:', bodyText.includes('7h20m'));
console.log(
  '腰围随体征录入（体征节出行、档中落盘）:',
  bodyText.includes('84 公分') &&
    (await ev(`(localStorage.getItem('phc_profile_v3')||'').includes('waistCm')`))
);

// 页面不得出现方法学说明（口径归 README）
const BANNED = ['非首末', '不予修改', '仅标记', '仅指', '非健康度', '非承诺', '做线性回归', '原始记录'];
console.log('no methodology copy on page:', BANNED.filter((w) => bodyText.includes(w)).length === 0);

// 计量条同起同止：按「轴」（名列左缘）分组，同轴内中列与值列必须完全一致
console.log(
  'meter columns aligned per axis:',
  await ev(`(() => {
    const rows = [...document.querySelectorAll('main .inkrow')];
    const axes = new Map();
    for (const r of rows) {
      // 轴按「章节 + 名列左缘」分组：通栏与半栏行的名列同为 x=202 时并不共轴
      const sec = r.closest('section')?.querySelector('h2')?.textContent.trim() || '?';
      const label = sec + '@' + Math.round(r.children[0].getBoundingClientRect().left);
      const mid = Math.round(r.children[1].getBoundingClientRect().left);
      const val = Math.round(r.children[2].getBoundingClientRect().left);
      if (!axes.has(label)) axes.set(label, { mid: new Set(), val: new Set() });
      axes.get(label).mid.add(mid);
      axes.get(label).val.add(val);
    }
    return [...axes.values()].every((a) => a.mid.size === 1 && a.val.size === 1);
  })()`)
);

chrome.kill();
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
process.exit(0);
