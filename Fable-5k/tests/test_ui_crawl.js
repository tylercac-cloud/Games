process.on('uncaughtException',e=>console.log('UNCAUGHT:',e.message));
const {JSDOM}=require('jsdom');const fs=require('fs');const errs=[];
const dom=new JSDOM(fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.org/',beforeParse(w){
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=m=>errs.push('alert:'+m);w.confirm=()=>true;w.Element.prototype.scrollIntoView=()=>{};
 w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
 w.addEventListener('error',e=>errs.push('ERR '+e.message));w.addEventListener('unhandledrejection',e=>errs.push('REJ '+(e.reason&&e.reason.message)))}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),sleep=t=>new Promise(r=>setTimeout(r,t));
const txt=id=>$(id).textContent.replace(/\s+/g,' ').trim().slice(0,170);
(async()=>{await sleep(400);
 console.log('storage banner:',txt('storeWarn').slice(0,60)||'(none)');
 $('bY').value='9.3';$('bSR').value='1';$('bRho').value='0.7';$('setBud').click();await sleep(50);console.log('budget:',txt('budOut'));
 for(const [W,N,Rr] of [[33,60,2],[0,10,2],[10,10,1],[5,0,2]]){$('kW').value=W;$('kN').value=N;$('kR').value=Rr;$('runKelly').click();await sleep(20);console.log(`kelly w=${W} n=${N}:`,txt('kOut').slice(0,110))}
 // journal
 for(let i=0;i<35;i++){$('jSym').value='BTC';$('jSize').value='500';$('jExp').value='100';$('jAct').value=String(100+(i%3)*0.1);$('jExit').value=String(i%3?103:98.5);$('jFee').value='4';$('addTrade').click();await sleep(5)}
 await sleep(50);console.log('journal:',txt('jVerdict'));
 // CSV fuzz
 const csvs={
  newestFirst:'date,open,high,low,close\n'+[...Array(100)].map((_,i)=>`2024-01-${String(1+(99-i)%28).padStart(2,'0')},1,2,0.5,${1+i/100}`).join('\n'),
  msUnix:'unix,open,high,low,close\n'+[...Array(100)].map((_,i)=>`${1700000000000+i*86400000},1,2,.5,1.${i}`).join('\n'),
  quotedJunk:'https://www.CryptoDataDownload.com\n"date","symbol","open","high","low","close"\n'+[...Array(100)].map((_,i)=>`"2023-01-01 00:00:00","BTC",1,2,0.5,1`).join('\n'),
  closeOnly:'time,close\n'+[...Array(100)].map((_,i)=>`${1600000000+i*86400},${100+i}`).join('\n'),
  commaThousands:'date,open,high,low,close\n'+[...Array(100)].map((_,i)=>`${new Date(Date.UTC(2020,0,1+i)).toISOString()},"1,000","1,100","900","1,050"`).join('\n'),
  highBelowClose:'date,open,high,low,close\n'+[...Array(100)].map((_,i)=>`2020-01-${String(1+i%28).padStart(2,'0')},10,9,8,10`).join('\n'),
 };
 for(const[k,v]of Object.entries(csvs)){$('csv').value=v;$('loadCsv').click();await sleep(20);console.log('csv '+k+':',txt('fetchOut').slice(0,150))}
 $('genData').click();$('note').value='x';$('strat').value='brk';$('strat').dispatchEvent(new w.Event('change'));$('runSweep').click();await sleep(4000);
 console.log('synthetic sweep verdict:',txt('verdict').slice(0,90));console.log('header configs:',txt('cN'));
 $('expState').click();await sleep(300);console.log('export:',txt('ioOut').slice(0,80));
 $('dlCsv').click();await sleep(100);
 $('clrJrn').click();await sleep(50);$('clrHyp').click();await sleep(50);console.log('after clear, configs:',txt('cN'));
 console.log('errors:',errs.length?errs:'none');process.exit(0)})();
