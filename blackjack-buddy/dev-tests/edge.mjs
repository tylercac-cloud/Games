import { open } from './harness.mjs';
const { b, p, errs } = await open();
const r = await p.evaluate(() => { const B = __bb, G = B.G, out = {};
  const finish = () => { let g = 0; while (G.state !== 'BET' && g++ < 40) { if (G.state === 'INSURANCE') B.insurance(false); else if (B.canAct()) B.stand(); __flush(2000); } __flush(3000); };
  // two tiers crossed in one round -> both rewards, paid before the celebration
  G.st.wagered = 9e3; G.st.vipFloor = 0; G.chips = 1e10; G.betWant = 1e9; B.fitBets(); const c0 = G.chips;
  B.startHand(); finish();
  out.tiers = { tier: B.VIP[B.vipIdx()].name, tierUps: G.st.tierUps };
  // shoe runs dry mid-hand: no card may appear more than twice
  G.betWant = 10; B.fitBets(); G.shufflePending = false; G.shoe = G.shoe.slice(-3); G.cutAt = 1e9; B.startHand(); __flush(3000);
  let g = 0; while (G.state !== 'BET' && g++ < 30) { if (G.state === 'INSURANCE') B.insurance(false); else if (B.canAct()) B.hit(); __flush(1500); }
  const c = {}; for (const cd of G.shoe.concat(G.dealer, ...G.hands.map(h => h.cards))) { const k = cd.join(''); c[k] = (c[k] || 0) + 1; }
  out.reshuffle = { maxCopies: Math.max(...Object.values(c)), total: Object.values(c).reduce((a, x) => a + x, 0) };
  finish();
  // insurance with no chips left: refused, not negative
  G.chips = 150; G.betWant = 100; G.ppWant = 0; G.tpWant = 0; B.fitBets(); G.shufflePending = false; G.shoe.push(['K', '♦'], ['7', '♣'], ['A', '♥'], ['9', '♠']); B.startHand(); __flush(3000);
  out.insState = G.state; G.chips = 20; B.insurance(true); out.insChips = G.chips; out.insStill = G.state;
  return out; });
console.log(JSON.stringify(r), errs); await b.close();
