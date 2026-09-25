const assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),fs=require('fs');
const errors=[],alerts=[];
const w=new JSDOM(fs.readFileSync(__dirname+'/../../edge-lab/edge-lab-v7.html','utf8'),{runScripts:'dangerously',url:'https://example.org',pretendToBeVisual:true,beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=x=>alerts.push(x);w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));}}).window;
const d=w.document,$=id=>d.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await pause(50);assert.ok($('p-scan').classList.contains('on'));
 $('planRisk').click();assert.match($('riskOut').textContent,/Fill in every/);
 for(const [k,v] of Object.entries({rEntry:100,rStop:90,rEF:.6,rXF:.6,rES:10,rXS:10}))$(k).value=v;
 $('planRisk').click();assert.match($('riskOut').textContent,/\$25.00/);assert.match($('riskOut').textContent,/Gap 3.00%/);
 $('auditDemo').click();$('auditRun').click();await pause(100);
 assert.match($('auditOut').textContent,/synthetic/);assert.match($('auditOut').textContent,/not a significance test/);assert.equal($('cN').textContent,'0');
 await pause(650);const backup=JSON.parse($('manualSave').value);assert.equal(backup.hyp.length,1);assert.equal(backup.hyp[0].engine,'next-open-v1');assert.ok(backup.hyp[0].audit.result.fills.length>0);
 // Export/import identity preserves trials differing only in cost or data.
 const first={id:'same',t:'2026-09-21',st:'ma',p:{fast:10,slow:50,thr:.5},spent:1,why:'<img src=x onerror=alert(99)>',n:12,sr:'0.1',pbo:null,data:'study',cfg:{cost:.01}};
 const second={...first,cfg:{cost:.02}},third={...first,data:'another asset'};
 const text=JSON.stringify({format:'edge-lab',hyp:[first,second,third],trades:[]});
 $('manualSave').value=text;$('impText').click();await pause(80);assert.equal($('cN').textContent,'3');assert.equal($('hypList').querySelectorAll('img').length,0);
 $('manualSave').value=text;$('impText').click();await pause(80);assert.equal($('cN').textContent,'3');
 $('manualSave').value=JSON.stringify({format:'edge-lab',hyp:[{...first,spent:-1}],trades:[]});$('impText').click();await pause(80);assert.match($('ioOut').textContent,/Invalid backup/);assert.equal($('cN').textContent,'3');
 // Invalid CSV clears the previous dataset, and neither execution nor legacy test can use stale data.
 $('csv').value='invalid';$('loadCsv').click();$('auditRun').click();await pause(20);assert.match($('auditOut').textContent,/Load data/);
 $('run').click();assert.match(alerts.pop(),/Load or generate data/);
 // Negative fees / zero price may not poison journal statistics.
 for(const [k,v] of Object.entries({jExp:100,jAct:0,jExit:110,jSize:500,jFee:0}))$(k).value=v;
 $('addTrade').click();assert.match(alerts.pop(),/positive/);assert.match($('jTable').textContent,/No live trades/);
 assert.deepEqual(errors,[]);w.close();console.log('PASS v6 UI: calculator, synthetic audit, persistence, full-entry import, escaping, invalid data and journal guards');
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
