// Builds core.js (the lab's pure statistics/engine functions) from the single-file app,
// so tests exercise the exact shipped code rather than a copy.
const fs=require('fs');const s=fs.readFileSync(__dirname+'/../edge-lab/strategy-lab.html','utf8');
const a=s.indexOf('/* ============ normal distribution'),b=s.indexOf('/* ============ header ============ */');
if(a<0||b<0)throw new Error('section markers not found — did the file structure change?');
fs.writeFileSync(__dirname+'/core.js',"let HYP=[],TRADES=[],BUDGET=null,BARS=null;\n"+s.slice(a,b)+
"\nmodule.exports={normCdf,normInv,expMaxSR,psr,effN,budgetN,moments,sharpe,sma,rsi,signal,barReturns,trades,tradesX,barX,barsPerYear,mds80,runEngine,drift,combos,cscvPBO,decayTest,synth,bundledBars,validateBars,parseCsv,sweepSet,SWEEP,PARAMS,avgCorr,splitCsv,familyStats,judge,MIN_TRADES,statsFromE,COINS,coinName,isKnownCoin,familyStatsPooled,poolStreams,poolCheck,esc,nextAction,fmt,cleanHyp,cleanTrade,effForSet,assetKey,__setState:(h,c)=>{HYP=h;ACTIVE_COMPS=c}};\n");
console.log('core.js extracted');
