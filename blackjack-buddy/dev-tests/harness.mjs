// Needs Playwright + Chromium. Serve the game first:  cd blackjack-buddy && python3 -m http.server 8701
// PW=/path/to/playwright/index.mjs overrides where Playwright is imported from.
const { chromium } = await import(process.env.PW || 'playwright');
const PORT = process.env.BB_PORT || 8701;
// fake scheduler: timers run only when the test flushes them
const init = `
  window.__now = 0; window.__q = [];
  window.setTimeout = (fn, ms) => { __q.push({ t: __now + (ms || 0), fn, s: __q.length + Math.random() * 1e-6 }); return 0; };
  window.setInterval = () => 0;
  window.__flush = (limitMs = 1e9) => { const end = __now + limitMs; let n = 0;
    while (__q.length) { __q.sort((a, b) => a.t - b.t || a.s - b.s); if (__q[0].t > end) break; const j = __q.shift(); __now = j.t; j.fn(); if (++n > 1e6) throw 'loop'; } };
  localStorage.clear();
`;
export async function open() {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(init);
  await p.goto('http://127.0.0.1:' + PORT + '/index.html');
  await p.waitForFunction(() => window.__bb);
  await p.evaluate(() => { __bb.G.muted = true; __flush(5000); });
  return { b, p, errs };
}
