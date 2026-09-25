import importlib.util,threading,http.client,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('market_server',Path(__file__).parents[2]/'market-scan/server.py');server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)
class ServerTests(unittest.TestCase):
    def test_allowlist(self):
        self.assertIn('SPOT',server.upstream_path('/coinbase-public/market/products?limit=100&offset=0&product_type=SPOT')[1])
        self.assertIn('BTC-USD',server.upstream_path('/coinbase-public/market/products/BTC-USD/candles?start=1728000000&end=1728086399&granularity=ONE_DAY&limit=200')[1])
        for bad in ['/coinbase-public/accounts','/coinbase-public/orders','/coinbase-public/market/products?url=https://evil.test','/coinbase-public/market/products?limit=1000','/coinbase-public/market/products?limit=1&limit=2','/coinbase-public/market/products/BTC-USD/candles?start=0&end=100000000&granularity=ONE_DAY&limit=200','https://evil.test/coinbase-public/market/products']:
            with self.assertRaises(ValueError):server.upstream_path(bad)
    def test_loopback_http_and_no_credentials_or_orders(self):
        captured=[]
        class Upstream:
            def __enter__(self):return self
            def __exit__(self,*_):pass
            def read(self,_):return b'{"products": []}'
        def fake(req,timeout,**kw):captured.append(req);self.assertEqual(timeout,12);self.assertNotIn('Authorization',req.headers);self.assertEqual(req.get_method(),'GET');return Upstream()
        old=server.urlopen;server.urlopen=fake
        httpd=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start()
        def request(method,path,headers=None):
            conn=http.client.HTTPConnection('127.0.0.1',httpd.server_port,timeout=3);conn.request(method,path,headers=headers or {});response=conn.getresponse();body=response.read();status=response.status;conn.close();return status,body
        try:
            status,body=request('GET','/');self.assertEqual(status,200);self.assertIn(b'FABLE / 5K',body)
            for page in ['/START-HERE.html','/edge-lab/edge-lab-v7.html','/edge-lab/strategy-lab.html']:
                self.assertEqual(request('GET',page)[0],200)
            for page in ['/src/core.js','/../src/core.js','/market-scan/server.py']:
                self.assertEqual(request('GET',page)[0],400)
            self.assertEqual(request('GET','/coinbase-public/market/products?limit=100&offset=0&product_type=SPOT')[0],200);self.assertEqual(len(captured),1)
            self.assertEqual(request('GET','/coinbase-public/orders')[0],400)
            self.assertEqual(request('POST','/coinbase-public/orders')[0],405)
            self.assertEqual(request('GET','/',{'Origin':'https://unrelated.test'})[0],403)
            self.assertEqual(request('GET','/',{'Host':'unrelated.test'})[0],403)
            self.assertEqual(len(captured),1)
        finally:server.urlopen=old;httpd.shutdown();httpd.server_close()
if __name__=='__main__':unittest.main(verbosity=2)
