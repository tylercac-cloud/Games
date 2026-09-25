// A user's first weeks, through the real launcher and pages, against a stateful Coinbase simulator.
const {JSDOM,VirtualConsole}=require('../node_modules/jsdom');const assert=require('assert');
const [port,SIM]=process.argv.slice(2),BASE='http://127.0.0.1:'+port,sleep=ms=>new Promise(r=>setTimeout(r,ms));
let n=0;const ok=m=>{n++;console.log('SIM '+m)},ERR=[];
const near=(a,b,tol,msg)=>assert(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}`);
const sim=async(op,body={})=>{if(op==='price')setTimeout(()=>{},0);const r=await fetch(SIM+'/__sim/'+op,{method:'POST',body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error);return j};
// Independent re-derivation of the protocol's planning rules (not the page's code).
function expectPlan({equity,peak,cash,open,entry,stop,fee,slipBps}){
  const loss=5000-equity,floor=Math.max(4000,peak-1000);
  const stage=equity<=floor?'HALT':loss>=750?'NO_NEW_RISK':loss>=500?'REVIEW':'WITHIN_LIMITS';
  const riskFrac=0.005*(stage==='REVIEW'?0.5:1),usable=(stage==='HALT'||stage==='NO_NEW_RISK')?0:cash;
  const s=slipBps/1e4,cpu=entry*(1+s)*(1+fee),lpu=cpu-stop*(1-s)*(1-fee);
  const headroom=Math.max(0,equity*0.01-open),budget=Math.min(equity*riskFrac,headroom);
  const qty=equity<=peak*0.8?0:Math.max(0,Math.min(budget/lpu,usable/cpu,equity*0.25/cpu));
  return {stage,budget,headroom,qty,debit:qty*cpu,stopLoss:qty*lpu,floor};
}
(async()=>{
  const html=await (await fetch(BASE+'/edge-lab/edge-lab-v7.html')).text();
  const vc=new VirtualConsole();vc.on('jsdomError',e=>ERR.push(String(e.message||e)));
  const w=new JSDOM(html,{url:BASE+'/edge-lab/edge-lab-v7.html',virtualConsole:vc,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=m=>{throw Error('alert: '+m)};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
    w.fetch=async(u,o)=>{const r=await fetch(new URL(String(u),BASE),{headers:(o&&o.headers)||{}});const t=await r.text();return {ok:r.ok,status:r.status,json:async()=>JSON.parse(t)}}}}).window;
  const $=id=>w.document.getElementById(id),v=id=>+$(id).value,tab=p=>w.document.querySelector('nav button[data-p="'+p+'"]').click();
  async function refresh(){const before=w.eval('LAST_RISK');$('autoFill').click();for(let i=0;i<60;i++){await sleep(100);if(!/Reading live data/.test($('autoStatus').textContent)&&!$('autoFill').disabled)break}await sleep(150);return w.eval('LAST_RISK')}
  function checkPlan(label,inputs){
    const R=w.eval('LAST_RISK'),e=expectPlan(inputs);
    assert.strictEqual(R.experiment.stage,e.stage,label+' stage');near(R.result.riskBudget,e.budget,1e-9,label+' risk budget');near(R.result.qty,e.qty,1e-12,label+' qty');
    assert(R.result.stopLoss<=inputs.equity*(e.stage==='REVIEW'?0.0025:0.005)+1e-9,label+': stop loss above per-trade limit');
    assert(inputs.open+R.result.stopLoss<=inputs.equity*0.01+1e-9||R.result.qty===0,label+': portfolio open risk above 1%');
    return {R,e};
  }
  await sleep(1500);
  // ---------------- Day 1 morning: scan, then plan the first BTC trade from a flat $5,000 account ----------------
  $('scanMarkets').click();for(let i=0;i<80&&!/complete|FAILED/i.test($('scanStatus').textContent);i++)await sleep(250);
  assert(!/FAILED/.test($('scanStatus').textContent),$('scanStatus').textContent);ok('daily scan completes');
  tab('control');await sleep(300);await refresh();await sleep(600);
  assert(!/Coinbase shows/.test($('acctOut').textContent),'day-one funding must not be offered as a deposit: '+$('acctOut').textContent);
  assert.strictEqual(v('rEquity'),5000);assert.strictEqual(v('rPeak'),5000);assert.strictEqual(v('rCash'),5000);assert.strictEqual(v('rOpen'),0);
  assert.strictEqual(v('rEntry'),60000.5);assert.strictEqual(v('rStop'),55200);assert.strictEqual(v('rEF'),1.2);assert.strictEqual(v('rES'),1);
  let {R,e}=checkPlan('plan 1',{equity:5000,peak:5000,cash:5000,open:0,entry:60000.5,stop:55200,fee:0.012,slipBps:1});
  await sleep(400);let tk=w.fableAuto.ticketMath(w.eval('LAST_RISK'),{baseInc:1e-8,quoteInc:0.01,minBase:1e-8,minQuote:1},'market',0.2,0.006);
  assert.match($('ticketOut').textContent,/Trade ticket · BTC-USD/);assert($('ticketOut').textContent.includes(tk.qty.toFixed(8)),'ticket shows '+tk.qty.toFixed(8));
  assert.strictEqual(tk.stop,55200);near(tk.limit,55089.60,1e-9,'stop-limit = floor(55,200×0.998, 0.01)');assert(tk.riskAtLimit<=tk.budget+1e-9,'ticket risk within budget');assert(tk.qty<=R.result.qty);
  const tkL=w.fableAuto.ticketMath(w.eval('LAST_RISK'),{baseInc:1e-8,quoteInc:0.01,minBase:1e-8,minQuote:1},'limit',0.2,0.006);assert.strictEqual(tkL.entryPx,60000);assert(tkL.qty>tk.qty,'maker fee allows a larger size');
  ok(`ticket: buy ${tk.qty.toFixed(8)} BTC, stop 55,200.00, limit 55,089.60; loss at limit $${tk.riskAtLimit.toFixed(2)} ≤ $${tk.budget.toFixed(2)}; limit entry at maker fee allows ${tkL.qty.toFixed(8)} (+${((tkL.qty/tk.qty-1)*100).toFixed(1)}%)`);
  ok(`plan 1: ${e.stage}, risk budget $${e.budget.toFixed(2)}, qty ${R.result.qty.toFixed(8)} BTC, cost $${R.result.debit.toFixed(2)}, modeled stop loss $${R.result.stopLoss.toFixed(2)} — matches independent math`);
  // ---------------- User trades in Coinbase: market buy (rounded down to 8 dp) + stop-limit ----------------
  const q1=+tk.qty.toFixed(8);let st=await sim('buy',{product:'BTC-USD',qty:q1});await sim('stop',{product:'BTC-USD',qty:q1,stop:tk.stop,limit:tk.limit});
  await refresh();
  const eq1=st.equity,open1=q1*((60000.5-tk.limit)+tk.limit*0.012);
  near(v('rEquity'),eq1,0.005,'equity after buy');near(v('rCash'),st.usd,0.005,'cash after buy');near(v('rOpen'),open1,0.005,'open risk after buy');assert.strictEqual(v('rPeak'),5000);
  ok(`after buying ${q1} BTC at $60,001 + 1.2% fee: equity $${eq1.toFixed(2)}, cash $${st.usd.toFixed(2)}, open risk $${open1.toFixed(2)} (${q1}×(60,000.50−55,089.60 + 55,089.60×1.2%)) all match Coinbase; open risk ≤ ticket's stated loss $${tk.riskAtLimit.toFixed(2)} because entry fee and spread are already sunk`);
  assert(open1<=tk.riskAtLimit+1e-9);
  ({R,e}=checkPlan('plan 2',{equity:+v('rEquity'),peak:5000,cash:+v('rCash'),open:+v('rOpen'),entry:60000.5,stop:55200,fee:0.012,slipBps:1}));
  ok(`plan 2 respects the 1% portfolio cap: headroom $${e.headroom.toFixed(2)}, budget $${e.budget.toFixed(2)}, open ${(+v('rOpen')).toFixed(2)} + new ${R.result.stopLoss.toFixed(2)} ≤ $${(v('rEquity')*0.01).toFixed(2)}`);
  // ---------------- Day 2: BTC rallies; user sells everything and cancels the stop ----------------
  await sim('price',{product:'BTC-USD',bid:62999,ask:63000});await sleep(1200);st=await sim('sell',{product:'BTC-USD',qty:q1});await sim('cancel',{product:'BTC-USD'});
  await refresh();near(v('rEquity'),st.equity,0.005,'equity after sell');assert.strictEqual(v('rOpen'),0);near(v('rPeak'),Math.max(5000,st.equity),0.005,'peak after win');
  const realized=st.equity-5000;ok(`after selling at $62,999: equity $${st.equity.toFixed(2)} (realized ${realized>=0?'+':''}$${realized.toFixed(2)}), open risk $0, high-water mark $${(+v('rPeak')).toFixed(2)}`);
  const peak=+v('rPeak');
  // ---------------- Journal: import the round trip; P&L must equal the account change ----------------
  tab('jrn');for(let i=0;i<40&&!/to log/.test($('fillsOut').textContent);i++)await sleep(100);
  assert.match($('fillsOut').textContent,/1 trade to log/);const btn=w.document.querySelector('#fillsOut button[data-follow="Yes"]');assert(btn,$('fillsOut').textContent);btn.click();await sleep(400);
  const T=w.eval('TRADES').at(-1);near(T.act,60001,1e-6,'entry VWAP');near(T.exit,62999,1e-6,'exit VWAP');near(T.size,q1*60001,0.005,'size');near(T.fee,q1*60001*0.012+q1*62999*0.012,0.005,'fees');assert.strictEqual(T.exp,60000.5);
  assert.strictEqual(T.follow,'Yes');assert(Number.isFinite(T.fee)&&T.fee>0,'fee stored');assert(Date.parse(T.closedAt)<=Date.now());
  near(T.pnl,realized,0.01,'journal P&L vs Coinbase equity change');near(T.slip,(60001-60000.5)/60000.5*100,1e-9,'slippage %');
  assert.match($('fillsOut').textContent,/All Coinbase round trips/);ok(`one tap logged it: journal P&L $${T.pnl.toFixed(2)} = Coinbase equity change $${realized.toFixed(2)} (within 1¢); slippage vs plan ${T.slip.toFixed(5)}%`);
  const rv=$('jReview').textContent;assert.match(rv,/Fees paid/);assert(rv.includes('$'+T.fee.toFixed(2)),'review fees');assert(rv.includes('$'+(T.pnl+T.fee).toFixed(2)),'gross = net + fees');
  ok(`review: gross $${(T.pnl+T.fee).toFixed(2)} − fees $${T.fee.toFixed(2)} = net $${T.pnl.toFixed(2)}; fees ${(T.fee/(T.pnl+T.fee)*100).toFixed(1)}% of gross profit; 1 trade under "followed the plan"`);
  for(const k of [1,2]){$('jSym').value='SOL-USD';$('jExp').value='150';$('jAct').value='150';$('jExit').value='140';$('jSize').value='100';$('jFee').value='2';$('jFollow').value='No';$('addTrade').click();await sleep(250)}
  tab('control');await sleep(200);await refresh();let RR=w.eval('LAST_RISK');assert(RR.cooling,'cooling-off active');assert.strictEqual(RR.result.qty,0);
  assert.match($('ticketOut').textContent,/Cooling-off until/);const tr=w.eval('TRADES'),second=Date.parse(tr.at(-2).closedAt);near(Date.parse(RR.cooling.until),second+86400e3,1,'unlock = second loss + 24h');
  ok('two losses within 24h: cooling-off, size $0, unlocks '+RR.cooling.until);
  w.eval("TRADES.slice(-2).forEach(t=>t.closedAt=new Date(Date.now()-25*3600e3).toISOString())");await refresh();RR=w.eval('LAST_RISK');assert(!RR.cooling&&RR.result.qty>0);ok('25 hours later the lock lifts by itself');
  tab('siz');await sleep(100);assert.strictEqual(v('kN'),3);assert.strictEqual(v('kW'),realized>0?1:0);near(v('kC'),st.equity,0.005,'Kelly capital');ok('Sizing picked up 3 trades, '+(realized>0?1:0)+' win, capital from equity');
  tab('control');await sleep(200);
  // ---------------- Bad weeks: drawdown stages ----------------
  await sim('usd',{usd:4480});await refresh();checkPlan('REVIEW',{equity:4480,peak,cash:4480,open:0,entry:62999.5,stop:55200,fee:0.012,slipBps:1});
  ok('equity $4,480 (loss $520): REVIEW stage, per-trade risk halved to $'+(4480*0.0025).toFixed(2));
  await sim('usd',{usd:4240});await refresh();({R}=checkPlan('NO_NEW_RISK',{equity:4240,peak,cash:4240,open:0,entry:62999.5,stop:55200,fee:0.012,slipBps:1}));
  assert.strictEqual(R.result.qty,0);ok('equity $4,240 (loss $760): NO NEW RISK, position size $0');
  const floor=Math.max(4000,peak-1000);await sim('usd',{usd:floor-1});await refresh();({R}=checkPlan('HALT',{equity:floor-1,peak,cash:floor-1,open:0,entry:62999.5,stop:55200,fee:0.012,slipBps:1}));
  assert.strictEqual(R.result.qty,0);ok(`equity $${(floor-1).toFixed(2)} ≤ hard floor max($4,000, $${peak.toFixed(2)}−$1,000) = $${floor.toFixed(2)}: HALT, size $0`);
  // ---------------- Recovery, then a $1,000 deposit to Main ----------------
  await sim('usd',{usd:peak});await refresh();assert.strictEqual(w.eval('LAST_RISK').experiment.stage,'WITHIN_LIMITS');
  await sim('deposit',{amount:1000});await refresh();near(v('rEquity'),peak+1000,0.005,'pre-netting equity');
  for(let i=0;i<30&&!/Coinbase shows/.test($('acctOut').textContent);i++)await sleep(100);
  assert.match($('acctOut').textContent,/Coinbase shows \$1,000\.00 net deposits/);ok('the $1,000 deposit is flagged automatically (equity jumped 20% between reads)');
  $('acctDetect').click();for(let i=0;i<40&&!/Net since/.test($('acctTransfers').textContent);i++)await sleep(100);
  assert.match($('acctTransfers').textContent,/1 transfer before Fable first read your account/);assert.match($('acctTransfers').textContent,/Net since .*: \$1,000\.00/);
  assert.match($('acctTransfers').textContent,/fiat deposit/);assert.match($('acctTransfers').textContent,/Not counted: 1 pro deposit/);assert.match($('acctTransfers').textContent,/\$1,000\.00/);
  $('acctUseDetected').click();await sleep(300);assert.strictEqual($('acctDeposits').value,'1000');ok('deposit detected ($1,000); the $5,000 day-one funding is recognised as the starting balance; $5 pro transfer not counted; applied with one click');
  near(v('rEquity'),peak,0.005,'netted equity');near(v('rPeak'),peak,0.005,'netted peak');near(v('rCash'),peak,0.005,'cash capped at experiment equity');
  assert(!/Check the input/i.test($('riskOut').textContent),$('riskOut').textContent);
  checkPlan('after deposit',{equity:+v('rEquity'),peak:+v('rPeak'),cash:+v('rCash'),open:0,entry:62999.5,stop:55200,fee:0.012,slipBps:1});
  ok(`$1,000 deposit netted: equity $${(peak+1000).toFixed(2)} − $1,000 = $${peak.toFixed(2)}, peak unchanged, cash capped, plan valid`);
  await refresh();near(v('rEquity'),peak,0.005,'equity stays netted on next refresh');near(v('rPeak'),peak,0.005,'peak stays netted on next refresh');ok('netting survives the next refresh');
  // ---------------- An ETH holding with no stop blocks new risk ----------------
  st=await sim('buy',{product:'ETH-USD',qty:0.1});await refresh();
  const ethVal=0.1*2500.5;near(v('rOpen'),ethVal,0.005,'unprotected ETH at full value');assert.strictEqual(w.eval('LAST_RISK.result.qty'),0);
  assert.match($('acctOut').textContent,/none/);ok(`unprotected ETH ($${ethVal.toFixed(2)}) counted in full: headroom $0, new size $0`);
  await sim('stop',{product:'ETH-USD',qty:0.1,stop:2400,limit:2390});await refresh();
  const ethRisk=0.1*((2500.5-2390)+2390*0.012);near(v('rOpen'),ethRisk,0.005,'ETH stop risk');
  ({R}=checkPlan('with ETH stop',{equity:+v('rEquity'),peak:+v('rPeak'),cash:+v('rCash'),open:ethRisk,entry:62999.5,stop:55200,fee:0.012,slipBps:1}));
  ok(`ETH stop placed: open risk $${ethRisk.toFixed(2)}, BTC plan allowed again (qty ${R.result.qty.toFixed(8)})`);
  // Stops in action: ETH falls to 2,395, between its 2,400 stop and 2,390 limit, so the stop-limit fills.
  st=await sim('price',{product:'ETH-USD',bid:2395,ask:2396});await sleep(1200);assert(!st.hold.ETH,'ETH stop should have filled');await refresh();
  near(v('rOpen'),0,0.005,'no open risk after the stop filled');ok('ETH stop-limit filled at $2,395 (between stop $2,400 and limit $2,390): position gone, open risk $0');
  // Gap-through: new ETH position, stop 2,300 / limit 2,290; price gaps to 2,200, below the limit, so nothing fills.
  st=await sim('buy',{product:'ETH-USD',qty:0.1});await sim('stop',{product:'ETH-USD',qty:0.1,stop:2300,limit:2290});
  st=await sim('price',{product:'ETH-USD',bid:2200,ask:2201});await sleep(1200);assert(Math.abs(st.hold.ETH-0.1)<1e-12,'gap must leave the stop unfilled');await refresh();
  near(v('rOpen'),0.1*2200.5,0.005,'gapped stop protects nothing');assert.strictEqual(w.eval('LAST_RISK.result.qty'),0);
  ok('price gapped to $2,200 through the $2,290 limit: stop unfilled, whole ETH position ($220.05) counted as open risk, new size $0');
  st=await sim('price',{product:'ETH-USD',bid:2295,ask:2296});await sleep(1200);assert(!st.hold.ETH,'recovery into the stop band fills the order');await refresh();near(v('rOpen'),0,0.005,'open risk after fill');
  tab('jrn');for(let i=0;i<40&&!/to log/.test($('fillsOut').textContent);i++)await sleep(100);assert.match($('fillsOut').textContent,/2 trades to log/);
  while(w.document.querySelector('#fillsOut button[data-trip]')){const n0=w.eval('TRADES.length');w.document.querySelector('#fillsOut button[data-trip]').click();for(let i=0;i<40&&w.eval('TRADES.length')===n0;i++)await sleep(100);await sleep(300)}
  const eth=w.eval('TRADES').filter(x=>x.sym==='ETH-USD');assert.strictEqual(eth.length,2);const ex=eth.map(x=>x.exit).sort((a,b)=>a-b);near(ex[0],2295,1e-6,'gap-recovery exit');near(ex[1],2395,1e-6,'stop exit');
  ok('price recovered to $2,295: stop-limit filled; both ETH round trips logged with exits $2,395 and $2,295');tab('control');await sleep(200);
  const elog=JSON.parse(w.localStorage.getItem('fable-desk:equity-log'));assert.strictEqual(elog.length,1);near(elog[0].equity,+v('rEquity'),0.005,'log equity');assert.match($('equityLogOut').innerHTML,/<svg/);
  w.eval("saveFile=async(n,t,m)=>{(window.__saved=window.__saved||[]).push({n,t});return true}");await w.eval('exportState()');const backup=w.eval('window.__saved.at(-1).t');
  const B=JSON.parse(backup);assert.strictEqual(B.desk.equityLog.length,1);near(B.desk.hwm.value,peak,0.005,'backup HWM');
  w.localStorage.removeItem('fable-desk:equity-log');w.localStorage.removeItem('fable-desk:hwm');await w.eval('importState')(backup);await sleep(200);
  assert.strictEqual(JSON.parse(w.localStorage.getItem('fable-desk:equity-log')).length,1);near(JSON.parse(w.localStorage.getItem('fable-desk:hwm')).value,peak,0.005,'restored HWM');
  ok('equity log (1 entry/day, chart) and high-water mark survive export → wipe → import');
  tab('jrn');await sleep(100);$('taxYear').value=String(new Date().getUTCFullYear());$('taxCsv').click();for(let i=0;i<40&&!/sale line/.test($('taxOut').textContent);i++)await sleep(100);
  const csv=w.eval('window.__saved.at(-1)');assert.match(csv.n,/form8949/,$('taxOut').textContent);const lines=csv.t.split('\n');const btcLine=lines.find(l=>/ BTC,/.test(l));assert.strictEqual(lines.length,4,csv.t);assert(btcLine,'BTC sale line');const cols=btcLine.split(',');
  near(+cols[5],realized,0.01,'tax gain = realized');assert.strictEqual(cols[6],'Short-term');assert.match(cols[0],/BTC/);
  ok(`tax CSV: 1 sale line, ${cols[0]}, proceeds $${cols[3]}, basis $${cols[4]}, gain $${cols[5]} = account change; plus both ETH round trips (stop fill and gap recovery) as separate lines`);
  assert.strictEqual(ERR.length,0,'uncaught page errors: '+ERR.join(' | '));ok('no uncaught page errors during the whole session');
  console.log('SIM STEPS PASSED ('+n+')');process.exit(0);
})().catch(e=>{console.error('SIM FAIL',e);process.exit(1)});
