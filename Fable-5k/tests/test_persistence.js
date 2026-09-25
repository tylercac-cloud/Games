const {JSDOM}=require('jsdom');const fs=require('fs');
const store=new Map();
const mkdb=()=>({doc:p=>({get:async()=>({exists:store.has(p),data:()=>store.get(p),id:p.split('/').pop()}),set:async d=>{store.set(p,JSON.parse(JSON.stringify(d)))},delete:async()=>{store.delete(p)}}),
 collection:c=>{const q={limit:()=>q,get:async()=>{const docs=[...store.keys()].filter(k=>k.startsWith(c+'/')&&k.split('/').length===2).map(k=>({id:k.split('/')[1],exists:true,data:()=>store.get(k)}));return{docs}},doc:id=>mkdb().doc(c+'/'+id)};return q}});
function tab(){return new JSDOM(fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.claude={use:async n=>n==='db'?mkdb():null};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{}}}).window}
const sleep=t=>new Promise(r=>setTimeout(r,t));
(async()=>{
 // Tab 1: load a CSV, build a 2-asset pool
 let w=tab(),d=w.document,$=i=>d.getElementById(i);await sleep(500);
 // dropdown populated from COINS
 console.log('P dropdown-count '+$('dPair').options.length+' first '+($('dPair').options[0]||{}).value);
 function csv(seed,year=2018){let s=seed;const r=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;let px=100;const out=['date,open,high,low,close'];const base=Date.UTC(year,0,1)/1000;
   for(let i=0;i<400;i++){const o=px;px*=Math.exp((r()-0.5)*0.04);const dt=new Date((base+i*86400)*1000).toISOString().slice(0,10);out.push(`${dt},${o.toFixed(2)},${(Math.max(o,px)*1.01).toFixed(2)},${(Math.min(o,px)*0.99).toFixed(2)},${px.toFixed(2)}`)}return out.join('\n')}
 $('csv').value=csv(1);$('loadCsv').click();await sleep(200);$('poolName').value='X';$('poolAdd').click();await sleep(100);
 $('csv').value=csv(2,2020);$('loadCsv').click();await sleep(200);$('poolName').value='Y';$('poolAdd').click();await sleep(100);
 $('poolOn').checked=true;$('poolOn').dispatchEvent(new w.Event('change'));await sleep(700);
 console.log('P tab1-pool '+d.getElementById('poolInfo').textContent.replace(/\s+/g,' ').includes('X'));
 console.log('P datasets-saved '+([...store.keys()].some(k=>k==='edgelab_meta/state')&&!!store.get('edgelab_meta/state').datasets));
 // Tab 2: fresh load, same store -> should restore
 w=tab();d=w.document;$=i=>d.getElementById(i);await sleep(800);
 const info=$('dataInfo').textContent.replace(/\s+/g,' ');
 console.log('P restored-msg '+/restored/i.test(info));
 // pool restored & active
 console.log('P pool-restored '+(d.getElementById('poolInfo').textContent.replace(/\s+/g,' ').includes('X')&&$('poolOn').checked));

 // Independent single-dataset round trip (no pool): break-single mutation must fail here.
 store.clear();
 w=tab();d=w.document;$=i=>d.getElementById(i);await sleep(500);
 $('csv').value=csv(9);$('loadCsv').click();await sleep(400);
 const savedSingle=!!(store.get('edgelab_meta/state')&&store.get('edgelab_meta/state').datasets&&store.get('edgelab_meta/state').datasets.single);
 console.log('P single-saved '+savedSingle);
 w=tab();d=w.document;$=i=>d.getElementById(i);await sleep(700);
 const barsN=await w.eval('BARS?BARS.length:0');
 console.log('P single-restored '+(barsN>=380));
 process.exit(0)})();
