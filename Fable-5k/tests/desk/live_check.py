"""LIVE check against the real Coinbase public API (no key, no account, no trading).
Runs the real launcher with its default upstreams and checks, through it:
  A. every public route the pages use: response fields the code reads, sane values, Exchange vs Advanced agreement,
     and the Advanced fallback the launcher uses when api.exchange.coinbase.com is blocked;
  B. the real pages in Chromium: live strip, daily scan, Fetch for every listed pair, Capital plan fill without a key.
Needs internet. `python tests/desk/live_check.py --sim` runs the same checks against the local simulator (self-test).
Writes tests/artifacts/live-check.json. Uses no key: FABLE_KEY_DIR points at an empty temp folder."""
import json,os,subprocess,sys,tempfile,threading,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,build_opener,ProxyHandler
ROOT=Path(__file__).parents[2];SIM='--sim' in sys.argv;DAY=86400
env={**os.environ,'FABLE_KEY_DIR':tempfile.mkdtemp()}
for k in ('FABLE_BROKERAGE_BASE','FABLE_EXCHANGE_BASE','FABLE_ACCOUNT_BASE','ANTHROPIC_API_KEY'):env.pop(k,None)
PAIRS=['BTC-USD','ETH-USD','SOL-USD','LTC-USD','LINK-USD','AVAX-USD','DOGE-USD','ADA-USD']   # the desk/lab Fetch list
if SIM:
    sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase
    from cryptography.hazmat.primitives.asymmetric import ec
    sim,srv,U=sim_coinbase.start(ec.generate_private_key(ec.SECP256R1()).public_key(),'k');env.update(FABLE_BROKERAGE_BASE=U+'/brk',FABLE_EXCHANGE_BASE=U+'/exg')
    PAIRS=['BTC-USD','ETH-USD','SOL-USD']
results=[];facts={}
def check(name,ok,detail=''):
    results.append({'check':name,'ok':bool(ok),'detail':str(detail)[:400]});print(('PASS ' if ok else 'FAIL ')+name+(' - '+str(detail)[:400] if detail else ''),flush=True)
def num(v):
    try:return float(v)
    except Exception:return None
def near(a,b,tol):return a is not None and b is not None and b>0 and abs(a/b-1)<=tol

proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
opener=build_opener(ProxyHandler({}))
try:
    t0=time.time()
    while time.time()-t0<40 and not any(l.startswith('Account') for l in lines):time.sleep(.2)
    print('\n'.join('  launcher> '+l for l in lines),flush=True);facts['launcherOutput']=lines[:]
    BASE='http://127.0.0.1:'+[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0]
    live=[l for l in lines if l.startswith('Live data:')]
    check('launcher prints "Live data: OK" twice',len(live)==2 and all(l.startswith('Live data: OK') for l in live),live)
    check('launcher reports no key (none supplied)',any(l.startswith('Account:   not connected') for l in lines))
    def get(path):
        with opener.open(Request(BASE+path,headers={'Accept':'application/json'}),timeout=30) as r:return json.loads(r.read())
    def step(name,fn):
        try:fn()
        except Exception as e:check(name,False,type(e).__name__+': '+str(e))

    # ---------------- A. public routes, through the launcher ----------------
    def health():
        h=get('/health');facts['health']=h;check('/health ok',h.get('ok'),[c['name']+(' OK' if c['ok'] else ' FAIL '+c.get('error','')) for c in h['checks']])
        check('/health: Exchange answered directly (no fallback needed)',not any('fallback' in c['name'] for c in h['checks']),[c['name'] for c in h['checks']])
    step('/health',health)

    def listing():
        products,pages,seen=[],0,set()
        for page in range(20):
            d=get('/coinbase-public/market/products?product_type=SPOT&limit=100&offset=%d'%(page*100));pages+=1
            assert isinstance(d.get('products'),list),'no products array'
            ids='|'.join(p.get('product_id','') for p in d['products']);assert not (d['products'] and ids in seen),'page repeated';seen.add(ids)
            products+=d['products']
            if len(d['products'])!=100 or (d.get('pagination') or {}).get('has_next') is False:break
            time.sleep(.15)
        usd=[p for p in products if p.get('product_type')=='SPOT' and p.get('quote_currency_id')=='USD']
        facts['listing']={'pages':pages,'products':len(products),'usdSpot':len(usd),'keysOfFirst':sorted(products[0]) if products else []}
        check('listing: paginates and ends',pages<20 and len(products)>0,'%d pages, %d products, %d USD spot'%(pages,len(products),len(usd)))
        need=['product_id','product_type','quote_currency_id','price','volume_24h']
        miss={k:sum(1 for p in usd if k not in p) for k in need};check('listing: fields the scan reads are present on USD spot products',not any(miss.values()),miss)
        check('listing: BTC/ETH/SOL-USD listed with a price',all(any(p['product_id']==x and (num(p.get('price')) or 0)>0 for p in usd) for x in ('BTC-USD','ETH-USD','SOL-USD')))
        for k in ('approximate_quote_24h_volume','price_percentage_change_24h'):   # optional: the scan falls back when absent
            n=sum(1 for p in usd if num(p.get(k)) is not None);facts['listing'][k]=n;print('  info: %d of %d USD products carry %s'%(n,len(usd),k))
    step('listing',listing)

    ADV={}
    def product_rules():
        for p in ['BTC-USD','ETH-USD','SOL-USD']:
            d=get('/coinbase-public/market/products/'+p);ADV[p]=num(d.get('price'))
            r={k:num(d.get(k)) for k in ('base_increment','quote_increment','base_min_size','quote_min_size')}
            facts.setdefault('productRules',{})[p]=r
            check(p+': trade-ticket rounding rules present',r['base_increment'] and r['quote_increment'] and r['base_min_size'] is not None and r['quote_min_size'] is not None,r)
            check(p+': Advanced price > 0',(ADV[p] or 0)>0,ADV[p])
    step('product rules',product_rules)

    def adv_candles():
        now=int(time.time());today=now//DAY*DAY;start=today-200*DAY;end=today-1
        d=get('/coinbase-public/market/products/BTC-USD/candles?start=%d&end=%d&granularity=ONE_DAY&limit=200'%(start,end))
        c=d.get('candles');assert isinstance(c,list),'no candles array'
        bad=[x for x in c if any(num(x.get(k)) is None for k in ('start','low','high','open','close','volume'))]
        ts=sorted(int(x['start']) for x in c);ohlc=[x for x in c if not num(x['low'])<=min(num(x['open']),num(x['close']))<=max(num(x['open']),num(x['close']))<=num(x['high'])]
        facts['advancedDaily']={'bars':len(c),'first':ts[0] if ts else None,'last':ts[-1] if ts else None,'order':'newest first' if c and int(c[0]['start'])>int(c[-1]['start']) else 'oldest first'}
        check('Advanced daily candles: 200 completed days, all fields numeric',len(c)==200 and not bad,facts['advancedDaily'])
        check('Advanced daily candles: UTC-midnight starts inside the window',all(t%DAY==0 and start<=t<=end for t in ts))
        check('Advanced daily candles: low <= open/close <= high',not ohlc,len(ohlc))
        ADV['daily']={int(x['start']):x for x in c}
    step('Advanced candles',adv_candles)

    TICK={}
    def exchange_quotes():
        for p in PAIRS:
            t=get('/coinbase-exchange/products/%s/ticker'%p);s=get('/coinbase-exchange/products/%s/stats'%p);time.sleep(.12)
            price,bid,ask=num(t.get('price')),num(t.get('bid')),num(t.get('ask'));TICK[p]=price
            st={k:num(s.get(k)) for k in ('open','high','low','last','volume')}
            facts.setdefault('quotes',{})[p]={'price':price,'bid':bid,'ask':ask,'spreadBps':round((ask-bid)/((ask+bid)/2)*1e4,2) if bid and ask else None,**{'24h'+k:v for k,v in st.items()},'source':t.get('source','exchange')}
            check(p+': ticker price/bid/ask/time, bid <= ask',price and bid and ask and t.get('time') and bid<=ask,facts['quotes'][p])
            check(p+': 24h stats open/high/low/last/volume',all(v is not None for v in st.values()) and st['low']<=st['high'],st)
    step('Exchange quotes',exchange_quotes)

    def exchange_candles():
        for gran in ((86400,) if SIM else (86400,21600,3600)):   # the simulator only makes daily candles
            cutoff=int(time.time())//gran*gran;end=cutoff-1;start=cutoff-300*gran
            iso=lambda t:datetime.fromtimestamp(t,timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
            rows=get('/coinbase-exchange/products/BTC-USD/candles?granularity=%d&start=%s&end=%s'%(gran,iso(start),iso(end)))
            ok=isinstance(rows,list) and all(isinstance(r,list) and len(r)==6 and all(isinstance(v,(int,float)) for v in r) for r in rows)
            times=[r[0] for r in rows] if ok else []
            gaps=sum(1 for a,b in zip(sorted(times),sorted(times)[1:]) if b-a!=gran)
            facts.setdefault('exchangeCandles',{})[gran]={'rows':len(rows) if isinstance(rows,list) else None,'newestFirst':times==sorted(times,reverse=True),'latest':max(times) if times else None,'expectedLatest':cutoff-gran,'gaps':gaps,'inProgressIncluded':any(t>=cutoff for t in times)}
            check('Exchange candles %ds: rows are [time, low, high, open, close, volume]'%gran,ok and rows,facts['exchangeCandles'][gran])
            if ok and rows:
                check('Exchange candles %ds: low <= open/close <= high'%gran,all(r[1]<=min(r[3],r[4])<=max(r[3],r[4])<=r[2] for r in rows))
                check('Exchange candles %ds: last completed bucket present, in-progress bucket absent'%gran,max(times)==cutoff-gran and not any(t>=cutoff for t in times),facts['exchangeCandles'][gran])
            if gran==86400 and ok and ADV.get('daily'):
                common=sorted(set(times)&set(ADV['daily']))[-5:]
                diffs=[abs(num(ADV['daily'][t]['close'])/next(r[4] for r in rows if r[0]==t)-1) for t in common]
                facts['dailyCloseMaxDiff']=max(diffs) if diffs else None
                check('Exchange vs Advanced: last 5 daily closes agree within 0.5%',common and max(diffs)<=.005,['%.4f%%'%(d*100) for d in diffs])
            time.sleep(.2)
        if ADV.get('BTC-USD') and TICK.get('BTC-USD'):
            check('Exchange vs Advanced: BTC-USD price agrees within 1%',near(TICK['BTC-USD'],ADV['BTC-USD'],.01),(TICK['BTC-USD'],ADV['BTC-USD']))
    step('Exchange candles',exchange_candles)

    def fallback():
        # the launcher's own fallback code, run in-process against the same upstreams
        sys.path.insert(0,str(ROOT/'market-scan'));os.environ.update({k:v for k,v in env.items() if k.startswith('FABLE_')})
        import importlib.util;spec=importlib.util.spec_from_file_location('fable_server',ROOT/'market-scan/server.py');srvmod=importlib.util.module_from_spec(spec);spec.loader.exec_module(srvmod)
        t=srvmod.exchange_fallback('/products/BTC-USD/ticker');s=srvmod.exchange_fallback('/products/BTC-USD/stats')
        cutoff=int(time.time())//DAY*DAY;iso=lambda x:datetime.fromtimestamp(x,timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
        c=srvmod.exchange_fallback('/products/BTC-USD/candles?granularity=86400&start=%s&end=%s'%(iso(cutoff-30*DAY),iso(cutoff-1)))
        facts['fallback']={'ticker':t,'stats':s,'dailyRows':len(c),'latest':c[0][0] if c else None}
        check('Advanced fallback ticker matches Exchange within 1%',near(num(t['price']),TICK.get('BTC-USD'),.01) and num(t['bid'])<=num(t['ask']),t)
        check('Advanced fallback stats usable (last, open, volume)',num(s['last'])>0 and num(s['open'])>0 and num(s['volume'])>=0,s)
        check('Advanced fallback daily candles: 30 rows, newest first, last completed day',len(c)==30 and c[0][0]==cutoff-DAY and c[0][0]>c[-1][0],facts['fallback'])
    step('fallback',fallback)

    # ---------------- B. the real pages ----------------
    from playwright.sync_api import sync_playwright
    problems=[]
    with sync_playwright() as p:
        br=p.chromium.launch()
        def open_page(path):
            ctx=br.new_context(viewport={'width':1280,'height':900},timezone_id='America/Chicago');pg=ctx.new_page()
            pg.on('pageerror',lambda e:problems.append(path+': script error '+str(e)))
            pg.on('console',lambda m:m.type=='error' and 'Failed to load resource' not in m.text and problems.append(path+': console '+m.text))
            pg.on('dialog',lambda d:d.accept());pg.goto(BASE+path);pg.wait_for_timeout(1500);return ctx,pg
        def wait_enabled(pg,sel,ms):pg.wait_for_function("!document.querySelector(%r).disabled"%sel,timeout=ms)
        def fetch_run(pg,where,pair,gran):
            pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")   # Fetch sits in the 'pull live data' section
            pg.select_option('#dPair',pair);pg.select_option('#dGran',str(gran));pg.fill('#dDays','1800');pg.click('#fetchData');pg.wait_for_timeout(300);wait_enabled(pg,'#fetchData',120000)
            out=pg.inner_text('#fetchOut').replace('\n',' ');facts.setdefault('fetch',{})['%s %s %ds'%(where,pair,gran)]=out[:220]
            check('%s Fetch %s %s'%(where,pair,{86400:'daily',21600:'6-hour',3600:'hourly'}[gran]),'bars loaded' in out.lower(),out[:220])
        def desk():
            ctx,pg=open_page('/edge-lab/edge-lab-v7.html')
            pg.click('#liveRefresh');pg.wait_for_function("document.getElementById('liveGrid').textContent.includes('$')||document.getElementById('liveDiag').textContent.length>0",timeout=30000);pg.wait_for_timeout(500)
            strip={'status':pg.inner_text('#liveStatus'),'grid':pg.inner_text('#liveGrid').replace('\n',' ')[:300],'diag':pg.inner_text('#liveDiag')[:200]}
            facts['liveStrip']=strip;check('desk: live market strip shows prices',('$' in strip['grid']) and not strip['diag'].strip(),strip)
            pg.click('nav button[data-p="scan"]');pg.click('#scanMarkets');pg.wait_for_timeout(500);wait_enabled(pg,'#scanMarkets',240000)
            st=pg.inner_text('#scanStatus');rows=pg.eval_on_selector_all('#scanMarketsTable tr','r=>r.length');facts['scan']={'status':st[:400],'tableRows':rows}
            check('desk: daily scan completes',('Scan complete' in st) and rows>1,facts['scan'])
            pg.click('nav button[data-p="lab"]');pg.wait_for_timeout(300)
            for pair in PAIRS:fetch_run(pg,'desk',pair,86400)
            for gran in (() if SIM else (21600,3600)):fetch_run(pg,'desk','BTC-USD',gran)
            pg.click('nav button[data-p="control"]');pg.wait_for_timeout(300);pg.select_option('#rAsset','BTC-USD') if pg.locator('#rAsset option').count() else None
            pg.click('#autoFill');pg.wait_for_timeout(500);wait_enabled(pg,'#autoFill',60000)
            entry=num(pg.input_value('#rEntry'));status=pg.inner_text('#autoStatus').replace('\n',' ')[:300]
            facts['capitalPlanFill']={'entry':entry,'status':status}
            check('desk: Capital plan fill without a key sets a live entry price near the ticker',near(entry,TICK.get('BTC-USD'),.01),facts['capitalPlanFill'])
            check('desk: Capital plan fill explains the account is not connected','Account not connected' in pg.inner_text('#acctOut')+status,pg.inner_text('#acctOut')[:200])
            ctx.close()
        step('desk page',desk)
        def lab():
            ctx,pg=open_page('/edge-lab/strategy-lab.html');pg.click('nav button[data-p="lab"]');pg.wait_for_timeout(300)
            fetch_run(pg,'lab','BTC-USD',86400);ctx.close()
        step('lab page',lab)
        br.close()
    check('no script or console errors on the pages',not problems,problems[:10])
finally:
    if proc.poll() is None:proc.terminate();proc.wait(5)
    if SIM:srv.shutdown()
out=ROOT/'tests/artifacts'/('live-check-sim.json' if SIM else 'live-check.json')
out.write_text(json.dumps({'ranAt':datetime.now(timezone.utc).isoformat(),'mode':'simulator' if SIM else 'live Coinbase','results':results,'facts':facts},indent=1,default=str))
failed=[r for r in results if not r['ok']]
print('\n%d checks, %d failed. Details: %s'%(len(results),len(failed),out.relative_to(ROOT)))
if failed:print('LIVE CHECK FAILED');sys.exit(1)
print('LIVE CHECK PASSED'+(' (simulator self-test)' if SIM else ' (real Coinbase public data)'))
