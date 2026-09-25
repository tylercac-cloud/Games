
/* ============ storage ============ */
/* Hosted: owner-only artifact db. Each register entry and journal trade is
   its own document, keyed by a hash of its content, so two open tabs or
   devices can never overwrite each other's trials (whole-array writes were
   last-writer-wins). Fallbacks: localStorage, then the copy/paste box. */
let STORAGE_OK=false, STORE_KIND='none', DB=null, READY=false, STORE_VERIFIED=false;
const COLL={hyp:'edgelab_hyp',trades:'edgelab_trades',locks:'edgelab_locks'}, META='edgelab_meta/state';
function fnv(str){let h1=0x811c9dc5,h2=0x01000193^0x5bd1e995;
  for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=Math.imul(h2^c,2654435761)}
  return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0')}
function recordSignature(value){
  const norm=v=>Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>k!=='_ts').sort().map(k=>[k,norm(v[k])])):v;
  return JSON.stringify(norm(value));
}
const hsig=recordSignature;
const tsig=recordSignature;
const lsig=l=>JSON.stringify([l.id,l.locked,l.data,l.comps,l.st,l.p,l.cfg,l.why,l.sweep,l.snapshots||null]);
const SIG={hyp:hsig,trades:tsig,locks:lsig};
const SAVED={hyp:new Set(),trades:new Set(),locks:new Set()};
const S={
  async probe(){
    try{
      if(window.claude&&typeof window.claude.use==='function'){
        const db=await window.claude.use('db');
        if(db){await db.doc(META).get();
          // Round-trip self-test: write, read back, delete. Only a verified store is used.
          const ref=db.collection('edgelab_selftest').doc('probe-'+Math.random().toString(36).slice(2,10));
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
      const r=localStorage.getItem('edgelab:'+k);return r?JSON.parse(r):d }catch(e){return d} },
  async set(k,v){ if(!STORAGE_OK)return false;
    try{
      if(STORE_KIND==='db'){
        if(k==='budget')return await S.setDoc('budget',v);
        for(const x of v){const id=fnv(SIG[k](x)); if(SAVED[k].has(id))continue;
          if(!x._ts)x._ts=Date.now();
          await DB.collection(COLL[k]).doc(id).set(JSON.parse(JSON.stringify(x))); SAVED[k].add(id)}
        return true}
      localStorage.setItem('edgelab:'+k,JSON.stringify(v));return true }
    catch(e){ const w=document.getElementById('storeWarn');
      if(w)w.innerHTML='<b>Save failed</b>'+(e&&e.code==='quota_exceeded'?'The saved register is full. Export a backup from the Register tab.':'The last change did not save. Export a backup from the Register tab before closing.');
      return false } },
  // A single JSON blob under one key (datasets, pool). db: a field on the META
  // doc; local: its own localStorage key. Whole-value, last-writer-wins — fine
  // for data the user reloads, unlike the append-only register collections.
  async getDoc(k,d){ if(!STORAGE_OK)return d;
    try{ if(STORE_KIND==='db'){const m=await DB.doc(META).get();return m.exists&&m.data()[k]!=null?JSON.parse(JSON.stringify(m.data()[k])):d}
      const r=localStorage.getItem('edgelab:'+k);return r?JSON.parse(r):d }catch(e){return d} },
  async setDoc(k,v){ if(!STORAGE_OK)return false;
    try{ if(STORE_KIND==='db'){const m=await DB.doc(META).get();const cur=m.exists?m.data():{};cur[k]=JSON.parse(JSON.stringify(v));await DB.doc(META).set(cur);return true}
      localStorage.setItem('edgelab:'+k,JSON.stringify(v));return true }
    catch(e){ const w=document.getElementById('storeWarn');
      if(w&&e&&e.code==='quota_exceeded')w.innerHTML='<b>Data too large to save</b>Loaded price series exceeded the storage quota, so it will not persist. Your register is unaffected.'; return false } },
  async clear(k){ if(!STORAGE_OK)return;
    if(STORE_KIND==='db'){const q=await DB.collection(COLL[k]).limit(1000).get();
      for(const x of q.docs)await DB.collection(COLL[k]).doc(x.id).delete(); SAVED[k].clear(); return}
    localStorage.setItem('edgelab:'+k,'[]') }
};
/* File saves: hosted downloads capability first, plain link as fallback. */
async function saveFile(name,text,mime){
  try{ if(window.claude&&window.claude.use){const dl=await window.claude.use('downloads');
      if(dl){await dl.save({filename:name,data:new Blob([text],{type:mime})});return true}} }catch(e){ if(e&&e.code==='declined')return false }
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));
    a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return true}catch(e){return false}
}
let HYP=[],TRADES=[],LOCKS=[],BUDGET=null,BARS=null,CURRENT_LOCK=null;
let RUNNING=false,LOCKING=false,DATA_BUSY=false;

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
function render(res,dec,sw,trs,cfg,varSR,famN,label,rhoNow,X,sweep,bpy,FS,lockMatch,ctx){
  const MX=moments(X&&X.length?X:[0]);
  const M=moments(trs.length?trs:[0]);
  const wins=trs.filter(t=>t>0).length;
  document.getElementById('resStats').innerHTML=`
    <div class="st"><div class="v">${trs.length}</div><div class="k">Trades</div></div>
    <div class="st"><div class="v">${trs.length?(wins/trs.length*100).toFixed(1):'0.0'}%</div><div class="k">Win rate</div></div>
    <div class="st"><div class="v ${M.m>0?'good':'bad'}">${(M.m*100).toFixed(2)}%</div><div class="k">Expectancy/trade</div></div>
    <div class="st"><div class="v ${MX.m>0?'good':'bad'}">${(MX.s?MX.m/MX.s*Math.sqrt(bpy):0).toFixed(2)}</div><div class="k">Excess Sharpe vs holding (ann.)</div></div>
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
      <div class="cite" style="margin-top:8px">Time-ordered, unlike PBO. A real edge keeps most of its Sharpe forward in time. Collapse means the effect belonged to a regime that ended. Above 100% means it did better later, which at these sample sizes is usually noise. Computed on returns in excess of holding.</div>`;
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
  x.font='10px JetBrains Mono';x.fillStyle='#8E9196';x.fillText('equity, '+label,8,14);
  // verdict
  const v=document.getElementById('verdict');
  const n=trs.length;
  if(n<MIN_TRADES){v.className='verdict weak';
    v.innerHTML=`<b>Not enough trades</b>${n} trades cannot support any conclusion. Widen the rule or get more data.`;return}
  const spent=spentTotal();
  const synth=activeComps().some(t=>t==='synthetic');
  const effAll=synth?effN(sw,rhoNow):effTotal();
  const over=BUDGET&&!synth&&effTotal()>BUDGET.N;
  const J=judge(FS,effAll,sweep,over);       // single source of verdict math
  const sr=J.sr,T=J.T,years=J.years,annSR=J.annSR,prereg=J.prereg,used=J.used,sr0=J.sr0,dsr=J.dsr,mds=J.mds;
  const powerLine=`<br><br><em>Power: with ${years.toFixed(1)} years and ${used.toFixed(1)} effective trial${used>1.05?'s':''}, this test detects an annualized excess Sharpe of about <strong>${mds.toFixed(2)}</strong> or more with ~80% probability. The evaluated config scored <strong>${annSR.toFixed(2)}</strong>.${annSR>0&&annSR<mds?' A real edge of this size would usually fail here — read a fail as "unproven," not "disproven."':''}</em>`;
  if(J.verdict==='not-computable'){v.className='verdict weak';
    v.innerHTML=`<b>Deflated Sharpe not computable</b>${!sweep?`This dataset already has ${effAll.toFixed(1)} effective trials logged, so a single config can't be judged without the spread of the family it was chosen from. Run the sweep — or test it as a pre-registered hypothesis on data you haven't searched yet (e.g. a new asset or a later date range).`:'Fewer than 4 configurations produced 5+ trades, so there is no family spread to deflate against.'} PBO and retention above are still readable.`+powerLine;return}
  const head=prereg?(lockMatch?`Pre-registered test (locked before the first and only trial on this dataset, so no deflation). `:`First trial on this dataset (undeflated, but it was not locked before the run). `):'';
  // The Deflated Sharpe decides. PBO and forward retention are shown as warnings,
  // not vetoes: in simulation (audit pass 6) the DSR alone passed 0 of 95 null
  // series (plain and fat-tailed GARCH, with BTC-like drift), while the two vetoes
  // cut detection of a real Sharpe-1.05 edge from 19/25 to 1/25 — PBO ranks
  // configs that all share an edge essentially at random.
  const warn=[];
  if(res&&res.pbo>0.5)warn.push(`PBO is ${(res.pbo*100).toFixed(0)}%: the in-sample winner usually isn't the out-of-sample winner. Common when every config shares the same edge; also common for pure noise. Prefer a simpler config from the family over the exact winner.`);
  if(dec&&dec.isSR>0&&dec.osSR<dec.isSR*0.4)warn.push(`Forward retention is ${(dec.osSR/dec.isSR*100).toFixed(0)}%: the family did much worse in the later half of the data. The edge may be fading — confirm on later data before sizing up.`);
  const warnHtml=warn.length?`<br><br><strong>Warnings:</strong> ${warn.join(' ')}`:'';
  if(J.verdict==='pass'){v.className=warn.length?'verdict weak':'verdict pass';
    v.innerHTML=`<b>Survives deflation${warn.length?' — with warnings':''}</b>${head}Deflated Sharpe ${dsr.toFixed(3)} ≥ 0.95 on ${T.toLocaleString()} bars of returns in excess of simply holding, after ${spent} configurations searched on real data (${used.toFixed(1)} effective on this dataset at measured correlation), skew ${MX.sk.toFixed(2)}, kurtosis ${MX.ku.toFixed(1)}. Annualized excess Sharpe ${annSR.toFixed(2)} against a luck threshold of ${(sr0*Math.sqrt(bpy)).toFixed(2)}. Next step is paper validation with actual execution costs. This calculation does not establish live readiness.${warnHtml}`;}
  else{v.className='verdict fail';
    v.innerHTML=`<b>Indistinguishable from luck</b>${head}Deflated Sharpe ${dsr.toFixed(3)}, below the 0.95 bar. Annualized excess Sharpe ${annSR.toFixed(2)} against a luck threshold of ${(sr0*Math.sqrt(bpy)).toFixed(2)}.${over?' You are also over budget — every further trial raises this bar.':''} Log the kill.${warnHtml}`;}
  v.innerHTML+=powerLine;
  renderActionPanel(ctx,cfg,v.className.indexOf('pass')>=0,lockMatch);
}
/* The concrete order the evaluated rule implies right now, per asset, from
   current data. Framed by whether the rule actually passed: a fail shows the
   same mechanics under a clear "did not survive testing" banner so nobody
   trades a rejected rule by reading the levels and skipping the verdict. */
function renderActionPanel(ctx,cfg,passed,lockMatch){
  const el=document.getElementById('actionPanel');if(!el)return;
  if(!ctx||!ctx.datasets||!ctx.datasets.length||!ctx.datasets[0].bars){el.innerHTML='';return}
  const rows=ctx.datasets.map(d=>{const A=nextAction(d.bars,ctx.st,ctx.p,cfg);
    const stateColour=A.inPosition?'var(--live)':'var(--muted)';
    return `<div style="border-top:1px solid var(--line);padding:10px 0">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <strong>${esc(d.name)}</strong>
        <span style="color:${stateColour}">Model as of ${esc(A.date)}: <strong>${A.inPosition?'IN A POSITION':'FLAT'}</strong> · dataset close ${esc(fmt(A.lastClose))}</span></div>
      <div style="margin-top:4px">${esc(A.trigger)}</div>
      <div style="margin-top:4px;color:var(--muted);font-size:12.5px">${esc(A.bracketNote)}${A.inPosition?'':' Entry fills at the close that triggers it, not necessarily today\'s price — recompute the bracket from that close.'}</div>
    </div>`}).join('');
  const banner=passed
    ? `<div class="verdict weak" style="margin:0"><b>Historical model state · paper review only</b>The rule survived this statistical calculation. These levels describe the loaded dataset, which may be old or synthetic. The model assumes fills at the signal close; an order placed after that close cannot obtain it retroactively. This does not verify a live position, untouched data, or an executable opportunity.</div>`
    : `<div class="verdict fail" style="margin:0"><b>What this rule would say — but it did NOT survive testing</b>Shown for completeness only. The verdict above is a fail, so this is not a rule to trade. Reading the levels and ignoring the verdict is exactly the mistake this tool exists to prevent.</div>`;
  const sizing=passed?'<p class="note">Use the <a href="edge-lab-v7.html#control">daily desk capital planner</a> for fee-aware sizing against current equity, cash and open risk. A backtest pass never overrides the experiment loss limits.</p>':'';
  el.innerHTML=`<div style="margin-top:20px">${banner}${rows}${sizing}</div>`;
}
/* Position size tied to the stored budget and the app's own risk framing.
   Deliberately conservative: risk a small fixed % of the $5,000, and never
   present this as an account-level guarantee. */
function sizingLine(cfg,nAssets){
  const acct=5000, riskPct=0.02, stop=cfg.stp;   // 2% of account at risk per trade
  if(!(stop>0))return '';
  const k=Math.max(1,nAssets||1);
  const riskDollars=acct*riskPct/k, notional=riskDollars/stop;
  const per=k>1?` per asset (the ${(riskPct*100).toFixed(0)}% budget split across ${k} coins, since a pool can hold all ${k} at once)`:'';
  return `<div style="border-top:1px solid var(--line);padding:10px 0;color:var(--muted);font-size:12.5px">
    <strong style="color:var(--ink)">Sizing (illustrative):</strong> risking ${fmt(riskDollars)}${per} (2% of a ${fmt(acct)} account total) against a ${(stop*100).toFixed(1)}% stop means about <strong style="color:var(--ink)">${fmt(notional)}</strong> per position. A clean stop-out loses ~${fmt(riskDollars)}; a gap through the stop loses more. This is illustrative, not an enforced account loss limit.</div>`;
}


/* ============ pool (UI) ============ */
let POOL=[];
let _saveT=null;function saveDataSoon(){clearTimeout(_saveT);_saveT=setTimeout(saveData,400)}
const poolActive=()=>document.getElementById('poolOn').checked&&POOL.length>=2;
function poolSync(){
  ACTIVE_COMPS=poolActive()?POOL.map(p=>p.tag):null;
  const el=document.getElementById('poolInfo');
  if(!POOL.length){el.textContent='Pool is empty.';}
  else{const bpy=barsPerYear(POOL[0].bars);let lo=Infinity,hi=-Infinity;
    POOL.forEach(p=>{const b=p.bars;if(b[0].t!=null){lo=Math.min(lo,b[0].t);hi=Math.max(hi,b[b.length-1].t)}});
    const span=isFinite(lo)?((hi-lo)/31557600).toFixed(1)+' years spanned':'';
    el.innerHTML=POOL.map((p,i)=>`<strong>${esc(p.name)}</strong> ${p.bars.length.toLocaleString()} bars (${esc(p.bars[0].d)} → ${esc(p.bars[p.bars.length-1].d)}) <button type="button" class="act sec" data-remove-asset="${i}" aria-label="Remove ${esc(p.name)}">Remove</button>`).join('<br>')+
      `<br>${span}${POOL.length<2?' — add at least one more asset to pool.':''}${poolActive()?' — <strong>tests run on the pool</strong>.':''}`;}
  refreshHeader();
}
document.getElementById('poolInfo').addEventListener('click',e=>{
  const button=e.target.closest('[data-remove-asset]');if(!button||DATA_BUSY||RUNNING||LOCKING)return;
  POOL.splice(Number(button.dataset.removeAsset),1);
  if(POOL.length<2)document.getElementById('poolOn').checked=false;
  poolSync();
});
document.getElementById('poolAdd').addEventListener('click',()=>{
  if(!BARS){alert('Load a dataset first, then add it.');return}
  if(POOL.some(p=>p.tag===DATA_TAG&&(DATA_TAG!=='synthetic'||p.bars===BARS))){alert('That dataset is already in the pool.');return}
  const name=(document.getElementById('poolName').value.trim()||DATA_TAG).slice(0,40);
  if(POOL.some(p=>p.name===name)){alert('Pick a different name — "'+name+'" is already in the pool.');return}
  const err=POOL.length?poolCheck([POOL[0].bars,BARS]):null;
  if(err){alert(err);return}
  POOL.push({name:name,tag:DATA_TAG,bars:BARS});document.getElementById('poolName').value='';poolSync();saveData();
});
document.getElementById('poolClear').addEventListener('click',()=>{POOL=[];document.getElementById('poolOn').checked=false;poolSync();saveData()});
document.getElementById('poolOn').addEventListener('change',()=>{saveDataSoon();
  if(document.getElementById('poolOn').checked&&POOL.length<2){alert('Add at least two datasets to the pool first.');document.getElementById('poolOn').checked=false}
  poolSync();
});

// Fingerprints catch accidental changes, not malicious tampering with local files.
function dataSnapshots(){return (poolActive()?POOL:[{tag:DATA_TAG,bars:BARS}]).map(q=>({tag:q.tag,
  count:q.bars.length,first:q.bars[0].d,last:q.bars[q.bars.length-1].d,
  fingerprint:fnv(JSON.stringify(q.bars.map(b=>[b.t,b.d,b.o,b.h,b.l,b.c])))}))}
function lockPayload(sweep,st,p,cfg,why){return{data:poolActive()?'pool['+POOL.map(q=>q.name).join('+')+']':DATA_TAG,
  comps:activeComps().slice(),st:st,p:p,cfg:cfg,why:why,sweep:!!sweep,snapshots:dataSnapshots()}}
function cleanLock(l){if(!l||typeof l!=='object'||!l.id||!l.locked||!l.data||!l.st)return null;
  return{id:String(l.id),locked:String(l.locked),data:String(l.data),comps:Array.isArray(l.comps)?l.comps.map(String):[],st:String(l.st),
    p:l.p&&typeof l.p==='object'?l.p:{},cfg:l.cfg&&typeof l.cfg==='object'?l.cfg:{},why:String(l.why||''),sweep:!!l.sweep,sig:String(l.sig||''),
    snapshots:Array.isArray(l.snapshots)?l.snapshots:undefined}}
function renderLocks(){const el=document.getElementById('lockList');if(!el)return;
  el.innerHTML=!LOCKS.length?'':`<div class="note" style="margin-top:14px"><strong>Locked hypotheses: ${LOCKS.length}</strong><br>`+
    LOCKS.slice().reverse().map(l=>`${esc(l.id)} · ${esc(l.locked)} · ${esc(l.data)} · ${esc(l.st.toUpperCase())} ${esc(Object.entries(l.p).map(([k,v])=>k+'='+v).join(' '))}`).join('<br>')+'</div>'}
document.getElementById('deactivateLock').addEventListener('click',()=>{
  if(RUNNING||LOCKING||DATA_BUSY)return;
  CURRENT_LOCK=null;document.getElementById('lockState').textContent='No active lock. Previous lock records are retained; unlocked runs are exploratory.';
});
document.getElementById('lockHyp').addEventListener('click',async()=>{
  if(LOCKING||RUNNING||DATA_BUSY)return;
  if(!READY){alert('Still loading saved research history.');return}if(!BARS&&!poolActive()){alert('Load the exact dataset first.');return}
  const st=document.getElementById('strat').value,p=readParams(),why=document.getElementById('note').value.trim();
  const cfg={tgt:parseFloat(tgt.value)/100,stp:parseFloat(stp.value)/100,hold:parseInt(hold.value),cost:parseFloat(cost.value)/100,mode:document.getElementById('xmode').value};
  if(!why||Object.values(p).some(v=>!isFinite(v))||![cfg.tgt,cfg.stp,cfg.hold,cfg.cost].every(v=>isFinite(v)&&v>=0)||cfg.stp<=0||cfg.hold<1){alert('Complete the rule, valid exits and mechanism first.');return}
  poolSync();
  const payload=lockPayload(false,st,p,cfg,why),sig=fnv(JSON.stringify(payload));
  const l={id:'H-'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)+'-'+sig.slice(0,6),locked:new Date().toISOString(),...payload,sig:sig};
  LOCKING=true;CURRENT_LOCK=null;LOCKS.push(l);
  try{const saved=await S.set('locks',LOCKS);CURRENT_LOCK=l;renderLocks();autoSaveIfNeeded();
    document.getElementById('lockState').innerHTML=`<strong>Locked ${esc(l.id)}</strong> ${esc(l.data)}. Rule and exact OHLC snapshot recorded. ${saved?'Saved.':'Not saved persistently — copy the manual backup before closing.'} Changing inputs or data breaks the match; old locks stay in history.`;
  }finally{LOCKING=false}
});

async function doRun(sweep){
  if(RUNNING||LOCKING||DATA_BUSY)return;
  if(!READY){alert('Still loading your saved register — try again in a moment.');return}
  const pooled=poolActive();
  if(!pooled&&!BARS){alert('Load or generate data first.');return}
  poolSync();
  const st=document.getElementById('strat').value;
  const cfg={tgt:parseFloat(tgt.value)/100,stp:parseFloat(stp.value)/100,
             hold:parseInt(hold.value),cost:parseFloat(cost.value)/100,mode:document.getElementById('xmode').value};
  if(![cfg.tgt,cfg.stp,cfg.hold,cfg.cost].every(v=>isFinite(v)&&v>=0)||!(cfg.stp>0)||!(cfg.hold>=1)){alert('Exit settings must be positive numbers.');return}
  const why=document.getElementById('note').value.trim();
  if(!why){alert('State the mechanism first. That field is the whole point.');return}
  let p=readParams();
  if(Object.values(p).some(v=>!isFinite(v))){alert('Fill in every strategy parameter.');return}
  const proposed=lockPayload(sweep,st,p,cfg,why);
  const matched=CURRENT_LOCK&&CURRENT_LOCK.sig===fnv(JSON.stringify(proposed));
  const matchedId=matched?CURRENT_LOCK.id:null;
  if(CURRENT_LOCK&&!matched){alert('This lock does not match the current rule or price data. Create a new lock before running.');return}
  const finish=beginDataLoad();RUNNING=true;
  try{
  const fam=sweep?sweepSet(st):[p];
  const FS=pooled?familyStatsPooled(POOL.map(q=>q.bars),st,fam,cfg,sweep):familyStats(BARS,st,fam,cfg,sweep);
  const res=FS.res,rho=FS.rho,dec=FS.dec,famSR=FS.famSR,varSR=FS.varSR,W=FS.W,bpy=FS.bpy;
  p=FS.p;
  const label=(sweep?'sweep winner ':'')+Object.entries(p).map(([k,v])=>k+'='+v).join(' ')+(pooled?' · pooled '+POOL.map(q=>q.name).join('+'):'');
  const annSR=sharpe(W.x)*Math.sqrt(bpy);
  HYP.push({id:'T-'+String(HYP.length+1).padStart(3,'0')+'-'+Math.random().toString(36).slice(2,6),t:new Date().toISOString().slice(0,10),
    st:st,p:p,spent:fam.length,why:why,n:W.n,
    sr:W.n?annSR.toFixed(3):null,srBasis:'annualized excess-vs-hold, per bar',pbo:res?res.pbo.toFixed(3):null,
    ret:dec&&dec.isSR>0?(dec.osSR/dec.isSR).toFixed(2):null,
    rho:+rho.toFixed(3),data:pooled?'pool['+POOL.map(q=>q.name).join('+')+']':DATA_TAG,comps:activeComps().slice(),cfg:cfg,lockId:matchedId,snapshots:proposed.snapshots});
  // Consume before the first await: a double click must not reuse a lock.
  if(matched){CURRENT_LOCK=null;document.getElementById('lockState').innerHTML='<strong>Lock consumed.</strong> Its linked trial remains in the register.'}
  await S.set('hyp',HYP);refreshHeader();renderHyp();autoSaveIfNeeded();
  document.getElementById('resCard').style.display='block';
  render(res,dec,fam.length,W.tr,cfg,varSR,famSR.length,label,rho,W.x,sweep,bpy,FS,!!matched,{pooled:pooled,datasets:pooled?POOL.map(q=>({name:q.name,bars:q.bars})):[{name:DATA_TAG,bars:BARS}],p:p,st:st});
  document.getElementById('resCard').scrollIntoView({behavior:'smooth',block:'start'});
  }finally{RUNNING=false;finish()}
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
    ${kLower<=0?`<div class="verdict fail"><b>No size is justified</b>At the lower bound of your confidence interval (${(lo*100).toFixed(1)}%) this rule has no edge at ${b}:1. ${n} trades is not enough to rule that out. Continue paper observation.</div>`
    :`<div class="verdict pass"><b>Theoretical Kelly calculation · not a position size</b>Half-Kelly estimate: <strong>${(Math.max(0,kLower)/2*100).toFixed(1)}% of capital</strong> per trade — half-Kelly computed on the CI lower bound, i.e. ${(C*Math.max(0,kLower)/2).toFixed(0)} dollars of ${C.toLocaleString()}.
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
   HYP.slice().reverse().map(h=>`<tr><td class="n">${esc(h.id)}</td><td class="n">${esc(h.t)}</td>
     <td>${esc(String(h.st||'').toUpperCase())} ${esc(Object.entries(h.p||{}).map(([k,v])=>k+'='+v).join(' '))}${h.data&&h.data!=='synthetic'?' <span style="color:var(--muted);font-size:10.5px">'+esc(h.data)+'</span>':''}<br>
     <span style="color:var(--muted);font-size:11.5px">${esc(String(h.why||'').slice(0,80))}${String(h.why||'').length>80?'…':''}${h.lockId?' · locked '+esc(h.lockId):''}${h.repair?' · history repair':''}</span></td>
     <td class="n">${esc(h.spent||1)}${!isReal(h)?'<br><span style="color:var(--muted);font-size:10.5px">practice</span>':''}</td><td class="n">${esc(h.n)}</td><td class="n">${esc(h.sr??'—')}${h.sr!=null&&!String(h.srBasis||'').startsWith('annualized')?'<span title="older entry: per-trade Sharpe, not comparable" style="color:var(--muted)">*</span>':''}</td>
     <td class="n">${esc(h.pbo??'—')}</td><td class="n">${esc(h.ret??'—')}</td></tr>`).join('')+'</tbody></table>';
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
    TRADES.slice().reverse().map(t=>`<tr><td class="n">${esc(t.d)}</td><td>${esc(t.sym)}</td><td class="n">${esc(t.rule||'—')}</td>
      <td class="n" style="color:${num2(t.slip)>0.2?'var(--kill)':'inherit'}">${num2(t.slip)==null?'—':num2(t.slip).toFixed(2)}</td>
      <td class="n" style="color:${num2(t.pnl)>=0?'var(--live)':'var(--kill)'}">${num2(t.pnl)==null?'—':'$'+num2(t.pnl).toFixed(0)}</td></tr>`).join('')+'</tbody></table>';
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
document.getElementById('docBody').innerHTML=`
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
<p class="hint" style="margin:6px 0 14px"><strong>(p) Power is now reported, not hidden.</strong> Power is set by years of data and how many things you searched — not by the statistic. Measuring per bar instead of per trade gave the same power in simulation (16% vs 18% on a strong planted edge) but far more stable skew and kurtosis estimates (3,400 observations instead of ~30), so every statistic now runs on the same drift-adjusted per-bar stream. Every verdict now states the smallest annualized excess Sharpe it could detect with ~80% probability. On 9.3 years of BTC: <strong>0.81 for one pre-registered test, about 1.75 for any sweep</strong>. <strong>(q) Pre-registered tests.</strong> A single configuration that is the only trial ever run on a dataset is judged with no deflation — the most powerful test this data allows. <strong>(r) Trials now count per dataset</strong> (entries from before tagging count as bundled BTC, where they were run). <strong>(s) Input validation</strong> on exit and strategy fields. <strong>(u) PBO and forward retention no longer veto.</strong> The Deflated Sharpe alone passed 0 of 95 null series in simulation (plain and fat-tailed, with BTC-like drift), while the two vetoes cut detection of a real Sharpe-1.05 edge from 19 of 25 to 1 of 25. They now appear as warnings on the verdict. <strong>(v) Breakout exits.</strong> The breakout signal was an event (true only on the breakout bar), so signal-off exits closed every breakout the next day. It is now a Donchian channel state: on at a close above the prior N-bar high, off at a close below the prior N/2-bar low. <strong>(w) Default cost 1.0% round trip</strong> — a historical research assumption. Verify your own fee tier and order preview. <strong>(x) Cloud save self-test</strong> on load. <strong>(t) The 20-trade minimum was destroying power.</strong> Signal-off exits hold strong trends for a long time, so strong edges produce <em>fewer</em> trades; in simulation 74% of runs with a strong planted edge had under 20 trades and were thrown out (8% detected). The statistic is per bar now, so the minimum is 10 trades: 72% detected, still 0 of 100 false passes.</p>
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
  document.getElementById('csv').placeholder='Paste SOL-USD daily OHLC here. From CryptoDataDownload, TradingView, or Kraken export — requires date, open, high, low and close columns.';
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
    <br><br><em>This series ends April 2024 on purpose-adjacent grounds: everything after it is data you have never looked at, which makes it a genuine holdout when you want one later.</em></div>`;
  document.getElementById('dataInfo').innerHTML=`<strong>${BARS.length} bars loaded</strong> — BTC/USD, ${BARS[0].d} to ${BARS[BARS.length-1].d}.`;
  saveData();
});
/* Persist loaded data so a reload keeps the working series and the pool, not
   just the register. Bars are stored compactly (t + OHLC arrays) to stay well
   under the storage value cap; synthetic data is never persisted. */
const MAX_PERSIST_BARS=6000;
function packBars(bars){return {t:bars.map(b=>b.t),o:bars.map(b=>b.o),h:bars.map(b=>b.h),l:bars.map(b=>b.l),c:bars.map(b=>b.c)}}
function unpackBars(z,gran){if(!z||!Array.isArray(z.c))return null;const out=[];
  for(let i=0;i<z.c.length;i++){const t=z.t[i];const dsec=(gran||86400)>=86400?10:19;
    out.push({t:t,d:new Date(t*1000).toISOString().slice(0,dsec).replace('T',' '),o:z.o[i],h:z.h[i],l:z.l[i],c:z.c[i]})}
  return out}
function granOf(bars){return bars&&bars.length>1?Math.round(bars[1].t-bars[0].t):86400}
async function saveData(){
  try{
    const single=(BARS&&DATA_TAG&&DATA_TAG!=='synthetic'&&BARS.length<=MAX_PERSIST_BARS&&BARS[0].t!=null)
      ? {tag:DATA_TAG,gran:granOf(BARS),z:packBars(BARS)} : null;
    const pool=POOL.filter(p=>p.bars&&p.bars.length<=MAX_PERSIST_BARS&&p.bars[0].t!=null&&p.tag!=='synthetic')
      .map(p=>({name:p.name,tag:p.tag,gran:granOf(p.bars),z:packBars(p.bars)}));
    await S.setDoc('datasets',{single:single,pool:pool,poolOn:document.getElementById('poolOn').checked});
  }catch(e){}
}
async function restoreData(){
  const D=await S.getDoc('datasets',null); if(!D)return false;
  try{
    if(D.single&&D.single.z){const b=unpackBars(D.single.z,D.single.gran);if(b&&b.length){BARS=b;DATA_TAG=D.single.tag}}
    if(Array.isArray(D.pool)&&D.pool.length){POOL=D.pool.map(p=>({name:p.name,tag:p.tag,bars:unpackBars(p.z,p.gran)})).filter(p=>p.bars&&p.bars.length);}
    if(D.poolOn&&POOL.length>=2){const el=document.getElementById('poolOn');if(el)el.checked=true}
    return !!(BARS||POOL.length);
  }catch(e){return false}
}
function beginDataLoad(){
  if(DATA_BUSY||RUNNING||LOCKING)return null;
  DATA_BUSY=true;
  const controls=[...document.querySelectorAll('#p-lab button,#p-lab input,#p-lab select,#p-lab textarea')].map(el=>[el,el.disabled]);
  controls.forEach(([el])=>el.disabled=true);
  return()=>{controls.forEach(([el,disabled])=>el.disabled=disabled);DATA_BUSY=false};
}
document.getElementById('fetchData').addEventListener('click',async()=>{
  const finish=beginDataLoad();if(!finish)return;
  const btn=document.getElementById('fetchData'),out=document.getElementById('fetchOut');
  const pair=dPair.value,gran=parseInt(dGran.value),want=parseInt(dDays.value);
  btn.disabled=true; out.innerHTML='<div class="note">Contacting Coinbase…</div>';
  try{
    const b=await fetchCandles(pair,gran,want,(got,i,tot)=>{
      out.innerHTML=`<div class="note">Fetched <strong>${got}</strong> bars — request ${i} of ${tot}…</div>`});
    if(b.length<60)throw new Error(`Only ${b.length} bars returned — not enough to test on.`);
    const issues=validateBars(b,gran);
    BARS=b;DATA_TAG=pair+' '+gran+'s';poolSync();saveData();
    const years=(b.length*gran/31557600).toFixed(2);
    out.innerHTML=`<div class="verdict ${issues.length?'weak':'pass'}">
      <b>${b.length} bars loaded</b>${pair}, ${b[0].d} to ${b[b.length-1].d} — about ${years} years.
      ${issues.length?'<br><br><strong>Data warnings:</strong> '+issues.join('; ')+'. Gaps are normal around exchange outages; impossible OHLC values are not and mean you should not trust this series.'
        :'<br><br>Integrity checks passed: high/low bracket open/close on every bar, no duplicates, no gaps.'}
      ${gran>=86400?`<br><br>At ${years} years your search budget is <strong>${budgetN(Math.max(parseFloat(years),0.25),BUDGET?BUDGET.sr:1)} independent configurations</strong> at a target Sharpe of ${BUDGET?BUDGET.sr:1}. Set it on the Budget tab before you start testing.`:''}
    </div>`;
    document.getElementById('dataInfo').innerHTML=`<strong>${b.length} bars</strong> — ${pair}, ${b[0].d} to ${b[b.length-1].d}.`;
  }catch(e){
    out.innerHTML=`<div class="verdict fail"><b>Fetch failed</b>${esc(e.message)}<br><br>Previous data retained. Hosted pages may block exchange requests; API errors and outages are also possible. Retry or use CSV paste.</div>`;
  }finally{finish()}
});
document.getElementById('refreshMarkets').addEventListener('click',async()=>{
  const finish=beginDataLoad();if(!finish)return;
  const btn=document.getElementById('refreshMarkets'),out=document.getElementById('marketOut'),pairs=COINS.map(c=>c.id);
  const next=[],warnings=[];
  try{for(let i=0;i<pairs.length;i++){const pair=pairs[i];out.innerHTML=`<div class="note">${i+1}/${pairs.length} · fetching ${esc(pair)}…</div>`;
      const b=await fetchCandles(pair,86400,1800,()=>{});if(b.length<300)throw new Error(pair+' returned only '+b.length+' bars');
      const issues=validateBars(b,86400);if(issues.some(x=>x.indexOf("don't bracket")>=0||x.indexOf('non-positive')>=0))throw new Error(pair+': '+issues.join('; '));
      issues.forEach(x=>warnings.push(pair+': '+x));
      if(b[b.length-1].t<Math.floor(Date.now()/86400000)*86400-86400)warnings.push(pair+': latest completed daily candle is missing');
      next.push({name:coinName(pair),tag:pair+' 86400s',bars:b})}
    POOL=next;BARS=next[0].bars;DATA_TAG=next[0].tag;
    document.getElementById('poolOn').checked=true;poolSync();saveData();
    document.getElementById('dataInfo').textContent='Daily pool loaded. Single-asset data / CSV download: BTC-USD, '+BARS.length+' completed bars.';
    out.innerHTML=`<div class="verdict ${warnings.length?'weak':'pass'}"><b>Daily market pool ready</b>${POOL.map(p=>esc(p.name)+' '+p.bars.length+' bars through '+esc(p.bars[p.bars.length-1].d)).join('<br>')}${warnings.length?'<br><strong>Warnings:</strong> '+esc(warnings.join('; ')):''}<br><br>Completed candles only. No strategy was run and no trial was spent.</div>`;
  }catch(e){out.innerHTML=`<div class="verdict fail"><b>Refresh failed</b>${esc(e.message)}. Previous data and pool retained; partial downloads discarded.</div>`}finally{finish()}
});
document.getElementById('dlCsv').addEventListener('click',()=>{
  if(!BARS){alert('No data loaded yet.');return}
  saveFile('ohlc.csv',toCsv(BARS),'text/csv');
});
document.getElementById('genData').addEventListener('click',()=>{BARS=synth(900);DATA_TAG='synthetic';
  document.getElementById('dataInfo').innerHTML='<strong>900 synthetic bars loaded.</strong> Driftless random walk — no edge exists here. Anything you find is noise, which makes it the safest place to learn the workflow.'});
document.getElementById('loadCsv').addEventListener('click',()=>{
  try{
    BARS=parseCsv(document.getElementById('csv').value);
    DATA_TAG='csv '+BARS[0].d+'..'+BARS[BARS.length-1].d+' ('+BARS.length+')';
    const gran=BARS.length>1?Math.round(BARS[1].t-BARS[0].t):86400;
    const issues=validateBars(BARS,gran>0?gran:86400);
    const miss=BARS._missing&&BARS._missing.length?BARS._missing:null;
    const years=(BARS.length*(gran>0?gran:86400)/31557600).toFixed(2);
    document.getElementById('fetchOut').innerHTML=`<div class="verdict ${issues.length||miss?'weak':'pass'}">
      <b>${BARS.length} bars parsed</b>${esc(BARS[0].d)} to ${esc(BARS[BARS.length-1].d)} — about ${years} years.
      ${miss?'<br><br><strong>Columns missing:</strong> '+esc(miss.join(', '))+'. Close was substituted, so stops and targets will not trigger intrabar and results will be optimistic.':''}
      ${issues.length?'<br><br><strong>Data warnings:</strong> '+esc(issues.join('; '))+'.':'<br><br>Integrity checks passed.'}
      <br><br>At ${years} years your budget is <strong>${budgetN(Math.max(parseFloat(years),0.25),BUDGET?BUDGET.sr:1)} independent configurations</strong> at a target Sharpe of ${BUDGET?BUDGET.sr:1}.</div>`;
    document.getElementById('dataInfo').innerHTML=`<strong>${BARS.length} bars loaded</strong> — ${esc(BARS[0].d)} to ${esc(BARS[BARS.length-1].d)}.`;
    saveData();
  }catch(e){document.getElementById('fetchOut').innerHTML=
    `<div class="verdict fail"><b>Could not parse</b>${esc(e.message)}</div>`}});
document.getElementById('addTrade').addEventListener('click',async()=>{
  if(!READY)return;
  const e=parseFloat(jExp.value),a=parseFloat(jAct.value),x=parseFloat(jExit.value),
        s=parseFloat(jSize.value),f=jFee.value.trim()===''?0:Number(jFee.value);
  if(![e,a,x,s].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(f)||f<0){alert('Size and prices must be positive; fees must be zero or positive.');return}
  TRADES.push({d:new Date().toISOString().slice(0,10),sym:jSym.value||'—',rule:jRule.value,
    slip:(jDir.value==='Long'?1:-1)*(a-e)/e*100,pnl:(jDir.value==='Long'?1:-1)*(x-a)*(s/a)-f,ret:((jDir.value==='Long'?1:-1)*(x-a)*(s/a)-f)/s});
  await S.set('trades',TRADES);renderJrn();autoSaveIfNeeded();[jExp,jAct,jExit].forEach(i=>i.value='')});
document.getElementById('clrHyp').addEventListener('click',async()=>{
  if(!READY||RUNNING||LOCKING)return;
  if(confirm('Clearing the register resets your deflation factor and destroys the record. Sure?')){
    HYP=[];CURRENT_LOCK=null;await S.clear('hyp');refreshHeader();renderHyp();autoSaveIfNeeded()}});
document.getElementById('repairAdd').addEventListener('click',async()=>{
  if(!READY||RUNNING)return;
  const spent=Number(document.getElementById('repairSpent').value),data=document.getElementById('repairData').value.trim(),why=document.getElementById('repairWhy').value.trim();
  if(!Number.isSafeInteger(spent)||spent<1||!data||!why||data==='synthetic'){alert('Real dataset, positive whole config count and reconstruction note are required.');return}
  HYP.push({id:'R-'+String(HYP.length+1).padStart(3,'0')+'-'+Math.random().toString(36).slice(2,6),t:document.getElementById('repairDate').value||new Date().toISOString().slice(0,10),
    st:document.getElementById('repairFamily').value.trim()||'unknown',p:{},spent:spent,why:why,n:0,sr:null,pbo:null,ret:null,rho:0,data:data,comps:[data],repair:true});
  await S.set('hyp',HYP);refreshHeader();renderHyp();autoSaveIfNeeded();
});
document.getElementById('clrJrn').addEventListener('click',async()=>{
  if(!READY)return;
  if(confirm('Delete all logged trades?')){TRADES=[];await S.clear('trades');renderJrn();autoSaveIfNeeded()}});

async function exportState(){
  if(!READY)return;
  const blob={format:'edge-lab',version:3,exported:new Date().toISOString(),
              budget:BUDGET,hyp:HYP,locks:LOCKS,trades:TRADES};
  document.getElementById('manualSave').value=JSON.stringify(blob);
  const saved=await saveFile(`edge-lab-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(blob,null,2),'application/json');
  document.getElementById('ioOut').innerHTML=
    saved?`<div class="verdict pass"><b>Download requested</b>${spentTotal()} configurations, ${LOCKS.length} locks and ${TRADES.length} trades. Check your downloads; the browser may still block saving.</div>`:
    '<div class="verdict fail"><b>Download unavailable or cancelled</b>Copy the current JSON from the manual backup box below.</div>';
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
                budget:BUDGET,hyp:HYP,locks:LOCKS,trades:TRADES};
    const box=document.getElementById('manualSave');
    if(box&&document.activeElement!==box){
      box.value=JSON.stringify(blob);
      const w=document.getElementById('storeWarn');
      if(w){const n=w.querySelector('#asNote'); if(n)n.textContent=
        ` Updated just now — ${spentTotal()} configs, ${TRADES.length} trades. Copy the box below before you leave.`;}
    }
  },600);
}
async function importState(text){
  if(!READY||RUNNING||LOCKING)return;
  const io=document.getElementById('ioOut');
  let o; try{o=JSON.parse(text)}catch(e){
    io.innerHTML='<div class="verdict fail"><b>Could not read that file</b>It is not valid JSON.</div>';return}
  if(!o||typeof o!=='object'||Array.isArray(o)||o.format!=='edge-lab'){
    io.innerHTML='<div class="verdict fail"><b>Wrong file</b>That is not an Edge Lab export.</div>';return}
  // Dedupe on the full entry, not the id: two sessions both minted "T-001"
  // for different trials, and id-only dedupe silently dropped real trials.
  const haveH=new Set(HYP.map(hsig));
  let addedH=0,skipped=0;
  (Array.isArray(o.hyp)?o.hyp:[]).forEach(h0=>{const h=cleanHyp(h0);if(!h){skipped++;return}
    if(!haveH.has(hsig(h))){HYP.push(h);haveH.add(hsig(h));addedH++} });
  const sig=tsig;
  const haveT=new Set(TRADES.map(sig));
  let addedT=0;
  (Array.isArray(o.trades)?o.trades:[]).forEach(t0=>{const t=cleanTrade(t0);if(!t){skipped++;return}
    if(!haveT.has(sig(t))){TRADES.push(t);haveT.add(sig(t));addedT++} });
  const haveL=new Set(LOCKS.map(lsig));let addedL=0;
  (Array.isArray(o.locks)?o.locks:[]).forEach(l0=>{const l=cleanLock(l0);if(!l){skipped++;return}
    if(!haveL.has(lsig(l))){LOCKS.push(l);haveL.add(lsig(l));addedL++} });
  if(o.budget&&!BUDGET){const b=o.budget;
    if([b.years,b.sr,b.rho,b.N].every(v=>typeof v==='number'&&Number.isFinite(v))&&b.years>0&&b.sr>0&&b.rho>=0&&b.rho<1&&b.N>=1){BUDGET=b;bY.value=b.years;bSR.value=b.sr;bRho.value=b.rho}else skipped++}
  await S.set('hyp',HYP); await S.set('trades',TRADES);await S.set('locks',LOCKS); if(BUDGET)await S.set('budget',BUDGET);
  refreshHeader();renderHyp();renderJrn();renderLocks();autoSaveIfNeeded();
  io.innerHTML=`<div class="verdict pass"><b>Merged</b>Added ${addedH} register entries and ${addedT} trades; ${addedL} hypothesis locks. Total now <strong>${spentTotal()} configurations searched</strong> across ${HYP.length} entries.${skipped?` Skipped ${skipped} malformed item${skipped>1?'s':''}.`:''}</div>`;
}
document.getElementById('expState').addEventListener('click',exportState);
document.getElementById('impState').addEventListener('click',()=>document.getElementById('impFile').click());
document.getElementById('impText').addEventListener('click',()=>importState(document.getElementById('manualSave').value));
document.getElementById('impFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader(); rd.onload=()=>importState(rd.result); rd.readAsText(f);
  e.target.value='';
});

function fillCoinDropdown(){const sel=document.getElementById('dPair');if(!sel)return;
  sel.innerHTML=COINS.map(c=>`<option value="${c.id}">${c.id} (${c.name})</option>`).join('');}
(async()=>{drawParams();fillCoinDropdown();
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
  HYP=await S.get('hyp',[]);TRADES=await S.get('trades',[]);LOCKS=await S.get('locks',[]);BUDGET=await S.get('budget',null);
  const restored=await restoreData();
  if(restored){poolSync&&poolSync();
    if(BARS)document.getElementById('dataInfo').innerHTML=`<strong>${BARS.length} bars restored</strong> — ${esc(BARS[0].d)} to ${esc(BARS[BARS.length-1].d)}. Reloaded from your last session.`;
    else if(POOL.length)document.getElementById('dataInfo').innerHTML=`<strong>Pool of ${POOL.length} restored</strong> from your last session.`;}
  if(BUDGET){bY.value=BUDGET.years;bSR.value=BUDGET.sr;bRho.value=BUDGET.rho}
  READY=true;refreshHeader();renderHyp();renderJrn();renderLocks();autoSaveIfNeeded()})();
