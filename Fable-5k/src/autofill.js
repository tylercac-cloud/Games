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
  const K={costs:'fable-shared:costs',equity:'fable-shared:equity',hwm:'fable-desk:hwm',plans:'fable-desk:plans',logged:'fable-desk:logged-trips'};
  const INITIAL=5000;

  /* ---- who owns a field: you (typed) or autofill ---- */
  const USER=new Set();
  function setAuto(id,value,source){
    const el=$(id);if(!el||USER.has(id)||value===null||value===undefined||!Number.isFinite(+value))return false;
    el.value=String(value);el.classList.add('autofilled');el.title='Auto: '+source+'. Type to override; clear the field to hand it back.';return true;
  }
  document.addEventListener('input',e=>{const el=e.target;if(!e.isTrusted||!el||!el.id)return;
    if(el.value==='')USER.delete(el.id);else{USER.add(el.id);el.classList.remove('autofilled');el.title=''}
    if(LINK_OF[el.id])linkFrom(el.id)},true);

  /* ---- linked costs (shared by both tools) ---- */
  const LINKS={entryFee:['rEF','aEF'],exitFee:['rXF','aXF'],entrySlip:['rES','aES'],exitSlip:['rXS','aXS']};
  const LINK_OF={};Object.entries(LINKS).forEach(([k,ids])=>ids.forEach(id=>LINK_OF[id]=k));
  function costs(){return LS.get(K.costs)||{}}
  function applyCosts(){
    const c=costs(),src=c.feeSource==='coinbase'?'your Coinbase fee tier':c.slipSource==='spread'?'live spread':'your earlier entry';
    for(const [k,ids] of Object.entries(LINKS))if(Number.isFinite(c[k]))ids.forEach(id=>setAuto(id,c[k],k.includes('Fee')?(c.feeSource==='coinbase'?'Coinbase taker fee':'fee you entered'):(c.slipSource==='spread'?'half live spread':'slippage you entered')));
    if(['entryFee','exitFee','entrySlip','exitSlip'].every(k=>Number.isFinite(c[k])))setAuto('cost',round(c.entryFee+c.exitFee+(c.entrySlip+c.exitSlip)/100,3),'fees + slippage, both legs ('+src+')');
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
      +'<p class="hint" style="margin-top:6px">Equity is the whole portfolio the key can see. Deposits and withdrawals are not netted out; adjust High-water equity if you add or remove money.</p></div>';
  }

  /* ---- Capital plan autofill ---- */
  let FILLING=false,LAST_FILL=0;
  async function fillPlan(){
    if(!isDesk||FILLING)return;FILLING=true;const btn=$('autoFill'),status=$('autoStatus');btn.disabled=true;status.textContent='Reading live data…';
    const asset=$('rAsset').value,done=[],kept=[],fails=[];
    const note=(id,label,ok)=>{if(ok)done.push(label);else if(USER.has(id))kept.push(label)};
    try{
      // Public: mid price and spread.
      try{const t=await getJSON(tickerURL(asset)),bid=+t.bid,ask=+t.ask;
        if(!(bid>0&&ask>=bid))throw new Error('no bid/ask');
        const mid=(bid+ask)/2,half=Math.max(1,Math.ceil((ask-bid)/mid/2*1e4*10)/10);
        note('rEntry','entry price',setAuto('rEntry',round(mid,mid>=100?2:6),asset+' live mid'));
        if(costs().slipSource!=='manual'){const c=costs();c.entrySlip=half;c.exitSlip=half;c.slipSource='spread';c.at=new Date().toISOString();LS.set(K.costs,c)}
        ['rES','rXS'].forEach(id=>note(id,id==='rES'?'entry slippage':'exit slippage',setAuto(id,costs()[id==='rES'?'entrySlip':'exitSlip'],costs().slipSource==='spread'?'half live spread, minimum 1 bp; market impact not included':'slippage you entered')));
      }catch(e){fails.push('price: '+e.message)}
      // Public: 30-day low of completed daily candles (H2 exit level).
      try{if(typeof fetchCandles!=='function')throw new Error('downloader unavailable');
        const bars=await fetchCandles(asset,86400,30,()=>{});if(bars.length<30)throw new Error('only '+bars.length+' days');
        const low=Math.min(...bars.map(b=>b.l)),entry=parseFloat($('rEntry').value);
        if(Number.isFinite(entry)&&low>=entry)fails.push('stop: price is at or below the 30-day low; set the stop yourself');
        else note('rStop','stop (30-day low)',setAuto('rStop',round(low,low>=100?2:6),'lowest low of the last 30 completed days — the H2 exit level'));
      }catch(e){fails.push('stop: '+e.message)}
      // Account (optional).
      if(!ACCOUNT)await accountStatus();
      if(ACCOUNT&&ACCOUNT.configured&&ACCOUNT.ok!==false){
        try{SNAP=await getJSON('/account/snapshot',true);
          note('rEquity','equity',setAuto('rEquity',round(SNAP.equity,2),'Coinbase portfolio total'));
          note('rCash','cash',setAuto('rCash',round(SNAP.cash,2),'USD + USDC available'));
          note('rOpen','open risk',setAuto('rOpen',round(SNAP.openStopRisk+SNAP.unprotectedUSD,2),'open positions to their stop orders; no-stop positions at full value'));
          const hwm=Math.max(INITIAL,LS.get(K.hwm)?.value||0,SNAP.equity);LS.set(K.hwm,{value:hwm,at:SNAP.asOf});
          note('rPeak','high-water mark',setAuto('rPeak',round(hwm,2),'highest equity recorded here (starts at $5,000)'));
          LS.set(K.equity,{value:SNAP.equity,at:SNAP.asOf});
          if(Number.isFinite(SNAP.fees.taker)&&SNAP.fees.taker>=0){const c=costs();c.entryFee=round(SNAP.fees.taker*100,4);c.exitFee=c.entryFee;c.feeSource='coinbase';c.at=SNAP.asOf;LS.set(K.costs,c)}
        }catch(e){SNAP=null;ACCOUNT={...ACCOUNT,error:e.message};fails.push('account: '+e.message)}
      }
      applyCosts();['rEF','rXF'].forEach(id=>{if(USER.has(id))kept.push(id==='rEF'?'entry fee':'exit fee');else if($(id).classList.contains('autofilled'))done.push(id==='rEF'?'entry fee':'exit fee')});
      renderAccount();LAST_FILL=Date.now();
      const acctMsg=!onLauncher?'Account: open via the launcher.':!ACCOUNT||!ACCOUNT.configured?'Account not connected (optional): equity, cash and fees stay manual — see private/README.txt.':ACCOUNT.error?'':'Account read with View-only key.';
      status.innerHTML='<strong>'+new Date().toLocaleTimeString()+'</strong> · Filled: '+esc(done.join(', ')||'nothing')+'. '+(kept.length?'Kept your edits: '+esc(kept.join(', '))+'. ':'')+(fails.length?'<span class="kill">'+esc(fails.join(' · '))+'</span> ':'')+esc(acctMsg);
      const ready=['rEquity','rPeak','rCash','rOpen','rEntry','rStop','rEF','rXF','rES','rXS'].every(id=>$(id).value!=='');
      if(ready)$('planRisk').click();
    }finally{FILLING=false;btn.disabled=false}
  }
  // Remember each calculated plan for the Journal.
  if(isDesk)$('planRisk').addEventListener('click',()=>setTimeout(()=>{
    if(typeof LAST_RISK==='undefined'||!LAST_RISK||!LAST_RISK.result)return;
    const p=LS.get(K.plans)||{},asset=$('rAsset').value,r=LAST_RISK.result;
    p[asset]={entry:+$('rEntry').value,stop:+$('rStop').value,qty:r.qty,sizeUSD:r.qty*r.entryFill,at:new Date().toISOString()};LS.set(K.plans,p);
  },0));

  /* ---- Journal ---- */
  const sym=v=>String(v||'').trim().toUpperCase().replace('/','-');
  function prefillJournal(){
    if(!$('jSym')||$('jSym').value)return;
    const p=LS.get(K.plans)||{},latest=Object.entries(p).sort((a,b)=>String(b[1].at).localeCompare(String(a[1].at)))[0];if(!latest)return;
    const [asset,plan]=latest;$('jSym').value=asset;$('jSym').classList.add('autofilled');
    setAuto('jExp',plan.entry,'last Capital plan entry for '+asset);if(plan.sizeUSD>0)setAuto('jSize',round(plan.sizeUSD,2),'last Capital plan size');
  }
  function buildTrips(fills){
    const orders=[];for(const f of fills){const o=orders.at(-1);if(o&&o.id===f.orderId){o.qty+=f.qty;o.notional+=f.qty*f.price;o.fee+=f.fee}else orders.push({id:f.orderId,side:f.side,time:f.time,qty:f.qty,notional:f.qty*f.price,fee:f.fee})}
    const trips=[];let cur=null;
    for(const o of orders){
      if(o.side==='BUY'){if(!cur)cur={id:o.id,start:o.time,bq:0,bn:0,sq:0,sn:0,fee:0};cur.bq+=o.qty;cur.bn+=o.notional;cur.fee+=o.fee}
      else if(o.side==='SELL'&&cur){cur.sq+=o.qty;cur.sn+=o.notional;cur.fee+=o.fee;cur.end=o.time;if(cur.sq>=cur.bq*0.99){trips.push(cur);cur=null}}
    }
    const shape=t=>({id:t.id,start:t.start,end:t.end||null,qty:t.bq,entry:t.bn/t.bq,exit:t.sq?t.sn/t.sq:null,sizeUSD:t.bn,fees:t.fee,pnl:t.sq?t.sn-t.bn*Math.min(1,t.sq/t.bq)-t.fee:null,open:!t.end||t.sq<t.bq*0.99});
    return {closed:trips.map(shape),open:cur?shape(cur):null};
  }
  let PENDING=null,PENDING_LEN=0;
  async function importFills(){
    const out=$('fillsOut'),product=sym($('jSym').value)||$('rAsset').value;
    if(!/^[A-Z0-9]{1,15}-USDC?$/.test(product)){out.innerHTML='<div class="verdict fail"><b>Symbol</b>Use a pair like BTC-USD.</div>';return}
    if(!onLauncher){out.innerHTML='<div class="verdict fail"><b>Launcher required</b>Open the app with START-WINDOWS.bat to read fills.</div>';return}
    out.innerHTML='<div class="note">Reading '+esc(product)+' fills (last 120 days)…</div>';
    try{const {fills}=await getJSON('/account/fills?product='+encodeURIComponent(product),true),{closed,open}=buildTrips(fills),logged=new Set(LS.get(K.logged)||[]);
      if(!closed.length&&!open){out.innerHTML='<div class="note">No '+esc(product)+' buys in the last 120 days.</div>';return}
      out.innerHTML='<table style="margin-top:10px"><thead><tr><th>Bought</th><th>Sold</th><th class="n">Size</th><th class="n">Entry</th><th class="n">Exit</th><th class="n">Fees</th><th class="n">P&amp;L</th><th></th></tr></thead><tbody>'
        +closed.slice().reverse().map(t=>'<tr><td>'+esc(String(t.start).slice(0,10))+'</td><td>'+esc(String(t.end).slice(0,10))+'</td><td class="n">'+money(t.sizeUSD)+'</td><td class="n">'+money(t.entry)+'</td><td class="n">'+money(t.exit)+'</td><td class="n">'+money(t.fees)+'</td><td class="n">'+money(t.pnl)+'</td><td>'+(logged.has(t.id)?'Logged':'<button class="act sec" type="button" data-trip="'+esc(t.id)+'">Use</button>')+'</td></tr>').join('')
        +(open?'<tr><td>'+esc(String(open.start).slice(0,10))+'</td><td>open</td><td class="n">'+money(open.sizeUSD)+'</td><td class="n">'+money(open.entry)+'</td><td class="n">—</td><td class="n">'+money(open.fees)+'</td><td class="n">—</td><td>Still open</td></tr>':'')+'</tbody></table>'
        +'<p class="hint">Round trips = buys until the position is sold back (within 1%). Size, entry and exit are volume-weighted fills; fees are Coinbase commissions. Selling coins bought before this window is ignored.</p>';
      out.querySelectorAll('button[data-trip]').forEach(b=>b.addEventListener('click',()=>{
        const t=closed.find(x=>x.id===b.dataset.trip),plan=(LS.get(K.plans)||{})[product];
        $('jSym').value=product;['jSize','jAct','jExit','jFee'].forEach(id=>USER.delete(id));
        setAuto('jSize',round(t.sizeUSD,2),'Coinbase fills');setAuto('jAct',round(t.entry,6),'Coinbase fills (VWAP)');setAuto('jExit',round(t.exit,6),'Coinbase fills (VWAP)');setAuto('jFee',round(t.fees,2),'Coinbase commissions');
        const usable=plan&&Date.parse(plan.at)<=Date.parse(t.start)+3600e3;USER.delete('jExp');
        if(usable)setAuto('jExp',plan.entry,'Capital plan entry, '+plan.at.slice(0,10));else{$('jExp').value='';$('jExp').classList.remove('autofilled')}
        PENDING=t.id;PENDING_LEN=typeof TRADES!=='undefined'?TRADES.length:0;$('fillsOut').insertAdjacentHTML('afterbegin','<div class="note">'+(usable?'Loaded. Check the numbers, then Add trade.':'Loaded. No Capital plan was run before this trade: type the price you expected in Expected entry, then Add trade.')+'</div>');
        (usable?$('addTrade'):$('jExp')).focus();
      }));
    }catch(e){out.innerHTML='<div class="verdict fail"><b>Import failed</b>'+esc(e.message)+'</div>'}
  }
  if($('importFills')){
    $('importFills').addEventListener('click',importFills);
    // The Journal pushes the trade synchronously before saving, so a longer TRADES list means it was accepted.
    // The Journal handler pushes the trade synchronously before any storage await, so a length change means it was accepted.
    let lenAtUse=null;
    $('fillsOut').addEventListener('click',e=>{if(e.target&&e.target.dataset&&e.target.dataset.trip)lenAtUse=typeof TRADES!=='undefined'?TRADES.length:null},true);
    $('addTrade').addEventListener('click',()=>{
      if(!PENDING||lenAtUse===null||typeof TRADES==='undefined'||TRADES.length<=lenAtUse)return;
      const s=new Set(LS.get(K.logged)||[]);s.add(PENDING);LS.set(K.logged,[...s]);PENDING=null;lenAtUse=null;importFills();
    });
  }

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

  /* ---- triggers ---- */
  function onTab(name){
    if(name==='control'&&isDesk&&onLauncher&&Date.now()-LAST_FILL>60000)fillPlan();
    if(name==='jrn')prefillJournal();
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
  window.fableAuto={fillPlan,importFills,buildTrips,linkFrom,applyCosts,fillSizing,fillBudget,prefillJournal,userEdit:id=>USER.add(id),state:()=>({SNAP,ACCOUNT,USER:[...USER]})};
})();
