import { open } from './harness.mjs';
const { b, p, errs } = await open();
await p.setViewportSize({ width: 560, height: 412 });
const o = {};
o.parse = await p.evaluate(() => ['2500', '2,500', '2.5k', '1.2M', '3Qa', '3qa', '1e21', '.5k', 'abc', '', '5 k', '1.5Sp', '-5', '12x'].map(t => t + '=' + __bb.parseAmount(t)).join(' | '));
await p.evaluate(() => { const G = __bb.G; G.chips = 1e7; G.pp = G.tp = 0; __bb.fitBets(); if (!document.body.classList.contains('open')) __bb.toggle(); __bb.setBet(50); __flush(500); });
await p.waitForTimeout(700);
const typeIn = async (id, txt, key = 'Enter') => { await p.click('#v-' + id); await p.waitForTimeout(100); await p.keyboard.type(txt); await p.keyboard.press(key); await p.waitForTimeout(100); return p.evaluate(w => ({ v: w === 'bet' ? __bb.G.bet : __bb.G[w], want: w === 'bet' ? __bb.G.betWant : __bb.G[w + 'Want'], shown: document.getElementById('v-' + w).textContent, inputs: document.querySelectorAll('.amtin').length }), id); };
o.t1 = await typeIn('bet', '2.5k');
o.t2 = await typeIn('bet', '999M');                     // over chips -> capped
o.t3 = await typeIn('bet', 'junk');                     // ignored
o.t4 = await typeIn('bet', '7', 'Escape');              // cancelled
o.t5 = await typeIn('pp', '123');                       // side step 5 -> 120
o.t6 = await typeIn('bet', '5');                        // below min -> 10
// space inside the input must not deal
await p.click('#v-bet'); await p.keyboard.type('1 000'); o.spaceState = await p.evaluate(() => __bb.G.state); await p.keyboard.press('Enter'); o.t7 = await p.evaluate(() => __bb.G.bet);
// Min
o.min = await p.evaluate(() => { const B = __bb, G = B.G, r = []; G.pp = 0; B.setBet(5e5); B.quickBet('min'); r.push(G.bet); B.quickBet('min'); r.push(G.bet); B.quickBet('min'); r.push(G.bet); return r; });
// arrows
await p.evaluate(() => __bb.setBet(100));
const k = async key => { await p.keyboard.press(key); return p.evaluate(() => __bb.G.bet); };
await p.click('#chips').catch(() => {});
o.arrows = [await k('ArrowUp'), await k('ArrowUp'), await k('ArrowDown'), await k('Shift+ArrowUp'), await k('Shift+ArrowDown')];
// click the amount then click Deal directly: blur commits, then the hand deals with the typed bet
await p.click('#v-bet'); await p.keyboard.type('300'); await p.click('#btn-deal'); await p.evaluate(() => __flush(1500));
o.dealt = await p.evaluate(() => ({ state: __bb.G.state, handBet: __bb.G.handBet }));
o.arrowInHand = await k('ArrowUp');
await p.waitForTimeout(300);
await p.evaluate(() => { let g = 0; while (__bb.G.state !== 'BET' && g++ < 20) { if (__bb.G.state === 'INSURANCE') __bb.insurance(false); else if (__bb.canAct()) __bb.stand(); __flush(1500); } __flush(4000); });
await p.click('#v-bet'); await p.keyboard.type('12.5k'); await p.waitForTimeout(400); await p.screenshot({ path: 'shots-typing.png' }); await p.keyboard.press('Enter');
console.log(JSON.stringify(o, null, 1), errs); await b.close();
