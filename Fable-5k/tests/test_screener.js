const {JSDOM}=require('jsdom');const fs=require('fs');
const w=new JSDOM(fs.readFileSync(__dirname+'/../screener/screener-v2.html','utf8'),{runScripts:'dangerously'}).window,d=w.document,$=i=>d.getElementById(i);
const set=o=>{['mintAuth','freezeAuth','lpLock','holderConc','liq','devWallet','verified','age'].forEach(k=>$(k).value=o[k]||'unknown');$('scoreBtn').click();return $('scoreNum').textContent+' '+$('scoreTier').textContent};
console.log('all unknown          :',set({}));
const opts=k=>[...$(k).options].map(o=>o.value);
console.log('options:',['mintAuth','freezeAuth','lpLock','holderConc','liq','devWallet','verified'].map(k=>k+'='+opts(k).join('/')).join('  '));
console.log('all clean            :',set({mintAuth:'renounced',freezeAuth:'renounced',lpLock:'locked',holderConc:'lt30',liq:'gt50k',devWallet:'lt10',verified:'standard',age:'gt24h'}));
console.log('clean but LP unknown :',set({mintAuth:'renounced',freezeAuth:'renounced',holderConc:'lt30',liq:'gt50k',devWallet:'lt10',verified:'standard'}));
console.log('mint active only     :',set({mintAuth:'active',freezeAuth:'renounced',lpLock:'locked',holderConc:'lt30',liq:'gt50k',devWallet:'lt10',verified:'standard'}));
