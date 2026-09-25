process.on('uncaughtException',e=>console.log('UNCAUGHT:',e.message));
const {JSDOM}=require('jsdom'),fs=require('fs');
const html=fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8'),alerts=[];
function candles(url){const u=new URL(url),a=Date.parse(u.searchParams.get('start'))/1000,b=Date.parse(u.searchParams.get('end'))/1000,out=[];
  for(let t=Math.ceil(a/86400)*86400;t<=b;t+=86400){const c=100+(t%97);out.push([t,c-2,c+2,c-1,c,10])}return out.slice(-300)}
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=m=>alerts.push(m);w.Element.prototype.scrollIntoView=()=>{};
  w.fetch=async url=>({ok:true,status:200,json:async()=>candles(url)});
}}).window,d=w.document,$=i=>d.getElementById(i),sleep=t=>new Promise(r=>setTimeout(r,t));
(async()=>{await sleep(350);$('loadBundled').click();$('note').value='locked mechanism';$('lockHyp').click();await sleep(100);
 console.log('R1 lock saved:',$('lockList').textContent.includes('Locked hypotheses: 1'));
 $('run').click();await sleep(1700);console.log('R2 run linked to lock:',$('hypList').textContent.includes('locked H-'));
 $('repairData').value='BTC-USD daily (bundled)';$('repairFamily').value='unknown';$('repairSpent').value='7';$('repairWhy').value='Recovered from dated notes';$('repairAdd').click();await sleep(150);
 console.log('R3 history repair counts:',$('cN').textContent,'|', $('hypList').textContent.includes('history repair'));
 $('refreshMarkets').click();await sleep(8000);console.log('R4 one-click pool:',$('marketOut').textContent.replace(/\s+/g,' ').trim().slice(0,180));
 console.log('alerts:',alerts.length?alerts:'none');process.exit(0)})();
