// Randomised property tests of every money calculation, against independent reference implementations.
// Seeded, so failures reproduce. 2,000 cases per property.
const {JSDOM}=require('../node_modules/jsdom');const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.join(__dirname,'..','..');
let seed=+(process.env.PROP_SEED||20260924);const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const pick=a=>a[Math.floor(rnd()*a.length)],uni=(a,b)=>a+(b-a)*rnd(),near=(a,b,tol,m)=>{if(!(Math.abs(a-b)<=tol))throw Error(m+': '+a+' vs '+b)};
const w=new JSDOM(fs.readFileSync(path.join(ROOT,'edge-lab/edge-lab-v7.html'),'utf8'),{url:'https://example.org/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};}}).window;
const A=w.fableAuto,N=2000;let n=0;const ok=m=>{n++;console.log('PROP '+m)};

// 1. Round trips conserve cash: when each trip sells exactly what it bought, Σ trip P&L = cash in − cash out.
for(let k=0;k<N;k++){
  const fills=[];let cash=0,t=0,id=0;const trips=1+Math.floor(rnd()*4);
  for(let j=0;j<trips;j++){
    let held=0;const buys=1+Math.floor(rnd()*3);
    for(let b=0;b<buys;b++){const q=uni(0.001,2),p=uni(10,70000),f=q*p*pick([0,0.006,0.012]);held+=q;cash-=q*p+f;const oid='b'+(id++);const parts=1+Math.floor(rnd()*3);for(let x=0;x<parts;x++)fills.push({orderId:oid,side:'BUY',time:String(t++),price:p,qty:q/parts,fee:f/parts})}
    const sells=1+Math.floor(rnd()*3);let left=held;
    for(let s=0;s<sells;s++){const q=s===sells-1?left:left*uni(0.1,0.6);left-=q;const p=uni(10,70000),f=q*p*pick([0,0.006,0.012]);cash+=q*p-f;fills.push({orderId:'s'+(id++),side:'SELL',time:String(t++),price:p,qty:q,fee:f})}
  }
  const r=A.buildTrips(fills);assert.strictEqual(r.closed.length,trips,'trip count');assert.strictEqual(r.open,null);
  near(r.closed.reduce((a,x)=>a+x.pnl,0),cash,1e-6*Math.max(1,Math.abs(cash)),'cash conservation #'+k);
  for(const x of r.closed){assert(x.fees>=0);assert(x.entry>0&&x.exit>0)}
}
ok(`round trips: ${N} random multi-fill sequences, Σ trip P&L = cash change every time`);

// 2. FIFO tax lots against a unit-by-unit reference; proceeds and basis reconcile to cash.
for(let k=0;k<N;k++){
  const fills=[],units=[];let clock=Date.UTC(2025,0,1),held=0;const refRows=[];const year=2026;
  const steps=2+Math.floor(rnd()*8);
  for(let s=0;s<steps;s++){
    clock+=86400e3*uni(1,120);const time=new Date(clock).toISOString();   // strictly increasing, spans holding periods either side of a year
    if(held<1e-9||rnd()<0.5){const q=Math.round(uni(1,50))/10,p=uni(50,200),f=q*p*0.01;fills.push({product:'SOL-USD',side:'BUY',time,price:p,qty:q,fee:f});units.push({q,cost:(q*p+f)/q,time});held+=q}
    else{const q=Math.min(held,Math.round(uni(1,50))/10),p=uni(50,200),f=q*p*0.01;fills.push({product:'SOL-USD',side:'SELL',time,price:p,qty:q,fee:f});held-=q;
      let left=q;while(left>1e-9){const u=units[0],take=Math.min(left,u.q);refRows.push({qty:take,basis:take*u.cost,proceeds:take*(q*p-f)/q,sold:time});u.q-=take;left-=take;if(u.q<=1e-9)units.shift()}}
  }
  fills.sort((a,b)=>a.time.localeCompare(b.time));
  const ref=refRows.filter(r=>new Date(r.sold).getFullYear()===year);
  const got=A.fifoRows(fills,year);assert.strictEqual(got.length,ref.length,'row count #'+k);
  near(got.reduce((a,x)=>a+x.gain,0),ref.reduce((a,x)=>a+x.proceeds-x.basis,0),1e-7,'FIFO gain #'+k);
  near(got.reduce((a,x)=>a+x.qty,0),ref.reduce((a,x)=>a+x.qty,0),1e-9,'FIFO qty #'+k);
  assert(got.every(x=>x.basis!==null));
}
ok(`tax FIFO: ${N} random buy/sell histories match a unit-by-unit reference (rows, quantity, gain)`);

// 3. Trade ticket never exceeds budget, cash or position cap, and respects Coinbase increments.
for(let k=0;k<N;k++){
  const entry=uni(0.05,90000),stop=entry*uni(0.5,0.995),bInc=pick([1e-8,1e-6,0.001,0.1,1]),qInc=pick([0.01,0.001,0.0001,1e-6]);
  const c={entry,stop,entryFee:pick([0,0.004,0.006,0.012]),exitFee:pick([0,0.006,0.012]),entrySlip:uni(0,0.003),exitSlip:uni(0,0.003),cash:uni(0,6000),equity:uni(3000,7000),maxPosition:0.25};
  const plan={inputs:c,result:{riskBudget:uni(0,40),halt:rnd()<0.05}},gap=uni(0,2);
  const T=A.ticketMath(plan,{baseInc:bInc,quoteInc:qInc,minBase:0,minQuote:0},'market',gap,null);
  assert(T.qty>=0);if(plan.result.halt)assert.strictEqual(T.qty,0);
  near(Math.round(T.qty/bInc)*bInc,T.qty,bInc*1e-6,'base increment');
  assert(T.riskAtLimit<=T.budget+1e-9,'risk above budget #'+k);assert(T.cost<=c.cash+1e-9,'cost above cash #'+k);assert(T.cost<=c.equity*0.25+1e-9,'above position cap #'+k);
  assert(T.stop>=c.stop-1e-12&&T.stop-c.stop<qInc+1e-12,'stop rounded up one tick at most');assert(T.limit<=T.stop+1e-12,'limit above stop');
  near(Math.round(T.limit/qInc)*qInc,T.limit,qInc*1e-6,'limit tick');
  if(T.qty>0){const one=T.qty+bInc,lpu=T.entryPx*(1+T.feeIn)-T.limit*(1-c.exitFee);assert(one*lpu>T.budget-1e-9||one*T.entryPx*(1+T.feeIn)>Math.min(c.cash,c.equity*0.25)-1e-9,'one more step would still fit: not maximal #'+k)}
}
ok(`trade ticket: ${N} random markets/increments — never above risk budget, cash or 25% cap; on Coinbase ticks; maximal`);

// 4. Cooling-off against a brute-force reference.
for(let k=0;k<N;k++){
  const now=Date.UTC(2026,8,24,12);const T=w.eval('TRADES');T.length=0;
  const m=Math.floor(rnd()*6);for(let j=0;j<m;j++)T.push({pnl:rnd()<0.6?-uni(1,50):uni(0,50),closedAt:new Date(now-uni(-2,60)*3600e3).toISOString().replace('Z',rnd()<0.3?'':'Z').replace(/(\.\d{3})?$/,m=>m)});
  const losses=T.filter(t=>t.pnl<0).map(t=>Date.parse(t.closedAt.endsWith('Z')?t.closedAt:t.closedAt+'Z')).filter(x=>x<=now&&now-x<86400e3).sort((a,b)=>b-a);
  const got=A.coolingOff(now);
  if(losses.length>=2){assert(got,'should lock #'+k);assert.strictEqual(Date.parse(got.until),losses[1]+86400e3)}else assert.strictEqual(got,null,'should not lock #'+k);
}
w.eval('TRADES').length=0;
ok(`cooling-off: ${N} random journals match a brute-force reference (lock and unlock time)`);

// 5. Planner rules against an independent re-derivation (stages, caps, per-trade and portfolio limits).
function expectPlan(q){
  const loss=5000-q.equity,floor=Math.max(4000,q.peak-1000),stage=q.equity<=floor?'HALT':loss>=750?'NO_NEW_RISK':loss>=500?'REVIEW':'WITHIN_LIMITS';
  const rf=Math.min(q.risk,0.005*(stage==='REVIEW'?0.5:1)),pr=Math.min(q.port,0.01),mp=Math.min(q.maxPos,0.25),usable=(stage==='HALT'||stage==='NO_NEW_RISK')?0:q.cash;
  const cpu=q.entry*(1+q.slipE)*(1+q.feeE),lpu=cpu-q.stop*(1-q.slipX)*(1-q.feeX),head=Math.max(0,q.equity*pr-q.open),budget=Math.min(q.equity*rf,head);
  return {stage,qty:q.equity<=q.peak*(1-q.dd)?0:Math.max(0,Math.min(budget/lpu,usable/cpu,q.equity*mp/cpu))};
}
const $=id=>w.document.getElementById(id);w.document.querySelector('nav button[data-p="control"]').click();
for(let k=0;k<400;k++){
  const equity=uni(3900,7000),peak=equity+uni(0,1500),entry=uni(1,90000),q={equity,peak,cash:uni(0,equity),open:uni(0,80),risk:pick([0.5,1,2])/100,port:pick([1,2])/100,maxPos:pick([10,25,50])/100,dd:pick([10,20])/100,
    entry,stop:entry*uni(0.7,0.99),feeE:pick([0,0.6,1.2])/100,feeX:pick([0,0.6,1.2])/100,slipE:uni(0,20)/1e4,slipX:uni(0,20)/1e4};
  const set=(id,v)=>{$(id).value=String(v)};
  set('rEquity',q.equity);set('rPeak',q.peak);set('rCash',q.cash);set('rOpen',q.open);set('rRisk',q.risk*100);set('rPortfolio',q.port*100);set('rMax',q.maxPos*100);set('rDD',q.dd*100);set('rGap',3);
  set('rEntry',q.entry);set('rStop',q.stop);set('rEF',q.feeE*100);set('rXF',q.feeX*100);set('rES',q.slipE*1e4);set('rXS',q.slipX*1e4);$('planRisk').click();
  const R=w.eval('LAST_RISK'),e=expectPlan(q);assert(R,'no plan #'+k);assert.strictEqual(R.experiment.stage,e.stage,'stage #'+k);near(R.result.qty,e.qty,1e-9*Math.max(1,e.qty),'qty #'+k);
}
ok('planner: 400 random inputs through the real form — stage and size match an independent re-derivation');
console.log('PROPERTY TESTS PASSED ('+n+')');process.exit(0);
