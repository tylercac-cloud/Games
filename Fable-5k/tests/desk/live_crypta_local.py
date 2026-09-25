"""LIVE check of Crypta on a real local model: real Ollama (127.0.0.1:11434), real Coinbase public data, no keys.
As the owner would: open the desk, Fill the Capital plan from live data, open Crypta (Alt+C), download a model from her
settings, then ask about the plan and the Journal. Checks the download, the switch to the local brain, that answers
stream, that her read-only tools fire, and that no Claude usage is recorded. Answer quality is printed for a human to judge.
Needs Ollama running and internet. Usage: python tests/desk/live_crypta_local.py [qwen3:4b|qwen3:8b|llama3.1:8b]
Writes tests/artifacts/live-crypta-local.json."""
import json,os,subprocess,sys,tempfile,threading,time
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parents[2];MODEL=sys.argv[1] if len(sys.argv)>1 else 'qwen3:4b'
env={**os.environ,'FABLE_KEY_DIR':tempfile.mkdtemp()}
for k in ('FABLE_BROKERAGE_BASE','FABLE_EXCHANGE_BASE','FABLE_ACCOUNT_BASE','FABLE_OLLAMA_BASE','ANTHROPIC_API_KEY'):env.pop(k,None)
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
results=[];facts={'model':MODEL,'answers':[]}
def check(name,ok,detail=''):
    results.append({'check':name,'ok':bool(ok),'detail':str(detail)[:600]});print(('PASS ' if ok else 'FAIL ')+name+(' - '+str(detail)[:600] if detail else ''),flush=True)
try:
    t0=time.time()
    while time.time()-t0<40 and not any(l.startswith('Account') for l in lines):time.sleep(.2)
    B='http://127.0.0.1:'+[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0]
    with sync_playwright() as p:
        br=p.chromium.launch();pg=br.new_page(viewport={'width':1280,'height':900});errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
        pg.goto(B+'/edge-lab/edge-lab-v7.html');pg.wait_for_timeout(1500);pg.click('nav button[data-p="control"]');pg.wait_for_timeout(500)
        pg.click('#autoFill');pg.wait_for_timeout(500);pg.wait_for_function("!document.getElementById('autoFill').disabled",timeout=60000)
        for fid,v in (('rEF','0.6'),('rXF','0.6')):   # no key, so fees stay manual: Coinbase Advanced taker at the lowest tier
            if not pg.input_value('#'+fid):pg.fill('#'+fid,v)
        pg.click('#planRisk');pg.wait_for_timeout(800)
        plan={k:pg.input_value('#'+k) for k in ('rAsset','rEquity','rCash','rEntry','rStop','rEF','rXF','rES','rXS')};plan['result']=pg.inner_text('#riskOut')[:700]
        facts['plan']=plan;check('Capital plan filled from live data and calculated',plan['rEntry'] and plan['rStop'] and plan['result'].strip(),{k:v for k,v in plan.items() if k!='result'})
        pg.keyboard.press('Alt+c');pg.wait_for_timeout(800);pg.click('#cryptaSettingsBtn');pg.wait_for_timeout(1500)
        settings=pg.inner_text('#cryptaSettings');facts['settingsBefore']=settings[:400]
        check('her settings find Ollama running','Ollama running' in settings,settings[:200])
        if pg.locator('button[data-pull="%s"]'%MODEL).count():
            t=time.time();pg.click('button[data-pull="%s"]'%MODEL);seen=[]
            while time.time()-t<3600:
                s=pg.evaluate("(document.getElementById('cryptaPull')||{}).textContent||document.getElementById('cryptaSettings').textContent")
                if not seen or seen[-1]!=s[:80]:seen.append(s[:80])
                if 'is ready' in s or 'failed' in s.lower() or 'error' in s.lower():break
                pg.wait_for_timeout(1000)
            facts['download']={'seconds':round(time.time()-t),'progressSamples':seen[:3]+seen[-3:]}
            check('one-click download of %s finishes'%MODEL,'is ready' in pg.inner_text('#cryptaSettings'),facts['download'])
            check('download shows progress in GB and %',any('GB (' in x for x in seen),seen[:4])
        else:print('  info: %s already installed; download step skipped'%MODEL)
        pg.wait_for_timeout(1000);mode=pg.inner_text('#cryptaMode');facts['mode']=mode
        check('she switches to the local model','Local AI' in mode and MODEL in mode,mode)
        def ask(q,wait_ms=900000):
            t=time.time();pg.fill('#cryptaInput',q);pg.press('#cryptaInput','Enter');pg.wait_for_timeout(500)
            pg.wait_for_function("!document.querySelector('#cryptaLog .crypta-msg.streaming')",timeout=wait_ms);pg.wait_for_timeout(300)
            last=pg.evaluate("""(()=>{const m=[...document.querySelectorAll('#cryptaLog .crypta-msg.assistant')];const q=%s;
              const i=m.length?m.length-1:-1;return {text:i<0?'':m[i].querySelector('.crypta-text').innerText,
              tools:[...document.querySelectorAll('#cryptaLog .crypta-msg.assistant .crypta-tools span, #cryptaLog .crypta-msg.assistant .crypta-tools *')].map(x=>x.textContent)}})()"""%json.dumps(q))
            a={'q':q,'seconds':round(time.time()-t),'answer':last['text'],'toolChipsSoFar':sorted(set(last['tools'])),'tab':pg.evaluate("document.querySelector('nav button[aria-selected=\"true\"]').dataset.p")}
            facts['answers'].append(a);print('\n  Q: %s  (%ds)\n  A: %s\n  tools so far: %s\n'%(q,a['seconds'],a['answer'][:1200],a['toolChipsSoFar']),flush=True);return a
        a1=ask('What position size does my Capital plan give right now, and which limit decides it? Show the arithmetic.')
        check('plan question answered',len(a1['answer'].strip())>40 and 'error' not in a1['answer'].lower()[:60],a1['answer'][:200])
        a2=ask('Take me to the Journal tab.')
        check('navigation tool fired (switched to the Journal)',a2['tab']=='jrn',a2['tab'])
        a3=ask('What does my journal show so far?')
        check('journal question answered',len(a3['answer'].strip())>20,a3['answer'][:200])
        tools=set(a3['toolChipsSoFar'])
        check('at least one read-only tool fired',any(t.startswith('✓') for t in tools),sorted(tools))
        check('no failed tool calls',not any(t.startswith('✗') for t in tools),sorted(tools))
        check('no Claude usage recorded (local model is free)',not Path(env['FABLE_KEY_DIR'],'crypta-usage.json').exists())
        check('no page errors',not errs,errs[:3]);br.close()
except Exception as e:check('run',False,type(e).__name__+': '+str(e))
finally:
    if proc.poll() is None:proc.terminate();proc.wait(5)
out=ROOT/'tests/artifacts/live-crypta-local.json'
out.write_text(json.dumps({'ranAt':datetime.now(timezone.utc).isoformat(),'results':results,'facts':facts},indent=1))
failed=[r for r in results if not r['ok']];print('\n%d checks, %d failed. Details: %s'%(len(results),len(failed),out.relative_to(ROOT)))
print('LIVE CRYPTA LOCAL '+('FAILED' if failed else 'PASSED'));sys.exit(1 if failed else 0)
