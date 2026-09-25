/* ============ v7 market and evidence core ============ */
const DAY=86400;
function canonicalJSON(value){
  function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,clean(x[k])]));return x}
  return JSON.stringify(clean(value));
}
function deepFreeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(deepFreeze);Object.freeze(x)}return x}
function marketNumber(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null;const n=Number(String(v).trim().replace(/%$/,''));return Number.isFinite(n)?n:null}
function marketRows(products){
  if(!Array.isArray(products))throw Error('Coinbase response has no products array.');
  const seen=new Set();return products.filter(p=>p&&p.product_type==='SPOT'&&p.quote_currency_id==='USD'&&/^[A-Z0-9._-]+-USD$/.test(p.product_id)&&!seen.has(p.product_id)&&seen.add(p.product_id)).map(p=>{
    const price=marketNumber(p.price),baseVol=marketNumber(p.volume_24h),quoteVol=marketNumber(p.approximate_quote_24h_volume);
    return {product:p.product_id,price:price>0?price:null,change24h:marketNumber(p.price_percentage_change_24h),volumeUSD:quoteVol>=0&&quoteVol!==null?quoteVol:baseVol!==null&&baseVol>=0&&price>0?baseVol*price:null,volumeBasis:quoteVol!==null?'reported quote volume':'base volume × current price estimate',blocked:!!(p.is_disabled||p.trading_disabled||p.cancel_only||p.auction_mode),restricted:!!(p.limit_only||p.post_only),status:String(p.status||'unspecified'),minimumQuote:marketNumber(p.quote_min_size),baseIncrement:marketNumber(p.base_increment)}
  }).sort((a,b)=>(b.volumeUSD??-1)-(a.volumeUSD??-1)||a.product.localeCompare(b.product));
}
function normalizeCandles(payload,nowSeconds,count=200){
  if(!payload||!Array.isArray(payload.candles))throw Error('Coinbase response has no candles array.');
  const cutoff=Math.floor(nowSeconds/DAY)*DAY,byTime=new Map();let incomplete=0;
  for(const c of payload.candles){
    const t=marketNumber(c.start);if(t===null||!Number.isInteger(t)||t%DAY!==0)throw Error('Invalid daily candle timestamp.');
    if(t>=cutoff){incomplete++;continue;}
    if(t<cutoff-count*DAY)continue;
    const b={t,d:new Date(t*1000).toISOString().slice(0,10),o:marketNumber(c.open),h:marketNumber(c.high),l:marketNumber(c.low),c:marketNumber(c.close),v:marketNumber(c.volume)};
    if([b.o,b.h,b.l,b.c].some(x=>x===null||x<=0)||b.v===null||b.v<0||b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c))throw Error('Invalid OHLC/volume in '+b.d+'.');
    if(byTime.has(t)&&canonicalJSON(byTime.get(t))!==canonicalJSON(b))throw Error('Conflicting duplicate candle '+b.d+'.');
    byTime.set(t,b);
  }
  const bars=[...byTime.values()].sort((a,b)=>a.t-b.t);
  if(!bars.length)throw Error('No complete daily candles returned.');
  if(bars.at(-1).t!==cutoff-DAY)throw Error('Latest completed UTC day is missing; signals suppressed.');
  for(let i=1;i<bars.length;i++)if(bars[i].t-bars[i-1].t!==DAY)throw Error('Missing daily candle; signals suppressed.');
  if(bars.length<121)throw Error('At least 121 contiguous completed days are required; signals suppressed.');
  return {bars,cutoff,incomplete};
}
function lockedSignals(bars){
  if(bars.length<121)throw Error('Insufficient indicator history.');
  const means=n=>bars.slice(-n).reduce((s,b)=>s+b.c,0)/n;
  const prevMeans=n=>bars.slice(-n-1,-1).reduce((s,b)=>s+b.c,0)/n;
  const fast=means(20),slow=means(120),on=fast>slow,previous=prevMeans(20)>prevMeans(120);
  let state=false,before=false;
  for(let i=60;i<bars.length;i++){
    before=state;const hi=Math.max(...bars.slice(i-60,i).map(b=>b.h)),lo=Math.min(...bars.slice(i-30,i).map(b=>b.l));
    if(!state&&bars[i].c>hi)state=true;else if(state&&bars[i].c<lo)state=false;
  }
  const action=(a,b)=>a&&!b?'Fresh ON transition':!a&&b?'Fresh OFF transition':a?'ON; no fresh entry':'OFF';
  return [{id:'H1',on,previous,description:action(on,previous),fast,slow},{id:'H2',on:state,previous:before,description:action(state,before),channelHigh:Math.max(...bars.slice(-61,-1).map(b=>b.h)),channelLow:Math.min(...bars.slice(-31,-1).map(b=>b.l))}];
}
function observationWindow(nowSeconds){const end=Math.floor(nowSeconds/DAY)*DAY;return {start:end-200*DAY,end,asOf:new Date((end-DAY)*1000).toISOString().slice(0,10)}}
function experimentRisk(equity,peak,policy){
  if(!Number.isFinite(equity)||equity<=0||!Number.isFinite(peak)||peak<equity)throw Error('Use positive equity and high-water equity at least as high.');
  const loss=policy.initialCapital-equity,drawdown=peak-equity,hardFloor=Math.max(policy.initialCapital-policy.hardPauseLoss,peak-policy.trailingPauseDollars);
  const stage=equity<=hardFloor?'HALT':loss>=policy.noNewRiskLoss?'NO_NEW_RISK':loss>=policy.reviewLoss?'REVIEW':'WITHIN_LIMITS';
  const remaining=Math.max(0,equity-hardFloor),headroomBeforePause=Math.max(0,equity-(policy.initialCapital-policy.noNewRiskLoss));
  return {stage,loss,drawdown,hardFloor,remaining,headroomBeforePause,newRiskAllowed:stage==='WITHIN_LIMITS'||stage==='REVIEW',riskFraction:policy.perTradeRiskFraction*(stage==='REVIEW'?.5:1)};
}
function overlapsExposure(a,b){
  const left=Date.parse(a.start),right=Date.parse(a.end),l=Date.parse(b.start),r=Date.parse(b.end);
  if(![left,right,l,r].every(Number.isFinite))return 'unknown';
  if(a.asset!=='UNKNOWN'&&b.asset!=='UNKNOWN'&&a.asset!==b.asset)return false;
  return left<r&&l<right;
}
async function fetchPublicJSON(path,fetcher,waiter=ms=>new Promise(r=>setTimeout(r,ms))){
  if(!/^\/(?:time|market\/(?:products(?:\/[A-Z0-9._-]+(?:\/candles)?)?))\??/.test(path)||path.includes('..')||path.includes('://'))throw Error('Only public market endpoints are permitted.');
  for(let attempt=0;attempt<3;attempt++){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);let response;
    try{response=await fetcher('https://api.coinbase.com/api/v3/brokerage'+path,{method:'GET',credentials:'omit',signal:ctl.signal,headers:{Accept:'application/json'}})}
    catch(e){if(attempt===2)throw Error('Public data request failed or timed out. Browser/network access may be blocked. Use the local launcher; do not enter API keys.');}
    finally{clearTimeout(timer)}
    if(response){
      if(response.ok){const data=await response.json();if(data===null||typeof data!=='object')throw Error('Invalid JSON response.');return data}
      if(response.status!==429&&response.status<500)throw Error('Coinbase public API returned HTTP '+response.status+'.');
      if(attempt===2)throw Error('Coinbase remained unavailable after three attempts (HTTP '+response.status+').');
    }
    await waiter(500*(attempt+1));
  }
}
async function collectMarketScan(getJSON,nowSeconds,onProgress=()=>{},protocol=null){
  const win=observationWindow(nowSeconds),products=[],pageIds=new Set();let pages=0,truncated=false;
  for(let page=0;page<20;page++){
    const data=await getJSON('/market/products?product_type=SPOT&limit=100&offset='+page*100);
    if(!Array.isArray(data.products))throw Error('Product listing response is malformed.');
    const ids=data.products.map(x=>x.product_id).join('|');if(data.products.length&&pageIds.has(ids))throw Error('Coinbase repeated a product page; scan cannot claim completeness.');pageIds.add(ids);products.push(...data.products);pages++;
    onProgress('Reading Coinbase products · page '+pages);
    // Stop on a short page, on an explicit last-page flag, or when the API ignored the limit and returned the full list.
    if(data.products.length<100||data.products.length>100||(data.pagination&&data.pagination.has_next===false))break;
    if(page===19)truncated=true;
  }
  const rows=marketRows(products),details=[],errors=[];
  for(const product of ['BTC-USD','ETH-USD','SOL-USD']){
    onProgress('Reading closed daily candles · '+product);
    try{
      const anchor=product==='BTC-USD'&&protocol?Date.parse(protocol.warmupStartInclusive)/1000:win.start;
      const end=product==='BTC-USD'&&protocol?Math.min(win.end,Date.parse(protocol.endExclusive)/1000):win.end;
      if(end<=anchor||end-anchor>1000*DAY)throw Error('Study data window is outside the supported range.');
      const gathered={candles:[]};
      for(let start=anchor;start<end;start+=200*DAY){
        const batchEnd=Math.min(end,start+200*DAY),data=await getJSON('/market/products/'+product+'/candles?start='+start+'&end='+(batchEnd-1)+'&granularity=ONE_DAY&limit=200');
        if(!Array.isArray(data.candles))throw Error('Malformed candles response.');
        // Filter each requested page explicitly; inclusive endpoints may repeat boundary bars.
        gathered.candles.push(...data.candles.filter(c=>Number(c.start)>=start&&Number(c.start)<batchEnd));
      }
      const normalized=normalizeCandles(gathered,end,(end-anchor)/DAY),bars=normalized.bars;
      if(bars[0].t!==anchor)throw Error('Fixed warm-up start is missing; signals suppressed.');
      const logReturns=bars.slice(-31).slice(1).map((b,i)=>Math.log(b.c/bars.slice(-31)[i].c)),m=logReturns.reduce((a,b)=>a+b,0)/logReturns.length;
      const volatility=Math.sqrt(logReturns.reduce((a,b)=>a+(b-m)**2,0)/Math.max(1,logReturns.length-1))*Math.sqrt(365.25);
      details.push({product,start:bars[0].d,end:bars.at(-1).d,bars:bars.length,lastClose:bars.at(-1).c,volatility30d:volatility,signals:product==='BTC-USD'?lockedSignals(bars):[],sourceCandles:bars,incompleteDiscarded:normalized.incomplete,contextOnly:product!=='BTC-USD'});
    }catch(e){errors.push({product,message:e.message})}
  }
  return {window:win,pages,truncated,rows,details,errors,complete:!truncated&&errors.length===0};
}

function sha256Text(text){
  const bytes=[];for(const char of unescape(encodeURIComponent(text)))bytes.push(char.charCodeAt(0));
  const length=bytes.length;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
  const bits=length*8;for(let i=7;i>=0;i--)bytes.push(i>=4?Math.floor(bits/2**(i*8))&255:(bits>>>i*8)&255);
  const primes=[],initial=[],round=[];
  for(let p=2;primes.length<64;p++){let prime=true;for(let d=2;d*d<=p;d++)if(p%d===0){prime=false;break}if(prime){primes.push(p);if(initial.length<8)initial.push((Math.sqrt(p)%1*4294967296)|0);round.push((Math.cbrt(p)%1*4294967296)|0)}}
  const H=initial.slice(),rotate=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<bytes.length;offset+=64){
    const w=Array(64);for(let i=0;i<16;i++)w[i]=(bytes[offset+4*i]<<24)|(bytes[offset+4*i+1]<<16)|(bytes[offset+4*i+2]<<8)|bytes[offset+4*i+3];
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotate(a,7)^rotate(a,18)^(a>>>3),s1=rotate(b,17)^rotate(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){const S1=rotate(e,6)^rotate(e,11)^rotate(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+round[i]+w[i])|0,S0=rotate(a,2)^rotate(a,13)^rotate(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0}
    [a,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)|0);
  }
  return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

module.exports={canonicalJSON,sha256Text,marketRows,normalizeCandles,lockedSignals,observationWindow,experimentRisk,overlapsExposure,fetchPublicJSON,collectMarketScan};
