// CDP full-page screenshot + layout probe.  Usage: node shot.mjs <url> <width> <out.png>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

const url = process.argv[2], width = Number(process.argv[3] || 1440), out = process.argv[4];
const profile = mkdtempSync('/tmp/phc-prof-');
const port = 9500 + Math.floor(Math.random() * 400);
const chrome = spawn('/usr/bin/chromium', ['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars',
  '--force-device-scale-factor=1',`--remote-debugging-port=${port}`,'--user-data-dir='+profile,'--window-size=800,600','about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));

let wsUrl;
for (let i=0;i<60 && !wsUrl;i++){ try { const l=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); wsUrl=l.find(t=>t.type==='page')?.webSocketDebuggerUrl;} catch{} if(!wsUrl) await sleep(250);}
if(!wsUrl){ console.error('FAIL no devtools'); process.exit(1);}

const ws = new WebSocket(wsUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws error')); });
let id=0; const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,m=>m.error?rej(new Error(m.error.message)):res(m.result));ws.send(JSON.stringify({id:i,method,params}));});
const evalJs = async (expression) => (await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
await send('Page.enable');
await send('Runtime.enable');
const errs=[]; ws.addEventListener('message', e=>{const m=JSON.parse(e.data); if(m.method==='Runtime.exceptionThrown'||m.method==='Log.entryAdded') errs.push(JSON.stringify(m.params).slice(0,240));});
const nav = await send('Page.navigate',{url});
console.error('NAV', JSON.stringify(nav));
let tries=0;
for (;tries<24;tries++){ if (await evalJs('document.querySelectorAll("main").length')) break; await sleep(750); }
console.error('TRIES', tries, 'ERRS', errs.slice(0,4).join(' | '));
await sleep(1200);

console.error('STATE', JSON.stringify(await evalJs('({href:location.href, mains:document.querySelectorAll("main").length, bodyLen:document.body.innerHTML.length, ready:document.readyState})')));
const probe = JSON.parse(await evalJs(`JSON.stringify({
  docH: document.documentElement.scrollHeight,
  cols: [...document.querySelectorAll('main > div > div')].map(e => Math.round(e.getBoundingClientRect().height)),
  overflow: [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > innerWidth + 1).length,
})`));
console.log('PROBE', JSON.stringify(probe));

const shot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:true,
  clip:{x:0,y:0,width,height:probe.docH,scale:1} });
writeFileSync(out, Buffer.from(shot.data,'base64'));
console.log('WROTE', out, width+'x'+probe.docH);
chrome.kill(); try{rmSync(profile,{recursive:true,force:true});}catch{} process.exit(0);
