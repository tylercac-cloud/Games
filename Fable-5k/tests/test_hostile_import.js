// Import a hostile backup and paste a hostile CSV: nothing may execute.
const {JSDOM}=require('jsdom');const fs=require('fs');const file=__dirname+'/../edge-lab/strategy-lab.html';
const w=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};w.__pwned=0}}).window,d=w.document;
const bad='<img src=x onerror="window.__pwned++">';
(async()=>{await new Promise(r=>setTimeout(r,400));
 d.getElementById('manualSave').value=JSON.stringify({format:'edge-lab',hyp:[{id:bad,t:bad,st:bad,p:{a:bad},spent:3,why:bad,n:bad,sr:bad,pbo:bad,ret:bad,data:bad}],trades:[{d:bad,sym:bad,rule:bad,slip:0.1,pnl:5}]});
 d.getElementById('impText').click();await new Promise(r=>setTimeout(r,300));
 d.getElementById('csv').value='date,open,high,low,close\n'+[...Array(30)].map((_,i)=>(i?'2020-01-'+String(i).padStart(2,'0'):bad)+',1,2,0.5,1').join('\n');d.getElementById('loadCsv').click();
 await new Promise(r=>setTimeout(r,300));
 const imgs=d.querySelectorAll('img').length;
 console.log('hostile import + CSV: injected <img> elements in page:',imgs,'| onerror handlers fired:',w.__pwned,'| import message:',d.getElementById('ioOut').textContent.replace(/\s+/g,' ').slice(0,90));process.exit(0)})();
