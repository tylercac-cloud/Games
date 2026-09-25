"""End to end: real launcher process -> real pages -> fake Coinbase (public + JWT-verified account).
Uses the user's actual failure case: the key saved as 'cdp_api_key.json 2.txt'."""
import json,os,subprocess,sys,tempfile,threading,time,math
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization as ser
ROOT=Path(__file__).parents[2];DAY=86400
KEY=ec.generate_private_key(ec.SECP256R1());NAME='organizations/e2e/apiKeys/view'
PEM=KEY.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.TraditionalOpenSSL,ser.NoEncryption()).decode()
SEEN=[]
def candles_exchange(q):
    from datetime import datetime
    s=datetime.fromisoformat(q['start'].replace('Z','+00:00')).timestamp();e=datetime.fromisoformat(q['end'].replace('Z','+00:00')).timestamp();rows=[]
    t=math.ceil(s/DAY)*DAY
    while t<=e:
        low=58000+(t//DAY)%7*100;rows.append([int(t),low,low+3000,low+1000,low+1500,10]);t+=DAY
    return rows[::-1]
class Fake(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def send(self,code,body):
        b=json.dumps(body).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        path,_,qs=self.path.partition('?');q=dict(p.split('=',1) for p in qs.split('&') if '=' in p)
        from urllib.parse import unquote;q={k:unquote(v) for k,v in q.items()};SEEN.append(self.path)
        if path.startswith('/exg/products/'):
            if path.endswith('/ticker'):return self.send(200,{'price':'64123','bid':'64120','ask':'64125','time':'2026-09-22T12:00:00Z'})
            if path.endswith('/stats'):return self.send(200,{'open':'63000','high':'64500','low':'62800','last':'64123','volume':'100'})
            if path.endswith('/candles'):return self.send(200,candles_exchange(q))
        if path.startswith('/brk/market/products/') and path.endswith('/ticker'):return self.send(200,{'trades':[{'price':'64123','time':'2026-09-22T12:00:00Z'}],'best_bid':'64120','best_ask':'64125'})
        if path.startswith('/brk/market/products/') and path.count('/')==4:return self.send(200,{'product_id':path.rsplit('/',1)[1],'price':'64123','price_percentage_change_24h':'1.78','volume_24h':'100'})
        if path=='/brk/market/products':return self.send(200,{'products':[{'product_id':p,'product_type':'SPOT','quote_currency_id':'USD','price':'100','volume_24h':'1000','status':'online'} for p in ['BTC-USD','ETH-USD','SOL-USD']],'num_products':3})
        if path.startswith('/brk/market/products/') and path.endswith('/candles'):
            # One synthetic market for every candle route (daily scan, and the Exchange fallback).
            s_,e_=int(q['start']),int(q['end']);rows=[]
            for t in range(math.ceil(s_/DAY)*DAY,e_+1,DAY):
                low=58000+(t//DAY)%7*100;rows.append({'start':str(t),'low':str(low),'high':str(low+3000),'open':str(low+1000),'close':str(low+1500),'volume':'10'})
            return self.send(200,{'candles':rows[::-1]})
        if path.startswith('/api/v3/brokerage/'):
            tok=self.headers.get('Authorization','')[7:]
            try:
                c=pyjwt.decode(tok,KEY.public_key(),algorithms=['ES256']);assert c['uri']=='GET api.coinbase.com'+path and c['sub']==NAME
            except Exception as ex:return self.send(401,{'error':str(ex)})
            if path.endswith('/key_permissions'):return self.send(200,{'can_view':True,'can_trade':False,'can_transfer':False,'portfolio_uuid':'pf','portfolio_type':'DEFAULT'})
            if path.endswith('/portfolios/pf'):return self.send(200,{'breakdown':{'portfolio_balances':{'total_balance':{'value':'5123.45','currency':'USD'}},'spot_positions':[
                {'asset':'USD','total_balance_fiat':3100,'available_to_trade_fiat':3100,'is_cash':True},{'asset':'BTC','total_balance_fiat':1500,'total_balance_crypto':0.025,'is_cash':False},{'asset':'ETH','total_balance_fiat':500,'total_balance_crypto':0.2,'is_cash':False}]}})
            if path.endswith('/transaction_summary'):return self.send(200,{'fee_tier':{'pricing_tier':'Intro 1','taker_fee_rate':'0.012','maker_fee_rate':'0.006'}})
            if path.endswith('/orders/historical/batch'):return self.send(200,{'orders':[{'order_id':'s','product_id':'BTC-USD','side':'SELL','order_configuration':{'stop_limit_stop_limit_gtc':{'base_size':'0.025','limit_price':'56900','stop_price':'57000'}}}],'has_next':False})
            if path.endswith('/orders/historical/fills'):return self.send(200,{'fills':[
                {'trade_id':'1','order_id':'b1','trade_time':'2026-09-01T00:00:00Z','side':'BUY','price':'60000','size':'0.01','commission':'7.2','product_id':'BTC-USD'},
                {'trade_id':'2','order_id':'s1','trade_time':'2026-09-10T00:00:00Z','side':'SELL','price':'62000','size':'0.01','commission':'7.44','product_id':'BTC-USD'}]})
        return self.send(404,{'error':'nf '+path})
up=ThreadingHTTPServer(('127.0.0.1',0),Fake);threading.Thread(target=up.serve_forever,daemon=True).start();U=f'http://127.0.0.1:{up.server_port}'
keydir=tempfile.mkdtemp();Path(keydir,'README.txt').write_text('instructions')
Path(keydir,'cdp_api_key.json 2.txt').write_text(json.dumps({'name':NAME,'privateKey':PEM}))   # the user's exact file
DOWN=len(sys.argv)>1 and sys.argv[1]=='exchange-down'
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':('http://127.0.0.1:9/exg' if DOWN else U+'/exg'),'FABLE_ACCOUNT_BASE':U,'FABLE_KEY_DIR':keydir,'PYTHONIOENCODING':'cp437'}
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='cp437',errors='replace')
lines=[];port=None;t0=time.time()
def reader():
    for l in proc.stdout:lines.append(l.rstrip())
threading.Thread(target=reader,daemon=True).start()
try:
    while time.time()-t0<15 and not any('Account' in l for l in lines):time.sleep(.1)
    print('\n'.join(l for l in lines if 'Fable local server' not in l))
    port=int([l for l in lines if l.startswith('Fable 5k: http://127.0.0.1:')][0].split(':')[3].split('/')[0])
    assert any('Live data' in l and 'OK' in l and 'Advanced' in l for l in lines);assert any('Live data' in l and 'OK' in l and 'Exchange' in l and (('fallback' in l)==DOWN) for l in lines)
    assert any('Account' in l and 'OK' in l for l in lines),'account line'
    r=subprocess.run(['node',str(ROOT/'tests/desk/e2e_page.js'),str(port)],capture_output=True,text=True,timeout=240)
    print(r.stdout.strip());print(r.stderr.strip()[-2000:])
    assert r.returncode==0
    assert PEM.splitlines()[1] not in '\n'.join(lines)
    if DOWN:assert not any(p.startswith('/exg/') for p in SEEN),'exchange should be unreachable'
    print('E2E LAUNCHER PASSED'+(' WITH api.exchange.coinbase.com DOWN' if DOWN else '')+' (cp437 console, misnamed key file, JWT-verified account, pages served by launcher)')
finally:
    proc.terminate();proc.wait(5)
