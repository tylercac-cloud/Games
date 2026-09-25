const fs=require('fs'),path=require('path');const html=fs.readFileSync(path.join(__dirname,'../../edge-lab/edge-lab-v7.html'),'utf8');
const first=html.indexOf('/* ============ v7 market and evidence core ============ */'),end=html.indexOf('/* ============ end v7 market and evidence core ============ */');
const sa=html.indexOf('function sha256Text(text){'),se=html.indexOf('const PROTOCOL=deepFreeze',sa);
if([first,end,sa,se].some(x=>x<0))throw Error('v7 section markers not found');
fs.writeFileSync(path.join(__dirname,'research_core.js'),html.slice(first,end)+'\n'+html.slice(sa,se)+'\nmodule.exports={canonicalJSON,sha256Text,marketRows,normalizeCandles,lockedSignals,observationWindow,experimentRisk,overlapsExposure,fetchPublicJSON,collectMarketScan};\n');
console.log('Exact shipped v7 research code extracted');
