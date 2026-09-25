// Trials on one source of a coin must count against every source of that coin.
const L=require('./core.js');
L.__setState([{spent:45,rho:0.78,data:'BTC-USD daily (bundled)'},{spent:12,rho:0.2,data:'BTC-USD daily (bundled)'},{spent:4,rho:0.7,data:'BTC-USD daily (bundled)'},
  {spent:4,rho:0.5,data:'pool[ETH+SOL]',comps:['ETH-USD 86400s','SOL-USD 86400s']}],null);
const f=t=>L.effForSet(t).toFixed(2);
console.log('A1 bundled BTC',f(['BTC-USD daily (bundled)']));
console.log('A2 refreshed BTC',f(['BTC-USD 86400s']));
console.log('A3 refreshed 6h BTC',f(['BTC-USD 21600s']));
console.log('A4 refreshed pool incl BTC',f(['BTC-USD 86400s','ETH-USD 86400s','SOL-USD 86400s']));
console.log('A5 ETH alone after ETH+SOL pool',f(['ETH-USD 86400s']));
console.log('A6 unrelated CSV',f(['csv 2016-01-01..2026-09-20 (3915)']));
console.log('A7 keys',L.assetKey('BTC-USD daily (bundled)'),L.assetKey('SOL-USD 86400s'),L.assetKey('csv x'));
