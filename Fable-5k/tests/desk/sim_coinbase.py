"""Stateful Coinbase simulator: public market data + JWT-verified View-only account whose balances,
open orders and fills change as the simulated user trades. Control endpoints under /__sim/ (POST JSON)."""
import json,math,threading,time
from datetime import datetime,timezone
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote
import jwt as pyjwt
DAY=86400
BASE={'BTC-USD':60000.0,'ETH-USD':2500.0,'SOL-USD':150.0}

class Sim:
    def __init__(self,public_key,key_name,fee=0.012):
        self.pub=public_key;self.name=key_name;self.fee=fee;self.lock=threading.Lock()
        self.usd=5000.0;self.hold={};self.orders=[];self.fills=[];self.transfers=[];self.book={p:(b,b+1) for p,b in BASE.items()};self.n=0;self.seen=[]
    def now(self):return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    def mid(self,p):b,a=self.book[p];return (b+a)/2
    def equity(self):return self.usd+sum(q*self.mid(a+'-USD') for a,q in self.hold.items())
    # ---- user actions in Coinbase ----
    def buy(self,p,qty):
        with self.lock:
            px=self.book[p][1];notional=qty*px;fee=notional*self.fee
            if notional+fee>self.usd+1e-9:raise ValueError('insufficient USD')
            self.usd-=notional+fee;a=p.split('-')[0];self.hold[a]=self.hold.get(a,0)+qty;self._fill(p,'BUY',px,qty,fee)
    def sell(self,p,qty):
        with self.lock:
            a=p.split('-')[0];qty=min(qty,self.hold.get(a,0));px=self.book[p][0];notional=qty*px;fee=notional*self.fee
            self.usd+=notional-fee;self.hold[a]-=qty
            if self.hold[a]<=1e-12:del self.hold[a]
            self._fill(p,'SELL',px,qty,fee)
    def _fill(self,p,side,px,qty,fee):
        self.n+=1;oid='o%d'%self.n
        self.fills.append({'entry_id':'e%d'%self.n,'trade_id':'t%d'%self.n,'order_id':oid,'trade_time':self.now(),'trade_type':'FILL','price':repr(px),'size':repr(qty),'commission':repr(fee),'product_id':p,'side':side,'size_in_quote':False})
    def stop(self,p,qty,stop,limit):
        self.n+=1;self.orders.append({'order_id':'s%d'%self.n,'product_id':p,'side':'SELL','status':'OPEN','order_configuration':{'stop_limit_stop_limit_gtc':{'base_size':repr(qty),'stop_price':repr(stop),'limit_price':repr(limit),'stop_direction':'STOP_DIRECTION_STOP_DOWN'}}})
    # ---- responses ----
    def candles(self,p,start,end):
        rows=[];t=math.ceil(start/DAY)*DAY
        while t<=end:
            b=self.mid(p) if getattr(self,'moving',False) else BASE[p];low=b*(0.92+0.01*((t//DAY)%5));rows.append((int(t),low,b*1.08,b*0.99,b*1.01,10.0));t+=DAY
        return rows[::-1]
    def breakdown(self):
        pos=[{'asset':'USD','total_balance_fiat':self.usd,'available_to_trade_fiat':self.usd,'is_cash':True}]
        for a,q in self.hold.items():pos.append({'asset':a,'total_balance_fiat':q*self.mid(a+'-USD'),'total_balance_crypto':q,'available_to_trade_fiat':q*self.mid(a+'-USD'),'is_cash':False})
        return {'breakdown':{'portfolio':{'uuid':'pf-main','name':'Main'},'portfolio_balances':{'total_balance':{'value':repr(self.equity()),'currency':'USD'}},'spot_positions':pos}}

def make_handler(sim):
    class H(BaseHTTPRequestHandler):
        def log_message(self,*a):pass
        def send(self,code,body):
            b=json.dumps(body).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
        def do_POST(self):
            body=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))) or b'{}');op=self.path.split('/__sim/')[1]
            try:
                with sim.lock:pass
                if op=='price':
                    sim.book[body['product']]=(body['bid'],body['ask'])
                    # Resting stop-limit sells trigger when the bid reaches the stop; they fill at the bid only if it is
                    # still at or above the limit (a gap through the limit leaves the order unfilled, like Coinbase).
                    for o in list(sim.orders):
                        if o['product_id']!=body['product']:continue
                        cfg=o['order_configuration']['stop_limit_stop_limit_gtc'];stop=float(cfg['stop_price']);lim=float(cfg['limit_price']);q=float(cfg['base_size'])
                        if body['bid']<=stop and body['bid']>=lim:
                            sim.orders.remove(o);sim.sell(body['product'],q)
                elif op=='buy':sim.buy(body['product'],body['qty'])
                elif op=='sell':sim.sell(body['product'],body['qty'])
                elif op=='stop':sim.stop(body['product'],body['qty'],body['stop'],body['limit'])
                elif op=='cancel':sim.orders=[o for o in sim.orders if o['product_id']!=body['product']]
                elif op=='usd':sim.usd=body['usd']
                elif op=='deposit':
                    sim.usd+=body['amount'];sim.transfers.append({'id':'d%d'%len(sim.transfers),'type':'fiat_deposit','status':'completed','amount':{'amount':repr(body['amount']),'currency':'USD'},'native_amount':{'amount':'%.2f'%body['amount'],'currency':'USD'},'created_at':sim.now()[:19]+'Z'})
                    sim.transfers.append({'id':'p%d'%len(sim.transfers),'type':'pro_deposit','status':'completed','native_amount':{'amount':'5.00','currency':'USD'},'created_at':sim.now()[:19]+'Z'})
                elif op=='withdraw':
                    sim.usd-=body['amount'];sim.transfers.append({'id':'w%d'%len(sim.transfers),'type':'fiat_withdrawal','status':'completed','native_amount':{'amount':'-%.2f'%body['amount'],'currency':'USD'},'created_at':sim.now()[:19]+'Z'})
                elif op=='state':pass
                else:return self.send(404,{'error':op})
                return self.send(200,{'usd':sim.usd,'hold':sim.hold,'equity':sim.equity(),'fills':sim.fills,'orders':sim.orders,'book':sim.book})
            except Exception as e:return self.send(400,{'error':str(e)})
        def do_GET(self):
            path,_,qs=self.path.partition('?');q={k:unquote(v) for k,v in (p.split('=',1) for p in qs.split('&') if '=' in p)};sim.seen.append(self.path)
            parts=path.strip('/').split('/')
            if path.startswith('/exg/products/'):
                p=parts[2];b,a=sim.book[p]
                if path.endswith('/ticker'):return self.send(200,{'price':repr((b+a)/2),'bid':repr(b),'ask':repr(a),'time':sim.now()})
                if path.endswith('/stats'):return self.send(200,{'open':repr(BASE[p]),'high':repr(max(a,BASE[p])),'low':repr(min(b,BASE[p])),'last':repr((b+a)/2),'volume':'100'})
                if path.endswith('/candles'):
                    s=datetime.fromisoformat(q['start'].replace('Z','+00:00')).timestamp();e=datetime.fromisoformat(q['end'].replace('Z','+00:00')).timestamp()
                    return self.send(200,[list(r) for r in sim.candles(p,s,e)])
            if path=='/brk/market/products':return self.send(200,{'products':[{'product_id':p,'product_type':'SPOT','quote_currency_id':'USD','price':repr(sim.mid(p)),'volume_24h':'1000','status':'online'} for p in BASE],'num_products':3})
            if path.startswith('/brk/market/products/'):
                p=parts[3]
                if path.endswith('/candles'):return self.send(200,{'candles':[{'start':str(t),'low':repr(l),'high':repr(h),'open':repr(o),'close':repr(c),'volume':repr(v)} for t,l,h,o,c,v in sim.candles(p,int(q['start']),int(q['end']))]})
                if path.endswith('/ticker'):b,a=sim.book[p];return self.send(200,{'trades':[{'price':repr((b+a)/2),'time':sim.now()}],'best_bid':repr(b),'best_ask':repr(a)})
                return self.send(200,{'product_id':p,'price':repr(sim.mid(p)),'price_percentage_change_24h':'0','volume_24h':'1000','base_increment':'0.001' if p=='SOL-USD' else '0.00000001','quote_increment':'0.01','base_min_size':'0.00000001','quote_min_size':'1'})
            if path.startswith('/v2/'):
                tok=self.headers.get('Authorization','')[7:]
                try:
                    c=pyjwt.decode(tok,sim.pub,algorithms=['ES256']);assert c['uri']=='GET api.coinbase.com'+path and c['sub']==sim.name
                except Exception as e:return self.send(401,{'error':str(e)})
                if path=='/v2/accounts':return self.send(200,{'data':[{'id':'acc-usd','currency':{'code':'USD'},'updated_at':sim.now()[:19]+'Z'},{'id':'acc-old','currency':{'code':'DOGE'},'updated_at':'2020-01-01T00:00:00Z'}],'pagination':{'next_starting_after':None}})
                if path=='/v2/accounts/acc-usd/transactions':return self.send(200,{'data':sorted(sim.transfers,key=lambda t:t['created_at'],reverse=True),'pagination':{'next_starting_after':None}})
                if path=='/v2/accounts/acc-old/transactions':raise AssertionError('stale account should be skipped')
            if path.startswith('/api/v3/brokerage/'):
                tok=self.headers.get('Authorization','')[7:]
                try:
                    c=pyjwt.decode(tok,sim.pub,algorithms=['ES256']);assert c['uri']=='GET api.coinbase.com'+path and c['sub']==sim.name
                except Exception as e:return self.send(401,{'error':str(e)})
                with sim.lock:
                    if path.endswith('/key_permissions'):return self.send(200,{'can_view':True,'can_trade':False,'can_transfer':False,'portfolio_uuid':'pf-main','portfolio_type':'DEFAULT'})
                    if path.endswith('/portfolios/pf-main'):return self.send(200,sim.breakdown())
                    if path.endswith('/transaction_summary'):return self.send(200,{'fee_tier':{'pricing_tier':'Intro 1','taker_fee_rate':repr(sim.fee),'maker_fee_rate':repr(sim.fee/2)}})
                    if path.endswith('/orders/historical/batch'):return self.send(200,{'orders':list(sim.orders),'has_next':False})
                    if path.endswith('/orders/historical/fills'):return self.send(200,{'fills':[f for f in sim.fills if q.get('product_ids') in (None,f['product_id'])][::-1],'cursor':''})
            return self.send(404,{'error':'nf '+path})
    return H

def start(public_key,key_name):
    sim=Sim(public_key,key_name);srv=ThreadingHTTPServer(('127.0.0.1',0),make_handler(sim));threading.Thread(target=srv.serve_forever,daemon=True).start()
    return sim,srv,f'http://127.0.0.1:{srv.server_port}'
