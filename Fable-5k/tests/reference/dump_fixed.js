const L=require('../core.js');const fs=require('fs');
const B=L.bundledBars();const cfg={tgt:.1,stp:.05,hold:30,cost:.008};const out={bars:B.map(b=>[b.o,b.h,b.l,b.c]),fam:{}};
for(const st of ['ma','rsi','brk']){const fam=L.sweepSet(st);
 const R=fam.map(q=>L.barReturns(B,st,q,cfg));const Rf=R.filter(a=>a.some(v=>v!==0));
 out.fam[st]={params:fam,sig:fam.map(q=>L.signal(B,st,q)),trades:fam.map(q=>L.trades(B,st,q,cfg)),bar:R,
  pbo:L.cscvPBO(Rf,12),dec:L.decayTest(Rf,8),sma:L.sma(B.map(b=>b.c),20),rsi:L.rsi(B.map(b=>b.c),14)}}
fs.writeFileSync(__dirname+'/jsdump.json',JSON.stringify(out));console.log('dumped');
