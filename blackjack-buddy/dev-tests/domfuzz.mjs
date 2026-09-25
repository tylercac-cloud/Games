import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SEED = +process.argv[2] || 1, N = +process.argv[3] || 800;
let s = SEED; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 560, height: 412 } }); const errs = [], issues = new Set();
let p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:8701/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__bb);
await p.evaluate(() => { __bb.G.muted = true; __bb.G.chips = 20000; __bb.toggle(); });
await p.clock.install();
const keys = ['h', 's', 'd', 'p', 'r', 'i', 'n', 'Space', 'Enter'];
for (let i = 0; i < N; i++) {
  const x = rnd();
  try {
    if (x < 0.7) {         // click a random visible, enabled button
      const btns = await p.$$('button:visible:not([disabled])');
      if (btns.length) { const bt = btns[Math.floor(rnd() * btns.length)]; await bt.click({ timeout: 300, force: rnd() < 0.2, clickCount: rnd() < 0.15 ? 2 : 1 }).catch(() => {}); }
    } else if (x < 0.9) { await p.keyboard.press(keys[Math.floor(rnd() * keys.length)]); }
    else if (x < 0.95) { await p.evaluate(() => __bb.G.chips += 5000); }
    else { await p.evaluate(() => dispatchEvent(new Event('beforeunload'))); await p.reload(); await p.waitForFunction(() => window.__bb); await p.evaluate(() => { __bb.G.muted = true; if (!document.body.classList.contains('open')) __bb.toggle(); }); }
    await p.clock.runFor(Math.floor(rnd() * (rnd() < 0.2 ? 6000 : 700)));
    const bad = await p.evaluate(() => { const G = __bb.G, o = [];
      if (!Number.isFinite(G.chips) || G.chips < 0 || G.chips !== Math.floor(G.chips)) o.push('chips ' + G.chips);
      if (G.state === 'PLAYER' && !G.hands[G.cur]) o.push('no hand');
      const open = document.querySelectorAll('.celebrate').length; if (open > 1) o.push('stacked overlays ' + open);
      if (document.querySelectorAll('.float,.spark').length > 60) o.push('particle leak');
      const c = {}; for (const cd of G.shoe.concat(G.dealer, ...G.hands.map(h => h.cards))) { const k = cd.join(''); c[k] = (c[k] || 0) + 1; }
      if (Object.values(c).some(v => v > 2)) o.push('dup card');
      if (G.state !== 'BET' && document.body.dataset.phase === 'bet') o.push('phase mismatch ' + G.state);
      return o; });
    bad.forEach(x => issues.add(x));
  } catch (e) { issues.add('harness: ' + String(e).slice(0, 120)); }
}
// let everything settle, then check the round finishes
await p.clock.runFor(20000);
const end = await p.evaluate(() => ({ state: __bb.G.state, rounds: __bb.G.st.rounds, tab: __bb.G.tab }));
console.log({ seed: SEED, issues: [...issues], errs: [...new Set(errs)].slice(0, 8), end });
await b.close();
