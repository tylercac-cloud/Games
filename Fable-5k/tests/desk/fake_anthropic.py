"""A fake Anthropic Messages API (streaming) for tests. Records every request; replies by script."""
import json,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
KEY='sk-ant-api03-TESTKEY-'+'x'*40
REQS=[]
def sse(events):return b''.join(b'event: '+e['type'].encode()+b'\ndata: '+json.dumps(e).encode()+b'\n\n' for e in events)
def text_reply(text,inp=1200,out=80):
    ev=[{'type':'message_start','message':{'id':'m','usage':{'input_tokens':inp,'output_tokens':1}}},{'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}}]
    for i in range(0,len(text),12):ev.append({'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':text[i:i+12]}})
    return ev+[{'type':'content_block_stop','index':0},{'type':'message_delta','delta':{'stop_reason':'end_turn'},'usage':{'output_tokens':out}},{'type':'message_stop'}]
def tool_reply(name,inp_obj,pre='Let me look.'):
    j=json.dumps(inp_obj)
    return [{'type':'message_start','message':{'id':'m','usage':{'input_tokens':1500,'output_tokens':1}}},
            {'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}},{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':pre}},{'type':'content_block_stop','index':0},
            {'type':'content_block_start','index':1,'content_block':{'type':'tool_use','id':'tu_1','name':name,'input':{}}},
            {'type':'content_block_delta','index':1,'delta':{'type':'input_json_delta','partial_json':j[:len(j)//2]}},{'type':'content_block_delta','index':1,'delta':{'type':'input_json_delta','partial_json':j[len(j)//2:]}},
            {'type':'content_block_stop','index':1},{'type':'message_delta','delta':{'stop_reason':'tool_use'},'usage':{'output_tokens':40}},{'type':'message_stop'}]
MODE={'status':200}
class H(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));REQS.append({'headers':dict(self.headers),'body':body})
        if self.path!='/v1/messages' or self.headers.get('x-api-key')!=KEY or self.headers.get('anthropic-version')!='2023-06-01':
            b=b'{"type":"error","error":{"type":"authentication_error"}}';self.send_response(401);self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
        if MODE['status']!=200:
            b=b'{}';self.send_response(MODE['status']);self.send_header('Content-Length','2');self.end_headers();self.wfile.write(b);return
        last=body['messages'][-1];content=last['content']
        if isinstance(content,list):   # tool results came back
            res=[c for c in content if c.get('type')=='tool_result'];ev=text_reply('Done. '+('(tool said: '+str(res[0].get('content'))[:200]+')' if res else ''))
        else:
            q=content.lower()
            if 'go to journal' in q:ev=tool_reply('go_to_tab',{'tab':'jrn'})
            elif 'how am i doing' in q:ev=tool_reply('read_journal',{'limit':10})
            elif 'read the screen' in q:ev=tool_reply('read_screen',{'tab':'control'})
            elif 'my account' in q:ev=tool_reply('read_account',{})
            elif 'market' in q:ev=tool_reply('read_market',{'product':'BTC-USD'})
            elif 'point' in q:ev=tool_reply('point_at',{'element':'rStop'})
            elif 'xss' in q:ev=text_reply('Here: <img src=x onerror="window.__pwned=1"> and <script>window.__pwned=2</script> **bold**')
            else:ev=text_reply('Your plan is **within limits**. Budget $25.00.')
        b=sse(ev);self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
def start():
    s=ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=s.serve_forever,daemon=True).start();return s,f'http://127.0.0.1:{s.server_port}'
