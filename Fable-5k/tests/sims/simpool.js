// Multi-asset simulation gate for pooled testing.
// usage: node simpool.js <null|common|indep> <amp> <runs> <corr> [seedOffset] [ma|rsi|brk]
const L=require('../core.js');
const [kind,amp,runs,corr,off,st]=[process.argv[2],+process.argv[3],+process.argv[4],+process.argv[5],+(process.argv[6]||0),process.argv[7]||'ma'];
const cfg={mode:'signal',tgt:.1,stp:.10,hold:365,cost:.008},fam=L.sweepSet(st);
const T=3400,K=3,starts=process.env.FULL?[0,0,0]:[0,Math.floor(T/3),Math.floor(2*T/3)],mu=Math.log(64000/314)/3400,base=1420070400;
function world(seed){let s=seed;const rnd=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
  const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  const reg=[1,1,1];let common=1;const px=[100,100,100],out=[[],[],[]];
  for(let i=0;i<T;i++){if(rnd()<0.01)common=-common;for(let k=0;k<K;k++)if(rnd()<0.01)reg[k]=-reg[k];
    const f=g();for(let k=0;k<K;k++){const z=Math.sqrt(corr)*f+Math.sqrt(1-corr)*g();
      const r=kind==='null'?0:(kind==='common'?common:reg[k])*amp;const o=px[k];px[k]*=Math.exp(mu+r+0.036*z);
      if(i>=starts[k])out[k].push({t:base+i*86400,d:'d'+i,o,h:Math.max(o,px[k])*(1+Math.abs(g())*.006),l:Math.min(o,px[k])*(1-Math.abs(g())*.006),c:px[k]})}}
  return out}
function verdict(fs){const J=L.judge(fs,L.effN(fam.length,fs.rho),true,false);return J.verdict==='pass'?'pass':J.verdict==='fail'?'fail':'gate'}
const c={single:{pass:0,fail:0,gate:0},pooled:{pass:0,fail:0,gate:0}};
for(let r=1;r<=runs;r++){const W=world((r+off)*15485863);
  c.single[verdict(L.familyStats(W[0],st,fam,cfg,true,{diag:false}))]++;
  c.pooled[verdict(L.familyStatsPooled(W,st,fam,cfg,true,{diag:false}))]++;}
console.log(`${st} ${kind} amp=${amp} corr=${corr}: single(asset 1, 9.3y) ${JSON.stringify(c.single)} | pooled(3 assets, staggered) ${JSON.stringify(c.pooled)}`);
