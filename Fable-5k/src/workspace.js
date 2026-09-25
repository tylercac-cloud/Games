function selectWorkspaceTab(){
  const name=location.hash.slice(1);
  const button=Array.from(document.querySelectorAll('nav button[data-p]')).find(b=>b.dataset.p===name);
  if(button)button.click();
}
window.addEventListener('hashchange',selectWorkspaceTab);
selectWorkspaceTab();
const workspaceTabs=Array.from(document.querySelectorAll('nav button[role=tab]'));
workspaceTabs.forEach((button,i)=>button.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?workspaceTabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+workspaceTabs.length)%workspaceTabs.length;
  workspaceTabs[j].focus();workspaceTabs[j].click();
}));
/* ============ Live market strip ============
   Informational live snapshot (last trade, 24h range, 24h USD volume, bid/ask spread) from
   Coinbase Exchange public endpoints, routed through the local launcher when available.
   It never feeds the locked study, the scanner, sizing or any verdict: those use completed
   daily candles only. Auto-refresh runs only under the launcher or a local file. */
(function(){
  const header=document.querySelector('header');if(!header||document.getElementById('liveStrip'))return;
  const COINS=['BTC-USD','ETH-USD','SOL-USD'],REFRESH=30000;
  const onLauncher=location.protocol==='http:'&&(location.hostname==='127.0.0.1'||location.hostname==='localhost');
  const autoOK=onLauncher||location.protocol==='file:';
  const box=document.createElement('section');box.id='liveStrip';box.className='live-strip';box.setAttribute('aria-live','polite');
  box.innerHTML='<div class="live-head"><span class="live-dot" id="liveDot"></span><strong>Live market</strong><span id="liveStatus">Not loaded</span>'
    +'<button type="button" id="liveRefresh">Refresh</button>'+(onLauncher?'<button type="button" id="liveCheck">Check connection</button>':'')+'</div>'
    +'<div class="live-grid" id="liveGrid"></div><div class="live-diag" id="liveDiag"></div>'
    +'<div class="live-note">Snapshot for context only. Not a signal: the locked study, scanner and sizing use completed daily closes. Spread is one execution cost on top of your fee tier.</div>';
  header.insertAdjacentElement('afterend',box);
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=(pair,kind)=>onLauncher?'/coinbase-exchange/products/'+pair+'/'+kind:'https://api.exchange.coinbase.com/products/'+pair+'/'+kind;
  const usd=n=>n>=1000?'$'+n.toLocaleString('en-US',{maximumFractionDigits:0}):'$'+n.toLocaleString('en-US',{maximumFractionDigits:n>=1?2:6});
  const big=n=>n>=1e9?'$'+(n/1e9).toFixed(2)+'B':n>=1e6?'$'+(n/1e6).toFixed(1)+'M':'$'+Math.round(n).toLocaleString('en-US');
  async function getJSON(u){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{const r=await fetch(u,{credentials:'omit',signal:ctl.signal,headers:{Accept:'application/json'}});let body=null;try{body=await r.json()}catch(_){}
      if(!r.ok)throw new Error(body&&typeof body.error==='string'?body.error:'HTTP '+r.status);
      if(!body||typeof body!=='object')throw new Error('Non-JSON response');return body}
    catch(e){if(e&&e.name==='AbortError')throw new Error('Request timed out');if(e&&e.name==='TypeError')throw new Error(onLauncher?'Launcher not reachable — is the terminal window still open?':'Browser blocked the request. Open the app with the launcher for live data.');throw e}
    finally{clearTimeout(timer)}
  }
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  function parse(pair,stats,tick){
    const last=num(tick.price)??num(stats.last),open=num(stats.open),hi=num(stats.high),lo=num(stats.low),vol=num(stats.volume),bid=num(tick.bid),ask=num(tick.ask);
    if(!(last>0))throw new Error(pair+': no valid last price');
    const mid=bid>0&&ask>=bid?(bid+ask)/2:null;
    return {pair,last,change:open>0?(last/open-1)*100:null,high:hi,low:lo,volumeUSD:vol!==null?vol*last:null,spreadBps:mid?(ask-bid)/mid*1e4:null,time:tick.time||null};
  }
  let timer=null,busy=false,lastOK=null,lastRows=[];
  function render(rows){
    $('liveGrid').innerHTML=rows.map(r=>'<div class="live-cell"><div class="live-sym">'+esc(r.pair.replace('-USD',''))+'</div><div class="live-px">'+usd(r.last)+'</div>'
      +'<div class="'+(r.change===null?'':r.change>=0?'up':'down')+'">'+(r.change===null?'24h —':(r.change>=0?'+':'')+r.change.toFixed(2)+'% 24h')+'</div>'
      +'<div class="live-sub">'+(r.low!==null&&r.high!==null?'24h '+usd(r.low)+' – '+usd(r.high):'')+'</div>'
      +'<div class="live-sub">'+(r.volumeUSD!==null?'Vol '+big(r.volumeUSD):'')+(r.spreadBps!==null?' · spread '+r.spreadBps.toFixed(1)+' bps':'')+'</div></div>').join('');
  }
  function age(){if(!lastOK)return;const s=Math.round((Date.now()-lastOK)/1000);$('liveStatus').textContent='Updated '+(s<5?'just now':s+'s ago')+' · Coinbase Exchange'+(onLauncher?' via launcher':' direct')+(autoOK?' · auto-refresh 30s':'')}
  async function refresh(){
    if(busy)return;busy=true;$('liveRefresh').disabled=true;
    try{
      const rows=[],fails=[];
      for(const pair of COINS){try{const [stats,tick]=await Promise.all([getJSON(url(pair,'stats')),getJSON(url(pair,'ticker'))]);rows.push(parse(pair,stats,tick))}catch(e){fails.push(pair+': '+e.message)}}
      if(rows.length){lastRows=rows;lastOK=Date.now();render(rows);$('liveDot').className='live-dot '+(fails.length?'warn':'ok');age()}
      else{$('liveDot').className='live-dot bad';$('liveStatus').textContent='Offline'+(lastOK?' · showing last good snapshot':'')}
      $('liveDiag').textContent=fails.length?[...new Set(fails.map(f=>f.replace(/^[A-Z]+-USD: /,'')))].join(' · '):'';
    }finally{busy=false;$('liveRefresh').disabled=false}
  }
  async function check(){
    $('liveDiag').textContent='Checking Coinbase from the launcher…';
    try{const r=await getJSON('/health');$('liveDiag').innerHTML=r.checks.map(c=>(c.ok?'✓ ':'✗ ')+esc(c.name)+(c.ok?' — '+c.ms+' ms':' — '+esc(c.error))).join('<br>')}
    catch(e){$('liveDiag').textContent='✗ '+e.message}
  }
  function schedule(){clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)refresh();else age()},REFRESH)}
  $('liveRefresh').addEventListener('click',refresh);
  if($('liveCheck'))$('liveCheck').addEventListener('click',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&autoOK&&lastOK&&Date.now()-lastOK>REFRESH)refresh()});
  window.fableLive={refresh,check,parse,rows:()=>lastRows};
  if(autoOK&&typeof fetch==='function'){refresh();schedule();setInterval(age,5000)}
  else $('liveStatus').textContent=typeof fetch==='function'?'Press Refresh to load':'Unavailable in this browser';
})();
