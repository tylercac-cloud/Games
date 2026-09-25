"""A fake Ollama server (native /api/tags, /api/chat streaming NDJSON, /api/pull) for tests."""
import json,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
STATE={'installed':['qwen3:8b'],'reqs':[]}
SHOW={'qwen3:8b':{'capabilities':['completion','tools','thinking'],'thinking':{'values':[False,True],'default':True}},
      'qwen3:4b':{'capabilities':['completion','tools','thinking'],'thinking':{'values':[True],'default':True}},
      'qwen3:4b-instruct':{'capabilities':['tools','thinking','completion']},'llama3.1:8b':{'capabilities':['completion','tools']}}
class H(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.0'
    def log_message(self,*a):pass
    def lines(self,objs,delay=0):
        self.send_response(200);self.send_header('Content-Type','application/x-ndjson');self.end_headers()
        for o in objs:self.wfile.write((json.dumps(o)+'\n').encode());self.wfile.flush();time.sleep(delay)
    def do_GET(self):
        if self.path=='/api/tags':b=json.dumps({'models':[{'name':m,'model':m} for m in STATE['installed']]}).encode();self.send_response(200);self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
        else:self.send_response(404);self.end_headers()
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));STATE['reqs'].append((self.path,body))
        if self.path=='/api/show':   # as Ollama 0.34 reports them
            info=SHOW.get(body.get('model'),{'capabilities':['completion']});b=json.dumps(info).encode()
            self.send_response(200);self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
        if SHOW.get(body.get('model'),{}).get('thinking',{}).get('values')==[True]:   # always-thinking model (real qwen3:4b)
            REASON='Okay, let me think about the plan. Wait, check the stop first. '
            if body.get('think') is True:self.lines([{'message':{'role':'assistant','content':'','thinking':REASON},'done':False},{'message':{'role':'assistant','content':'Plan checked (thinking model).'},'done':False},{'message':{'role':'assistant','content':''},'done':True,'eval_count':30}])
            else:self.lines([{'message':{'role':'assistant','content':REASON+'Plan checked (thinking model).'},'done':False},{'message':{'role':'assistant','content':''},'done':True,'eval_count':30}])   # think:false leaks it
            return
        if self.path=='/api/pull':
            # Shape of a real Ollama 0.34 pull: each layer's first line has a total but no "completed"; small layers follow.
            tot=2_600_000_000;L='pulling 3e4cb1417446';self.lines([{'status':'pulling manifest'},{'status':L,'digest':'sha256:3e4c','total':tot}]
                +[{'status':L,'digest':'sha256:3e4c','total':tot,'completed':int(tot*k/4)} for k in range(1,5)]
                +[{'status':'pulling ae370d884f10','digest':'sha256:ae37','total':1660},{'status':'pulling ae370d884f10','digest':'sha256:ae37','total':1660,'completed':1660},
                  {'status':'verifying sha256 digest'},{'status':'writing manifest'},{'status':'success'}],0.05)
            STATE['installed'].append(body['model']);return
        last=body['messages'][-1]
        if last['role']=='tool':
            self.lines([{'message':{'role':'assistant','content':'Done locally '},'done':False},{'message':{'role':'assistant','content':'(tool said: '+last['content'][:80]+')'},'done':False},{'message':{'role':'assistant','content':''},'done':True,'eval_count':42}]);return
        q=last['content'].lower()
        if 'go to journal' in q:
            self.lines([{'message':{'role':'assistant','content':'','tool_calls':[{'function':{'name':'go_to_tab','arguments':{'tab':'jrn'}}}]},'done':False},{'message':{'role':'assistant','content':''},'done':True,'eval_count':12}]);return
        self.lines([{'message':{'role':'assistant','content':w},'done':False} for w in ['Your ','plan ','is ','**within limits**',' (local).']]+[{'message':{'role':'assistant','content':''},'done':True,'eval_count':9}])
def start():
    s=ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=s.serve_forever,daemon=True).start();return s,f'http://127.0.0.1:{s.server_port}'
