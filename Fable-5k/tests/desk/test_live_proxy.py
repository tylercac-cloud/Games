"""Live-data path, end to end, against a local fake Coinbase (no internet needed).
Covers: every browser-facing route, JSON passthrough, cache, specific failure reasons,
/health, port fallback, and that nothing but GET public routes reaches the upstream."""
import importlib.util,json,os,socket,ssl,threading,http.client,unittest
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError,HTTPError

SEEN=[];MODE={'nonjson':False}
class FakeCoinbase(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_GET(self):
        SEEN.append(self.path)
        if MODE['nonjson']:
            b=b'<html>blocked</html>';self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
        p=self.path.split('?')[0]
        if p.endswith('/ticker'):body={'price':'64123.45','bid':'64120.00','ask':'64125.00','time':'2026-09-22T12:00:00Z'}
        elif p.endswith('/stats'):body={'open':'63000','high':'64500','low':'62800','last':'64123.45','volume':'12000.5'}
        elif p.startswith('/brk/market/products/') and p.endswith('/candles'):body={'candles':[{'start':'1758412800','open':'1','high':'2','low':'0.5','close':'1.5','volume':'10'}]}
        elif p.startswith('/brk/market/products/'):body={'product_id':p.rsplit('/',1)[1],'price':'64123.45'}
        elif p=='/brk/market/products':body={'products':[{'product_id':'BTC-USD'}],'num_products':1}
        elif p.startswith('/exg/products/') and p.endswith('/candles'):body=[[1758412800,62800,64500,63000,64100,12000]]
        else:
            b=b'{"message":"NotFound"}';self.send_response(404);self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
        b=json.dumps(body).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)

up=ThreadingHTTPServer(('127.0.0.1',0),FakeCoinbase);threading.Thread(target=up.serve_forever,daemon=True).start()
os.environ['FABLE_BROKERAGE_BASE']=f'http://127.0.0.1:{up.server_port}/brk'
os.environ['FABLE_EXCHANGE_BASE']=f'http://127.0.0.1:{up.server_port}/exg'
spec=importlib.util.spec_from_file_location('live_server',Path(__file__).parents[2]/'market-scan/server.py');server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)

class LiveProxy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=cls.httpd.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):cls.httpd.shutdown();cls.httpd.server_close()
    def get(self,path,method='GET'):
        c=http.client.HTTPConnection('127.0.0.1',self.httpd.server_port,timeout=5);c.request(method,path);r=c.getresponse();b=r.read();c.close();return r.status,json.loads(b)
    def setUp(self):SEEN.clear();MODE['nonjson']=False;server._CACHE.clear()
    def test_browser_routes_pass_through(self):
        s,b=self.get('/coinbase-exchange/products/BTC-USD/ticker');self.assertEqual(s,200);self.assertEqual(b['price'],'64123.45')
        s,b=self.get('/coinbase-exchange/products/ETH-USD/stats');self.assertEqual(s,200);self.assertEqual(b['open'],'63000')
        s,b=self.get('/coinbase-exchange/products/DOGE-USD/candles?granularity=86400&start=2026-01-01T00:00:00.000Z&end=2026-10-27T23:59:59.000Z');self.assertEqual(s,200);self.assertEqual(b[0][0],1758412800)
        s,b=self.get('/coinbase-public/market/products/SOL-USD');self.assertEqual(s,200);self.assertEqual(b['product_id'],'SOL-USD')
        s,b=self.get('/coinbase-public/market/products/LINK-USD/candles?start=1728000000&end=1728086399&granularity=ONE_DAY&limit=200');self.assertEqual(s,200);self.assertIn('candles',b)
        s,b=self.get('/coinbase-public/market/products?limit=100&offset=0&product_type=SPOT');self.assertEqual(s,200)
        self.assertTrue(all(p.startswith('/brk/market/') or p.startswith('/exg/products/') for p in SEEN),SEEN)
    def test_cache_prevents_rate_limit_bursts(self):
        for _ in range(4):self.get('/coinbase-exchange/products/BTC-USD/ticker')
        self.assertEqual(len(SEEN),1)
    def test_rejections_never_reach_upstream(self):
        for bad in ['/coinbase-exchange/orders','/coinbase-exchange/accounts','/coinbase-exchange/products/BTC-USD/book','/coinbase-exchange/products/btc-usd/ticker',
                    '/coinbase-exchange/products/BTC-USD/candles?granularity=60&start=2026-01-01T00:00:00Z&end=2026-01-01T01:00:00Z',
                    '/coinbase-exchange/products/BTC-USD/candles?granularity=86400&start=2020-01-01T00:00:00Z&end=2026-01-01T00:00:00Z',
                    '/coinbase-exchange/products/BTC-USD/candles?granularity=86400&start=nope&end=2026-01-01T00:00:00Z',
                    '/coinbase-exchange/products/BTC-USD/ticker?x=1','/coinbase-public/market/products/BTC-USD/ticker','/coinbase-exchange/../../etc/passwd']:
            s,b=self.get(bad);self.assertEqual(s,400,bad)
        self.assertEqual(self.get('/coinbase-exchange/products/BTC-USD/ticker','POST')[0],405)
        self.assertEqual(SEEN,[])
    def test_nonjson_upstream_is_named(self):
        MODE['nonjson']=True;s,b=self.get('/coinbase-exchange/products/BTC-USD/ticker');self.assertEqual(s,502);self.assertIn('non-JSON',b['error'])
    def test_upstream_404_is_passed_with_reason(self):
        s,b=self.get('/coinbase-exchange/products/NOPE-USD/nothing');self.assertEqual(s,400)
    def test_health(self):
        s,b=self.get('/health');self.assertEqual(s,200);self.assertTrue(b['ok'],b);self.assertEqual(len(b['checks']),2);self.assertAlmostEqual(b['checks'][0]['btcUsd'],64123.45)
        MODE['nonjson']=True;server._CACHE.clear();s,b=self.get('/health');self.assertFalse(b['ok']);self.assertTrue(all('non-JSON' in c['error'] for c in b['checks']))

class FailureReasons(unittest.TestCase):
    def test_messages_are_specific(self):
        d=server.describe_failure
        self.assertIn('certificate',d(URLError(ssl.SSLCertVerificationError('CERTIFICATE_VERIFY_FAILED')))[1])
        self.assertIn('DNS',d(URLError(socket.gaierror(8,'nodename nor servname')))[1])
        self.assertEqual(d(URLError(socket.timeout('timed out')))[0],504)
        self.assertIn('VPN',d(HTTPError('u',403,'Forbidden',{},None))[1])
        self.assertEqual(d(HTTPError('u',429,'Too Many',{},None))[0],429)
        self.assertIn('refused',d(URLError(ConnectionRefusedError()))[1])
    def test_port_fallback(self):
        a=server.bind(0);p=a.server_port;a.server_close()
        blocker=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);bp=blocker.server_port
        nxt=server.bind(bp,5);self.assertNotEqual(nxt.server_port,bp);self.assertTrue(bp<nxt.server_port<=bp+4);nxt.server_close();blocker.server_close()

if __name__=='__main__':unittest.main(verbosity=2)
