// Loads the pages FROM the running launcher and routes every page request back to it over real HTTP.
const {JSDOM,VirtualConsole}=require('../node_modules/jsdom');const ERRORS=[];const assert=require('assert');const port=process.argv[2],BASE='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let n=0;const ok=m=>{n++;console.log('E2E '+m)};
async function open(path){
  const html=await (await fetch(BASE+path)).text(),requests=[];
  const vc=new VirtualConsole();vc.on('jsdomError',e=>ERRORS.push(path+': '+(e.message||e)));vc.on('error',e=>ERRORS.push(path+' console.error: '+e));
  const w=new JSDOM(html,{url:BASE+path,virtualConsole:vc,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=m=>{throw new Error('alert: '+m)};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
    w.fetch=async(u,o)=>{const url=new URL(String(u),BASE);requests.push(url.pathname+url.search);assert.strictEqual(url.origin,BASE,'page left the launcher: '+url);
      const r=await fetch(url,{headers:(o&&o.headers)||{}});const text=await r.text();return {ok:r.ok,status:r.status,json:async()=>JSON.parse(text)}};}}).window;
  return {w,requests,$:id=>w.document.getElementById(id)};
}
(async()=>{
  const start=await (await fetch(BASE+'/')).text();assert(start.includes('edge-lab-v7.html'));ok('launcher serves START-HERE');
  const {w,requests,$}=await open('/edge-lab/edge-lab-v7.html');await sleep(1200);
  assert.match($('liveGrid').textContent,/\$64,123/);ok('live strip through real proxy');
  $('scanMarkets').click();for(let i=0;i<80&&!/SCAN FAILED|complete|Complete|partial|Partial/.test($('scanStatus').textContent);i++)await sleep(250);
  assert(!/SCAN FAILED/.test($('scanStatus').textContent),'scan: '+$('scanStatus').textContent);
  const scan=w.eval('LAST_SCAN');assert(scan&&scan.result.errors.length===0,'scan errors: '+JSON.stringify(scan&&scan.result.errors));
  assert.strictEqual(JSON.stringify(scan.result.details.map(d=>d.product)),'["BTC-USD","ETH-USD","SOL-USD"]');
  ok('daily scan through real proxy: '+scan.result.details.map(d=>d.product+' '+d.bars).join(', ')+' bars; '+$('scanStatus').textContent.slice(0,60));
  w.document.querySelector('nav button[data-p="control"]').click();await sleep(2500);
  const v=id=>+$(id).value;
  assert.strictEqual(v('rEntry'),64122.5);assert.strictEqual(v('rStop'),58000);assert.strictEqual(v('rEquity'),5123.45);assert.strictEqual(v('rCash'),3100);
  assert.strictEqual(v('rOpen'),594.57);  // BTC 0.025×(60,000−56,900 + 56,900×1.2%) = 94.57, + unprotected ETH 500assert.strictEqual(v('rEF'),1.2);assert.match($('riskOut').textContent,/Experiment status/);
  ok('Capital plan filled from real launcher + JWT-verified account, and calculated');
  // Desk Fetch button: 400 daily bars through the proxy.
  $('dPair').value='BTC-USD';$('dGran').value='86400';$('dDays').value='600';$('fetchData').click();
  for(let i=0;i<60&&!/600 bars/.test($('dataInfo').textContent)&&!/Fetch failed/.test($('fetchOut').textContent);i++)await sleep(250);
  assert(!/Fetch failed/.test($('fetchOut').textContent),$('fetchOut').textContent);assert.match($('dataInfo').textContent,/600 bars/,$('dataInfo').textContent);
  assert(requests.filter(r=>r.startsWith('/coinbase-exchange/products/BTC-USD/candles?')).length>=2);ok('desk Fetch pulls candles through the proxy');
  w.document.querySelector('nav button[data-p="jrn"]').click();await sleep(100);$('importFills').click();await sleep(1500);
  assert.match($('fillsOut').textContent,/\$62,000\.00/);ok('Journal import reads real fills route');
  assert(requests.filter(r=>r.startsWith('/account/')).length>=3);w.close();
  const lab=await open('/edge-lab/strategy-lab.html');await sleep(800);lab.$('refreshMarkets').click();
  for(let i=0;i<60&&!/pool ready|failed|error/i.test(lab.$('marketOut').textContent);i++)await sleep(250);
  assert.match(lab.$('marketOut').textContent,/Daily market pool ready/,lab.$('marketOut').textContent);ok('lab Refresh market pool: BTC/ETH/SOL 1,800 bars each via proxy');lab.w.close();
  assert.strictEqual(ERRORS.length,0,'uncaught page errors: '+ERRORS.join(' | '));ok('no uncaught script errors on either page');
  console.log('E2E PAGE CHECKS PASSED ('+n+')');process.exit(0);
})().catch(e=>{console.error('E2E FAIL',e);process.exit(1)});
