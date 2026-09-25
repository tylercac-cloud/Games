// Crypta's offline answers: typical questions must land on the right guide section; secrets are recognised.
const {JSDOM}=require('../node_modules/jsdom');const assert=require('assert');const fs=require('fs'),path=require('path');
const w=new JSDOM(fs.readFileSync(path.join(__dirname,'../../edge-lab/edge-lab-v7.html'),'utf8'),{url:'https://example.org/',runScripts:'dangerously',beforeParse(w){w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}})}}).window;
setTimeout(()=>{
  const C=w.crypta,cases={'how do I connect coinbase?':'Connecting Coinbase','what is cooling off':'Cooling-off','how do I log a trade':'Journal: log trades in one tap','what is open risk':'Open risk',
    'how do deposits work':'Deposits and withdrawals','tax csv':'Tax CSV','my launcher says live data fail':'Troubleshooting: Live data FAIL, Account FAIL, empty register','what is the trade ticket':'Trade ticket',
    'how do I install crypta':'Crypta on your taskbar','what are the loss limits':'Risk budget and limits','how do I set up crypta ai':"Connecting Crypta's AI",'stop-limit gap':'Trade ticket','backup':'Equity history and backup',
    'register looks empty':'Troubleshooting: Live data FAIL, Account FAIL, empty register','daily routine':'Daily routine','what is H2':'Daily scan and the locked study'};
  let n=0;for(const [q,t] of Object.entries(cases)){assert.strictEqual(C.search(q,1)[0]&&C.search(q,1)[0].title,t,q);n++}
  const secrets=['sk-ant-api03-abcdefghijklmnopqrstuvwxyz','-----BEGIN EC PRIVATE KEY-----\nMHcC','{"name":"organizations/1234abcd-12ab/apiKeys/xyz","privateKey":"x"}',Buffer.from(Array.from({length:64},(_,i)=>(i*37+11)%256)).toString('base64')  /* synthetic 64-byte Ed25519-style secret */];
  const fine=['my equity is $5,123.45 and my stop is 55,200','why is my size zero?','BTC-USD 0.00403588','https://docs.cdp.coinbase.com/advanced-trade'];
  secrets.forEach(s=>assert(C.looksSecret(s),'should block: '+s.slice(0,30)));fine.forEach(s=>assert(!C.looksSecret(s),'should allow: '+s));
  assert.strictEqual(C.md('<img src=x onerror=1> **b**'),'<p>&lt;img src=x onerror=1&gt; <strong>b</strong></p>');
  console.log(`CRYPTA GUIDE TESTS PASSED (${n} questions, ${secrets.length} secrets blocked, ${fine.length} ordinary messages allowed, markdown escaping)`);process.exit(0);
},300);
