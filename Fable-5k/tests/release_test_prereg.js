process.on('uncaughtException',e=>console.log('UNCAUGHT:',e.message));
const {JSDOM}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=m=>console.log('alert',m);w.Element.prototype.scrollIntoView=()=>{}}}).window,d=w.document;
(async()=>{await new Promise(r=>setTimeout(r,300));
 d.getElementById('csv').value=fs.readFileSync(__dirname+'/fixtures/edge.csv','utf8');d.getElementById('loadCsv').click();d.getElementById('note').value='prereg';
 d.getElementById('strat').value='ma';d.getElementById('strat').dispatchEvent(new w.Event('change'));
 d.getElementById('lockHyp').click();await new Promise(r=>setTimeout(r,100));
 for(let k=0;k<2;k++){d.getElementById('run').click();await new Promise(r=>setTimeout(r,1500));console.log('single run',k+1,':',d.getElementById('verdict').textContent.replace(/\s+/g,' ').slice(0,420))}
 d.getElementById('stp').value='-5';d.getElementById('run').click();await new Promise(r=>setTimeout(r,300));process.exit(0)})();
