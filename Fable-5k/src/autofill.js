/* ============ Autofill and linked inputs ============
   One source for each number, flowing to every place that uses it:
   - Fees and slippage: typed once (or read from your Coinbase fee tier) and mirrored to
     Capital plan, Execution and the Test round-trip cost, in both tools.
   - Capital plan: live mid price, 30-day-low stop (the H2 exit level) and half-spread slippage
     from public data; equity, cash, open stop risk, high-water mark and fee tier from a
     View-only Coinbase key read by the local launcher. The plan then calculates itself.
   - Journal: prefilled from the last plan; completed round trips import from Coinbase fills.
   - Sizing: wins, trades and reward:risk counted from the Journal. Budget: years of loaded data.
   Rules: never overwrite a field you typed in (clear it to hand it back to autofill); never feed
   the locked study, scanner or verdict logic; the key never reaches this page. */
(function(){
  const $=id=>document.getElementById(id);
  const onLauncher=location.protocol==='http:'&&(location.hostname==='127.0.0.1'||location.hostname==='localhost');
  const isDesk=!!$('planRisk');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Number.isFinite(n)?'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const round=(n,d)=>Math.round(n*10**d)/10**d;
  const LS={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  const K={costs:'fable-shared:costs',equity:'fable-shared:equity',hwm:'fable-desk:hwm',plans:'fable-desk:plans',elog:'fable-desk:equity-log',deposits:'fable-desk:net-deposits',expOnly:'fable-desk:experiment-only',logged:'fable-desk:logged-trips',xferDismiss:'fable-desk:transfer-dismissed'};
  const INITIAL=5000;
  const ts=v=>Date.parse(String(v||'').replace(/(\.\d{3})\d+/,'$1'));   // '…:41.395380Z' → '…:41.395Z'

  /* ---- who owns a field: you (typed) or autofill ---- */
  const USER=new Set();
  function setAuto(id,value,source){
    const el=$(id);if(!el||USER.has(id)||value===null||value===undefined||!Number.isFinite(+value))return false;
    el.value=String(value);el.classList.add('autofilled');el.title='Auto: '+source+'. Type to override; clear the field to hand it back.';return true;
  }
  document.addEventListener('input',e=>{const el=e.target;if(!e.isTrusted||!el||!el.id)return;
    if(el.value===''){USER.delete(el.id);const k=LINK_OF[el.id];if(k){const c=costs();if(k.includes('Fee'))delete c.feeSource;else delete c.slipSource;LS.set(K.costs,c)}return}
    USER.add(el.id);el.classList.remove('autofilled');el.title='';
    if(el.id==='rPeak'&&+el.value>0)LS.set(K.hwm,{value:+el.value,at:new Date().toISOString(),typed:true});
    if(LINK_OF[el.id])linkFrom(el.id)},true);

  /* ---- linked costs (shared by both tools) ---- */
  const LINKS={entryFee:['rEF','aEF'],exitFee:['rXF','aXF'],entrySlip:['rES','aES'],exitSlip:['rXS','aXS']};
  const LINK_OF={};Object.entries(LINKS).forEach(([k,ids])=>ids.forEach(id=>LINK_OF[id]=k));
  function costs(){return LS.get(K.costs)||{}}
  function applyCosts(){
    const c=costs(),manualSlip=c.slipSource==='manual';
    for(const [k,ids] of Object.entries(LINKS)){
      if(!Number.isFinite(c[k]))continue;
      if(k.includes('Slip')&&!manualSlip)continue;   // live spread is per asset and per minute: it never becomes a shared setting
      ids.forEach(id=>setAuto(id,c[k],k.includes('Fee')?(c.feeSource==='coinbase'?'Coinbase taker fee':'fee you entered'):'slippage you entered'));
    }
    // Test round-trip cost: fees both legs + your slippage (or 1 bp a side). Stable by design: it only moves when your fee
    // tier or your slippage entry changes, and never while a pre-registered lock is active (the lock signs the cost).
    const locked=typeof CURRENT_LOCK!=='undefined'&&CURRENT_LOCK;
    if(!locked&&Number.isFinite(c.entryFee)&&Number.isFinite(c.exitFee)){
      const slip=manualSlip&&Number.isFinite(c.entrySlip)&&Number.isFinite(c.exitSlip)?c.entrySlip+c.exitSlip:2;
      setAuto('cost',round(c.entryFee+c.exitFee+slip/100,3),'fees both legs + '+(manualSlip?'your slippage':'1 bp slippage a side'));
    }
  }
  function linkFrom(id){
    const k=LINK_OF[id],v=parseFloat($(id).value);if(!k||!Number.isFinite(v)||v<0)return;
    const c=costs();c[k]=v;if(k.includes('Fee'))c.feeSource='manual';else c.slipSource='manual';c.at=new Date().toISOString();LS.set(K.costs,c);
    LINKS[k].filter(x=>x!==id).forEach(x=>{USER.delete(x);setAuto(x,v,'linked to '+id)});
    applyCosts();
  }

  /* ---- network helpers ---- */
  async function getJSON(url,account){
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);
    try{const r=await fetch(url,{credentials:'omit',signal:ctl.signal,headers:account?{Accept:'application/json','X-Fable-Local':'1'}:{Accept:'application/json'}});
      let body=null;try{body=await r.json()}catch(_){}
      if(!r.ok)throw new Error(body&&typeof body.error==='string'?body.error:'HTTP '+r.status);return body}
    catch(e){if(e&&e.name==='AbortError')throw new Error('Request timed out');if(e&&e.name==='TypeError')throw new Error('Launcher not reachable');throw e}
    finally{clearTimeout(t)}
  }
  const tickerURL=p=>onLauncher?'/coinbase-exchange/products/'+p+'/ticker':'https://api.exchange.coinbase.com/products/'+p+'/ticker';

  /* ---- deposits: money you add is not profit ---- */
  const netDeposits=()=>{const v=+(LS.get(K.deposits)?.value);return Number.isFinite(v)?v:0};
  const experimentEquity=()=>SNAP?SNAP.equity-netDeposits():null;
  function applyEquity(){
    if(!SNAP)return;const eq=experimentEquity();if(!(eq>0))return;
    setAuto('rEquity',round(eq,2),netDeposits()?'Coinbase total minus your net deposits':'Coinbase portfolio total');
    const expCash=Math.min(SNAP.cash,eq);USER.has('rCash')||setAuto('rCash',round(expCash,2),expCash<SNAP.cash?'USD + USDC available, capped at experiment equity':'USD + USDC available');
    // Store the raw peak (so deposit corrections are exactly reversible); apply the $5,000 floor only when used.
    const stored=Math.max(LS.get(K.hwm)?.value??-Infinity,eq);LS.set(K.hwm,{value:stored,at:SNAP.asOf});
    setAuto('rPeak',round(Math.max(INITIAL,stored),2),'highest experiment equity recorded here (never below $5,000)');
    LS.set(K.equity,{value:eq,at:SNAP.asOf});
  }

  /* ---- account snapshot (View-only key via launcher) ---- */
  let SNAP=null,ACCOUNT=null;
  async function accountStatus(){
    if(!onLauncher)return ACCOUNT={configured:false,reason:'Open the app through the launcher to connect your account.'};
    try{ACCOUNT=await getJSON('/account/status',true)}catch(e){ACCOUNT={configured:true,ok:false,error:e.message}}
    return ACCOUNT;
  }
  function renderAccount(){
    const out=$('acctOut');if(!out)return;
    if(!SNAP){out.innerHTML=ACCOUNT&&ACCOUNT.configured&&ACCOUNT.error?'<div class="verdict fail"><b>Coinbase account not read</b>'+esc(ACCOUNT.error)+'</div>':'';return}
    const rows=SNAP.positions.map(p=>'<tr><td>'+esc(p.asset)+'</td><td class="n">'+money(p.valueUSD)+'</td><td class="n">'+(p.stops.length?p.stops.map(s=>money(s.stop)).join(', '):'<span class="kill">none</span>')+'</td><td class="n">'+money(p.stopRiskUSD+p.unprotectedUSD)+'</td></tr>').join('');
    out.innerHTML='<div class="note"><strong>Coinbase · View-only</strong> · '+esc(SNAP.asOf)+' · equity '+money(SNAP.equity)+' · cash '+money(SNAP.cash)+' · fee tier '+esc(SNAP.fees.tier||'—')+' (taker '+(SNAP.fees.taker!==null?round(SNAP.fees.taker*100,3)+'%':'—')+', maker '+(SNAP.fees.maker!==null?round(SNAP.fees.maker*100,3)+'%':'—')+')'
      +(rows?'<table style="margin-top:8px"><thead><tr><th>Position</th><th class="n">Value</th><th class="n">Stop orders</th><th class="n">Counted risk</th></tr></thead><tbody>'+rows+'</tbody></table>':'<br>No crypto positions.')
      +(SNAP.unprotectedUSD>0?'<p class="hint" style="margin-top:6px">Positions with no stop order are counted at full value in open risk. Place a stop in Coinbase, or type your own figure in "Existing modeled stop risk".</p>':'')
      +'<div class="row r4" style="margin-top:10px;align-items:end"><div><label for="acctDeposits">Net deposits since start ($)</label><input type="number" id="acctDeposits" step="0.01" value="'+netDeposits()+'"></div>'
      +'<div style="grid-column:span 3" class="hint"><span style="white-space:nowrap">Detect since <input type="date" id="acctSince" value="'+esc(defaultSince())+'" style="width:auto;display:inline-block"> <button class="act sec" type="button" id="acctDetect" style="width:auto">Detect from Coinbase</button></span><div id="acctTransfers"></div>Add every deposit to Main, subtract every withdrawal. Coinbase total '+money(SNAP.equity)+' − net deposits '+money(netDeposits())+' = <strong>experiment equity '+money(experimentEquity())+'</strong>, which Capital plan uses so deposits never count as profit or hide a loss.</div></div>'
      +(TRANSFER_HINT?'<div class="verdict weak" style="margin-top:8px"><b>Coinbase shows '+esc(money(TRANSFER_HINT.net))+' net deposits since '+esc(TRANSFER_HINT.since)+'</b>You have '+esc(money(netDeposits()))+' entered ('+TRANSFER_HINT.n+' transfer'+(TRANSFER_HINT.n>1?'s':'')+' found). Press Detect to see each line, or <button class="act sec" type="button" id="acctUseHint" style="width:auto">Use '+esc(money(TRANSFER_HINT.net))+'</button> <button class="act sec" type="button" id="acctDismissHint" style="width:auto">Keep my figure</button></div>':'')
      +(!LS.get(K.expOnly)&&experimentEquity()>INITIAL*1.5?'<div class="verdict weak" style="margin-top:8px"><b>Experiment equity is '+money(experimentEquity())+'</b>If all of this is challenge money (gains, or deposits you have entered above), confirm once. If the portfolio also holds other money, scope the key to a portfolio that holds only the experiment.<br><button class="act sec" type="button" id="acctExperimentOnly" style="margin-top:8px">All of it is experiment money</button></div>':'')
      +'</div>';
    const dep=$('acctDeposits');if(dep)dep.addEventListener('change',()=>{
      const v=parseFloat(dep.value);if(!Number.isFinite(v)){dep.value=netDeposits();return}
      const delta=v-netDeposits();LS.set(K.deposits,{value:v,at:new Date().toISOString()});
      // A peak recorded before this change included the money just declared: shift it by the same amount.
      const h=LS.get(K.hwm);if(h&&Number.isFinite(h.value))LS.set(K.hwm,{value:h.value-delta,at:new Date().toISOString()});
      ['rEquity','rPeak'].forEach(id=>USER.delete(id));applyEquity();logEquity();TRANSFER_HINT=null;renderAccount();
      $('autoStatus').insertAdjacentHTML('beforeend',' <strong>Net deposits set to '+esc(money(v))+'; high-water mark shifted by '+esc(money(-delta))+'. Check it matches your best experiment equity.</strong>');
      if(['rEquity','rPeak','rCash','rOpen','rEntry','rStop','rEF','rXF','rES','rXS'].every(id=>$(id).value!==''))$('planRisk').click();
    });
    const det=$('acctDetect');if(det)det.addEventListener('click',detectTransfers);
    const hint=$('acctUseHint');if(hint)hint.addEventListener('click',()=>{$('acctDeposits').value=String(round(TRANSFER_HINT.net,2));$('acctDeposits').dispatchEvent(new Event('change'))});
    const dh=$('acctDismissHint');if(dh)dh.addEventListener('click',()=>{LS.set(K.xferDismiss,{net:TRANSFER_HINT.net,at:new Date().toISOString()});TRANSFER_HINT=null;renderAccount()});   // until the Coinbase figure changes
    const conf=$('acctExperimentOnly');if(conf)conf.addEventListener('click',()=>{LS.set(K.expOnly,true);renderAccount()});
  }

  /* ---- Capital plan autofill ---- */
  let FILLING=false,LAST_FILL=0,REFILL=false,LAST_TICK=null,PENDING_END=null,TICKET=null,TRANSFER_HINT=null;
  // A value autofill can no longer vouch for is removed, never left behind: a stale price, stop or balance
  // would otherwise feed the automatic calculation. Your own typed values are never touched.
  const clearAuto=(...ids)=>ids.forEach(id=>{const el=$(id);if(el&&!USER.has(id)&&el.classList.contains('autofilled')){el.value='';el.classList.remove('autofilled');el.title=''}});
  async function fillPlan(){
    if(!isDesk)return;if(FILLING){REFILL=true;return}
    FILLING=true;REFILL=false;TICKET=null;if($('ticketOut'))$('ticketOut').innerHTML='';const btn=$('autoFill'),status=$('autoStatus');btn.disabled=true;status.textContent='Reading live data…';
    const asset=$('rAsset').value,done=[],kept=[],fails=[],current=()=>$('rAsset').value===asset;
    const note=(id,label,ok)=>{if(ok)done.push(label);else if(USER.has(id))kept.push(label)};
    try{
      // Public: mid price and spread.
      try{const t=await getJSON(tickerURL(asset)),bid=+t.bid,ask=+t.ask;
        if(!current())throw new Error('asset changed');
        if(!(bid>0&&ask>=bid))throw new Error('no bid/ask');
        LAST_TICK={asset,bid,ask};const mid=(bid+ask)/2,half=Math.max(1,Math.ceil((ask-bid)/mid/2*1e4*10)/10);
        note('rEntry','entry price',setAuto('rEntry',round(mid,mid>=100?2:6),asset+' live mid'));
        const c=costs(),own=c.slipSource==='manual';
        note('rES','entry slippage',setAuto('rES',own?c.entrySlip:half,own?'slippage you entered':'half the live '+asset+' spread, minimum 1 bp; market impact not included'));
        note('rXS','exit slippage',setAuto('rXS',own?c.exitSlip:half,own?'slippage you entered':'half the live '+asset+' spread, minimum 1 bp; market impact not included'));
      }catch(e){clearAuto('rEntry','rES','rXS');if(e.message!=='asset changed')fails.push('price: '+e.message)}
      // Public: 30-day low of completed daily candles (H2 exit level).
      try{if(typeof fetchCandles!=='function')throw new Error('downloader unavailable');
        const bars=await fetchCandles(asset,86400,30,()=>{});if(!current())throw new Error('asset changed');if(bars.length<30)throw new Error('only '+bars.length+' days');
        const low=Math.min(...bars.map(b=>b.l)),entry=parseFloat($('rEntry').value);
        if(Number.isFinite(entry)&&low>=entry){clearAuto('rStop');fails.push('stop: price is at or below the 30-day low; set the stop yourself')}
        else note('rStop','stop (30-day low)',setAuto('rStop',round(low,low>=100?2:6),'lowest low of the last 30 completed days — the H2 exit level'));
      }catch(e){clearAuto('rStop');if(e.message!=='asset changed')fails.push('stop: '+e.message)}
      // Account (optional).
      if(!ACCOUNT||!ACCOUNT.configured||ACCOUNT.ok===false)await accountStatus();   // picks up a key added after the page opened
      if(ACCOUNT&&ACCOUNT.configured&&ACCOUNT.ok!==false){
        try{SNAP=await getJSON('/account/snapshot',true);delete ACCOUNT.error;
          if(!(experimentEquity()>0))throw new Error('net deposits exceed the Coinbase total; fix Net deposits');
          // The planner requires cash ≤ equity. After a deposit is netted out, Coinbase cash can exceed experiment
          // equity; only experiment money may be committed, so cash is capped at experiment equity.
          const expCash=Math.min(SNAP.cash,experimentEquity());
          note('rCash','cash',setAuto('rCash',round(expCash,2),expCash<SNAP.cash?'USD + USDC available, capped at experiment equity':'USD + USDC available'));
          note('rOpen','open risk',setAuto('rOpen',round(SNAP.openStopRisk+SNAP.unprotectedUSD,2),'open positions to their stop orders; no-stop positions at full value'));
          applyEquity();logEquity();maybeCheckTransfers();['rEquity','rPeak'].forEach(id=>note(id,id==='rEquity'?'equity':'high-water mark',$(id).classList.contains('autofilled')));
          if(Number.isFinite(SNAP.fees.taker)&&SNAP.fees.taker>=0&&costs().feeSource!=='manual'){const c=costs();c.entryFee=round(SNAP.fees.taker*100,4);c.exitFee=c.entryFee;c.feeSource='coinbase';c.at=SNAP.asOf;LS.set(K.costs,c)}
        }catch(e){SNAP=null;ACCOUNT={...ACCOUNT,error:e.message};clearAuto('rEquity','rPeak','rCash','rOpen');fails.push('account: '+e.message)}
      }else if(ACCOUNT&&ACCOUNT.configured&&ACCOUNT.ok===false){SNAP=null;clearAuto('rEquity','rPeak','rCash','rOpen')}
      applyCosts();['rEF','rXF'].forEach(id=>{if(USER.has(id))kept.push(id==='rEF'?'entry fee':'exit fee');else if($(id).classList.contains('autofilled'))done.push(id==='rEF'?'entry fee':'exit fee')});
      renderAccount();LAST_FILL=Date.now();
      const acctMsg=!onLauncher?'Account: open via the launcher.':!ACCOUNT||!ACCOUNT.configured?'Account not connected (optional): equity, cash and fees stay manual — see private/README.txt.':ACCOUNT.error?'':'Account read with View-only key.';
      status.innerHTML='<strong>'+new Date().toLocaleTimeString()+'</strong> · Filled: '+esc(done.join(', ')||'nothing')+'. '+(kept.length?'Kept your edits: '+esc(kept.join(', '))+'. ':'')+(fails.length?'<span class="kill">'+esc(fails.join(' · '))+'</span> ':'')+esc(acctMsg);
      const ready=['rEquity','rPeak','rCash','rOpen','rEntry','rStop','rEF','rXF','rES','rXS'].every(id=>$(id).value!=='');
      if(ready&&current())$('planRisk').click();
    }finally{FILLING=false;btn.disabled=false;if(REFILL||!current())setTimeout(fillPlan,0)}
  }
  // Remember each calculated plan for the Journal.
  if(isDesk)$('planRisk').addEventListener('click',()=>setTimeout(()=>{
    if(typeof LAST_RISK==='undefined'||!LAST_RISK||!LAST_RISK.result){TICKET=null;if($('ticketOut'))$('ticketOut').innerHTML='';return}   // a failed calculation must not leave the previous ticket on screen
    const p=LS.get(K.plans)||{},asset=$('rAsset').value,r=LAST_RISK.result;
    // Keep a short history per coin: the Journal must match a trade to the plan that existed BEFORE it, not a later one.
    const list=planList(p,asset);list.push({entry:+$('rEntry').value,stop:+$('rStop').value,qty:r.qty,sizeUSD:r.qty*r.entryFill,at:new Date().toISOString()});
    p[asset]=list.slice(-30);LS.set(K.plans,p);TICKET={asset,risk:LAST_RISK};renderTicket();
  },0));

  /* ---- Journal ---- */
  function planList(p,asset){const x=p[asset];return Array.isArray(x)?x.slice():x?[x]:[]}
  function planBefore(asset,iso){
    const t=ts(iso);if(!Number.isFinite(t))return null;
    // Latest plan made strictly before the first fill, at most 7 days earlier. No grace window: opening Capital plan
    // right after buying records a new plan, and that one must never be taken as the trade's expected price.
    // (If your PC clock runs ahead of Coinbase, no plan matches and the Journal asks you for the price instead.)
    return planList(LS.get(K.plans)||{},asset).filter(x=>{const a=ts(x.at);return a<t&&t-a<=7*86400e3}).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]||null;
  }
  const sym=v=>String(v||'').trim().toUpperCase().replace('/','-');
  function prefillJournal(){
    if(!$('jSym')||$('jSym').value)return;
    const p=LS.get(K.plans)||{},latest=Object.keys(p).map(a=>[a,planList(p,a).at(-1)]).filter(x=>x[1]).sort((a,b)=>String(b[1].at).localeCompare(String(a[1].at)))[0];if(!latest)return;
    const [asset,plan]=latest;$('jSym').value=asset;$('jSym').classList.add('autofilled');
    setAuto('jExp',plan.entry,'last Capital plan entry for '+asset);if(plan.sizeUSD>0)setAuto('jSize',round(plan.sizeUSD,2),'last Capital plan size');
  }
  function buildTrips(fills){
    const orders=[];for(const f of fills){const o=orders.at(-1);if(o&&o.id===f.orderId){o.qty+=f.qty;o.notional+=f.qty*f.price;o.fee+=f.fee}else orders.push({id:f.orderId,side:f.side,time:f.time,qty:f.qty,notional:f.qty*f.price,fee:f.fee})}
    const trips=[];let cur=null;
    for(const o of orders){
      if(o.side==='BUY'){if(!cur)cur={id:o.id,start:o.time,bq:0,bn:0,sq:0,sn:0,bfee:0,sfee:0};cur.bq+=o.qty;cur.bn+=o.notional;cur.bfee+=o.fee}
      else if(o.side==='SELL'&&cur){
        // Only the part of a sell that closes this trip belongs to it; the rest sold coins bought before the window.
        const need=Math.max(0,cur.bq-cur.sq),part=o.qty>need?need/o.qty:1;
        cur.sq+=o.qty*part;cur.sn+=o.notional*part;cur.sfee+=o.fee*part;cur.end=o.time;if(cur.sq>=cur.bq*0.99){trips.push(cur);cur=null}}
    }
    const shape=t=>({id:t.id,start:t.start,end:t.end||null,qty:t.bq,entry:t.bn/t.bq,exit:t.sq?t.sn/t.sq:null,sizeUSD:t.bn,fees:t.bfee+t.sfee,pnl:t.sq?t.sn-t.bn*Math.min(1,t.sq/t.bq)-t.bfee-t.sfee:null,open:!t.end||t.sq<t.bq*0.99});
    return {closed:trips.map(shape),open:cur?shape(cur):null};
  }
  let PENDING=null,PENDING_LEN=null,TRIPS=[];
  const baseOf=p=>String(p||'').split('-')[0];
  async function importFills(auto){
    const out=$('fillsOut');if(!out)return;
    if(!onLauncher){if(auto!==true)out.innerHTML='<div class="verdict fail"><b>Launcher required</b>Open the app with START-WINDOWS.bat to read your trades.</div>';return}
    if(!ACCOUNT||!ACCOUNT.configured||ACCOUNT.ok===false)await accountStatus();
    if(!ACCOUNT.configured||ACCOUNT.ok===false){if(auto!==true)out.innerHTML='<div class="verdict weak"><b>Account not connected</b>'+esc(ACCOUNT.error||'Add a View-only key (private/README.txt) to import trades.')+'</div>';return}
    out.innerHTML='<div class="note">Reading your Coinbase trades (last 120 days)…</div>';
    try{
      const {fills}=await getJSON('/account/fills?product=ALL&days=120',true),byAsset={};
      const logged=new Set([...(LS.get(K.logged)||[]),...(typeof TRADES!=='undefined'?TRADES:[]).map(t=>t&&t.trip).filter(Boolean)]);   // survives a restore even without the list
      fills.filter(f=>baseOf(f.product)).forEach(f=>{(byAsset[baseOf(f.product)]=byAsset[baseOf(f.product)]||[]).push(f)});   // USD and USDC books are one market
      TRIPS=[];const open=[];
      Object.entries(byAsset).forEach(([asset,list])=>{const r=buildTrips(list);r.closed.forEach(t=>TRIPS.push({...t,product:asset+'-USD'}));if(r.open)open.push({...r.open,product:asset+'-USD'})});
      TRIPS.sort((x,y)=>String(y.end).localeCompare(String(x.end)));
      const todo=TRIPS.filter(t=>!logged.has(t.id));
      const planCell=t=>{const p=planBefore(t.product,t.start);return p?money(p.entry):'<span class="kill">none</span>'};
      const btns=t=>planBefore(t.product,t.start)
        ?['Yes','Partly','No'].map(f=>'<button class="act sec" type="button" data-trip="'+esc(t.id)+'" data-follow="'+f+'" style="width:auto;padding:3px 8px">'+(f==='Yes'?'Followed':f==='Partly'?'Partly':'Didn\'t')+'</button>').join(' ')
        :'<button class="act sec" type="button" data-trip="'+esc(t.id)+'" data-follow="No" style="width:auto;padding:3px 8px" title="No Capital plan was run before this trade, so it is logged as not following a plan">Log (no plan)</button>';
      out.innerHTML=(todo.length?'<div class="note" style="margin-top:10px"><strong>'+todo.length+' trade'+(todo.length>1?'s':'')+' to log</strong> · one tap each: did you follow the plan?</div>':'<div class="note" style="margin-top:10px">All Coinbase round trips from the last 120 days are logged.</div>')
        +(todo.length?'<table style="margin-top:6px"><thead><tr><th>Coin</th><th>Sold</th><th class="n">Size</th><th class="n">Entry</th><th class="n">Exit</th><th class="n">Fees</th><th class="n">P&amp;L</th><th class="n">Planned</th><th></th></tr></thead><tbody>'
          +todo.map(t=>'<tr><td>'+esc(baseOf(t.product))+'</td><td>'+esc(String(t.end).slice(0,10))+'</td><td class="n">'+money(t.sizeUSD)+'</td><td class="n">'+money(t.entry)+'</td><td class="n">'+money(t.exit)+'</td><td class="n">'+money(t.fees)+'</td><td class="n">'+money(t.pnl)+'</td><td class="n">'+planCell(t)+'</td><td style="white-space:nowrap">'+btns(t)+'</td></tr>').join('')+'</tbody></table>':'')
        +(open.length?'<p class="hint">Still open: '+open.map(o=>esc(baseOf(o.product))+' '+money(o.sizeUSD)).join(', ')+'.</p>':'')
        +'<p class="hint">A round trip is buys until the coin is sold back (within 1%). Entry and exit are volume-weighted; fees are Coinbase commissions. "Planned" is the last Capital plan made before the first buy.</p>';
      out.querySelectorAll('button[data-trip]').forEach(b=>b.addEventListener('click',()=>logTrip(b.dataset.trip,b.dataset.follow)));
    }catch(e){out.innerHTML='<div class="verdict fail"><b>Import failed</b>'+esc(e.message)+'</div>'}
  }
  function logTrip(id,follow){
    const t=TRIPS.find(x=>x.id===id);if(!t||typeof TRADES==='undefined')return;const plan=planBefore(t.product,t.start);
    $('jSym').value=t.product;$('jSize').value=String(round(t.sizeUSD,2));$('jAct').value=String(round(t.entry,8));$('jExit').value=String(round(t.exit,8));$('jFee').value=String(round(t.fees,2));
    $('jExp').value=String(plan?plan.entry:round(t.entry,8));if($('jDir'))$('jDir').value='Long';$('jFollow').value=follow;
    if(!plan&&!$('jNote').value)$('jNote').value='No Capital plan before this trade';   // a note you typed for this trade is kept (the form is cleared after every log)
    PENDING=t.id;PENDING_END=t.end;PENDING_TRIP=t.id;PENDING_LEN=TRADES.length;$('addTrade').click();PENDING_TRIP=null;
  }
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  if($('importFills')){
    $('importFills').addEventListener('click',()=>importFills(false));
    // The Journal handler pushes the trade synchronously before any storage await, so a longer list means it was accepted.
    $('addTrade').addEventListener('click',()=>{
      if(!PENDING||PENDING_LEN===null||typeof TRADES==='undefined'||TRADES.length<=PENDING_LEN){PENDING=null;PENDING_LEN=null;return}
      const s=new Set(LS.get(K.logged)||[]);s.add(PENDING);LS.set(K.logged,[...s]);PENDING=null;PENDING_LEN=null;
      ['jSym','jSize','jNote'].forEach(id=>$(id)&&($(id).value=''));if($('jFee'))$('jFee').value='0';
      if($('jClosed'))$('jClosed').value=today();importFills(true);
    });
  }
  if($('jClosed'))$('jClosed').value=today();

  /* ---- Sizing and Budget from what the app already knows ---- */
  function fillSizing(){
    const T=typeof TRADES!=='undefined'&&Array.isArray(TRADES)?TRADES:[],eq=LS.get(K.equity);
    if(eq&&eq.value>0)setAuto('kC',round(eq.value,2),'Coinbase equity');
    if(!T.length)return;
    const wins=T.filter(t=>t.pnl>0),losses=T.filter(t=>t.pnl<0);
    setAuto('kN',T.length,'Journal trades');setAuto('kW',wins.length,'Journal trades with positive P&L after fees');
    if(wins.length&&losses.length)setAuto('kR',round((wins.reduce((a,t)=>a+t.pnl,0)/wins.length)/Math.abs(losses.reduce((a,t)=>a+t.pnl,0)/losses.length),2),'average win ÷ average loss from Journal');
  }
  function fillBudget(){
    const B=typeof BARS!=='undefined'&&Array.isArray(BARS)&&BARS.length>1?BARS:null;if(!B)return;
    const gran=B[1].t-B[0].t;if(gran>0)setAuto('bY',round(B.length*gran/31557600,2),'length of the loaded data');
  }

  /* ---- Trade ticket: the exact order to place, rounded to what Coinbase accepts ---- */
  const floorTo=(x,inc)=>Math.floor(x/inc+1e-9)*inc,ceilTo=(x,inc)=>Math.ceil(x/inc-1e-9)*inc;
  const decimals=inc=>Math.max(0,Math.min(12,Math.round(-Math.log10(inc))));
  const PRODUCTS={};
  async function productRules(asset){
    if(PRODUCTS[asset])return PRODUCTS[asset];
    if(!onLauncher)return null;
    try{const d=await getJSON('/coinbase-public/market/products/'+asset);const r={baseInc:+d.base_increment,quoteInc:+d.quote_increment,minBase:+d.base_min_size||0,minQuote:+d.quote_min_size||0};
      if(!(r.baseInc>0&&r.quoteInc>0))return null;return PRODUCTS[asset]=r}catch(e){return null}
  }
  function ticketMath(plan,rules,type,gapPct,makerFee){
    const c=plan.inputs,res=plan.result,bInc=rules?rules.baseInc:1e-8,qInc=rules?rules.quoteInc:0.01;
    const limitBuy=type==='limit'&&LAST_TICK&&LAST_TICK.asset===$('rAsset').value;
    const entryPx=limitBuy?floorTo(LAST_TICK.bid,qInc):c.entry*(1+c.entrySlip);
    const feeIn=limitBuy&&Number.isFinite(makerFee)?makerFee:c.entryFee;
    const stop=ceilTo(c.stop,qInc),limit=floorTo(stop*(1-gapPct/100),qInc);
    const cpu=entryPx*(1+feeIn),lossPerUnit=cpu-limit*(1-c.exitFee);
    let qty=0;if(!res.halt&&stop<entryPx&&lossPerUnit>0)qty=floorTo(Math.max(0,Math.min(res.riskBudget/lossPerUnit,c.cash/cpu,c.equity*c.maxPosition/cpu)),bInc);
    const notional=qty*entryPx,min=rules&&(qty<rules.minBase||notional<rules.minQuote);
    return {type:limitBuy?'limit':'market',entryPx,feeIn,stop,limit,qty,cost:qty*cpu,riskAtLimit:qty*lossPerUnit,budget:res.riskBudget,notional,belowMin:!!min,bInc,qInc,rules};
  }
  async function renderTicket(){
    const out=$('ticketOut');if(!out)return;
    // Only ever show a ticket for the calculation on screen and the coin it was calculated for.
    if(typeof LAST_RISK==='undefined'||!LAST_RISK||!LAST_RISK.result||!TICKET||TICKET.risk!==LAST_RISK||TICKET.asset!==$('rAsset').value){out.innerHTML='';return}
    const cool=coolingOff();
    if(cool){out.innerHTML='<div class="verdict fail"><b>Cooling-off until '+esc(new Date(cool.until).toLocaleString())+'</b>'+cool.losses+' losing trades closed in the last 24 hours. No new trades are sized until then. The rule is fixed on purpose: the next trade after two quick losses is the one most likely to break the plan.</div>';return}
    const want=TICKET,asset=$('rAsset').value,rules=await productRules(asset);
    if(TICKET!==want||!want||want.risk!==LAST_RISK||want.asset!==$('rAsset').value||FILLING){out.innerHTML='';return}   // superseded while loading rules
    const type=(document.getElementById('tkType')||{}).value||'market',g0=+((document.getElementById('tkGap')||{}).value??0.2),gap=Number.isFinite(g0)&&g0>=0&&g0<=20?g0:0.2;
    const maker=SNAP&&Number.isFinite(SNAP.fees.maker)?SNAP.fees.maker:null,T=ticketMath(LAST_RISK,rules,type,gap,maker);
    const mk=ticketMath(LAST_RISK,rules,'market',gap,maker),lm=LAST_TICK&&Number.isFinite(maker)?ticketMath(LAST_RISK,rules,'limit',gap,maker):null;
    const fq=x=>x.toFixed(decimals(T.bInc)),fp=x=>x.toFixed(decimals(T.qInc));
    const row=(label,val,copy)=>'<tr><td>'+label+'</td><td class="n"><strong>'+esc(val)+'</strong></td><td>'+(copy?'<button class="act sec" type="button" data-copy="'+esc(copy)+'" style="width:auto;padding:3px 10px">Copy</button>':'')+'</td></tr>';
    out.innerHTML='<div class="note" style="margin-top:12px"><strong>Trade ticket · '+esc(asset)+'</strong>'
      +'<div class="row r4" style="margin:8px 0"><div><label for="tkType">Buy with</label><select id="tkType"><option value="market"'+(T.type==='market'?' selected':'')+'>Market order (taker fee)</option><option value="limit"'+(T.type==='limit'?' selected':'')+(LAST_TICK?'':' disabled')+'>Limit at bid (maker fee, may not fill)</option></select></div>'
      +'<div><label for="tkGap">Stop-limit gap %</label><input type="number" id="tkGap" step="0.05" min="0" value="'+gap+'"></div></div>'
      +(T.qty<=0?'<div class="verdict fail"><b>No trade</b>The plan allows no position now.</div>':T.belowMin?'<div class="verdict fail"><b>Below Coinbase minimum</b>'+fq(T.qty)+' '+esc(asset.split('-')[0])+' ($'+T.notional.toFixed(2)+') is under the minimum order ('+esc(rules.minBase)+' / $'+esc(rules.minQuote)+'). Skip this trade.</div>'
      :'<table>'+row('1. Buy '+esc(asset.split('-')[0])+' quantity',fq(T.qty),fq(T.qty))
        +row(T.type==='limit'?'   Limit price':'   Order type',T.type==='limit'?fp(T.entryPx):'Market',T.type==='limit'?fp(T.entryPx):null)
        +row('2. Then sell stop-limit: stop price',fp(T.stop),fp(T.stop))+row('   Limit price',fp(T.limit),fp(T.limit))+row('   Quantity',fq(T.qty),fq(T.qty))+'</table>'
        +'<p class="hint" style="margin-top:6px">Cost ≈ $'+T.cost.toFixed(2)+' incl. '+(T.feeIn*100).toFixed(2)+'% fee. Loss if the stop-limit fills at its limit: $'+T.riskAtLimit.toFixed(2)+' (budget $'+T.budget.toFixed(2)+'). Quantity is rounded down to Coinbase\'s '+esc(T.bInc)+' step'+(rules?'':' (rules not loaded; using 0.00000001)')+'; prices to '+esc(T.qInc)+'. A price that gaps below the limit leaves the stop-limit unfilled.</p>')
      +(lm&&lm.qty>0&&mk.qty>0?'<p class="hint">Fee drag: a limit entry at the '+(maker*100).toFixed(2)+'% maker fee allows '+fq(lm.qty)+' vs '+fq(mk.qty)+' for the same risk ('+((lm.qty/mk.qty-1)*100).toFixed(1)+'% more), if it fills.</p>':'')+'</div>';
    out.querySelectorAll('button[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copied'}catch(e){b.textContent=b.dataset.copy}}));
    ['tkType','tkGap'].forEach(id=>$(id)&&$(id).addEventListener('change',renderTicket));
  }

  /* ---- Cooling-off: two losing trades closed within 24 hours stop new sizing for 24 hours ---- */
  function coolingOff(now=Date.now()){
    const T=typeof TRADES!=='undefined'&&Array.isArray(TRADES)?TRADES:[];
    const losses=T.filter(t=>t.pnl<0&&t.closedAt&&now-ts(t.closedAt)<86400e3&&ts(t.closedAt)<=now).map(t=>ts(t.closedAt)).sort((a,b)=>b-a);
    return losses.length>=2?{losses:losses.length,until:new Date(losses[1]+86400e3).toISOString()}:null;
  }
  let PENDING_TRIP=null;
  function pendingTrip(){const v=PENDING_TRIP;PENDING_TRIP=null;return v}
  function pendingClose(){
    const v=PENDING_END;PENDING_END=null;if(v)return v;
    const d=$('jClosed')&&$('jClosed').value;if(!d||d===today())return null;   // today: the Journal stamps "now"
    const t=new Date(d+'T23:59:59');return Number.isFinite(t.getTime())?t.toISOString():null;   // an older trade counts at the end of its day
  }

  /* ---- Daily equity log ---- */
  function logEquity(){
    if(!SNAP||typeof experimentRisk!=='function'||typeof PROTOCOL==='undefined')return;
    const eq=experimentEquity(),peak=Math.max(INITIAL,LS.get(K.hwm)?.value??-Infinity);if(!(eq>0))return;
    let stage='—';try{stage=experimentRisk(eq,Math.max(peak,eq),PROTOCOL.riskPolicy).stage}catch(e){}
    const log=(LS.get(K.elog)||[]).filter(x=>x&&x.date),date=localDate(SNAP.asOf),rec={date,equity:round(eq,2),peak:round(Math.max(peak,eq),2),cash:round(SNAP.cash,2),open:round(SNAP.openStopRisk+SNAP.unprotectedUSD,2),stage,at:SNAP.asOf};
    const i=log.findIndex(x=>x.date===date);if(i>=0){rec.firstAt=log[i].firstAt||log[i].at;log[i]=rec}else{rec.firstAt=rec.at;log.push(rec)}log.sort((a,b)=>a.date.localeCompare(b.date));LS.set(K.elog,log.slice(-1500));renderEquityLog();
  }
  function renderEquityLog(){
    const out=$('equityLogOut'),log=(LS.get(K.elog)||[]).filter(x=>x&&Number.isFinite(x.equity)).map(x=>({...x,peak:Number.isFinite(x.peak)?x.peak:Math.max(INITIAL,x.equity)}));if(!out)return;
    if(!log.length){out.innerHTML='';return}
    const W=640,H=180,P=34,vals=log.flatMap(x=>[x.equity,x.peak,Math.max(4000,x.peak-1000)]),lo=Math.min(3900,...vals),hi=Math.max(5100,...vals)*1.005;
    const X=i=>P+(log.length<2?0:(W-P-8)*i/(log.length-1)),Y=v=>8+(H-24)*(1-(v-lo)/(hi-lo));
    const line=(f,cls,dash)=>'<polyline fill="none" stroke="'+cls+'" stroke-width="2"'+(dash?' stroke-dasharray="4 3"':'')+' points="'+log.map((x,i)=>X(i).toFixed(1)+','+Y(f(x)).toFixed(1)).join(' ')+'"/>';
    const hline=(v,c,label)=>'<line x1="'+P+'" x2="'+(W-8)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="'+c+'" stroke-dasharray="2 4"/><text x="'+(P+4)+'" y="'+(Y(v)-3)+'" font-size="10" fill="'+c+'">'+label+'</text>';
    out.innerHTML='<div class="note" style="margin-top:12px"><strong>Equity log</strong> · one entry per day, recorded when Capital plan reads your account'
      +'<div style="overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Experiment equity by day against the limits">'
      +hline(4500,'var(--pend)','$4,500 review')+hline(4250,'var(--kill)','$4,250 no new risk')
      +line(x=>Math.max(4000,x.peak-1000),'var(--kill)',true)+line(x=>x.peak,'var(--muted)',true)+line(x=>x.equity,'var(--silver)',false)
      +'<text x="4" y="'+(Y(hi)+10)+'" font-size="10" fill="var(--muted)">$'+Math.round(hi)+'</text><text x="4" y="'+(H-10)+'" font-size="10" fill="var(--muted)">$'+Math.round(lo)+'</text></svg></div>'
      +'<table style="margin-top:6px"><thead><tr><th>Date</th><th class="n">Equity</th><th class="n">High-water</th><th class="n">Hard floor</th><th>Stage</th></tr></thead><tbody>'
      +log.slice(-7).reverse().map(x=>'<tr><td>'+esc(x.date)+'</td><td class="n">'+money(x.equity)+'</td><td class="n">'+money(x.peak)+'</td><td class="n">'+money(Math.max(4000,x.peak-1000))+'</td><td>'+esc(x.stage)+'</td></tr>').join('')+'</tbody></table>'
      +'<p class="hint">Solid: experiment equity. Dashed grey: high-water mark. Dashed red: hard floor = max($4,000, high-water − $1,000). Saved in the desk backup file.</p></div>';
  }

  /* ---- Journal review: fee drag and plan adherence ---- */
  function renderReview(){
    const out=$('jReview');if(!out)return;const T=(typeof TRADES!=='undefined'?TRADES:[]).filter(t=>Number.isFinite(t.fee)&&Number.isFinite(t.size)&&t.size>0);
    if(!T.length){out.innerHTML='';return}
    const fees=T.reduce((a,t)=>a+t.fee,0),net=T.reduce((a,t)=>a+t.pnl,0),gross=net+fees;
    const turnover=T.reduce((a,t)=>a+t.size+(Number.isFinite(t.act)&&Number.isFinite(t.exit)&&t.act>0?t.size/t.act*t.exit:t.size),0);
    const eq=LS.get(K.equity)?.value,tk=SNAP&&SNAP.fees.taker,mk=SNAP&&SNAP.fees.maker;
    const groups=['Yes','Partly','No'].map(g=>{const x=T.filter(t=>t.follow===g);return {g,n:x.length,pnl:x.reduce((a,t)=>a+t.pnl,0)}}),unk=T.filter(t=>!t.follow).length;
    out.innerHTML='<div class="note" style="margin-top:12px"><strong>Review</strong> · '+T.length+' trade'+(T.length>1?'s':'')+' with recorded size and fees'
      +'<table style="margin-top:6px"><tbody>'
      +'<tr><td>Gross P&amp;L before fees</td><td class="n">'+money(gross)+'</td></tr><tr><td>Fees paid</td><td class="n">'+money(fees)+'</td></tr><tr><td><strong>Net P&amp;L</strong></td><td class="n"><strong>'+money(net)+'</strong></td></tr>'
      +'<tr><td>Fees as % of traded value (both legs)</td><td class="n">'+(fees/turnover*100).toFixed(3)+'%</td></tr>'
      +(gross>0?'<tr><td>Share of gross profit paid in fees</td><td class="n">'+(fees/gross*100).toFixed(1)+'%</td></tr>':'')
      +(Number.isFinite(tk)&&Number.isFinite(mk)?'<tr><td>Saved if every leg had filled at the maker fee</td><td class="n">'+money(turnover*(tk-mk))+'</td></tr>':'')
      +'</tbody></table><table style="margin-top:8px"><thead><tr><th>Followed the plan?</th><th class="n">Trades</th><th class="n">Net P&amp;L</th><th class="n">Per trade</th></tr></thead><tbody>'
      +groups.map(x=>'<tr><td>'+x.g+'</td><td class="n">'+x.n+'</td><td class="n">'+money(x.pnl)+'</td><td class="n">'+(x.n?money(x.pnl/x.n):'—')+'</td></tr>').join('')+'</tbody></table>'
      +(unk?'<p class="hint">'+unk+' trade'+(unk>1?'s':'')+' logged without an answer to "Followed the plan?".</p>':'')
      +'<p class="hint">With few trades these groups are anecdotes, not evidence. The point is to see whether losses come from the rule or from departures from it.</p></div>';
  }

  /* ---- Deposits and withdrawals detected from Coinbase history (suggestion, never auto-applied) ---- */
  function defaultSince(){const f=firstRead();return f?String(f).slice(0,10):new Date(Date.now()-90*86400e3).toISOString().slice(0,10)}
  let XFER_RUNNING=false,XFER_AGAIN=false;
  async function maybeCheckTransfers(){
    // Every account read re-checks Coinbase transfer history. No time throttle (a deposit made seconds after the last
    // read must still be caught); overlapping reads are coalesced into one follow-up check instead.
    if(XFER_RUNNING){XFER_AGAIN=true;return}
    XFER_RUNNING=true;try{do{XFER_AGAIN=false;await checkTransfers()}while(XFER_AGAIN)}finally{XFER_RUNNING=false}
  }
  // Money that arrived before Fable first read the account is the starting balance, not a deposit to net out.
  // Without this, funding the account on day one would be offered as a $5,000 "deposit" and zero the experiment.
  const firstRead=()=>{const l=LS.get(K.elog)||[];return l.length?(l[0].firstAt||l[0].at):null};
  const afterStart=rows=>{const f=ts(firstRead());return Number.isFinite(f)?rows.filter(x=>ts(x.at)>f):rows};
  async function checkTransfers(){
    // If Coinbase history disagrees with Net deposits, offer the correction (never applied without a click).
    try{const r=await getJSON('/account/transfers?since='+encodeURIComponent(defaultSince()),true),rows=afterStart(r.rows),net=rows.reduce((a,x)=>a+x.amountUSD,0);
      const dis=LS.get(K.xferDismiss);
      if(rows.length&&Math.abs(net-netDeposits())>0.01&&!(dis&&Math.abs(dis.net-net)<0.01)){TRANSFER_HINT={since:defaultSince(),net,n:rows.length};renderAccount()}}catch(e){}
  }
  async function detectTransfers(){
    const out=$('acctTransfers'),since=$('acctSince').value;out.innerHTML='<div class="hint">Reading Coinbase history since '+esc(since)+'…</div>';
    try{const r=await getJSON('/account/transfers?since='+encodeURIComponent(since),true),kept=afterStart(r.rows),early=r.rows.length-kept.length;
      r.net=kept.reduce((a,x)=>a+x.amountUSD,0);
      const rows=kept.map(x=>'<tr><td>'+esc(String(x.at).slice(0,10))+'</td><td>'+esc(x.type.replace('_',' '))+'</td><td>'+esc(x.currency)+'</td><td class="n">'+money(x.amountUSD)+'</td></tr>').join('');
      const sk=Object.entries(r.skipped||{}).map(([k,v])=>v+' '+k.replace('_',' ')).join(', ');
      out.innerHTML='<table style="margin:6px 0"><thead><tr><th>Date</th><th>Type</th><th>Asset</th><th class="n">USD</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">No deposits, withdrawals or transfers found.</td></tr>')+'</tbody></table>'
        +'<div>Net since '+esc(since)+': <strong>'+money(r.net)+'</strong> '+(rows?'<button class="act sec" type="button" id="acctUseDetected" style="width:auto">Use '+esc(money(r.net))+'</button>':'')+'</div>'
        +(early?'<div class="hint">'+early+' transfer'+(early>1?'s':'')+' before Fable first read your account ('+esc(String(firstRead()).slice(0,16).replace('T',' '))+' UTC) are your starting balance and are not counted.</div>':'')
        +'<div class="hint">Check each line against Coinbase. This history may include accounts outside the key\'s portfolio; crypto sent in or out is valued in USD at the time.'+(sk?' Not counted: '+esc(sk)+'.':'')+'</div>';
      const use=$('acctUseDetected');if(use)use.addEventListener('click',()=>{$('acctDeposits').value=String(round(r.net,2));$('acctDeposits').dispatchEvent(new Event('change'))});
    }catch(e){out.innerHTML='<div class="verdict weak"><b>Could not read transfer history</b>'+esc(e.message)+'. Enter deposits by hand.</div>'}
  }

  /* ---- Tax CSV (Form 8949 layout, FIFO) ---- */
  function localDate(v){const t=new Date(ts(v));return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')}   // a Dec 31 evening sale stays in its tax year
  function fifoRows(fills,year){
    const lots={},rows=[];
    for(const f of fills){
      const asset=String(f.product||'').split('-')[0];if(!asset)continue;const q=lots[asset]||(lots[asset]=[]);
      if(f.side==='BUY'){q.push({qty:f.qty,costPer:(f.qty*f.price+f.fee)/f.qty,at:f.time});continue}
      if(f.side!=='SELL')continue;
      let left=f.qty;const procPer=(f.qty*f.price-f.fee)/f.qty;
      while(left>1e-12){
        const lot=q[0];
        if(!lot){rows.push({asset,qty:left,acquired:'',sold:f.time,proceeds:left*procPer,basis:null,note:'No purchase on this account covers this sale (transferred in, or bought before the history). Basis needed from your records.'});break}
        const take=Math.min(left,lot.qty);
        rows.push({asset,qty:take,acquired:lot.at,sold:f.time,proceeds:take*procPer,basis:take*lot.costPer,note:''});
        lot.qty-=take;left-=take;if(lot.qty<=1e-12)q.shift();
      }
    }
    return rows.filter(r=>localDate(r.sold).slice(0,4)===String(year)).map(r=>{
      const held=r.acquired?(ts(r.sold)-ts(r.acquired))/86400e3:null;
      return {...r,gain:r.basis===null?null:r.proceeds-r.basis,term:held===null?'Unknown':held>365?'Long-term':'Short-term'};
    });
  }
  async function taxCsv(){
    const out=$('taxOut'),year=$('taxYear').value;
    if(!onLauncher){out.innerHTML='<div class="verdict fail"><b>Launcher required</b>Open the app with START-WINDOWS.bat.</div>';return}
    out.innerHTML='<div class="note">Reading every fill on the account…</div>';
    try{const r=await getJSON('/account/fills?product=ALL',true),rows=fifoRows(r.fills,year);
      const d=x=>x?localDate(x):'VARIOUS',n=x=>x===null?'':x.toFixed(2);
      const csv=['Description,Date acquired,Date sold,Proceeds,Cost basis,Gain or loss,Term,Note'].concat(rows.map(x=>[x.qty.toFixed(8)+' '+x.asset,d(x.acquired),d(x.sold),n(x.proceeds),n(x.basis),n(x.gain),x.term,'"'+x.note.replace(/"/g,'""')+'"'].join(','))).join('\n');
      const st=rows.filter(x=>x.term==='Short-term').reduce((a,x)=>a+x.gain,0),lt=rows.filter(x=>x.term==='Long-term').reduce((a,x)=>a+x.gain,0),unk=rows.filter(x=>x.basis===null).length;
      if(rows.length&&typeof saveFile==='function')await saveFile('fable-5k-form8949-'+year+'.csv',csv,'text/csv');
      out.innerHTML='<div class="note"><strong>'+rows.length+' sale line'+(rows.length===1?'':'s')+' in '+esc(year)+'</strong> · short-term '+money(st)+' · long-term '+money(lt)+(unk?' · <span class="kill">'+unk+' without cost basis</span>':'')
        +(r.truncated?'<br><span class="kill">History truncated at 15,000 fills; totals incomplete.</span>':'')
        +'<p class="hint">FIFO lots per coin, fees added to cost and subtracted from proceeds. Coinbase\'s 1099-DA may use a different lot method or basis; reconcile with it and your CPA. Not tax advice.</p></div>';
    }catch(e){out.innerHTML='<div class="verdict fail"><b>Tax export failed</b>'+esc(e.message)+'</div>'}
  }
  if($('taxYear')){const y=new Date().getUTCFullYear();$('taxYear').innerHTML=[y,y-1,y-2,y-3].map(x=>'<option>'+x+'</option>').join('');$('taxCsv').addEventListener('click',taxCsv)}

  /* ---- Backup: desk settings travel with the backup file ---- */
  function exportExtras(){return {loggedTrips:LS.get(K.logged)||[],equityLog:LS.get(K.elog)||[],hwm:LS.get(K.hwm),netDeposits:LS.get(K.deposits),experimentOnly:!!LS.get(K.expOnly),plans:LS.get(K.plans)||{},costs:LS.get(K.costs)||{}}}
  function importExtras(x){
    if(!x||typeof x!=='object')return;
    const log=new Map((LS.get(K.elog)||[]).map(r=>[r.date,r]));(Array.isArray(x.equityLog)?x.equityLog:[]).forEach(r=>{if(r&&typeof r.date==='string'&&Number.isFinite(r.equity)&&!log.has(r.date))log.set(r.date,r)});
    LS.set(K.elog,[...log.values()].sort((a,b)=>a.date.localeCompare(b.date)));
    const h=LS.get(K.hwm)?.value,hi=x.hwm&&Number.isFinite(x.hwm.value)?x.hwm.value:null;if(hi!==null&&!(h>=hi))LS.set(K.hwm,x.hwm);   // never lower a recorded peak
    if(!LS.get(K.deposits)&&x.netDeposits&&Number.isFinite(+x.netDeposits.value))LS.set(K.deposits,x.netDeposits);
    if(x.experimentOnly)LS.set(K.expOnly,true);
    if(Array.isArray(x.loggedTrips))LS.set(K.logged,[...new Set([...(LS.get(K.logged)||[]),...x.loggedTrips.filter(v=>typeof v==='string')])]);
    if(!Object.keys(LS.get(K.costs)||{}).length&&x.costs)LS.set(K.costs,x.costs);
    const p=LS.get(K.plans)||{};Object.entries(x.plans||{}).forEach(([a,v])=>{if(!p[a])p[a]=v});LS.set(K.plans,p);
    renderEquityLog();renderReview();
  }

  /* ---- triggers ---- */
  function onTab(name){
    if(name==='control'&&isDesk&&onLauncher&&Date.now()-LAST_FILL>60000)fillPlan();
    if(name==='jrn'&&isDesk){prefillJournal();renderReview();if(onLauncher)importFills(true)}   // live trades belong in the desk journal only
    if(name==='control'){renderEquityLog();renderTicket()}
    if(name==='siz')fillSizing();
    if(name==='bud')fillBudget();
    if(name==='lab'||name==='exec')applyCosts();
  }
  document.querySelectorAll('nav button[data-p]').forEach(b=>b.addEventListener('click',()=>onTab(b.dataset.p)));
  if(isDesk){
    $('autoFill').addEventListener('click',()=>{LAST_FILL=0;fillPlan()});
    $('rAsset').addEventListener('change',()=>{['rEntry','rStop'].forEach(id=>USER.delete(id));fillPlan()});
  }
  applyCosts();
  const active=document.querySelector('nav button[aria-selected="true"]');if(active)setTimeout(()=>onTab(active.dataset.p),0);
  window.fableAuto={pendingTrip,today,logTrip,checkTransfers,renderTicket,ticketMath,coolingOff,pendingClose,logEquity,renderEquityLog,renderReview,detectTransfers,fifoRows,exportExtras,importExtras,fillPlan,importFills,buildTrips,linkFrom,applyCosts,fillSizing,fillBudget,prefillJournal,userEdit:id=>USER.add(id),state:()=>({SNAP,ACCOUNT,USER:[...USER]})};
})();
