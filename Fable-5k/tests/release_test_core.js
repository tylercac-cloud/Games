const L=require('./core.js');
const out=(k,v)=>console.log(k.padEnd(52),v);
// T1 DSR paper example
const sr=2.5/Math.sqrt(250),V=0.5/250;
out('T1 DSR paper example (expect 0.9004)',L.psr(sr,L.expMaxSR(V,100),1250,-3,10).toFixed(4));
out('T2 budgetN(5y,SR1) expect 45',L.budgetN(5,1));
out('T2 budgetN(3y,SR1) expect 13',L.budgetN(3,1));
out('T3 sharpe of zero-variance series',L.sharpe([0.01,0.01,0.01]));
out('T3 sample-SD sharpe n=12 check',(()=>{const a=[...Array(12)].map((_,i)=>i%3?0.02:-0.01);const m=a.reduce((x,y)=>x+y)/12;const sd=Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/11);return (L.sharpe(a)-m/sd).toExponential(2)})());
out('T4 expMaxSR at N=1 (silently floored to 2)',L.expMaxSR(1,1).toFixed(4)+' vs N=2 '+L.expMaxSR(1,2).toFixed(4));
// data
const B=L.bundledBars();
out('T5 bundled bars',B.length+'  '+B[0].d+' -> '+B[B.length-1].d);
out('T5 validateBars issues',JSON.stringify(L.validateBars(B,86400)));
const ref={'2017-12-17':19100,'2018-12-15':3200,'2020-03-12':4900,'2021-11-08':67500,'2022-11-09':16000,'2022-12-31':16550,'2024-03-13':73000};
for(const[d,v]of Object.entries(ref)){const x=B.find(b=>b.d===d);out('   close '+d+' (approx '+v+')',x?x.c+'  dev '+((x.c/v-1)*100).toFixed(1)+'%':'MISSING')}
// gap-open check (stop-fill optimism)
let big=0,max=0;for(let i=1;i<B.length;i++){const g=Math.abs(B[i].o/B[i-1].c-1);if(g>0.01)big++;max=Math.max(max,g)}
out('T6 opens >1% away from prior close',big+' bars, max '+(max*100).toFixed(2)+'%');
// T7 lookahead truncation
let viol=0,checks=0;
const rng=(()=>{let s=42;return()=>(s=(s*1664525+1013904223)%4294967296)/4294967296})();
for(const st of ['ma','rsi','brk'])for(const p of L.sweepSet(st).slice(0,8)){
  const full=L.signal(B,st,p);
  for(let k=0;k<60;k++){const cut=200+Math.floor(rng()*(B.length-200));const part=L.signal(B.slice(0,cut),st,p);checks++;
    for(let i=0;i<cut;i++)if(part[i]!==full[i]){viol++;break}}}
out('T7 lookahead truncation tests',checks+' checks, '+viol+' violations');
// ---- judge() unit tests: verdict rules pinned independently of any dataset ----
{const mk=(n,mean,sd,T)=>{let s=7;const r=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
  const x=[];for(let i=0;i<T;i++){let u=0,v=0;while(!u)u=r();while(!v)v=r();x.push(mean+sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v))}return {W:{x,n},varSR:1e-4,bpy:365.25}};
 const strong=mk(12,0.004,0.02,3400);
 out('J1 12 trades is judged (min 10)',L.judge(strong,1,false,false).verdict);
 out('J2 9 trades is few-trades',L.judge(mk(9,0.004,0.02,3400),1,false,false).verdict);
 const pre=L.judge(strong,1,false,false);out('J3 lone first trial: prereg, SR0',pre.prereg+' '+pre.sr0);
 out('J4 sweep floors effective trials at 2',L.judge(strong,1,true,false).used);
 out('J5 over budget cannot pass',L.judge(strong,1,false,true).verdict);
 out('J6 MDS 1 pre-registered test, 9.31y',L.mds80(9.31,1).toFixed(3));
 out('J7 MIN_TRADES',L.MIN_TRADES);}
