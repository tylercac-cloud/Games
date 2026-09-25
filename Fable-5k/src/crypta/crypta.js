/* ============ Crypta — the Fable 5k helper ============
   Runs inside both tools (floating button, bottom right) and as her own installable window at /crypta.
   - Guide mode (no key): answers from the built-in guide plus live explanations of your numbers.
   - AI mode (Anthropic key in private/): Claude answers through the launcher, which holds the key, fixes the
     prompt and tools, and enforces a monthly spending cap. The page never sees the key.
   - Tools she can use: switch tab, point at a field, refresh Capital plan, open trades to log. Nothing that
     trades, moves money or changes the study.
   - Anything that looks like an API key or private key is refused before it leaves this page. */
(function(){
  if(window.__crypta)return;window.__crypta=true;
  const GUIDE=/*@@CRYPTA_GUIDE@@*/[];
  const SPRITE=/*@@CRYPTA_SVG@@*/'';
  const STANDALONE=!!document.getElementById('cryptaStandalone');
  const onLauncher=location.protocol==='http:'&&(location.hostname==='127.0.0.1'||location.hostname==='localhost');
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LS={get(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v===null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  const PAGE_ID=Math.random().toString(36).slice(2);
  const settings=()=>Object.assign({model:null,share:true,brain:'auto',localModel:null},LS.get('crypta:settings',{}));
  // Which brain answers: Claude (API key, paid), a local model through Ollama (free, on this PC), or the built-in guide.
  const LOCAL_PREF=['qwen3:8b','qwen3:4b-instruct','qwen3:4b','llama3.1:8b'];
  function localModel(){const inst=((STATUS||{}).local||{}).installed||[],s=settings();return inst.includes(s.localModel)?s.localModel:(LOCAL_PREF.find(m=>inst.includes(m))||inst[0]||null)}
  function brain(){const st=STATUS||{},s=settings(),localOk=!!(st.local&&st.local.running&&localModel());
    if(s.brain==='claude')return st.configured?'claude':'guide';if(s.brain==='local')return localOk?'local':'guide';if(s.brain==='guide')return 'guide';
    return st.configured?'claude':localOk?'local':'guide'}
  const CH=typeof BroadcastChannel==='function'?new BroadcastChannel('fable-crypta'):null;

  /* ---------------- what the open tool looks like right now ---------------- */
  const FIELDS=['rAsset','rEquity','rPeak','rCash','rOpen','rRisk','rPortfolio','rMax','rDD','rGap','rEntry','rStop','rEF','rXF','rES','rXS','cost','jSym','jSize','jExp','jAct','jExit','jFee','kC','kW','kN','bY'];
  const clip=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n)+'…':s};
  function labelFor(id){const l=document.querySelector('label[for="'+id+'"]');return l?clip(l.textContent,60):id}
  function activeTab(){const b=document.querySelector('nav button[aria-selected="true"]')||document.querySelector('nav button[data-p].on');return b?{id:b.dataset.p,label:clip(b.textContent,40)}:null}
  function snapshot(){
    if(STANDALONE)return null;
    const s={page:$('planRisk')?'Daily desk':$('refreshMarkets')?'Strategy lab':'Start page',tab:activeTab(),takenAt:new Date().toISOString(),fields:{}};
    FIELDS.forEach(id=>{const el=$(id);if(el&&el.offsetParent!==null||el&&activeTab()&&el.closest('#p-'+activeTab().id))s.fields[id]={label:labelFor(id),value:el.value,autofilled:el.classList.contains('autofilled')}});
    try{if(typeof LAST_RISK!=='undefined'&&LAST_RISK&&LAST_RISK.result){const r=LAST_RISK.result,e=LAST_RISK.experiment;
      s.plan={stage:e.stage,lossFrom5000:e.loss,hardFloor:e.hardFloor,riskBudget:r.riskBudget,headroom:r.headroom,qty:r.qty,cost:r.debit,modeledStopLoss:r.stopLoss,entryFill:r.entryFill,stopFill:r.stopFill,lossPerUnit:r.lossPerUnit,coolingOff:LAST_RISK.cooling||null,halted:r.halt}}}catch(e){}
    const t=$('ticketOut');if(t&&t.textContent.trim())s.ticket=clip(t.textContent,700);
    const a=$('autoStatus');if(a)s.autofillStatus=clip(a.textContent,400);
    try{const st=window.fableAuto&&window.fableAuto.state();if(st&&st.SNAP){const P=st.SNAP;
      s.account={equity:P.equity,cash:P.cash,fees:P.fees,openStopRisk:P.openStopRisk,unprotectedUSD:P.unprotectedUSD,positions:(P.positions||[]).map(p=>({asset:p.asset,valueUSD:Math.round(p.valueUSD*100)/100,stopOrders:(p.stops||[]).length,countedRisk:Math.round((p.stopRiskUSD+p.unprotectedUSD)*100)/100}))};
      const nd=LS.get('fable-desk:net-deposits',null);if(nd)s.account.netDeposits=+nd.value}
      if(st&&st.ACCOUNT)s.accountConnected=!!(st.ACCOUNT.configured&&st.ACCOUNT.ok!==false);}catch(e){}
    try{if(typeof TRADES!=='undefined'&&Array.isArray(TRADES)){s.journal={trades:TRADES.length,netPnl:Math.round(TRADES.reduce((x,t)=>x+t.pnl,0)*100)/100,recent:TRADES.slice(-5).map(t=>({date:t.d,symbol:t.sym,pnl:Math.round(t.pnl*100)/100,followedPlan:t.follow||null}))}}}catch(e){}
    const cool=window.fableAuto&&window.fableAuto.coolingOff&&window.fableAuto.coolingOff();if(cool)s.coolingOff=cool;
    ['scanStatus','fillsOut','jReview','liveGrid','liveStatus','marketOut','dataInfo'].forEach(id=>{const el=$(id);if(el&&el.textContent.trim())s[id]=clip(el.textContent,500)});
    const warn=[...document.querySelectorAll('.verdict.fail,.verdict.weak')].filter(x=>x.offsetParent!==null).slice(0,3).map(x=>clip(x.textContent,300));if(warn.length)s.warningsOnScreen=warn;
    s.buttons=[...document.querySelectorAll('button[id]')].filter(b=>b.offsetParent!==null&&!b.closest('#cryptaRoot')).slice(0,40).map(b=>b.id+': '+clip(b.textContent,40));
    let j=JSON.stringify(s);if(j.length>11000){delete s.buttons;delete s.liveGrid;j=JSON.stringify(s)}
    return s;
  }

  /* ---------------- tools, run in the tool page ---------------- */
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function goTab(tab){const b=document.querySelector('nav button[data-p="'+tab+'"]');if(!b)throw Error('This tool has no '+tab+' tab. Open the Daily desk for that.');b.click();return 'Opened the '+clip(b.textContent,30)+' tab.'}
  async function runTool(name,input){
    if(name==='go_to_tab')return goTab(String(input&&input.tab||''));
    if(name==='point_at'){
      const id=String(input&&input.element||'');if(!/^[A-Za-z][A-Za-z0-9]{1,30}$/.test(id))throw Error('Bad element id.');
      const el=$(id);if(!el||el.closest('#cryptaRoot'))throw Error('There is no '+id+' on this page.');
      const panel=el.closest('section.panel[id^="p-"]');if(panel&&!panel.classList.contains('on'))goTab(panel.id.slice(2));
      const det=el.closest('details');if(det)det.open=true;
      await sleep(150);el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('crypta-glow');setTimeout(()=>el.classList.remove('crypta-glow'),4500);
      return 'Pointed at '+(labelFor(id)||id)+'.';
    }
    if(name==='refresh_capital_plan'){
      if(!$('autoFill'))throw Error('Capital plan is in the Daily desk.');goTab('control');$('autoFill').click();
      for(let i=0;i<120&&($('autoFill').disabled||/Reading live data/.test(($('autoStatus')||{}).textContent||''));i++)await sleep(250);
      await sleep(400);const s=snapshot();return JSON.stringify({status:s.autofillStatus,plan:s.plan||null,ticket:s.ticket||null});
    }
    if(name==='open_trades_to_log'){
      if(!$('importFills')||!window.fableAuto)throw Error('The Journal import is in the Daily desk.');goTab('jrn');await window.fableAuto.importFills(false);
      return clip($('fillsOut').textContent,600)||'Nothing listed.';
    }
    if(name==='read_screen')return readScreen(input&&input.tab);
    if(name==='read_journal')return readJournal(input&&input.limit);
    if(name==='read_register')return readRegister(input&&input.limit);
    if(name==='read_account')return readAccount();
    if(name==='read_scan')return readScan();
    if(name==='read_market')return readMarket(String(input&&input.product||'BTC-USD'));
    throw Error('Unknown tool '+name);
  }
  // Everything below only reads. Each result is plain JSON or text, trimmed so one call stays small.
  const cap=(o,n=9000)=>{const j=typeof o==='string'?o:JSON.stringify(o);return j.length>n?j.slice(0,n)+' …(trimmed)':j};
  function panelText(panel){
    // Visible text of a tab, with every input written as "Label: value" so numbers are readable in place.
    const clone=panel.cloneNode(true);clone.querySelectorAll('script,style,svg,canvas,#cryptaRoot').forEach(x=>x.remove());
    clone.querySelectorAll('input,select,textarea').forEach(el=>{const src=panel.querySelector('#'+CSS.escape(el.id||'__none'));const v=src?(src.type==='checkbox'?(src.checked?'on':'off'):src.value):el.value;
      const span=document.createElement('span');span.textContent=' ['+(el.id?labelFor(el.id)+': ':'')+(v===''?'(empty)':v)+'] ';el.replaceWith(span)});
    clone.querySelectorAll('label[for]').forEach(l=>l.remove());
    clone.querySelectorAll('tr').forEach(tr=>tr.append(document.createTextNode('\n')));
    clone.querySelectorAll('p,div,h1,h2,h3,h4,li,section,table,details,summary').forEach(x=>x.append(document.createTextNode('\n')));
    return clone.textContent.replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
  }
  function readScreen(tab){
    let panel=null;
    if(tab){const b=document.querySelector('nav button[data-p="'+tab+'"]');if(!b)throw Error('No '+tab+' tab here.');panel=$('p-'+tab)}
    else panel=document.querySelector('section.panel.on')||document.querySelector('main')||document.body;
    if(!panel)throw Error('Nothing to read.');
    const head=[...document.querySelectorAll('#liveStrip,.warn,header')].filter(x=>x.offsetParent!==null).map(x=>panelText(x)).join('\n');
    return cap((tab?'Tab '+tab:'Current tab '+((activeTab()||{}).label||''))+':\n'+panelText(panel)+'\n\nTop of page:\n'+head,12000);
  }
  function readJournal(limit){
    const T=typeof TRADES!=='undefined'&&Array.isArray(TRADES)?TRADES:[];const n=Math.max(1,Math.min(200,+limit||50));
    const withFees=T.filter(t=>Number.isFinite(t.fee));
    return cap({trades:T.length,netPnl:+T.reduce((a,t)=>a+t.pnl,0).toFixed(2),wins:T.filter(t=>t.pnl>0).length,losses:T.filter(t=>t.pnl<0).length,feesRecorded:+withFees.reduce((a,t)=>a+t.fee,0).toFixed(2),
      byFollowedPlan:['Yes','Partly','No',null].map(f=>({followed:f,trades:T.filter(t=>(t.follow||null)===f).length,netPnl:+T.filter(t=>(t.follow||null)===f).reduce((a,t)=>a+t.pnl,0).toFixed(2)})),
      coolingOff:window.fableAuto&&window.fableAuto.coolingOff?window.fableAuto.coolingOff():null,
      recent:T.slice(-n).map(t=>({logged:t.d,closedAt:t.closedAt||null,symbol:t.sym,trial:t.rule||null,sizeUSD:t.size,expectedEntry:t.exp,entry:t.act,exit:t.exit,feesUSD:t.fee,slippagePct:+(+t.slip).toFixed(4),pnl:+(+t.pnl).toFixed(2),returnPct:Number.isFinite(t.ret)?+(t.ret*100).toFixed(3):null,followedPlan:t.follow||null,note:t.note||null}))});
  }
  function readRegister(limit){
    const H=typeof HYP!=='undefined'&&Array.isArray(HYP)?HYP:[];const n=Math.max(1,Math.min(100,+limit||30));
    return cap({entries:H.length,configurationsSpent:H.reduce((a,h)=>a+(+h.spent||0),0),budget:typeof BUDGET!=='undefined'?BUDGET:null,
      recent:H.slice(-n).map(h=>({id:h.id,date:h.t,strategy:h.st,params:h.p,configurationsSpent:h.spent,why:h.why,trades:h.n,sharpe:h.sr,pbo:h.pbo,returnPct:h.ret,data:h.data,verdict:h.verdict||h.v||null,dsr:h.dsr??null}))},10000);
  }
  function readAccount(){
    const st=window.fableAuto&&window.fableAuto.state?window.fableAuto.state():{};const g=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
    const log=g('fable-desk:equity-log')||[];
    return cap({connected:!!(st.ACCOUNT&&st.ACCOUNT.configured&&st.ACCOUNT.ok!==false),accountError:st.ACCOUNT&&st.ACCOUNT.error||null,snapshot:st.SNAP||null,
      netDeposits:(g('fable-desk:net-deposits')||{}).value??0,highWaterMark:(g('fable-desk:hwm')||{}).value??null,equityLog:log.slice(-30),
      costs:g('fable-shared:costs'),plansByCoin:Object.fromEntries(Object.entries(g('fable-desk:plans')||{}).map(([k,v])=>[k,(Array.isArray(v)?v:[v]).slice(-5)]))},10000);
  }
  function readScan(){
    if(typeof LAST_SCAN==='undefined'||!LAST_SCAN)return 'No daily scan has run in this session. The scan status on screen: '+clip(($('scanStatus')||{}).textContent,300);
    const r=LAST_SCAN.result||{};
    return cap({observedAt:LAST_SCAN.observedAt,status:clip(($('scanStatus')||{}).textContent,300),signals:clip(($('scanSignals')||{}).textContent,1500),
      details:(r.details||[]).map(d=>({product:d.product,bars:d.bars,lastClose:d.lastClose??d.close??null,hypotheses:d.hypotheses||d.signals||null})),errors:r.errors||[],topMarkets:clip(($('scanMarketsTable')||{}).textContent,1500)},9000);
  }
  async function readMarket(product){
    if(!/^[A-Z0-9]{1,15}-(USD|USDC)$/.test(product))throw Error('Use a pair like BTC-USD.');
    const get=async u=>{const r=await fetch(u,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
    const base=onLauncher?'/coinbase-exchange/products/':'https://api.exchange.coinbase.com/products/';
    const [t,st]=await Promise.all([get(base+product+'/ticker'),get(base+product+'/stats')]);
    let bars=null;try{if(typeof fetchCandles==='function'){const b=await fetchCandles(product,86400,30,()=>{});bars={days:b.length,from:b[0]&&b[0].d,to:b.at(-1)&&b.at(-1).d,low30:Math.min(...b.map(x=>x.l)),high30:Math.max(...b.map(x=>x.h)),lastClose:b.at(-1)&&b.at(-1).c}}}catch(e){}
    return cap({product,bid:+t.bid,ask:+t.ask,last:+t.price,open24h:+st.open,high24h:+st.high||null,low24h:+st.low||null,volume24h:+st.volume,completedDaily30:bars,note:'Live public data. Context only: the study and sizing use completed daily closes.'});
  }

  /* ---------------- bridge between Crypta's own window and the open tools ---------------- */
  let focusAt=document.hasFocus()?Date.now():0;const peers={};let pending={};
  window.addEventListener('focus',()=>{focusAt=Date.now();publish()});
  function publish(){if(CH&&!STANDALONE)CH.postMessage({type:'state',page:PAGE_ID,focusAt,state:snapshot()})}
  if(CH){
    CH.onmessage=async e=>{const m=e.data||{};
      if(m.type==='state'&&STANDALONE){peers[m.page]={focusAt:m.focusAt,state:m.state,seen:Date.now()};renderStatusLine()}
      if(m.type==='hello'&&!STANDALONE)publish();
      if(m.type==='cmd'&&!STANDALONE&&m.target===PAGE_ID){let result,error;try{result=await runTool(m.name,m.input)}catch(x){error=x.message}CH.postMessage({type:'cmd-result',id:m.id,result,error});publish()}
      if(m.type==='cmd-result'&&STANDALONE&&pending[m.id]){pending[m.id](m);delete pending[m.id]}
    };
    if(STANDALONE)CH.postMessage({type:'hello'});else{setInterval(publish,3000);setTimeout(publish,800)}
  }
  function bestPeer(){const live=Object.entries(peers).filter(([k,v])=>Date.now()-v.seen<10000).sort((a,b)=>b[1].focusAt-a[1].focusAt);return live[0]||null}
  function currentState(){if(!STANDALONE)return snapshot();const p=bestPeer();return p?p[1].state:null}
  async function tool(name,input){
    if(!STANDALONE)return runTool(name,input);
    const p=bestPeer();if(!p)throw Error('No Fable tool is open. Open the Daily desk from the start page and ask again.');
    const id=Math.random().toString(36).slice(2);
    return new Promise((res,rej)=>{pending[id]=m=>m.error?rej(Error(m.error)):res(m.result);CH.postMessage({type:'cmd',id,target:p[0],name,input});
      setTimeout(()=>{if(pending[id]){delete pending[id];rej(Error('The Fable tool did not answer.'))}},35000)});
  }

  /* ---------------- guide search (works with no key and no network) ---------------- */
  const STOP=new Set('a an and are as at be but by can do does for from how i if in is it its me my of on or so that the this to what when where which who why will with you your'.split(' '));
  // Light stemming so "connect", "connecting" and "connected" meet; titles weigh most.
  const stem=w=>w.length>5?w.replace(/(ing|ed|es|s)$/,''):w.length>3?w.replace(/s$/,''):w;
  const words=s=>String(s).toLowerCase().replace(/[^a-z0-9$%.\s-]/g,' ').split(/\s+/).map(w=>w.replace(/^[.-]+|[.-]+$/g,'')).filter(w=>w&&!STOP.has(w)).map(stem);
  const DOCS=GUIDE.map(g=>({...g,t:words(g.title),w:words(g.text)}));
  const DF={};DOCS.forEach(d=>new Set([...d.t,...d.w]).forEach(w=>DF[w]=(DF[w]||0)+1));
  const AVG=DOCS.reduce((a,d)=>a+d.w.length,0)/Math.max(1,DOCS.length);
  function search(q,k=3){
    const qw=words(q);if(!qw.length)return [];
    return DOCS.map(d=>{let sc=0;qw.forEach(w=>{const idf=Math.log(1+(DOCS.length-(DF[w]||0)+0.5)/((DF[w]||0)+0.5));
        const f=d.w.filter(x=>x===w||x.startsWith(w)&&w.length>3).length,tf=f*2.2/(f+1.2*(0.25+0.75*d.w.length/AVG));sc+=idf*(tf+(d.t.some(x=>x===w||x.startsWith(w)&&w.length>3)?4:0))});return {d,sc}})
      .filter(x=>x.sc>0.5).sort((a,b)=>b.sc-a.sc).slice(0,k).map(x=>({title:x.d.title,text:x.d.text}));
  }
  const money=n=>Number.isFinite(+n)?'$'+(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  function explainSize(s){
    if(!s||!s.plan){
      const need=['rEquity','rPeak','rCash','rOpen','rEntry','rStop','rEF','rXF','rES','rXS'].filter(id=>s&&s.fields&&s.fields[id]&&s.fields[id].value==='').map(id=>s.fields[id].label);
      if(need.length)return "Capital plan hasn't calculated yet because these are empty: **"+need.join(', ')+"**. "+(need.some(x=>/fee/i.test(x))?'Type your Coinbase fee once (it is remembered), or connect a View-only Coinbase key so fees, equity and cash fill themselves. ':'')+'Then press **Calculate**.';
      return 'Open **Capital plan** and let it calculate first; then I can tell you exactly what is limiting the size.';
    }
    const p=s.plan,out=[];
    if(p.coolingOff)out.push('**Cooling-off is on** until '+new Date(p.coolingOff.until).toLocaleString()+' — two losing trades closed within 24 hours. It lifts by itself.');
    if(p.stage==='HALT')out.push('**Hard pause**: equity is at or below the hard floor ('+money(p.hardFloor)+'). No new trades.');
    else if(p.stage==='NO_NEW_RISK')out.push('**No new risk**: the loss from $5,000 is '+money(p.lossFrom5000)+' (the limit is $750).');
    else if(p.stage==='REVIEW')out.push('**Review stage**: per-trade risk is halved because the loss from $5,000 is '+money(p.lossFrom5000)+'.');
    if(!p.coolingOff&&p.stage!=='HALT'&&p.stage!=='NO_NEW_RISK'&&p.headroom<=0.005)out.push('**No room left under the 1% open-risk cap**: existing positions already use it. Positions without a stop order count at full value — placing a stop in Coinbase frees room.');
    if(!out.length&&p.qty>0)out.push('Nothing is blocking you: the plan allows '+p.qty.toPrecision(6)+' units, costing about '+money(p.cost)+', with a modeled stop-out loss of '+money(p.modeledStopLoss)+' against a budget of '+money(p.riskBudget)+'.');
    if(!out.length)out.push('The size came out at zero, but not from a limit I can see. Check cash and the stop: the stop must be below the entry.');
    return out.join('\n\n');
  }
  function nextStep(s){
    if(!s)return 'Open the Daily desk from the start page and I can walk you through it.';
    const tips=[];
    if(s.coolingOff)tips.push('Cooling-off is active: no new trades until '+new Date(s.coolingOff.until).toLocaleString()+'. A good time to review the Journal.');
    if(s.fillsOut&&/to log/.test(s.fillsOut))tips.push('You have Coinbase trades to log: open the **Journal** and tap one button per trade.');
    if(s.accountConnected===false)tips.push('Coinbase is not connected, so equity, cash and fees stay manual. See "Connecting Coinbase".');
    tips.push('Daily routine: after 00:05 UTC press **Scan daily markets**; before any trade open **Capital plan** and place exactly the ticket; after a trade closes, log it in the **Journal**; export the backup.');
    return tips.join('\n\n');
  }
  function planMath(s){
    if(!s||!s.plan)return explainSize(s);const p=s.plan,f=k=>s.fields&&s.fields[k]?s.fields[k].value:'?';
    return '**Capital plan — '+p.stage.replace(/_/g,' ').toLowerCase()+'**\n\n'
      +'- Risk budget: '+money(p.riskBudget)+' (0.5% of equity'+(p.stage==='REVIEW'?', halved in review':'')+', capped by room under the 1% total: '+money(p.headroom)+')\n'
      +'- Entry fill '+money(p.entryFill)+', stop fill '+money(p.stopFill)+' → loss per unit '+money(p.lossPerUnit)+' including both fees\n'
      +'- Size = budget ÷ loss per unit = '+money(p.riskBudget)+' ÷ '+money(p.lossPerUnit)+' = **'+(+p.qty).toPrecision(6)+'** units, costing about '+money(p.cost)+'\n'
      +'- If the stop fills, you lose about '+money(p.modeledStopLoss)+'. Stop '+f('rStop')+', entry '+f('rEntry')+'.'
      +(p.coolingOff?'\n\nCooling-off is on, so the size is forced to zero.':'');
  }
  function stageAnswer(s){
    const e=s&&s.fields&&+((s.fields.rEquity||{}).value),pk=s&&s.fields&&+((s.fields.rPeak||{}).value);
    if(!Number.isFinite(e)||!e)return 'Open **Capital plan** so I can read your equity, then ask again.';
    const floor=Math.max(4000,(pk||5000)-1000);
    return 'Equity '+money(e)+' against the $5,000 start ('+(e>=5000?'up ':'down ')+money(Math.abs(e-5000))+').\n\n'
      +'- Review at $4,500: '+(e>4500?money(e-4500)+' away':'**reached**')+'\n- No new risk at $4,250: '+(e>4250?money(e-4250)+' away':'**reached**')+'\n- Hard pause at '+money(floor)+' (the higher of $4,000 and high-water '+money(pk||5000)+' − $1,000): '+(e>floor?money(e-floor)+' away':'**reached**');
  }
  function journalAnswer(s){
    const J=s&&s.journal;if(!J||!J.trades)return 'No trades are logged yet. After a Coinbase round trip closes, open the **Journal** and tap one button to log it.';
    return J.trades+' trade'+(J.trades>1?'s':'')+' logged, net P&L **'+money(J.netPnl)+'**.\n\n'+J.recent.map(t=>'- '+t.date+' '+t.symbol+': '+money(t.pnl)+(t.followedPlan?' (followed plan: '+t.followedPlan+')':'')).join('\n')
      +'\n\nThe Journal tab has the full review: fees, fee share of profit, and results split by whether you followed the plan.';
  }
  function openRiskAnswer(s){
    const A=s&&s.account;if(!A)return 'Open risk comes from your Coinbase positions and stop orders. Connect a View-only key (see "Connecting Coinbase") or type it in Capital plan.';
    if(!A.positions.length)return 'No open positions, so open risk is $0 and the full 1% of equity is available.';
    return 'Open risk **'+money(A.openStopRisk+A.unprotectedUSD)+'**:\n\n'+A.positions.map(p=>'- '+p.asset+' '+money(p.valueUSD)+': '+(p.stopOrders?p.stopOrders+' stop order'+(p.stopOrders>1?'s':'')+', counted risk ':'**no stop order**, counted at full value ')+money(p.countedRisk)).join('\n')
      +'\n\nThe cap is 1% of equity for all positions together.';
  }
  function guideAnswer(q,s){
    const lq=q.toLowerCase();
    if(/explain (my|the|this) (capital )?plan|how (is|was) (my|the) size|walk me through (my|the) plan/.test(lq))return planMath(s);
    if(/stage|how close|limit[s]? (am i|left)|how much (room|can i lose)|drawdown|hard (floor|pause)/.test(lq)&&!/what are the/.test(lq))return stageAnswer(s);
    if(/how am i doing|my (trades|journal|results|p&l|pnl)|win rate/.test(lq))return journalAnswer(s);
    if(/(my|current) open risk|how much risk (do i have|is open)|what is at risk/.test(lq))return openRiskAnswer(s);
    if(/(why|how come).*(size|quantity|qty|position|ticket).*(0|zero|nothing|no trade)|(size|position|quantity).*(zero|\$0|0\b)|can'?t (buy|trade)|no trade/.test(lq))return explainSize(s);
    if(/what (should|do) i do|next step|where (do|should) i start|today/.test(lq))return nextStep(s);
    const hits=search(q,2);
    if(!hits.length)return "I couldn't find that in my guide. Try asking about Capital plan, the trade ticket, open risk, cooling-off, the Journal, deposits, the tax CSV, or connecting Coinbase. With an Anthropic key in the private folder I can answer anything about the app.";
    return '**'+hits[0].title+'**\n\n'+hits[0].text+(hits[1]?'\n\n**'+hits[1].title+'**\n\n'+hits[1].text.split('. ').slice(0,2).join('. ')+(hits[1].text.split('. ').length>2?'.':''):'');
  }

  /* ---------------- secrets never leave the page ---------------- */
  function looksSecret(t){return /sk-ant-[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|organizations\/[0-9a-f-]{8,}\/apiKeys\/|"privateKey"\s*:|\b[A-Za-z0-9+\/]{60,}={0,2}(?![A-Za-z0-9+\/=])/.test(t)}

  /* ---------------- messages ---------------- */
  let CHAT=LS.get('crypta:chat',[]).filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.text==='string').slice(-40);
  const save=()=>LS.set('crypta:chat',CHAT.slice(-40));
  function inline(h){
    return h.replace(/`([^`\n]{1,120})`/g,'<code>$1</code>').replace(/\*\*([^*\n]{1,300})\*\*/g,'<strong>$1</strong>').replace(/(^|[\s(])_([^_\n]{1,300})_(?=$|[\s.,)])/g,'$1<em>$2</em>')
      .replace(/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]{1,300})\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function md(t){
    // Escape first, then add a small, closed set of formatting. Links only for http(s).
    const lines=esc(t).split('\n'),out=[];let list=null,i=0;
    const close=()=>{if(list){out.push('</'+list+'>');list=null}};
    while(i<lines.length){const l=lines[i];
      if(/^```/.test(l.trim())){close();const buf=[];i++;while(i<lines.length&&!/^```/.test(lines[i].trim()))buf.push(lines[i++]);i++;out.push('<pre><code>'+buf.join('\n')+'</code></pre>');continue}
      if(/^\s*\|.*\|\s*$/.test(l)&&i+1<lines.length&&/^\s*\|[\s:|-]+\|\s*$/.test(lines[i+1])){close();const row=x=>x.trim().replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim()));
        let h='<div class="crypta-table"><table><thead><tr>'+row(l).map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>';i+=2;
        while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i]))h+='<tr>'+row(lines[i++]).map(c=>'<td>'+c+'</td>').join('')+'</tr>';out.push(h+'</tbody></table></div>');continue}
      const hd=l.match(/^(#{1,4})\s+(.*)$/);if(hd){close();out.push('<p class="crypta-h"><strong>'+inline(hd[2])+'</strong></p>');i++;continue}
      const m=l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if(m){const want=/^\s*\d/.test(l)?'ol':'ul';if(list!==want){close();list=want;out.push('<'+list+'>')}out.push('<li>'+inline(m[1])+'</li>')}
      else{close();if(l.trim())out.push('<p>'+inline(l)+'</p>')}
      i++}
    close();return out.join('');
  }

  /* ---------------- UI ---------------- */
  const root=document.createElement('div');root.id='cryptaRoot';root.className=STANDALONE?'crypta-standalone':'';
  root.innerHTML=(STANDALONE?'':'<button type="button" id="cryptaFab" class="crypta-fab" aria-label="Ask Crypta" title="Ask Crypta">'+SPRITE+'</button>')
    +'<section id="cryptaPanel" class="crypta-panel" role="dialog" aria-label="Crypta" '+(STANDALONE?'':'hidden')+'>'
    +'<header class="crypta-head"><span class="crypta-ava">'+SPRITE+'</span><div><strong>Crypta</strong><span id="cryptaMode" class="crypta-mode">…</span></div>'
    +'<span class="crypta-sp"></span><button type="button" id="cryptaNew" title="New chat" aria-label="New chat">＋</button><button type="button" id="cryptaSettingsBtn" title="Settings" aria-label="Settings">⚙</button>'
    +(STANDALONE?'':(onLauncher?'<button type="button" id="cryptaPop" title="Open in her own window" aria-label="Open in her own window">⧉</button>':'')+'<button type="button" id="cryptaClose" title="Close" aria-label="Close">✕</button>')+'</header>'
    +'<div id="cryptaSettings" class="crypta-settings" hidden></div>'
    +'<div id="cryptaStatusLine" class="crypta-statusline" '+(STANDALONE?'':'hidden')+'></div>'
    +'<div id="cryptaLog" class="crypta-log" aria-live="polite"></div>'
    +'<div id="cryptaChips" class="crypta-chips"></div>'
    +'<form id="cryptaForm" class="crypta-form" autocomplete="off"><textarea id="cryptaInput" rows="1" placeholder="Ask anything about the app or your numbers… (Alt+C)" aria-label="Message Crypta"></textarea>'
    +'<button type="submit" id="cryptaSend" aria-label="Send">➤</button></form></section>';
  (STANDALONE?$('cryptaStandalone'):document.body).appendChild(root);
  const log=$('cryptaLog');
  function bubble(role,text,extra){const d=document.createElement('div');d.className='crypta-msg '+role+(extra?' '+extra:'');
    d.innerHTML=(role==='assistant'?'<span class="crypta-mini">'+SPRITE+'</span>':'')+'<div class="crypta-body"><div class="crypta-tools"></div><div class="crypta-text">'+(role==='assistant'?md(text):esc(text).replace(/\n/g,'<br>'))+'</div>'
      +(role==='assistant'&&extra!=='hello'?'<div class="crypta-actions"><button type="button" data-a="copy" title="Copy">Copy</button><button type="button" data-a="retry" title="Ask again">Retry</button></div>':'')+'</div>';
    d.querySelectorAll('.crypta-actions button').forEach(b=>b.addEventListener('click',async()=>{
      if(b.dataset.a==='copy'){try{await navigator.clipboard.writeText(d.querySelector('.crypta-text').innerText);b.textContent='Copied'}catch(e){b.textContent='Select and copy'}setTimeout(()=>b.textContent='Copy',1500)}
      else retry()}));
    log.appendChild(d);log.scrollTop=log.scrollHeight;return d}
  const TOOL_LABEL={go_to_tab:'Switched tab',point_at:'Pointed at a field',refresh_capital_plan:'Refreshed Capital plan',open_trades_to_log:'Opened trades to log',read_screen:'Read the screen',read_journal:'Read the Journal',read_register:'Read the Register',read_account:'Read the account',read_scan:'Read the daily scan',read_market:'Read live market data'};
  function toolChip(el,name,ok){const c=document.createElement('span');c.className='crypta-chip-tool'+(ok?'':' bad');c.textContent=(ok?'✓ ':'✗ ')+(TOOL_LABEL[name]||name);el.querySelector('.crypta-tools').appendChild(c)}
  function renderLog(){log.innerHTML='';if(!CHAT.length)bubble('assistant',"Hi, I'm **Crypta**. I know this app inside out and can see the numbers on your screen. Ask me anything, or tap a suggestion.",'hello');CHAT.forEach(m=>bubble(m.role,m.text));chips()}
  const CHIPS={control:['Explain my Capital plan','Why is my trade size $0?','How close am I to the limits?'],jrn:['How am I doing?','Log my Coinbase trades','What does the review mean?'],
    scan:['What did today\'s scan say?','What is H2?','What should I do today?'],lab:['What is a trial?','Why did the rules fail?','How do I lock a test?'],bud:['What is the trial budget?'],siz:['Explain Kelly sizing here'],
    hyp:['What is in my register?','How do backups work?'],exec:['What does the execution audit do?'],research:['What is the locked study?'],doc:['Summarise the method']};
  function chips(){
    const s=currentState(),tab=s&&s.tab&&s.tab.id,list=(CHAT.length?[]:['What should I do today?']).concat(CHIPS[tab]||['What should I do today?','How do I connect Coinbase?','What can you do?']).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
    const c=$('cryptaChips');c.innerHTML=list.map(q=>'<button type="button">'+esc(q)+'</button>').join('');c.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>send(b.textContent)))}
  let STATUS=null;
  async function refreshStatus(){
    if(!onLauncher){STATUS={configured:false,offline:true};return}
    try{const r=await fetch('/crypta/status',{headers:{'X-Fable-Local':'1'},credentials:'omit'});STATUS=r.ok?await r.json():{configured:false}}catch(e){STATUS={configured:false,offline:true}}
    const s=settings();if(STATUS.models&&!STATUS.models[s.model])LS.set('crypta:settings',{...s,model:STATUS.defaultModel});
    const b=brain(),m=$('cryptaMode');
    m.textContent=b==='claude'?'AI · '+(STATUS.models[settings().model]||'').split(' (')[0]:b==='local'?'Local AI · '+localModel()+' · free':STATUS.offline?'Guide mode · launcher not running':'Guide mode';m.className='crypta-mode '+(b==='guide'?'guide':'ai');
  }
  function renderStatusLine(){const el=$('cryptaStatusLine');if(!el||!STANDALONE)return;const p=bestPeer();
    el.textContent=p?'Seeing: '+(p[1].state&&p[1].state.page||'Fable')+(p[1].state&&p[1].state.tab?' · '+p[1].state.tab.label:''):'No Fable tool open — I can still answer questions from my guide.'}
  function renderSettings(){
    const st=STATUS||{},s=settings(),el=$('cryptaSettings'),loc=st.local||{running:false,installed:[],recommended:[]};
    const opt=(v,l,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
    el.innerHTML='<label>Brain<select id="cryptaBrain">'+opt('auto','Automatic (Claude if a key is set, else local, else guide)',s.brain==='auto')+opt('claude','Claude (Anthropic API key, paid)',s.brain==='claude')+opt('local','Local model on this PC (free, via Ollama)',s.brain==='local')+opt('guide','Built-in guide only',s.brain==='guide')+'</select></label>'
      +'<div class="crypta-box"><strong>Local model (free)</strong> · '+(loc.running?(loc.installed.length?'Ollama running':'Ollama running, no model yet'):'Ollama not found')
        +(loc.running&&loc.installed.length?'<label>Model<select id="cryptaLocalModel">'+loc.installed.map(m=>opt(m,m,m===localModel())).join('')+'</select></label>':'')
        +(loc.running?'<div class="crypta-dl">'+loc.recommended.filter(r=>!loc.installed.includes(r.model)).map(r=>'<button type="button" data-pull="'+esc(r.model)+'">Download '+esc(r.label)+'</button>').join('')+'</div><div id="cryptaPull" class="crypta-note"></div>'
          :'<p class="crypta-note">Install Ollama from <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">ollama.com/download</a> (free), start it, then press Refresh. Then download a model here with one click. Answers are slower and less sharp than Claude, but free and private: nothing leaves your PC.</p>')
        +'<button type="button" id="cryptaRefresh">Refresh</button></div>'
      +'<div class="crypta-box"><strong>Claude</strong> · '+(st.configured?'key found':'no key')
        +(st.configured?'<label>Model<select id="cryptaModel">'+Object.entries(st.models||{}).map(([k,v])=>opt(k,v,k===s.model)).join('')+'</select></label>'
          +'<label>Monthly spending cap ($)<input type="number" id="cryptaCap" min="0" max="500" step="1" value="'+esc(st.capUSD??5)+'"></label>'
          +'<p class="crypta-note">This month: <strong>'+money(st.spentUSD)+'</strong> of '+money(st.capUSD)+' over '+st.requests+' request'+(st.requests===1?'':'s')+'. A typical question costs about '+(st.perQuestionUSD&&st.perQuestionUSD[s.model]?'$'+st.perQuestionUSD[s.model].toFixed(3):'a cent')+'. Estimates from list prices; your Anthropic console is the bill.</p>'
          :'<p class="crypta-note">Paid, and not included in a Claude Pro plan. To use it, save an Anthropic API key as a text file in the <code>private</code> folder.</p>')+'</div>'
      +'<label class="crypta-row"><input type="checkbox" id="cryptaShare" '+(s.share?'checked':'')+'> Let Crypta see the numbers on screen'+(brain()==='claude'?' (sent to Anthropic with your question; never your keys)':'')+'</label>'
      +'<div class="crypta-row"><button type="button" id="cryptaClear">Clear chat</button>'+(STANDALONE&&window.__cryptaInstall?'<button type="button" id="cryptaInstall">Install on taskbar</button>':'')+'</div>';
    const upd=p=>{LS.set('crypta:settings',{...settings(),...p});refreshStatus().then(renderSettings)};
    $('cryptaBrain').addEventListener('change',e=>upd({brain:e.target.value}));
    $('cryptaLocalModel')&&$('cryptaLocalModel').addEventListener('change',e=>upd({localModel:e.target.value}));
    $('cryptaModel')&&$('cryptaModel').addEventListener('change',e=>upd({model:e.target.value}));
    $('cryptaRefresh').addEventListener('click',()=>refreshStatus().then(renderSettings));
    $('cryptaShare').addEventListener('change',e=>LS.set('crypta:settings',{...settings(),share:e.target.checked}));
    $('cryptaCap')&&$('cryptaCap').addEventListener('change',async e=>{try{const r=await fetch('/crypta/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Fable-Local':'1'},body:JSON.stringify({capUSD:+e.target.value})});STATUS={...STATUS,...await r.json()}}catch(x){}renderSettings()});
    el.querySelectorAll('button[data-pull]').forEach(b=>b.addEventListener('click',()=>pullModel(b.dataset.pull)));
    $('cryptaClear').addEventListener('click',()=>{CHAT=[];save();renderLog()});
    $('cryptaInstall')&&$('cryptaInstall').addEventListener('click',async()=>{const p=window.__cryptaInstall;window.__cryptaInstall=null;p.prompt();await p.userChoice.catch(()=>{});renderSettings()});
  }
  async function pullModel(model){
    const out=$('cryptaPull');out.textContent='Starting download of '+model+'…';$('cryptaSettings').querySelectorAll('button[data-pull]').forEach(b=>b.disabled=true);
    try{const r=await fetch('/crypta/local/pull',{method:'POST',headers:{'Content-Type':'application/json','X-Fable-Local':'1'},body:JSON.stringify({model})});
      if(!r.ok){let m='HTTP '+r.status;try{m=(await r.json()).error||m}catch(e){}throw Error(m)}
      const rd=r.body.getReader(),dec=new TextDecoder();let buf='',last='';
      for(;;){const {done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
        while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line)continue;let ev;try{ev=JSON.parse(line)}catch(e){continue}
          if(ev.error)throw Error(ev.error);last=ev.status||last;
          // Real Ollama sends a layer's total before any "completed", and a few tiny layers: show GB only for the big one.
          const got=+ev.completed||0;out.textContent=ev.total>=1e8?model+': '+(got/1e9).toFixed(2)+' of '+(ev.total/1e9).toFixed(2)+' GB ('+Math.floor(100*got/ev.total)+'%)':model+': '+last}}
      if(!/success/i.test(last))throw Error('download ended early ('+last+')');
      LS.set('crypta:settings',{...settings(),localModel:model});await refreshStatus();renderSettings();$('cryptaPull')&&($('cryptaPull').textContent=model+' is ready. I will use it for answers.');
    }catch(e){out.textContent='Download failed: '+e.message;$('cryptaSettings').querySelectorAll('button[data-pull]').forEach(b=>b.disabled=false)}
  }

  /* ---------------- talking ---------------- */
  let BUSY=false,ABORT=null;
  async function send(text){
    text=String(text||'').trim();if(!text||BUSY)return;
    if(looksSecret(text)){bubble('user','[message not sent: it contained what looks like a key]');bubble('assistant',"That looks like an **API key or private key**, so I didn't send it anywhere or save it. Treat it as exposed: delete that key where you created it and make a new one. Keys only ever go in as **files in the private folder**, never typed into a chat — including this one.");return}
    CHAT.push({role:'user',text});save();bubble('user',text);$('cryptaInput').value='';
    const state=currentState();
    if(!STATUS)await refreshStatus();
    if(brain()==='guide'){const a=/what can you do|who are you|help$/i.test(text)?"I'm Crypta. I explain this app and your numbers: your Capital plan and its math, how close you are to each limit, your open risk, how your trades are going, and any feature. I can switch tabs and point at fields for you."+(STATUS.offline?'':"\n\nRight now I'm in **guide mode**. For free-form answers where I read anything in the app, give me a brain in settings (⚙): a free local model through Ollama, or Claude with an Anthropic API key."):guideAnswer(text,state);CHAT.push({role:'assistant',text:a});save();bubble('assistant',a);chips();return}
    BUSY=true;$('cryptaSend').textContent='■';$('cryptaSend').setAttribute('aria-label','Stop');
    const out=bubble('assistant','','streaming'),box=out.querySelector('.crypta-text');let shown='';
    const history=CHAT.slice(-20).map(m=>({role:m.role,content:m.text}));while(history.length&&history[0].role!=='user')history.shift();
    try{
      for(let round=0;round<5;round++){
        ABORT=new AbortController();
        const r=await fetch('/crypta/chat',{method:'POST',signal:ABORT.signal,headers:{'Content-Type':'application/json','X-Fable-Local':'1'},credentials:'omit',
          body:JSON.stringify({provider:brain()==='local'?'local':'anthropic',model:brain()==='local'?localModel():settings().model,messages:history,state:settings().share?currentState():null,guide:search(text+' '+(state&&state.tab?state.tab.label:''),3)})});
        if(!r.ok){let m='HTTP '+r.status;try{m=(await r.json()).error||m}catch(e){}throw Error(m)}
        const blocks=[];let cur=null,stop=null,buf='';const rd=r.body.getReader(),dec=new TextDecoder();
        for(;;){const {done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
          while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line.startsWith('data:'))continue;let ev;try{ev=JSON.parse(line.slice(5))}catch(e){continue}
            if(ev.type==='content_block_start'){cur={...ev.content_block};if(cur.type==='text')cur.text=cur.text||'';if(cur.type==='tool_use')cur.json='';blocks.push(cur)}
            else if(ev.type==='content_block_delta'&&cur){if(ev.delta.type==='text_delta'){cur.text+=ev.delta.text;shown+=ev.delta.text;box.innerHTML=md(shown);log.scrollTop=log.scrollHeight}else if(ev.delta.type==='input_json_delta')cur.json+=ev.delta.partial_json}
            else if(ev.type==='content_block_stop'){if(cur&&cur.type==='tool_use'){try{cur.input=cur.json?JSON.parse(cur.json):{}}catch(e){cur.input={}}delete cur.json}cur=null}
            else if(ev.type==='message_delta')stop=ev.delta&&ev.delta.stop_reason;
            else if(ev.type==='error')throw Error((ev.error&&ev.error.message)||'Anthropic error');}}
        const uses=blocks.filter(b=>b.type==='tool_use');
        if(stop!=='tool_use'||!uses.length)break;
        history.push({role:'assistant',content:blocks.map(b=>b.type==='text'?{type:'text',text:b.text}:{type:'tool_use',id:b.id,name:b.name,input:b.input}).filter(b=>b.type!=='text'||b.text)});
        const results=[];
        for(const u of uses){let res,err=false;try{res=await tool(u.name,u.input)}catch(e){res=e.message;err=true}
          toolChip(out,u.name,!err);if(shown&&!shown.endsWith('\n'))shown+='\n\n';
          results.push({type:'tool_result',tool_use_id:u.id,content:String(res).slice(0,12000),is_error:err})}
        history.push({role:'user',content:results});
      }
      if(!shown.trim())shown='(no answer)';
      CHAT.push({role:'assistant',text:shown.trim()});save();chips();
    }catch(e){
      const aborted=e.name==='AbortError',fallback=aborted?'':'\n\nFrom my guide instead:\n\n'+guideAnswer(text,state);
      shown+=(shown?'\n\n':'')+(aborted?'_Stopped._':'**I couldn\'t reach '+(brain()==='local'?'the local model':'Claude')+':** '+(e.message==='Failed to fetch'?'Launcher not reachable — is the black window still open?':e.message)+fallback);
      box.innerHTML=md(shown);CHAT.push({role:'assistant',text:shown});save();
    }finally{BUSY=false;ABORT=null;out.classList.remove('streaming');$('cryptaSend').textContent='➤';$('cryptaSend').setAttribute('aria-label','Send');refreshStatus()}
  }
  function retry(){if(BUSY)return;const i=CHAT.map(m=>m.role).lastIndexOf('user');if(i<0)return;const q=CHAT[i].text;CHAT=CHAT.slice(0,i);save();renderLog();send(q)}
  $('cryptaNew').addEventListener('click',()=>{if(BUSY)return;CHAT=[];save();renderLog()});
  $('cryptaForm').addEventListener('submit',e=>{e.preventDefault();if(BUSY&&ABORT){ABORT.abort();return}send($('cryptaInput').value)});
  $('cryptaInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('cryptaForm').requestSubmit()}});
  $('cryptaSettingsBtn').addEventListener('click',()=>{const s=$('cryptaSettings');s.hidden=!s.hidden;if(!s.hidden)renderSettings()});
  if(!STANDALONE){
    const open=v=>{$('cryptaPanel').hidden=!v;$('cryptaFab').classList.toggle('open',v);LS.set('crypta:open',!!v);if(v){$('cryptaInput').focus();refreshStatus();chips()}};
    // Alt+C opens and closes her from anywhere in the tool; the panel keeps its size and comes back open after a reload.
    document.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='c'||e.key==='C')){e.preventDefault();open($('cryptaPanel').hidden)}});
    const sz=LS.get('crypta:size',null);if(sz&&sz.w>=320&&sz.h>=380){$('cryptaPanel').style.width=sz.w+'px';$('cryptaPanel').style.height=sz.h+'px'}
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>{const p=$('cryptaPanel');if(!p.hidden&&p.offsetWidth)LS.set('crypta:size',{w:p.offsetWidth,h:p.offsetHeight})}).observe($('cryptaPanel'));
    document.querySelectorAll('nav button[data-p]').forEach(b=>b.addEventListener('click',()=>setTimeout(chips,50)));
    if(LS.get('crypta:open',false))setTimeout(()=>open(true),300);
    $('cryptaFab').addEventListener('click',()=>open($('cryptaPanel').hidden));$('cryptaClose').addEventListener('click',()=>open(false));
    // Her own window lives at the launcher's /crypta, so the button only exists there. A blocked popup gets a pointer instead.
    if($('cryptaPop'))$('cryptaPop').addEventListener('click',()=>{const w=window.open('/crypta','crypta','width=420,height=700');if(w)open(false);else bubble('assistant','Your browser blocked the window. Open **127.0.0.1:'+location.port+'/crypta** in a new tab, then choose Install to put me on the taskbar.')});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('cryptaPanel').hidden)open(false)});
  }else{window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__cryptaInstall=e});renderStatusLine();setInterval(renderStatusLine,3000)}
  if(STANDALONE)refreshStatus();renderLog();   // inside the tools she stays silent (no requests) until opened
  window.crypta={planMath,stageAnswer,journalAnswer,openRiskAnswer,readScreen,readJournal,readAccount,send,search,guideAnswer,explainSize,looksSecret,snapshot,runTool,md,status:()=>STATUS,chat:()=>CHAT};
})();
