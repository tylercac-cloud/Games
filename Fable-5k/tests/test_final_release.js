const assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom');
const file=process.env.EDGE_APP||__dirname+'/../edge-lab/strategy-lab.html';
const errors=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
const w=new JSDOM(fs.readFileSync(file,'utf8'),{url:'http://127.0.0.1:8765/edge-lab/strategy-lab.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
 w.addEventListener('error',e=>errors.push(e.message));
}}).window;
const check=(name,ok)=>{assert.ok(ok,name);console.log('FINAL '+name)};
(async()=>{
 await wait(80);
 const h={id:'same',t:'2026-01-01',st:'ma',p:{fast:20,slow:120,thr:0},spent:1,why:'import regression',n:12,data:'BTC-USD',cfg:{cost:.01},sr:'1',pbo:'0.1'};
 const trades=[{id:'same',d:'2026-01-01',sym:'BTC',rule:'h',slip:0,pnl:10,ret:.01},{id:'same',d:'2026-01-01',sym:'BTC',rule:'h',slip:0,pnl:10,ret:.02}];
 const backup=JSON.stringify({format:'edge-lab',hyp:[h,{...h,data:'ETH-USD'},{...h,cfg:{cost:.02}}],trades});
 await w.importState(backup);
 check('different datasets and costs survive import',w.eval('HYP.length')===3);
 check('different trade returns survive import',w.eval('TRADES.length')===2);
 await w.importState(backup);check('full-content import remains idempotent',w.eval('HYP.length')===3&&w.eval('TRADES.length')===2);
 await wait(700);const exported=JSON.parse(w.document.getElementById('manualSave').value);
 check('backup contains all recovered records',exported.hyp.length===3&&exported.trades.length===2);
 check('signature ignores metadata and key order',w.eval("hsig({a:1,b:{c:2},_ts:1})===hsig({b:{c:2},a:1,_ts:9})"));
 const csv='date,open,high,low,close\n'+Array.from({length:60},(_,i)=>`${new Date(Date.UTC(2024,0,1+i)).toISOString()},100,110,90,100`).join('\n');
 check('valid OHLC accepted',w.parseCsv(csv).length===60);
 for(const [name,value] of [['missing OHLC',csv.replace('open,','').replaceAll(',100,110',',110')],['invalid price',csv.replace(',110,',',oops,')],['duplicate date',csv.replace('2024-01-02','2024-01-01')],['uneven interval',csv.replace('2024-01-02T00:00','2024-01-02T01:00')]]){
   assert.throws(()=>w.parseCsv(value),name);console.log('FINAL rejects '+name);
 }
 w.eval("globalThis.mockDoc={datasets:{single:'keep'}}; STORE_KIND='db'; STORAGE_OK=true; DB={doc:()=>({get:async()=>({exists:true,data:()=>mockDoc}),set:async v=>{mockDoc=v}})}");
 await w.eval("S.set('budget',{years:5,sr:1,rho:.2,N:5})");
 check('saving a budget preserves saved datasets',w.eval("mockDoc.datasets.single==='keep'&&mockDoc.budget.years===5"));
 w.location.hash='jrn';await wait(20);check('deep links select the requested tab',w.document.getElementById('p-jrn').classList.contains('on'));
 const panel=w.document.getElementById('actionPanel');
 w.renderActionPanel({st:'ma',p:{fast:2,slow:3,thr:0},datasets:[{name:'Synthetic',bars:w.parseCsv(csv)}]},{mode:'signal',stp:.1,tgt:.1,hold:365,cost:.01},true,false);
 check('passing result cannot be read as a live order',panel.textContent.includes('Historical model state')&&panel.textContent.includes('cannot obtain it retroactively')&&!panel.textContent.includes('2% of a'));
 check('no script errors',errors.length===0);w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
