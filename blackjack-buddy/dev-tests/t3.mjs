import { open } from './harness.mjs';
const { b, p, errs } = await open();
const N = +process.argv[2] || 100000;
const r = await p.evaluate((N) => {
  const B = __bb, G = B.G;
  for (const f of ['render', 'say', 'setMood', 'drawGirl', 'hop', 'sfx', 'renderVipBadges', 'celebrateVip', 'blinkLoop', 'chatterLoop', 'save']) window[f] = () => {}; __q.length = 0;
  const up = () => { const r = G.dealer[0][0]; return r === 'A' ? 11 : 'JQK'.includes(r) || r === '10' ? 10 : +r; };
  const soft = cards => { let t = 0, a = 0; for (const [r] of cards) { if (r === 'A') { t += 11; a++; } else t += 'JQK'.includes(r) || r === '10' ? 10 : +r; } while (t > 21 && a) { t -= 10; a--; } return a > 0 && t <= 21; };
  const pv = r => r === 'A' ? 11 : 'JQK'.includes(r) || r === '10' ? 10 : +r;
  function act() {
    const h = G.hands[G.cur], c = h.cards, d = up(), t = B.handValue(c), two = c.length === 2;
    if (B.canSplit()) {
      const v = pv(c[0][0]);
      const sp = v === 11 || v === 8 || (v === 9 && ![7, 10, 11].includes(d)) || (v === 7 && d <= 7) || (v === 6 && d <= 6) ||
        (v === 4 && (d === 5 || d === 6)) || ((v === 2 || v === 3) && d <= 7);
      if (sp) return B.split();
    }
    if (B.canSurrender() && !soft(c) && ((t === 16 && d >= 9) || (t === 15 && d === 10)) && !(c[0][0] === '8' && c[1][0] === '8')) return B.surrender();
    if (soft(c)) {
      if (two && B.canDouble() && ((t === 18 && d >= 3 && d <= 6) || (t === 17 && d >= 3 && d <= 6) || ((t === 15 || t === 16) && d >= 4 && d <= 6) || ((t === 13 || t === 14) && d >= 5 && d <= 6))) return B.doubleDown();
      if (t >= 19 || (t === 18 && d <= 8)) return B.stand();
      return B.hit();
    }
    if (two && B.canDouble() && (t === 11 || (t === 10 && d <= 9) || (t === 9 && d >= 3 && d <= 6))) return B.doubleDown();
    if (t >= 17 || (t >= 13 && d <= 6) || (t === 12 && d >= 4 && d <= 6)) return B.stand();
    return B.hit();
  }
  let staked = 0, net = 0, chipDrift = 0, rounds = 0, res = {}, sideSt = 0, sideNet = 0;
  const side = N < 0;
  for (let i = 0; i < Math.abs(N); i++) {
    G.chips = 1e9; G.st.wagered = 0; G.betWant = 100; G.ppWant = side ? 10 : 0; G.tpWant = side ? 10 : 0; B.fitBets();
    const before = G.chips;
    B.startHand(); __flush(2000);
    let guard = 0;
    while (G.state !== 'BET') {
      if (G.state === 'INSURANCE') B.insurance(false);
      else if (G.state === 'PLAYER' && B.canAct()) act();
      __flush(1000);
      if (++guard > 200) throw 'stuck ' + G.state;
    }
    const mainNet = G.hands.reduce((a, h) => a + h.net, 0), sn = G.sideResults.reduce((a, r) => a + r[1], 0);
    for (const h of G.hands) { staked += h.bet; res[h.res] = (res[h.res] || 0) + 1; }
    net += mainNet; sideNet += sn; sideSt += G.pp + G.tp; rounds++;
    chipDrift += (G.chips - before) - (mainNet + sn) - G.cashback;
  }
  return { played: G.st.rounds, rounds, mainEdgePerInitialBet: (net / (rounds * 100) * 100).toFixed(3) + '%', sideRTP: sideSt ? (sideNet / sideSt * 100).toFixed(2) + '%' : '-', chipDrift, res };
}, N);
console.log(r, errs.slice(0, 3));
await b.close();
