"""Crypta, the Fable 5k helper: launcher side.

- The Anthropic API key lives in private/ (any file containing an `sk-ant-` key) and is read only here.
  The page never receives it; every request is built and sent by this process.
- The system prompt, tools and model list are fixed here, so the page can't widen what Crypta does.
- A monthly spending cap (default $5) is enforced here from the token usage Anthropic reports;
  usage is kept in private/crypta-usage.json. Prices are list prices per million tokens and approximate.
"""
import json,os,re,threading,time
from pathlib import Path
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
KEY_DIR=Path(os.environ.get('FABLE_KEY_DIR',str(ROOT/'private')))
ANTHROPIC_BASE=os.environ.get('FABLE_ANTHROPIC_BASE','https://api.anthropic.com')
KEY_RE=re.compile(r'sk-ant-[A-Za-z0-9_\-]{20,}')
MODELS={   # id: (label, input $/MTok, output $/MTok) — list prices, September 2026; check console.anthropic.com
    'claude-haiku-4-5-20251001':('Claude Haiku 4.5 (fast, cheapest)',1.0,5.0),
    'claude-sonnet-5':('Claude Sonnet 5 (smarter)',2.0,10.0),
}
DEFAULT_MODEL='claude-sonnet-5'   # better answers; Haiku 4.5 stays selectable at half the price
GUIDE_FILE=ROOT/'src'/'crypta'/'guide.md'
CACHE_WRITE=1.25;CACHE_READ=0.10   # prompt-caching multipliers on the input price
DEFAULT_CAP=5.0
MAX_BODY=256*1024
# Free option: a local model through Ollama (ollama.com) on this PC. No key, no bill, nothing leaves the machine.
OLLAMA_BASE=os.environ.get('FABLE_OLLAMA_BASE','http://127.0.0.1:11434')
LOCAL_RECOMMENDED=[('qwen3:8b','Qwen3 8B · best local choice · ~5 GB download · needs 16 GB RAM'),('qwen3:4b','Qwen3 4B · lighter · ~2.5 GB download · 8 GB RAM'),('llama3.1:8b','Llama 3.1 8B · alternative · ~5 GB download')]
THINKING_FAMILIES=('qwen3','deepseek-r1','gpt-oss')   # models that accept "think": false (faster answers)
LOCAL_CTX=16384
_LOCK=threading.Lock()

class CryptaError(Exception):
    def __init__(self,status,message):super().__init__(message);self.status=status

def looks_like_anthropic_key_file(path):
    try:
        if path.stat().st_size>4096:return False
        return bool(KEY_RE.search(path.read_text(encoding='utf-8-sig',errors='ignore')))
    except Exception:return False
def load_key():
    if not KEY_DIR.is_dir():return None
    for p in sorted(KEY_DIR.iterdir()):
        if p.is_file() and looks_like_anthropic_key_file(p):
            return KEY_RE.search(p.read_text(encoding='utf-8-sig',errors='ignore')).group(0)
    return None

# ---------------------------------------------------------------- usage and cap
USAGE_FILE=KEY_DIR/'crypta-usage.json'
def _month():return time.strftime('%Y-%m',time.gmtime())
def read_usage():
    try:u=json.loads(USAGE_FILE.read_text())
    except Exception:u={}
    if not isinstance(u,dict):u={}
    u.setdefault('capUSD',DEFAULT_CAP);u.setdefault('months',{})
    m=u['months'].setdefault(_month(),{'inputTokens':0,'outputTokens':0,'costUSD':0.0,'requests':0})
    return u,m
def write_usage(u):
    KEY_DIR.mkdir(exist_ok=True);tmp=USAGE_FILE.with_suffix('.tmp');tmp.write_text(json.dumps(u,indent=1));tmp.replace(USAGE_FILE)
def cost(model,inp,out,cache_write=0,cache_read=0):
    _,pi,po=MODELS[model]
    return inp*pi/1e6+cache_write*pi*CACHE_WRITE/1e6+cache_read*pi*CACHE_READ/1e6+out*po/1e6
def record(model,inp,out,cache_write=0,cache_read=0):
    with _LOCK:
        u,m=read_usage()
        m['inputTokens']+=inp+cache_write+cache_read;m['outputTokens']+=out;m['requests']+=1
        m['costUSD']=round(m['costUSD']+cost(model,inp,out,cache_write,cache_read),6);write_usage(u)
def set_cap(cap):
    if not isinstance(cap,(int,float)) or not 0<=cap<=500:raise CryptaError(400,'Cap must be between $0 and $500 a month.')
    with _LOCK:u,_=read_usage();u['capUSD']=round(float(cap),2);write_usage(u)
def ollama_models(opener=urlopen):
    try:
        with opener(Request(OLLAMA_BASE+'/api/tags'),timeout=1.5) as r:data=json.loads(r.read(1_000_000))
        return True,sorted({m.get('name') or m.get('model') for m in data.get('models') or [] if (m.get('name') or m.get('model'))})
    except Exception:return False,[]
def status():
    u,m=read_usage();running,installed=ollama_models()
    return {'configured':bool(load_key()),'models':{k:v[0] for k,v in MODELS.items()},'defaultModel':DEFAULT_MODEL,
            'capUSD':u['capUSD'],'month':_month(),'spentUSD':round(m['costUSD'],4),'requests':m['requests'],
            'prices':{k:{'inPerMTok':v[1],'outPerMTok':v[2]} for k,v in MODELS.items()},
            # a typical question: ~6k cached prompt read + 2k fresh input + 400 output, one tool round → two calls
            'perQuestionUSD':{k:round(2*cost(k,2000,400,0,6000),4) for k in MODELS},
            'local':{'running':running,'installed':installed,'recommended':[{'model':k,'label':v} for k,v in LOCAL_RECOMMENDED]}}

# ---------------------------------------------------------------- prompt and tools
SYSTEM="""You are Crypta, the helper built into Fable 5k: a local research and discipline app for a $5,000 crypto experiment on Coinbase. The person talking to you runs the experiment. Help them use the app and understand their own numbers.

How you work:
- APP STATE below is a snapshot of the open page. For anything it doesn't show, use your read tools first (read_screen for any tab, read_journal, read_register, read_account, read_scan, read_market) instead of guessing or telling the user to look. Reading is cheap and never changes anything.
- Use the user's real numbers. When you calculate, show each step with the numbers.
- APP GUIDE is the reference for how every feature works. If neither the guide nor what you read covers something, say so plainly.
- To help them act, you can switch tabs (go_to_tab), highlight a field or button (point_at), refresh Capital plan, or open the trades waiting to be logged. Say what you did.

Style: lead with the answer, keep it short, plain words, no filler. Use a small table or list when comparing several numbers. Match the user's level; don't lecture.

Limits you always keep:
- No price predictions and no buy/sell/hold calls on a specific coin. You can explain what the app's plan, stages and rules say; the decision is theirs.
- Never help work around the loss limits, cooling-off, position caps or study locks; explain why they exist instead.
- You cannot place orders, move money or see API keys. If a message contains something that looks like a key or secret, don't repeat it; tell them to delete that key where it was created, make a new one, and keep keys only as files in the private folder.
- Taxes: general mechanics only; point to their CPA. You are not a financial or tax advisor.
- If asked: you are an AI (Anthropic's Claude) running as Crypta, paid for by the user's Anthropic API key."""

TABS={'scan':'Daily scan','research':'Research','control':'Capital plan','exec':'Execution','bud':'Budget','lab':'Test','siz':'Sizing','hyp':'Register','jrn':'Journal','doc':'Method'}
def tools():
    return [
        {'name':'go_to_tab','description':'Switch the open Fable tool to a tab. Tabs: '+', '.join(f'{k} = {v}' for k,v in TABS.items())+'.',
         'input_schema':{'type':'object','properties':{'tab':{'type':'string','enum':list(TABS)}},'required':['tab']}},
        {'name':'point_at','description':'Scroll to and highlight one field or button on the open page, by its element id from APP STATE "fields" (for example rStop, rOpen, autoFill, importFills, taxCsv, scanMarkets).',
         'input_schema':{'type':'object','properties':{'element':{'type':'string','pattern':'^[A-Za-z][A-Za-z0-9]{1,30}$'}},'required':['element']}},
        {'name':'refresh_capital_plan','description':'Open Capital plan and re-read live prices and the account, then recalculate. Returns the new plan summary.',
         'input_schema':{'type':'object','properties':{}}},
        {'name':'open_trades_to_log','description':'Open the Journal and list closed Coinbase round trips that still need logging. Returns how many.',
         'input_schema':{'type':'object','properties':{}}},
        {'name':'read_screen','description':'Read everything shown on a tab of the open tool (text, tables, and every input as "label: value"). Omit tab for the current one.',
         'input_schema':{'type':'object','properties':{'tab':{'type':'string','enum':list(TABS)}}}},
        {'name':'read_journal','description':'Read logged trades (size, entry, exit, fees, P&L, slippage, whether the plan was followed, notes) with totals and the cooling-off state.',
         'input_schema':{'type':'object','properties':{'limit':{'type':'integer','minimum':1,'maximum':200}}}},
        {'name':'read_register','description':'Read the research register: tested rules, parameters, configurations spent, results and the trial budget.',
         'input_schema':{'type':'object','properties':{'limit':{'type':'integer','minimum':1,'maximum':100}}}},
        {'name':'read_account','description':'Read the Coinbase account snapshot (equity, cash, positions, stop orders, fee tier), net deposits, high-water mark, the daily equity log and recent Capital plans.',
         'input_schema':{'type':'object','properties':{}}},
        {'name':'read_scan','description':'Read the latest daily scan: per-coin results for the locked hypotheses and the top markets.',
         'input_schema':{'type':'object','properties':{}}},
        {'name':'read_market','description':'Read live public Coinbase data for one pair: bid, ask, last, 24h open/high/low/volume and the last 30 completed daily candles summary. Context only.',
         'input_schema':{'type':'object','properties':{'product':{'type':'string','pattern':'^[A-Z0-9]{1,15}-(USD|USDC)$'}},'required':['product']}},
    ]

def build_request(body):
    """Validate the page's request and build the Anthropic one. The page supplies only the conversation,
    its app-state snapshot and the guide excerpts; everything else is fixed here."""
    if not isinstance(body,dict):raise CryptaError(400,'Bad request.')
    model=body.get('model') or DEFAULT_MODEL
    if model not in MODELS:raise CryptaError(400,'Unknown model.')
    msgs=body.get('messages')
    if not isinstance(msgs,list) or not 1<=len(msgs)<=60:raise CryptaError(400,'Conversation must have 1-60 messages.')
    for m in msgs:
        if not isinstance(m,dict) or m.get('role') not in ('user','assistant') or not isinstance(m.get('content'),(str,list)):raise CryptaError(400,'Bad message.')
    if msgs[0]['role']!='user':raise CryptaError(400,'Conversation must start with the user.')
    state=body.get('state') if isinstance(body.get('state'),dict) else None
    try:guide=GUIDE_FILE.read_text(encoding='utf-8')
    except Exception:guide='(guide unavailable)'
    # The stable part (instructions + the whole guide) is cached by Anthropic, so follow-up questions pay ~10% for it.
    system=[{'type':'text','text':SYSTEM+'\n\nAPP GUIDE:\n'+guide,'cache_control':{'type':'ephemeral'}},
            {'type':'text','text':'APP STATE (read from the page just now; the user chose '+('to share it' if state else 'not to share numbers — ask before relying on specifics')+'):\n'+(json.dumps(state)[:12000] if state else 'not shared')}]
    return model,{'model':model,'max_tokens':1500,'system':system,'messages':msgs,'tools':tools(),'stream':True}

def check_cap():
    u,m=read_usage()
    if m['costUSD']>=u['capUSD']:raise CryptaError(402,f"Crypta's monthly cap of ${u['capUSD']:.2f} is used up (${m['costUSD']:.2f} spent in {_month()}). Raise it in Crypta's settings or wait for next month.")

def stream(body,write,opener=urlopen):
    """Call Anthropic with streaming and pass each server-sent event to `write`. Records usage at the end."""
    key=load_key()
    if not key:raise CryptaError(404,'No Anthropic API key in private/. Crypta is answering from her built-in guide.')
    check_cap()
    model,payload=build_request(body)
    req=Request(ANTHROPIC_BASE+'/v1/messages',data=json.dumps(payload).encode(),method='POST',headers={
        'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json','accept':'text/event-stream'})
    try:resp=opener(req,timeout=60)
    except Exception as e:
        code=getattr(e,'code',None)
        msg={401:'Anthropic rejected the API key (HTTP 401). Check the key file in private/ or create a new key.',
             403:'Anthropic refused the request (HTTP 403). The key may lack permission for this model.',
             429:'Anthropic rate limit or credit limit reached (HTTP 429). Check billing at console.anthropic.com.',
             529:'Anthropic is overloaded right now (HTTP 529). Try again in a minute.'}.get(code)
        raise CryptaError(code if code in (401,403,429) else 502,msg or ('Could not reach Anthropic ('+(str(code) if code else type(e).__name__)+').'))
    inp=out=cw=cr=0
    try:
        with resp:
            while True:
                line=resp.readline()
                if not line:break
                if line.startswith(b'data:'):
                    try:
                        ev=json.loads(line[5:].strip() or b'{}')
                        if ev.get('type')=='message_start':
                            us=((ev.get('message') or {}).get('usage') or {});inp=us.get('input_tokens',0) or 0
                            cw=us.get('cache_creation_input_tokens',0) or 0;cr=us.get('cache_read_input_tokens',0) or 0
                        elif ev.get('type')=='message_delta':out=((ev.get('usage') or {}).get('output_tokens',out)) or out
                    except ValueError:pass
                write(line)
    finally:
        if inp or out or cw or cr:record(model,int(inp),int(out),int(cw),int(cr))


# ---------------------------------------------------------------- local model (Ollama)
def _sse(ev):return b'event: '+ev['type'].encode()+b'\ndata: '+json.dumps(ev).encode()+b'\n\n'
def to_ollama_messages(msgs):
    """Anthropic-style turns -> Ollama chat turns (tool calls and tool results included)."""
    out=[];names={}
    for m in msgs:
        c=m['content']
        if isinstance(c,str):out.append({'role':m['role'],'content':c});continue
        if m['role']=='assistant':
            text=''.join(b.get('text','') for b in c if b.get('type')=='text');calls=[]
            for b in c:
                if b.get('type')=='tool_use':names[b.get('id')]=b.get('name');calls.append({'type':'function','function':{'name':b.get('name'),'arguments':b.get('input') or {}}})
            out.append({'role':'assistant','content':text,**({'tool_calls':calls} if calls else {})})
        else:
            for b in c:
                if b.get('type')=='tool_result':out.append({'role':'tool','tool_name':names.get(b.get('tool_use_id'),''),'content':str(b.get('content',''))})
                elif b.get('type')=='text':out.append({'role':'user','content':b.get('text','')})
    return out
def local_request(body):
    model=body.get('model')
    running,installed=ollama_models()
    if not running:raise CryptaError(503,'Ollama is not running. Start the Ollama app (or install it from ollama.com), then ask again.')
    if model not in installed:raise CryptaError(404,'The local model '+str(model)+' is not installed. Download it from Crypta\'s settings.')
    _,payload=build_request({**body,'model':DEFAULT_MODEL})   # same validation, same instructions, guide and state
    system='\n\n'.join(b['text'] for b in payload['system'])
    req={'model':model,'stream':True,'messages':[{'role':'system','content':system}]+to_ollama_messages(payload['messages']),
         'tools':[{'type':'function','function':{'name':t['name'],'description':t['description'],'parameters':t['input_schema']}} for t in payload['tools']],
         'options':{'num_ctx':LOCAL_CTX,'temperature':0.3}}
    if model.split(':')[0].startswith(THINKING_FAMILIES):req['think']=False
    return model,req
def stream_local(body,write,opener=urlopen):
    model,req=local_request(body)
    try:resp=opener(Request(OLLAMA_BASE+'/api/chat',data=json.dumps(req).encode(),method='POST',headers={'content-type':'application/json'}),timeout=300)
    except Exception as e:
        raise CryptaError(502,'Ollama could not answer ('+(str(getattr(e,'code','')) or type(e).__name__)+'). Is the model still downloading, or is the PC short on memory?')
    write(_sse({'type':'message_start','message':{'id':'local','model':model,'usage':{'input_tokens':0,'output_tokens':0}}}))
    text_open=False;n=0;calls=0
    with resp:
        for raw in resp:
            raw=raw.strip()
            if not raw:continue
            try:ev=json.loads(raw)
            except ValueError:continue
            if ev.get('error'):raise CryptaError(502,'Ollama: '+str(ev['error'])[:200])
            msg=ev.get('message') or {}
            if msg.get('content'):
                if not text_open:write(_sse({'type':'content_block_start','index':n,'content_block':{'type':'text','text':''}}));text_open=True
                write(_sse({'type':'content_block_delta','index':n,'delta':{'type':'text_delta','text':msg['content']}}))
            for call in msg.get('tool_calls') or []:
                if text_open:write(_sse({'type':'content_block_stop','index':n}));text_open=False;n+=1
                fn=call.get('function') or {};args=fn.get('arguments') or {}
                if isinstance(args,str):
                    try:args=json.loads(args)
                    except ValueError:args={}
                calls+=1;write(_sse({'type':'content_block_start','index':n,'content_block':{'type':'tool_use','id':'local_%d_%d'%(int(time.time()*1000),calls),'name':fn.get('name'),'input':{}}}))
                write(_sse({'type':'content_block_delta','index':n,'delta':{'type':'input_json_delta','partial_json':json.dumps(args)}}));write(_sse({'type':'content_block_stop','index':n}));n+=1
            if ev.get('done'):
                if text_open:write(_sse({'type':'content_block_stop','index':n}))
                write(_sse({'type':'message_delta','delta':{'stop_reason':'tool_use' if calls else 'end_turn'},'usage':{'output_tokens':ev.get('eval_count',0)}}));write(_sse({'type':'message_stop'}))
                return
    raise CryptaError(502,'Ollama stopped mid-answer.')
def pull_local(body,write,opener=urlopen):
    """Download one of the recommended local models through Ollama, streaming progress lines to the page."""
    model=body.get('model') if isinstance(body,dict) else None
    if model not in dict(LOCAL_RECOMMENDED):raise CryptaError(400,'Pick one of the recommended models.')
    if not ollama_models()[0]:raise CryptaError(503,'Ollama is not running. Install it from ollama.com and start it, then try again.')
    resp=opener(Request(OLLAMA_BASE+'/api/pull',data=json.dumps({'model':model,'stream':True}).encode(),method='POST',headers={'content-type':'application/json'}),timeout=3600)
    with resp:
        for raw in resp:
            raw=raw.strip()
            if raw:write(raw+b'\n')
