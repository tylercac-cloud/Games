"""Read-only account connection: key parsing, JWT signing (library and pure-Python paths),
and the launcher's /account routes against a fake authenticated Coinbase that verifies every JWT."""
import base64,importlib.util,io,json,os,sys,tempfile,threading,time,http.client,unittest
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric import ec,ed25519
from cryptography.hazmat.primitives import serialization as ser

KEYDIR=tempfile.mkdtemp();os.environ['FABLE_KEY_DIR']=KEYDIR
EC_KEY=ec.generate_private_key(ec.SECP256R1());ED_KEY=ed25519.Ed25519PrivateKey.generate()
KEY_NAME='organizations/test-org/apiKeys/test-key'
STATE={'perms':{'can_view':True,'can_trade':False,'can_transfer':False,'portfolio_uuid':'pf-1','portfolio_type':'DEFAULT'},'pub':EC_KEY.public_key(),'alg':'ES256','status':200,'seen':[]}
def ec_pem(fmt):return EC_KEY.private_bytes(ser.Encoding.PEM,fmt,ser.NoEncryption()).decode()
ED_RAW=base64.b64encode(ED_KEY.private_bytes(ser.Encoding.Raw,ser.PrivateFormat.Raw,ser.NoEncryption())+ED_KEY.public_key().public_bytes(ser.Encoding.Raw,ser.PublicFormat.Raw)).decode()
ED_PKCS8=ED_KEY.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.PKCS8,ser.NoEncryption()).decode()

class FakeCoinbase(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def send(self,code,body):
        b=json.dumps(body).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        path=self.path.split('?')[0];STATE['seen'].append(self.path)
        tok=self.headers.get('Authorization','')[7:]
        try:
            claims=pyjwt.decode(tok,STATE['pub'],algorithms=[STATE['alg']],options={'verify_aud':False})
            hdr=pyjwt.get_unverified_header(tok)
            assert claims['uri']=='GET api.coinbase.com'+path,claims['uri'];assert claims['iss']=='cdp' and claims['sub']==KEY_NAME==hdr['kid']
            assert claims['exp']-claims['nbf']==120 and len(hdr['nonce'])>=16 and abs(claims['nbf']-time.time())<5
        except Exception as e:return self.send(401,{'error':'unauthorized','message':str(e)})
        if STATE['status']!=200:return self.send(STATE['status'],{'error':'x'})
        if path=='/api/v3/brokerage/key_permissions':return self.send(200,STATE['perms'])
        if path=='/api/v3/brokerage/portfolios/pf-1':return self.send(200,{'breakdown':{'portfolio':{'uuid':'pf-1'},'portfolio_balances':{'total_balance':{'value':'5123.45','currency':'USD'}},
            'spot_positions':[{'asset':'USD','total_balance_fiat':3000,'available_to_trade_fiat':3000,'is_cash':True},{'asset':'USDC','total_balance_fiat':100,'available_to_trade_fiat':100,'is_cash':True},
                              {'asset':'BTC','total_balance_fiat':1500,'total_balance_crypto':0.025,'available_to_trade_fiat':1500,'is_cash':False},
                              {'asset':'ETH','total_balance_fiat':500,'total_balance_crypto':0.2,'is_cash':False},{'asset':'DUST','total_balance_fiat':0.2,'total_balance_crypto':3}]}})
        if path=='/api/v3/brokerage/transaction_summary':return self.send(200,{'fee_tier':{'pricing_tier':'Intro 1','taker_fee_rate':'0.012','maker_fee_rate':'0.006'}})
        if path=='/api/v3/brokerage/orders/historical/batch':return self.send(200,{'orders':[{'order_id':'o-stop','product_id':'BTC-USD','side':'SELL','order_configuration':{'stop_limit_stop_limit_gtc':{'base_size':'0.025','limit_price':'56900','stop_price':'57000','stop_direction':'STOP_DIRECTION_STOP_DOWN'}}},
            {'order_id':'o-buy','product_id':'SOL-USD','side':'BUY','order_configuration':{'limit_limit_gtc':{'base_size':'1','limit_price':'100'}}}],'has_next':False})
        if path=='/api/v3/brokerage/orders/historical/fills':return self.send(200,{'fills':[
            {'trade_id':'t2','order_id':'s1','trade_time':'2026-09-10T00:00:02Z','side':'SELL','price':'62000','size':'0.01','commission':'7.44','product_id':'BTC-USD'},
            {'trade_id':'t1','order_id':'b1','trade_time':'2026-09-01T00:00:01Z','side':'BUY','price':'60000','size':'600','size_in_quote':True,'commission':'7.20','product_id':'BTC-USD'}],'cursor':''})
        return self.send(404,{'error':'not found'})

up=ThreadingHTTPServer(('127.0.0.1',0),FakeCoinbase);threading.Thread(target=up.serve_forever,daemon=True).start()
os.environ['FABLE_ACCOUNT_BASE']=f'http://127.0.0.1:{up.server_port}'
ROOT=Path(__file__).parents[2];sys.path.insert(0,str(ROOT/'market-scan'))
spec=importlib.util.spec_from_file_location('acct_server',ROOT/'market-scan/server.py');server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)
acct=server.acct
LOG=io.StringIO()

def write_key(secret,name=KEY_NAME):
    for f in Path(KEYDIR).glob('*.json'):f.unlink()
    if secret is not None:Path(KEYDIR,'cdp_api_key.json').write_text(json.dumps({'name':name,'privateKey':secret}))
    server._ACC_CACHE.clear()

class Crypto(unittest.TestCase):
    def verify(self,key,pub,alg):
        tok=acct.build_jwt(key,'GET','/api/v3/brokerage/accounts');c=pyjwt.decode(tok,pub,algorithms=[alg])
        self.assertEqual(c['uri'],'GET api.coinbase.com/api/v3/brokerage/accounts');self.assertEqual(pyjwt.get_unverified_header(tok)['alg'],alg)
    def test_parse_and_sign_all_formats(self):
        for secret,alg,pub in [(ec_pem(ser.PrivateFormat.TraditionalOpenSSL),'ES256',EC_KEY.public_key()),(ec_pem(ser.PrivateFormat.PKCS8),'ES256',EC_KEY.public_key()),
                               (ED_RAW,'EdDSA',ED_KEY.public_key()),(ED_PKCS8,'EdDSA',ED_KEY.public_key()),(ec_pem(ser.PrivateFormat.TraditionalOpenSSL).replace('\n','\\n'),'ES256',EC_KEY.public_key())]:
            a,m=acct.parse_private_key(secret);self.assertEqual(a,alg);self.verify({'kid':KEY_NAME,'alg':a,'secret':m},pub,alg)
    def test_pure_python_signatures_verify(self):
        d=EC_KEY.private_numbers().private_value;msg=b'fable pure ecdsa'
        for i in range(3):
            sig=acct.es256_sign(d,msg+bytes([i]),pure=True);from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature;from cryptography.hazmat.primitives import hashes
            EC_KEY.public_key().verify(encode_dss_signature(int.from_bytes(sig[:32],'big'),int.from_bytes(sig[32:],'big')),msg+bytes([i]),ec.ECDSA(hashes.SHA256()))
        seed=ED_KEY.private_bytes(ser.Encoding.Raw,ser.PrivateFormat.Raw,ser.NoEncryption())
        for m in [b'',b'abc',b'x'*1000]:
            self.assertEqual(acct.ed25519_sign(seed,m,pure=True),ED_KEY.sign(m));ED_KEY.public_key().verify(acct.ed25519_sign(seed,m,pure=True),m)
    def test_bad_keys_rejected(self):
        for bad in ['not a key','-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----',base64.b64encode(b'x'*20).decode()]:
            with self.assertRaises(Exception):acct.parse_private_key(bad)

class Routes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);cls.old_err=sys.stderr;sys.stderr=LOG
        threading.Thread(target=cls.httpd.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):cls.httpd.shutdown();cls.httpd.server_close();sys.stderr=cls.old_err
    def get(self,path,headers=None):
        c=http.client.HTTPConnection('127.0.0.1',self.httpd.server_port,timeout=10);c.request('GET',path,headers={'X-Fable-Local':'1',**(headers or {})});r=c.getresponse();b=r.read().decode();c.close();return r.status,b
    def setUp(self):
        STATE.update(pub=EC_KEY.public_key(),alg='ES256',status=200);STATE['perms'].update(can_trade=False,can_transfer=False);STATE['seen'].clear()
    def test_no_key(self):
        write_key(None);s,b=self.get('/account/status');self.assertEqual(s,200);self.assertFalse(json.loads(b)['configured'])
        self.assertEqual(self.get('/account/snapshot')[0],404);self.assertEqual(STATE['seen'],[])
    def test_header_and_origin_required(self):
        write_key(ec_pem(ser.PrivateFormat.TraditionalOpenSSL))
        c=http.client.HTTPConnection('127.0.0.1',self.httpd.server_port);c.request('GET','/account/snapshot');self.assertEqual(c.getresponse().status,403);c.close()
        self.assertEqual(self.get('/account/snapshot',{'Origin':'https://evil.test'})[0],403);self.assertEqual(STATE['seen'],[])
    def test_snapshot_numbers(self):
        write_key(ec_pem(ser.PrivateFormat.TraditionalOpenSSL))
        s,b=self.get('/account/status');self.assertEqual(s,200,b);self.assertTrue(json.loads(b)['ok'])
        s,b=self.get('/account/snapshot');self.assertEqual(s,200,b);d=json.loads(b)
        self.assertEqual(d['equity'],5123.45);self.assertEqual(d['cash'],3100);self.assertEqual(d['fees']['taker'],0.012)
        btc=[p for p in d['positions'] if p['asset']=='BTC'][0];eth=[p for p in d['positions'] if p['asset']=='ETH'][0]
        self.assertAlmostEqual(btc['price'],60000);self.assertAlmostEqual(btc['stopRiskUSD'],75);self.assertAlmostEqual(btc['unprotectedUSD'],0)
        self.assertAlmostEqual(eth['unprotectedUSD'],500);self.assertEqual(len(d['positions']),2)
        self.assertAlmostEqual(d['openStopRisk'],75);self.assertTrue(all(x.split('?')[0].startswith('/api/v3/brokerage/') for x in STATE['seen']))
    def test_eddsa_key_works(self):
        write_key(ED_RAW);STATE.update(pub=ED_KEY.public_key(),alg='EdDSA');s,b=self.get('/account/snapshot');self.assertEqual(s,200,b)
    def test_fills(self):
        write_key(ec_pem(ser.PrivateFormat.TraditionalOpenSSL));s,b=self.get('/account/fills?product=BTC-USD');self.assertEqual(s,200,b);f=json.loads(b)['fills']
        self.assertEqual([x['side'] for x in f],['BUY','SELL']);self.assertAlmostEqual(f[0]['qty'],0.01);self.assertAlmostEqual(f[1]['fee'],7.44)
        self.assertEqual(self.get('/account/fills?product=../x')[0],400);self.assertEqual(self.get('/account/fills?product=BTC-USD&x=1')[0],400)
    def test_trade_or_transfer_keys_refused(self):
        write_key(ec_pem(ser.PrivateFormat.TraditionalOpenSSL))
        for perm in ['can_trade','can_transfer']:
            STATE['perms'].update(can_trade=False,can_transfer=False);STATE['perms'][perm]=True;server._ACC_CACHE.clear();STATE['seen'].clear()
            s,b=self.get('/account/snapshot');self.assertEqual(s,403);self.assertIn('View-only',b)
            self.assertEqual([x.split('?')[0] for x in STATE['seen']],['/api/v3/brokerage/key_permissions'])
    def test_rejected_key_message(self):
        write_key(ec_pem(ser.PrivateFormat.TraditionalOpenSSL));STATE['pub']=ec.generate_private_key(ec.SECP256R1()).public_key()
        s,b=self.get('/account/snapshot');self.assertEqual(s,401);self.assertIn('clock',b)
    def test_key_material_never_leaves_launcher(self):
        secrets=[ec_pem(ser.PrivateFormat.TraditionalOpenSSL)];write_key(secrets[0])
        bodies=[self.get(p)[1] for p in ['/account/status','/account/snapshot','/account/fills?product=BTC-USD']]
        STATE['status']=500;server._ACC_CACHE.clear();bodies.append(self.get('/account/snapshot')[1])
        body_lines=[l for l in secrets[0].splitlines() if 'BEGIN' not in l and 'END' not in l]
        for text in bodies+[LOG.getvalue()]:
            for line in body_lines:self.assertNotIn(line,text)
            self.assertNotIn(KEY_NAME,text)
    def test_web_pages_do_not_contain_key_routes_without_header(self):
        for page in ['edge-lab/edge-lab-v7.html','edge-lab/strategy-lab.html']:
            html=(ROOT/page).read_text()
            if '/account/' in html:self.assertIn("'X-Fable-Local':'1'",html)

if __name__=='__main__':unittest.main(verbosity=2)
