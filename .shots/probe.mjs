// Layout alignment probe: node probe.mjs <url> <width>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
const url = process.argv[2], width = Number(process.argv[3] || 1440);
const profile = mkdtempSync('/tmp/phc-prof-');
const port = 9900 + Math.floor(Math.random()*90);
const chrome = spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',`--remote-debugging-port=${port}`,'--user-data-dir='+profile,'--window-size=800,600','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let wsUrl; for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();wsUrl=l.find(t=>t.type==='page')?.webSocketDebuggerUrl;}catch{} if(!wsUrl)await sleep(250);}
const ws=new WebSocket(wsUrl); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'));});
let id=0;const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const send=(m,q)=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(x.error.message)):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result.value;
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
await send('Page.navigate',{url});
for(let i=0;i<30;i++){ if(await ev('document.querySelectorAll("main").length')) break; await sleep(500);} await sleep(800);
const out = JSON.parse(await ev(`JSON.stringify((()=>{
  const r=e=>{const b=e.getBoundingClientRect();return {t:Math.round(b.top+scrollY),l:Math.round(b.left),w:Math.round(b.width),h:Math.round(b.height)};};
  const heads=[...document.querySelectorAll('main h2')].map(h=>({txt:h.textContent.trim().slice(0,12), font:getComputedStyle(h).fontSize, ...r(h), head:r(h.parentElement)}));
  const rules=[...document.querySelectorAll('main section > div:first-child')].map(d=>({bd:getComputedStyle(d).borderBottomWidth, ...r(d)}));
  const btnRows=[...document.querySelectorAll('main section')].map(s=>({sec:s.querySelector('h2')?.textContent.trim().slice(0,8), ...r(s)}));
  const overflow=[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width>0).length;
  return {heads,rules,sections:btnRows,docH:document.documentElement.scrollHeight,overflow};
})())`);
console.log(JSON.stringify(out,null,1));
chrome.kill(); try{rmSync(profile,{recursive:true,force:true});}catch{} process.exit(0);
