// Thin adapter over the SHIPPED verdict functions (familyStats + judge in
// edge-lab-v5.html, extracted to core.js). No verdict logic lives here.
const L=require('../core.js');
module.exports=function(B,st,cfg,fam){fam=fam||L.sweepSet(st);
  const fs=L.familyStats(B,st,fam,cfg,true);
  const J=L.judge(fs,L.effN(fam.length,fs.rho),true,false);
  const v=J.verdict==='pass'?'pass':J.verdict==='fail'?'fail':'gate';
  return {v,dsr:J.dsr,pbo:fs.res&&fs.res.pbo,sr:J.sr,sr0:J.sr0,used:J.used,rho:fs.rho,bi:fs.bi,T:J.T,sk:J.MX.sk,ku:J.MX.ku,varSR:fs.varSR}}
