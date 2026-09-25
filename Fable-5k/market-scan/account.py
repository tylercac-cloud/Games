"""Read-only Coinbase account access for the local launcher.

- The key file lives in Fable-5k/private/ and is read only by this process. It is never sent
  to the browser, logged, exported or included in backups.
- Only fixed GET endpoints are called. Keys with trade or transfer permission are refused.
- JWT signing: ES256 (ECDSA P-256) or EdDSA (Ed25519), auto-detected. Uses the `cryptography`
  package when installed; otherwise a pure-Python implementation (RFC 6979 / RFC 8032).
"""
import base64,hashlib,hmac,json,os,secrets,time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
KEY_DIR=Path(os.environ.get('FABLE_KEY_DIR',str(ROOT/'private')))
ACCOUNT_BASE=os.environ.get('FABLE_ACCOUNT_BASE','https://api.coinbase.com')
URI_HOST='api.coinbase.com'   # the JWT uri claim always names the real host
PREFIX='/api/v3/brokerage'

class AccountError(Exception):
    def __init__(self,status,message):super().__init__(message);self.status=status

# ---------------------------------------------------------------- DER / PEM
def _tlv(buf,i):
    tag=buf[i];i+=1;ln=buf[i];i+=1
    if ln&0x80:
        n=ln&0x7f;ln=int.from_bytes(buf[i:i+n],'big');i+=n
    return tag,buf[i:i+ln],i+ln
def _children(buf):
    out=[];i=0
    while i<len(buf):
        tag,val,i=_tlv(buf,i);out.append((tag,val))
    return out
OID_EC=bytes.fromhex('2a8648ce3d0201');OID_P256=bytes.fromhex('2a8648ce3d030107');OID_ED25519=bytes.fromhex('2b6570')
def _pem_body(text):
    lines=[l.strip() for l in text.strip().splitlines() if l.strip() and not l.startswith('-----')]
    return base64.b64decode(''.join(lines))
def parse_private_key(secret):
    """Returns ('ES256', int_d) or ('EdDSA', seed32)."""
    s=secret.replace('\\n','\n').strip()
    if 'BEGIN EC PRIVATE KEY' in s:
        return 'ES256',_sec1(_pem_body(s))
    if 'BEGIN PRIVATE KEY' in s:
        tag,seq,_=_tlv(_pem_body(s),0);parts=_children(seq)
        alg=_children(parts[1][1]);inner=parts[2][1]
        if alg[0][1]==OID_ED25519:
            t,v,_=_tlv(inner,0)
            if len(v)!=32:raise ValueError('Unexpected Ed25519 key length.')
            return 'EdDSA',v
        if alg[0][1]==OID_EC:
            if len(alg)<2 or alg[1][1]!=OID_P256:raise ValueError('Only P-256 EC keys are supported.')
            return 'ES256',_sec1(inner)
        raise ValueError('Unsupported private key algorithm.')
    raw=base64.b64decode(s,validate=True)
    if len(raw) in (32,64):return 'EdDSA',raw[:32]
    raise ValueError('Unrecognised private key format.')
def _sec1(der):
    tag,seq,_=_tlv(der,0);parts=_children(seq)
    if parts[0][1]!=b'\x01':raise ValueError('Unexpected EC key version.')
    for t,v in parts[2:]:
        if t==0xa0 and _tlv(v,0)[1]!=OID_P256:raise ValueError('Only P-256 EC keys are supported.')
    d=int.from_bytes(parts[1][1],'big')
    if not 0<d<P256_N:raise ValueError('Invalid EC private scalar.')
    return d

# ---------------------------------------------------------------- P-256 ECDSA (pure Python)
P256_P=2**256-2**224+2**192+2**96-1
P256_A=P256_P-3
P256_N=0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
P256_G=(0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296,0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5)
def _ec_add(P,Q):
    if P is None:return Q
    if Q is None:return P
    if P[0]==Q[0] and (P[1]+Q[1])%P256_P==0:return None
    if P==Q:l=(3*P[0]*P[0]+P256_A)*pow(2*P[1],-1,P256_P)%P256_P
    else:l=(Q[1]-P[1])*pow(Q[0]-P[0],-1,P256_P)%P256_P
    x=(l*l-P[0]-Q[0])%P256_P;return (x,(l*(P[0]-x)-P[1])%P256_P)
def _ec_mul(k,P):
    R=None
    while k:
        if k&1:R=_ec_add(R,P)
        P=_ec_add(P,P);k>>=1
    return R
def _rfc6979_k(d,h1):
    x=d.to_bytes(32,'big');h=(int.from_bytes(h1,'big')%P256_N).to_bytes(32,'big')
    V=b'\x01'*32;K=b'\x00'*32
    K=hmac.new(K,V+b'\x00'+x+h,hashlib.sha256).digest();V=hmac.new(K,V,hashlib.sha256).digest()
    K=hmac.new(K,V+b'\x01'+x+h,hashlib.sha256).digest();V=hmac.new(K,V,hashlib.sha256).digest()
    while True:
        V=hmac.new(K,V,hashlib.sha256).digest();k=int.from_bytes(V,'big')
        if 0<k<P256_N:return k
        K=hmac.new(K,V+b'\x00',hashlib.sha256).digest();V=hmac.new(K,V,hashlib.sha256).digest()
def es256_sign(d,msg,pure=False):
    h1=hashlib.sha256(msg).digest();z=int.from_bytes(h1,'big')
    try:
        if pure:raise ImportError
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
        r,s=decode_dss_signature(ec.derive_private_key(d,ec.SECP256R1()).sign(msg,ec.ECDSA(hashes.SHA256())))
    except ImportError:
        k=_rfc6979_k(d,h1);r=_ec_mul(k,P256_G)[0]%P256_N
        s=pow(k,-1,P256_N)*(z+r*d)%P256_N
    return r.to_bytes(32,'big')+s.to_bytes(32,'big')

# ---------------------------------------------------------------- Ed25519 (pure Python, RFC 8032)
ED_P=2**255-19;ED_Q=2**252+27742317777372353535851937790883648493
ED_D=-121665*pow(121666,-1,ED_P)%ED_P;ED_I=pow(2,(ED_P-1)//4,ED_P)
def _ed_x(y,sign):
    x2=(y*y-1)*pow(ED_D*y*y+1,-1,ED_P);x=pow(x2,(ED_P+3)//8,ED_P)
    if (x*x-x2)%ED_P:x=x*ED_I%ED_P
    if (x&1)!=sign:x=ED_P-x
    return x
_EY=4*pow(5,-1,ED_P)%ED_P;_EX=_ed_x(_EY,0);ED_G=(_EX,_EY,1,_EX*_EY%ED_P)
def _ed_add(P,Q):
    A=(P[1]-P[0])*(Q[1]-Q[0])%ED_P;B=(P[1]+P[0])*(Q[1]+Q[0])%ED_P
    C=2*P[3]*Q[3]*ED_D%ED_P;D=2*P[2]*Q[2]%ED_P;E,F,G,H=B-A,D-C,D+C,B+A
    return (E*F%ED_P,G*H%ED_P,F*G%ED_P,E*H%ED_P)
def _ed_mul(s,P):
    Q=(0,1,1,0)
    while s:
        if s&1:Q=_ed_add(Q,P)
        P=_ed_add(P,P);s>>=1
    return Q
def _ed_enc(P):
    zi=pow(P[2],-1,ED_P);x=P[0]*zi%ED_P;y=P[1]*zi%ED_P
    return (y|((x&1)<<255)).to_bytes(32,'little')
def ed25519_sign(seed,msg,pure=False):
    try:
        if pure:raise ImportError
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        return Ed25519PrivateKey.from_private_bytes(seed).sign(msg)
    except ImportError:
        pass
    h=hashlib.sha512(seed).digest();a=int.from_bytes(h[:32],'little');a&=(1<<254)-8;a|=1<<254
    A=_ed_enc(_ed_mul(a,ED_G));r=int.from_bytes(hashlib.sha512(h[32:]+msg).digest(),'little')%ED_Q
    R=_ed_enc(_ed_mul(r,ED_G));k=int.from_bytes(hashlib.sha512(R+A+msg).digest(),'little')%ED_Q
    return R+((r+k*a)%ED_Q).to_bytes(32,'little')

# ---------------------------------------------------------------- JWT
def _b64u(b):return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def build_jwt(key,method,path,now=None):
    now=int(time.time() if now is None else now)
    header={'alg':key['alg'],'kid':key['kid'],'nonce':secrets.token_hex(16),'typ':'JWT'}
    claims={'sub':key['kid'],'iss':'cdp','nbf':now,'exp':now+120,'uri':f'{method} {URI_HOST}{path}'}
    signing=(_b64u(json.dumps(header,separators=(',',':')).encode())+'.'+_b64u(json.dumps(claims,separators=(',',':')).encode())).encode()
    sig=es256_sign(key['secret'],signing) if key['alg']=='ES256' else ed25519_sign(key['secret'],signing)
    return signing.decode()+'.'+_b64u(sig)

# ---------------------------------------------------------------- key file
def find_key_file():
    if not KEY_DIR.is_dir():return None
    files=sorted(p for p in KEY_DIR.glob('*.json') if p.is_file())
    return files[0] if files else None
def load_key():
    path=find_key_file()
    if not path:return None
    try:data=json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception:raise AccountError(400,'The key file in private/ is not valid JSON. Re-download it from Coinbase.')
    kid=data.get('name') or data.get('id') or data.get('keyName') or data.get('apiKeyName')
    secret=data.get('privateKey') or data.get('privateKeySecret') or data.get('secret')
    if not kid or not secret:raise AccountError(400,'The key file needs a key name/id and a privateKey.')
    try:alg,material=parse_private_key(secret)
    except Exception:raise AccountError(400,'The private key in private/ could not be read (expected Ed25519 or ECDSA P-256).')
    return {'kid':str(kid),'alg':alg,'secret':material,'file':path.name}

# ---------------------------------------------------------------- client
def _num(v):
    try:
        x=float(v if not isinstance(v,dict) else v.get('value'));return x if x==x else None
    except Exception:return None
class Account:
    def __init__(self,key,opener=urlopen,ssl_ctx=None):
        self.key=key;self.opener=opener;self.ssl_ctx=ssl_ctx
    def get(self,route,query=None):
        path=PREFIX+route
        req=Request(ACCOUNT_BASE+path+('?'+urlencode(query,doseq=True) if query else ''),headers={
            'Authorization':'Bearer '+build_jwt(self.key,'GET',path),'Accept':'application/json','User-Agent':'FableResearch/12 read-only'})
        kw={'timeout':12}
        if self.ssl_ctx is not None and ACCOUNT_BASE.startswith('https'):kw['context']=self.ssl_ctx
        try:
            with self.opener(req,**kw) as r:raw=r.read(8*1024*1024)
        except Exception as e:
            code=getattr(e,'code',None)
            if code==401:raise AccountError(401,'Coinbase rejected the key (HTTP 401). Check the key file, that the key is not deleted, and that your PC clock is set automatically.')
            if code==403:raise AccountError(403,'Coinbase refused the key (HTTP 403). The key may lack View permission or have an IP allowlist that excludes this network.')
            raise
        try:return json.loads(raw)
        except ValueError:raise AccountError(502,'Coinbase answered with non-JSON content.')
    def permissions(self):
        p=self.get('/key_permissions')
        if p.get('can_trade') or p.get('can_transfer'):
            raise AccountError(403,'This key can '+(' and '.join(x for x,y in [('trade',p.get('can_trade')),('transfer',p.get('can_transfer'))] if y))+'. Fable only accepts View-only keys. Delete it in Coinbase and create one with View permission only.')
        if not p.get('can_view'):raise AccountError(403,'This key has no View permission.')
        if not p.get('portfolio_uuid'):raise AccountError(502,'Coinbase did not report the key\'s portfolio.')
        return p
    def snapshot(self):
        perms=self.permissions()
        bd=self.get('/portfolios/'+perms['portfolio_uuid'],{'currency':'USD'}).get('breakdown') or {}
        bal=bd.get('portfolio_balances') or {}
        equity=_num(bal.get('total_balance'))
        if equity is None:raise AccountError(502,'Portfolio total balance missing from Coinbase response.')
        fee=(self.get('/transaction_summary').get('fee_tier') or {})
        orders=[];cursor=None
        for _ in range(5):
            q={'order_status':'OPEN','limit':250}
            if cursor:q['cursor']=cursor
            page=self.get('/orders/historical/batch',q);orders+=page.get('orders') or []
            if not page.get('has_next') or not page.get('cursor'):break
            cursor=page['cursor']
        stops={}
        for o in orders:
            if str(o.get('side','')).upper()!='SELL':continue
            for cfg in (o.get('order_configuration') or {}).values():
                if not isinstance(cfg,dict):continue
                stop=_num(cfg.get('stop_price') if cfg.get('stop_price') is not None else cfg.get('stop_trigger_price'))
                size=_num(cfg.get('base_size'))
                if stop and size:stops.setdefault(o.get('product_id'),[]).append({'stop':stop,'qty':size,'limit':_num(cfg.get('limit_price')),'orderId':o.get('order_id')})
        positions=[];cash=0.0
        for sp in bd.get('spot_positions') or []:
            asset=str(sp.get('asset','')).upper();value=_num(sp.get('total_balance_fiat')) or 0.0;qty=_num(sp.get('total_balance_crypto')) or 0.0
            if sp.get('is_cash') or asset in ('USD','USDC'):
                cash+=_num(sp.get('available_to_trade_fiat')) or 0.0;continue
            if value<1:continue
            product=asset+'-USD';price=value/qty if qty>0 else None;st=stops.get(product,[])
            covered=min(qty,sum(s['qty'] for s in st));risk=sum(max(0.0,(price or 0)-s['stop'])*s['qty'] for s in st)
            positions.append({'asset':asset,'product':product,'qty':qty,'valueUSD':value,'price':price,'stops':st,'coveredQty':covered,'unprotectedUSD':max(0.0,qty-covered)*(price or 0),'stopRiskUSD':risk})
        taker=_num(fee.get('taker_fee_rate'));maker=_num(fee.get('maker_fee_rate'))
        return {'asOf':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'portfolioType':perms.get('portfolio_type'),'equity':equity,'cash':cash,
                'fees':{'taker':taker,'maker':maker,'tier':fee.get('pricing_tier')},'positions':positions,
                'openStopRisk':sum(p['stopRiskUSD'] for p in positions),'unprotectedUSD':sum(p['unprotectedUSD'] for p in positions)}
    def fills(self,product,days=120):
        start=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()-days*86400));out=[];cursor=None
        for _ in range(10):
            q={'product_ids':product,'limit':250,'start_sequence_timestamp':start}
            if cursor:q['cursor']=cursor
            page=self.get('/orders/historical/fills',q);got=page.get('fills') or [];out+=got
            cursor=page.get('cursor')
            if not got or not cursor:break
        res=[]
        for f in out:
            price=_num(f.get('price'));size=_num(f.get('size'))
            if not price or not size:continue
            qty=size/price if f.get('size_in_quote') else size
            res.append({'tradeId':f.get('trade_id'),'orderId':f.get('order_id'),'time':f.get('trade_time'),'side':str(f.get('side','')).upper(),'price':price,'qty':qty,'fee':_num(f.get('commission')) or 0.0,'product':f.get('product_id')})
        res.sort(key=lambda f:(str(f['time']),str(f['tradeId'])))
        return {'product':product,'fills':res}
