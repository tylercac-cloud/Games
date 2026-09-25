import { open } from './harness.mjs';
const { b, p, errs } = await open();
const r = await p.evaluate(() => { const B = __bb, G = B.G, o = {}; G.gens = {}; G.owned = {};
  G.chips = 5; B.render(); o.first = document.getElementById('btn-deal').textContent; B.topup(); o.afterTopup = G.chips;
  G.chips = 3; B.render(); o.second = document.getElementById('btn-deal').textContent; o.canNow = B.canTopup(); B.topup(); o.chipsAfterRefused = G.chips;
  G.lastTopup -= 10 * 60000 + 1; B.render(); o.later = document.getElementById('btn-deal').textContent; o.canLater = B.canTopup();
  return o; });
console.log(r, errs); await b.close();
