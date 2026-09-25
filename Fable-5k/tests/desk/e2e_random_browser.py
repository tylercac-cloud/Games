"""Randomised long session in a REAL Chromium: a simulated user trades for weeks against the stateful Coinbase
simulator — random price walks, ticket-sized buys, stop-limits that trigger (or gap through), manual sells, deposits,
one-tap journal logging. After every step, every number on screen is checked against the simulator and an
independent re-derivation of the rules. Seeded; usage: e2e_random_browser.py [seed] [steps]."""
import json,os,random,subprocess,sys,tempfile,threading,time
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization as ser
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import sim_coinbase
ROOT=Path(__file__).parents[2];SEED=int(sys.argv[1]) if len(sys.argv)>1 else 7;STEPS=int(sys.argv[2]) if len(sys.argv)>2 else 60
R=random.Random(SEED);NAME='organizations/main/apiKeys/view';KEY=ec.generate_private_key(ec.SECP256R1())
sim,srv,U=sim_coinbase.start(KEY.public_key(),NAME);sim.moving=True   # 30-day lows follow the price, so stops sit ~8% under it and crashes reach them
from datetime import datetime,timezone,timedelta
sim.transfers.append({'id':'fund','type':'fiat_deposit','status':'completed','native_amount':{'amount':'5000.00','currency':'USD'},'created_at':(datetime.now(timezone.utc)-timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')})
keydir=tempfile.mkdtemp();Path(keydir,'cdp_api_key.json 2.txt').write_text(json.dumps({'name':NAME,'privateKey':KEY.private_bytes(ser.Encoding.PEM,ser.PrivateFormat.TraditionalOpenSSL,ser.NoEncryption()).decode()}))
DOWN=len(sys.argv)>3 and sys.argv[3]=='exchange-down'   # optional: run the whole session on the Advanced fallback
env={**os.environ,'FABLE_BROKERAGE_BASE':U+'/brk','FABLE_EXCHANGE_BASE':('http://127.0.0.1:9/exg' if DOWN else U+'/exg'),'FABLE_ACCOUNT_BASE':U,'FABLE_KEY_DIR':keydir}
proc=subprocess.Popen([sys.executable,'-u',str(ROOT/'market-scan/server.py'),'--no-browser','--port','0'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
lines=[];threading.Thread(target=lambda:[lines.append(l.rstrip()) for l in proc.stdout],daemon=True).start()
def ctl(op,**b):
    import urllib.request
    return json.loads(urllib.request.urlopen(urllib.request.Request(U+'/__sim/'+op,data=json.dumps(b).encode(),method='POST')).read())
def expect_plan(q):
    loss=5000-q['equity'];floor=max(4000,q['peak']-1000)
    stage='HALT' if q['equity']<=floor else 'NO_NEW_RISK' if loss>=750 else 'REVIEW' if loss>=500 else 'WITHIN_LIMITS'
    rf=0.005*(0.5 if stage=='REVIEW' else 1);usable=0 if stage in('HALT','NO_NEW_RISK') or q['cooling'] else q['cash']
    cpu=q['entry']*(1+q['slip'])*(1+q['fee']);lpu=cpu-q['stop']*(1-q['slip'])*(1-q['fee'])
    head=max(0,q['equity']*0.01-q['open']);budget=min(q['equity']*rf,head)
    qty=0 if q['equity']<=q['peak']*0.8 else max(0,min(budget/lpu,usable/cpu,q['equity']*0.25/cpu))
    return stage,budget,qty
fails=[];checks=0
def check(cond,msg):
    global checks;checks+=1
    if not cond:fails.append(msg);print('  FAIL',msg)
try:
    t0=time.time()
    while time.time()-t0<15 and not any(l.startswith('Account') for l in lines):time.sleep(.1)
    port=[l for l in lines if l.startswith('Fable 5k: ')][0].split(':')[3].split('/')[0];BASE='http://127.0.0.1:'+port
    with sync_playwright() as p:
        br=p.chromium.launch();ctx=br.new_context(timezone_id='America/Chicago',viewport={'width':1280,'height':900});page=ctx.new_page()
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:m.type=='error' and 'Failed to load resource' not in m.text and errors.append('console: '+m.text))
        page.on('response',lambda r:r.status>=400 and '127.0.0.1' in r.url and errors.append(f'HTTP {r.status} {r.request.method} {r.url} origin={r.request.headers.get("origin")}'))
        page.goto(BASE+'/edge-lab/edge-lab-v7.html');page.wait_for_timeout(1500)
        v=lambda i:page.evaluate(f"+document.getElementById('{i}').value")
        def refresh():
            page.click('#autoFill');page.wait_for_function("!document.getElementById('autoFill').disabled&&!/Reading live data/.test(document.getElementById('autoStatus').textContent)",timeout=20000);page.wait_for_timeout(250)
        page.click('nav button[data-p="control"]');page.wait_for_timeout(300);refresh()
        coins=['BTC-USD','ETH-USD','SOL-USD'];deposits=0.0;logged=0;stats={k:0 for k in ['buys','sells','partial','deposits','withdrawals']}
        for step in range(STEPS):
            # ---- random market move for every coin (and stops trigger inside the simulator) ----
            crash=R.choice(coins) if R.random()<0.10 else None
            for c in coins:
                b,a=sim.book[c];mid=(b+a)/2*(1+(R.uniform(-0.15,-0.08) if c==crash else R.gauss(0,0.03)));tick=0.01;spread=max(tick,round(mid*R.uniform(0.00001,0.0004),2))
                bid=round(mid-spread/2,2);ctl('price',product=c,bid=bid,ask=round(bid+spread,2))
            time.sleep(1.05)   # past the launcher's 1-second price cache
            act=R.random();coin=R.choice(coins)
            page.select_option('#rAsset',coin);page.wait_for_function("!document.getElementById('autoFill').disabled",timeout=20000);page.wait_for_timeout(300);refresh()
            st=ctl('state');held={a:q for a,q in st['hold'].items()}
            # ---- invariants: account numbers ----
            eq_exp=st['equity']-deposits
            check(abs(v('rEquity')-eq_exp)<0.006,f'step {step}: equity {v("rEquity")} vs {eq_exp:.2f}')
            check(abs(v('rCash')-min(st['usd'],eq_exp))<0.006,f'step {step}: cash {v("rCash")} vs {min(st["usd"],eq_exp):.2f}')
            open_ref=0.0
            for asset,q in held.items():
                prod=asset+'-USD';mid=sum(sim.book[prod])/2;left=q;stops=sorted([o for o in st['orders'] if o['product_id'].split('-')[0]==asset],key=lambda o:-min(float(o['order_configuration']['stop_limit_stop_limit_gtc']['stop_price']),float(o['order_configuration']['stop_limit_stop_limit_gtc']['limit_price'])))
                for o in stops:
                    cfg=o['order_configuration']['stop_limit_stop_limit_gtc'];fill=min(float(cfg['stop_price']),float(cfg['limit_price']))
                    if mid<fill:continue   # gapped through: protects nothing
                    take=min(left,float(cfg['base_size']));left-=take
                    open_ref+=take*(max(0,mid-fill)+fill*sim.fee)
                open_ref+=max(0,left)*mid if q*mid>=1 else 0
            check(abs(v('rOpen')-open_ref)<0.011,f'step {step}: open risk {v("rOpen")} vs {open_ref:.4f}')
            # ---- invariants: the plan ----
            RK=page.evaluate('LAST_RISK&&{stage:LAST_RISK.experiment.stage,qty:LAST_RISK.result.qty,budget:LAST_RISK.result.riskBudget,cooling:!!LAST_RISK.cooling,i:LAST_RISK.inputs}')
            if RK and v('rStop')>0:
                i=RK['i'];stage,budget,qty=expect_plan({'equity':i['equity'],'peak':i['peak'],'cash':v('rCash'),'open':i['openRisk'],'entry':i['entry'],'stop':i['stop'],'slip':i['entrySlip'],'fee':i['entryFee'],'cooling':RK['cooling']})
                check(RK['stage']==stage,f'step {step}: stage {RK["stage"]} vs {stage}')
                check(abs(RK['qty']-qty)<=1e-9*max(1,qty),f'step {step}: qty {RK["qty"]} vs {qty}')
                check(abs(i['equity']-eq_exp)<0.006 and abs(i['entry']-sum(sim.book[coin])/2)<0.006,f'step {step}: plan used stale inputs')
            try:page.wait_for_function("document.getElementById('ticketOut').textContent.length>0",timeout=3000)
            except Exception:pass
            tk=page.evaluate("document.getElementById('ticketOut').textContent")
            # ---- the user acts ----
            base=coin.split('-')[0]
            if act<0.55:
                if base not in held and RK and RK['qty']>0 and 'Trade ticket' in tk and 'No trade' not in tk and 'minimum' not in tk:
                    inc=0.001 if coin=='SOL-USD' else 1e-8
                    T=page.evaluate("inc=>window.fableAuto.ticketMath(LAST_RISK,{baseInc:inc,quoteInc:0.01,minBase:1e-8,minQuote:1},'market',0.2,null)",inc)
                    shown=f"{T['qty']:.3f}" if coin=='SOL-USD' else f"{T['qty']:.8f}"
                    check(shown in tk,f'step {step}: ticket should show {shown}')
                    check(T['riskAtLimit']<=T['budget']+1e-9,f'step {step}: ticket risk above budget')
                    q=float(shown);ctl('buy',product=coin,qty=q);ctl('stop',product=coin,qty=q,stop=T['stop'],limit=T['limit']);stats['buys']+=1
            elif act<0.75 and held:
                a=R.choice(list(held))
                if R.random()<0.3:ctl('sell',product=a+'-USD',qty=held[a]*0.5);stats['partial']+=1      # stop order stays at the old, larger size
                else:ctl('cancel',product=a+'-USD');ctl('sell',product=a+'-USD',qty=held[a]);stats['sells']+=1
            elif 0.75<=act<0.81:
                amt=R.choice([100,250,500]);w=act>=0.79
                if w and st['usd']<amt+100:amt=0
                if amt:
                    ctl('withdraw' if w else 'deposit',amount=amt);deposits+=-amt if w else amt;stats['withdrawals' if w else 'deposits']+=1
                    refresh();page.wait_for_timeout(800)
                    if page.locator('#acctUseHint').count():page.click('#acctUseHint');page.wait_for_timeout(300)
                    check(abs(page.evaluate("+JSON.parse(localStorage.getItem('fable-desk:net-deposits')||'{\"value\":0}').value")-deposits)<0.006,f'step {step}: transfer hint did not net {deposits}')
            # ---- log everything closed, one tap each ----
            if step%5==4 or step==STEPS-1:
                page.click('nav button[data-p="jrn"]')
                page.wait_for_function("/to log|All Coinbase round trips|No /.test(document.getElementById('fillsOut').textContent)",timeout=20000)
                while page.locator('#fillsOut button[data-trip]').count():
                    n0=page.evaluate('TRADES.length');page.locator('#fillsOut button[data-trip]').first.click();page.wait_for_function(f'TRADES.length>{n0}',timeout=10000);page.wait_for_timeout(400);logged+=1
                page.click('nav button[data-p="control"]');page.wait_for_timeout(300);refresh()
        # ---- end of session: close everything, log it, reconcile ----
        for a,q in ctl('state')['hold'].items():ctl('cancel',product=a+'-USD');ctl('sell',product=a+'-USD',qty=q)
        page.click('nav button[data-p="control"]');refresh();page.click('nav button[data-p="jrn"]')
        page.wait_for_function("/to log|All Coinbase round trips/.test(document.getElementById('fillsOut').textContent)",timeout=20000)
        while page.locator('#fillsOut button[data-trip]').count():
            n0=page.evaluate('TRADES.length');page.locator('#fillsOut button[data-trip]').first.click();page.wait_for_function(f'TRADES.length>{n0}',timeout=10000);page.wait_for_timeout(400);logged+=1
        st=ctl('state');flat=not st['hold']
        check(flat,'account should be flat at the end')
        stops_hit=sum(1 for f in sim.fills if f['side']=='SELL')-stats['sells']-stats['partial']-len([1 for _ in []])
        journal=page.evaluate("TRADES.filter(t=>t.trip).reduce((a,t)=>a+t.pnl,0)")
        cash_pl=st['usd']-5000-deposits
        if flat:check(abs(journal-cash_pl)<0.01*max(1,logged),f'journal P&L {journal:.4f} vs account change {cash_pl:.4f} over {logged} trades')
        check(not errors,'page errors: '+' | '.join(errors[:5]))
        print(f'seed {SEED}: {stats}, stop/close-out sells {stops_hit}')
        print(f'seed {SEED}: {STEPS} steps, {logged} trades logged, {len(sim.fills)} fills, deposits ${deposits:.0f}, final equity ${st["equity"]:.2f}, flat={flat}, journal ${journal:.2f} vs account ${cash_pl:.2f}, {checks} checks')
        br.close()
finally:
    proc.terminate();proc.wait(5);srv.shutdown()
if fails:print('RANDOM BROWSER SESSION FAILED:',len(fails));sys.exit(1)
print('RANDOM BROWSER SESSION PASSED')
