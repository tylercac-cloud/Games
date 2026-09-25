// Two dated assets: bundled BTC + a synthetic coin that lists on 2019-01-01 (unbalanced panel).
const L=require('../core.js');const fs=require('fs');
const A=L.bundledBars();let s=4242;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const start=A.findIndex(b=>b.d==='2019-01-01');const B=[];let px=10;
for(let i=start;i<A.length;i++){const o=px;px*=Math.exp(0.0006+0.045*g());B.push({t:A[i].t,d:A[i].d,o,h:Math.max(o,px)*(1+Math.abs(g())*.01),l:Math.min(o,px)*(1-Math.abs(g())*.01),c:px})}
const cfg={mode:'signal',tgt:.1,stp:.1,hold:365,cost:.01};const fam=L.sweepSet('ma');
const fs_=L.familyStatsPooled([A,B],'ma',fam,cfg,true,{diag:false});
const J=L.judge(fs_,L.effN(fam.length,fs_.rho),true,false);
fs.writeFileSync(__dirname+'/pooldump.json',JSON.stringify({A:A.map(b=>[b.t,b.o,b.h,b.l,b.c]),B:B.map(b=>[b.t,b.o,b.h,b.l,b.c]),params:fam,
  sigA:fam.map(q=>L.signal(A,'ma',q)),sigB:fam.map(q=>L.signal(B,'ma',q)),
  js:{bi:fs_.bi,rho:fs_.rho,varSR:fs_.varSR,n:fs_.W.n,T:J.T,sr:J.sr,sr0:J.sr0,dsr:J.dsr,used:J.used,x0:fs_.W.x.slice(0,3),xl:fs_.W.x.slice(-3)}}));
// structural checks
const one=L.poolStreams([A],'ma',fam[0],cfg),solo=L.barX(A,'ma',fam[0],cfg);
let d1=0;one.x.forEach((v,i)=>d1=Math.max(d1,Math.abs(v-solo.x[i])));
const two=L.poolStreams([A,A],'ma',fam[0],cfg);let d2=0;two.x.forEach((v,i)=>d2=Math.max(d2,Math.abs(v-solo.x[i])));
console.log('P1 pool of one asset == that asset, max diff',d1,'| length',one.x.length,solo.x.length);
console.log('P2 pool of two identical copies == the asset, max diff',d2,'| trades doubled',two.n===2*solo.n);
console.log('P3 pooled length = union of dates:',fs_.W.x.length,'(BTC bars-1 =',A.length-1,')');
let err='none';try{L.familyStatsPooled([A],'ma',fam,cfg,true)}catch(e){err=e.message}console.log('P4 single-member pool refused:',err);
const H=A.map(b=>({...b,t:b.t+0}));const hourly=A.slice(0,500).map((b,i)=>({...b,t:1420070400+i*3600}));
console.log('P5 mixed candle sizes refused:',L.poolCheck([A,hourly]));
console.log('pooled MA sweep: DSR',J.dsr.toFixed(4),'winner',fs_.bi,'trades',fs_.W.n);
