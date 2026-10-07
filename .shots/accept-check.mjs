/**
 * 验收核对（critique 修复批）：
 *  1 归膳明示（表头「此录将归入 · X膳」）
 *  2 焦点圈定（Tab 首尾循环）+ 背景 inert
 *  3 遮罩拦稿（有稿时点遮罩不阖 + 告知句）
 *  4 残稿回填（Esc 离表 → 重开回填 + 弃稿钮）→ 照准存上即焚
 *  5 回执读屏（toast role=status aria-live=polite + 归膳回执）
 *  6 390 表不越版（录一练 scrollHeight ≤ clientHeight）
 *  7 占位符对比度 ≥ 4.5:1
 * 运行输出写 /tmp（工作区写入会触发 Vite full-reload，杀掉弹层）。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { writeFileSync } from 'node:fs';

const profile = mkdtempSync('/tmp/phc-prof-');
const port = 9911;
const chrome = spawn(
  '/usr/bin/chromium',
  [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
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
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: String(detail ?? '') });

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2500);

  // ---------- 1. 归膳明示 ----------
  await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('别录一品')).click()`);
  await sleep(600);
  const slotLine = await ev(`document.querySelector('[role=dialog] p')?.textContent ?? ''`);
  check('归膳明示表头', /此录将归入 · (早膳|午膳|晚膳|加餐)（依保存时刻定）/.test(slotLine), slotLine);

  // ---------- 1b. 占位符对比度（表开着才有占位符） ----------
  const contrast = await ev(`(() => {
    const el = document.querySelector('#rs-food');
    if (!el) return JSON.stringify({err:'no-input'});
    let decl = '';
    const walk = (rules) => {
      for (const r of rules) {
        if (r.cssRules) walk(r.cssRules); // @layer 等块规则要下钻
        if ((r.selectorText||'').includes('::placeholder') && r.style && r.style.color) decl = r.style.color;
      }
    };
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules } catch { continue }
      walk(rules);
    }
    let hex = '';
    if (decl.includes('var(')) {
      const tok = decl.match(/var\\((--[a-z0-9-]+)\\)/);
      if (tok) hex = getComputedStyle(document.documentElement).getPropertyValue(tok[1]).trim();
    } else hex = decl;
    const bg = getComputedStyle(el).backgroundColor;
    const lum = (c) => { const [r,g,b]=c.match(/\\d+/g).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}); return 0.2126*r+0.7152*g+0.0722*b };
    const rgbOf = (h) => { h=h.replace('#',''); if(h.length===3)h=h.split('').map(x=>x+x).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(',') };
    const L1=lum(rgbOf(hex)), L2=lum(bg);
    const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    return JSON.stringify({decl,hex,bg,ratio:Math.round(ratio*100)/100});
  })()`);
  {
    const c = JSON.parse(contrast);
    check('占位符对比度 ≥4.5', (c.ratio ?? 0) >= 4.5, JSON.stringify(c));
  }

  // ---------- 2. 焦点圈定 + 背景 inert ----------
  const mainInert = await ev(`document.querySelector('main').hasAttribute('inert')`);
  check('背景 inert（main）', mainInert, `main inert=${mainInert}`);
  const trap = await ev(`(() => {
    const p = document.querySelector('[role=dialog]');
    const F='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const nodes=[...p.querySelectorAll(F)].filter(n=>n.getClientRects().length>0);
    if(!nodes.length) return 'no-nodes';
    nodes[nodes.length-1].focus();
    nodes[nodes.length-1].dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
    const afterLast = document.activeElement === nodes[0];
    nodes[0].focus();
    nodes[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true,shiftKey:true}));
    const afterFirst = document.activeElement === nodes[nodes.length-1];
    return afterLast && afterFirst ? 'wrap-ok' : 'fail:'+afterLast+','+afterFirst;
  })()`);
  check('焦点圈定 Tab 首尾循环', trap === 'wrap-ok', trap);

  // ---------- 3. 遮罩拦稿 ----------
  await ev(`(() => {
    const el = document.querySelector('#rs-food');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el, '测试残稿');
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await sleep(300);
  await ev(`(() => {
    const bd = document.querySelector('[role=dialog]').parentElement;
    bd.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  })()`);
  await sleep(300);
  const stillOpen = await ev(`!!document.querySelector('[role=dialog]')`);
  const guardShown = await ev(`document.body.textContent.includes('点遮罩不阖')`);
  check('有稿时遮罩不阖', stillOpen && guardShown, `open=${stillOpen} guard=${guardShown}`);

  // ---------- 4. Esc 离表 → 残稿回填 → 弃稿 ----------
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await sleep(500);
  const closed = await ev(`!document.querySelector('[role=dialog]')`);
  const draftSaved = await ev(`(sessionStorage.getItem('phc_draft_meal')||'').includes('测试残稿')`);
  check('Esc 可离表 + 残稿落 sessionStorage', closed && draftSaved, `closed=${closed} draft=${draftSaved}`);

  await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('别录一品')).click()`);
  await sleep(600);
  const restored = await ev(`document.querySelector('#rs-food')?.value ?? ''`);
  const discardBtn = await ev(`document.body.textContent.includes('弃此残稿')`);
  check('重开回填残稿 + 弃稿钮', restored === '测试残稿' && discardBtn, `value=${restored} discardBtn=${discardBtn}`);

  await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('弃此残稿')).click()`);
  await sleep(400);
  const discarded = await ev(`document.querySelector('#rs-food')?.value === '' && !sessionStorage.getItem('phc_draft_meal')`);
  check('弃稿清空', discarded, `discarded=${discarded}`);

  // ---------- 5. 回执读屏 + 归膳回执（照准一膳） ----------
  await ev(`(() => {
    const el = document.querySelector('#rs-food');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el, '验收之膳, 饭一碗');
    el.dispatchEvent(new Event('input',{bubbles:true}));
    const k = document.querySelector('#rs-kcal');
    const s2 = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    s2.call(k, '500');
    k.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await sleep(300);
  await ev(`[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.includes('照准')).click()`);
  await sleep(1400);
  const toastInfo = await ev(`(() => {
    const t = document.querySelector('[role=status][aria-live=polite]');
    const all = [...document.querySelectorAll('[role=status]')].map(x=>x.textContent).join(' | ');
    return t ? t.textContent : 'NO-TOAST :: ' + all;
  })()`);
  check('回执 role=status+aria-live 且归膳明示', /膳食已录于册 · 归(早膳|午膳|晚膳|加餐)/.test(toastInfo), toastInfo);
  const draftCleared = await ev(`!sessionStorage.getItem('phc_draft_meal')`);
  check('存上即焚残稿', draftCleared, `draft=${draftCleared}`);
  const sheetClosedAfter = await ev(`!document.querySelector('[role=dialog]')`);
  check('照准后阖表', sheetClosedAfter, `closed=${sheetClosedAfter}`);

  // ---------- 6. 390 录一练不越版 ----------
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(800);
  const noHScroll = await ev(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  check('390 页面无横向滚动', noHScroll, `sw=${await ev('document.documentElement.scrollWidth')}`);
  await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('另择动作')).click()`);
  await sleep(700);
  const fit = await ev(`(() => {
    const f = document.querySelector('[role=dialog] form');
    const p = document.querySelector('[role=dialog]');
    return JSON.stringify({formSh: f.scrollHeight, formCh: f.clientHeight, panelBottom: Math.round(p.getBoundingClientRect().bottom), vh: window.innerHeight, panelSh: p.scrollHeight, panelCh: p.clientHeight});
  })()`);
  const fitObj = JSON.parse(fit);
  check('390 录一练一屏放下', fitObj.formSh <= fitObj.formCh + 1 && fitObj.panelSh <= fitObj.panelCh + 1, fit);
  // 录一练「约算」与空名之戒
  const yuesuan = await ev(`document.querySelector('[role=dialog]').textContent.includes('约算')`);
  check('时长来源文案「约算」', yuesuan, `yuesuan=${yuesuan}`);
  await ev(`(() => {
    const el = document.querySelector('#rs-workout-title');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await sleep(200);
  await ev(`[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.includes('照准')).click()`);
  await sleep(400);
  const nameHint = await ev(`document.body.textContent.includes('未填练名')`);
  check('录一练空名之戒走 hint（无原生气泡）', nameHint && await ev(`!!document.querySelector('[role=dialog]')`), `hint=${nameHint}`);
} catch (err) {
  results.push({ name: 'SCRIPT-ERROR', ok: false, detail: String(err?.stack || err) });
}

const failed = results.filter((r) => !r.ok);
console.log('=== 验收核对 accept-check ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`);
console.log(failed.length === 0 ? 'ALL ACCEPT CHECKS PASSED.' : `${failed.length} CHECKS FAILED.`);
writeFileSync('/tmp/accept-check.out', JSON.stringify(results, null, 2));
chrome.kill();
process.exit(failed.length === 0 ? 0 : 1);
