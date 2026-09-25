/**
 * 端到端流程验证（headless chromium + CDP，独立 profile）
 *
 * 覆盖本轮数据语义改造后的关键交互：
 *   1. 进食：需填分子分母 → 入账 → 成功回执「知道了 · …已录于册」
 *   2. 手记：文字与时长皆空不可提交；只填时长亦可入账（纯计时手帐行）
 *   3. 体征：就寝/起身时刻 → 时长由时刻推得（7h20m）；体重越常度需二次确认
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
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;

/** React 受控输入：必须走原生 setter + input 事件 */
const setInput = (selectorIndexExpr, value) => `(() => {
  const input = ${selectorIndexExpr};
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`;

const clickText = (text) =>
  `[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(
    text
  )})).click()`;

/** 等到条件成立（最多 timeout ms），避免动画/状态竞态导致误判 */
const waitFor = async (expr, timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await ev(expr)) return true;
    await sleep(150);
  }
  return false;
};

/** 先等面板出现，再切页签，并等到该页签的表单确实渲染出来 */
const openSheet = async (tabText) => {
  if (!(await waitFor(`!!document.querySelector('form')`, 500))) {
    await ev(clickText('记一笔'));
  }
  await waitFor(`!!document.querySelector('form')`);
  if (tabText) {
    await ev(
      `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(
        tabText
      )})?.click()`
    );
    await waitFor(`document.querySelector('form').innerText.includes(${JSON.stringify(tabText)})`);
    await sleep(250);
  }
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:3000/' });
for (let i = 0; i < 24; i++) {
  if (await ev('document.querySelectorAll("main").length')) break;
  await sleep(750);
}
await sleep(1000);

// --- 1. 进食：必须填数,入账后弹回执 -------------------------------------
await openSheet();
const mealNameSet = await ev(setInput(`[...document.querySelectorAll('form input[type=text]')][0]`, '测试餐 · 三文鱼'));
const kcalSet = await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][0]`, '520'));
const proteinSet = await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][1]`, '38'));
await sleep(200);
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 3000);
console.log('meal inputs set:', mealNameSet, kcalSet, proteinSet);
console.log('sheet closed after meal save:', await ev(`!document.querySelector('form')`));
console.log(
  'toast:',
  await ev(
    `[...document.querySelectorAll('span')].map(s=>s.textContent).find(t=>t&&t.includes('已录于册'))||'none'`
  )
);

// --- 2. 手记：空则不可提交；只填时长可入账 -------------------------------
await openSheet('手记');
console.log(
  'tab is 手记:',
  await ev(`document.querySelector('form').innerText.includes('所记之事（可只计时长）')`)
);
console.log(
  'note submit disabled when empty:',
  await ev(`(() => { const b = document.querySelector('form button[type=submit]'); return b ? b.disabled : 'no form'; })()`)
);
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][0]`, '90'));
await sleep(200);
console.log(
  'note submit enabled with duration only:',
  await ev(`(() => { const b = document.querySelector('form button[type=submit]'); return b ? !b.disabled : 'no form'; })()`)
);
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 3000);
await sleep(400);
const lifeText = await ev(
  `[...document.querySelectorAll('main section')].map(s=>s.innerText).join(' ')`
);
// 只计时长的手帐行：计入「本周之功」（4h + 1.5h = 5.5 时），但不计入「近来手记」条数
console.log('duration-only entry summed into 本周之功 (5.5 时):', lifeText.includes('5.5'));
console.log('journal count unchanged (4 条):', /近七日 4 条/.test(lifeText));

// --- 3. 体征：时刻推时长 + 异常体重二次确认 -----------------------------
await openSheet('体征');
console.log('tab is 体征:', await ev(`document.querySelector('form').innerText.includes('昨夜之眠')`));
const sleepStartSet = await ev(setInput(`[...document.querySelectorAll('form input[type=time]')][0]`, '00:55'));
const wakeSet = await ev(setInput(`[...document.querySelectorAll('form input[type=time]')][1]`, '08:15'));
await sleep(300);
console.log('sleep inputs set:', sleepStartSet, wakeSet);
console.log(
  'sleep duration derived from clocks:',
  await ev(`document.querySelector('form').innerText.includes('7h20m')`)
);

// 体重 57 与近七日均重（约 68）相差近 11kg → 需二次确认
await ev(setInput(`[...document.querySelectorAll('form input[type=number]')][0]`, '57'));
await sleep(300);
const firstLabel = await ev(`document.querySelector('form button[type=submit]').textContent.trim()`);
await ev(`document.querySelector('form button[type=submit]').click()`);
await sleep(400);
const stillOpen = await ev(`!!document.querySelector('form')`);
const secondLabel = await ev(`document.querySelector('form button[type=submit]').textContent.trim()`);
await ev(`document.querySelector('form button[type=submit]').click()`);
await waitFor(`!document.querySelector('form')`, 3000);
console.log('anomaly weight asks confirmation:', firstLabel, '→', secondLabel, '(panel stayed open:', stillOpen + ')');
console.log('sheet closed after confirming weight:', await ev(`!document.querySelector('form')`));

// 体重原样保留，未被系统改写
const bodyText = await ev(`document.body.innerText`);
console.log('weight kept verbatim (57) and flagged:', bodyText.includes('57 公斤') && bodyText.includes('待核'));

// 睡眠时长来自时刻而非手录
console.log('sleep shown as 7h20m:', bodyText.includes('7h20m'));

// 页面不得出现方法学说明（口径归 README）
const BANNED = ['非首末', '不予修改', '仅标记', '仅指', '非健康度', '非承诺', '做线性回归', '原始记录'];
const found = BANNED.filter((w) => bodyText.includes(w));
console.log('no methodology copy on page:', found.length === 0, found.join(','));

// 计量条同起同止（共列网格）
console.log(
  'meter columns aligned:',
  await ev(`(() => {
    const rows = [...document.querySelectorAll('main .inkrow')];
    const mids = rows.map((r) => Math.round(r.children[1].getBoundingClientRect().left));
    const vals = rows.map((r) => Math.round(r.children[2].getBoundingClientRect().left));
    const ok = (a) => new Set(a).size <= 2;
    return ok(mids) && ok(vals);
  })()`)
);

chrome.kill();
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
process.exit(0);
