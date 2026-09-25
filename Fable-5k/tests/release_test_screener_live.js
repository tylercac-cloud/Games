const {JSDOM}=require('jsdom');const fs=require('fs');const file=__dirname+'/../screener/screener-v2.html';
async function run(name,resp){const w=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',beforeParse(w){
 w.fetch=async(u,o)=>{const b=JSON.parse(o.body);const r=resp[b.method];if(r instanceof Error)throw r;return{ok:true,status:200,json:async()=>({jsonrpc:'2.0',id:1,result:r})}}}}).window,d=w.document;
 d.getElementById('mintAddr').value=name.addr||'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';d.getElementById('liveCheck').click();await new Promise(r=>setTimeout(r,50));
 const o=d.getElementById('liveOut');console.log((name.n).padEnd(26),'|',o.firstChild&&o.firstChild.className,'|',o.textContent.replace(/\s+/g,' ').slice(0,120),'| fields:',d.getElementById('mintAuth').value,d.getElementById('freezeAuth').value,d.getElementById('holderConc').value)}
const mint=(ma,fa,sup)=>({context:{slot:1},value:{data:{program:'spl-token',parsed:{type:'mint',info:{decimals:6,supply:sup,mintAuthority:ma,freezeAuthority:fa,isInitialized:true}},space:82},owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',lamports:1,executable:false}});
const largest=amts=>({context:{slot:1},value:amts.map((a,i)=>({address:'A'+i,amount:String(a),decimals:6,uiAmount:a/1e6,uiAmountString:String(a/1e6)}))});
(async()=>{
 await run({n:'renounced, 20% top10'},{getAccountInfo:mint(null,null,'1000000000000'),getTokenLargestAccounts:largest([1e11,5e10,5e10])});
 await run({n:'mint ACTIVE, 60% top10'},{getAccountInfo:mint('Auth1111',null,'1000000000000'),getTokenLargestAccounts:largest([6e11])});
 await run({n:'freeze ACTIVE, 40%'},{getAccountInfo:mint(null,'Frz1111','1000000000000'),getTokenLargestAccounts:largest([4e11])});
 await run({n:'huge supply 1e18 (precision)'},{getAccountInfo:mint(null,null,'1000000000000000000'),getTokenLargestAccounts:largest(['350000000000000000'])});
 await run({n:'account missing'},{getAccountInfo:{context:{slot:1},value:null}});
 await run({n:'not a mint'},{getAccountInfo:{context:{slot:1},value:{data:{program:'spl-token',parsed:{type:'account',info:{}}}}}});
 await run({n:'holders call fails'},{getAccountInfo:mint(null,null,'1000'),getTokenLargestAccounts:new Error('rate limited')});
 await run({n:'network blocked'},{getAccountInfo:new TypeError('Failed to fetch')});
 await run({n:'bad address',addr:'0xABC'},{});
 process.exit(0)})();
