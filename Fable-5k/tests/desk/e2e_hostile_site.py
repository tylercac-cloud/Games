"""Real Chromium: a hostile website open in the same browser tries to read the account through the launcher
(fetch with the custom header, no-cors fetch, <img>/<script> tags, a form POST). None may reach Coinbase or
read anything."""
import json,os,subprocess,sys,tempfile,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization as ser
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase
ROOT=Path(__file__).parents[2];NAME='organizations/main/apiKeys/view';KEY=ec.generate_private_key(ec.SECP256R1())
sim,srv,U=sim_coinbase.start(KEY.public_key(),NAME)
keydir=tempfile.mkdtemp();Path(keydir,'k.json').write_text(json.dumps({'name':NAME,'privateKey':KEY.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.TraditionalOpenSSL,ser.NoEncryption()).decode()}))
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':U+'/exg','FABLE_ACCOUNT_BASE':U,'FABLE_KEY_DIR':keydir}
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
t0=time.time()
while time.time()-t0<15 and not any(l.startswith('Account') for l in lines):time.sleep(.1)
port=[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0];F='http://127.0.0.1:'+port
EVIL=f'''<html><body><script>
const R={{}};const F="{F}";
async function go(){{
 try{{const r=await fetch(F+"/account/snapshot",{{headers:{{"X-Fable-Local":"1"}}}});R.withHeader=await r.text()}}catch(e){{R.withHeader="blocked: "+e.message}}
 try{{const r=await fetch(F+"/account/snapshot",{{mode:"no-cors"}});R.noCors=r.type+":"+(await r.text())}}catch(e){{R.noCors="blocked: "+e.message}}
 try{{const r=await fetch("http://localhost:{port}/account/snapshot",{{headers:{{"X-Fable-Local":"1"}}}});R.viaLocalhost=await r.text()}}catch(e){{R.viaLocalhost="blocked: "+e.message}}
 const i=new Image();i.src=F+"/account/fills?product=ALL";const s=document.createElement("script");s.src=F+"/account/transfers?since=2026-01-01";document.body.append(i,s);
 const f=document.createElement("form");f.method="POST";f.action=F+"/account/snapshot";f.target="x";const fr=document.createElement("iframe");fr.name="x";document.body.append(fr,f);f.submit();
 await new Promise(r=>setTimeout(r,1500));document.title="done";window.RESULT=R}}
go();</script></body></html>'''
class Evil(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_GET(self):b=EVIL.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
ev=ThreadingHTTPServer(('127.0.0.1',0),Evil);threading.Thread(target=ev.serve_forever,daemon=True).start()
ok=True
try:
    sim.seen.clear()
    with sync_playwright() as p:
        br=p.chromium.launch();pg=br.new_page();pg.goto(f'http://127.0.0.1:{ev.server_port}/evil.html');pg.wait_for_function('document.title==="done"',timeout=15000)
        R=pg.evaluate('window.RESULT');br.close()
    account_calls=[s for s in sim.seen if s.startswith('/api/v3/brokerage') or s.startswith('/v2/')]
    print('hostile page saw:',json.dumps(R)[:400]);print('Coinbase account calls caused:',account_calls)
    for k,v in R.items():
        if 'equity' in v or 'fills' in v.lower() and 'error' not in v:print('LEAK via',k);ok=False
    if account_calls:ok=False
finally:
    proc.terminate();proc.wait(5);srv.shutdown();ev.shutdown()
print('HOSTILE SITE TEST '+('PASSED' if ok else 'FAILED'));sys.exit(0 if ok else 1)
