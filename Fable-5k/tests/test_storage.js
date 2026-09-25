process.on('uncaughtException',e=>console.log('UNCAUGHT:',e.message));
const {JSDOM}=require('jsdom');const fs=require('fs');
const store=new Map(); // shared server
const mkdb=()=>({doc:p=>({get:async()=>({exists:store.has(p),data:()=>store.get(p),id:p.split('/').pop()}),set:async d=>{store.set(p,JSON.parse(JSON.stringify(d)))},delete:async()=>{store.delete(p)}}),
 collection:c=>{const q={limit:()=>q,get:async()=>{const docs=[...store.keys()].filter(k=>k.startsWith(c+'/')&&k.split('/').length===2).sort().map(k=>({id:k.split('/')[1],exists:true,data:()=>store.get(k)}));return{docs,size:docs.length,empty:!docs.length}},doc:id=>mkdb().doc(c+'/'+id)};return q}});
function tab(){return new JSDOM(fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 w.claude={use:async n=>n==='db'?mkdb():null};w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=m=>console.log('alert',m);w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};}}).window}
const sleep=t=>new Promise(r=>setTimeout(r,t));
async function run(w,st){const d=w.document;d.getElementById('loadBundled').click();d.getElementById('note').value='tab test '+st;
 d.getElementById('strat').value=st;d.getElementById('strat').dispatchEvent(new w.Event('change'));d.getElementById('runSweep').click();await sleep(12000)}
(async()=>{const A=tab(),B=tab();await sleep(500);
 console.log('banner A:',JSON.stringify(A.document.getElementById('storeWarn').textContent));
 await run(A,'rsi');await run(B,'brk');   // B loaded before A's write: old design would clobber
 const C=tab();await sleep(800);
 console.log('fresh tab sees configs:',C.document.getElementById('cN').textContent,'(expect 16 = 12 rsi + 4 brk)');
 console.log('docs in store:',[...store.keys()].join(', '));
 C.document.getElementById('clrHyp').click();await sleep(300);const D=tab();await sleep(800);
 console.log('after clear, fresh tab configs:',D.document.getElementById('cN').textContent);process.exit(0)})();
