// Live market strip + launcher routing, in both built apps, with a mocked Coinbase.
const {JSDOM}=require('../node_modules/jsdom');const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.join(__dirname,'..','..');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAY=86400;
function load(file,url,fetchImpl){
  const calls=[];
  const w=new JSDOM(fs.readFileSync(path.join(ROOT,file),'utf8'),{url,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
    w.fetch=async(u,o)=>{calls.push(String(u));return fetchImpl(String(u),o)};}}).window;
  return {w,calls};
}
const res=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
function coinbase(u){
  if(u.endsWith('/ticker'))return res(200,{price:'64123.45',bid:'64120.00',ask:'64125.00',time:'2026-09-22T12:00:00Z'});
  if(u.endsWith('/stats'))return res(200,{open:'63000',high:'64500',low:'62800',last:'64123.45',volume:'12000.5'});
  if(u.includes('/candles')){
    const q=new URL(u,'http://x').searchParams,s=Date.parse(q.get('start'))/1000,e=Date.parse(q.get('end'))/1000,rows=[];
    // Include the in-progress bucket deliberately: the client must drop it.
    const now=Math.floor(Date.now()/1000/DAY)*DAY;
    for(let t=Math.ceil(s/DAY)*DAY;t<=Math.min(e+DAY,now);t+=DAY)rows.push([t,90,110,100,105,1]);
    return res(200,rows.reverse());
  }
  return res(404,{message:'NotFound'});
}
let n=0;const ok=m=>{n++;console.log('LIVE '+m)};
(async()=>{
  for(const file of ['edge-lab/edge-lab-v7.html','edge-lab/strategy-lab.html']){
    // 1. Under the launcher: auto-refresh goes through the proxy and renders stats.
    let {w,calls}=load(file,'http://127.0.0.1:8765/'+file,coinbase);await sleep(600);
    const d=w.document;assert(d.getElementById('liveStrip'),'strip present');
    assert(calls.includes('/coinbase-exchange/products/BTC-USD/stats')&&calls.includes('/coinbase-exchange/products/SOL-USD/ticker'),'proxied live calls: '+calls.join(','));
    assert(calls.every(c=>c.startsWith('/coinbase-exchange/')),'no direct exchange calls under launcher');
    const grid=d.getElementById('liveGrid').textContent;
    assert(grid.includes('$64,123')&&grid.includes('+1.78% 24h')&&grid.includes('spread 0.8 bps')&&grid.includes('Vol $769.5M'),grid);
    assert.match(d.getElementById('liveDot').className,/ok/);ok(file+' launcher auto-refresh renders price, 24h change, spread, volume');
    // 2. Routing helper.
    assert.strictEqual(w.routePublic('https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=86400'),'/coinbase-exchange/products/ETH-USD/candles?granularity=86400');
    assert.strictEqual(w.routePublic('https://api.coinbase.com/api/v3/brokerage/market/products?limit=1'),'/coinbase-public/market/products?limit=1');
    assert.strictEqual(w.routePublic('https://evil.test/x'),'https://evil.test/x');ok(file+' routePublic maps only Coinbase public origins');
    // 3. Candle fetch goes through the proxy and drops the in-progress day.
    calls.length=0;const bars=await w.fetchCandles('BTC-USD',86400,400,()=>{});
    assert(calls.length>=2&&calls.every(c=>c.startsWith('/coinbase-exchange/products/BTC-USD/candles?')),calls.join(','));
    const today=Math.floor(Date.now()/1000/DAY)*DAY;assert.strictEqual(bars.at(-1).t,today-DAY);assert.strictEqual(bars.length,400);
    ok(file+' fetchCandles uses launcher, completed bars only ('+bars.length+')');
    w.close();
    // 4. Launcher error text reaches the user verbatim.
    const MSG='SSL certificate check failed. On macOS run "Install Certificates.command"';
    ({w,calls}=load(file,'http://127.0.0.1:8765/'+file,()=>res(502,{error:MSG})));await sleep(600);
    assert(w.document.getElementById('liveDiag').textContent.includes('Install Certificates'),'diag shows reason');
    assert.match(w.document.getElementById('liveDot').className,/bad/);
    await assert.rejects(()=>w.fetchCandles('BTC-USD',86400,10,()=>{}),/Install Certificates/);ok(file+' specific failure reason surfaces in strip and fetch');
    w.close();
    // 5. Launcher down (network TypeError).
    ({w}=load(file,'http://127.0.0.1:8765/'+file,()=>{throw new TypeError('Failed to fetch')}));await sleep(600);
    assert(w.document.getElementById('liveDiag').textContent.includes('terminal window'),w.document.getElementById('liveDiag').textContent);ok(file+' launcher-down message');
    w.close();
    // 6. Foreign origin: no automatic requests (never consumes a page's own fetch).
    ({w,calls}=load(file,'https://example.org/',coinbase));await sleep(400);
    assert.strictEqual(calls.length,0);assert.match(w.document.getElementById('liveStatus').textContent,/Press Refresh/);ok(file+' no auto-requests off-launcher');
    w.close();
  }
  console.log('LIVE STRIP TESTS PASSED ('+n+')');process.exit(0);
})().catch(e=>{console.error('LIVE FAIL',e);process.exit(1)});
