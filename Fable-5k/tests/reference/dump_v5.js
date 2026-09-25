const L=require('../core.js'),P=require('../sims/v5pipe.js');const B=L.bundledBars();const cfg={mode:'signal',tgt:.1,stp:.1,hold:365,cost:.008};
const r=P(B,'ma',cfg);const fam=L.sweepSet('ma');
require('fs').writeFileSync(__dirname+'/v5dump.json',JSON.stringify({bars:B.map(b=>[b.o,b.h,b.l,b.c]),params:fam,sig:fam.map(q=>L.signal(B,'ma',q)),res:r}));console.log('js done')
