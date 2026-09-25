/**
 * 端到端流程验证（headless chromium + CDP，独立 profile）
 *
 * 主线：未建档 → 页面不显示任何人体数字 → 立档 → 派生 BMI/代谢/目标 → 记录流程照常。
 *   1. 清空档案 → 「体征档 · 未建档」与「下一膳」不出建议
 *   2. 立档（男/1990/175/轻/腰围 84）→ BMI、RMR、TDEE、每日目标、抗阻处方出现
 *   3. 进食：填分子分母 → 入账 → 回执
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
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][0]`, '1990'));
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][1]`, '175'));
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][2]`, '84'));
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
await ev(clickText('记一笔'));
await waitFor(`!!document.querySelector('form')`);
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

// --- 4. 体征：时刻推时长 + 异常体重二次确认 ------------------------------
await ev(clickText('记一笔'));
await waitFor(`!!document.querySelector('form')`);
await ev(clickExact('体征'));
await waitFor(`document.querySelector('form').innerText.includes('昨夜之眠')`);
await ev(setInput(`[...document.querySelectorAll('form input[type=time]')][0]`, '00:55'));
await ev(setInput(`[...document.querySelectorAll('form input[type=time]')][1]`, '08:15'));
await sleep(300);
console.log(
  'sleep duration derived from clocks:',
  await ev(`document.querySelector('form').innerText.includes('7h20m')`)
);

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
      const label = Math.round(r.children[0].getBoundingClientRect().left);
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
