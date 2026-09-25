// nextAction() must mirror the ENGINE, not merely signal(). Truth comes from
// runEngine()'s own ex[]/hb[] trade records, so a bug in the panel can't hide
// behind a matching bug in the test.
const L=require('./core.js');const B=L.bundledBars();
function engineOpenAtEnd(bars,st,p,cfg){const sig=L.signal(bars,st,p),e=L.runEngine(bars,sig,cfg),open=new Array(bars.length).fill(false);
  for(let t=0;t<e.ex.length;t++){const exit=e.ex[t],entry=exit-e.hb[t];for(let k=entry;k<exit;k++)open[k]=true;}
  // any still-open trade at the end: replay tail after last exit
  let pos=null;for(let k=1;k<bars.length;k++){if(!pos){if(sig[k]===1&&sig[k-1]===0)pos={e:bars[k].c,i:k}}else{const tg=pos.e*(1+cfg.tgt),sp=pos.e*(1-cfg.stp);let x=null;if(bars[k].l<=sp)x=1;else if(cfg.mode!=='signal'&&bars[k].h>=tg)x=1;else if(cfg.mode==='signal'&&sig[k]===0)x=1;else if(k-pos.i>=cfg.hold)x=1;if(x)pos=null}open[k]=open[k]||pos!==null}
  return open;}
const cases=[['ma',{fast:10,slow:50,thr:0.5},{mode:'fixed',tgt:0.05,stp:0.03,hold:30,cost:0.01}],
  ['ma',{fast:5,slow:30,thr:0},{mode:'signal',tgt:0.1,stp:0.1,hold:365,cost:0.01}],
  ['rsi',{per:14,os:30},{mode:'signal',tgt:0.1,stp:0.1,hold:365,cost:0.01}],
  ['brk',{look:20},{mode:'fixed',tgt:0.1,stp:0.05,hold:30,cost:0.01}]];
let stateBad=0;
for(const [st,p,cfg] of cases){const truth=engineOpenAtEnd(B,st,p,cfg);
  for(let cut=60;cut<B.length;cut+=1){const A=L.nextAction(B.slice(0,cut+1),st,p,cfg);if(A.inPosition!==truth[cut]){stateBad++;}}}
console.log('N state-vs-engine mismatches '+stateBad);
// MA closed-form trigger close must produce a clean crossing on the next bar.
{const A=L.nextAction(B,'ma',{fast:10,slow:50,thr:0.5},{mode:'signal',tgt:.1,stp:.1,hold:365,cost:.01});
 const i=B.length-1,x=A.triggerClose;
 const up=L.signal(B.concat([{t:B[i].t+86400,d:'N',o:x*1.0005,h:x*1.0005,l:x*1.0005,c:x*1.0005}]),'ma',{fast:10,slow:50,thr:0.5}).pop();
 const dn=L.signal(B.concat([{t:B[i].t+86400,d:'N',o:x*0.9995,h:x*0.9995,l:x*0.9995,c:x*0.9995}]),'ma',{fast:10,slow:50,thr:0.5}).pop();
 console.log('N ma trigger-close clean-cross '+(up===1&&dn===0));
 console.log('N ma trigger-close differs from MA level '+(Math.abs(x-A.crossPrice)>A.crossPrice*0.1));}
// Armed flag: a flat, already-satisfied rule must be reported as NOT armed and NOT entering.
{let found=false;const p={fast:10,slow:50,thr:0.5},cfg={mode:'fixed',tgt:0.05,stp:0.03,hold:30,cost:0.01},sig=L.signal(B,'ma',p);
 for(let cut=80;cut<B.length&&!found;cut++){const A=L.nextAction(B.slice(0,cut+1),'ma',p,cfg);
   if(!A.inPosition&&sig[cut]===1){found=true;console.log('N armed-false-when-already-satisfied '+(A.armed===false&&/no fresh (entry|cross)|waits for/.test(A.trigger)));}}
 if(!found)console.log('N armed-false-when-already-satisfied SKIP-no-case');}
// Bracket wording: stop is described as checked first with gap risk; fixed shows target.
{const S=L.nextAction(B,'ma',{fast:10,slow:50,thr:0.5},{mode:'signal',stp:0.1,tgt:0.1,hold:365,cost:0.01});
 const F=L.nextAction(B,'ma',{fast:10,slow:50,thr:0.5},{mode:'fixed',stp:0.05,tgt:0.1,hold:30,cost:0.01});
 console.log('N bracket-stop-first '+(/checked first/.test(S.bracketNote)&&/gaps through/.test(S.bracketNote)));
 console.log('N bracket-signal-mode-no-target '+(S.target===null&&!/target \$/.test(S.bracketNote)));
 console.log('N bracket-fixed-has-target '+(F.target!==null&&/target \$/.test(F.bracketNote)));}
// Expiry date present when in a position under a finite hold.
{let shown=false;const p={look:20},cfg={mode:'fixed',tgt:0.1,stp:0.05,hold:30,cost:0.01};
 for(let cut=80;cut<B.length&&!shown;cut++){const A=L.nextAction(B.slice(0,cut+1),'brk',p,cfg);if(A.inPosition&&A.expiry){shown=true;console.log('N expiry-date-when-in-position '+(/\d{4}-\d\d-\d\d/.test(A.expiry)&&/time-exit on /.test(A.bracketNote)));}}
 if(!shown)console.log('N expiry-date-when-in-position SKIP');}
