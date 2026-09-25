#!/usr/bin/env python3
"""Loopback-only launcher and allowlisted, credential-free Coinbase market proxy.

Routes (GET only, public data only, no keys, no account or order access):
  /coinbase-public/...   -> https://api.coinbase.com/api/v3/brokerage/...   (Advanced Trade public market data)
  /coinbase-exchange/... -> https://api.exchange.coinbase.com/...           (Coinbase Exchange public candles/stats/ticker)
  /health                -> live connectivity check of both upstreams, with a specific failure reason
"""
import argparse,json,os,re,socket,ssl,sys,threading,time,webbrowser
from datetime import datetime,timezone
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,parse_qs,urlencode
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import account as acct
# Upstream bases can be overridden only by environment variable, for offline tests against a fake Coinbase.
API=os.environ.get('FABLE_BROKERAGE_BASE','https://api.coinbase.com/api/v3/brokerage')
EXCHANGE=os.environ.get('FABLE_EXCHANGE_BASE','https://api.exchange.coinbase.com')
PRODUCT=r'[A-Z0-9]{1,15}-(?:USD|USDC|USDT|EUR|GBP|BTC|ETH)'
MAX_BODY=8*1024*1024
DAY=86400

def _ssl_context():
    """Default trust store, plus certifi when installed (fixes python.org macOS builds with no system CA bundle)."""
    ctx=ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except Exception:
        pass
    return ctx
SSL_CTX=_ssl_context()

class UpstreamError(Exception):
    def __init__(self,status,message):super().__init__(message);self.status=status

def _iso(value):
    s=value.strip()
    if s.endswith('Z'):s=s[:-1]+'+00:00'
    dt=datetime.fromisoformat(s)
    if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()

def _single(q):
    if any(len(v)!=1 for v in q.values()):raise ValueError('Duplicate query parameters are not permitted.')
    return {k:v[0] for k,v in q.items()}

def upstream_path(path):
    """Map an allowed local path to (base, route, cache_ttl_seconds). Raises ValueError for anything else."""
    parsed=urlsplit(path)
    if parsed.scheme or parsed.netloc or '..' in parsed.path:
        raise ValueError('Only the public market proxy is available.')
    if parsed.path.startswith('/coinbase-public/'):
        route=parsed.path[len('/coinbase-public'):];q=_single(parse_qs(parsed.query,keep_blank_values=True))
        if route=='/time' and not q:return API,route,1
        if route=='/market/products':
            if set(q)-{'product_type','limit','offset'}:raise ValueError('Unsupported market-list parameter.')
            if q.get('product_type','SPOT')!='SPOT':raise ValueError('Only spot products are supported.')
            limit=int(q.get('limit','100'));offset=int(q.get('offset','0'))
            if not 1<=limit<=100 or not 0<=offset<=1900:raise ValueError('Listing bounds exceeded.')
            return API,route+'?'+urlencode({'product_type':'SPOT','limit':limit,'offset':offset}),5
        if re.fullmatch(r'/market/products/'+PRODUCT,route):
            if q:raise ValueError('Unsupported product parameter.')
            return API,route,5
        if re.fullmatch(r'/market/products/'+PRODUCT+r'/candles',route):
            if set(q)!={'start','end','granularity','limit'}:raise ValueError('Incomplete candle request.')
            start=int(q['start']);end=int(q['end']);limit=int(q['limit'])
            if q['granularity']!='ONE_DAY' or start<0 or start%DAY or (end+1)%DAY or not 0<end-start<200*DAY or not 1<=limit<=200:
                raise ValueError('Only bounded daily candles are supported.')
            return API,route+'?'+urlencode({'start':start,'end':end,'granularity':'ONE_DAY','limit':limit}),30
        raise ValueError('Endpoint not allowed. No account or order access exists.')
    if parsed.path.startswith('/coinbase-exchange/'):
        route=parsed.path[len('/coinbase-exchange'):];q=_single(parse_qs(parsed.query,keep_blank_values=True))
        if re.fullmatch(r'/products/'+PRODUCT+r'/(?:stats|ticker)',route):
            if q:raise ValueError('Unsupported stats parameter.')
            return EXCHANGE,route,5
        if re.fullmatch(r'/products/'+PRODUCT+r'/candles',route):
            if set(q)!={'granularity','start','end'}:raise ValueError('Incomplete candle request.')
            gran=int(q['granularity'])
            if gran not in (3600,21600,86400):raise ValueError('Unsupported candle granularity.')
            try:start=_iso(q['start']);end=_iso(q['end'])
            except Exception:raise ValueError('Candle start/end must be ISO-8601 timestamps.')
            if start<0 or not 0<end-start<=300*gran:raise ValueError('Candle window exceeds 300 bars.')
            return EXCHANGE,route+'?'+urlencode({'granularity':gran,'start':q['start'],'end':q['end']}),30
        raise ValueError('Endpoint not allowed. No account or order access exists.')
    raise ValueError('Only the public market proxy is available.')

def describe_failure(exc):
    """Turn a transport failure into a specific, actionable message (never includes response bodies)."""
    if isinstance(exc,UpstreamError):return exc.status,str(exc)
    if isinstance(exc,HTTPError):
        if exc.code==429:return 429,'Coinbase rate limit (HTTP 429). Wait a few seconds and retry.'
        if exc.code==403:return 502,'Coinbase refused the request (HTTP 403). A VPN, proxy or unsupported region is the usual cause.'
        if exc.code==404:return 404,'Coinbase HTTP 404: product not listed.'
        return (exc.code if 400<=exc.code<600 else 502),'Coinbase HTTP '+str(exc.code)+'.'
    reason=getattr(exc,'reason',exc)
    if isinstance(reason,ssl.SSLCertVerificationError) or 'CERTIFICATE_VERIFY_FAILED' in str(reason):
        return 502,('SSL certificate check failed. On macOS run "Install Certificates.command" in your Python folder, '
                    'or run: python3 -m pip install certifi. A corporate proxy or antivirus HTTPS scanning can also cause this.')
    if isinstance(reason,(socket.timeout,TimeoutError)) or 'timed out' in str(reason):
        return 504,'Coinbase did not answer within 12 seconds. Check your internet connection and retry.'
    if isinstance(reason,socket.gaierror):
        return 502,'DNS lookup for Coinbase failed. You appear to be offline or DNS is blocked.'
    if isinstance(reason,ConnectionRefusedError) or isinstance(reason,ConnectionResetError):
        return 502,'Connection to Coinbase was refused or reset. A firewall, VPN or proxy may be blocking it.'
    return 502,'Coinbase public data is unavailable ('+type(reason).__name__+').'

_CACHE={};_CACHE_LOCK=threading.Lock()
def fetch_json(base,route,ttl=0):
    url=base+route
    now=time.monotonic()
    if ttl:
        with _CACHE_LOCK:
            hit=_CACHE.get(url)
            if hit and now-hit[0]<ttl:return hit[1]
    req=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; FableResearch/11; public market data)','Accept':'application/json'})
    with urlopen(req,timeout=12,context=SSL_CTX) as upstream:
        raw=upstream.read(MAX_BODY+1)
    if len(raw)>MAX_BODY:raise UpstreamError(502,'Coinbase response exceeded the size limit.')
    try:data=json.loads(raw)
    except ValueError:
        raise UpstreamError(502,'Coinbase answered with non-JSON content (usually a captive portal, VPN block page or network filter).')
    if ttl:
        with _CACHE_LOCK:
            _CACHE[url]=(now,data)
            if len(_CACHE)>500:_CACHE.clear()
    return data

_ACC_CACHE={};_ACC_LOCK=threading.Lock()
def cached(key,ttl,fn):
    now=time.monotonic()
    with _ACC_LOCK:
        hit=_ACC_CACHE.get(key)
        if hit and now-hit[0]<ttl:return hit[1]
    value=fn()
    with _ACC_LOCK:_ACC_CACHE[key]=(now,value)
    return value

def health_check():
    """One small request to each upstream. Returns a JSON-serialisable report."""
    checks=[]
    for name,base,route,probe in [
        ('Coinbase Advanced (daily scan)',API,'/market/products/BTC-USD',lambda d:float(d['price'])>0),
        ('Coinbase Exchange (candles, live stats)',EXCHANGE,'/products/BTC-USD/ticker',lambda d:float(d['price'])>0)]:
        t0=time.monotonic()
        try:
            data=fetch_json(base,route,0)
            if not probe(data):raise UpstreamError(502,'Unexpected response shape.')
            checks.append({'name':name,'ok':True,'ms':round((time.monotonic()-t0)*1000),'btcUsd':float(data['price'])})
        except Exception as e:
            status,msg=describe_failure(e) if not isinstance(e,(KeyError,TypeError,ValueError)) else (502,'Unexpected response shape from '+name+'.')
            checks.append({'name':name,'ok':False,'ms':round((time.monotonic()-t0)*1000),'error':msg})
    return {'checkedAt':datetime.now(timezone.utc).isoformat(),'ok':all(c['ok'] for c in checks),'checks':checks}

class Handler(BaseHTTPRequestHandler):
    def reply(self,status,body,content_type='application/json'):
        if isinstance(body,str):body=body.encode()
        self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
    def do_GET(self):
        hosts={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        if self.headers.get('Host') not in hosts:return self.reply(403,'{"error":"Loopback host only"}')
        origin=self.headers.get('Origin')
        if origin and origin not in {'http://'+h for h in hosts}:return self.reply(403,'{"error":"Cross-origin requests are not allowed"}')
        pages={'/':'START-HERE.html','/START-HERE.html':'START-HERE.html',
               '/edge-lab-v7.html':'edge-lab/edge-lab-v7.html',
               '/edge-lab/edge-lab-v7.html':'edge-lab/edge-lab-v7.html',
               '/edge-lab/strategy-lab.html':'edge-lab/strategy-lab.html'}
        page=pages.get(urlsplit(self.path).path)
        if page:
            return self.reply(200,(ROOT/page).read_bytes(),'text/html; charset=utf-8')
        if urlsplit(self.path).path=='/health':
            return self.reply(200,json.dumps(health_check()))
        if urlsplit(self.path).path.startswith('/account/'):
            return self.account_route()
        try:
            base,route,ttl=upstream_path(self.path)
        except ValueError as e:
            return self.reply(400,json.dumps({'error':str(e)}))
        try:
            self.reply(200,json.dumps(fetch_json(base,route,ttl)))
        except Exception as e:
            status,msg=describe_failure(e)
            self.reply(status,json.dumps({'error':msg}))
    def account_route(self):
        # Custom header forces a CORS preflight, so other websites cannot trigger account reads.
        if self.headers.get('X-Fable-Local')!='1':return self.reply(403,'{"error":"Account routes require the Fable page."}')
        parsed=urlsplit(self.path);q=parse_qs(parsed.query)
        try:
            key=acct.load_key()
            if parsed.path=='/account/status':
                if not key:return self.reply(200,json.dumps({'configured':False,'keyDir':'private/'}))
                cached(('perm',key['kid']),60,lambda:acct.Account(key,urlopen,SSL_CTX).permissions())
                return self.reply(200,json.dumps({'configured':True,'ok':True,'alg':key['alg'],'file':key['file']}))
            if not key:return self.reply(404,json.dumps({'error':'No key file in private/. See private/README.txt.'}))
            if parsed.path=='/account/snapshot':
                return self.reply(200,json.dumps(cached(('snap',key['kid']),15,lambda:acct.Account(key,urlopen,SSL_CTX).snapshot())))
            if parsed.path=='/account/fills':
                product=(q.get('product') or [''])[0]
                if set(q)-{'product'} or not re.fullmatch(PRODUCT,product):return self.reply(400,'{"error":"Unsupported fills request."}')
                return self.reply(200,json.dumps(cached(('fills',key['kid'],product),30,lambda:acct.Account(key,urlopen,SSL_CTX).fills(product))))
            return self.reply(404,'{"error":"Unknown account route."}')
        except acct.AccountError as e:
            return self.reply(e.status,json.dumps({'error':str(e)}))
        except Exception as e:
            status,msg=describe_failure(e);return self.reply(status,json.dumps({'error':msg}))
    def do_POST(self):self.reply(405,'{"error":"Read-only public market data. No orders or credentials."}')
    def log_message(self,fmt,*args):
        # Do not print upstream bodies or any credential material.
        sys.stderr.write('Fable local server: '+fmt%args+'\n')

def bind(preferred,tries=10):
    last=None
    for port in ([preferred] if preferred==0 else range(preferred,preferred+tries)):
        try:return ThreadingHTTPServer(('127.0.0.1',port),Handler)
        except OSError as e:last=e
    raise SystemExit('Could not open a local port near '+str(preferred)+': '+str(last)+'. Close the other Fable window and retry.')

def main():
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);p.add_argument('--no-browser',action='store_true');p.add_argument('--check',action='store_true',help='run the live connectivity check and exit');args=p.parse_args()
    if args.check:
        report=health_check()
        for c in report['checks']:print(('OK   ' if c['ok'] else 'FAIL ')+c['name']+(' · %d ms · BTC-USD %.2f'%(c['ms'],c['btcUsd']) if c['ok'] else ' · '+c['error']))
        sys.exit(0 if report['ok'] else 1)
    server=bind(args.port)
    address=f'http://127.0.0.1:{server.server_port}/'
    print('Fable 5k: '+address+' — leave this window open; Ctrl+C to stop.',flush=True)
    def startup_check():
        report=health_check()
        for c in report['checks']:print('Live data · '+('OK   ' if c['ok'] else 'FAIL ')+c['name']+(' (%d ms)'%c['ms'] if c['ok'] else ' — '+c['error']),flush=True)
        try:
            key=acct.load_key()
            if not key:print('Account   · not connected (optional: put a View-only key file in private/)',flush=True);return
            acct.Account(key,urlopen,SSL_CTX).permissions();print('Account   · OK   View-only key accepted ('+key['alg']+')',flush=True)
        except acct.AccountError as e:print('Account   · FAIL '+str(e),flush=True)
        except Exception as e:print('Account   · FAIL '+describe_failure(e)[1],flush=True)
    threading.Thread(target=startup_check,daemon=True).start()
    if not args.no_browser:threading.Timer(.4,lambda:webbrowser.open(address)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=='__main__':main()
