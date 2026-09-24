// Automated smoke test for the real Electron app (git-ignored). Run: BB_TEST=1 electron . --no-sandbox
const fs = require('fs'), path = require('path');
module.exports = (win, app) => {
  const out = process.env.BB_OUT || path.join(__dirname, 'shots');
  fs.mkdirSync(out, { recursive: true });
  const log = (...a) => console.log('[test]', ...a);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const run = js => win.webContents.executeJavaScript(js, true);
  const shot = async n => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, n + '.png'), img.toPNG()); };
  const key = async k => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode: k }); win.webContents.sendInputEvent({ type: 'char', keyCode: k }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: k }); await wait(150); };
  win.webContents.on('console-message', (e) => log('console:', e.message || e));
  win.webContents.on('render-process-gone', (e, d) => log('RENDERER GONE', JSON.stringify(d)));
  win.webContents.session.on('will-download', (e, item) => { item.setSavePath(path.join(out, item.getFilename())); item.once('done', (ev, st) => log('download', st, item.getFilename())); });
  win.webContents.once('did-finish-load', async () => {
    try {
      await run(`window.__errs = []; addEventListener('error', e => __errs.push(e.message)); addEventListener('unhandledrejection', e => __errs.push(String(e.reason)));`);
      await wait(2500);
      const phase = process.env.BB_PHASE || '1';
      if (phase === '1') {
        await run(`__bb.G.muted = true; __bb.toggle();`); await wait(800);
        win.focus(); win.webContents.focus();
        // keyboard play: Space deals, then S/H
        for (let r = 0; r < 5; r++) {
          await key('Space'); await wait(1800);
          for (let g = 0; g < 8; g++) {
            const st = await run('__bb.G.state'); if (st === 'BET') break;
            await key(st === 'INSURANCE' ? 'n' : g % 2 ? 's' : 'h'); await wait(1300);
          }
          await wait(1500);
        }
        const s1 = await run(`({ rounds: __bb.G.st.rounds, wagered: __bb.G.st.wagered, chips: __bb.G.chips, hist: __bb.G.hist.length })`);
        log('after keyboard play', JSON.stringify(s1));
        await shot('e1-table');
        // deal and leave a hand unfinished, then quit through the app's own quit path
        await run(`__bb.G.betWant = 20; __bb.fitBets();`);
        for (let t = 0; t < 10; t++) { await run(`if (__bb.G.state === 'BET') __bb.startHand()`); await wait(1800);
          const st = await run('__bb.G.state'); if (st === 'INSURANCE') await run('__bb.insurance(false)'); if (st === 'PLAYER') break; await wait(2500); }
        const mid = await run(`({ state: __bb.G.state, hand: __bb.G.hands[0].cards.join(' '), dealer: __bb.G.dealer.join(' '), chips: __bb.G.chips, wagered: __bb.G.st.wagered, tier: __bb.VIP[__bb.vipIdx()].name })`);
        log('quitting mid-hand', JSON.stringify(mid));
        fs.writeFileSync(path.join(out, 'mid.json'), JSON.stringify(mid));
        await run(`__bb.setTab('stats'); __bb.G.statCat = 'hist'; __bb.renderStats();`); await wait(400);
        await run(`document.getElementById('csv') && document.getElementById('csv').click()`); await wait(1500);
        await shot('e2-history');
        log('errors', JSON.stringify(await run('__errs')));
        await run(`window.buddy.quit()`);
      } else {
        const st = await run(`({ state: __bb.G.state, hand: __bb.G.hands[0] ? __bb.G.hands[0].cards.join(' ') : '', dealer: __bb.G.dealer.join(' '), chips: __bb.G.chips, wagered: __bb.G.st.wagered, tier: __bb.VIP[__bb.vipIdx()].name, rounds: __bb.G.st.rounds })`);
        log('after relaunch', JSON.stringify(st));
        const mid = JSON.parse(fs.readFileSync(path.join(out, 'mid.json'), 'utf8'));
        log('resume matches', st.state === mid.state && st.hand === mid.hand && st.dealer === mid.dealer && st.chips === mid.chips && st.wagered === mid.wagered);
        await run(`__bb.G.muted = true; __bb.toggle();`); await wait(900); await shot('e3-resumed');
        await run(`__bb.stand()`); await wait(5000);
        log('finished resumed hand', JSON.stringify(await run(`({ state: __bb.G.state, res: __bb.G.hands[0].res, rounds: __bb.G.st.rounds })`)));
        log('window pos saved', fs.existsSync(path.join(app.getPath('userData'), 'position.json')));
        log('errors', JSON.stringify(await run('__errs')));
        app.quit();
      }
    } catch (e) { log('HOOK ERROR', e.stack || e); app.quit(); }
  });
};
