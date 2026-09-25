
/* ============ storage ============ */
/* Hosted: owner-only artifact db. Each register entry and journal trade is
   its own document, keyed by a hash of its content, so two open tabs or
   devices can never overwrite each other's trials (whole-array writes were
   last-writer-wins). Fallbacks: localStorage, then the copy/paste box. */
let STORAGE_OK=false, STORE_KIND='none', DB=null, READY=false, STORE_VERIFIED=false;
const COLL={hyp:'fable_desk_hyp',trades:'fable_desk_trades'}, META='fable_desk_meta/state';
function fnv(str){let h1=0x811c9dc5,h2=0x01000193^0x5bd1e995;
  for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=Math.imul(h2^c,2654435761)}
  return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0')}
function canonicalEntry(x){if(Array.isArray(x))return x.map(canonicalEntry);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).filter(k=>k!=='_ts').sort().map(k=>[k,canonicalEntry(x[k])]));return x}
const hsig=h=>JSON.stringify(canonicalEntry(h));
const tsig=t=>JSON.stringify(canonicalEntry(t));
const SIG={hyp:hsig,trades:tsig};
const SAVED={hyp:new Set(),trades:new Set()};
const S={
  async probe(){
    try{
      if(window.claude&&typeof window.claude.use==='function'){
        const db=await window.claude.use('db');
        if(db){await db.doc(META).get();
          // Round-trip self-test: write, read back, delete. Only a verified store is used.
          const ref=db.collection('fable_desk_selftest').doc('probe-'+Math.random().toString(36).slice(2,10));
          await ref.set({t:Date.now()});const back=await ref.get();try{await ref.delete()}catch(e){}
          if(back.exists){DB=db;STORE_KIND='db';STORE_VERIFIED=true;return true}}
      }
    }catch(e){}
    try{localStorage.setItem('__el','1');localStorage.removeItem('__el');STORE_KIND='local';return true}catch(e){}
    return false;
  },
  async get(k,d){ if(!STORAGE_OK)return d;
    try{
      if(STORE_KIND==='db'){
        if(k==='budget'){const m=await DB.doc(META).get();return m.exists&&m.data().budget?JSON.parse(JSON.stringify(m.data().budget)):d}
        const q=await DB.collection(COLL[k]).limit(1000).get();
        const arr=q.docs.map(x=>JSON.parse(JSON.stringify(x.data())));
        arr.forEach(x=>SAVED[k].add(fnv(SIG[k](x))));
        arr.sort((x,y)=>(x._ts||0)-(y._ts||0));
        return arr.length?arr:d;
      }
      const r=localStorage.getItem('fable-desk:'+k);return r?JSON.parse(r):d }catch(e){return d} },
  async set(k,v){ if(!STORAGE_OK)return false;
    try{
      if(STORE_KIND==='db'){
        if(k==='budget'){await DB.doc(META).set({budget:JSON.parse(JSON.stringify(v))});return true}
        for(const x of v){const id=fnv(SIG[k](x)); if(SAVED[k].has(id))continue;
          if(!x._ts)x._ts=Date.now();
          await DB.collection(COLL[k]).doc(id).set(JSON.parse(JSON.stringify(x))); SAVED[k].add(id)}
        return true}
      localStorage.setItem('fable-desk:'+k,JSON.stringify(v));return true }
    catch(e){ const w=document.getElementById('storeWarn');
      if(w)w.innerHTML='<b>Save failed</b>'+(e&&e.code==='quota_exceeded'?'The saved register is full. Export a backup from the Register tab.':'The last change did not save. Export a backup from the Register tab before closing.');
      return false } },
  async clear(k){ if(!STORAGE_OK)return;
    if(STORE_KIND==='db'){const q=await DB.collection(COLL[k]).limit(1000).get();
      for(const x of q.docs)await DB.collection(COLL[k]).doc(x.id).delete(); SAVED[k].clear(); return}
    localStorage.setItem('fable-desk:'+k,'[]') }
};
/* File saves: hosted downloads capability first, plain link as fallback. */
async function saveFile(name,text,mime){
  try{ if(window.claude&&window.claude.use){const dl=await window.claude.use('downloads');
      if(dl){await dl.save({filename:name,data:new Blob([text],{type:mime})});return true}} }catch(e){ if(e&&e.code==='declined')return false }
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));
    a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true}catch(e){return false}
}
let HYP=[],TRADES=[],BUDGET=null,BARS=null,RUNNING=false;

/*@@CORE@@*//* ============ header ============ */
function refreshHeader(){
  const spent=spentTotal();
  document.getElementById('cN').textContent=spent;
  const cb=document.getElementById('cB'),cl=document.getElementById('cL');
  if(!BUDGET){cb.textContent='—';cl.textContent='—';cb.parentElement.className='cbox warn';return}
  const used=effTotal();
  cb.textContent=used.toFixed(0)+'/'+BUDGET.N;
  cb.parentElement.className='cbox '+(used>BUDGET.N?'over':'warn');
  cl.textContent=expMaxSR(1/BUDGET.years,Math.max(used,2)).toFixed(2);
}

/* ============ budget ============ */
document.getElementById('setBud').addEventListener('click',async()=>{
  const y=parseFloat(bY.value),sr=parseFloat(bSR.value),rho=parseFloat(bRho.value);
  if(!(y>0&&sr>0)){alert('Years and target Sharpe must be positive.');return}
  const N=budgetN(y,sr);
  const rawAllowed=rho>=1?N:Math.ceil((N-rho)/(1-rho));
  BUDGET={years:y,sr:sr,rho:rho,N:N,raw:rawAllowed};
  await S.set('budget',BUDGET); refreshHeader(); autoSaveIfNeeded();
  document.getElementById('budOut').innerHTML=`
    <div class="stats" style="margin-top:14px">
      <div class="st"><div class="v">${y}</div><div class="k">Years available</div></div>
      <div class="st"><div class="v ${N<20?'bad':''}">${N.toLocaleString()}</div><div class="k">Independent trials affordable</div></div>
      <div class="st"><div class="v">${rawAllowed.toLocaleString()}</div><div class="k">Raw configs at &rho;=${rho}</div></div>
      <div class="st"><div class="v">${mds80(y,1).toFixed(2)}</div><div class="k">Detectable Sharpe, 1 pre-registered test (80% power)</div></div>
      <div class="st"><div class="v">${mds80(y,Math.max(2,Math.min(N,45))).toFixed(2)}</div><div class="k">Detectable Sharpe, ${Math.max(2,Math.min(N,45))}-config sweep (conservative plan; correlated families do better)</div></div>
    </div>
    <div class="verdict ${N<20?'fail':(N<100?'weak':'pass')}">
      <b>${N<20?'Very tight budget':(N<100?'Tight budget':'Workable budget')}</b>
      With ${y} years of data, testing more than about <strong>${N.toLocaleString()} independent configurations</strong>
      means an annualized Sharpe of ${sr} becomes the <em>expected</em> result from pure luck — a strategy whose true
      out-of-sample Sharpe is zero. At an average correlation of ${rho} between parameter variants, that's roughly
      ${rawAllowed.toLocaleString()} raw configurations.
      ${N<20?' This is too little data to search at all. Get more history or raise your acceptance Sharpe.':''}
    </div>`;
});

/* ============ run ============ */
function render(res,dec,sw,trs,cfg,varSR,famN,label,rhoNow,X,sweep,bpy){
  const MX=moments(X&&X.length?X:[0]);
  const M=moments(trs.length?trs:[0]);
  const wins=trs.filter(t=>t>0).length;
  document.getElementById('resStats').innerHTML=`
    <div class="st"><div class="v">${trs.length}</div><div class="k">Trades</div></div>
    <div class="st"><div class="v">${trs.length?(wins/trs.length*100).toFixed(1):'0.0'}%</div><div class="k">Win rate</div></div>
    <div class="st"><div class="v ${M.m>0?'good':'bad'}">${(M.m*100).toFixed(2)}%</div><div class="k">Expectancy/trade</div></div>
    <div class="st"><div class="v ${MX.m>0?'good':'bad'}">${(MX.s?MX.m/MX.s*Math.sqrt(bpy):0).toFixed(2)}</div><div class="k">Drift-adjusted Sharpe (legacy, ann.)</div></div>
    <div class="st"><div class="v">${M.sk.toFixed(2)} / ${M.ku.toFixed(1)}</div><div class="k">Skew / kurtosis</div></div>
    <div class="st"><div class="v" style="font-size:12px;line-height:1.35">${label}</div><div class="k">Evaluated config</div></div>`;
  const pb=document.getElementById('pboBody'),dc=document.getElementById('decBody');
  if(!res){
    pb.innerHTML='<div class="empty">Need a family sweep (4+ configs) and 60+ bars to estimate PBO.</div>';
  } else {
    const cls=res.pbo>0.5?'hot':(res.pbo>0.15?'mid':'');
    document.getElementById('pboN').textContent=res.splits.toLocaleString()+' splits';
    pb.innerHTML=`<div class="gauge ${cls}"><i style="width:${(res.pbo*100).toFixed(0)}%"></i></div>
      <div class="kv"><span>PBO</span><span>${(res.pbo*100).toFixed(1)}%</span></div>
      <div class="kv"><span>Winner loses money OOS</span><span>${(res.negOOS*100).toFixed(1)}%</span></div>
      <div class="kv"><span>Configs in family</span><span>${sw}</span></div>
      <div class="cite" style="margin-top:8px">Fraction of splits where the in-sample winner lands in the bottom half out of sample. <strong>Read coarsely:</strong> on pure noise this statistic has a standard deviation of about 0.20, so a single reading is ±0.4 at 95%. Above 0.5 is bad news; below 0.15 is good news; the middle is uninformative, and more data does not narrow it.</div>`;
  }
  if(!dec){dc.innerHTML='<div class="empty">Needs a family sweep and 60+ bars.</div>';}
  else{
    if(dec.isSR<=0){
      dc.innerHTML=`<div class="kv"><span>Sharpe, first half (selected here)</span><span>${dec.isSR.toFixed(4)}</span></div>
        <div class="kv"><span>Sharpe, later blocks (mean)</span><span>${dec.osSR.toFixed(4)}</span></div>
        <div class="cite" style="margin-top:8px">Retention is not meaningful here — the best configuration in the first half already had a negative Sharpe, so there is nothing to decay from. The family has no in-sample edge to begin with.</div>`;
    } else {
    const ratio=dec.osSR/dec.isSR;
    const g=ratio<0.4?'hot':(ratio<0.7?'mid':'');
    dc.innerHTML=`<div class="gauge ${g}"><i style="width:${Math.min(100,Math.max(0,ratio*100)).toFixed(0)}%"></i></div>
      <div class="kv"><span>Sharpe, first half (selected here)</span><span>${dec.isSR.toFixed(4)}</span></div>
      <div class="kv"><span>Sharpe, later blocks (mean)</span><span>${dec.osSR.toFixed(4)}</span></div>
      <div class="kv"><span>Retention</span><span>${(ratio*100).toFixed(0)}%</span></div>
      <div class="cite" style="margin-top:8px">Time-ordered, unlike PBO. A real edge keeps most of its Sharpe forward in time. Collapse means the effect belonged to a regime that ended. Above 100% means it did better later, which at these sample sizes is usually noise. Computed on the legacy drift-adjusted return stream.</div>`;
    }
  }
  // equity curve
  const cv=document.getElementById('eq'),dpr=devicePixelRatio||1,w=cv.clientWidth,h=180;
  cv.width=w*dpr;cv.height=h*dpr;const x=cv.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);
  let eq=1;const cur=[1];trs.forEach(t=>{eq*=(1+t);cur.push(eq)});
  const mn=Math.min(...cur,0.9),mx=Math.max(...cur,1.1),Y=v=>h-12-((v-mn)/(mx-mn))*(h-26);
  x.strokeStyle='#2E3136';x.beginPath();x.moveTo(0,Y(1));x.lineTo(w,Y(1));x.stroke();
  x.strokeStyle='#C7CACF';x.lineWidth=1.8;x.beginPath();
  cur.forEach((v,i)=>{const px=(i/Math.max(1,cur.length-1))*(w-6)+3;i?x.lineTo(px,Y(v)):x.moveTo(px,Y(v))});
  x.stroke();
  x.font='10px JetBrains Mono';x.fillStyle='#8E9196';x.fillText('closed trades only · legacy model, '+label,8,14);
  // verdict
  const v=document.getElementById('verdict');
  const n=trs.length;
  if(n<10){v.className='verdict weak';
    v.innerHTML=`<b>Not enough trades</b>${n} trades cannot support any conclusion. Widen the rule or get more data.`;return}
  const sr=MX.s?MX.m/MX.s:0;   // per bar, drift-adjusted: timing skill only
  const T=X.length,years=T/bpy,annSR=sr*Math.sqrt(bpy);
  const spent=spentTotal();
  const synth=DATA_TAG==='synthetic';
  const effAll=synth?effN(sw,rhoNow):effTotal();
  // A single configuration that is the ONLY trial ever run on this dataset is
  // no deflation in the legacy formula. It is not verified pre-registration.
  const prereg=!sweep&&effAll<=1.0001;
  const used=prereg?1:Math.max(effAll,2);
  const sr0=prereg?0:(varSR!=null?expMaxSR(varSR,used):null);
  const dsr=sr0!=null?psr(sr,sr0,T,MX.sk,MX.ku):null;
  const over=BUDGET&&!synth&&effTotal()>BUDGET.N;
  // Conditional on the luck threshold actually observed for this family. In simulation
  // this matched: sweep winners at annual SR ~1.1 were detected 12/14, at 0.70 3/14.
  const mds=(sr0!=null&&!prereg)?sr0*Math.sqrt(bpy)+ZPOW*Math.sqrt(1/years):mds80(years,used);
  const powerLine=`<br><br><em>Power: with ${years.toFixed(1)} years and ${used.toFixed(1)} effective trial${used>1.05?'s':''}, this test detects an annualized excess Sharpe of about <strong>${mds.toFixed(2)}</strong> or more with ~80% probability. The evaluated config scored <strong>${annSR.toFixed(2)}</strong>.${annSR>0&&annSR<mds?' A real edge of this size would usually fail here — read a fail as "unproven," not "disproven."':''}</em>`;
  if(dsr===null||!isFinite(dsr)){v.className='verdict weak';
    v.innerHTML=`<b>Deflated Sharpe not computable</b>${!sweep?`This dataset already has ${effAll.toFixed(1)} effective trials logged, so a single config can't be judged without the spread of the family it was chosen from. Run the sweep — or test it as a pre-registered hypothesis on data you haven't searched yet (e.g. a new asset or a later date range).`:'Fewer than 4 configurations produced 5+ trades, so there is no family spread to deflate against.'} PBO and retention above are still readable.`+powerLine;return}
  const head=prereg?`First recorded single test; no deflation. This app did not verify pre-registration or earlier research history. `:'';
  // The Deflated Sharpe decides. PBO and forward retention are shown as warnings,
  // not vetoes: in simulation (audit pass 6) the DSR alone passed 0 of 95 null
  // series (plain and fat-tailed GARCH, with BTC-like drift), while the two vetoes
  // cut detection of a real Sharpe-1.05 edge from 19/25 to 1/25 — PBO ranks
  // configs that all share an edge essentially at random.
  const warn=[];
  if(res&&res.pbo>0.5)warn.push(`PBO is ${(res.pbo*100).toFixed(0)}%: the in-sample winner usually isn't the out-of-sample winner. Common when every config shares the same edge; also common for pure noise. Prefer a simpler config from the family over the exact winner.`);
  if(dec&&dec.isSR>0&&dec.osSR<dec.isSR*0.4)warn.push(`Forward retention is ${(dec.osSR/dec.isSR*100).toFixed(0)}%: the family did much worse in the later half of the data. The edge may be fading — confirm on data after ${BARS&&BARS[BARS.length-1].d?BARS[BARS.length-1].d:'this sample'} before sizing up.`);
  const warnHtml=warn.length?`<br><br><strong>Warnings:</strong> ${warn.join(' ')}`:'';
  if(dsr>=0.95&&!over){v.className=warn.length?'verdict weak':'verdict pass';
    v.innerHTML=`<b>Survives deflation${warn.length?' — with warnings':''}</b>${head}Deflated Sharpe ${dsr.toFixed(3)} ≥ 0.95 on ${T.toLocaleString()} bars of drift-adjusted returns (not direct buy-and-hold excess), after ${spent} configurations searched on real data (${used.toFixed(1)} effective on this dataset at measured correlation), skew ${MX.sk.toFixed(2)}, kurtosis ${MX.ku.toFixed(1)}. Annualized excess Sharpe ${annSR.toFixed(2)} against a luck threshold of ${(sr0*Math.sqrt(bpy)).toFixed(2)}. Research result only: verify prior trials, next-open execution and a genuinely locked holdout before any live pilot.${warnHtml}`;}
  else{v.className='verdict fail';
    v.innerHTML=`<b>Indistinguishable from luck</b>${head}Deflated Sharpe ${dsr.toFixed(3)}, below the 0.95 bar. Annualized excess Sharpe ${annSR.toFixed(2)} against a luck threshold of ${(sr0*Math.sqrt(bpy)).toFixed(2)}.${over?' You are also over budget — every further trial raises this bar.':''} Log the kill.${warnHtml}`;}
  v.innerHTML+=powerLine;
}

async function doRun(sweep){
  if(RUNNING)return;
  if(!READY){alert('Still loading your saved register — try again in a moment.');return}
  if(!BARS){alert('Load or generate data first.');return}
  const st=document.getElementById('strat').value;
  const cfg={tgt:parseFloat(tgt.value)/100,stp:parseFloat(stp.value)/100,
             hold:parseInt(hold.value),cost:parseFloat(cost.value)/100,mode:document.getElementById('xmode').value};
  if(![cfg.tgt,cfg.stp,cfg.hold,cfg.cost].every(v=>isFinite(v)&&v>=0)||!(cfg.stp>0)||!(cfg.hold>=1)){alert('Exit settings must be positive numbers.');return}
  const why=document.getElementById('note').value.trim();
  if(!why){alert('State the mechanism first. That field is the whole point.');return}
  let p=readParams();
  try{validateStrategy(st,p)}catch(e){alert(e.message);return}
  if(!Number.isInteger(fieldNumber('hold'))||cfg.stp>=1||cfg.cost>=1||cfg.tgt<=0){alert('Use a whole-number hold, stop/cost below 100%, and a positive target.');return}
  const fam=sweep?sweepSet(st):[p];
  // Every statistic runs on the same drift-adjusted per-bar stream.
  RUNNING=true;const controls=[...document.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
  try{
  const E=fam.map(q=>barX(BARS,st,q,cfg));
  const act=E.filter(e=>e.n>0).map(e=>e.x);
  const res=act.length>=4?cscvPBO(act,12):null;
  const rho=avgCorr(act);
  const dec=act.length>=4?decayTest(act,8):null;
  const famSR=E.filter(e=>e.n>=5).map(e=>sharpe(e.x));
  const varSR=famSR.length>=4?Math.pow(moments(famSR).s,2):null;
  // Judge the config the search selected: best excess Sharpe among configs with
  // 10+ trades (the verdict's minimum); fall back to 5+ if none reach 10.
  let bi=0;
  if(sweep){const pick=min=>{let k=-1,bs=-Infinity;E.forEach((e,i)=>{if(e.n>=min){const v=sharpe(e.x);if(v>bs){bs=v;k=i}}});return k};
    bi=pick(10);if(bi<0)bi=pick(5);if(bi<0)bi=0;p=fam[bi];}
  const W=E[bi],label=(sweep?'sweep winner ':'')+Object.entries(p).map(([k,v])=>k+'='+v).join(' ');
  const bpy=barsPerYear(BARS),annSR=sharpe(W.x)*Math.sqrt(bpy);
  HYP.push({id:'T-'+String(HYP.length+1).padStart(3,'0')+'-'+Math.random().toString(36).slice(2,6),t:new Date().toISOString().slice(0,10),
    st:st,p:p,spent:fam.length,why:why,n:W.n,
    sr:W.n?annSR.toFixed(3):null,srBasis:'annualized excess-vs-hold, per bar',pbo:res?res.pbo.toFixed(3):null,
    ret:dec&&dec.isSR>0?(dec.osSR/dec.isSR).toFixed(2):null,
    rho:+rho.toFixed(3),data:DATA_TAG,cfg:cfg,provenance:CURRENT_DATA_META});
  if(DATA_TAG!=='synthetic')recordResearch('legacy-evaluation',{summary:st+' · '+fam.length+' configurations · exploratory only',tag:DATA_TAG,params:fam,cfg,provenance:CURRENT_DATA_META});
  await S.set('hyp',HYP);refreshHeader();renderHyp();autoSaveIfNeeded();
  document.getElementById('resCard').style.display='block';
  render(res,dec,fam.length,W.tr,cfg,varSR,famSR.length,label,rho,W.x,sweep,bpy);
  document.getElementById('resCard').scrollIntoView({behavior:'smooth',block:'start'});
  }finally{RUNNING=false;controls.forEach(([el,disabled])=>el.disabled=disabled)}
}

/* ============ Kelly ============ */
document.getElementById('runKelly').addEventListener('click',()=>{
  const w=parseInt(kW.value),n=parseInt(kN.value),b=parseFloat(kR.value),C=parseFloat(kC.value);
  if(!(n>0&&w>=0&&w<=n&&b>0)){alert('Check the inputs.');return}
  const Z=1.96,ph=w/n,d=1+Z*Z/n;
  const ctr=(ph+Z*Z/(2*n))/d, hw=(Z/d)*Math.sqrt(ph*(1-ph)/n+Z*Z/(4*n*n));
  const lo=Math.max(0,ctr-hw);
  const kel=p=>p-(1-p)/b;
  const kPoint=kel(ph),kLower=kel(lo);
  const g=(p,f)=>f<=0?0:p*Math.log(1+f*b)+(1-p)*Math.log(1-f);
  document.getElementById('kOut').innerHTML=`
    <div class="stats" style="margin-top:14px">
      <div class="st"><div class="v">${(ph*100).toFixed(1)}%</div><div class="k">Observed win rate</div></div>
      <div class="st"><div class="v">${(lo*100).toFixed(1)}%</div><div class="k">95% CI lower bound</div></div>
      <div class="st"><div class="v ${kPoint<=0?'bad':''}">${(Math.max(0,kPoint)*100).toFixed(1)}%</div><div class="k">Kelly on point estimate</div></div>
      <div class="st"><div class="v ${kLower<=0?'bad':'good'}">${(Math.max(0,kLower)*100).toFixed(1)}%</div><div class="k">Kelly on lower bound</div></div>
    </div>
    ${kLower<=0?`<div class="verdict fail"><b>No size is justified</b>At the lower bound of your confidence interval (${(lo*100).toFixed(1)}%) this rule has no edge at ${b}:1. ${n} trades is not enough to rule that out. Trade minimum size for information, not for return.</div>`
    :`<div class="verdict pass"><b>Size on the lower bound</b>The fixed-outcome model yields <strong>${(Math.max(0,kLower)/2*100).toFixed(1)}% of capital</strong> at risk per trial — half-Kelly computed on the CI lower bound, i.e. ${(C*Math.max(0,kLower)/2).toFixed(0)} dollars of ${C.toLocaleString()}.
      <div class="kv" style="margin-top:8px"><span>Growth at full Kelly if you're right</span><span>${(g(ph,kPoint)*100).toFixed(3)}%/trade</span></div>
      <div class="kv"><span>Growth at full Kelly if true p is 3pts lower</span><span style="color:${g(ph-0.03,kPoint)<0?'var(--kill)':'inherit'}">${(g(ph-0.03,kPoint)*100).toFixed(3)}%/trade</span></div>
      <div class="kv"><span>Growth at half-Kelly if true p is 3pts lower</span><span style="color:${g(ph-0.03,kPoint/2)<0?'var(--kill)':'var(--live)'}">${(g(ph-0.03,kPoint/2)*100).toFixed(3)}%/trade</span></div>
      <div class="cite" style="margin-top:8px">Half-Kelly keeps about 75% of the growth and roughly quarters the damage when your win-rate estimate is too high. Overbetting an edge you don't have is the fastest way to lose an account that had one.</div></div>`}`;
});

/* ============ registers ============ */
function renderHyp(){
  const el=document.getElementById('hypList');
  if(!HYP.length){el.innerHTML='<div class="empty">No trials spent yet.</div>';return}
  const spent=HYP.reduce((a,h)=>a+(h.spent||1),0);
  el.innerHTML=`<div class="note" style="margin:0 0 10px;padding:0">Configurations spent including sweeps: <strong>${spent}</strong></div>
   <table><thead><tr><th>ID</th><th>Date</th><th>Rule</th><th class="n">Configs</th><th class="n">n</th><th class="n">SR</th><th class="n">PBO</th><th class="n">Ret</th></tr></thead><tbody>`+
   HYP.slice().reverse().map(h=>`<tr><td class="n">${htmlSafe(h.id)}</td><td class="n">${htmlSafe(h.t)}</td>
     <td>${htmlSafe(h.st.toUpperCase())} ${htmlSafe(Object.entries(h.p).map(([k,v])=>k+'='+v).join(' '))}<br>
     <span style="color:var(--muted);font-size:11.5px">${htmlSafe(h.why.slice(0,80))}${h.why.length>80?'…':''}</span></td>
     <td class="n">${h.spent||1}${h.data==='synthetic'?'<br><span style="color:var(--muted);font-size:10.5px">practice</span>':''}</td><td class="n">${h.n}</td><td class="n">${h.sr??'—'}${h.sr!=null&&!String(h.srBasis||'').startsWith('annualized')?'<span title="older entry: per-trade Sharpe, not comparable" style="color:var(--muted)">*</span>':''}</td>
     <td class="n">${h.pbo??'—'}</td><td class="n">${h.ret??'—'}</td></tr>`).join('')+'</tbody></table>';
}
function renderJrn(){
  const st=document.getElementById('jStats'),tb=document.getElementById('jTable'),vd=document.getElementById('jVerdict');
  if(!TRADES.length){st.innerHTML='';tb.innerHTML='<div class="empty">No live trades logged.</div>';vd.innerHTML='';return}
  const n=TRADES.length,w=TRADES.filter(t=>t.pnl>0).length;
  const pnl=TRADES.reduce((a,t)=>a+t.pnl,0),slip=TRADES.reduce((a,t)=>a+t.slip,0)/n;
  const Z=1.96,ph=w/n,d=1+Z*Z/n,ctr=(ph+Z*Z/(2*n))/d,
        hw=(Z/d)*Math.sqrt(ph*(1-ph)/n+Z*Z/(4*n*n));
  const lo=Math.max(0,ctr-hw),hi=Math.min(1,ctr+hw);
  st.innerHTML=`<div class="st"><div class="v">${n}</div><div class="k">Trades</div></div>
    <div class="st"><div class="v">${(ph*100).toFixed(1)}%</div><div class="k">Win rate</div></div>
    <div class="st"><div class="v ${pnl>=0?'good':'bad'}">$${pnl.toFixed(0)}</div><div class="k">Net P&amp;L</div></div>
    <div class="st"><div class="v ${slip<=0.1?'good':'bad'}">${slip.toFixed(2)}%</div><div class="k">Avg slippage</div></div>`;
  tb.innerHTML=`<table><thead><tr><th>Date</th><th>Symbol</th><th>Trial</th><th class="n">Slip %</th><th class="n">P&amp;L</th></tr></thead><tbody>`+
    TRADES.slice().reverse().map(t=>`<tr><td class="n">${htmlSafe(t.d)}</td><td>${htmlSafe(t.sym)}</td><td class="n">${htmlSafe(t.rule||'—')}</td>
      <td class="n" style="color:${t.slip>0.2?'var(--kill)':'inherit'}">${t.slip.toFixed(2)}</td>
      <td class="n" style="color:${t.pnl>=0?'var(--live)':'var(--kill)'}">$${t.pnl.toFixed(0)}</td></tr>`).join('')+'</tbody></table>';
  // Win rate alone can't judge a rule whose wins and losses differ in size
  // (a 40% trend rule at 3:1 is profitable). Judge per-trade expectancy.
  const rs=TRADES.filter(t=>isFinite(t.ret)).map(t=>t.ret),nr=rs.length;
  const mr=nr?rs.reduce((a,b)=>a+b,0)/nr:0,sr_=nr>1?Math.sqrt(rs.reduce((a,b)=>a+(b-mr)**2,0)/(nr-1)):0;
  const eLo=mr-1.96*sr_/Math.sqrt(Math.max(nr,1)),eHi=mr+1.96*sr_/Math.sqrt(Math.max(nr,1));
  const ex=`Expectancy ${(mr*100).toFixed(2)}%/trade, 95% CI ${(eLo*100).toFixed(2)}% to ${(eHi*100).toFixed(2)}% over ${nr} trades with recorded size. Win rate ${(ph*100).toFixed(1)}% (CI ${(lo*100).toFixed(1)}–${(hi*100).toFixed(1)}%) is shown for reference only.`;
  vd.className='verdict '+(nr<30?'weak':(eLo>0?'pass':'fail'));
  vd.innerHTML=nr<30?`<b>Too early to read</b>${ex}`:(eLo>0?`<b>Positive expectancy, not proof</b>${ex}`:`<b>Indistinguishable from zero</b>${ex} Average adverse slippage ${slip.toFixed(2)}% is the first thing to attack.`);
  return;
  vd.innerHTML=n<30?`<b>Too early to read</b>${n} trades. CI is ${(lo*100).toFixed(1)}%–${(hi*100).toFixed(1)}% — wide enough to contain almost anything.`
   :(lo>0.5?`<b>Signal, not proof</b>CI ${(lo*100).toFixed(1)}%–${(hi*100).toFixed(1)}% sits above a coin flip over ${n} trades.`
   :`<b>Indistinguishable from chance</b>CI ${(lo*100).toFixed(1)}%–${(hi*100).toFixed(1)}% includes 50%. Average slippage of ${slip.toFixed(2)}% is the first thing to attack.`);
}

/* ============ doc ============ */
document.getElementById('docBody').innerHTML=`<div class="verdict weak"><b>v6 corrections</b>The historical notes below describe the legacy engine. Its stream is r(t) − exposure(t) × full-sample average asset return; it is not the account return minus buy-and-hold. The first recorded run is not verified pre-registration. Trial labels do not capture all overlapping data searches. Execution and Capital plan are separate diagnostics, without a calibrated edge verdict. Read RESEARCH-REVIEW.md for the remaining limitations.</div>
<p class="hint" style="margin-bottom:16px">Version 2 replaced three things v1 got wrong. A subsequent audit found three more — two bugs in v2 itself and one overstated claim. All are fixed below and the corrections are listed at the bottom, because a tool about self-deception should show its own.</p>
<div class="kv"><span><strong>1. A budget replaces unlimited search</strong></span><span>new</span></div>
<p class="hint" style="margin:6px 0 14px">The number of configurations you can afford is fixed by how much data you have. Five years supports about 45 independent trials before a fake annualized Sharpe of 1 becomes the expected result. Three years supports 13. Set the budget first; it converts "search until something works" into a finite resource you spend deliberately.</p>
<div class="kv"><span><strong>2. Deflated Sharpe replaces Bonferroni</strong></span><span>corrected</span></div>
<p class="hint" style="margin:6px 0 14px">Dividing α by the trial count is too blunt and ignores how dispersed your results were, how long the sample is, and how fat-tailed the returns are. The Deflated Sharpe Ratio folds in all four: trials, dispersion, sample length, skew and kurtosis. The bar is DSR ≥ 0.95.</p>
<div class="kv"><span><strong>3. PBO replaces the single holdout — but read it coarsely</strong></span><span>corrected</span></div>
<p class="hint" style="margin:6px 0 14px">A 70/30 split evaluates your rule as if one trial had taken place. Run holdout twenty times and false positives stop being unlikely — they're expected. Combinatorially symmetric cross-validation runs 924 partitions and asks how often the in-sample winner lands in the bottom half out of sample.<br><br><strong>The audit's most important finding:</strong> across 100 independent all-noise datasets, PBO averaged 0.52 as theory predicts, but with a standard deviation of <strong>0.20</strong> and a 5th–95th range of 0.15–0.82. A single reading is ±0.4 at 95% confidence, and <em>more data does not narrow it</em> — the spread was unchanged from 600 to 5,000 bars. Roughly one pure-noise run in eight scored below 0.25. Power is also weak: against a small real edge (0.05σ per bar) PBO dropped below 0.25 only 23% of the time. Treat it as a coarse filter — above 0.5 is bad news, below 0.15 is good news, the middle tells you nothing — and let the Deflated Sharpe carry the actual decision.</p>
<div class="kv"><span><strong>4. Two failure modes, two tests</strong></span><span>new</span></div>
<p class="hint" style="margin:6px 0 14px">Selection bias and regime decay are different problems. A strategy fitted to a period that has ended <em>passes</em> PBO — the effect was genuinely there — but its Sharpe collapses from in-sample to out-of-sample. Selection bias is fixed by testing fewer things. Regime decay cannot be fixed, only detected, which is why both readings appear side by side.</p>
<div class="kv"><span><strong>5. Size on the lower bound</strong></span><span>new</span></div>
<p class="hint" style="margin:6px 0 14px">Kelly assumes you know your win rate. You have an estimate with a confidence interval. If your true win rate is three points below your estimate, full Kelly turns positive growth negative while half-Kelly stays positive — so the sizing tab computes Kelly on the CI lower bound and then halves it.</p>
<div class="kv"><span><strong>6. When to stop searching</strong></span><span>rule</span></div>
<p class="hint" style="margin:6px 0 14px">From the optimal-stopping literature: sample about 37% of the configurations you can theoretically justify, measure them, then keep going only until you find one that beats all of those. That one is your candidate. It bounds the search without requiring you to guess in advance.</p>
<div class="kv"><span><strong>Audit corrections to v2 itself</strong></span><span>fixed</span></div>
<p class="hint" style="margin:6px 0 14px"><strong>(a) The Deflated Sharpe used the wrong variance.</strong> V[{SR}] must be the observed dispersion of Sharpe ratios <em>across the configurations you searched</em>. I had used 1/n, the null variance of a single estimate. On the source paper's own example that substitution returns DSR = 0.9933 — accepting a strategy the authors reject at 0.9004. It now uses the family's empirical dispersion, in per-trade units to match, and reports "not computable" for a single configuration rather than inventing a number.<br><br>
<strong>(b) Sharpe of a zero-variance series returned 1e10.</strong> A configuration that never traded, or returned the same value every time, scored as astronomically good and could win the in-sample selection inside PBO. It now returns zero.<br><br>
<strong>(c) The effective-trials formula is genuinely uncertain.</strong> The source equation was unreadable in the PDF. Two interpolations satisfy both stated limits — linear and a power law — and they disagree enormously: at 500 trials with correlation 0.9, linear gives 51 effective trials and the power law gives 1.9. The published figure supports linear, and linear is also the conservative choice (more effective trials, higher bar), so that is what runs here. Flagged rather than hidden.</p>
<div class="kv"><span><strong>Audit pass 3 (Sept 2026)</strong></span><span>fixed</span></div>
<p class="hint" style="margin:6px 0 14px"><strong>(d) The verdict crashed.</strong> The final verdict referenced a variable that only existed inside the run function, so every sweep with 20+ trades threw an error before any Deflated Sharpe verdict rendered. <strong>(e) Sweeps judged the wrong config.</strong> The verdict evaluated whatever was typed in the form, not the configuration the sweep selected. It now evaluates the sweep winner — best per-trade Sharpe among configs with 20+ trades, the verdict's own minimum — and names it. <strong>(f) Importing a backup could lose trials.</strong> Entries were merged by ID, and every session numbered from T-001, so a merge could drop real trials and understate the deflation count. It now merges on full content and IDs are unique. <strong>(g) Smaller:</strong> default cost raised to 0.8% round trip (verified maker rate), stop fills respect gap opens, PBO uses mid-rank on ties, and the live journal now judges expectancy, not win rate. <strong>(h) Power.</strong> Simulation shows that at ~35 trades the Deflated Sharpe almost never accepts, even for a very strong injected edge; it needs hundreds of trades. Fail verdicts under 100 trades now say "unproven," not "disproven."</p>
<div class="kv"><span><strong>Audit pass 4 (Sept 2026)</strong></span><span>fixed</span></div>
<p class="hint" style="margin:6px 0 14px"><strong>(i) Correlation was guessed, not measured.</strong> Effective trials used a typed-in 0.7; measured correlation across BTC sweep families was 0.20–0.25, so a 45-config MA sweep counted as 14 effective trials instead of 34 — a bar less than half as high as it should be. It is now measured per sweep and summed per entry. <strong>(j) Practice runs burned the real budget.</strong> Synthetic-data trials now show as practice and don't count against real data. <strong>(k) Two open tabs could overwrite each other's trials.</strong> Each trial is now its own saved record. <strong>(l) Runs started before the saved register loaded could be wiped by it.</strong> Runs now wait. <strong>(m) Quoted CSV numbers with thousands separators</strong> ("1,050") parsed silently as 100; fixed. <strong>(n) Exit rule.</strong> A fixed 10% target cuts off the large winners trend rules exist to catch; signal-off exits with a 10% stop are now the default (tested on synthetic data with a known edge, not tuned on BTC). Choosing an exit rule is itself a trial and is logged with each entry. <strong>(o) The test rewarded drift, not timing.</strong> This was present in every earlier version and hidden by the fixed 10% target. On simulated series with BTC-like drift and no timing edge, the verdict passed 59% of the time. Trades are now judged against simply holding the asset for the same number of bars: 0 false passes in 120 drifting series, and 16 of 60 detections for a strong real timing edge. <strong>Buy-and-hold is now the benchmark every rule has to beat.</strong></p>
<div class="kv"><span><strong>Audit pass 5 (Sept 2026)</strong></span><span>fixed</span></div>
<p class="hint" style="margin:6px 0 14px"><strong>(p) Power is now reported, not hidden.</strong> Power is set by years of data and how many things you searched — not by the statistic. Measuring per bar instead of per trade gave the same power in simulation (16% vs 18% on a strong planted edge) but far more stable skew and kurtosis estimates (3,400 observations instead of ~30), so every statistic now runs on the same drift-adjusted per-bar stream. Every verdict now states the smallest annualized excess Sharpe it could detect with ~80% probability. On 9.3 years of BTC: <strong>0.81 for one pre-registered test, about 1.75 for any sweep</strong>. <strong>(q) First recorded tests.</strong> A single configuration that is the first recorded trial on a data label gets no deflation in the legacy engine. This does not verify that the hypothesis was pre-registered, that the register is complete, or that overlapping datasets were not searched. <strong>(r) Trials now count per dataset</strong> (entries from before tagging count as bundled BTC, where they were run). <strong>(s) Input validation</strong> on exit and strategy fields. <strong>(u) PBO and forward retention no longer veto.</strong> The Deflated Sharpe alone passed 0 of 95 null series in simulation (plain and fat-tailed, with BTC-like drift), while the two vetoes cut detection of a real Sharpe-1.05 edge from 19 of 25 to 1 of 25. They now appear as warnings on the verdict. <strong>(v) Breakout exits.</strong> The breakout signal was an event (true only on the breakout bar), so signal-off exits closed every breakout the next day. It is now a Donchian channel state: on at a close above the prior N-bar high, off at a close below the prior N/2-bar low. <strong>(w) Legacy default cost 1.0% round trip</strong> — an inherited assumption, not a verified current account fee. The official help page requires checking the signed-in fee tier and order preview. Immediate fills use taker fees. <strong>(x) Cloud save self-test</strong> on load. <strong>(t) The 20-trade minimum was destroying power.</strong> Signal-off exits hold strong trends for a long time, so strong edges produce <em>fewer</em> trades; in simulation 74% of runs with a strong planted edge had under 20 trades and were thrown out (8% detected). The statistic is per bar now, so the minimum is 10 trades: 72% detected, still 0 of 100 false passes.</p>
<div class="note">Sources: Bailey &amp; López de Prado, <em>The Deflated Sharpe Ratio</em> (J. Portfolio Management, 2014); Bailey, Borwein, López de Prado &amp; Zhu, <em>Pseudo-Mathematics and Financial Charlatanism</em> (Notices of the AMS, 2014) and <em>The Probability of Backtest Overfitting</em> (J. Computational Finance, 2017). This tool measures; it does not predict, and it is not financial advice.</div>`;

/* ============ wiring ============ */
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-selected','false'));
  b.setAttribute('aria-selected','true');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('p-'+b.dataset.p).classList.add('on')}));
document.getElementById('strat').addEventListener('change',drawParams);
document.getElementById('run').addEventListener('click',()=>doRun(false));
document.getElementById('runSweep').addEventListener('click',()=>doRun(true));
document.getElementById('jumpSolCsv').addEventListener('click',()=>{
  const det=document.querySelector('details'); if(det)det.open=true;
  document.getElementById('csv').placeholder='Paste SOL-USD daily OHLC here. From CryptoDataDownload, TradingView, or Kraken export — export needs dated, complete OHLC columns.';
  document.getElementById('csv').scrollIntoView({behavior:'smooth',block:'center'});
  document.getElementById('csv').focus();
});
document.getElementById('loadBundled').addEventListener('click',()=>{
  BARS=bundledBars();DATA_TAG='BTC-USD daily (bundled)';
  const issues=validateBars(BARS,86400);
  const years=((BARS[BARS.length-1].t-BARS[0].t)/31557600).toFixed(1);
  const budget=budgetN(parseFloat(years),BUDGET?BUDGET.sr:1);
  document.getElementById('fetchOut').innerHTML=`<div class="verdict ${issues.length?'weak':'pass'}">
    <b>${BARS.length} bars loaded</b>BTC/USD daily, ${BARS[0].d} to ${BARS[BARS.length-1].d} — ${years} years.
    ${issues.length?'<br><br><strong>Warnings:</strong> '+issues.join('; ')+'.':'<br><br>Integrity checks passed: high/low bracket open/close on every bar, no duplicates, no gaps.'}
    <br><br>Your budget at this history: <strong>${budget.toLocaleString()} independent configurations</strong> at a target Sharpe of ${BUDGET?BUDGET.sr:1}. Set it on the Budget tab before testing.
    <br><br><em>This series ends April 2024. Later data is a holdout only if neither you nor prior research used it to select the rule. Freeze the full protocol before opening it.</em></div>`;
  document.getElementById('dataInfo').innerHTML=`<strong>${BARS.length} bars loaded</strong> — BTC/USD, ${BARS[0].d} to ${BARS[BARS.length-1].d}.`;
});
document.getElementById('fetchData').addEventListener('click',async()=>{
  const btn=document.getElementById('fetchData'),out=document.getElementById('fetchOut');
  const pair=dPair.value,gran=parseInt(dGran.value),want=parseInt(dDays.value);
  BARS=null;DATA_TAG=null;btn.disabled=true; out.innerHTML='<div class="note">Contacting Coinbase…</div>';
  try{
    const b=await fetchCandles(pair,gran,want,(got,i,tot)=>{
      out.innerHTML=`<div class="note">Fetched <strong>${got}</strong> bars — request ${i} of ${tot}…</div>`});
    if(b.length<60)throw new Error(`Only ${b.length} bars returned — not enough to test on.`);
    const issues=validateBars(b,gran);if(issues.length)throw Error(issues.join('; '));
    BARS=b;DATA_TAG=pair+' '+gran+'s';
    const years=(b.length*gran/31557600).toFixed(2);
    out.innerHTML=`<div class="verdict ${issues.length?'weak':'pass'}">
      <b>${b.length} bars loaded</b>${pair}, ${b[0].d} to ${b[b.length-1].d} — about ${years} years.
      ${issues.length?'<br><br><strong>Data warnings:</strong> '+issues.join('; ')+'. Gaps are normal around exchange outages; impossible OHLC values are not and mean you should not trust this series.'
        :'<br><br>Integrity checks passed: high/low bracket open/close on every bar, no duplicates, no gaps.'}
      ${gran>=86400?`<br><br>At ${years} years your search budget is <strong>${budgetN(Math.max(parseFloat(years),0.25),BUDGET?BUDGET.sr:1)} independent configurations</strong> at a target Sharpe of ${BUDGET?BUDGET.sr:1}. Set it on the Budget tab before you start testing.`:''}
    </div>`;
    document.getElementById('dataInfo').innerHTML=`<strong>${b.length} bars</strong> — ${pair}, ${b[0].d} to ${b[b.length-1].d}.`;captureDataset('fetch');
  }catch(e){
    out.innerHTML=`<div class="verdict fail"><b>Fetch failed</b>${htmlSafe(e.message)}<br><br>Previous data retained. Use the launcher (START-WINDOWS.bat / START-MAC-LINUX.sh) for live data, check the Live market strip for the connection diagnosis, or paste a CSV below.</div>`;
  }finally{btn.disabled=false}
});
document.getElementById('loadBundled').addEventListener('click',()=>captureDataset('bundled'));
document.getElementById('loadCsv').addEventListener('click',()=>captureDataset('csv'));
document.getElementById('genData').addEventListener('click',()=>{CURRENT_DATA_META=null});
document.getElementById('dlCsv').addEventListener('click',()=>{
  if(!BARS){alert('No data loaded yet.');return}
  saveFile('ohlc.csv',toCsv(BARS),'text/csv');
});
document.getElementById('genData').addEventListener('click',()=>{BARS=synth(900);DATA_TAG='synthetic';
  document.getElementById('dataInfo').innerHTML='<strong>900 synthetic bars loaded.</strong> Driftless random walk — no edge exists here. Anything you find is noise, which makes it the safest place to learn the workflow.'});
document.getElementById('loadCsv').addEventListener('click',()=>{
  try{
    BARS=null;DATA_TAG=null;
    BARS=parseCsv(document.getElementById('csv').value);
    DATA_TAG='csv '+BARS[0].d+'..'+BARS[BARS.length-1].d+' ('+BARS.length+')';
    const gran=BARS.length>1?Math.round(BARS[1].t-BARS[0].t):86400;
    const issues=validateBars(BARS,gran>0?gran:86400);
    const miss=BARS._missing&&BARS._missing.length?BARS._missing:null;
    const years=(BARS.length*(gran>0?gran:86400)/31557600).toFixed(2);
    document.getElementById('fetchOut').innerHTML=`<div class="verdict ${issues.length||miss?'weak':'pass'}">
      <b>${BARS.length} bars parsed</b>${BARS[0].d} to ${BARS[BARS.length-1].d} — about ${years} years.
      ${miss?'<br><br><strong>Columns missing:</strong> '+miss.join(', ')+'. Close was substituted, so stops and targets will not trigger intrabar and results will be optimistic.':''}
      ${issues.length?'<br><br><strong>Data warnings:</strong> '+issues.join('; ')+'.':'<br><br>Integrity checks passed.'}
      <br><br>At ${years} years your budget is <strong>${budgetN(Math.max(parseFloat(years),0.25),BUDGET?BUDGET.sr:1)} independent configurations</strong> at a target Sharpe of ${BUDGET?BUDGET.sr:1}.</div>`;
    document.getElementById('dataInfo').innerHTML=`<strong>${BARS.length} bars loaded</strong> — ${BARS[0].d} to ${BARS[BARS.length-1].d}.`;
  }catch(e){BARS=null;DATA_TAG=null;document.getElementById('dataInfo').textContent='No valid data loaded.';document.getElementById('fetchOut').innerHTML=
    `<div class="verdict fail"><b>Could not parse</b>${htmlSafe(e.message)}</div>`}});
document.getElementById('addTrade').addEventListener('click',async()=>{
  const e=parseFloat(jExp.value),a=parseFloat(jAct.value),x=parseFloat(jExit.value),
        s=parseFloat(jSize.value),f=fieldNumber('jFee');
  if(![e,a,x,s].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(f)||f<0){alert('Size and prices must be positive; fees must be zero or positive.');return}
  TRADES.push({d:new Date().toISOString().slice(0,10),sym:jSym.value||'—',rule:jRule.value,
    slip:(jDir.value==='Long'?1:-1)*(a-e)/e*100,pnl:(jDir.value==='Long'?1:-1)*(x-a)*(s/a)-f,ret:((jDir.value==='Long'?1:-1)*(x-a)*(s/a)-f)/s});
  await S.set('trades',TRADES);renderJrn();autoSaveIfNeeded();[jExp,jAct,jExit].forEach(i=>i.value='')});
document.getElementById('clrHyp').addEventListener('click',()=>{exportState();});
document.getElementById('clrJrn').addEventListener('click',async()=>{
  if(confirm('Delete all logged trades?')){TRADES=[];await S.clear('trades');renderJrn();autoSaveIfNeeded()}});

async function exportState(){
  const blob={format:'edge-lab',version:3,exported:new Date().toISOString(),
              budget:BUDGET,hyp:HYP,trades:TRADES,research:RESEARCH,protocol:PROTOCOL_ENVELOPE,history:HISTORY_MANIFEST};
  const saved=await saveFile(`edge-lab-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(blob,null,2),'application/json');
  if(!saved){document.getElementById('ioOut').innerHTML='<div class="verdict weak"><b>Download unavailable</b>Copy the full backup from the text box below.</div>';autoSaveIfNeeded();return}
  document.getElementById('ioOut').innerHTML=
    `<div class="verdict pass"><b>Exported</b>${spentTotal()} configurations across ${HYP.length} entries, and ${TRADES.length} live trades. Re-import this at the start of your next session.</div>`;
}
let autoSaveTimer=null;
/* File downloads, window.storage, and fetch have all been blocked by this
   sandbox. The one channel that cannot be blocked is rendering plain text
   for the user to select and copy by hand, using the OS's native clipboard --
   no API of ours involved. That's the fallback this settles on. */
function autoSaveIfNeeded(){
  if(autoSaveTimer)clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(()=>{
    const blob={format:'edge-lab',version:3,exported:new Date().toISOString(),
                budget:BUDGET,hyp:HYP,trades:TRADES,research:RESEARCH,protocol:PROTOCOL_ENVELOPE,history:HISTORY_MANIFEST};
    const box=document.getElementById('manualSave');
    if(box){
      box.value=JSON.stringify(blob);
      const w=document.getElementById('storeWarn');
      if(w){const n=w.querySelector('#asNote'); if(n)n.textContent=
        ` Updated just now — ${spentTotal()} configs, ${TRADES.length} trades. Copy the box below before you leave.`;}
    }
  },600);
}
async function importState(text){
  const io=document.getElementById('ioOut');
  let o; try{o=JSON.parse(text)}catch(e){
    io.innerHTML='<div class="verdict fail"><b>Could not read that file</b>It is not valid JSON.</div>';return}
  if(o.format!=='edge-lab'){
    io.innerHTML='<div class="verdict fail"><b>Wrong file</b>That is not an Edge Lab export.</div>';return}
  const validNum=v=>v==null||(typeof v==='number'||typeof v==='string')&&v!==''&&Number.isFinite(Number(v));
  if(!Array.isArray(o.hyp||[])||!Array.isArray(o.trades||[])||
    (o.hyp||[]).some(h=>!h||typeof h.id!=='string'||typeof h.t!=='string'||!['ma','rsi','brk'].includes(h.st)||typeof h.why!=='string'||!h.p||Array.isArray(h.p)||typeof h.p!=='object'||Object.values(h.p).some(v=>!Number.isFinite(v))||h.spent!=null&&(!Number.isInteger(h.spent)||h.spent<1)||['n','sr','pbo','ret','rho'].some(k=>!validNum(h[k]))||h.data!=null&&typeof h.data!=='string')||
    (o.trades||[]).some(t=>!t||typeof t.d!=='string'||typeof t.sym!=='string'||t.rule!=null&&typeof t.rule!=='string'||![t.slip,t.pnl].every(Number.isFinite)||t.ret!=null&&!Number.isFinite(t.ret))||
    o.budget&&(![o.budget.years,o.budget.sr,o.budget.rho,o.budget.N].every(Number.isFinite)||o.budget.years<=0||o.budget.sr<=0||o.budget.N<1||o.budget.rho<0||o.budget.rho>=1)){
    io.innerHTML='<div class="verdict fail"><b>Invalid backup</b>No changes imported. Register entries, journal fields or budget values are malformed.</div>';return}
  let stagedResearch;try{stagedResearch=mergeResearchState(o.research)}catch(e){io.textContent=e.message;return}
  // Dedupe on the full entry, not the id: two sessions both minted "T-001"
  // for different trials, and id-only dedupe silently dropped real trials.
  const haveH=new Set(HYP.map(hsig));
  let addedH=0;
  (o.hyp||[]).forEach(h=>{ if(!haveH.has(hsig(h))){HYP.push(h);haveH.add(hsig(h));addedH++} });
  const sig=tsig;
  const haveT=new Set(TRADES.map(sig));
  let addedT=0;
  (o.trades||[]).forEach(t=>{ if(!haveT.has(sig(t))){TRADES.push(t);haveT.add(sig(t));addedT++} });
  if(o.budget&&!BUDGET){BUDGET=o.budget;bY.value=BUDGET.years;bSR.value=BUDGET.sr;bRho.value=BUDGET.rho}
  await S.set('hyp',HYP); await S.set('trades',TRADES); if(BUDGET)await S.set('budget',BUDGET);
  RESEARCH=stagedResearch;saveResearchState();recordResearch('backup-import',{summary:'Imported '+addedH+' active entries and '+addedT+' journal entries; earlier history remains unknown'});
  refreshHeader();renderHyp();renderJrn();autoSaveIfNeeded();
  io.innerHTML=`<div class="verdict pass"><b>Merged</b>Added ${addedH} register entries and ${addedT} trades. Total now <strong>${spentTotal()} configurations searched</strong> across ${HYP.length} entries.</div>`;
}
document.getElementById('expState').addEventListener('click',exportState);
document.getElementById('impState').addEventListener('click',()=>document.getElementById('impFile').click());
document.getElementById('impText').addEventListener('click',()=>importState(document.getElementById('manualSave').value));
document.getElementById('impFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader(); rd.onload=()=>importState(rd.result); rd.readAsText(f);
  e.target.value='';
});

/* ============ v6 controls ============ */
const htmlSafe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>Number(x).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const pct=x=>(100*x).toFixed(2)+'%';
const fieldNumber=id=>{const s=document.getElementById(id).value.trim();return s===''?NaN:Number(s)};
let LAST_AUDIT=null,LAST_RISK=null;
function validateStrategy(st,p){
  const ints=st==='ma'?['fast','slow']:st==='rsi'?['per']:['look'];
  if(Object.values(p).some(v=>!Number.isFinite(v))||ints.some(k=>!Number.isInteger(p[k])||p[k]<2||p[k]>10000))throw Error('Indicator periods must be whole numbers from 2 to 10,000.');
  if(st==='ma'&&(p.fast>=p.slow||p.thr<0||p.thr>=100))throw Error('MA requires fast < slow and a threshold from 0% to below 100%.');
  if(st==='rsi'&&(p.os<=0||p.os>=100))throw Error('RSI threshold must be between 0 and 100.');
}
function auditChart(r){
  const cv=document.getElementById('auditChart');cv.style.display='block';
  const w=Math.max(cv.clientWidth,300),h=250,dpr=devicePixelRatio||1;cv.width=w*dpr;cv.height=h*dpr;
  const x=cv.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);
  const all=r.curve.concat(r.buyHold),mn=Math.min(...all)*.98,mx=Math.max(...all)*1.02;
  const Y=v=>h-25-(v-mn)/(mx-mn||1)*(h-60),X=i=>70+i/(r.curve.length-1)*(w-85);
  x.font='11px system-ui';x.fillStyle='#8E9196';
  [mn,(mn+mx)/2,mx].forEach(v=>{x.fillText(money(v),3,Y(v));x.strokeStyle='#2E3136';x.beginPath();x.moveTo(68,Y(v));x.lineTo(w,Y(v));x.stroke()});
  [[r.curve,'#8FD9B8','Strategy'],[r.buyHold,'#E0B268','Buy & hold']].forEach(([a,color,label],k)=>{x.strokeStyle=color;x.lineWidth=1.8;x.beginPath();a.forEach((v,i)=>i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v)));x.stroke();x.fillStyle=color;x.fillText(label,75+k*110,15)});
  x.fillStyle='#8E9196';x.fillText(LAST_AUDIT.dataset.start,70,h-5);x.textAlign='right';x.fillText(LAST_AUDIT.dataset.end,w-5,h-5);x.textAlign='left';
}
function renderAudit(r){
  const metric=(title,s,b)=>`<tr><td>${title}</td><td class="n">${s}</td><td class="n">${b}</td></tr>`;
  const reserve=LAST_AUDIT.profitReserve,net=r.strategy.final-r.assumptions.capital,held=reserve===null?null:Math.max(0,net)*reserve;
  document.getElementById('auditOut').innerHTML=`<div class="note" style="margin:14px 0">${htmlSafe(LAST_AUDIT.dataset.tag)} · ${htmlSafe(LAST_AUDIT.strategy)} ${htmlSafe(JSON.stringify(LAST_AUDIT.params))}<br>Logged as ${htmlSafe(LAST_AUDIT.id)} · ${r.trades.length} closed trades, including ${r.trades.filter(t=>t.reason==='sample-end liquidation').length} sample-end liquidation(s).</div>
    <table><thead><tr><th>Same loaded window</th><th class="n">Strategy</th><th class="n">100% buy &amp; hold</th></tr></thead><tbody>
    ${metric('Ending cash, before tax',money(r.strategy.final),money(r.benchmark.final))}
    ${metric('Total net return',pct(r.strategy.ret),pct(r.benchmark.ret))}
    ${metric('Annualized return (descriptive)',pct(r.strategy.cagr),pct(r.benchmark.cagr))}
    ${metric('Maximum close-to-close drawdown',pct(r.strategy.maxDD),pct(r.benchmark.maxDD))}
    ${metric('Fees paid',money(r.fees),money(r.benchmarkFees))}
    ${metric('Longest underwater stretch (bars)',r.strategy.longestUnderwaterBars,r.benchmark.longestUnderwaterBars)}
    </tbody></table>
    <div class="note" style="margin-top:12px">Return difference: <strong>${((r.strategy.ret-r.benchmark.ret)*100).toFixed(2)} percentage points</strong>. This is a performance comparison, not a significance test. Strategy allocation ${pct(r.assumptions.allocation)}; benchmark 100%. Different exposures mean different risks.</div>
    <div class="note">Exposure in ${pct(r.exposure)} of evaluated bars · modeled slippage ${money(r.slippage)} · traded notional ${money(r.turnover)} · ${r.ambiguous} stop/target ambiguity bar(s). Slippage is already reflected in fills; do not subtract it again. Final cash includes forced liquidation; it is not money earned in a live account.</div>
    <div class="note">${held===null?'Tax reserve not supplied; all returns above are pre-tax.':`Illustrative reserve: max(0, ${money(net)}) × ${pct(reserve)} = ${money(held)}; cash after this reserve ${money(r.strategy.final-held)}. This is a cash-planning scenario, not a calculation of tax liability.`}</div>`;
  document.getElementById('auditDetail').innerHTML='<h3 style="margin:14px 0 6px">Last 10 fills · full ledger in receipt</h3><div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Side / reason</th><th class="n">Price</th><th class="n">Quantity</th><th class="n">Fee</th></tr></thead><tbody>'+r.fills.slice(-10).map(f=>`<tr><td>${htmlSafe(f.date)}</td><td>${htmlSafe(f.side+' / '+f.reason)}</td><td class="n">${money(f.price)}</td><td class="n">${f.qty.toFixed(8)}</td><td class="n">${money(f.fee)}</td></tr>`).join('')+'</tbody></table></div>';
  auditChart(r);
}
document.getElementById('auditRun').addEventListener('click',async()=>{
  const btn=document.getElementById('auditRun');if(btn.disabled||RUNNING)return;RUNNING=true;
  const controls=[...document.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
  try{
    if(!READY)throw Error('Wait for the register to load.');if(!BARS)throw Error('Load data in Test, or use the synthetic example.');
    const st=document.getElementById('strat').value,p=readParams();validateStrategy(st,p);
    const why=document.getElementById('note').value.trim();if(!why)throw Error('State the mechanism in Test before running.');
    const cfg={capital:fieldNumber('aCapital'),allocation:fieldNumber('aAlloc')/100,entryFee:fieldNumber('aEF')/100,exitFee:fieldNumber('aXF')/100,entrySlip:fieldNumber('aES')/10000,exitSlip:fieldNumber('aXS')/10000,mode:document.getElementById('xmode').value,tgt:fieldNumber('tgt')/100,stp:fieldNumber('stp')/100,hold:fieldNumber('hold')};
    const reserve=document.getElementById('aTax').value.trim()===''?null:fieldNumber('aTax')/100;
    if(reserve!==null&&(!Number.isFinite(reserve)||reserve<0||reserve>1))throw Error('Profit reserve must be between 0% and 100%, or blank.');
    const r=executionAudit(BARS,signal(BARS,st,p),cfg),id='A-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const fingerprint=fnv(JSON.stringify(BARS.map(b=>[b.t,b.o,b.h,b.l,b.c])));
    LAST_AUDIT={format:'edge-lab-execution',version:1,engine:'next-open-v1',created:new Date().toISOString(),id,strategy:st,params:p,mechanism:why,dataset:{tag:DATA_TAG,start:BARS[0].d,end:BARS[BARS.length-1].d,bars:BARS.length,fingerprint,fingerprintType:'FNV-pair, non-cryptographic'},profitReserve:reserve,result:r};
    HYP.push({id,t:new Date().toISOString().slice(0,10),st,p,spent:1,why:'Execution audit: '+why,n:r.trades.length,sr:null,pbo:null,ret:null,rho:0,data:DATA_TAG,cfg,engine:'next-open-v1',dataFingerprint:fingerprint,audit:LAST_AUDIT});
    if(DATA_TAG!=='synthetic')recordResearch('execution-evaluation',{summary:st+' · next-open diagnostic',tag:DATA_TAG,params:p,cfg,provenance:CURRENT_DATA_META});
    const saved=await S.set('hyp',HYP);refreshHeader();renderHyp();autoSaveIfNeeded();renderAudit(r);
    if(!saved)document.getElementById('auditOut').insertAdjacentHTML('afterbegin','<div class="verdict weak"><b>Not saved automatically</b>Download the audit receipt and full register backup before closing.</div>');
  }catch(e){document.getElementById('auditOut').innerHTML='<div class="verdict fail"><b>Audit not run</b>'+htmlSafe(e.message)+'</div>';document.getElementById('auditChart').style.display='none';document.getElementById('auditDetail').textContent='';LAST_AUDIT=null;}
  finally{RUNNING=false;controls.forEach(([el,disabled])=>el.disabled=disabled)}
});
document.getElementById('auditDemo').addEventListener('click',()=>{
  document.getElementById('genData').click();document.getElementById('strat').value='ma';drawParams();
  document.getElementById('note').value='Synthetic practice only: test trend persistence with the default MA rule.';
  document.getElementById('xmode').value='signal';document.getElementById('stp').value='10';document.getElementById('tgt').value='10';document.getElementById('hold').value='365';
  for(const [k,v] of Object.entries({aEF:.6,aXF:.6,aES:10,aXS:10,aCapital:5000,aAlloc:25}))document.getElementById(k).value=v;
  document.getElementById('auditOut').innerHTML='<div class="note">Synthetic data loaded. Fees of 0.60% per side and slippage of 10 bps per side are illustrative assumptions, not verified venue prices. Click Log &amp; audit to inspect the example.</div>';
  document.getElementById('auditChart').style.display='none';document.getElementById('auditDetail').textContent='';LAST_AUDIT=null;
});
document.getElementById('auditExport').addEventListener('click',async()=>{
  if(!LAST_AUDIT){alert('Run an execution audit first.');return}
  if(!await saveFile('edge-lab-execution-'+LAST_AUDIT.id+'.json',JSON.stringify(LAST_AUDIT,null,2),'application/json'))alert('Download unavailable. Export the full register using the backup text box.');
});
document.getElementById('planRisk').addEventListener('click',()=>{
  try{
    const map={equity:'rEquity',peak:'rPeak',cash:'rCash',openRisk:'rOpen',risk:'rRisk',portfolioRisk:'rPortfolio',maxPosition:'rMax',maxDrawdown:'rDD',entry:'rEntry',stop:'rStop',gap:'rGap',entryFee:'rEF',exitFee:'rXF',entrySlip:'rES',exitSlip:'rXS'},c={};
    for(const [k,id] of Object.entries(map))c[k]=fieldNumber(id)/(['risk','portfolioRisk','maxPosition','maxDrawdown','gap','entryFee','exitFee'].includes(k)?100:['entrySlip','exitSlip'].includes(k)?10000:1);
    const requestedInputs={...c},experiment=experimentRisk(c.equity,c.peak,PROTOCOL.riskPolicy);
    c.risk=Math.min(c.risk,experiment.riskFraction);c.portfolioRisk=Math.min(c.portfolioRisk,PROTOCOL.riskPolicy.portfolioOpenRiskFraction);c.maxPosition=Math.min(c.maxPosition,PROTOCOL.riskPolicy.maxPositionCashFraction);
    if(!experiment.newRiskAllowed)c.cash=0;
    const r=positionPlan(c);LAST_RISK={requestedInputs,experiment,format:'edge-lab-risk-plan',created:new Date().toISOString(),inputs:c,result:r};
    document.getElementById('riskOut').innerHTML=`<div class="note"><strong>Experiment status: ${experiment.stage}</strong> · P&amp;L from $5,000: ${money(c.equity-PROTOCOL.riskPolicy.initialCapital)} · remaining before hard/trailing pause: ${money(experiment.remaining)}. Effective per-trade risk cap ${pct(c.risk)}. ${!experiment.newRiskAllowed?'New position size is forced to zero.':'Paper planning only; no live authorization.'}</div><div class="verdict ${r.qty>0?'weak':'fail'}"><b>${r.halt?'Paused: drawdown limit reached':r.qty===0?'No room for a new position':'Modeled limits · not permission to trade'}</b>Quantity ≤ <strong>${r.qty.toFixed(8)}</strong> · cash required ${money(r.debit)} · modeled stop loss ${money(r.stopLoss)}. Round quantity down to the venue’s permitted increment; do not round up to its minimum order.</div>
      <div class="kv"><span>Risk budget = min(per-trade, remaining total)</span><span>min(${money(c.equity*c.risk)}, ${money(r.headroom)}) = ${money(r.riskBudget)}</span></div>
      <div class="kv"><span>Modeled entry / stop fill</span><span>${money(r.entryFill)} / ${money(r.stopFill)}</span></div>
      <div class="kv"><span>Loss per unit, including both fees</span><span>${money(r.entryFill)} × (1 + ${pct(c.entryFee)}) − ${money(r.stopFill)} × (1 − ${pct(c.exitFee)}) = ${money(r.lossPerUnit)}</span></div>
      <div class="note">Quantity = min(risk budget / loss per unit, available cash / entry cash per unit, position cap / entry cash per unit). Drawdown limit forces quantity to zero.</div>
      <div class="kv"><span>Gap ${pct(c.gap)} below stop: modeled loss</span><span>${money(r.gapLoss)}</span></div>
      <div class="kv"><span>Entire position lost: cash at risk</span><span>${money(r.fullLoss)}</span></div>
      <div class="kv"><span>Current drawdown / pause threshold</span><span>${pct(r.drawdown)} / ${pct(c.maxDrawdown)}</span></div>
      <p class="hint" style="margin-top:12px">Total stop risk adds exposures; it does not estimate correlated crash losses or exchange failure. Fees, spread and liquidity can worsen. Dollar figures are rounded for display; the exported calculation keeps full precision.</p>`;
  }catch(e){LAST_RISK=null;document.getElementById('riskOut').innerHTML='<div class="verdict fail"><b>Check the inputs</b>'+htmlSafe(e.message)+'</div>'}
});
document.getElementById('exportRisk').addEventListener('click',async()=>{
  if(!LAST_RISK){alert('Calculate limits first.');return}
  if(!await saveFile('edge-lab-risk-plan.json',JSON.stringify(LAST_RISK,null,2),'application/json'))alert('Download unavailable on this browser.');
});
/* ============ end v6 controls ============ */

const PROTOCOL_ENVELOPE={"protocol":{"schema":1,"studyId":"FABLE-2026-09-P01","status":"LOCKED_PAPER_DESIGN","lockedAt":"2026-09-21T20:36:31Z","lockAuthority":"User authorized hypothesis locking in this conversation; assistant selected the explicit designs before fetching current prices.","venue":"Coinbase Advanced","instrument":"BTC-USD","marketDataSource":"Coinbase Advanced public REST market endpoints","barConvention":"ONE_DAY UTC; timestamp is bucket open; only fully closed candles; no invented missing bars","startInclusive":"2026-09-22T00:00:00Z","endExclusive":"2027-09-22T00:00:00Z","priorExposure":"BTC daily 2015-01-01 through 2024-04-24 repeatedly searched; earlier total unknown. All data before study start is development/warm-up, not holdout. No use of 2024-2026 history as fresh validation.","warmup":"Fixed 200-day warm-up anchored before study start; thereafter append days from this fixed anchor. Never re-seed breakout state on a shifting rolling window.","hypotheses":[{"id":"H1","title":"Slow trend continuation","mechanism":"Slow adjustment of positioning may allow persistent trends; turnover must be low enough to survive transaction costs. This is a testable proposal, not an established edge.","strategy":"ma","params":{"fast":20,"slow":120,"thr":0},"signal":"ON when the 20-day simple moving average of closing prices is strictly above the 120-day average; OFF otherwise."},{"id":"H2","title":"Sustained breakout continuation","mechanism":"New multi-month highs may accompany sustained demand; a shorter exit channel may leave weakening trends. It may fail in choppy markets and is correlated with H1.","strategy":"brk","params":{"look":60},"signal":"ON at a close strictly above the previous 60 daily highs, OFF at a close strictly below the previous 30 daily lows. State persists between thresholds; seed OFF at the first valid warm-up bar."}],"execution":{"engine":"next-open-v1","mode":"signal","stopFraction":0.1,"targetFraction":0.1,"targetActive":false,"maxHoldBars":365,"entry":"Fresh OFF-to-ON close transition only; next open. On the first forward day, treat existing ON as a fresh signal from flat. Each hypothesis starts in cash.","exit":"Signal OFF exits at next open; 10% stop from actual entry fill; gap stops use worse open; sample-end liquidation at final close. No leverage or shorting.","sameBarRule":"Protective stop checked on entry bar; stop before target; no reentry on an exit bar.","paperAllocationFraction":0.04,"paperAllocationRationale":"Each entry spends 4% of its own paper account, including entry fee. At $5,000 this is $200 cash; a 10% stop with the frozen base costs models about $23.74 loss. This is not a live size authorization.","independentPaperAccounts":true,"capitalPerHypothesis":5000,"combineHypothesisAccounts":false},"costs":{"basis":"Explicit hypothetical research assumptions, NOT a verified Coinbase account fee. Actual user tier remains unknown.","base":{"entryFee":0.01,"exitFee":0.01,"entrySlip":0.001,"exitSlip":0.001},"stress":{"entryFee":0.015,"exitFee":0.015,"entrySlip":0.003,"exitSlip":0.003},"noAfterResultsTuning":true},"benchmark":{"primary":"4%-allocated buy-and-hold from first forward open, 96% non-interest cash; same costs and final liquidation","secondary":"100% buy-and-hold over identical dates, same costs","metrics":["terminal pre-tax net return","return difference versus each benchmark","maximum close-to-close drawdown","turnover","fee and slippage dollars","number of fills","missing/late observation count"],"tax":"No tax liability assumed; report pre-tax and any separately supplied reserve explicitly."},"evaluation":{"forwardCollection":"Save each daily scan and its observed signal/time. Daily results are monitoring only. Never label a late reconstruction a contemporaneous observation.","decisionDate":"2027-09-22T00:00:00Z","primaryDescriptiveQuestion":"At the fixed endpoint, does each fixed rule have positive net return and a positive return difference versus the allocation-matched benchmark under both cost scenarios? Report either way.","minimumObservations":"Report elapsed years and trade count. Few trades or missing data remain inconclusive, never an automatic pass.","inferentialVerdict":"DISABLED: no calibrated next-open significance test is implemented. Do not use these descriptive conditions as statistical proof or authority to scale.","multipleTesting":"Two correlated hypotheses and two fixed cost scenarios. No picking the most favorable asset/rule/scenario after viewing results. Any future inferential family must account for all hypotheses/looks.","earlyReview":"Safety, missing data and execution errors only; no early profit-based declaration of success.","amendments":"New dated study/version only; old protocol and outcomes retained. Changes cannot inherit the original unexposed start."},"riskPolicy":{"initialCapital":5000,"userDiscomfortLoss":1000,"reviewLoss":500,"noNewRiskLoss":750,"hardPauseLoss":1000,"liveTradingEnabled":false,"venue":"Coinbase Advanced","perTradeRiskFraction":0.005,"portfolioOpenRiskFraction":0.01,"maxPositionCashFraction":0.25,"trailingPauseDollars":1000,"cashFlowTreatment":"Equity and high-water mark must be cash-flow-adjusted; do not reset losses by adding money.","implementation":"Manual inputs and planning gates only. No access to account balances, orders or credentials; cannot enforce broker-side liquidation.","gapCaveat":"Stop fills, adverse gaps, outages and simultaneous losses can exceed modeled risk."},"scanPolicy":{"universe":"Public Coinbase SPOT products quoted in USD, excluding disabled/cancel-only/auction modes. Availability in a particular account is not verified.","overviewOrder":"24h reported or estimated quote volume, not strategy returns; maximum 20 pages of 100 products with explicit truncation warning","fixedSignalWatchlist":["BTC-USD"],"contextOnlyWatchlist":["ETH-USD","SOL-USD"],"candlesPerAsset":200,"excludeIncompleteCandles":true,"noAutomaticBacktests":true,"observationLogging":"Every scan attempt and returned data range is recorded; warm-up prices viewed are no longer untouched. Market scanning does not validate a hypothesis.","dailySchedule":"Manual button after 00:05 UTC; one record per day plus any explicit repeated observations, no background schedule.","btcHistory":"BTC fetched in pages up to 200 candles from fixed warm-up anchor through most recent completed day, capped at study end. ETH/SOL use rolling 200 days for context only."},"warmupStartInclusive":"2026-03-06T00:00:00Z","revisionNote":{"supersedesUnpublishedDraftSHA256":"54898ef67ac41612539893bbb1f3e15574c35d4f994e2361a2ef8e4becb22858","reason":"Clarified fixed breakout warm-up anchor to prevent state from changing when a rolling window shifts. No current prices were obtained; connectivity probe timed out. No hypothesis parameters or costs changed."}},"sha256":"61dd32e39c7f1e1b0053d6a472638953e724e68abbdc2eacee1a609f2bb64cd2","digestEncoding":"SHA-256 of UTF-8 recursively key-sorted compact JSON protocol"};
const HISTORY_MANIFEST={"schema":1,"repairStatus":"PARTIAL_RECONSTRUCTION_EARLIER_TOTAL_UNKNOWN","verifiedEvaluationCount":736,"independentTrialCount":null,"olderResearch":{"source":"HANDOFF.md sections 6–7 and CHANGELOG.md passes 1–7","known":"MA/RSI/breakout sweeps, both exit rules, prior v1–v5 attempts","missing":"Exact attempts, dates, order and complete configurations of earlier Claude/user work","asset":"BTC","start":"2015-01-01","end":"2024-04-24"},"verifiedRuns":[{"id":"v5-baseline.log","source":"tests/artifacts/v5-baseline.log","sha256":"a8fb7861ce6d5f63875ef9f7ce9bd0fbb409188b23854d6312e42c0965e49220","configurationEvaluations":184,"independence":"Repeated implementation evaluations, not independent discoveries","blocks":{"fixedReferenceAllFamilies":61,"signalReferenceMA":45,"storageRSIAndBreakout":16,"endToEndSweepsAndSingle":62},"additionalSignalPrefixChecks":1200,"verdicts":{"ma":"DSR 0.908","rsi":"DSR 0.024","brk":"DSR 0.820","maLaterSingle":"not computable after accumulated trials"}},{"id":"v6-regression.log","source":"tests/artifacts/v6-regression.log","sha256":"b8fa14b9b89ed482cd57d91ff3629c0f77000a0c75d9fa15c2aa724436edb4bd","configurationEvaluations":184,"independence":"Repeated implementation evaluations, not independent discoveries","blocks":{"fixedReferenceAllFamilies":61,"signalReferenceMA":45,"storageRSIAndBreakout":16,"endToEndSweepsAndSingle":62},"additionalSignalPrefixChecks":1200,"verdicts":{"ma":"DSR 0.908","rsi":"DSR 0.024","brk":"DSR 0.820","maLaterSingle":"not computable after accumulated trials"}},{"id":"v7-baseline.log","source":"tests/artifacts/v7-baseline.log","sha256":"f4c4ab3feda5a5877dc933a35efc513b5562af2ec7290d65a4cbab1623c9f69e","configurationEvaluations":184,"independence":"Repeated implementation evaluations, not independent discoveries","blocks":{"fixedReferenceAllFamilies":61,"signalReferenceMA":45,"storageRSIAndBreakout":16,"endToEndSweepsAndSingle":62},"additionalSignalPrefixChecks":1200,"verdicts":{"ma":"DSR 0.908","rsi":"DSR 0.024","brk":"DSR 0.820","maLaterSingle":"not computable after accumulated trials"}},{"id":"v7-regression-final.log","source":"tests/artifacts/v7-regression-final.log","sha256":"18d87ff4d3496d3ae748d42c07c88d92d7e534093242c3cb0bdc2b5a666a35ff","configurationEvaluations":184,"independence":"Repeated implementation evaluations, not independent discoveries","blocks":{"fixedReferenceAllFamilies":61,"signalReferenceMA":45,"storageRSIAndBreakout":16,"endToEndSweepsAndSingle":62},"additionalSignalPrefixChecks":1200,"verdicts":{"ma":"DSR 0.908","rsi":"DSR 0.024","brk":"DSR 0.820","maLaterSingle":"not computable after accumulated trials"}}]};
/* ============ v7 research controls ============ */
// SHA-256 implementation for file:// and storage-limited environments; verified against Node crypto in tests.
function sha256Text(text){
  const bytes=[];for(const char of unescape(encodeURIComponent(text)))bytes.push(char.charCodeAt(0));
  const length=bytes.length;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
  const bits=length*8;for(let i=7;i>=0;i--)bytes.push(i>=4?Math.floor(bits/2**(i*8))&255:(bits>>>i*8)&255);
  const primes=[],initial=[],round=[];
  for(let p=2;primes.length<64;p++){let prime=true;for(let d=2;d*d<=p;d++)if(p%d===0){prime=false;break}if(prime){primes.push(p);if(initial.length<8)initial.push((Math.sqrt(p)%1*4294967296)|0);round.push((Math.cbrt(p)%1*4294967296)|0)}}
  const H=initial.slice(),rotate=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<bytes.length;offset+=64){
    const w=Array(64);for(let i=0;i<16;i++)w[i]=(bytes[offset+4*i]<<24)|(bytes[offset+4*i+1]<<16)|(bytes[offset+4*i+2]<<8)|bytes[offset+4*i+3];
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotate(a,7)^rotate(a,18)^(a>>>3),s1=rotate(b,17)^rotate(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){const S1=rotate(e,6)^rotate(e,11)^rotate(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+round[i]+w[i])|0,S0=rotate(a,2)^rotate(a,13)^rotate(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0}
    [a,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)|0);
  }
  return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
const PROTOCOL=deepFreeze(PROTOCOL_ENVELOPE.protocol),RESEARCH_KEY='fable-desk:research-v7';
let RESEARCH={schema:1,protocolSHA256:PROTOCOL_ENVELOPE.sha256,events:[]},RESEARCH_OK=false,LAST_SCAN=null,SCANNING=false,CURRENT_DATA_META=null;
function validateResearchState(input){
  if(!input||input.schema!==1||input.protocolSHA256!==PROTOCOL_ENVELOPE.sha256||!Array.isArray(input.events))throw Error('Research backup belongs to a different protocol or has an invalid schema.');
  const ids=new Map();
  for(const e of input.events){
    if(!e||typeof e.id!=='string'||typeof e.time!=='string'||!Number.isFinite(Date.parse(e.time))||typeof e.kind!=='string'||!e.payload||typeof e.payload!=='object'||typeof e.sha256!=='string')throw Error('Malformed research event.');
    const body={id:e.id,time:e.time,kind:e.kind,payload:e.payload};if(sha256Text(canonicalJSON(body))!==e.sha256)throw Error('A research-event checksum does not match. No history imported.');
    if(ids.has(e.id)&&ids.get(e.id)!==e.sha256)throw Error('Conflicting research event ID. No history imported.');ids.set(e.id,e.sha256);
  }
  return input;
}
function mergeResearchState(incoming){
  const base=validateResearchState(RESEARCH);if(!incoming)return base;validateResearchState(incoming);
  const map=new Map(base.events.map(e=>[e.id,e]));
  for(const e of incoming.events){if(map.has(e.id)&&map.get(e.id).sha256!==e.sha256)throw Error('Conflicting research event ID; preserve both backup files for review.');map.set(e.id,e)}
  return {schema:1,protocolSHA256:base.protocolSHA256,events:[...map.values()].sort((a,b)=>a.time.localeCompare(b.time)||a.id.localeCompare(b.id))};
}
function saveResearchState(){
  try{const old=localStorage.getItem(RESEARCH_KEY);if(old)RESEARCH=mergeResearchState(JSON.parse(old));localStorage.setItem(RESEARCH_KEY,JSON.stringify(RESEARCH));RESEARCH_OK=true}
  catch(e){RESEARCH_OK=false;document.getElementById('researchStoreStatus').textContent='Research history is in memory only, or a saved-history conflict needs review. Export the full backup before closing. '+e.message;return false}
  document.getElementById('researchStoreStatus').textContent='Research history saved in this browser. Export backups; browser storage is not immutable. Concurrent tabs merge observed entries but are not a transactional database.';return true;
}
function recordResearch(kind,payload){
  const event={id:'E-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),time:new Date().toISOString(),kind,payload};event.sha256=sha256Text(canonicalJSON(event));RESEARCH.events.push(event);saveResearchState();renderResearch();autoSaveIfNeeded();return event;
}
function historyExposure(){return [{asset:'BTC',start:'2015-01-01T00:00:00Z',end:'2024-04-25T00:00:00Z',source:'Reconstructed BTC research; earlier count unknown'},...RESEARCH.events.flatMap(e=>e.kind==='dataset-loaded'?[e.payload]:e.kind==='scan-result'&&Array.isArray(e.payload.ranges)?e.payload.ranges:[])].filter(x=>x&&typeof x.asset==='string');}
function captureDataset(source){
  CURRENT_DATA_META=null;if(!BARS||DATA_TAG==='synthetic')return;
  const asset=source==='bundled'?'BTC':source==='fetch'?document.getElementById('dPair').value.split('-')[0]:document.getElementById('researchAsset').value;
  const start=new Date(BARS[0].t*1000).toISOString(),end=new Date((BARS.at(-1).t+31557600/barsPerYear(BARS))*1000).toISOString();
  const meta={asset,start,end,source,tag:DATA_TAG,bars:BARS.length,sha256:sha256Text(canonicalJSON(BARS.map(b=>[b.t,b.o,b.h,b.l,b.c])))};
  meta.overlappingObservations=historyExposure().filter(e=>overlapsExposure(meta,e)!==false).length;CURRENT_DATA_META=meta;recordResearch('dataset-loaded',meta);
  document.getElementById('dataInfo').insertAdjacentHTML('beforeend','<br><strong>Exploratory exposure recorded.</strong> '+(asset==='UNKNOWN'?'Asset is unknown; independence cannot be established.':htmlSafe(asset)+' · '+meta.overlappingObservations+' overlapping known exposure(s).')+' A changed file name or date range does not establish a holdout.');
}
function renderResearch(){
  const history=document.getElementById('researchHistory');if(!history)return;
  const total=HISTORY_MANIFEST.verifiedEvaluationCount;
  history.innerHTML=`<div class="verdict weak"><b>Known history reconstructed · earlier total still unknown</b>${total} documented repeated BTC configuration evaluations are preserved as implementation/research exposures. They are not ${total} independent trials. Older Claude sweeps and v1–v5 searches are acknowledged but their complete attempt log was not exported. No invented effective-trial count is used.</div>
  <p class="hint" style="margin-top:12px">BTC 2015-01-01 through 2024-04-24 is development data. The new study uses future observations from ${htmlSafe(PROTOCOL.startInclusive.slice(0,10))}. All earlier prices, including scanner warm-up, remain development/context data. Clearing active app entries cannot erase the built-in history.</p>`;
  document.getElementById('protocolSummary').innerHTML=`<div class="note"><strong>${htmlSafe(PROTOCOL.studyId)}</strong> · locked ${htmlSafe(PROTOCOL.lockedAt)}<br>Forward window: ${htmlSafe(PROTOCOL.startInclusive)} through ${htmlSafe(PROTOCOL.endExclusive)} (end excluded).</div>
  <table><thead><tr><th>Hypothesis</th><th>Exact rule</th><th>Purpose</th></tr></thead><tbody><tr><td>H1 · BTC slow trend</td><td>20-day SMA &gt; 120-day SMA; zero threshold</td><td>Test persistence after costs</td></tr><tr><td>H2 · BTC breakout</td><td>Close above prior 60-day high; exit below prior 30-day low</td><td>Test sustained breakouts</td></tr></tbody></table>
  <p class="hint" style="margin-top:12px">Each has a separate $5,000 paper account and 4% cash allocation per entry. 10% stop; signal exit at next open; max hold 365 bars. Base assumption: 1.00% fee + 10 bps slippage per side. Stress: 1.50% fee + 30 bps per side. These are deliberately explicit research assumptions, not your verified Coinbase fees.</p>
  <div class="verdict weak"><b>Paper design frozen · live trading disabled</b>These correlated trend rules are not independent confirmations. No significance verdict or capital promotion is enabled. Evaluation is scheduled for ${htmlSafe(PROTOCOL.endExclusive.slice(0,10))}; routine scans cannot turn an early profit into a pass.</div>
  <details style="margin-top:12px"><summary>Protocol fingerprint</summary><code style="display:block;overflow-wrap:anywhere;color:var(--paper)">${htmlSafe(PROTOCOL_ENVELOPE.sha256)}</code></details>`;
  const rows=RESEARCH.events.slice(-30).reverse();
  document.getElementById('exposureList').innerHTML=rows.length?'<table><thead><tr><th>Observed UTC</th><th>Event</th><th>Details</th></tr></thead><tbody>'+rows.map(e=>`<tr><td>${htmlSafe(e.time)}</td><td>${htmlSafe(e.kind)}</td><td>${htmlSafe(e.payload.summary||e.payload.tag||e.payload.product||e.payload.status||e.payload.error||e.payload.source||'Recorded; full details in backup')}</td></tr>`).join('')+'</tbody></table>':'<div class="empty">No new observations in this browser. The reconstructed history and frozen protocol still apply.</div>';
}
function renderScan(scan,isExample=false){
  const r=scan.result,when=new Date(scan.observedAt),late=when.getUTCHours()>0||when.getUTCMinutes()>15;
  document.getElementById('scanStatus').textContent=(isExample?'SYNTHETIC EXAMPLE · ':'Observed '+scan.observedAt+' · ')+(r.complete?'Scan complete. ':'PARTIAL SCAN — inspect failures. ')+r.rows.length+' USD spot products; latest candle bucket '+r.window.asOf+'. '+(late?'Late observation: historical next-open prices are not executable now.':'Observe after 00:05 UTC; no order is sent.');
  const fmt=(n,style)=>n===null?'Unavailable':style==='pct'?n.toFixed(2)+'%':money(n);
  document.getElementById('scanSignals').innerHTML=r.details.map(d=>`<div class="note"><strong>${htmlSafe(d.product)} · ${d.contextOnly?'context only':'locked hypotheses'}</strong><br>Last completed close ${money(d.lastClose)} · 30-day annualized realized volatility ${pct(d.volatility30d)} · ${d.bars} daily bars, ${htmlSafe(d.start)}–${htmlSafe(d.end)}.
    ${d.signals.map(s=>`<div class="kv"><span>${htmlSafe(s.id)}</span><span>${htmlSafe(s.description)} · observation only</span></div>`).join('')}</div>`).join('')+r.errors.map(e=>'<div class="verdict fail"><b>'+htmlSafe(e.product)+' unavailable</b>'+htmlSafe(e.message)+'</div>').join('')+(r.truncated?'<div class="verdict weak"><b>Listing capped</b>The 20-page limit was reached; market coverage is incomplete.</div>':'');
  const eligible=r.rows.filter(x=>!x.blocked);
  document.getElementById('scanMarketsTable').innerHTML='<h3 style="margin:16px 0 6px">Largest reported or estimated USD volumes · top 30</h3><p class="hint">Liquidity overview, not a ranking of expected returns. Account eligibility and executable spread are not verified. Some products may be limit/post-only; check Coinbase before trading.</p><table><thead><tr><th>Product</th><th class="n">Snapshot price</th><th class="n">24h change</th><th class="n">24h USD volume</th><th>Status</th></tr></thead><tbody>'+eligible.slice(0,30).map(x=>`<tr><td>${htmlSafe(x.product)}</td><td class="n">${fmt(x.price)}</td><td class="n">${fmt(x.change24h,'pct')}</td><td class="n" title="${htmlSafe(x.volumeBasis)}">${fmt(x.volumeUSD)}</td><td>${x.restricted?'Limit/post-only; check venue':htmlSafe(x.status)}</td></tr>`).join('')+'</tbody></table>';
}
async function scanDaily(){
  if(SCANNING||RUNNING)return;SCANNING=true;document.getElementById('scanMarkets').disabled=true;document.getElementById('scanExample').disabled=true;
  LAST_SCAN=null;document.getElementById('scanSignals').textContent='';document.getElementById('scanMarketsTable').textContent='';
  const now=Math.floor(Date.now()/1000),win=observationWindow(now);
  try{
    if(sha256Text(canonicalJSON(PROTOCOL))!==PROTOCOL_ENVELOPE.sha256)throw Error('Protocol checksum mismatch. No data fetched.');
    recordResearch('scan-attempt',{summary:'Public Coinbase daily scan requested',window:win,protocolSHA256:PROTOCOL_ENVELOPE.sha256});
    const fetcher=(url,opts)=>fetch(routePublic(url),opts);
    const result=await collectMarketScan(path=>fetchPublicJSON(path,fetcher),now,msg=>{document.getElementById('scanStatus').textContent=msg},PROTOCOL);
    LAST_SCAN={format:'fable-market-scan',version:1,observedAt:new Date().toISOString(),protocolSHA256:PROTOCOL_ENVELOPE.sha256,result};
    const ranges=result.details.map(d=>({asset:d.product.split('-')[0],start:d.start+'T00:00:00Z',end:new Date(Date.parse(d.end)+DAY*1000).toISOString(),source:'daily-scan'}));
    const snapshotDigest=sha256Text(canonicalJSON(LAST_SCAN));
    recordResearch('scan-result',{summary:(result.complete?'Complete':'Partial')+' daily scan · '+result.rows.length+' products',ranges,snapshotSHA256:snapshotDigest,observedAt:LAST_SCAN.observedAt,overviewProducts:result.rows.map(x=>x.product),observations:result.details.map(({sourceCandles,...summary})=>summary),errors:result.errors});renderScan(LAST_SCAN);
  }catch(e){recordResearch('scan-failed',{error:e.message,window:win});document.getElementById('scanStatus').textContent='SCAN FAILED · '+e.message+' No current data is displayed.';}
  finally{SCANNING=false;document.getElementById('scanMarkets').disabled=false;document.getElementById('scanExample').disabled=false}
}
function syntheticScanExample(){
  // Deterministic toy market; never added to the real observation history.
  const start=Math.floor(Date.now()/1000/DAY)*DAY-200*DAY,bars=Array.from({length:200},(_,i)=>{const o=100+i*.2,c=o+.12;return {t:start+i*DAY,d:new Date((start+i*DAY)*1000).toISOString().slice(0,10),o,h:c+.1,l:o-.1,c,v:1000}});
  const result={window:observationWindow(Date.now()/1000),pages:1,truncated:false,rows:[{product:'SYNTHETIC-USD',price:139.92,change24h:.2,volumeUSD:140000,volumeBasis:'synthetic',status:'Example',blocked:false,restricted:false}],details:[{product:'BTC-USD (synthetic)',start:bars[0].d,end:bars.at(-1).d,bars:200,lastClose:bars.at(-1).c,volatility30d:.02,signals:lockedSignals(bars),sourceCandles:bars,contextOnly:false}],errors:[],complete:true};
  LAST_SCAN={format:'fable-market-scan',version:1,synthetic:true,observedAt:new Date().toISOString(),protocolSHA256:PROTOCOL_ENVELOPE.sha256,result};renderScan(LAST_SCAN,true);
}
function initResearch(){
  if(sha256Text(canonicalJSON(PROTOCOL))!==PROTOCOL_ENVELOPE.sha256){document.getElementById('scanMarkets').disabled=true;document.getElementById('researchStoreStatus').textContent='Protocol checksum mismatch. Restore the original package.';return}
  try{const saved=localStorage.getItem(RESEARCH_KEY);if(saved)RESEARCH=mergeResearchState(JSON.parse(saved));saveResearchState()}
  catch(e){RESEARCH_OK=false;document.getElementById('researchStoreStatus').textContent='Saved research history could not be verified. Do not reset it; preserve/export it for review. '+e.message;document.getElementById('scanMarkets').disabled=true;}
  renderResearch();
}
document.getElementById('scanMarkets').addEventListener('click',scanDaily);
document.getElementById('scanExample').addEventListener('click',syntheticScanExample);
document.getElementById('exportScan').addEventListener('click',async()=>{if(!LAST_SCAN){alert('Run a scan or synthetic preview first.');return}if(!await saveFile('fable-daily-scan-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(LAST_SCAN,null,2),'application/json'))alert('Download unavailable. Copy the full research backup from Register.');});
document.getElementById('exportProtocol').addEventListener('click',()=>saveFile('LOCKED-PROTOCOL.json',JSON.stringify(PROTOCOL_ENVELOPE,null,2),'application/json'));
document.getElementById('exportResearch').addEventListener('click',exportState);
window.addEventListener('storage',e=>{if(e.key===RESEARCH_KEY&&e.newValue){try{RESEARCH=mergeResearchState(JSON.parse(e.newValue));renderResearch();autoSaveIfNeeded()}catch(x){document.getElementById('researchStoreStatus').textContent='Concurrent history conflict: export backups from both tabs. '+x.message}}});
/* ============ end v7 research controls ============ */

(async()=>{drawParams();
  STORAGE_OK=await S.probe();
  if(!STORAGE_OK) autoSaveIfNeeded();
  if(STORE_KIND==='db'&&STORE_VERIFIED){const w=document.getElementById('storeWarn');
    w.innerHTML='<b>Cloud register verified</b>Saved privately to your account — a write/read/delete check passed on load.';
    setTimeout(()=>{if(w.textContent.indexOf('Cloud register verified')===0)w.innerHTML=''},6000);}
  if(STORE_KIND==='local'){
    document.getElementById('storeWarn').innerHTML='<b>Saved on this browser only</b>The register persists here but not across devices, and clearing site data erases it. Download a backup from the Register tab now and then.';
  }
  if(!STORAGE_OK){
    document.getElementById('storeWarn').innerHTML=
      `<b>Nothing persists on this device</b>Storage, downloads, and network requests are all blocked in this environment, so the register resets every time this tab closes. That matters here specifically: a register that resets understates how many configurations you've searched, which makes every later test look better than it should. <strong>Go to the Register tab</strong> — there's a text box that updates automatically as you work. Before you close this tab, copy everything in it (tap the box, Select All, Copy) and paste it into Notes or a message to yourself. Next time, paste it back into that same box and tap Import from text. <span id="asNote"></span>`;
  }
  HYP=await S.get('hyp',[]);TRADES=await S.get('trades',[]);BUDGET=await S.get('budget',null);
  if(BUDGET){bY.value=BUDGET.years;bSR.value=BUDGET.sr;bRho.value=BUDGET.rho}
  initResearch();READY=true;refreshHeader();renderHyp();renderJrn();autoSaveIfNeeded()})();
