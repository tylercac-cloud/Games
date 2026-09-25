const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
for(const f of process.argv.slice(2)){const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message.slice(0,120)));vc.on('error',e=>errs.push(String(e).slice(0,120)));
 const w=new JSDOM(fs.readFileSync(f,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://example.org/',beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};}}).window;
 const d=w.document;const ids=new Set([...d.querySelectorAll('[id]')].map(e=>e.id));const bad=[...d.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href').slice(1)).filter(h=>h&&!ids.has(h));
 // click every button to shake out handler errors
 [...d.querySelectorAll('button')].forEach(b=>{try{b.click()}catch(e){errs.push('click '+(b.id||b.textContent.slice(0,20))+': '+e.message)}});
 setTimeout(()=>{},0);console.log(f.split('/').pop().padEnd(34),'script errors:',errs.length?JSON.stringify(errs.slice(0,3)):'none','| broken #anchors:',bad.length?bad.join(','):'none','| buttons:',d.querySelectorAll('button').length)}
setTimeout(()=>process.exit(0),+process.env.WAIT||1500);
