"""Crypta end to end in real Chromium: guide mode, secret guard, AI mode with streaming and tools, XSS safety,
her own window driving the desk, and the spending cap. Launcher + simulated Coinbase + fake Anthropic."""
import json,os,subprocess,sys,tempfile,threading,time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization as ser
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase,fake_anthropic as FA
ROOT=Path(__file__).parents[2];NAME='organizations/main/apiKeys/view';KEY=ec.generate_private_key(ec.SECP256R1())
sim,srv,U=sim_coinbase.start(KEY.public_key(),NAME);fa,FAU=FA.start()
PEM=KEY.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.TraditionalOpenSSL,ser.NoEncryption()).decode()
keydir=tempfile.mkdtemp();Path(keydir,'cdp_api_key.json').write_text(json.dumps({'name':NAME,'privateKey':PEM}))
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':U+'/exg','FABLE_ACCOUNT_BASE':U,'FABLE_KEY_DIR':keydir,'FABLE_ANTHROPIC_BASE':FAU}
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
fails=[];n=0
def ok(cond,msg):
    global n;n+=1
    print(('  ok   ' if cond else '  FAIL ')+msg)
    if not cond:fails.append(msg)
try:
    t0=time.time()
    while time.time()-t0<15 and not any(l.startswith('Account') for l in lines):time.sleep(.1)
    port=[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0];B='http://127.0.0.1:'+port
    with sync_playwright() as p:
        br=p.chromium.launch();ctx=br.new_context(viewport={'width':1280,'height':900});desk=ctx.new_page();errs=[]
        desk.on('pageerror',lambda e:errs.append(str(e)));desk.on('dialog',lambda d:d.accept())
        desk.goto(B+'/edge-lab/edge-lab-v7.html');desk.wait_for_timeout(1200)
        last=lambda pg:pg.evaluate("(()=>{const m=[...document.querySelectorAll('#cryptaLog .crypta-msg.assistant')].pop();return m.querySelector('.crypta-text').innerText})()")
        def ask(pg,q,wait_for=None):
            pg.fill('#cryptaInput',q);pg.press('#cryptaInput','Enter')
            pg.wait_for_function("!document.querySelector('#cryptaLog .crypta-msg.streaming')",timeout=20000);pg.wait_for_timeout(250);return last(pg)
        # ---- A. guide mode, no Anthropic key ----
        desk.click('#cryptaFab');desk.wait_for_timeout(500)
        ok(desk.is_visible('#cryptaPanel') and 'Guide mode' in desk.inner_text('#cryptaMode'),'panel opens in guide mode without an Anthropic key')
        a=ask(desk,'Why is my trade size $0?');ok('Capital plan' in a and 'calculate' in a,'size question before any plan: tells you to open Capital plan')
        desk.click('nav button[data-p="control"]');desk.wait_for_function("!document.getElementById('autoFill').disabled&&document.getElementById('riskOut').textContent.length>0",timeout=20000)
        a=ask(desk,'Why is my trade size $0?');ok('Nothing is blocking you' in a and 'budget of $25.00' in a,'size question after the plan: explains from the live plan ('+a[:80]+'…)')
        a=ask(desk,'Explain my Capital plan');ok('Size = budget ÷ loss per unit' in a and '$25.00' in a,'guide mode walks through the plan math from the live numbers')
        a=ask(desk,'How close am I to the limits?');ok('Review at $4,500' in a and 'away' in a,'guide mode: distance to each limit ('+a[:60]+'…)')
        ok('Explain my Capital plan' in desk.inner_text('#cryptaChips'),'suggestions follow the open tab (Capital plan)')
        a=ask(desk,'how do I connect coinbase?');ok(a.startswith('Connecting Coinbase') and 'View permission only' in a,'guide search finds "Connecting Coinbase"')
        # ---- B. secrets never leave the page ----
        before=len(FA.REQS);a=ask(desk,'here is my key '+json.dumps({'name':NAME,'privateKey':PEM}))
        ok(('API key or private key' in a) and ('BEGIN' not in desk.evaluate("window.crypta.chat().map(m=>m.text).join(' ')")),'pasted Coinbase key: refused with a warning')
        ok(PEM.splitlines()[1] not in desk.evaluate("localStorage.getItem('crypta:chat')||''") and len(FA.REQS)==before,'…not saved in chat history and not sent anywhere')
        # ---- C. AI mode ----
        Path(keydir,'anthropic-key.txt').write_text(FA.KEY);desk.click('#cryptaClose');desk.click('#cryptaFab');desk.wait_for_timeout(600)
        ok('AI · Claude Sonnet 5' in desk.inner_text('#cryptaMode'),'mode switches to AI once a key file exists (no restart)')
        a=ask(desk,'How does my plan look?');ok(a=='Your plan is within limits. Budget $25.00.' and desk.evaluate("[...document.querySelectorAll('#cryptaLog .crypta-msg.assistant strong')].pop().textContent")=='within limits','streamed answer rendered, markdown bold applied')
        r=FA.REQS[-1];body=json.dumps(r['body'])
        ok('"stage"' in r['body']['system'][1]['text'] and '"rEquity"' in r['body']['system'][1]['text'],'your numbers (plan stage, fields) went with the question')
        ok(PEM.splitlines()[1] not in body and 'sk-ant' not in body and NAME not in body,'no Coinbase key, key name or Anthropic key in the request body')
        a=ask(desk,'go to journal please');ok(desk.evaluate("document.querySelector('nav button[aria-selected=\"true\"]').dataset.p")=='jrn','tool go_to_tab switched the desk to the Journal')
        ok('Opened the Journal tab' in a and 'Done.' in a,'tool result shown and the conversation continued ('+a[-60:]+')')
        tool_turn=FA.REQS[-1]['body']['messages'][-1]['content'][0];ok(tool_turn['type']=='tool_result' and tool_turn['tool_use_id']=='tu_1','tool_result sent back with the right id')
        a=ask(desk,'point at my stop');ok(desk.evaluate("document.getElementById('rStop').classList.contains('crypta-glow')") and desk.evaluate("document.getElementById('p-control').classList.contains('on')"),'point_at switched to Capital plan and highlighted the stop field')
        # read tools: she can look at anything
        desk.click('nav button[data-p="jrn"]');desk.wait_for_timeout(300);desk.fill('#jSym','SOL-USD');desk.fill('#jExp','150');desk.fill('#jAct','150');desk.fill('#jExit','160');desk.fill('#jSize','100');desk.fill('#jFee','1');desk.evaluate("document.getElementById('addTrade').click()");desk.wait_for_timeout(300);desk.click('nav button[data-p="control"]');desk.wait_for_timeout(300)
        a=ask(desk,'how am i doing');ok('"trades": 1' in a.replace('":','": ').replace('":  ','": ') or '"trades":1' in a,'read_journal returned the logged trade to Claude ('+a[a.find('tool said'):][:90]+')')
        ok('Read the Journal' in desk.evaluate("[...document.querySelectorAll('#cryptaLog .crypta-chip-tool')].pop().textContent"),'tool use shown as a chip')
        a=ask(desk,'read the screen please');tr=FA.REQS[-1]['body']['messages'][-1]['content'][0]['content']
        ok('Current equity $' in tr and 'Tab control' in tr,'read_screen sent the Capital plan tab with labelled values')
        a=ask(desk,'check my account');tr=FA.REQS[-1]['body']['messages'][-1]['content'][0]['content']
        ok('"equityLog"' in tr and PEM.splitlines()[1] not in tr and NAME not in tr,'read_account returned account data without any key material')
        a=ask(desk,'market check');tr=FA.REQS[-1]['body']['messages'][-1]['content'][0]['content'];ok('"bid"' in tr and '"completedDaily30"' in tr,'read_market returned live data and the 30-day summary')
        # usability
        n_before=desk.evaluate("window.crypta.chat().length");desk.hover('#cryptaLog .crypta-msg.assistant:last-child');desk.click('#cryptaLog .crypta-msg.assistant:last-child [data-a=retry]');desk.wait_for_function("!document.querySelector('#cryptaLog .crypta-msg.streaming')",timeout=20000)
        ok(desk.evaluate("window.crypta.chat().length")==n_before,'Retry re-asks without duplicating the conversation')
        desk.keyboard.press('Alt+c');desk.wait_for_timeout(200);closed=desk.evaluate("document.getElementById('cryptaPanel').hidden");desk.keyboard.press('Alt+c');desk.wait_for_timeout(200)
        ok(closed and not desk.evaluate("document.getElementById('cryptaPanel').hidden"),'Alt+C closes and reopens her')
        a=ask(desk,'xss test');ok(desk.evaluate("window.__pwned===undefined&&!document.querySelector('#cryptaLog img')&&!document.querySelector('#cryptaLog script:not(:empty)')"),'HTML in a reply is shown as text, never run')
        # ---- D. her own window drives the desk ----
        desk.click('nav button[data-p="scan"]');win=ctx.new_page();win.on('pageerror',lambda e:errs.append('window: '+str(e)));win.goto(B+'/crypta');win.wait_for_timeout(4000)
        ok('Seeing: Daily desk' in win.inner_text('#cryptaStatusLine'),'Crypta window sees the open desk ('+win.inner_text('#cryptaStatusLine')+')')
        a=ask(win,'go to journal from the window');desk.wait_for_timeout(300)
        ok(desk.evaluate("document.querySelector('nav button[aria-selected=\"true\"]').dataset.p")=='jrn' and 'Done.' in a,'command from the window switched the desk tab')
        ok(win.evaluate("document.querySelector('link[rel=manifest]').href").endswith('/crypta.webmanifest') and win.evaluate("navigator.serviceWorker&&navigator.serviceWorker.controller!==undefined"),'window has its manifest and service worker (installable to the taskbar)')
        # ---- E. spending cap ----
        win.click('#cryptaSettingsBtn');win.fill('#cryptaCap','0');win.press('#cryptaCap','Tab');win.wait_for_timeout(500)
        a=ask(win,'hello again');ok('monthly cap' in a and 'From my guide instead' in a,'cap reached: refused with the reason and a guide answer')
        st=json.loads(Path(keydir,'crypta-usage.json').read_text());m=list(st['months'].values())[0]
        ok(m['requests']>=12 and m['costUSD']>0 and st['capUSD']==0,f"usage recorded: {m['requests']} requests, ${m['costUSD']:.4f}")
        ok(not errs,'no page errors: '+'; '.join(errs[:3]))
        br.close()
finally:
    proc.terminate();proc.wait(5);srv.shutdown();fa.shutdown()
print(f'CRYPTA E2E {"PASSED" if not fails else "FAILED"} ({n-len(fails)}/{n})');sys.exit(1 if fails else 0)
