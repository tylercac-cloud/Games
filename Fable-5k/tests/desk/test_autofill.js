// Autofill + linked inputs, end to end in the built pages with a mocked launcher.
const {JSDOM}=require('../node_modules/jsdom');const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.join(__dirname,'..','..'),DAY=86400,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=(s,b)=>({ok:s>=200&&s<300,status:s,json:async()=>b});
const SNAP={asOf:'2026-09-22T12:00:00Z',equity:5123.45,cash:3100,fees:{taker:0.012,maker:0.006,tier:'Intro 1'},openStopRisk:75,unprotectedUSD:500,
  positions:[{asset:'BTC',product:'BTC-USD',qty:.025,valueUSD:1500,price:60000,stops:[{stop:57000,qty:.025}],coveredQty:.025,unprotectedUSD:0,stopRiskUSD:75},{asset:'ETH',product:'ETH-USD',qty:.2,valueUSD:500,price:2500,stops:[],coveredQty:0,unprotectedUSD:500,stopRiskUSD:0}]};
const FILLS={product:'BTC-USD',fills:[{tradeId:'t1',orderId:'b1',time:'2026-09-01T00:00:01Z',side:'BUY',price:60000,qty:.006,fee:3.6},{tradeId:'t1b',orderId:'b1',time:'2026-09-01T00:00:02Z',side:'BUY',price:60000,qty:.004,fee:3.6},
  {tradeId:'t2',orderId:'s1',time:'2026-09-10T00:00:02Z',side:'SELL',price:62000,qty:.01,fee:7.44},{tradeId:'t3',orderId:'b2',time:'2026-09-15T00:00:00Z',side:'BUY',price:63000,qty:.002,fee:1.5}]};
function launcher(opts={}){
  const calls=[];
  const fn=async(u,o)=>{u=String(u);calls.push({u,h:(o&&o.headers)||{}});
    if(u.endsWith('/ticker'))return res(200,{price:'64123',bid:'64120',ask:'64125'});
    if(u.endsWith('/stats'))return res(200,{open:'63000',high:'64500',low:'62800',last:'64123',volume:'100'});
    if(u.includes('/candles')){const q=new URL(u,'http://x').searchParams,s=Date.parse(q.get('start'))/1000,e=Date.parse(q.get('end'))/1000,rows=[];
      for(let t=Math.ceil(s/DAY)*DAY;t<=e;t+=DAY){const low=58000+(t/DAY)%7*100;rows.push([t,low,low+3000,low+1000,low+1500,1])}return res(200,rows.reverse())}
    if(u==='/account/status')return res(200,opts.noKey?{configured:false}:{configured:true,ok:true,alg:'ES256',file:'k.json'});
    if(u==='/account/snapshot')return res(200,SNAP);
    if(u.startsWith('/account/fills?product=BTC-USD'))return res(200,FILLS);
    return res(404,{error:'nf'});};
  return {fn,calls};
}
function load(file,url,fetchImpl,seed){
  return new JSDOM(fs.readFileSync(path.join(ROOT,file),'utf8'),{url,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
    if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,JSON.stringify(v));w.fetch=fetchImpl}}).window;
}
let n=0;const ok=m=>{n++;console.log('AUTO '+m)};
const tab=(w,p)=>w.document.querySelector('nav button[data-p="'+p+'"]').click();
(async()=>{
  const L=launcher(),w=load('edge-lab/edge-lab-v7.html','http://127.0.0.1:8765/edge-lab/edge-lab-v7.html',L.fn),d=w.document,$=id=>d.getElementById(id);
  await sleep(300);tab(w,'control');await sleep(1200);
  const v=id=>$(id).value;
  // Expected numbers, derived by hand.
  const today=Math.floor(Date.now()/1000/DAY)*DAY,lows=[];for(let t=today-30*DAY;t<today;t+=DAY)lows.push(58000+(t/DAY)%7*100);
  assert.strictEqual(+v('rEntry'),64122.5);                         // (64120+64125)/2
  assert.strictEqual(+v('rES'),1);assert.strictEqual(+v('rXS'),1);  // half spread 0.39 bp -> minimum 1 bp
  assert.strictEqual(+v('rStop'),Math.min(...lows));
  assert.strictEqual(+v('rEquity'),5123.45);assert.strictEqual(+v('rCash'),3100);assert.strictEqual(+v('rOpen'),575);assert.strictEqual(+v('rPeak'),5123.45);
  assert.strictEqual(+v('rEF'),1.2);assert.strictEqual(+v('rXF'),1.2);
  assert.match($('riskOut').textContent,/Experiment status/);ok('Capital plan fills itself and calculates (entry, stop, slippage, equity, cash, open risk, HWM, fees)');
  assert.strictEqual(+v('aEF'),1.2);assert.strictEqual(+v('aXS'),1);assert.strictEqual(+v('cost'),2.42);ok('fees and slippage flow to Execution and Test cost (1.2+1.2+0.02 = 2.42%)');
  assert(L.calls.filter(c=>c.u.startsWith('/account/')).every(c=>c.h['X-Fable-Local']==='1'));assert(L.calls.filter(c=>!c.u.startsWith('/account/')).every(c=>!c.h['X-Fable-Local']));
  assert(!d.body.innerHTML.includes('privateKey'));ok('account calls carry the local header; public calls do not');
  assert.match($('acctOut').textContent,/Intro 1/);assert.match($('acctOut').textContent,/none/);ok('account panel shows fee tier and flags the unprotected ETH position');
  // Your edits win.
  w.fableAuto.userEdit('rStop');$('rStop').value='61000';$('autoFill').click();await sleep(900);
  assert.strictEqual(v('rStop'),'61000');assert.match($('autoStatus').textContent,/Kept your edits: stop/);ok('typed values are never overwritten');
  // Linking a manual edit.
  w.fableAuto.userEdit('aXF');$('aXF').value='0.6';w.fableAuto.linkFrom('aXF');
  assert.strictEqual(v('rXF'),'0.6');assert.strictEqual(+v('cost'),1.82);ok('editing one fee updates its twin and the round-trip cost');
  // Journal: prefill from plan, then import fills.
  tab(w,'jrn');await sleep(50);
  assert.strictEqual(v('jSym'),'BTC-USD');assert.strictEqual(+v('jExp'),64122.5);assert(+v('jSize')>0);ok('Journal prefilled from the last plan');
  $('importFills').click();await sleep(300);
  assert.match($('fillsOut').textContent,/Still open/);const use=d.querySelector('#fillsOut button[data-trip="b1"]');assert(use);use.click();
  assert.strictEqual(+v('jAct'),60000);assert.strictEqual(+v('jExit'),62000);assert.strictEqual(+v('jFee'),14.64);assert.strictEqual(+v('jSize'),600);assert.strictEqual(v('jExp'),'');
  assert.match($('fillsOut').textContent,/No Capital plan was run before this trade/);ok('round trip imported: VWAP entry/exit, summed fees; stale plan not used as expected price');
  $('jExp').value='59900';const before=w.eval('TRADES.length');$('addTrade').click();await sleep(400);
  assert.strictEqual(w.eval('TRADES.length'),before+1);assert.match($('fillsOut').textContent,/Logged/);assert(!d.querySelector('#fillsOut button[data-trip="b1"]'));ok('added trade marked Logged, cannot be imported twice');
  // Sizing from Journal.
  tab(w,'siz');await sleep(50);
  assert.strictEqual(+v('kN'),1);assert.strictEqual(+v('kW'),1);assert.strictEqual(+v('kC'),5123.45);ok('Sizing counts wins/trades from Journal, capital from equity');
  // Budget from loaded data.
  $('loadBundled').click();await sleep(300);tab(w,'bud');await sleep(50);
  const B=w.eval('BARS');assert.strictEqual(+v('bY'),Math.round(B.length*DAY/31557600*100)/100);ok('Budget years = loaded bars ('+B.length+') × 1 day');
  w.close();

  // Lab picks up shared costs.
  const w2=load('edge-lab/strategy-lab.html','http://127.0.0.1:8765/edge-lab/strategy-lab.html',launcher().fn,{'fable-shared:costs':{entryFee:0.6,exitFee:1.2,entrySlip:2,exitSlip:3,feeSource:'coinbase',slipSource:'spread'}});
  await sleep(300);assert.strictEqual(+w2.document.getElementById('cost').value,1.85);ok('lab Test cost = 0.6+1.2+0.05 = 1.85% from shared costs');w2.close();

  // No key: public parts still fill, account fields stay manual.
  const L3=launcher({noKey:true}),w3=load('edge-lab/edge-lab-v7.html','http://127.0.0.1:8765/edge-lab/edge-lab-v7.html',L3.fn);await sleep(300);tab(w3,'control');await sleep(1000);
  assert.strictEqual(w3.document.getElementById('rEquity').value,'5000');assert.strictEqual(+w3.document.getElementById('rEntry').value,64122.5);
  assert.match(w3.document.getElementById('autoStatus').textContent,/Account not connected/);assert(!L3.calls.some(c=>c.u==='/account/snapshot'));ok('without a key: price/stop/slippage fill, account fields untouched');w3.close();

  // Off-launcher: nothing automatic.
  const L4=launcher(),w4=load('edge-lab/edge-lab-v7.html','https://example.org/',L4.fn);await sleep(300);tab(w4,'control');await sleep(300);
  assert.strictEqual(L4.calls.length,0);ok('no automatic requests off-launcher');w4.close();

  // Trip builder edge cases.
  const T=load('edge-lab/strategy-lab.html','https://example.org/',async()=>res(404,{})).fableAuto.buildTrips([
    {orderId:'x',side:'SELL',time:'1',price:10,qty:5,fee:0},{orderId:'a',side:'BUY',time:'2',price:10,qty:1,fee:.1},{orderId:'b',side:'BUY',time:'3',price:12,qty:1,fee:.1},{orderId:'c',side:'SELL',time:'4',price:13,qty:1.995,fee:.2}]);
  assert.strictEqual(T.closed.length,1);assert.strictEqual(T.closed[0].entry,11);assert.strictEqual(T.closed[0].sizeUSD,22);assert(Math.abs(T.closed[0].pnl-(1.995*13-22*1.995/2-.4))<1e-9);assert.strictEqual(T.open,null);
  ok('trip builder: pre-window sells ignored, scale-ins averaged, 1% dust tolerance');
  console.log('AUTOFILL TESTS PASSED ('+n+')');process.exit(0);
})().catch(e=>{console.error('AUTO FAIL',e);process.exit(1)});
