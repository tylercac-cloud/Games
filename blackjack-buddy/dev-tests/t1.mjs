import { open } from './harness.mjs';
const { b, p, errs } = await open();
const r = await p.evaluate(() => {
  const B = __bb, G = B.G, out = {};
  const rig = (cards) => { B.shuffle(); G.shoe.push(...cards.slice().reverse().map(c => [c.slice(0, -1), c.slice(-1)])); };
  const S = '♠', H = '♥';
  // A: split, then an immediate Hit before hand 1's second card lands
  G.chips = 100000; G.bet = 100; G.pp = 0; G.tp = 0; G.state = 'BET';
  rig(['8'+S, '5'+S, '8'+H, '9'+S, '2'+S, '3'+S, '4'+S, '6'+S]);   // p d p d, then 2,3 go to split hands
  B.startHand(); __flush(3000);
  out.stateAfterDeal = G.state;
  B.split(); B.hit(); B.stand(); __flush(200);
  out.hand1CardsDuringDelay = G.hands[0].cards.length;
  __flush(600);
  out.hand1Cards = G.hands[0].cards.map(c => c[0]).join(',');
  // B: double-clicked Stand moves to hand 2 but must not stand hand 2 while it has one card
  B.stand(); B.stand(); __flush(200);
  out.hand2DoneWithOneCard = G.hands[1].done && G.hands[1].cards.length === 1;
  __flush(2000);
  out.hand2Cards = G.hands[1].cards.map(c => c[0]).join(',');
  out.hand2Done = G.hands[1].done; out.state = G.state;
  B.stand(); __flush(5000); out.final = G.state + ' ' + G.hands.map(h => h.res).join('/');
  // C: bet no longer affordable after spending chips elsewhere -> Deal still works
  G.chips = 1000; G.bet = 500; B.render(); G.chips = 300; B.render();
  out.betAfterSpend = G.bet; out.canDealAfterSpend = B.canDeal();
  return out;
});
console.log(r, errs);
await b.close();
