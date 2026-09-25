const {JSDOM}=require('jsdom'),assert=require('node:assert/strict'),fs=require('fs');
const html=fs.readFileSync(__dirname+'/../../edge-lab/edge-lab-v7.html','utf8'),DAY=86400,fixed=Date.parse('2026-09-23T00:06:00Z');
const errors=[],calls=[],alerts=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
function create(saved){return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org',beforeParse(w){
 w.Date=class extends Date{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}};
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=x=>alerts.push(x);w.Element.prototype.scrollIntoView=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
 w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 if(saved)w.localStorage.setItem('fable-desk:research-v7',saved);
 w.fetch=async(url,opts)=>{calls.push(url);assert.ok(url.startsWith('https://api.coinbase.com/api/v3/brokerage/market/'));assert.equal(opts.credentials,'omit');assert.equal(opts.method,'GET');const u=new URL(url);
  if(u.pathname.endsWith('/market/products'))return {ok:true,json:async()=>({products:[{product_id:'BTC-USD',product_type:'SPOT',quote_currency_id:'USD',price:'120',volume_24h:'1000',price_percentage_change_24h:'1.2%',status:'online'}]})};
  const start=+u.searchParams.get('start'),end=+u.searchParams.get('end')+1;
  return {ok:true,json:async()=>({candles:Array.from({length:(end-start)/DAY},(_,i)=>({start:String(start+i*DAY),open:'100',high:'102',low:'99',close:'101',volume:'1000'}))})};
 };}}).window}
(async()=>{
 const w=create(),d=w.document,$=id=>d.getElementById(id);await wait(50);
 assert.equal(calls.length,0,'No network on page load');assert.match($('researchHistory').textContent,/earlier total still unknown/i);assert.match($('protocolSummary').textContent,/20-day/);assert.equal($('p-scan').classList.contains('on'),true);
 $('genData').click();const original=w.eval('BARS');$('scanMarkets').click();await wait(250);
 assert.match($('scanStatus').textContent,/Scan complete/);assert.match($('scanSignals').textContent,/H1/);assert.equal(w.eval('BARS'),original,'Scan must not load the backtest dataset');assert.equal(calls.length,5);
 await wait(650);const backup=JSON.parse($('manualSave').value);assert.equal(backup.version,3);assert.equal(backup.research.events.filter(e=>e.kind==='scan-attempt').length,1);assert.equal(backup.research.events.filter(e=>e.kind==='scan-result').length,1);assert.ok(!JSON.stringify(backup.research).includes('sourceCandles'),'Full raw data must not fill localStorage silently');
 const stored=w.localStorage.getItem('fable-desk:research-v7'),reloaded=create(stored);await wait(50);assert.equal(reloaded.eval('RESEARCH.events.length'),2);reloaded.close();
 const before=w.eval('RESEARCH.events.length');$('scanExample').click();assert.match($('scanStatus').textContent,/SYNTHETIC/);assert.equal(w.eval('RESEARCH.events.length'),before);
 const real={id:'manual-real',t:'2026-09-21',st:'ma',p:{fast:20,slow:120,thr:0},spent:1,why:'Known old research',n:12,data:'BTC study'};
 $('manualSave').value=JSON.stringify({format:'edge-lab',hyp:[real],trades:[]});$('impText').click();await wait(30);assert.equal($('cN').textContent,'1');
 $('clrHyp').click();await wait(30);assert.equal($('cN').textContent,'1','Preserve history control must never clear real trials');
 const damaged=structuredClone(backup);damaged.research.events[0].payload.summary='modified';damaged.hyp=[{...real,id:'must-not-import'}];$('manualSave').value=JSON.stringify(damaged);$('impText').click();await wait(30);assert.match($('ioOut').textContent,/checksum/);assert.equal($('cN').textContent,'1','Invalid research state must abort entire import');
 for(const [id,v]of Object.entries({rEquity:4250,rPeak:5000,rCash:4250,rEntry:100,rStop:90,rEF:1,rXF:1,rES:10,rXS:10}))$(id).value=v;
 $('planRisk').click();assert.match($('riskOut').textContent,/NO_NEW_RISK/);assert.match($('riskOut').textContent,/Quantity ≤ 0.00000000/);
 w.fetch=async()=>({ok:false,status:403});$('scanMarkets').click();await wait(50);assert.match($('scanStatus').textContent,/SCAN FAILED/);assert.equal($('scanSignals').textContent,'');assert.equal($('scanMarketsTable').textContent,'');
 assert.deepEqual(errors,[]);w.close();console.log('PASS v7 UI: no auto network, one-click scan, isolated data, durable exposure, reload, legacy import, evidence preservation, checksum rejection, loss pause, stale-result clearing.');
})().catch(e=>{console.error(e);process.exitCode=1});
