"""A second double-click must reuse the running launcher (same address, same saved data);
a foreign program on the port triggers a loud warning instead of a silent new address."""
import subprocess,sys,time,socket,threading,unittest
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).parents[2];SERVER=str(ROOT/'market-scan/server.py')
def free_port():
    s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
def run(port,wait_for,timeout=10):
    p=subprocess.Popen([sys.executable,'-u',SERVER,'--no-browser','--port',str(port)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,env={'FABLE_EXCHANGE_BASE':'http://127.0.0.1:9','FABLE_BROKERAGE_BASE':'http://127.0.0.1:9','FABLE_KEY_DIR':'/nonexistent','PATH':'/usr/bin:/bin'})
    out=[];t=threading.Thread(target=lambda:[out.append(l) for l in p.stdout],daemon=True);t.start();t0=time.time()
    while time.time()-t0<timeout and not any(wait_for in l for l in out) and p.poll() is None:time.sleep(.05)
    time.sleep(.3);return p,''.join(out)
class SecondLaunch(unittest.TestCase):
    def test_reuses_running_fable(self):
        port=free_port();first,out1=run(port,'Fable 5k: ')
        try:
            self.assertIn(f'127.0.0.1:{port}/',out1)
            second,out2=run(port,'already running');second.wait(5)
            self.assertIn(f'Fable is already running at http://127.0.0.1:{port}/',out2);self.assertEqual(second.returncode,0);self.assertNotIn(f':{port+1}/',out2)
        finally:first.terminate();first.wait(5)
    def test_foreign_program_on_port_warns(self):
        class H(BaseHTTPRequestHandler):
            def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'someone else')
            def log_message(self,*a):pass
        other=ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=other.serve_forever,daemon=True).start();port=other.server_port
        p,out=run(port,'Fable 5k: ')
        try:
            self.assertIn('WARNING: port '+str(port)+' is used by another program',out);self.assertIn('look EMPTY',out);self.assertIn(f'127.0.0.1:{port+1}/',out)
        finally:p.terminate();p.wait(5);other.shutdown()
if __name__=='__main__':unittest.main(verbosity=2)
