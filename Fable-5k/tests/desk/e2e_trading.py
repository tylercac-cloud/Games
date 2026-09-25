"""Simulated user trading end to end: real launcher + real pages + stateful Coinbase simulator.
Every number the app shows is checked against an independent re-derivation and against the simulated account."""
import json,os,subprocess,sys,tempfile,threading,time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization as ser
sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase
ROOT=Path(__file__).parents[2];NAME='organizations/main/apiKeys/view'
KEY=ec.generate_private_key(ec.SECP256R1())
sim,srv,U=sim_coinbase.start(KEY.public_key(),NAME)
# The user funded the account with $5,000 minutes before first opening Fable: that is the starting balance, not a deposit.
from datetime import datetime,timezone,timedelta
sim.transfers.append({'id':'fund','type':'fiat_deposit','status':'completed','native_amount':{'amount':'5000.00','currency':'USD'},'created_at':(datetime.now(timezone.utc)-timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M:%SZ')})
keydir=tempfile.mkdtemp();Path(keydir,'cdp_api_key.json').write_text(json.dumps({'name':NAME,'privateKey':KEY.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.TraditionalOpenSSL,ser.NoEncryption()).decode()}))
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':U+'/exg','FABLE_ACCOUNT_BASE':U,'FABLE_KEY_DIR':keydir}
proc=subprocess.Popen([os.environ.get('FABLE_TEST_PY',sys.executable),'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
try:
    t0=time.time()
    while time.time()-t0<15 and not any(l.startswith('Account') for l in lines):time.sleep(.1)
    port=[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0]
    assert any(l.startswith('Account:') and 'OK' in l for l in lines),lines
    r=subprocess.run(['node',str(ROOT/'tests/desk/e2e_trading.js'),port,U],capture_output=True,text=True,timeout=400)
    print(r.stdout.strip());print(r.stderr.strip()[-3000:])
    assert r.returncode==0
    print('TRADING SIMULATION PASSED')
finally:
    proc.terminate();proc.wait(5);srv.shutdown()
