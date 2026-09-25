// Autofill + linked inputs, end to end in the built pages with a mocked launcher.
const {JSDOM}=require('../node_modules/jsdom');const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.join(__dirname,'..','..'),DAY=86400,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const res=(s,b)=>({ok:s>=200&&s<300,status:s,json:async()=>b});
const SNAP={asOf:'2026-09-22T12:00:00Z',equity:5123.45,cash:3100,fees:{taker:0.012,maker:0.006,tier:'Intro 1'},openStopRisk:75,unprotectedUSD:500,
  positions:[{asset:'BTC',product:'BTC-USD',qty:.025,valueUSD:1500,price:60000,stops:[{stop:57000,qty:.025}],coveredQty:.025,unprotectedUSD:0,stopRiskUSD:75},{asset:'ETH',product:'ETH-USD',qty:.2,valueUSD:500,price:2500,stops:[],coveredQty:0,unprotectedUSD:500,stopRiskUSD:0}]};
const FILLS={product:'BTC-USD',fills:[{tradeId:'t1',orderId:'b1',time:'2026-09-01T00:00:01Z',side:'BUY',product:'BTC-USD',price:60000,qty:.006,fee:3.6},{tradeId:'t1b',orderId:'b1',time:'2026-09-01T00:00:02Z',side:'BUY',product:'BTC-USD',price:60000,qty:.004,fee:3.6},
  {tradeId:'t2',orderId:'s1',time:'2026-09-10T00:00:02Z',side:'SELL',product:'BTC-USD',price:62000,qty:.01,fee:7.44},{tradeId:'t3',orderId:'b2',time:'2026-09-15T00:00:00Z',side:'BUY',product:'BTC-USD',price:63000,qty:.002,fee:1.5}]};
function launcher(opts={}){
  const calls=[];
  const fn=async(u,o)=>{u=String(u);calls.push({u,h:(o&&o.headers)||{}});
    if(u.endsWith('/ticker'))return res(200,{price:'64123',bid:'64120',ask:'64125'});
    if(u.endsWith('/stats'))return res(200,{open:'63000',high:'64500',low:'62800',last:'64123',volume:'100'});
    if(u.includes('/candles')){const q=new URL(u,'http://x').searchParams,s=Date.parse(q.get('start'))/1000,e=Date.parse(q.get('end'))/1000,rows=[];
      for(let t=Math.ceil(s/DAY)*DAY;t<=e;t+=DAY){const low=58000+(t/DAY)%7*100;rows.push([t,low,low+3000,low+1000,low+1500,1])}return res(200,rows.reverse())}
    if(u==='/account/status')return res(200,opts.noKey?{configured:false}:{configured:true,ok:true,alg:'ES256',file:'k.json'});
    if(u==='/account/snapshot')return res(200,SNAP);
    if(u==='/account/fills?product=ALL&days=120')return res(200,FILLS);
    return res(404,{error:'nf'});};
  return {fn,calls};
}
function load(file,url,fetchImpl,seed){
  return new JSDOM(fs.readFileSync(path.join(ROOT,file),'utf8'),{url,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
    if(seed)for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,JSON.stringify(v));w.fetch=fetchImpl}}).window;
}
let n=0;const ok=m=>{n++;console.log('AUTO '+m)};const near3=(a,b)=>assert(Math.abs(a-b)<1e-6,a+' vs '+b);
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
  assert.strictEqual(+v('aEF'),1.2);assert.strictEqual(v('aXS'),'');assert.strictEqual(+v('cost'),2.42);ok('fees flow to Execution and Test cost (1.2+1.2+0.02 = 2.42%); live spread stays in Capital plan');
  assert(L.calls.filter(c=>c.u.startsWith('/account/')).every(c=>c.h['X-Fable-Local']==='1'));assert(L.calls.filter(c=>!c.u.startsWith('/account/')).every(c=>!c.h['X-Fable-Local']));
  {const b=d.body.cloneNode(true);b.querySelectorAll('script').forEach(x=>x.remove());assert(!b.innerHTML.includes('privateKey'))}/* rendered page, not the page's own code */ok('account calls carry the local header; public calls do not');
  assert.match($('acctOut').textContent,/Intro 1/);assert.match($('acctOut').textContent,/none/);ok('account panel shows fee tier and flags the unprotected ETH position');
  assert(!/All of it is experiment money/.test($('acctOut').textContent));
  // Deposit netting: $1,000 added to Main is not profit.
  $('acctDeposits').value='1000';$('acctDeposits').dispatchEvent(new w.Event('change'));await sleep(100);
  assert.strictEqual(+v('rEquity'),4123.45);assert.strictEqual(+v('rPeak'),5000);             // 5123.45-1000; peak 5123.45-1000=4123.45 -> floor $5,000
  assert.match($('acctOut').textContent,/experiment equity \$4,123\.45/);assert.match($('riskOut').textContent,/Experiment status/);
  ok('net deposits: equity 5,123.45 − 1,000 = 4,123.45; high-water mark shifted, plan recalculated');
  $('acctDeposits').value='0';$('acctDeposits').dispatchEvent(new w.Event('change'));await sleep(100);
  assert.strictEqual(+v('rEquity'),5123.45);assert.strictEqual(+v('rPeak'),5123.45);ok('removing the deposit restores the exact peak (4,123.45 + 1,000 = 5,123.45)');
  $('rPeak').value='5123.45';w.fableAuto.userEdit('rPeak');
  await sleep(300);assert.match($('ticketOut').textContent,/Trade ticket/);const keepStop=$('rStop').value;$('rStop').value=String(+$('rEntry').value+10);$('planRisk').click();await sleep(100);
  assert.match($('riskOut').textContent,/Check the inputs/);assert.strictEqual($('ticketOut').textContent,'');$('rStop').value=keepStop;$('planRisk').click();await sleep(300);assert.match($('ticketOut').textContent,/Trade ticket/);
  ok('a failed calculation removes the previous ticket; a valid one brings it back');
  // Failures never leave stale numbers behind for the automatic calculation.
  w.eval('window.__down=true');const origFetch=w.fetch;w.fetch=async(u,o)=>String(u).includes('/ticker')&&w.__down?res(502,{error:'Coinbase refused the request'}):origFetch(u,o);
  $('autoFill').click();await sleep(900);
  assert.strictEqual($('rEntry').value,'');assert.match($('autoStatus').textContent,/price: Coinbase refused/);ok('failed price fetch clears the old autofilled entry instead of reusing it');
  w.__down=false;w.fetch=origFetch;$('autoFill').click();await sleep(900);assert.strictEqual(+v('rEntry'),64122.5);
  // Switching asset mid-fill: the old asset's numbers must not land under the new asset.
  const slow=w.fetch;w.fetch=async(u,o)=>{if(String(u).includes('BTC-USD/ticker'))await sleep(400);if(String(u).includes('ETH-USD/ticker'))return res(200,{price:'2500',bid:'2500',ask:'2501'});return slow(u,o)};
  $('autoFill').click();await sleep(50);$('rAsset').value='ETH-USD';$('rAsset').dispatchEvent(new w.Event('change'));await sleep(2000);w.fetch=slow;
  assert.strictEqual($('rAsset').value,'ETH-USD');assert.strictEqual(+v('rEntry'),2500.5);assert.strictEqual($('rStop').value,'');assert.match($('autoStatus').textContent,/set the stop yourself/);assert.strictEqual($('ticketOut').textContent,'','no ticket for a coin without a fresh plan');
  ok('asset switched mid-fill: BTC price and stop discarded; ETH entry 2,500.50 filled, stop left blank because ETH is below the mocked 30-day low');
  $('rAsset').value='BTC-USD';$('rAsset').dispatchEvent(new w.Event('change'));await sleep(1200);
  // Your edits win.
  w.fableAuto.userEdit('rStop');$('rStop').value='61000';$('autoFill').click();await sleep(900);
  assert.strictEqual(v('rStop'),'61000');assert.match($('autoStatus').textContent,/Kept your edits: stop/);ok('typed values are never overwritten');
  // Linking a manual edit.
  w.fableAuto.userEdit('aXF');$('aXF').value='0.6';w.fableAuto.linkFrom('aXF');
  assert.strictEqual(v('rXF'),'0.6');assert.strictEqual(+v('cost'),1.82);ok('editing one fee updates its twin and the round-trip cost');
  $('autoFill').click();await sleep(900);assert.strictEqual(v('rXF'),'0.6');ok('a fee you entered is not replaced by the Coinbase tier on refresh');
  // Journal: prefill from plan, then import fills.
  tab(w,'jrn');await sleep(50);
  assert.strictEqual(v('jSym'),'BTC-USD');assert.strictEqual(+v('jExp'),64122.5);assert(+v('jSize')>0);ok('Journal prefilled from the last plan');
  await sleep(500);   // opening the Journal loads the trades by itself
  assert.match($('fillsOut').textContent,/1 trade to log/);assert.match($('fillsOut').textContent,/Still open: BTC/);
  const use=d.querySelector('#fillsOut button[data-trip="b1"]');assert(use);assert.strictEqual(use.dataset.follow,'No');assert.match(use.textContent,/no plan/);   // the only plan was made after this trade
  const before=w.eval('TRADES.length');use.click();await sleep(500);const LT=w.eval('TRADES').at(-1);
  assert.strictEqual(w.eval('TRADES.length'),before+1);assert.strictEqual(LT.act,60000);assert.strictEqual(LT.exit,62000);assert.strictEqual(LT.fee,14.64);assert.strictEqual(LT.size,600);
  assert.strictEqual(LT.exp,60000);assert.strictEqual(LT.follow,'No');assert.match(LT.note,/No Capital plan/);assert.strictEqual(LT.closedAt,'2026-09-10T00:00:02Z');
  ok('one tap logs the round trip (VWAP 60,000 → 62,000, fees 14.64, closed at the sell time); no earlier plan, so logged as not following one');
  assert.match($('fillsOut').textContent,/All Coinbase round trips/);assert(!d.querySelector('#fillsOut button[data-trip="b1"]'));ok('logged trip disappears from the list and cannot be logged twice');
  assert.strictEqual($('jSym').value,'');assert.strictEqual($('jSize').value,'');assert.strictEqual($('jFee').value,'0');assert.strictEqual($('jNote').value,'');ok('form is cleared after a one-tap log, so nothing carries into the next manual entry');
  // Sizing from Journal.
  tab(w,'siz');await sleep(50);
  assert.strictEqual(+v('kN'),1);assert.strictEqual(+v('kW'),1);assert.strictEqual(+v('kC'),5123.45);ok('Sizing counts wins/trades from Journal, capital from equity');
  // Budget from loaded data.
  $('loadBundled').click();await sleep(300);tab(w,'bud');await sleep(50);
  const B=w.eval('BARS');assert.strictEqual(+v('bY'),Math.round(B.length*DAY/31557600*100)/100);ok('Budget years = loaded bars ('+B.length+') × 1 day');
  w.close();

  // Lab picks up shared costs.
  const w2=load('edge-lab/strategy-lab.html','http://127.0.0.1:8765/edge-lab/strategy-lab.html',launcher().fn,{'fable-shared:costs':{entryFee:0.6,exitFee:1.2,entrySlip:2,exitSlip:3,feeSource:'coinbase',slipSource:'manual'}});
  await sleep(300);assert.strictEqual(+w2.document.getElementById('cost').value,1.85);assert.strictEqual(+w2.document.getElementById('aXS')?.value||3,3);ok('lab Test cost = 0.6+1.2+0.05 = 1.85% from shared costs');
  w2.eval("CURRENT_LOCK={id:'L1',sig:'x'}");w2.localStorage.setItem('fable-shared:costs',JSON.stringify({entryFee:0.1,exitFee:0.1,feeSource:'coinbase'}));w2.fableAuto.applyCosts();
  assert.strictEqual(+w2.document.getElementById('cost').value,1.85);ok('an active lab lock freezes the Test cost');
  w2.eval('CURRENT_LOCK=null');w2.fableAuto.applyCosts();assert.strictEqual(+w2.document.getElementById('cost').value,0.22);ok('cost updates again once no lock is active (0.1+0.1+0.02)');w2.close();

  // No key: public parts still fill, account fields stay manual.
  const L3=launcher({noKey:true}),w3=load('edge-lab/edge-lab-v7.html','http://127.0.0.1:8765/edge-lab/edge-lab-v7.html',L3.fn);await sleep(300);tab(w3,'control');await sleep(1000);
  assert.strictEqual(w3.document.getElementById('rEquity').value,'5000');assert.strictEqual(+w3.document.getElementById('rEntry').value,64122.5);
  assert.match(w3.document.getElementById('autoStatus').textContent,/Account not connected/);assert(!L3.calls.some(c=>c.u==='/account/snapshot'));ok('without a key: price/stop/slippage fill, account fields untouched');w3.close();

  // A whole-account key is called out.
  const BIG=JSON.parse(JSON.stringify(SNAP));BIG.equity=21000;const L5=launcher();const f5=L5.fn;L5.fn=async(u,o)=>u==='/account/snapshot'?res(200,BIG):f5(u,o);
  const w5=load('edge-lab/edge-lab-v7.html','http://127.0.0.1:8765/edge-lab/edge-lab-v7.html',L5.fn);await sleep(300);tab(w5,'control');await sleep(1000);
  assert.match(w5.document.getElementById('acctOut').textContent,/Experiment equity is \$21,000\.00/);
  w5.document.getElementById('acctExperimentOnly').click();assert(!/All of it is experiment money/.test(w5.document.getElementById('acctOut').textContent));
  w5.document.getElementById('autoFill').click();await sleep(900);assert(!/All of it is experiment money/.test(w5.document.getElementById('acctOut').textContent));
  assert.strictEqual(w5.document.getElementById('rEquity').value,'21000');ok('large balance asks once; confirming it is experiment money silences it for good');w5.close();
  // Off-launcher: nothing automatic.
  const L4=launcher(),w4=load('edge-lab/edge-lab-v7.html','https://example.org/',L4.fn);await sleep(300);tab(w4,'control');await sleep(300);
  assert.strictEqual(L4.calls.length,0);ok('no automatic requests off-launcher');w4.close();

  // Trip builder edge cases.
  const T=load('edge-lab/strategy-lab.html','https://example.org/',async()=>res(404,{})).fableAuto.buildTrips([
    {orderId:'x',side:'SELL',time:'1',price:10,qty:5,fee:0},{orderId:'a',side:'BUY',time:'2',price:10,qty:1,fee:.1},{orderId:'b',side:'BUY',time:'3',price:12,qty:1,fee:.1},{orderId:'c',side:'SELL',time:'4',price:13,qty:1.995,fee:.2}]);
  assert.strictEqual(T.closed.length,1);assert.strictEqual(T.closed[0].entry,11);assert.strictEqual(T.closed[0].sizeUSD,22);assert(Math.abs(T.closed[0].pnl-(1.995*13-22*1.995/2-.4))<1e-9);assert.strictEqual(T.open,null);
  ok('trip builder: pre-window sells ignored, scale-ins averaged, 1% dust tolerance');
  const T2=load('edge-lab/strategy-lab.html','https://example.org/',async()=>res(404,{})).fableAuto.buildTrips([
    {orderId:'a',side:'BUY',time:'1',price:100,qty:1,fee:1},{orderId:'b',side:'SELL',time:'2',price:120,qty:3,fee:3.6}]);
  assert.strictEqual(T2.closed.length,1);const c2=T2.closed[0];assert.strictEqual(c2.exit,120);near3(c2.fees,1+1.2);near3(c2.pnl,120-100-2.2);
  ok('selling 3 coins against a 1-coin trip: exit 120, fees 1 + 3.6×1/3 = 2.20, P&L 120 − 100 − 2.20 = 17.80 (not 237.80)');
  // FIFO tax lots: partial lots, fees, missing basis, holding period.
  const A=load('edge-lab/edge-lab-v7.html','https://example.org/',async()=>res(404,{})).fableAuto;
  const rows=A.fifoRows([
    {product:'BTC-USD',side:'BUY',time:'2024-01-10T00:00:00Z',price:40000,qty:0.02,fee:8},
    {product:'BTC-USDC',side:'BUY',time:'2026-02-01T00:00:00Z',price:50000,qty:0.01,fee:6},
    {product:'BTC-USD',side:'SELL',time:'2026-03-01T00:00:00Z',price:60000,qty:0.025,fee:18},
    {product:'ETH-USD',side:'SELL',time:'2026-04-01T00:00:00Z',price:3000,qty:0.5,fee:15}],2026);
  assert.strictEqual(rows.length,3);
  // Lot 1: 0.02 BTC, basis 0.02×40,000+8 = 808; proceeds 0.02/0.025×(1,500−18)=1,185.60; held >1 year.
  near3(rows[0].basis,808);near3(rows[0].proceeds,1185.6);assert.strictEqual(rows[0].term,'Long-term');
  // Lot 2 (USDC book, same coin): 0.005 of 0.01 BTC, basis 0.5×506 = 253; proceeds 0.005/0.025×1,482 = 296.40.
  near3(rows[1].basis,253);near3(rows[1].proceeds,296.4);assert.strictEqual(rows[1].term,'Short-term');
  assert.strictEqual(rows[2].basis,null);assert.strictEqual(rows[2].term,'Unknown');near3(rows[2].proceeds,1485);
  ok('tax FIFO: 808.00 / 1,185.60 long-term, 253.00 / 296.40 short-term, ETH sale without purchase flagged for basis');
  const nye=new Date(2025,11,31,23,30).toISOString(),buy={product:'SOL-USD',side:'BUY',time:new Date(2025,5,1).toISOString(),price:100,qty:1,fee:0},sell={product:'SOL-USD',side:'SELL',time:nye,price:110,qty:1,fee:0};
  assert.strictEqual(A.fifoRows([buy,sell],2025).length,1);assert.strictEqual(A.fifoRows([buy,sell],2026).length,0);
  ok('a sale at 11:30 pm on Dec 31 (local) is in that tax year, whatever the UTC date');
  // Old manual trades are dated by "Closed on", so logging last week's losses today does not lock sizing.
  const W2=load('edge-lab/edge-lab-v7.html','https://example.org/',async()=>res(404,{}));await sleep(300);const $2=id=>W2.document.getElementById(id);
  const old=new Date(Date.now()-3*86400e3),ds=old.getFullYear()+'-'+String(old.getMonth()+1).padStart(2,'0')+'-'+String(old.getDate()).padStart(2,'0');
  for(const k of [1,2]){$2('jSym').value='SOL-USD';$2('jExp').value='150';$2('jAct').value='150';$2('jExit').value='140';$2('jSize').value='100';$2('jFee').value='2';$2('jClosed').value=ds;$2('addTrade').click();await sleep(200);
    assert.strictEqual($2('jClosed').value,W2.fableAuto.today(),'Closed on resets to today after each entry')}
  assert.strictEqual(W2.eval('TRADES').length,2);assert(W2.eval('TRADES').every(x=>x.closedAt.startsWith(ds)||Date.parse(x.closedAt)<Date.now()-2*86400e3));assert.strictEqual(W2.fableAuto.coolingOff(),null);
  ok('two losses logged today but closed 3 days ago do not trigger cooling-off');W2.close();
  // Cooling-off edges: losses 23h apart lock; one loss or a win does not.
  const W=load('edge-lab/edge-lab-v7.html','https://example.org/',async()=>res(404,{}));await sleep(200);const now=Date.now(),iso=h=>new Date(now-h*3600e3).toISOString();
  W.eval('TRADES').push({pnl:-5,closedAt:iso(23)},{pnl:8,closedAt:iso(1)});assert.strictEqual(W.fableAuto.coolingOff(now),null);
  W.eval('TRADES').push({pnl:-3,closedAt:iso(0.5)});const c=W.fableAuto.coolingOff(now);assert(c);assert.strictEqual(Date.parse(c.until),now-23*3600e3+86400e3);
  ok('cooling-off: 1 loss does not lock; a win does not reset; 2 losses in 24h lock until the older one is 24h old');W.close();
  console.log('AUTOFILL TESTS PASSED ('+n+')');process.exit(0);
})().catch(e=>{console.error('AUTO FAIL',e);process.exit(1)});
