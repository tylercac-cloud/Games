const {JSDOM}=require('jsdom');const fs=require('fs');
function tab(){return new JSDOM(fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{}}}).window}
const sleep=t=>new Promise(r=>setTimeout(r,t));
// planted-edge CSV so MA passes
let s=42;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
let px=100,st=1;const rows=['date,open,high,low,close'];const base=Date.UTC(2016,0,1)/1000;
for(let i=0;i<3400;i++){if(rnd()<0.01)st=-st;const o=px;px*=Math.exp(0.006*st+0.036*g());const d=new Date((base+i*86400)*1000).toISOString().slice(0,10);
 rows.push(`${d},${o.toFixed(2)},${(Math.max(o,px)*1.005).toFixed(2)},${(Math.min(o,px)*0.995).toFixed(2)},${px.toFixed(2)}`)}
const passCsv=rows.join('\n');
(async()=>{
 // FAIL case: bundled BTC MA sweep
 let w=tab(),d=w.document,$=i=>d.getElementById(i),tx=i=>($(i).textContent||'').replace(/\s+/g,' ');
 await sleep(400);console.log('PANEL empty before run:',tx('actionPanel').trim()==='');
 $('loadBundled').click();$('note').value='x';$('strat').value='ma';$('strat').dispatchEvent(new w.Event('change'));$('runSweep').click();await sleep(22000);
 let t=tx('actionPanel');
 console.log('FAIL banner:',/did NOT survive testing/.test(t));
 console.log('FAIL levels:',/close near \$[\d,.]+ on the next bar/.test(t)||/Enter on a close above \$/.test(t));
 // PASS case
 w=tab();d=w.document;$=i=>d.getElementById(i);tx=i=>($(i).textContent||'').replace(/\s+/g,' ');await sleep(400);
 $('csv').value=passCsv;$('loadCsv').click();await sleep(200);$('note').value='x';$('strat').value='ma';$('strat').dispatchEvent(new w.Event('change'));$('runSweep').click();await sleep(25000);
 t=tx('actionPanel');console.log('PASS order:',/Historical model state · paper review only/.test(t));console.log('PASS sizing:',/fee-aware sizing against current equity/.test(t)&&!/2% of a \$5,000/.test(t));
 process.exit(0)})();
