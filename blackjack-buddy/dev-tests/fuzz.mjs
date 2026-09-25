import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8701/index.html';
const SEED = +process.argv[2] || 1, STEPS = +process.argv[3] || 4000;
const sched = `window.__now = 0; window.__q = [];
  window.setTimeout = (fn, ms) => { __q.push({ t: __now + (ms || 0), fn, s: Math.random() }); return 0; };
  window.setInterval = () => 0;
  window.__flush = (lim = 1e9) => { const end = __now + lim; while (__q.length) { __q.sort((a, b) => a.t - b.t || a.s - b.s); if (__q[0].t > end) break; const j = __q.shift(); __now = j.t; j.fn(); } };`;
const b = await chromium.launch(); const ctx = await b.newContext(); const errs = [];
const open = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 300))); await p.addInitScript(sched); await p.goto(URL); await p.waitForFunction(() => window.__bb); return p; };
let p = await open(); await p.evaluate(() => localStorage.clear()); await p.close(); p = await open();
const issues = new Set(); let reloads = 0;
for (let chunk = 0; chunk < 20; chunk++) {
  const r = await p.evaluate(({ seed, n }) => {
    let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const B = __bb, G = B.G, bad = [];
    for (const f of ['sfx']) window[f] = () => {};
    G.muted = true;
    const ops = [
      () => B.startHand(), () => B.hit(), () => B.stand(), () => B.doubleDown(), () => B.split(), () => B.surrender(),
      () => B.insurance(rnd() < .5), () => B.quickBet(['min', 'half', 'dbl', 'max'][Math.floor(rnd() * 4)]),
      () => B.adjustBet((rnd() < .5 ? -1 : 1) * 10 * [1, 10, 100][Math.floor(rnd() * 3)]), () => B.adjustSide(rnd() < .5 ? 'pp' : 'tp', (rnd() < .5 ? -5 : 5) * 10),
      () => B.buyGen(B.GENS[Math.floor(rnd() * 5)].id), () => B.buyBoost(B.BOOSTS[Math.floor(rnd() * 3)].id), () => B.tipClick(10, 10), () => B.buyTipUpgrade(),
      () => B.franchise(true), () => B.buyPerk(['autotip', 'night', 'autotip2', 'crew'][Math.floor(rnd() * 4)]),
      () => B.buyOrEquip('ribbon', ['cherry', 'sakura', 'mint', 'emerald'][Math.floor(rnd() * 4)]), () => B.buyStarUp(B.STAR_UPS[Math.floor(rnd() * 8)].id),
      () => B.setTab(['table', 'casino', 'shop', 'stats'][Math.floor(rnd() * 4)]), () => B.topup(),
      () => { G.statCat = ['vip', 'hist', 'casino'][Math.floor(rnd() * 3)]; B.renderStats(); },
      () => { G.chips += Math.floor(rnd() * 1e6); G.runEarned += 2e6; }, () => { G.chips = Math.floor(G.chips * rnd() * 0.01); },
    ];
    const w = [8, 10, 8, 3, 3, 1, 3, 2, 2, 1, 1, 1, 2, 1, .3, .5, .5, .5, 1, .5, .5, .5, .5];
    const tot = w.reduce((a, x) => a + x, 0);
    let wag0 = G.st.wagered;
    for (let i = 0; i < n; i++) {
      let x = rnd() * tot, k = 0; while ((x -= w[k]) > 0) k++;
      try { ops[k](); } catch (e) { bad.push('op' + k + ': ' + e.message); }
      __flush(rnd() < .3 ? 5000 : rnd() * 700);
      if (!Number.isFinite(G.chips) || G.chips < 0 || G.chips !== Math.floor(G.chips)) bad.push('chips ' + G.chips + ' after op' + k);
      if (G.st.wagered < wag0) bad.push('wagered went down'); wag0 = G.st.wagered;
      if (G.state === 'BET') B.render();
      if (G.state === 'BET' && G.chips >= 10 && (G.bet > G.chips || G.bet + G.pp + G.tp > G.chips)) bad.push('bet exceeds chips in BET: bet ' + G.bet + ' pp ' + G.pp + ' tp ' + G.tp + ' chips ' + G.chips);
      if (G.state === 'PLAYER' && !G.hands[G.cur]) bad.push('no current hand');
      if (G.state !== 'BET' && G.hands.some(h => h.cards.length > 11)) bad.push('hand too long');
      if (G.state === 'BET' && G.hands.some(h => h.cards.length && !h.res && G.result)) bad.push('unsettled hand after round');
      // card conservation: shoe + table <= 2 copies each
      const c = {}; for (const cd of G.shoe.concat(G.dealer, ...G.hands.map(h => h.cards))) { const k2 = cd.join(''); c[k2] = (c[k2] || 0) + 1; }
      if (Object.values(c).some(v => v > 2)) bad.push('card duplicated >2');
      if (G.state === 'BET') { const vi = B.vipIdx(); if (vi < G.st.vipFloor) bad.push('tier below floor'); }
      if (bad.length > 30) break;
    }
    return { bad: [...new Set(bad)].slice(0, 20), state: G.state, rounds: G.st.rounds, chips: G.chips };
  }, { seed: SEED * 1000 + chunk, n: STEPS / 20 });
  r.bad.forEach(x => issues.add(x));
  // reload mid-whatever, sometimes
  if (chunk % 3 === 2) { await p.evaluate(() => dispatchEvent(new Event('beforeunload'))); await p.close(); p = await open(); reloads++;
    const st = await p.evaluate(() => { __flush(8000); return __bb.G.state; }); }
}
console.log({ seed: SEED, issues: [...issues], errs: [...new Set(errs)].slice(0, 10), reloads });
await b.close();
