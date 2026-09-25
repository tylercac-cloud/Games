import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8701/index.html';
const sched = `window.__now = 0; window.__q = [];
  window.setTimeout = (fn, ms) => { __q.push({ t: __now + (ms || 0), fn, s: Math.random() }); return 0; };
  window.setInterval = () => 0;
  window.__flush = (lim = 1e9) => { const end = __now + lim; while (__q.length) { __q.sort((a, b) => a.t - b.t || a.s - b.s); if (__q[0].t > end) break; const j = __q.shift(); __now = j.t; j.fn(); } };`;
const b = await chromium.launch(); const ctx = await b.newContext(); const errs = [];
const page = async (fake) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); if (fake) await p.addInitScript(sched); await p.goto(URL); await p.waitForFunction(() => window.__bb); return p; };
const out = {};
let p = await page(true);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__bb);
// 1. resume a hand after quitting mid-hand
out.resume = await p.evaluate(() => { const B = __bb, G = B.G; G.muted = true; __flush(3000);
  let tries = 0; do { if (G.state !== 'BET') { G.state = 'BET'; } G.chips = 5000; B.fitBets(); B.startHand(); __flush(3000); if (G.state === 'INSURANCE') { B.insurance(false); __flush(1000); } } while (G.state !== 'PLAYER' && ++tries < 50);
  B.render(); dispatchEvent(new Event('beforeunload'));
  return { state: G.state, hand: G.hands[0].cards.join(' '), dealer: G.dealer.join(' '), shoe: G.shoe.length, chips: G.chips, next: G.shoe[G.shoe.length - 1].join('') }; });
await p.close(); p = await page(true);
out.resumed = await p.evaluate(() => { const G = __bb.G; return { state: G.state, hand: G.hands[0].cards.join(' '), dealer: G.dealer.join(' '), shoe: G.shoe.length, chips: G.chips, holeHidden: G.holeHidden }; });
out.afterStand = await p.evaluate(() => { const B = __bb, G = B.G; __flush(3000); B.stand(); __flush(8000); return { state: G.state, res: G.hands[0].res, net: G.hands[0].net, histLen: G.hist.length }; });
// 2. top-up rule
out.topup = await p.evaluate(() => { const B = __bb, G = B.G; G.state = 'BET'; G.chips = 5; G.gens = {}; G.owned = {}; const a = B.canTopup(); B.render(); const lblA = document.getElementById('btn-deal').textContent;
  G.gens.slot = 1; const b2 = B.canTopup(); B.render(); const lblB = document.getElementById('btn-deal').textContent; G.gens = {}; G.owned.autotip = true; const c = B.canTopup(); G.owned = {};
  return { emptyCasino: a, lblA, withSlot: b2, lblB, withAutotip: c }; });
// 3. sticky + quick bets
out.bets = await p.evaluate(() => { const B = __bb, G = B.G; G.chips = 1000; G.ppWant = 0; G.tpWant = 0; B.render(); B.setBet(500); G.chips = 300; B.render(); const trimmed = G.bet; G.chips = 1000; B.render(); const restored = G.bet;
  B.quickBet('half'); const half = G.bet; B.quickBet('dbl'); const dbl = G.bet; B.quickBet('max'); const max = G.bet; B.quickBet('min'); return { trimmed, restored, half, dbl, max, min: G.bet }; });
// 4. soft totals
out.soft = await p.evaluate(() => { const t = __bb.totalText, S = '♠'; return [t([['A', S], ['6', S]]), t([['A', S], ['6', S], ['9', S]]), t([['A', S], ['K', S]]), t([['A', S]])]; });
// 5. old-save migration keeps the old tier
out.migrate = await p.evaluate(() => { localStorage.setItem('blackjack-buddy', JSON.stringify({ chips: 1000, st: { comp: 50000, wagered: 12345, rounds: 10 } })); return true; });
await p.close(); p = await page(true);
out.migrated = await p.evaluate(() => ({ tier: __bb.VIP[__bb.vipIdx()].name, floor: __bb.G.st.vipFloor, wagered: __bb.G.st.wagered }));
console.log(JSON.stringify(out, null, 1), errs);
await b.close();
