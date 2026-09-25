const {JSDOM}=require('jsdom');const fs=require('fs');
const file=__dirname+'/../edge-lab/strategy-lab.html';
const html=fs.readFileSync(file,'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
    w.alert=m=>errors.push('ALERT: '+m);w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
    w.addEventListener('unhandledrejection',e=>errors.push('UNHANDLED: '+(e.reason&&e.reason.stack||e.reason)));
    w.addEventListener('error',e=>errors.push('ERROR: '+e.message));}});
const w=dom.window,d=w.document;
(async()=>{
  await new Promise(r=>setTimeout(r,300));
  d.getElementById('loadBundled').click();
  d.getElementById('note').value='MA trend persistence test';
  for(const [st,sweep] of [['ma',true],['rsi',true],['brk',true],['ma',false]]){
    d.getElementById('strat').value=st;d.getElementById('strat').dispatchEvent(new w.Event('change'));
    d.getElementById(sweep?'runSweep':'run').click();
    await new Promise(r=>setTimeout(r,20000));
    const v=d.getElementById('verdict');
    console.log(`${st} ${sweep?'sweep':'single'} -> verdict: "${v.textContent.trim().slice(0,160)}"  | PBO panel: ${d.getElementById('pboBody').textContent.replace(/\s+/g,' ').slice(0,40)}`);
  }
  console.log('errors:',errors.length?errors.map(e=>e.slice(0,200)).join('\n'):'none');
  process.exit(0);
})();
