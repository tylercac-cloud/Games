/* ============ normal distribution ============ */
function normCdf(x){ // Abramowitz-Stegun 7.1.26 via erf
  const s=x<0?-1:1, z=Math.abs(x)/Math.SQRT2;
  const t=1/(1+0.3275911*z);
  const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-z*z);
  return 0.5*(1+s*y);
}
function normInv(p){ // Acklam
  if(p<=0)return -Infinity; if(p>=1)return Infinity;
  const a=[-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239],
        b=[-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1],
        c=[-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],
        d=[7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
  const pl=0.02425,ph=1-pl; let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>ph){q=Math.sqrt(-2*Math.log(1-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-0.5;r=q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
const EMC=0.5772156649;
/* expected max Sharpe from N zero-skill trials (Bailey & Lopez de Prado 2014, Eq.1) */
function expMaxSR(varSR,N){
  if(N<2)N=2;
  return Math.sqrt(varSR)*((1-EMC)*normInv(1-1/N)+EMC*normInv(1-1/(N*Math.E)));
}
/* Probabilistic Sharpe Ratio */
function psr(sr,sr0,T,skew,kurt){
  if(T<2)return 0;
  const v=1-skew*sr+(kurt-1)/4*sr*sr;
  if(!(v>1e-6))return NaN;   // degenerate moments: refuse rather than clamp to a huge z
  const den=Math.sqrt(v);
  return normCdf((sr-sr0)*Math.sqrt(T-1)/den);
}
/* effective independent trials given avg correlation */
const effN=(M,rho)=>Math.max(1,rho+(1-rho)*M);
/* A sweep is ONE register entry but MANY configurations. The Deflated Sharpe
   must be deflated by configurations searched, not by entries logged. */
/* Synthetic practice runs don't count against a real dataset's budget. */
/* HTML-escape anything user-typed or imported before it reaches innerHTML.
   Register backups can be shared; an imported file must never run code. */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const num2=v=>{const x=Number(v);return isFinite(x)?x:null};
/* Imported entries are untrusted: coerce types, reject what can't be counted.
   A malformed trade used to crash the journal and abort the whole import. */
function cleanHyp(h){if(!h||typeof h!=='object')return null;const spent=Number(h.spent);if(!(spent>=1)||!isFinite(spent))return null;
  const o=Object.assign({},h);o.spent=Math.round(spent);o.why=String(h.why==null?'':h.why);o.st=String(h.st||'');
  o.p=(h.p&&typeof h.p==='object'&&!Array.isArray(h.p))?h.p:{};o.n=Number(h.n)||0;
  if(o.rho!=null)o.rho=Math.min(0.99,Math.max(0,Number(o.rho)||0));
  if(o.comps!=null&&!(Array.isArray(o.comps)&&o.comps.every(x=>typeof x==='string')))delete o.comps;
  if(o.data!=null)o.data=String(o.data);return o}
function cleanTrade(t){if(!t||typeof t!=='object')return null;const pnl=Number(t.pnl),slip=Number(t.slip);
  if(!isFinite(pnl)||!isFinite(slip))return null;const o=Object.assign({},t);o.pnl=pnl;o.slip=slip;
  if(o.ret!=null){const r=Number(o.ret);if(isFinite(r))o.ret=r;else delete o.ret}
  o.d=String(t.d||'');o.sym=String(t.sym||'');if(o.rule!=null)o.rule=String(o.rule);return o}
const isReal=h=>h.data!=='synthetic'&&!(h.comps||[]).some(t=>t==='synthetic');
const spentTotal=()=>HYP.filter(isReal).reduce((a,h)=>a+(h.spent||1),0);
/* Effective trials: each entry deflated by the correlation MEASURED across its
   own family (entries assumed independent of each other — conservative).
   v3 used one typed-in guess (0.7) for everything; measured values on BTC were
   0.20-0.25 for MA/RSI sweeps, so the guess cut the trial count by more than half. */
const tagOf=h=>h.data||'BTC-USD daily (bundled)';
/* Trials count against the dataset they were run on — selection bias comes
   from searching the same data. */
const effFor=tag=>HYP.filter(h=>isReal(h)&&tagOf(h)===tag).reduce((a,h)=>a+((h.spent||1)>1?effN(h.spent,h.rho!=null?h.rho:0):1),0);
/* Same coin, different source or candle size (bundled BTC, Coinbase-refreshed
   BTC-USD 86400s, BTC-USD 21600s…) is the SAME price history for selection-bias
   purposes: trials on one count against all of them. Before this, one click on
   "Refresh BTC + ETH + SOL" dropped ~22 effective BTC trials to zero. CSV tags
   carry no asset name and still count only against themselves (see HANDOFF). */
function assetKey(tag){tag=String(tag);if(tag==='BTC-USD daily (bundled)')return 'BTC-USD';
  const m=/^([A-Z0-9]+-[A-Z0-9]+) \d+s$/.exec(tag);return m?m[1]:tag}
const touches=h=>(h.comps&&h.comps.length?h.comps:[tagOf(h)]).map(assetKey);
/* Effective trials that bear on a set of datasets: every real entry that touched
   ANY of them. A pooled test therefore inherits all earlier searching on each
   member (pooling BTC does not launder BTC's search history). Conservative. */
const effForSet=tags=>{const K=tags.map(assetKey);return HYP.filter(h=>isReal(h)&&touches(h).some(t=>K.indexOf(t)>=0)).reduce((a,h)=>a+((h.spent||1)>1?effN(h.spent,h.rho!=null?h.rho:0):1),0)};
let ACTIVE_COMPS=null;   // set by the UI when the pool is active
const activeComps=()=>ACTIVE_COMPS&&ACTIVE_COMPS.length?ACTIVE_COMPS:[DATA_TAG||'BTC-USD daily (bundled)'];
const effTotal=()=>effForSet(activeComps());
function avgCorr(R){const N=R.length;if(N<2)return 0;
  const Z=R.map(a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;const d=a.map(x=>x-m);const s=Math.sqrt(d.reduce((x,y)=>x+y*y,0));return s>0?d.map(x=>x/s):null}).filter(Boolean);
  const K=Z.length;if(K<2)return 0;let tot=0,c=0;
  for(let i=0;i<K;i++)for(let j=i+1;j<K;j++){let r=0;for(let t=0;t<Z[i].length;t++)r+=Z[i][t]*Z[j][t];tot+=r;c++}
  return Math.min(0.99,Math.max(0,tot/c))}
let DATA_TAG=null;
/* max configs affordable given y years at target annualized Sharpe */
function budgetN(years,srTarget){
  const v=1/years; let lo=2,hi=1e9;
  for(let i=0;i<200;i++){const mid=Math.sqrt(lo*hi);
    if(expMaxSR(v,mid)<srTarget)lo=mid;else hi=mid;}
  return Math.floor(lo);
}

/* ============ series stats ============ */
function moments(a){
  const n=a.length; if(!n)return{m:0,s:0,sk:0,ku:3};
  const m=a.reduce((x,y)=>x+y,0)/n;
  let v=0,s3=0,s4=0;
  a.forEach(x=>{const d=x-m;v+=d*d;s3+=d*d*d;s4+=d*d*d*d});
  const sdPop=Math.sqrt(v/n);
  if(!(sdPop>1e-10)||n<2)return{m:m,s:0,sk:0,ku:3};  // degenerate: undefined Sharpe, not a huge one
  const sd=Math.sqrt(v/(n-1));   // sample SD: dividing by n inflates Sharpe (4.5% at n=12)
  return{m:m,s:sd,sk:s3/n/(sdPop**3),ku:s4/n/(sdPop**4)};
}
const sharpe=a=>{const M=moments(a);return M.s>0?M.m/M.s:0};

/* ============ indicators & signals ============ */
function sma(a,n){const o=Array(a.length).fill(null);let s=0;
  for(let i=0;i<a.length;i++){s+=a[i];if(i>=n)s-=a[i-n];if(i>=n-1)o[i]=s/n}return o}
function rsi(c,n){const o=Array(c.length).fill(null);let g=0,l=0;
  for(let i=1;i<c.length;i++){const d=c[i]-c[i-1],u=d>0?d:0,w=d<0?-d:0;
    if(i<=n){g+=u;l+=w;if(i===n){g/=n;l/=n;o[i]=l?100-100/(1+g/l):100}}
    else{g=(g*(n-1)+u)/n;l=(l*(n-1)+w)/n;o[i]=l?100-100/(1+g/l):100}}return o}
function signal(bars,st,p){
  const c=bars.map(b=>b.c),n=bars.length,s=Array(n).fill(0);
  if(st==='ma'){const f=sma(c,Math.round(p.fast)),w=sma(c,Math.round(p.slow));
    for(let i=0;i<n;i++)if(f[i]!=null&&w[i]!=null&&f[i]>w[i]*(1+p.thr/100))s[i]=1}
  else if(st==='rsi'){const r=rsi(c,Math.round(p.per));
    for(let i=0;i<n;i++)if(r[i]!=null&&r[i]<p.os)s[i]=1}
  else{// Donchian-style state: ON from a close above the prior L-bar high, OFF on a
    // close below the prior round(L/2)-bar low. (An event-only signal made
    // "signal off" exits hold every breakout for exactly one bar.)
    const L=Math.round(p.look),X=Math.max(1,Math.round(L/2));let on=0;
    for(let i=L;i<n;i++){let m=-Infinity,lo=Infinity;
      for(let j=i-L;j<i;j++)m=Math.max(m,bars[j].h);
      for(let j=i-X;j<i;j++)lo=Math.min(lo,bars[j].l);
      if(!on&&c[i]>m)on=1;else if(on&&c[i]<lo)on=0;s[i]=on}}
  return s;
}
/* One exit engine for both views, so PBO (per-bar) and DSR (per-trade) always
   see identical positions. Exit priority: stop (fills at the worse of open and
   stop), then target in fixed mode or signal-off in signal mode (at the close),
   then max hold. Signal-off exits let trend rules keep their right tail; in
   audit pass 4 simulation, fixed 10% targets erased a known trend edge
   entirely (DSR 0/40 passes) while signal-off exits caught it 14/40 times,
   with a 3.5% false-pass rate on pure noise. */
function runEngine(bars,sig,cfg){
  const bar=Array(bars.length-1).fill(0),inp=Array(bars.length-1).fill(0),tr=[],hb=[],ex=[];let pos=null;
  for(let i=1;i<bars.length;i++){
    if(!pos){if(sig[i]===1&&sig[i-1]===0)pos={e:bars[i].c,i:i};continue}
    inp[i-1]=1;
    const tg=pos.e*(1+cfg.tgt),sp=pos.e*(1-cfg.stp);let x=null;
    if(bars[i].l<=sp)x=Math.min(bars[i].o,sp);
    else if(cfg.mode!=='signal'&&bars[i].h>=tg)x=Math.max(bars[i].o,tg);
    else if(cfg.mode==='signal'&&sig[i]===0)x=bars[i].c;
    else if(i-pos.i>=cfg.hold)x=bars[i].c;
    if(x!==null){bar[i-1]=(x-bars[i-1].c)/bars[i-1].c-cfg.cost;tr.push((x-pos.e)/pos.e-cfg.cost);hb.push(i-pos.i);ex.push(i);pos=null}
    else bar[i-1]=(bars[i].c-bars[i-1].c)/bars[i-1].c;
  }
  return {bar:bar,tr:tr,hb:hb,inp:inp,ex:ex};
}
function barReturns(bars,st,p,cfg){return runEngine(bars,signal(bars,st,p),cfg).bar}
function trades(bars,st,p,cfg){return runEngine(bars,signal(bars,st,p),cfg).tr}
/* Timing skill, not drift. A long-only rule on an asset that rose 200x makes
   money by being long, whatever its timing. Each trade is judged against simply
   holding the asset for the same number of bars at its average per-bar return.
   Audit pass 4: with BTC-like drift and NO timing edge, raw per-trade returns
   passed the Deflated Sharpe 59% of the time; drift-adjusted, 0 of 120. */
const DRIFT=new WeakMap();
function drift(bars){if(DRIFT.has(bars))return DRIFT.get(bars);let m=0;
  for(let i=1;i<bars.length;i++)m+=bars[i].c/bars[i-1].c-1;m/=Math.max(1,bars.length-1);DRIFT.set(bars,m);return m}
/* Per-bar return stream in excess of holding: on every bar spent in a position,
   subtract the asset's average per-bar return. Flat bars are 0. This is the
   series every statistic (PBO, decay, Deflated Sharpe) now runs on. */
function barX(bars,st,p,cfg){const e=runEngine(bars,signal(bars,st,p),cfg),mu=drift(bars);
  return {x:e.bar.map((r,t)=>r-e.inp[t]*mu),n:e.tr.length,tr:e.tr,ex:e.ex}}
/* Bars per year from the data's own spacing (crypto trades 24/7). */
function barsPerYear(bars){const d=[];for(let i=1;i<Math.min(bars.length,500);i++)if(bars[i].t!=null&&bars[i-1].t!=null)d.push(bars[i].t-bars[i-1].t);
  if(!d.length)return 365.25;d.sort((a,b)=>a-b);const g=d[Math.floor(d.length/2)];return g>=60?31557600/g:365.25}
/* Power. Minimum annualized excess Sharpe detectable with ~80% power at the 0.95
   bar, given years of data and effective trials. The edge trial inflates the
   family dispersion it is judged against, so this is solved as a fixed point.
   Calibrated by simulation (T=3,400): N=1 -> 77%, N=5/13/45 -> 87-88% power. */
const ZPOW=1.6448536+0.8416212;
function mds80(years,N){const v0=1/years;if(!(N>=1.5))return Math.sqrt(v0)*ZPOW;
  const e=expMaxSR(1,N),Nn=Math.max(N,2);let s=1;
  for(let i=0;i<200;i++)s=Math.sqrt(v0+s*s*(Nn-1)/(Nn*Nn))*e+ZPOW*Math.sqrt(v0);return s}
function tradesX(bars,st,p,cfg){const e=runEngine(bars,signal(bars,st,p),cfg),mu=drift(bars);
  return e.tr.map((r,k)=>r-(Math.pow(1+mu,e.hb[k])-1))}

/* ============ PBO via CSCV ============ */
function combos(n,k){const out=[],cur=[];
  (function rec(s){if(cur.length===k){out.push(cur.slice());return}
    for(let i=s;i<n;i++){cur.push(i);rec(i+1);cur.pop()}})(0);
  return out;}
function cscvPBO(R,S){ // R: array of per-strategy return arrays (equal length)
  const N=R.length,T=R[0].length,m=Math.floor(T/S);
  if(m<5||N<4)return null;
  const blocks=[];for(let i=0;i<S;i++)blocks.push([i*m,(i+1)*m]);
  const cs=combos(S,S/2),lam=[],pairs=[];
  cs.forEach(c=>{
    const inSet=new Set(c);
    const si=[],so=[];
    for(let n=0;n<N;n++){
      const I=[],O=[];
      for(let b=0;b<S;b++){const seg=R[n].slice(blocks[b][0],blocks[b][1]);
        (inSet.has(b)?I:O).push(...seg)}
      si.push(sharpe(I));so.push(sharpe(O));
    }
    let best=0;for(let n=1;n<N;n++)if(si[n]>si[best])best=n;
    // mid-rank for ties (first-occurrence rank biased PBO upward on ties)
    let below=0,eq=0;for(let n=0;n<N;n++){if(so[n]<so[best])below++;else if(so[n]===so[best])eq++}
    const w=(below+(eq+1)/2)/(N+1);
    lam.push(Math.log(w/(1-w)));
    pairs.push([si[best],so[best]]);
  });
  const pbo=lam.filter(x=>x<=0).length/lam.length;
  const negOOS=pairs.filter(p=>p[1]<0).length/pairs.length;
  const mIS=pairs.reduce((a,p)=>a+p[0],0)/pairs.length;
  const mOS=pairs.reduce((a,p)=>a+p[1],0)/pairs.length;
  return{pbo:pbo,negOOS:negOOS,splits:lam.length};
}
/* time-ordered decay: pick the winner on the first half, watch it in later blocks.
   CSCV shuffles time blocks, so it is structurally blind to regime decay. */
function decayTest(R,S){
  S=S||8; const N=R.length,T=R[0].length,h=Math.floor(T/2);
  if(h<20)return null;
  let best=0,bs=-Infinity;
  for(let n=0;n<N;n++){const v=sharpe(R[n].slice(0,h));if(v>bs){bs=v;best=n}}
  const m=Math.floor((T-h)/S),out=[];
  for(let k=0;k<S;k++){const seg=R[best].slice(h+k*m,h+(k+1)*m);
    if(seg.length>3)out.push(sharpe(seg))}
  if(!out.length)return null;
  return{isSR:bs,osSR:out.reduce((a,b)=>a+b,0)/out.length,blocks:out};
}

/* ============ data ============ */
function synth(n,seed){
  let s=seed||Math.floor(Math.random()*1e9);
  const rnd=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
  const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  const b=[];let px=100;
  for(let i=0;i<n;i++){const o=px,r=g()*0.03;px*=Math.exp(r);
    b.push({d:'syn'+i,o:o,h:Math.max(o,px)*(1+Math.abs(g())*0.006),
            l:Math.min(o,px)*(1-Math.abs(g())*0.006),c:px})}
  return b;
}
/* Bundled BTC/USD daily bars, packed as YYMMDD,o,h,l,c;...
   Source: public historical dataset, validated before inclusion — OHLC
   relationships hold on all 5,021 source rows, zero gaps across 5,021
   calendar days, and closes match seven independently known reference
   points (2017 peak, 2018 low, COVID crash, 2021 ATH, FTX week, 2022
   year-end, 2024 ATH). Per-era volatility: 74% (2014-17), 76% (2018-21),
   56% (2022-24) — the shape BTC actually had. */
const BTCPACK=/*@@BTCPACK@@*/;
function bundledBars(){
  return BTCPACK.split(';').map(r=>{
    const p=r.split(','), ds='20'+p[0].slice(0,2)+'-'+p[0].slice(2,4)+'-'+p[0].slice(4,6);
    return {t:Date.parse(ds+'T00:00:00Z')/1000,d:ds,o:+p[1],h:+p[2],l:+p[3],c:+p[4]};
  });
}
/* Coinbase Exchange public candles. Rows come back as
   [ time, LOW, HIGH, OPEN, CLOSE, volume ] — note that order, it is not OHLC.
   Max 300 candles per request, so we page backwards from now. */
/* ============ coin registry ============
   The one place coins are defined. Adding a market is a single line here; the
   fetch dropdown, the market-pool refresh, and validation all read from it.
   `id` is the Coinbase product; `name` is the short label used in the pool and
   as the assetKey stem. Keep ids as PAIR-USD so assetKey() groups sources. */
const COINS=[
  {id:'BTC-USD', name:'BTC'},
  {id:'ETH-USD', name:'ETH'},
  {id:'SOL-USD', name:'SOL'},
];
const coinName=id=>{const m=COINS.find(c=>c.id===id);return m?m.name:String(id).replace('-USD','')};
const isKnownCoin=id=>COINS.some(c=>c.id===id);
/* Route public Coinbase URLs through the local launcher when served from it.
   Browsers block most direct exchange calls (CORS); the launcher proxies GET-only public routes. */
function routePublic(url){
  try{
    const loc=typeof location!=='undefined'?location:null;
    if(!loc||loc.protocol!=='http:'||(loc.hostname!=='127.0.0.1'&&loc.hostname!=='localhost'))return url;
    const u=new URL(url);
    if(u.origin==='https://api.exchange.coinbase.com')return '/coinbase-exchange'+u.pathname+u.search;
    if(u.origin==='https://api.coinbase.com'&&u.pathname.indexOf('/api/v3/brokerage/')===0)return '/coinbase-public'+u.pathname.slice(17)+u.search;
  }catch(e){}
  return url;
}
async function fetchCandles(pair,gran,bars,onProg){
  if(!/^[A-Z0-9]+-[A-Z0-9]+$/.test(pair)||![3600,21600,86400].includes(gran)||!Number.isInteger(bars)||bars<1||bars>6000)throw new Error('Invalid candle request.');
  const cutoff=Math.floor(Date.now()/1000/gran)*gran;
  const out=new Map(); let end=new Date(cutoff*1000); const per=300;
  const calls=Math.ceil(bars/per);
  for(let i=0;i<calls;i++){
    const start=new Date(end.getTime()-per*gran*1000);
    const url=`https://api.exchange.coinbase.com/products/${pair}/candles`
      +`?granularity=${gran}&start=${start.toISOString()}&end=${new Date(end.getTime()-1000).toISOString()}`;
    let r,rows;
    for(let attempt=0;attempt<3;attempt++){
      const controller=new AbortController();let timer;
      try{await Promise.race([
        (async()=>{r=await fetch(routePublic(url),{signal:controller.signal});if(r.ok)rows=await r.json()})(),
        new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Coinbase request timed out. Try again or paste a CSV.'))},15000)})
      ])}catch(e){throw new Error(/abort|timed out/i.test(e.message||'')?'Coinbase request timed out. Try again or paste a CSV.':(e.message&&!/fetch|network/i.test(e.message)?e.message:'Could not reach Coinbase. Start the app with START-WINDOWS.bat / START-MAC-LINUX.sh so data is fetched through the local launcher, or paste a CSV.'))}finally{clearTimeout(timer)}
      if(r.status!==429)break;
      if(attempt===2)throw new Error('Coinbase rate limit persisted after three attempts. Try again later.');
      await new Promise(z=>setTimeout(z,1000*(attempt+1)));
    }
    if(!r.ok){let detail='';try{const j=await r.json();if(j&&typeof j.error==='string')detail=j.error}catch(_){}throw new Error(detail||(`Coinbase returned HTTP ${r.status}`+(r.status===404?` — is "${pair}" a live product?`:'')))}
    if(!Array.isArray(rows)) throw new Error('Unexpected response shape from Coinbase.');
    if(!rows.length) break;
    rows.forEach(c=>{
      if(!Array.isArray(c)||c.length<5||!c.slice(0,5).every(v=>typeof v==='number'&&Number.isFinite(v))||!Number.isInteger(c[0])||c[0]%gran!==0||c.slice(1,5).some(v=>v<=0)||c[2]<Math.max(c[3],c[4])||c[1]>Math.min(c[3],c[4]))throw new Error('Malformed candle returned by Coinbase.');
      if(c[0]<start.getTime()/1000||c[0]>=end.getTime()/1000||c[0]>=cutoff)return;
      out.set(c[0],{t:c[0],
      d:new Date(c[0]*1000).toISOString().slice(0,gran>=86400?10:19).replace('T',' '),
      l:+c[1],h:+c[2],o:+c[3],c:+c[4]})});
    if(onProg)onProg(out.size,i+1,calls);
    end=start;
    await new Promise(z=>setTimeout(z,300));
  }
  return [...out.values()].sort((a,b)=>a.t-b.t).slice(-bars);
}
/* Never trust fetched data silently. */
function validateBars(b,gran){
  const bad=[];
  let impossible=0,nonpos=0;
  b.forEach(x=>{
    if(!(x.h>=Math.max(x.o,x.c)-1e-9&&x.l<=Math.min(x.o,x.c)+1e-9))impossible++;
    if(!(x.c>0&&x.l>0&&x.o>0&&x.h>0))nonpos++;
  });
  if(impossible)bad.push(`${impossible} bars where high/low don't bracket open/close`);
  if(nonpos)bad.push(`${nonpos} bars with a non-positive price`);
  const dupes=b.length-new Set(b.map(x=>x.t)).size;
  if(dupes)bad.push(`${dupes} duplicate timestamps`);
  let gaps=0;
  for(let i=1;i<b.length;i++){const step=Math.round((b[i].t-b[i-1].t)/gran);if(step>1)gaps+=step-1}
  if(gaps)bad.push(`${gaps} missing periods (gaps in the series)`);
  return bad;
}
function toCsv(b){
  return 'date,open,high,low,close\n'+b.map(x=>`${x.d},${x.o},${x.h},${x.l},${x.c}`).join('\n');
}
function splitCsv(line){const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}
    else if(ch===','&&!q){out.push(cur);cur=''}else cur+=ch}
  out.push(cur);return out}
const num=x=>parseFloat(String(x).replace(/[,$\s]/g,''));
function parseCsv(t){
  const lines=t.trim().split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<10)throw Error('File looks empty or far too short.');
  let hi=-1,head;
  for(let i=0;i<Math.min(15,lines.length);i++){const f=splitCsv(lines[i]).map(x=>x.trim().toLowerCase());if(f.includes('close')){hi=i;head=f;break}}
  if(hi<0)throw Error('No OHLC header found in the first 15 lines.');
  const find=(...names)=>{for(const name of names){const i=head.indexOf(name);if(i>=0)return i}return -1};
  const ix={o:find('open'),h:find('high'),l:find('low'),c:find('close'),t:find('date','datetime','time','timestamp','unix')};
  if(Object.values(ix).some(i=>i<0))throw Error('Require a date/time column and complete open, high, low, close columns. No prices will be substituted.');
  const out=[];
  for(let i=hi+1;i<lines.length;i++){
    const row=splitCsv(lines[i]);if(row.length!==head.length)throw Error('Column count differs on line '+(i+1)+'.');
    const raw=row[ix.t].trim();let ts;
    if(/^\d{10}(?:\.\d+)?$/.test(raw))ts=Number(raw);
    else if(/^\d{13}$/.test(raw))ts=Number(raw)/1000;
    else if(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(raw)){
      let v=raw.replace(' ','T');if(v.length===10)v+='T00:00:00Z';else if(!/(Z|[+-]\d{2}:?\d{2})$/.test(v))v+='Z';ts=Date.parse(v)/1000;
      const dateOnly=raw.slice(0,10);if(!Number.isFinite(Date.parse(dateOnly))||new Date(Date.parse(dateOnly)).toISOString().slice(0,10)!==dateOnly)throw Error('Invalid calendar date on line '+(i+1)+'.');
    }else throw Error('Use ISO dates or Unix seconds/milliseconds; invalid timestamp on line '+(i+1)+'.');
    if(!Number.isFinite(ts)||ts<0||ts>8640000000000)throw Error('Invalid timestamp on line '+(i+1)+'.');
    const b={t:ts,d:new Date(ts*1000).toISOString()};
    for(const k of ['o','h','l','c']){const value=Number(row[ix[k]].replace(/[$,\s]/g,''));if(!Number.isFinite(value)||value<=0)throw Error('Invalid '+k+' price on line '+(i+1)+'.');b[k]=value}
    out.push(b);
  }
  if(out.length<60)throw Error('Need at least 60 complete OHLC rows.');out.sort((a,b)=>a.t-b.t);
  const gran=out[1].t-out[0].t,issues=validateBars(out,gran);
  if(!(gran>0)||out.some((bar,i)=>i>0&&bar.t-out[i-1].t!==gran))issues.push('Uneven or duplicate candle intervals');
  if(issues.length)throw Error(issues.join('; ')+'. Repair the source data before testing.');
  out._missing=[];return out;
}
/* ============ params ============ */
const PARAMS={ma:[['fast','Fast MA',10],['slow','Slow MA',50],['thr','Threshold %',0.5]],
  rsi:[['per','RSI period',14],['os','Oversold below',30]],brk:[['look','Lookback bars',20]]};
const SWEEP={ma:[[5,10,20,40],[30,50,80,120],[0,0.5,1.5]],rsi:[[7,14,21],[20,25,30,35]],brk:[[10,20,40,60]]};
function drawParams(){const s=document.getElementById('strat').value;
  document.getElementById('params').innerHTML=PARAMS[s].map(([k,l,v])=>
    `<div><label for="pp_${k}">${l}</label><input type="number" id="pp_${k}" value="${v}" step="any"></div>`).join('')}
function readParams(){const s=document.getElementById('strat').value,o={};
  PARAMS[s].forEach(([k])=>o[k]=parseFloat(document.getElementById('pp_'+k).value));return o}
function sweepSet(st){
  const g=SWEEP[st],keys=PARAMS[st].map(p=>p[0]),out=[];
  (function rec(i,acc){if(i===keys.length){out.push(Object.assign({},acc));return}
    g[i].forEach(v=>{acc[keys[i]]=v;rec(i+1,acc)})})(0,{});
  return st==='ma'?out.filter(p=>p.fast<p.slow):out;
}

/* ============ next action (pure) ============
   Translate a config into the concrete instruction for the NEXT bar on one
   asset's series, from that asset's current data. Returns the position state
   now, the exact price/level that would flip it, and — when a position is or
   would be open — the stop, target and max-hold expiry as prices/dates.
   This never decides whether to trade (judge() does); it only states what the
   rule mechanically says, so a person can place or skip the order themselves. */
/* Exact next-bar MA trigger close, in closed form. The next fast/slow MAs are
   (nextClose + sum of the last win-1 closes)/win, so the boundary
   fastN = slowN*(1+thr/100) is linear in nextClose. Returns the close that
   crosses it, which is the price to watch — the MA level itself is not, since
   one candle barely moves a long average. */
function maTriggerClose(bars,p){const c=bars.map(b=>b.c),i=c.length-1,fast=Math.round(p.fast),slow=Math.round(p.slow),k=1+p.thr/100;
  if(i+1<slow)return null;
  let sf=0;for(let j=i-fast+2;j<=i;j++)sf+=c[j];
  let ss=0;for(let j=i-slow+2;j<=i;j++)ss+=c[j];
  const aCoef=1/fast-k/slow; if(Math.abs(aCoef)<1e-12)return null;
  return -(sf/fast-k*ss/slow)/aCoef;}
function nextAction(bars,st,p,cfg){
  const n=bars.length,c=bars.map(b=>b.c),sig=signal(bars,st,p),i=n-1;
  // Position state now, reconstructed exactly as runEngine does: enter only on a
  // fresh 0->1 signal cross, then exit on stop / target(fixed) / signal-off /
  // max-hold, whichever comes first. Being flat with the condition already true
  // is NOT an entry — the engine waits for the signal to reset and re-cross.
  let pos=null;
  for(let k=1;k<n;k++){
    if(!pos){ if(sig[k]===1&&sig[k-1]===0)pos={e:c[k],i:k}; continue; }
    const tg=pos.e*(1+cfg.tgt),sp=pos.e*(1-cfg.stp);
    if(bars[k].l<=sp) pos=null;
    else if(cfg.mode!=='signal'&&bars[k].h>=tg) pos=null;
    else if(cfg.mode==='signal'&&sig[k]===0) pos=null;
    else if(k-pos.i>=cfg.hold) pos=null;
  }
  const inPos=!!pos, last=bars[i], px=c[i];
  // On the NEXT bar, the engine enters only if the signal is currently off and
  // then crosses on — i.e. a fresh cross. If the condition is already satisfied
  // but we are flat, no entry happens until it turns off and back on.
  const armed = sig[i]===0;   // eligible to trigger a fresh entry next bar
  const A={date:last.d, lastClose:px, inPosition:inPos, armed:armed, st:st, mode:cfg.mode};
  const barSecs = n>1 && last.t!=null && bars[i-1].t!=null ? last.t-bars[i-1].t : null;
  const expiry = pos && barSecs!=null ? new Date((last.t + (cfg.hold-(i-pos.i))*barSecs)*1000).toISOString().slice(0,10) : null;
  A.holdBarsLeft = pos ? Math.max(0,cfg.hold-(i-pos.i)) : cfg.hold;
  A.expiry = expiry;
  if(st==='ma'){const f=sma(c,Math.round(p.fast)),w=sma(c,Math.round(p.slow));
    A.fast=f[i]; A.slow=w[i]; A.crossPrice=w[i]!=null?w[i]*(1+p.thr/100):null; A.triggerClose=maTriggerClose(bars,p);
    A.rule=`Fast MA(${Math.round(p.fast)}) vs Slow MA(${Math.round(p.slow)})×(1+${p.thr}%)`;
    A.trigger = inPos
      ? (A.triggerClose!=null&&A.triggerClose>0?`In a position. A close near ${fmt(A.triggerClose)} on the next bar drops Fast MA back across the line for a signal exit; the stop/hold below can fire first.`:`In a position. Exit when Fast MA(${Math.round(p.fast)}) closes back below the Slow MA line (${fmt(A.crossPrice)}); the stop/hold below can fire first.`)
      : (armed
          ? (A.triggerClose!=null&&A.triggerClose>0?`Flat and armed. A single close near ${fmt(A.triggerClose)} on the next bar pulls Fast MA(${Math.round(p.fast)}) across the line and triggers entry. (The MA level is ${fmt(A.crossPrice)}; one candle rarely reaches it, so watch the close.)`:`Flat and armed. Enter when Fast MA(${Math.round(p.fast)}) closes above the Slow MA line (${fmt(A.crossPrice)}); no single next-bar close reaches it from here.`)
          : `Flat but the fast MA is already above the line, so there is no fresh entry: the engine waits for Fast MA to close below ${fmt(A.crossPrice)} and then cross back above before it enters.`);}
  else if(st==='rsi'){const r=rsi(c,Math.round(p.per));A.rsi=r[i];A.level=p.os; A.triggerClose=maTriggerClose(bars,p);
    A.rule=`RSI(${Math.round(p.per)}) below ${p.os}`;
    A.trigger = inPos
      ? `In a position. Exit when RSI(${Math.round(p.per)}) closes back above ${p.os} (it is ${r[i]!=null?r[i].toFixed(1):'—'} now), or on the stop/hold below.`
      : (armed
          ? `Flat and armed. RSI(${Math.round(p.per)}) is ${r[i]!=null?r[i].toFixed(1):'—'} now and enters below ${p.os}. RSI needs sustained down-closes, not one number, so watch RSI itself on your data feed rather than a single price.`
          : `Flat, but RSI is already below ${p.os} without a fresh cross, so the engine does not enter: it waits for RSI to close back above ${p.os} and then drop below again.`);}
  else{const L=Math.round(p.look),X=Math.max(1,Math.round(L/2));let hi=-Infinity,lo=Infinity;
    for(let j=i-L+1;j<=i;j++)if(bars[j])hi=Math.max(hi,bars[j].h);
    for(let j=i-X+1;j<=i;j++)if(bars[j])lo=Math.min(lo,bars[j].l);
    A.enterAbove=hi; A.exitBelow=lo; A.rule=`Donchian ${L}-bar high / ${X}-bar low`;
    A.trigger = inPos
      ? `In a position. Exit on a close below ${fmt(lo)} (the prior ${X}-bar low), or on the stop/hold below.`
      : (armed
          ? `Flat and armed. Enter on a close above ${fmt(hi)} (the prior ${L}-bar high).`
          : `Flat, but price is already above the ${L}-bar breakout level with no fresh cross; the channel must reset (a close below ${fmt(lo)}) before a new entry.`);}
  // Bracket. entryRef is the close the position was (or would be) entered at:
  // the actual entry close if in a position, else the latest close as a stand-in
  // for the future triggering close (the UI says to recompute from the real fill).
  const entryRef = pos ? pos.e : px;
  A.entryRef=entryRef; A.enteredAt = pos ? bars[pos.i].d : null;
  A.stop = entryRef*(1-cfg.stp);
  A.target = cfg.mode==='fixed' ? entryRef*(1+cfg.tgt) : null;
  A.maxHoldBars=cfg.hold; A.exitMode=cfg.mode;
  // Exit priority is stop first (checked intrabar, fills at the worse of open and
  // stop — a gap through it fills lower), THEN the signal/target exit at the close.
  const ref = pos ? `entry ${fmt(entryRef)} on ${A.enteredAt}` : `a fill near ${fmt(entryRef)}`;
  const stopClause = `stop ${fmt(A.stop)} (−${(cfg.stp*100).toFixed(1)}%), checked first each bar and filled at the worse of the open and the stop if price gaps through`;
  const holdClause = pos && expiry ? `time-exit on ${expiry} (${A.holdBarsLeft} bars left)` : `time-exit after ${cfg.hold} bars`;
  A.bracketNote = cfg.mode==='fixed'
    ? `From ${ref}: ${stopClause}; else target ${fmt(A.target)} (+${(cfg.tgt*100).toFixed(1)}%) at a bar's high; else ${holdClause}.`
    : `From ${ref}: ${stopClause}; else exit at the close when the entry signal turns off (see above); else ${holdClause}.`;
  return A;
}
function fmt(v){if(v==null||!isFinite(v))return '—';
  const a=Math.abs(v);return '$'+v.toLocaleString('en-US',{minimumFractionDigits:a<10?4:2,maximumFractionDigits:a<10?4:2})}

/* ============ evaluation (pure — the ONLY place verdict math lives) ============
   familyStats(): every statistic for a family of configs on one dataset.
   judge(): turns those stats + the dataset's effective trial count into a verdict.
   The UI (doRun/render) and the test suite (tests/sims) both call these, so the
   simulations always exercise the shipped logic. Change verdict behaviour here
   only, then re-run tests/verify.js and the sims gate (see AGENTS.md). */
const MIN_TRADES=10;   // verdict minimum; also the sweep-winner eligibility bar
function statsFromE(E,fam,sweep,bpy,opts){
  const diag=!(opts&&opts.diag===false);             // PBO/decay are warnings only; sims may skip them
  const act=E.filter(e=>e.n>0).map(e=>e.x);
  const res=diag&&act.length>=4?cscvPBO(act,12):null;
  const rho=avgCorr(act);
  const dec=diag&&act.length>=4?decayTest(act,8):null;
  const famSR=E.filter(e=>e.n>=5).map(e=>sharpe(e.x));
  const varSR=famSR.length>=4?Math.pow(moments(famSR).s,2):null;
  // A sweep is judged on its winner: best excess Sharpe among configs with
  // MIN_TRADES+ trades (the verdict minimum); fall back to 5+ if none qualify.
  let bi=0;
  if(sweep){const pick=min=>{let k=-1,bs=-Infinity;E.forEach((e,i)=>{if(e.n>=min){const v=sharpe(e.x);if(v>bs){bs=v;k=i}}});return k};
    bi=pick(MIN_TRADES);if(bi<0)bi=pick(5);if(bi<0)bi=0;}
  return {E:E,res:res,rho:rho,dec:dec,famSR:famSR,varSR:varSR,bi:bi,W:E[bi],p:fam[bi],bpy:bpy};
}
function familyStats(bars,st,fam,cfg,sweep,opts){
  return statsFromE(fam.map(q=>barX(bars,st,q,cfg)),fam,sweep,barsPerYear(bars),opts);  // drift-adjusted per-bar streams
}
/* ---- Pooling across assets ----
   The same rule runs on every asset; each asset's stream is drift-adjusted
   against ITS OWN buy-and-hold; the pooled stream is the equal-weight average
   across whichever assets have data on each date (an asset that hasn't listed
   yet simply isn't in the average). judge() then treats the pooled stream like
   any single stream, so cross-asset correlation is priced in automatically:
   highly correlated assets add little, independent ones add a lot. */
function poolKey(b,i,daily){return b.t!=null?(daily?Math.floor(b.t/86400):b.t):i}
function poolStreams(datasets,st,q,cfg){
  const daily=barsPerYear(datasets[0])<=400,acc=new Map(),trs=[];let n=0;
  datasets.forEach(bars=>{const e=barX(bars,st,q,cfg);n+=e.n;
    e.tr.forEach((r,k)=>trs.push([poolKey(bars[e.ex[k]],e.ex[k],daily),r]));
    for(let i=1;i<bars.length;i++){const k=poolKey(bars[i],i,daily),a=acc.get(k)||[0,0];a[0]+=e.x[i-1];a[1]++;acc.set(k,a)}});
  const keys=[...acc.keys()].sort((a,b)=>a-b);
  trs.sort((a,b)=>a[0]-b[0]);
  return {x:keys.map(k=>{const a=acc.get(k);return a[0]/a[1]}),n:n,tr:trs.map(z=>z[1])};
}
function poolCheck(datasets){
  if(!datasets||datasets.length<2)return 'A pool needs at least two datasets.';
  const hasT=datasets.map(b=>b[0]&&b[0].t!=null);
  if(hasT.some(v=>v!==hasT[0]))return 'Mixing dated and undated data cannot be aligned.';
  const b0=barsPerYear(datasets[0]);
  for(const b of datasets)if(Math.abs(barsPerYear(b)/b0-1)>0.02)return 'All pooled datasets must use the same candle size.';
  return null;
}
function familyStatsPooled(datasets,st,fam,cfg,sweep,opts){
  const err=poolCheck(datasets);if(err)throw new Error(err);
  return statsFromE(fam.map(q=>poolStreams(datasets,st,q,cfg)),fam,sweep,barsPerYear(datasets[0]),opts);
}
function judge(fs,effAll,sweep,over){
  const X=fs.W.x,MX=moments(X.length?X:[0]),sr=MX.s?MX.m/MX.s:0;
  const T=X.length,years=T/fs.bpy,annSR=sr*Math.sqrt(fs.bpy);
  // A lone config that is the only trial ever run on this dataset is a
  // pre-registered test: nothing was selected, so nothing is deflated.
  const prereg=!sweep&&effAll<=1.0001;
  const used=prereg?1:Math.max(effAll,2);
  const sr0=prereg?0:(fs.varSR!=null?expMaxSR(fs.varSR,used):null);
  const dsr=sr0!=null?psr(sr,sr0,T,MX.sk,MX.ku):null;
  // Minimum detectable annualized excess Sharpe at ~80% power.
  const mds=(sr0!=null&&!prereg)?sr0*Math.sqrt(fs.bpy)+ZPOW*Math.sqrt(1/years):mds80(years,used);
  let verdict;
  if(fs.W.n<MIN_TRADES)verdict='few-trades';
  else if(dsr===null||!isFinite(dsr))verdict='not-computable';
  else verdict=(dsr>=0.95&&!over)?'pass':'fail';
  return {MX:MX,sr:sr,T:T,years:years,annSR:annSR,prereg:prereg,used:used,sr0:sr0,dsr:dsr,mds:mds,verdict:verdict};
}
