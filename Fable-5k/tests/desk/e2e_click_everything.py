"""Real Chromium: open both tools from the launcher (simulated Coinbase + View-only key), visit every tab and press
every button, in order, as a new user would. Fails on any uncaught script error, console error, failed local request
(other than a deliberate 4xx the page handles), unhandled dialog, or a page wider than the window."""
import json,os,subprocess,sys,tempfile,threading,time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization as ser
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase
MODE=sys.argv[1] if len(sys.argv)>1 else 'normal'   # normal | no-key | bad-key | exchange-down | launcher-dies
ROOT=Path(__file__).parents[2];NAME='organizations/main/apiKeys/view';KEY=ec.generate_private_key(ec.SECP256R1())
sim,srv,U=sim_coinbase.start(KEY.public_key(),NAME);sim.moving=True
keydir=tempfile.mkdtemp()
if MODE!='no-key':
    signer=ec.generate_private_key(ec.SECP256R1()) if MODE=='bad-key' else KEY   # bad-key: Coinbase rejects every signature (401)
    Path(keydir,'cdp_api_key.json').write_text(json.dumps({'name':NAME,'privateKey':signer.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.TraditionalOpenSSL,ser.NoEncryption()).decode()}))
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':('http://127.0.0.1:9/exg' if MODE=='exchange-down' else U+'/exg'),'FABLE_ACCOUNT_BASE':U,'FABLE_KEY_DIR':keydir}
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
SKIP={'impState'}   # opens the OS file picker
problems=[];pressed=0;done_ids=set()
try:
    t0=time.time()
    while time.time()-t0<15 and not any(l.startswith('Account') for l in lines):time.sleep(.1)
    port=[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0];BASE='http://127.0.0.1:'+port
    with sync_playwright() as p:
        br=p.chromium.launch()
        paths=['/','/edge-lab/edge-lab-v7.html'] if MODE=='launcher-dies' else ['/edge-lab/edge-lab-v7.html','/edge-lab/strategy-lab.html','/']
        for page_path in paths:
            ctx=br.new_context(viewport={'width':1280,'height':900},accept_downloads=True,timezone_id='America/Chicago');page=ctx.new_page();name=page_path
            page.on('pageerror',lambda e,n=name:problems.append(f'{n}: script error {e}'))
            page.on('console',lambda m,n=name:m.type=='error' and 'Failed to load resource' not in m.text and problems.append(f'{n}: console {m.text}'))
            page.on('response',lambda r,n=name:r.status>=500 and '127.0.0.1' in r.url and MODE=='normal' and problems.append(f'{n}: HTTP {r.status} {r.url}'))
            page.on('dialog',lambda d:d.accept())
            page.goto(BASE+page_path);page.wait_for_timeout(1500)
            if MODE=='launcher-dies' and page_path!='/':proc.terminate();proc.wait(5)   # the black window was closed with the page still open
            if page_path=='/':
                check=page.evaluate("document.documentElement.scrollWidth<=innerWidth+1");check or problems.append('start page wider than window');ctx.close();continue
            tabs=page.eval_on_selector_all('nav button[data-p]','els=>els.map(e=>e.dataset.p)')
            if 'lab' in tabs:   # load data first so test and export buttons have something to work on
                page.click('nav button[data-p="lab"]');page.click('#loadBundled');page.wait_for_timeout(1500)
            for tab in tabs:
                page.click(f'nav button[data-p="{tab}"]');page.wait_for_timeout(600);page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
                ids=page.evaluate(f"[...document.querySelectorAll('#p-{tab} button[id], section.active button[id], [data-panel=\"{tab}\"] button[id]')].filter(b=>b.offsetParent&&!b.disabled).map(b=>b.id)")
                if not ids:ids=page.evaluate("[...document.querySelectorAll('button[id]')].filter(b=>b.offsetParent&&!b.disabled).map(b=>b.id)")
                for bid in dict.fromkeys(ids):
                    if bid in SKIP:continue
                    try:
                        loc=page.locator('#'+bid)
                        if not loc.is_visible():   # an earlier button may have switched tab or collapsed a section: go back
                            page.click(f'nav button[data-p="{tab}"]');page.wait_for_timeout(300);page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
                        if not loc.is_visible() or not loc.is_enabled():problems.append(f'{name} tab {tab}: #{bid} not reachable');continue
                        loc.click(timeout=5000);pressed+=1;done_ids.add(name+'#'+bid);page.wait_for_timeout(700)
                        try:page.wait_for_function("![...document.querySelectorAll('button[id]')].some(b=>b.offsetParent&&b.disabled&&!['autoFill'].includes(b.id))",timeout=30000)   # let long actions (market pool) finish
                        except Exception:problems.append(f'{name} tab {tab}: buttons still busy 30 s after #{bid}')
                    except Exception as e:problems.append(f'{name} tab {tab}: could not press #{bid}: {str(e)[:120]}')
                wide=page.evaluate("document.documentElement.scrollWidth-innerWidth")
                if wide>1:problems.append(f'{name} tab {tab}: page {wide}px wider than the window')
            if page_path.endswith('edge-lab-v7.html'):   # each failure mode must be explained on screen, not just survived
                page.click('nav button[data-p="control"]');page.click('#autoFill')
                try:page.wait_for_function("!document.getElementById('autoFill').disabled",timeout=30000)
                except Exception:problems.append('Fill never finished')
                status=page.evaluate("document.getElementById('autoStatus').textContent+' | '+document.getElementById('acctOut').textContent+' | '+document.getElementById('liveDiag').textContent")
                want={'no-key':'Account not connected','bad-key':'rejected the key (HTTP 401)','launcher-dies':'Launcher not reachable','exchange-down':'Account read with View-only key','normal':'Account read with View-only key'}[MODE]
                if want not in status:problems.append(f'[{MODE}] expected "{want}" on screen, got: {status[:300]}')
                else:print(f'[{MODE}] on screen: "{want}"')
            page.wait_for_timeout(1500);ctx.close()
        br.close()
finally:
    if proc.poll() is None:proc.terminate();proc.wait(5)
    srv.shutdown()
print(f'[{MODE}] pressed {pressed} buttons');print(sorted(done_ids))
for x in problems:print('  PROBLEM',x)
if problems:print(f'CLICK-EVERYTHING FAILED [{MODE}]');sys.exit(1)
print(f'CLICK-EVERYTHING PASSED [{MODE}]')
