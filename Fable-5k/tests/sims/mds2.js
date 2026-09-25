const L=require('../core.js');
const Z=1.6448536+0.8416212,emax0=N=>N<1.5?0:L.expMaxSR(1,Math.max(N,2));
// the edge trial inflates the family dispersion it is judged against: V ~ v0 + s^2/N
function mds(y,N){const v0=1/y,e=emax0(N);if(N<1.5)return Math.sqrt(v0)*Z;let s=1;
 for(let i=0;i<200;i++){const Nn=Math.max(N,2);s=Math.sqrt(v0+s*s*(Nn-1)/(Nn*Nn))*e+Z*Math.sqrt(v0)}return s}
let st=999;const rnd=()=>(st=(st*1664525+1013904223)%4294967296)/4294967296;
const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const T=3400,bpy=365.25,y=T/bpy;
for(const N of [1,5,13,45]){const target=mds(y,N);let pass=0,runs=300;
 for(let r=0;r<runs;r++){const srs=[],streams=[];for(let k=0;k<N;k++){const mu=k===0?target/Math.sqrt(bpy)*0.02:0;const a=[];for(let t=0;t<T;t++)a.push(mu+g()*0.02);streams.push(a);srs.push(L.sharpe(a))}
  const bi=srs.indexOf(Math.max(...srs));const M=L.moments(streams[bi]);const sr0=N===1?0:L.moments(srs).s*L.expMaxSR(1,N);
  if(L.psr(M.m/M.s,sr0,T,M.sk,M.ku)>=0.95)pass++}
 console.log(`N=${N}: MDS80 = annual SR ${target.toFixed(2)} -> simulated power ${(pass/runs*100).toFixed(1)}%`)}
