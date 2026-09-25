const {JSDOM}=require('jsdom');const fs=require('fs');const path=__dirname+'/../edge-lab/strategy-lab.html';
const bad={doc:p=>({get:async()=>({exists:false,data:()=>undefined}),set:async()=>{throw {code:'unavailable'}},delete:async()=>{}}),collection:c=>({doc:id=>bad.doc(c+'/'+id),limit:()=>({get:async()=>({docs:[]})})})};
const w=new JSDOM(fs.readFileSync(path,'utf8'),{runScripts:'dangerously',url:'https://example.org/',beforeParse(w){w.claude={use:async n=>n==='db'?bad:null};}}).window;
setTimeout(()=>{console.log('db write fails -> banner:',JSON.stringify(w.document.getElementById('storeWarn').textContent.slice(0,60)));process.exit(0)},800);
