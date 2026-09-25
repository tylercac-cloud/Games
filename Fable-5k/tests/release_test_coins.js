// Adding a coin must be a single-line change to COINS, and everything derives from it.
const L=require('./core.js');
console.log('C registry-nonempty '+(Array.isArray(L.COINS)&&L.COINS.length>=3));
console.log('C ids-are-pairs '+L.COINS.every(c=>/^[A-Z0-9]+-USD$/.test(c.id)));
console.log('C coinName-known '+(L.coinName('ETH-USD')==='ETH'));
console.log('C coinName-unknown '+(L.coinName('XRP-USD')==='XRP'));
console.log('C isKnownCoin '+(L.isKnownCoin('BTC-USD')===true&&L.isKnownCoin('ZZZ-USD')===false));
// assetKey groups a coin's sources so trial accounting is per coin
console.log('C assetKey-groups '+(L.assetKey('ETH-USD 86400s')===L.assetKey('ETH-USD 21600s')));
