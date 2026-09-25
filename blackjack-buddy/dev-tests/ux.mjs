import { open } from './harness.mjs';
const { b, p, errs } = await open();
const r = await p.evaluate(() => { const B = __bb, G = B.G, o = {}; let pops = 0; const s0 = window.sfx; window.sfx = n => { if (n === 'pop') pops++; };
  const bub = () => document.getElementById('bubble').classList.contains('show') ? document.getElementById('bubble').textContent : '(hidden)';
  // (a) insurance bubble after deciding
  G.chips = 5000; G.betWant = 100; B.fitBets(); G.shufflePending = false; G.shoe.push(['K', '♦'], ['7', '♣'], ['A', '♥'], ['9', '♠']);
  B.startHand(); __flush(1500); o.insAsk = bub(); B.insurance(false); __flush(300); o.afterDecline = bub(); o.stateAfter = G.state;
  let g = 0; while (G.state !== 'BET' && g++ < 20) { if (B.canAct()) B.stand(); __flush(1500); } __flush(6000);
  // (b) cards left on the table after a franchise / top-up
  o.cardsBeforeFranchise = G.hands.length + '/' + G.dealer.length;
  G.runEarned = 5e6; B.franchise(true); __flush(500); o.afterFranchise = { hands: G.hands.length, dealer: G.dealer.length, result: G.result, pval: document.getElementById('pval').textContent, shown: document.querySelectorAll('#phand .card, #dhand .card').length };
  G.shufflePending = false; B.startHand(); __flush(1500); g = 0; while (G.state !== 'BET' && g++ < 20) { if (G.state === 'INSURANCE') B.insurance(false); else if (B.canAct()) B.stand(); __flush(1500); } __flush(3000);
  G.chips = 3; G.gens = {}; G.owned = {}; G.lastTopup = 0; B.topup(); __flush(300);
  o.afterTopup = { shown: document.querySelectorAll('#phand .card, #dhand .card').length, result: document.getElementById('result').textContent };
  // (d) idle chatter while the table is closed, 10 minutes
  if (document.body.classList.contains('open')) B.toggle();
  pops = 0; __flush(10 * 60000); o.popsIn10MinClosed = pops;
  return o; });
console.log(JSON.stringify(r, null, 1), errs); await b.close();
