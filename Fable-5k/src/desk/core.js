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
const isReal=h=>h.data!=='synthetic';
const spentTotal=()=>HYP.filter(isReal).reduce((a,h)=>a+(h.spent||1),0);
/* Effective trials: each entry deflated by the correlation MEASURED across its
   own family (entries assumed independent of each other — conservative).
   v3 used one typed-in guess (0.7) for everything; measured values on BTC were
   0.20-0.25 for MA/RSI sweeps, so the guess cut the trial count by more than half. */
const tagOf=h=>h.data||'BTC-USD daily (bundled)';
/* Trials count against the dataset they were run on — selection bias comes
   from searching the same data. */
const effFor=tag=>HYP.filter(h=>isReal(h)&&tagOf(h)===tag).reduce((a,h)=>a+((h.spent||1)>1?effN(h.spent,h.rho!=null?h.rho:0):1),0);
const effTotal=()=>effFor(DATA_TAG||'BTC-USD daily (bundled)');
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
  const bar=Array(bars.length-1).fill(0),inp=Array(bars.length-1).fill(0),tr=[],hb=[];let pos=null;
  for(let i=1;i<bars.length;i++){
    if(!pos){if(sig[i]===1&&sig[i-1]===0)pos={e:bars[i].c,i:i};continue}
    inp[i-1]=1;
    const tg=pos.e*(1+cfg.tgt),sp=pos.e*(1-cfg.stp);let x=null;
    if(bars[i].l<=sp)x=Math.min(bars[i].o,sp);
    else if(cfg.mode!=='signal'&&bars[i].h>=tg)x=Math.max(bars[i].o,tg);
    else if(cfg.mode==='signal'&&sig[i]===0)x=bars[i].c;
    else if(i-pos.i>=cfg.hold)x=bars[i].c;
    if(x!==null){bar[i-1]=(x-bars[i-1].c)/bars[i-1].c-cfg.cost;tr.push((x-pos.e)/pos.e-cfg.cost);hb.push(i-pos.i);pos=null}
    else bar[i-1]=(bars[i].c-bars[i-1].c)/bars[i-1].c;
  }
  return {bar:bar,tr:tr,hb:hb,inp:inp};
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
  return {x:e.bar.map((r,t)=>r-e.inp[t]*mu),n:e.tr.length,tr:e.tr}}
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
    b.push({t:946684800+i*86400,d:'syn'+i,o:o,h:Math.max(o,px)*(1+Math.abs(g())*0.006),
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
   Max 300 candles per request, so we page backwards from the last COMPLETED bucket;
   the in-progress candle is never returned. */
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
    if(![x.c,x.l,x.o,x.h,x.t].every(Number.isFinite)||!(x.c>0&&x.l>0&&x.o>0&&x.h>0))nonpos++;
  });
  if(impossible)bad.push(`${impossible} bars where high/low don't bracket open/close`);
  if(nonpos)bad.push(`${nonpos} bars with a non-positive price`);
  const dupes=b.length-new Set(b.map(x=>x.t)).size;
  if(dupes)bad.push(`${dupes} duplicate timestamps`);
  let gaps=0;
  for(let i=1;i<b.length;i++){const step=(b[i].t-b[i-1].t)/gran;if(!(step>0)||!Number.isInteger(step)){bad.push("Irregular or unordered timestamps");break}if(step>1)gaps+=step-1}
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

/* ============ execution audit core ============ */
// A separate accounting model. It does not feed the legacy DSR verdict.
function auditValidate(bars,sig,cfg){
  if(!Array.isArray(bars)||bars.length<2||!Array.isArray(sig)||sig.length!==bars.length)throw Error('Need matching bars and signals.');
  for(let i=0;i<bars.length;i++){
    const b=bars[i];
    if(![b.o,b.h,b.l,b.c,b.t].every(Number.isFinite)||Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)||b.h<b.l)throw Error('Execution audit requires complete, valid OHLC and timestamps.');
    if(i&&b.t<=bars[i-1].t)throw Error('Timestamps must be strictly increasing.');
    if(sig[i]!==0&&sig[i]!==1)throw Error('Signals must be 0 or 1.');
  }
  if(!['signal','fixed'].includes(cfg.mode)||!Number.isInteger(cfg.hold)||cfg.hold<1)throw Error('Invalid exit mode or hold period.');
  if(![cfg.capital,cfg.allocation,cfg.entryFee,cfg.exitFee,cfg.entrySlip,cfg.exitSlip,cfg.stp,cfg.tgt].every(Number.isFinite))throw Error('Fill in all execution assumptions.');
  if(cfg.capital<=0||cfg.allocation<=0||cfg.allocation>1||cfg.stp<=0||cfg.stp>=1||cfg.tgt<=0)throw Error('Capital, allocation, target and stop must be positive; allocation ≤100%, stop <100%.');
  if([cfg.entryFee,cfg.exitFee,cfg.entrySlip,cfg.exitSlip].some(x=>x<0||x>=1))throw Error('Fees and slippage must be between 0% and 100% (exclusive).');
}
function curveStats(curve,capital,years){
  let peak=capital,maxDD=0,under=0,longest=0;
  for(const v of curve){peak=Math.max(peak,v);maxDD=Math.max(maxDD,1-v/peak);if(v<peak-1e-8){under++;longest=Math.max(longest,under)}else under=0;}
  const final=curve[curve.length-1],ret=final/capital-1;
  return {final,ret,cagr:years>0?Math.pow(final/capital,1/years)-1:null,maxDD,longestUnderwaterBars:longest};
}
function executionAudit(bars,sig,cfg){
  auditValidate(bars,sig,cfg);
  const n=bars.length,curve=[cfg.capital],fills=[],tr=[],years=(bars[n-1].t-bars[0].t)/31557600;
  let cash=cfg.capital,pos=null,fees=0,slippage=0,turnover=0,exposed=0,ambiguous=0;
  function buy(i){
    const ref=bars[i].o,px=ref*(1+cfg.entrySlip),debit=cash*cfg.allocation,notional=debit/(1+cfg.entryFee),qty=notional/px,fee=notional*cfg.entryFee;
    pos={i,qty,px,debit,fee,stop:px*(1-cfg.stp),target:px*(1+cfg.tgt)};
    cash-=debit;fees+=fee;slippage+=qty*(px-ref);turnover+=notional;
    fills.push({i,date:bars[i].d||String(bars[i].t),side:'buy',reason:'prior-close signal',reference:ref,price:px,qty,fee,cash});
  }
  function sell(i,ref,reason){
    const px=ref*(1-cfg.exitSlip),gross=pos.qty*px,fee=gross*cfg.exitFee,credit=gross-fee;
    cash+=credit;fees+=fee;slippage+=pos.qty*(ref-px);turnover+=gross;
    fills.push({i,date:bars[i].d||String(bars[i].t),side:'sell',reason,reference:ref,price:px,qty:pos.qty,fee,cash});
    tr.push({entry:pos.i,exit:i,reason,entryPrice:pos.px,exitPrice:px,qty:pos.qty,fees:pos.fee+fee,pnl:credit-pos.debit,ret:credit/pos.debit-1});pos=null;
  }
  for(let i=1;i<n;i++){
    const b=bars[i];let exited=false,held=!!pos;
    if(pos){
      // Gap protection checks first. Orders based on a previous close execute at this open.
      if(b.o<=pos.stop){sell(i,b.o,'gap stop');exited=true;}
      else if(cfg.mode==='fixed'&&b.o>=pos.target){sell(i,b.o,'gap target');exited=true;}
      else if(cfg.mode==='signal'&&sig[i-1]===0){sell(i,b.o,'signal off at next open');exited=true;}
      else if(i-pos.i>=cfg.hold){sell(i,b.o,'max hold at open');exited=true;}
    }
    if(!pos&&!exited&&sig[i-1]===1&&(i===1||sig[i-2]===0)){buy(i);held=true;}
    if(pos){
      if(b.l<=pos.stop&&cfg.mode==='fixed'&&b.h>=pos.target)ambiguous++;
      // OHLC does not reveal which threshold came first: stop first is conservative.
      if(b.l<=pos.stop)sell(i,Math.min(b.o,pos.stop),'intrabar stop');
      else if(cfg.mode==='fixed'&&b.h>=pos.target)sell(i,Math.max(b.o,pos.target),'intrabar target');
    }
    if(held)exposed++;
    if(i===n-1&&pos)sell(i,b.c,'sample-end liquidation');
    curve.push(cash+(pos?pos.qty*b.c:0));
  }
  // Same full time window and execution assumptions; benchmark invests 100% once.
  const first=bars[1].o*(1+cfg.entrySlip),notional=cfg.capital/(1+cfg.entryFee),qty=notional/first;
  const bh=[cfg.capital];let bhFee=notional*cfg.entryFee;
  for(let i=1;i<n;i++)bh.push(qty*bars[i].c);
  const last=bars[n-1].c*(1-cfg.exitSlip);bhFee+=qty*last*cfg.exitFee;bh[n-1]=qty*last*(1-cfg.exitFee);
  return {strategy:curveStats(curve,cfg.capital,years),benchmark:curveStats(bh,cfg.capital,years),curve,buyHold:bh,years,trades:tr,fills,fees,slippage,turnover,exposure:exposed/(n-1),ambiguous,benchmarkFees:bhFee,assumptions:{...cfg}};
}
function positionPlan(c){
  const keys=['equity','peak','cash','risk','portfolioRisk','openRisk','maxPosition','maxDrawdown','entry','stop','entryFee','exitFee','entrySlip','exitSlip','gap'];
  if(keys.some(k=>!Number.isFinite(c[k])))throw Error('Fill in every risk and cost input.');
  if(c.equity<=0||c.peak<c.equity||c.cash<0||c.cash>c.equity||c.entry<=0||c.stop<=0||c.stop>=c.entry||c.openRisk<0)throw Error('Use positive equity/prices, peak ≥ equity, cash ≤ equity and stop below entry.');
  if(['risk','portfolioRisk','maxPosition','maxDrawdown'].some(k=>c[k]<=0||c[k]>1)||['entryFee','exitFee','entrySlip','exitSlip','gap'].some(k=>c[k]<0||c[k]>=1))throw Error('Risk limits must be >0% and ≤100%; costs/gap must be ≥0% and <100%.');
  const drawdown=1-c.equity/c.peak,entryFill=c.entry*(1+c.entrySlip),stopFill=c.stop*(1-c.exitSlip);
  const cashPerUnit=entryFill*(1+c.entryFee),lossPerUnit=cashPerUnit-stopFill*(1-c.exitFee);
  const headroom=Math.max(0,c.equity*c.portfolioRisk-c.openRisk),riskBudget=Math.min(c.equity*c.risk,headroom);
  const halted=c.equity<=c.peak*(1-c.maxDrawdown);
  const qty=halted?0:Math.max(0,Math.min(riskBudget/lossPerUnit,c.cash/cashPerUnit,c.equity*c.maxPosition/cashPerUnit));
  const debit=qty*cashPerUnit,stopLoss=qty*lossPerUnit,gapFill=c.stop*(1-c.gap)*(1-c.exitSlip),gapLoss=qty*(cashPerUnit-gapFill*(1-c.exitFee));
  return {qty,debit,stopLoss,gapLoss,riskBudget,headroom,drawdown,entryFill,stopFill,lossPerUnit,feesAtStop:qty*(entryFill*c.entryFee+stopFill*c.exitFee),halt:halted,fullLoss:debit};
}
/* ============ end execution audit core ============ */

/* ============ v7 market and evidence core ============ */
const DAY=86400;
function canonicalJSON(value){
  function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,clean(x[k])]));return x}
  return JSON.stringify(clean(value));
}
function deepFreeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(deepFreeze);Object.freeze(x)}return x}
function marketNumber(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null;const n=Number(String(v).trim().replace(/%$/,''));return Number.isFinite(n)?n:null}
function marketRows(products){
  if(!Array.isArray(products))throw Error('Coinbase response has no products array.');
  const seen=new Set();return products.filter(p=>p&&p.product_type==='SPOT'&&p.quote_currency_id==='USD'&&/^[A-Z0-9._-]+-USD$/.test(p.product_id)&&!seen.has(p.product_id)&&seen.add(p.product_id)).map(p=>{
    const price=marketNumber(p.price),baseVol=marketNumber(p.volume_24h),quoteVol=marketNumber(p.approximate_quote_24h_volume);
    return {product:p.product_id,price:price>0?price:null,change24h:marketNumber(p.price_percentage_change_24h),volumeUSD:quoteVol>=0&&quoteVol!==null?quoteVol:baseVol!==null&&baseVol>=0&&price>0?baseVol*price:null,volumeBasis:quoteVol!==null?'reported quote volume':'base volume × current price estimate',blocked:!!(p.is_disabled||p.trading_disabled||p.cancel_only||p.auction_mode),restricted:!!(p.limit_only||p.post_only),status:String(p.status||'unspecified'),minimumQuote:marketNumber(p.quote_min_size),baseIncrement:marketNumber(p.base_increment)}
  }).sort((a,b)=>(b.volumeUSD??-1)-(a.volumeUSD??-1)||a.product.localeCompare(b.product));
}
function normalizeCandles(payload,nowSeconds,count=200){
  if(!payload||!Array.isArray(payload.candles))throw Error('Coinbase response has no candles array.');
  const cutoff=Math.floor(nowSeconds/DAY)*DAY,byTime=new Map();let incomplete=0;
  for(const c of payload.candles){
    const t=marketNumber(c.start);if(t===null||!Number.isInteger(t)||t%DAY!==0)throw Error('Invalid daily candle timestamp.');
    if(t>=cutoff){incomplete++;continue;}
    if(t<cutoff-count*DAY)continue;
    const b={t,d:new Date(t*1000).toISOString().slice(0,10),o:marketNumber(c.open),h:marketNumber(c.high),l:marketNumber(c.low),c:marketNumber(c.close),v:marketNumber(c.volume)};
    if([b.o,b.h,b.l,b.c].some(x=>x===null||x<=0)||b.v===null||b.v<0||b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c))throw Error('Invalid OHLC/volume in '+b.d+'.');
    if(byTime.has(t)&&canonicalJSON(byTime.get(t))!==canonicalJSON(b))throw Error('Conflicting duplicate candle '+b.d+'.');
    byTime.set(t,b);
  }
  const bars=[...byTime.values()].sort((a,b)=>a.t-b.t);
  if(!bars.length)throw Error('No complete daily candles returned.');
  if(bars.at(-1).t!==cutoff-DAY)throw Error('Latest completed UTC day is missing; signals suppressed.');
  for(let i=1;i<bars.length;i++)if(bars[i].t-bars[i-1].t!==DAY)throw Error('Missing daily candle; signals suppressed.');
  if(bars.length<121)throw Error('At least 121 contiguous completed days are required; signals suppressed.');
  return {bars,cutoff,incomplete};
}
function lockedSignals(bars){
  if(bars.length<121)throw Error('Insufficient indicator history.');
  const means=n=>bars.slice(-n).reduce((s,b)=>s+b.c,0)/n;
  const prevMeans=n=>bars.slice(-n-1,-1).reduce((s,b)=>s+b.c,0)/n;
  const fast=means(20),slow=means(120),on=fast>slow,previous=prevMeans(20)>prevMeans(120);
  let state=false,before=false;
  for(let i=60;i<bars.length;i++){
    before=state;const hi=Math.max(...bars.slice(i-60,i).map(b=>b.h)),lo=Math.min(...bars.slice(i-30,i).map(b=>b.l));
    if(!state&&bars[i].c>hi)state=true;else if(state&&bars[i].c<lo)state=false;
  }
  const action=(a,b)=>a&&!b?'Fresh ON transition':!a&&b?'Fresh OFF transition':a?'ON; no fresh entry':'OFF';
  return [{id:'H1',on,previous,description:action(on,previous),fast,slow},{id:'H2',on:state,previous:before,description:action(state,before),channelHigh:Math.max(...bars.slice(-61,-1).map(b=>b.h)),channelLow:Math.min(...bars.slice(-31,-1).map(b=>b.l))}];
}
function observationWindow(nowSeconds){const end=Math.floor(nowSeconds/DAY)*DAY;return {start:end-200*DAY,end,asOf:new Date((end-DAY)*1000).toISOString().slice(0,10)}}
function experimentRisk(equity,peak,policy){
  if(!Number.isFinite(equity)||equity<=0||!Number.isFinite(peak)||peak<equity)throw Error('Use positive equity and high-water equity at least as high.');
  const loss=policy.initialCapital-equity,drawdown=peak-equity,hardFloor=Math.max(policy.initialCapital-policy.hardPauseLoss,peak-policy.trailingPauseDollars);
  const stage=equity<=hardFloor?'HALT':loss>=policy.noNewRiskLoss?'NO_NEW_RISK':loss>=policy.reviewLoss?'REVIEW':'WITHIN_LIMITS';
  const remaining=Math.max(0,equity-hardFloor),headroomBeforePause=Math.max(0,equity-(policy.initialCapital-policy.noNewRiskLoss));
  return {stage,loss,drawdown,hardFloor,remaining,headroomBeforePause,newRiskAllowed:stage==='WITHIN_LIMITS'||stage==='REVIEW',riskFraction:policy.perTradeRiskFraction*(stage==='REVIEW'?.5:1)};
}
function overlapsExposure(a,b){
  const left=Date.parse(a.start),right=Date.parse(a.end),l=Date.parse(b.start),r=Date.parse(b.end);
  if(![left,right,l,r].every(Number.isFinite))return 'unknown';
  if(a.asset!=='UNKNOWN'&&b.asset!=='UNKNOWN'&&a.asset!==b.asset)return false;
  return left<r&&l<right;
}
async function fetchPublicJSON(path,fetcher,waiter=ms=>new Promise(r=>setTimeout(r,ms))){
  if(!/^\/(?:time|market\/(?:products(?:\/[A-Z0-9._-]+(?:\/candles)?)?))\??/.test(path)||path.includes('..')||path.includes('://'))throw Error('Only public market endpoints are permitted.');
  for(let attempt=0;attempt<3;attempt++){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);let response;
    try{response=await fetcher('https://api.coinbase.com/api/v3/brokerage'+path,{method:'GET',credentials:'omit',signal:ctl.signal,headers:{Accept:'application/json'}})}
    catch(e){if(attempt===2)throw Error('Public data request failed or timed out. Browser/network access may be blocked. Use the local launcher; do not enter API keys.');}
    finally{clearTimeout(timer)}
    if(response){
      if(response.ok){const data=await response.json();if(data===null||typeof data!=='object')throw Error('Invalid JSON response.');return data}
      if(response.status!==429&&response.status<500)throw Error('Coinbase public API returned HTTP '+response.status+'.');
      if(attempt===2)throw Error('Coinbase remained unavailable after three attempts (HTTP '+response.status+').');
    }
    await waiter(500*(attempt+1));
  }
}
async function collectMarketScan(getJSON,nowSeconds,onProgress=()=>{},protocol=null){
  const win=observationWindow(nowSeconds),products=[],pageIds=new Set();let pages=0,truncated=false;
  for(let page=0;page<20;page++){
    const data=await getJSON('/market/products?product_type=SPOT&limit=100&offset='+page*100);
    if(!Array.isArray(data.products))throw Error('Product listing response is malformed.');
    const ids=data.products.map(x=>x.product_id).join('|');if(data.products.length&&pageIds.has(ids))throw Error('Coinbase repeated a product page; scan cannot claim completeness.');pageIds.add(ids);products.push(...data.products);pages++;
    onProgress('Reading Coinbase products · page '+pages);
    // Stop on a short page, on an explicit last-page flag, or when the API ignored the limit and returned the full list.
    if(data.products.length<100||data.products.length>100||(data.pagination&&data.pagination.has_next===false))break;
    if(page===19)truncated=true;
  }
  const rows=marketRows(products),details=[],errors=[];
  for(const product of ['BTC-USD','ETH-USD','SOL-USD']){
    onProgress('Reading closed daily candles · '+product);
    try{
      const anchor=product==='BTC-USD'&&protocol?Date.parse(protocol.warmupStartInclusive)/1000:win.start;
      const end=product==='BTC-USD'&&protocol?Math.min(win.end,Date.parse(protocol.endExclusive)/1000):win.end;
      if(end<=anchor||end-anchor>1000*DAY)throw Error('Study data window is outside the supported range.');
      const gathered={candles:[]};
      for(let start=anchor;start<end;start+=200*DAY){
        const batchEnd=Math.min(end,start+200*DAY),data=await getJSON('/market/products/'+product+'/candles?start='+start+'&end='+(batchEnd-1)+'&granularity=ONE_DAY&limit=200');
        if(!Array.isArray(data.candles))throw Error('Malformed candles response.');
        // Filter each requested page explicitly; inclusive endpoints may repeat boundary bars.
        gathered.candles.push(...data.candles.filter(c=>Number(c.start)>=start&&Number(c.start)<batchEnd));
      }
      const normalized=normalizeCandles(gathered,end,(end-anchor)/DAY),bars=normalized.bars;
      if(bars[0].t!==anchor)throw Error('Fixed warm-up start is missing; signals suppressed.');
      const logReturns=bars.slice(-31).slice(1).map((b,i)=>Math.log(b.c/bars.slice(-31)[i].c)),m=logReturns.reduce((a,b)=>a+b,0)/logReturns.length;
      const volatility=Math.sqrt(logReturns.reduce((a,b)=>a+(b-m)**2,0)/Math.max(1,logReturns.length-1))*Math.sqrt(365.25);
      details.push({product,start:bars[0].d,end:bars.at(-1).d,bars:bars.length,lastClose:bars.at(-1).c,volatility30d:volatility,signals:product==='BTC-USD'?lockedSignals(bars):[],sourceCandles:bars,incompleteDiscarded:normalized.incomplete,contextOnly:product!=='BTC-USD'});
    }catch(e){errors.push({product,message:e.message})}
  }
  return {window:win,pages,truncated,rows,details,errors,complete:!truncated&&errors.length===0};
}
/* ============ end v7 market and evidence core ============ */

