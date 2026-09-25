// Layout alignment probe: node layout-probe.mjs <url> <width>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';

const url = process.argv[2];
const width = Number(process.argv[3] || 1440);
const check = process.argv.includes('--check');
const profile = mkdtempSync('/tmp/phc-prof-');
const port = 9900 + Math.floor(Math.random() * 90);
const chrome = spawn(
  '/usr/bin/chromium',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=800,600', 'about:blank'],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const l = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    wsUrl = l.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let id = 0;
const p = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const send = (m, q) => new Promise((res, rej) => { const i = ++id; p.set(i, (x) => (x.error ? rej(new Error(x.error.message)) : res(x.result))); ws.send(JSON.stringify({ id: i, method: m, params: q })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;

const PROBE = [
  '(() => {',
  "  const r = (e) => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top + scrollY), l: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) }; };",
  "  const heads = [...document.querySelectorAll('main h2')].map((h) => ({",
  "    txt: h.textContent.trim().slice(0, 10),",
  '    font: getComputedStyle(h).fontSize,',
  '    box: r(h),',
  '    rule: r(h.parentElement),',
  '    ruleW: getComputedStyle(h.parentElement).borderBottomWidth,',
  '  }));',
  "  const sections = [...document.querySelectorAll('main section')].map((s) => ({",
  "    sec: (s.querySelector('h2') || s).textContent.trim().slice(0, 8),",
  '    box: r(s),',
  '  }));',
  "  const actions = [...document.querySelectorAll('main section button')].filter((b) => /另择|别录|依此录|毕此一练|推演|照准/.test(b.textContent)).map((b) => ({ txt: b.textContent.trim().slice(0, 8), box: r(b) }));",
  "  const overflow = [...document.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > innerWidth + 1).length;",
  "  const secOf = (e) => { const s = e.closest('section'); return s ? (s.querySelector('h2')?.textContent.trim().slice(0,8) || '?') : '-'; };",
  "  const rows = [...document.querySelectorAll('main .inkrow, main .inklist-row')].map((row) => {",
  "    const c = [...row.children];",
  "    const bar = c.find((x) => x.classList.contains('inkrow-meter'));",
  "    return { sec: secOf(row), grid: row.classList.contains('inklist-row') ? 'list' : 'stat', label: (c[0]?.textContent || '').trim().slice(0, 6), kind: bar ? 'bar' : 'leader',",
  "      labelL: c[0] ? r(c[0]).l : -1, midL: c[1] ? r(c[1]).l : -1, midW: c[1] ? r(c[1]).w : -1, valL: c[2] ? r(c[2]).l : -1, valH: c[2] ? r(c[2]).h : -1 };",
  "  });",
  "  const lines = [...document.querySelectorAll('main section')].map((s) => ({",
  "    sec: s.querySelector('h2')?.textContent.trim().slice(0,8) || '?',",
  "    n: s.querySelectorAll('.inkrow, .inklist-row').length + s.querySelectorAll('p').length +",
  "       s.querySelectorAll('h2').length + s.querySelectorAll('.group-head').length,",
  "  }));",
  "  const grid = [...document.querySelectorAll('main div.grid')].find((g) => g.querySelector('section'));",
  "  const cells = grid ? [...grid.children].filter((c) => c.querySelector('section')) : [];",
  "  const byRow = {};",
  "  for (const c of cells) { const k = r(c).t; (byRow[k] ||= []).push(r(c).h); }",
  "  const rowSlack = Object.entries(byRow).filter(([, hs]) => hs.length > 1).map(([t, hs]) => Math.max(...hs) - Math.min(...hs));",
  '  return JSON.stringify({ heads, sections, actions, rows, lines, rowSlack, overflow, docH: document.documentElement.scrollHeight, vw: innerWidth });',
  '})()',
].join('\n');

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
await send('Page.navigate', { url });
for (let i = 0; i < 30; i++) {
  if (await ev('document.querySelectorAll("main").length')) break;
  await sleep(500);
}
await sleep(800);
const raw = await ev(PROBE);
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}

if (!check) {
  console.log(raw);
  process.exit(0);
}

// --check:把计划里的版式断言变成可复跑的门槛
const d = JSON.parse(raw);
const fails = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const ok = (cond, label, detail) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (cond ? '' : '  → ' + detail)); if (!cond) fails.push(label); };

ok(d.overflow === 0, `overflow = 0 @${width}px`, '有元素越界: ' + d.overflow);
if (width >= 1024) {
  ok(
    (d.rowSlack || []).every((s2) => s2 <= 110),
    '配对行无大块留白（单元高差 ≤110px）',
    JSON.stringify(d.rowSlack)
  );
}

// 共列网格：同一章节内所有行文行的名/中/值三列必须各自对齐（条与点线同轴）
const bySec = new Map();
for (const row of d.rows) {
  if (!bySec.has(row.sec)) bySec.set(row.sec, []);
  bySec.get(row.sec).push(row);
}
for (const [sec, items] of bySec) {
  const uniq = (list, key) => [...new Set(list.map((x) => x[key]))];
  const stats = items.filter((x) => x.kind !== undefined && x.grid === 'stat');
  const lists = items.filter((x) => x.grid === 'list');
  // 按轴分组：一栏一轴；同轴内名/中/值三列必须完全对齐（通栏两栏并置时即两条轴）
  const axes = new Map();
  for (const row of stats) {
    if (!axes.has(row.labelL)) axes.set(row.labelL, []);
    axes.get(row.labelL).push(row);
  }
  for (const [axisLeft, items] of axes) {
    const uniq = (key) => [...new Set(items.map((x) => x[key]))];
    const mid = uniq('midL');
    const midW = uniq('midW');
    const val = uniq('valL');
    const tall = items.filter((x) => x.valH > 24);
    ok(tall.length === 0, `值列不折行 · ${sec}@${axisLeft}`, JSON.stringify(tall.map((x) => [x.label, x.valH])));
    if (items.length >= 2) {
      ok(
        mid.length === 1 && midW.length === 1 && val.length === 1,
        `共列网格对齐 · ${sec}@${axisLeft}`,
        `中列 ${JSON.stringify(mid)} 宽 ${JSON.stringify(midW)} 值列 ${JSON.stringify(val)}`
      );
      const bars = items.filter((x) => x.kind === 'bar');
      if (bars.length >= 2) {
        ok(
          new Set(bars.map((b) => b.midL)).size === 1 && new Set(bars.map((b) => b.midW)).size === 1,
          `计量条同起同止 · ${sec}@${axisLeft}`,
          JSON.stringify(bars.map((b) => [b.midL, b.midW]))
        );
      }
    }
  }
  if (lists.length > 0) {
    ok(
      uniq(lists, 'labelL').length === 1 && uniq(lists, 'valL').length === 1,
      `名录式条目首尾对齐 · ${sec}`,
      `名 ${JSON.stringify(uniq(lists, 'labelL'))} 值 ${JSON.stringify(uniq(lists, 'valL'))}`
    );
  }
}

// 行数上限：版面「简洁」的可执行定义
const LINE_CAPS = {
  今日之事: 16, 下一膳: 13, 今日之练: 15,
  身体近况: 8, 今日体感: 6, 体征档: 11, 情景外推: 5, 近况: 9,
};
for (const { sec, n } of d.lines) {
  const cap = LINE_CAPS[sec];
  if (cap === undefined) continue;
  ok(n <= cap, `行数 ≤${cap} · ${sec}`, `实为 ${n} 行`);
}

const headTops = d.heads.map((h) => h.box.t);
if (width >= 1024) {
  // 桌面:按 y 聚类章节头,左右栏同 y 成对(≤2px)
  const heads = d.heads;
  const clusters = [];
  for (const h of heads) {
    const c = clusters.find((cl) => near(cl.tops[0], h.box.t, 6));
    if (c) { c.tops.push(h.box.t); c.lefts.push(h.box.l); } else clusters.push({ tops: [h.box.t], lefts: [h.box.l] });
  }
  const pairedRows = clusters.filter((c) => c.lefts.length >= 2 && new Set(c.lefts).size >= 2);
  ok(pairedRows.length >= 3, '三对章节头跨栏成对', `只配出 ${pairedRows.length} 对`);
  pairedRows.forEach((c, i) => {
    const delta = Math.max(...c.tops) - Math.min(...c.tops);
    ok(delta <= 2, `行${i + 1} 章节头 y 差 ≤2px`, `${Math.min(...c.tops)} vs ${Math.max(...c.tops)} → ${delta}px`);
  });
  const secTops = d.sections.slice(0, 6).map((s) => s.box.t);
  const sRows = [...new Set(secTops)].sort((a, b) => a - b);
  ok(sRows.filter((t) => secTops.filter((x) => near(x, t, 6)).length >= 2).length >= 3, '三对 section 顶对齐', JSON.stringify(sRows));
  const leftL = [...new Set(d.heads.map((h) => h.box.l))].sort((a, b) => a - b);
  ok(leftL.length <= 2, '最多两列标题左缘', JSON.stringify(leftL));
} else {
  ok(new Set(headTops.map((t) => 0)).size === 1, '移动端结构', '');
  const lefts = [...new Set(d.heads.map((h) => h.box.l))];
  ok(lefts.length === 1, '移动端 7 个章节头左缘一致', JSON.stringify(lefts));
  ok(d.heads.length >= 6, '章节头数量 ≥6', String(d.heads.length));
}

console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED @${width}px` : `\nALL LAYOUT CHECKS PASSED @${width}px`);
process.exit(fails.length ? 1 : 0);
