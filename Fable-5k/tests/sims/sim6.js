const L=require('../core.js'),P=require('./v5pipe.js');const cfg={mode:'signal',tgt:.1,stp:.10,hold:365,cost:.008};
function regime(n,base,amp,seed){let s=seed;const rnd=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
 const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
 const b=[];let px=100,st=1;for(let i=0;i<n;i++){if(rnd()<0.01)st=-st;const o=px;px*=Math.exp(base+st*amp+g()*0.036);
 b.push({o,h:Math.max(o,px)*(1+Math.abs(g())*.006),l:Math.min(o,px)*(1-Math.abs(g())*.006),c:px})}return b}
function garch(n,base,seed){let s=seed;const rnd=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
 const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
 const w=0.00002,a=0.12,b=0.86;let h=w/(1-a-b),e=0;const out=[];let px=100;
 for(let i=0;i<n;i++){h=w+a*e*e+b*h;e=Math.sqrt(h)*g()*(rnd()<0.03?2.5:1);const o=px;px*=Math.exp(base+e);
 out.push({o,h:Math.max(o,px)*(1+Math.abs(g())*.006),l:Math.min(o,px)*(1-Math.abs(g())*.006),c:px})}return out}
function mr(n,base,phi,seed){let s=seed;const rnd=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
 const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
 const b=[];let px=100,r=0;for(let i=0;i<n;i++){r=-phi*r+g()*0.036;const o=px;px*=Math.exp(base+r);
 b.push({o,h:Math.max(o,px)*(1+Math.abs(g())*.006),l:Math.min(o,px)*(1-Math.abs(g())*.006),c:px})}return b}
const mu=Math.log(64000/314)/3400;const [kind,amp,runs,off]=[process.argv[2],+process.argv[3],+process.argv[4],+process.argv[5]||0];const strat=process.argv[6]||'ma';
const c={pass:0,fail:0,gate:0};let ann=0,k0=0;
for(let k=1;k<=runs;k++){const seed=(k+off)*15485863;const B=kind==='garch'?garch(3400,mu,seed):kind==='mr'?mr(3400,mu,amp,seed):regime(3400,kind==='nodrift'?0:mu,amp,seed);
 const r=P(B,strat,cfg);c[r.v]++;if(r.sr!=null){ann+=r.sr*Math.sqrt(365.25);k0++}}
console.log(`${strat} ${kind} amp=${amp} (winner mean ann. SR ${(ann/k0).toFixed(2)}): ${JSON.stringify(c)}`)
