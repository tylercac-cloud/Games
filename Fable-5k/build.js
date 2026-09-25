#!/usr/bin/env node
// build.js — assembles the shipped single-file app from source.
//   src/lab/shell.html           page markup + styles (holds the UI placeholder)
//   src/lab/ui.js                UI script: data loading, pool, runs, register, journal (holds the CORE placeholder)
//   src/lab/core.js              engine + statistics + verdict logic (holds the BTCPACK placeholder)
//   src/data/btc-usd-daily.pack  bundled BTC bars: "YYMMDD,open,high,low,close;..."
// Output: edge-lab/strategy-lab.html (one file, opens anywhere; no build needed to USE it).
// Edit the src files, run `node build.js`, then `tests/run_all.sh --quick`.
// `node build.js --check` exits 1 if the shipped file differs from a fresh build.
const fs=require('fs'),path=require('path');const R=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const pack=R('src/data/btc-usd-daily.pack').trim();
if(!/^[0-9.,;]+$/.test(pack))throw new Error('btc-usd-daily.pack contains unexpected characters');
const core=R('src/lab/core.js'),ui=R('src/lab/ui.js'),shell=R('src/lab/shell.html');
const once=(t,ph,f)=>{if(t.split(ph).length!==2)throw new Error(ph+' placeholder missing or duplicated in '+f)};
once(core,'/*@@BTCPACK@@*/','src/core.js');once(ui,'/*@@CORE@@*/','src/ui.js');once(shell,'/*@@UI@@*/','src/shell.html');
const out=shell.replace('/*@@UI@@*/',()=>ui.replace('/*@@CORE@@*/',()=>core.replace('/*@@BTCPACK@@*/',()=>JSON.stringify(pack))));
const dc=R('src/desk/core.js'),du=R('src/desk/ui.js'),ds=R('src/desk/shell.html');
once(dc,'/*@@BTCPACK@@*/','desk core');once(du,'/*@@CORE@@*/','desk UI');once(ds,'/*@@UI@@*/','desk shell');
const desk=ds.replace('/*@@UI@@*/',()=>du.replace('/*@@CORE@@*/',()=>dc.replace('/*@@BTCPACK@@*/',()=>JSON.stringify(pack))));
// Function replacers: a string replacement would expand `$'`, `$&` etc. inside the injected code.
const themed=s=>s.replace('</head>',()=>'<style>'+R('src/workspace.css')+'</style></head>').replace('</body>',()=>'<script>'+R('src/workspace.js')+'</script><script>'+R('src/autofill.js')+'</script></body>');
const outputs={'edge-lab/strategy-lab.html':themed(out),'edge-lab/edge-lab-v7.html':themed(desk),'START-HERE.html':R('src/start.html')};
if(process.argv.includes('--check')){const same=Object.entries(outputs).every(([name,body])=>fs.existsSync(path.join(__dirname,name))&&R(name)===body);
  console.log(same?'BUILD CHECK: shipped file matches a fresh build':'BUILD CHECK: shipped file DIFFERS from source — run node build.js');process.exit(same?0:1)}
for(const [name,body] of Object.entries(outputs)){fs.writeFileSync(path.join(__dirname,name),body);console.log('built',name,body.length,'chars')}
