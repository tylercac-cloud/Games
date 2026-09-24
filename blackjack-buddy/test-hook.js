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
      } else if (phase === 'killdeal') {
        // deal, look at the cards, hit once, then hard-kill the whole app (Task Manager style) before any periodic save
        await run(`__bb.G.muted = true; __bb.toggle(); __bb.G.betWant = 100; __bb.fitBets();`); await wait(6000);
        const before = await run(`({ chips: __bb.G.chips, rounds: __bb.G.st.rounds })`);
        for (let t = 0; t < 10; t++) { await run(`if (__bb.G.state === 'BET') __bb.startHand()`); await wait(1600);
          const st = await run('__bb.G.state'); if (st === 'INSURANCE') await run('__bb.insurance(false)'); if (st === 'PLAYER') break; await wait(2500); }
        await run(`__bb.hit()`); await wait(150);
        const seen = await run(`({ state: __bb.G.state, hand: __bb.G.hands[0].cards.join(' '), dealer0: __bb.G.dealer[0].join(''), chips: __bb.G.chips })`);
        fs.writeFileSync(path.join(out, 'kill.json'), JSON.stringify({ before, seen }));
        log('saw', JSON.stringify(seen), '-> SIGKILL');
        process.kill(process.pid, 'SIGKILL');
      } else if (phase === 'afterkill') {
        const k = JSON.parse(fs.readFileSync(path.join(out, 'kill.json'), 'utf8'));
        const now = await run(`({ state: __bb.G.state, hand: __bb.G.hands[0] ? __bb.G.hands[0].cards.join(' ') : '', chips: __bb.G.chips })`);
        log('before deal', JSON.stringify(k.before), '| seen before kill', JSON.stringify(k.seen), '| after relaunch', JSON.stringify(now));
        log(now.hand === k.seen.hand ? 'HAND KEPT (no exploit)' : 'HAND UNDONE (exploit: bet refunded / hand replayable)');
        app.quit();
      } else if (phase === 'oldsave') {
        // simulate a pre-2.1.6 install: save only in localStorage, no save.json
        await run(`localStorage.setItem('blackjack-buddy', JSON.stringify({ chips: 12345, lastSeen: Date.now(), st: { wagered: 20000, rounds: 7 } }))`);
        try { fs.unlinkSync(path.join(app.getPath('userData'), 'save.json')); } catch (e) {}
        await run(`window.save = () => {}; 1`);   // don't overwrite it on the way out
        await wait(8000); log('wrote a localStorage-only save'); process.kill(process.pid, 'SIGKILL');
      } else if (phase === 'afterold') {
        log('migrated', JSON.stringify(await run(`({ chips: __bb.G.chips, wagered: __bb.G.st.wagered, rounds: __bb.G.st.rounds, tier: __bb.VIP[__bb.vipIdx()].name })`)),
          'save.json now exists:', fs.existsSync(path.join(app.getPath('userData'), 'save.json')));
        app.quit();
      } else if (phase === 'ontop1') {
        log('default on top:', win.isAlwaysOnTop(), 'setting:', app.bb.settings.onTop);
        app.bb.setOnTop(false); await wait(300);
        log('after turning off:', win.isAlwaysOnTop(), '| her line:', await run(`document.getElementById('bubble').textContent`));
        app.quit();
      } else if (phase === 'ontop2') {
        log('after relaunch:', win.isAlwaysOnTop(), 'setting:', app.bb.settings.onTop);
        app.bb.setOnTop(true); await wait(300);
        log('after turning on:', win.isAlwaysOnTop(), 'visible:', win.isVisible());
        app.quit();
      } else if (phase === 'settings') {
        // Settings page: open from the menu command, toggle on-top, back up, restore, hide
        const { dialog } = require('electron'), bak = path.join(out, 'backup.json');
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: bak });
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [bak] });
        for (let g = 0; g < 12 && await run('__bb.G.state') !== 'BET'; g++) { await run(`__bb.G.state === 'INSURANCE' ? __bb.insurance(false) : __bb.canAct() && __bb.stand(); 1`); await wait(2500); }   // finish any saved hand
        await run(`__bb.G.muted = true; __bb.G.chips = 777777; save(); 1`);
        win.webContents.send('menu', 'settings'); await wait(900); await shot('s1-settings');
        const click = async sel => { await run(`document.querySelector('${sel}').click()`); await wait(500); };
        await click('[data-set="ontop"]'); log('on top after switch:', win.isAlwaysOnTop(), 'switch on:', await run(`document.querySelector('[data-set="ontop"]').classList.contains('on')`));
        await click('[data-set="ontop"]'); log('on top after 2nd switch:', win.isAlwaysOnTop());
        await click('[data-set="export"]'); log('backup written:', fs.existsSync(bak), 'chips in it:', JSON.parse(fs.readFileSync(bak, 'utf8')).chips, '| msg:', await run(`document.querySelector('#setBody').textContent.includes('Saved to')`));
        await run(`__bb.G.chips = 5; save(); 1`);
        await click('[data-set="import"]'); await shot('s2-confirm');
        log('settings text:', await run(`document.querySelector('#setBody').textContent.slice(-160)`), 'state', await run('__bb.G.state'));
        log('confirm row shown:', await run(`!!document.querySelector('[data-set="restore-yes"]')`));
        await run(`document.querySelector('[data-set="restore-yes"]').click()`); await wait(3500);
        log('chips after restore + reload:', await run('__bb.G.chips'), '| file:', JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'save.json'), 'utf8')).chips);
        win.webContents.send('menu', 'settings'); await wait(700);
        await click('[data-set="hide"]'); log('visible after Hide:', win.isVisible());
        log('errors after reload', JSON.stringify(await run('window.__errs || "none recorded (hook installs on first load only)"')));
        app.quit();
      } else if (phase === 'hold') {
        // hold the bet + button, drift off the panel onto empty space, release there
        await run(`__bb.G.muted = true; __bb.G.chips = 1e9; __bb.fitBets(); __bb.toggle(); __bb.setBet(10);`); await wait(900);
        const r = JSON.parse(await run(`JSON.stringify(document.querySelector('[data-step="betup"]').getBoundingClientRect())`));
        const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
        const m = (type, x, y) => win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
        m('mouseMove', x, y); await wait(100); m('mouseDown', x, y); await wait(600);
        for (let i = 1; i <= 6; i++) { m('mouseMove', x - 20 * i, y - 60 * i); await wait(40); }   // up past the panel edge into transparent space
        m('mouseUp', x - 120, y - 360); await wait(300);
        const b1 = await run('__bb.G.bet'); await wait(1500); const b2 = await run('__bb.G.bet');
        log('bet at release', b1, 'bet 1.5 s later', b2, b2 === b1 ? 'STOPPED (ok)' : 'STILL CLIMBING (bug)');
        app.quit();
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
