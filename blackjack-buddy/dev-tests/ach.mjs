import { open } from './harness.mjs';
const { b, p, errs } = await open();
await p.setViewportSize({ width: 560, height: 412 });
const r = await p.evaluate(() => { const B = __bb, G = B.G, o = {};
  o.fresh = B.checkAch(true); o.rewardsFound = B.ACH.every(a => B.achReward(a.id));
  // play some rounds by standing to verify no spurious unlocks / counters move
  G.chips = 1e6; G.betWant = 100; B.fitBets();
  for (let i = 0; i < 40; i++) { G.shufflePending = false; if (G.state === 'BET') B.startHand(); __flush(1500); let g = 0;
    while (G.state !== 'BET' && g++ < 20) { if (G.state === 'INSURANCE') B.insurance(false); else if (B.canAct()) (B.handValue(G.hands[G.cur].cards) < 12 ? B.hit() : B.stand()); __flush(1500); } __flush(4000); }
  o.after40 = Object.keys(G.st.ach); o.rounds = G.st.rounds;
  // forced blackjack
  G.shufflePending = false; G.shoe.push(['9','♣'], ['K','♥'], ['7','♦'], ['A','♠']); B.startHand(); __flush(3500);
  o.bjRes = G.hands[0].res; o.natural = !!G.st.ach.natural; o.bubble = document.getElementById('bubble').textContent; o.toast = !!document.querySelector('.achtoast');
  o.ownsNatural = B.ownsItem ? B.ownsItem('back', 'natural') : 'n/a';
  return o; });
console.log(JSON.stringify(r));
await p.evaluate(() => { const G = __bb.G; G.st.ach.natural = G.st.ach.natural || Date.now(); G.st.rounds = Math.max(G.st.rounds, 640); G.st.doubleWins = 11; G.st.bestStreak = 7; __bb.checkAch(true);
  document.querySelectorAll('.achtoast').forEach(e => e.remove()); if (!document.body.classList.contains('open')) __bb.toggle(); __bb.setTab('stats'); G.statCat = 'ach'; __bb.renderStats(); __flush(1000); });
await p.waitForTimeout(900); await p.screenshot({ path: 'shots-ach.png' });
await p.evaluate(() => { __bb.setTab('settings'); __flush(500); }); await p.waitForTimeout(900); await p.screenshot({ path: 'shots-settings.png' });
await p.evaluate(() => { __bb.G.shopCat = 'cards'; __bb.setTab('shop'); __flush(500); }); await p.waitForTimeout(900); await p.screenshot({ path: 'shots-shop.png' });
await p.evaluate(() => { const G = __bb.G; G.st.ach.streak = 1; G.equip.back = 'natural'; G.equip.felt = 'mahogany'; G.equip.ribbon = 'flame'; G.equip.outfit = 'gilded'; __bb.applyCosmetics(); __bb.setTab('table'); __flush(500);
  G.shufflePending = false; __bb.startHand(); __flush(900); });
await p.waitForTimeout(900); await p.screenshot({ path: 'shots-cos.png' });
await p.evaluate(() => { const G = __bb.G; G.st.ach = {}; G.st.rounds = 99; __bb.checkAch(); __flush(10); G.st.rounds = 100; G.st.bestStreak = 7; __bb.checkAch(); __flush(50); });
await p.waitForTimeout(900); await p.screenshot({ path: 'shots-toast.png' });
console.log('errs', errs); await b.close();
