/**
 * QA 状态截图：验证「异常数据被标记而非被改写」与迁移路径。
 *
 * 1) seed 态（干净数据）→ .shots/qa-seed.png
 * 2) 遗留异常态：注入旧形态 localStorage（sleepHours 7.3 + 时刻、
 *    57kg 今日体重、33 条「照准」建议膳）→ .shots/qa-anomaly.png
 *
 * 用法：node .shots/qa-states.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

const profile = mkdtempSync('/tmp/phc-qa-');
const port = 9700 + Math.floor(Math.random() * 40);
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
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (x) => (x.error ? rej(new Error(x.error.message)) : res(x.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://localhost:3000/' });
for (let i = 0; i < 24; i++) {
  if (await ev('document.querySelectorAll("main").length')) break;
  await sleep(750);
}
await sleep(800);

const capture = async (file) => {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('saved', file);
};

await capture('.shots/qa-seed.png');
const dumpSections = `[...document.querySelectorAll('main section')].map((s) => s.innerText.replace(/\\s+/g, ' ').trim()).join('\\n---\\n')`;
console.log('\n===== SEED SECTIONS =====\n' + (await ev(dumpSections)));

// --- 注入遗留形态（旧字段 + 异常数值），验证迁移与「只标记不改数」 ---
const today = await ev('new Date().toISOString().slice(0,10)');
const d = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().slice(0, 10);
};
const legacyWeights = Array.from({ length: 30 }, (_, i) => ({
  id: `w-${i}`,
  date: d(29 - i),
  weight: i === 29 ? 57 : Number((69.3 - i * 0.03).toFixed(1)),
}));
const legacyMeals = [
  {
    id: 'm-1',
    date: today,
    time: '09:10',
    category: 'breakfast',
    name: '燕麦片配牛奶与香蕉',
    foods: ['燕麦 (60g)'],
    estimatedCalories: 430,
    estimatedProtein: 21,
  },
];
// 33 次「照准」同款建议膳 ≈ 14159 千卡 / 899 g
for (let i = 0; i < 33; i++) {
  legacyMeals.push({
    id: `m-sug-${i}`,
    date: today,
    time: '13:00',
    category: 'lunch',
    name: '希腊酸奶 · 奇亚籽 · 香蕉与巴旦木',
    foods: ['无糖希腊酸奶'],
    estimatedCalories: 416,
    estimatedProtein: 26.6,
  });
}

await ev(`(() => {
  localStorage.setItem('phc_weights_v3', ${JSON.stringify(JSON.stringify(legacyWeights))});
  localStorage.setItem('phc_meals_v3', ${JSON.stringify(JSON.stringify(legacyMeals))});
  localStorage.setItem('phc_state_v3', ${JSON.stringify(
    JSON.stringify({
      date: today,
      sleepHours: 7.3,
      sleepBedtime: '00:55',
      sleepWakeup: '08:15',
      energy: 4,
      soreness: 4,
      notes: '旧形态之记',
    })
  )});
  return true;
})()`);
await send('Page.navigate', { url: 'http://localhost:3000/' });
for (let i = 0; i < 24; i++) {
  if (await ev('document.querySelectorAll("main").length')) break;
  await sleep(750);
}
await sleep(1000);
await capture('.shots/qa-anomaly.png');

console.log('\n===== ANOMALY SECTIONS =====\n' + (await ev(dumpSections)));
console.log(
  'anomaly page text:',
  await ev(`(() => {
    const t = document.body.innerText;
    return ['待核', '已超', '暂阙', '不出推演'].filter((k) => t.includes(k)).join(',') || 'none';
  })()`)
);
console.log(
  'today weight shown:',
  await ev(`(() => {
    const m = document.body.innerText.match(/今之体重\\s*([0-9.]+)/);
    return m ? m[1] : 'n/a';
  })()`)
);

chrome.kill();
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
process.exit(0);
