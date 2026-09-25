"""Crypta on a free local model, real Chromium: no Anthropic key; Ollama found; one-click model download with
progress; answers streamed from the local model; tools work the same way."""
import json,os,subprocess,sys,tempfile,threading,time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase,fake_ollama as FO
ROOT=Path(__file__).parents[2];sim,srv,U=sim_coinbase.start(ec.generate_private_key(ec.SECP256R1()).public_key(),'x');fo,FOU=FO.start();FO.STATE['installed']=[]
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':U+'/exg','FABLE_KEY_DIR':tempfile.mkdtemp(),'FABLE_OLLAMA_BASE':FOU}
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
fails=[];n=0
def ok(c,m):
    global n;n+=1;print(('  ok   ' if c else '  FAIL ')+m)
    if not c:fails.append(m)
try:
    time.sleep(3);port=[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0];B='http://127.0.0.1:'+port
    with sync_playwright() as p:
        br=p.chromium.launch();pg=br.new_page(viewport={'width':1280,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(B+'/edge-lab/edge-lab-v7.html');pg.wait_for_timeout(1000);pg.click('nav button[data-p="control"]');pg.wait_for_timeout(1500);pg.keyboard.press('Alt+c');pg.wait_for_timeout(600)
        ok('Guide mode' in pg.inner_text('#cryptaMode'),'no key and no local model yet: guide mode')
        pg.click('#cryptaSettingsBtn');pg.wait_for_timeout(300);ok('Ollama running, no model yet' in pg.inner_text('#cryptaSettings'),'settings see Ollama and offer downloads')
        pg.click('button[data-pull="qwen3:4b"]');seen=set()
        for _ in range(60):
            t=pg.evaluate("(document.getElementById('cryptaPull')||{}).textContent||document.getElementById('cryptaSettings').textContent");seen.add(t[:60])
            if 'is ready' in t:break
            pg.wait_for_timeout(100)
        ok(any('GB (' in x for x in seen),'download shows progress in GB and % ('+next((x for x in seen if 'GB (' in x),'none')+')')
        ok('qwen3:4b is ready' in pg.inner_text('#cryptaSettings') and 'Local AI · qwen3:4b · free' in pg.inner_text('#cryptaMode'),'after download she switches to the local model automatically')
        def ask(q):
            pg.fill('#cryptaInput',q);pg.press('#cryptaInput','Enter');pg.wait_for_function("!document.querySelector('#cryptaLog .crypta-msg.streaming')",timeout=30000);pg.wait_for_timeout(250)
            return pg.evaluate("[...document.querySelectorAll('#cryptaLog .crypta-msg.assistant .crypta-text')].pop().innerText")
        a=ask('How is my plan?');ok(a=='Your plan is within limits (local).','answer streamed from the local model')
        body=FO.STATE['reqs'][-1][1];ok(body['model']=='qwen3:4b' and 'rEquity' in body['messages'][0]['content'],'local request used the chosen model and carried the screen numbers')
        a=ask('go to journal');ok(pg.evaluate("document.querySelector('nav button[aria-selected=\"true\"]').dataset.p")=='jrn' and 'Done locally' in a,'local model used a tool (switched to the Journal) and continued')
        ok(not Path(env['FABLE_KEY_DIR'],'crypta-usage.json').exists(),'no Claude usage recorded: the local model is free')
        ok(not errs,'no page errors '+'; '.join(errs[:2]));br.close()
finally:
    proc.terminate();proc.wait(5);srv.shutdown();fo.shutdown()
print(f'CRYPTA LOCAL E2E {"PASSED" if not fails else "FAILED"} ({n-len(fails)}/{n})');sys.exit(1 if fails else 0)
