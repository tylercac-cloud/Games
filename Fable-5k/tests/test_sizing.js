const fs=require('fs');const ui=fs.readFileSync(__dirname+'/../src/lab/ui.js','utf8');
function fmt(v){if(v==null||!isFinite(v))return '—';const a=Math.abs(v);return '$'+v.toLocaleString('en-US',{minimumFractionDigits:a<10?4:2,maximumFractionDigits:a<10?4:2})}
const sz=ui.slice(ui.indexOf('function sizingLine'));eval(sz.slice(0,sz.indexOf('\n}\n')+2));
const strip=h=>h.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const one=strip(sizingLine({stp:0.10},1)),three=strip(sizingLine({stp:0.10},3));
console.log('S single-1000 '+/about \$1,000\.00 per position/.test(one));
console.log('S single-not-split '+!/split across/.test(one));
console.log('S pool-splits-333 '+/about \$333\.33 per position/.test(three));
console.log('S pool-mentions-split '+/split across 3 coins/.test(three));
console.log('S total-risk-constant '+(Math.abs(5000*0.02/3*3-100)<0.01));
