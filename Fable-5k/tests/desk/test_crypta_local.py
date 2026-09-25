"""Crypta's free local brain (Ollama): detection, request translation, stream conversion, tool round trip, model download."""
import http.client,json,os,sys,tempfile,threading,unittest
from pathlib import Path
KEYDIR=tempfile.mkdtemp();os.environ['FABLE_KEY_DIR']=KEYDIR
sys.path.insert(0,str(Path(__file__).parent));import fake_ollama as FO
fo,FOU=FO.start();os.environ['FABLE_OLLAMA_BASE']=FOU
ROOT=Path(__file__).parents[2];sys.path.insert(0,str(ROOT/'market-scan'))
import importlib.util
spec=importlib.util.spec_from_file_location('crypta_local_server',ROOT/'market-scan/server.py');server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)
class Local(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.h=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=cls.h.serve_forever,daemon=True).start();cls.port=cls.h.server_port
    @classmethod
    def tearDownClass(cls):cls.h.shutdown();cls.h.server_close()
    def setUp(self):FO.STATE['reqs'].clear();FO.STATE['installed']=['qwen3:8b'];server.crypta.OLLAMA_BASE=FOU
    def post(self,path,body):
        data=json.dumps(body).encode();c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=20)
        c.request('POST',path,body=data,headers={'Host':f'127.0.0.1:{self.port}','Content-Type':'application/json','X-Fable-Local':'1','Content-Length':str(len(data))});r=c.getresponse();b=r.read().decode();c.close();return r.status,b
    def events(self,b):return [json.loads(l[5:]) for l in b.splitlines() if l.startswith('data:')]
    def test_status_detects_ollama(self):
        st=server.crypta.status();self.assertTrue(st['local']['running']);self.assertEqual(st['local']['installed'],['qwen3:8b']);self.assertFalse(st['configured'])
        server.crypta.OLLAMA_BASE='http://127.0.0.1:9';self.assertFalse(server.crypta.status()['local']['running'])
    def test_answer_streams_in_claude_format(self):
        s,b=self.post('/crypta/chat',{'provider':'local','model':'qwen3:8b','messages':[{'role':'user','content':'how is my plan'}],'state':{'plan':{'stage':'WITHIN_LIMITS'}}})
        self.assertEqual(s,200,b);ev=self.events(b);txt=''.join(e['delta']['text'] for e in ev if e['type']=='content_block_delta' and e['delta']['type']=='text_delta')
        self.assertEqual(txt,'Your plan is **within limits** (local).');self.assertEqual([e for e in ev if e['type']=='message_delta'][0]['delta']['stop_reason'],'end_turn')
        path,req=FO.STATE['reqs'][-1];self.assertEqual(path,'/api/chat');self.assertEqual(req['model'],'qwen3:8b');self.assertTrue(req['stream']);self.assertIs(req['think'],False)
        self.assertEqual(req['options']['num_ctx'],16384);self.assertEqual(req['messages'][0]['role'],'system')
        self.assertIn('No price predictions',req['messages'][0]['content']);self.assertIn('## Connecting Coinbase',req['messages'][0]['content']);self.assertIn('WITHIN_LIMITS',req['messages'][0]['content'])
        self.assertEqual({t['function']['name'] for t in req['tools']},{t['name'] for t in server.crypta.tools()});self.assertEqual(req['tools'][0]['type'],'function')
    def test_tool_round_trip(self):
        s,b=self.post('/crypta/chat',{'provider':'local','model':'qwen3:8b','messages':[{'role':'user','content':'go to journal'}]})
        ev=self.events(b);tu=[e for e in ev if e['type']=='content_block_start' and e['content_block']['type']=='tool_use'][0]['content_block']
        args=json.loads(''.join(e['delta']['partial_json'] for e in ev if e['type']=='content_block_delta' and e['delta']['type']=='input_json_delta'))
        self.assertEqual((tu['name'],args),('go_to_tab',{'tab':'jrn'}));self.assertEqual([e for e in ev if e['type']=='message_delta'][0]['delta']['stop_reason'],'tool_use')
        s,b=self.post('/crypta/chat',{'provider':'local','model':'qwen3:8b','messages':[{'role':'user','content':'go to journal'},
            {'role':'assistant','content':[{'type':'tool_use','id':tu['id'],'name':'go_to_tab','input':args}]},{'role':'user','content':[{'type':'tool_result','tool_use_id':tu['id'],'content':'Opened the Journal tab.'}]}]})
        msgs=FO.STATE['reqs'][-1][1]['messages'];self.assertEqual(msgs[-2]['tool_calls'][0]['function'],{'name':'go_to_tab','arguments':{'tab':'jrn'}})
        self.assertEqual(msgs[-1],{'role':'tool','tool_name':'go_to_tab','content':'Opened the Journal tab.'});self.assertIn('Done locally',b)
    def test_errors_explained(self):
        s,b=self.post('/crypta/chat',{'provider':'local','model':'llama3.1:8b','messages':[{'role':'user','content':'x'}]});self.assertEqual(s,404);self.assertIn('not installed',b)
        server.crypta.OLLAMA_BASE='http://127.0.0.1:9';s,b=self.post('/crypta/chat',{'provider':'local','model':'qwen3:8b','messages':[{'role':'user','content':'x'}]});self.assertEqual(s,503);self.assertIn('Ollama is not running',b)
        server.crypta.OLLAMA_BASE=FOU;s,b=self.post('/crypta/chat',{'provider':'local','model':'qwen3:8b','messages':[{'role':'assistant','content':'x'}]});self.assertEqual(s,400)
    def test_download_recommended_model_only(self):
        s,b=self.post('/crypta/local/pull',{'model':'qwen3:4b'});self.assertEqual(s,200);lines=[json.loads(l) for l in b.splitlines() if l.strip()]
        self.assertEqual(lines[-1]['status'],'success');self.assertEqual(lines[3]['completed'],1_300_000_000);self.assertIn('qwen3:4b',FO.STATE['installed'])
        self.assertEqual(self.post('/crypta/local/pull',{'model':'some/random-model'})[0],400)
    def test_local_is_free_no_usage_recorded(self):
        u=Path(KEYDIR,'crypta-usage.json');before=u.read_text() if u.exists() else None
        self.post('/crypta/chat',{'provider':'local','model':'qwen3:8b','messages':[{'role':'user','content':'hi'}]})
        self.assertEqual(u.read_text() if u.exists() else None,before)
if __name__=='__main__':unittest.main(verbosity=2)
