import json, numpy as np, itertools, math
D=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'jsdump.json'))); B=np.array(D['bars']); O,H,Lo,C=B.T; n=len(C)
cfg=dict(tgt=.1,stp=.05,hold=30,cost=.008)
def sr(a):
    a=np.asarray(a,float)
    if len(a)<2: return 0.0
    s=a.std(ddof=1)
    return 0.0 if not np.std(a)>1e-10 else a.mean()/s
def sma(x,k): 
    o=[None]*len(x); cs=np.cumsum(np.r_[0,x])
    for i in range(k-1,len(x)): o[i]=(cs[i+1]-cs[i+1-k])/k
    return o
def rsi(x,k):
    d=np.diff(x); o=[None]*len(x); g=l=0.0
    for i in range(1,len(x)):
        u=max(d[i-1],0); w=max(-d[i-1],0)
        if i<=k:
            g+=u; l+=w
            if i==k: g/=k; l/=k; o[i]=100-100/(1+g/l) if l else 100
        else:
            g=(g*(k-1)+u)/k; l=(l*(k-1)+w)/k; o[i]=100-100/(1+g/l) if l else 100
    return o
def signal(st,p):
    s=[0]*n
    if st=='ma':
        f=sma(C,round(p['fast'])); w=sma(C,round(p['slow']))
        for i in range(n):
            if f[i] is not None and w[i] is not None and f[i]>w[i]*(1+p['thr']/100): s[i]=1
    elif st=='rsi':
        r=rsi(C,round(p['per']))
        for i in range(n):
            if r[i] is not None and r[i]<p['os']: s[i]=1
    else:
        L=round(p['look']); X=max(1,round(L/2)); on=0
        for i in range(L,n):
            if not on and C[i]>H[i-L:i].max(): on=1
            elif on and C[i]<Lo[i-X:i].min(): on=0
            s[i]=on
    return s
def engine(sig):
    trades=[]; bar=[0.0]*(n-1); pos=None
    for i in range(1,n):
        if pos is None:
            if sig[i]==1 and sig[i-1]==0: pos=(C[i],i)
            continue
        e,ei=pos; sp=e*(1-cfg['stp']); tg=e*(1+cfg['tgt']); x=None
        if Lo[i]<=sp: x=min(O[i],sp)
        elif H[i]>=tg: x=max(O[i],tg)
        elif i-ei>=cfg['hold']: x=C[i]
        if x is None: bar[i-1]=(C[i]-C[i-1])/C[i-1]
        else:
            bar[i-1]=(x-C[i-1])/C[i-1]-cfg['cost']; trades.append((x-e)/e-cfg['cost']); pos=None
    return trades,bar
def pbo(R,S=12):
    R=np.array(R); N,T=R.shape; m=T//S; lam=[]
    for c in itertools.combinations(range(S),S//2):
        cs=set(c); I=np.concatenate([np.arange(b*m,(b+1)*m) for b in range(S) if b in cs]); Oo=np.concatenate([np.arange(b*m,(b+1)*m) for b in range(S) if b not in cs])
        si=[sr(r[I]) for r in R]; so=np.array([sr(r[Oo]) for r in R]); b=int(np.argmax(si))
        w=((so<so[b]).sum()+((so==so[b]).sum()+1)/2)/(N+1); lam.append(math.log(w/(1-w)))
    return np.mean(np.array(lam)<=0)
def decay(R,S=8):
    R=np.array(R); N,T=R.shape; h=T//2; b=int(np.argmax([sr(r[:h]) for r in R])); m=(T-h)//S
    out=[sr(R[b][h+k*m:h+(k+1)*m]) for k in range(S) if m>3]
    return sr(R[b][:h]), np.mean(out)
tol=1e-9; bad=[]
for st,F in D['fam'].items():
    # indicators
    js_sma=F['sma']; py_sma=sma(C,20)
    if any((a is None)!=(b is None) or (a is not None and abs(a-b)>1e-6*abs(b)) for a,b in zip(js_sma,py_sma)): bad.append(st+' sma')
    js_r=F['rsi']; py_r=rsi(C,14)
    if any((a is None)!=(b is None) or (a is not None and abs(a-b)>1e-7) for a,b in zip(js_r,py_r)): bad.append(st+' rsi')
    R=[]
    for k,p in enumerate(F['params']):
        s=signal(st,p)
        if s!=F['sig'][k]: bad.append(f'{st} signal {p} ({sum(a!=b for a,b in zip(s,F["sig"][k]))} diffs)')
        t,bar=engine(F['sig'][k])
        if len(t)!=len(F['trades'][k]) or np.max(np.abs(np.array(t)-np.array(F['trades'][k])),initial=0)>tol: bad.append(f'{st} trades {p}')
        if np.max(np.abs(np.array(bar)-np.array(F['bar'][k])))>tol: bad.append(f'{st} bar {p}')
        R.append(bar)
    Rf=[r for r in R if any(v!=0 for v in r)]
    pp=pbo(Rf); dj=F['pbo']['pbo']
    print(f'{st}: PBO js={dj:.6f} py={pp:.6f}', 'OK' if abs(pp-dj)<1e-12 else 'MISMATCH')
    di=decay(Rf); print(f'{st}: decay js=({F["dec"]["isSR"]:.6f},{F["dec"]["osSR"]:.6f}) py=({di[0]:.6f},{di[1]:.6f})')
print('diffs:',bad if bad else 'none')
F=D['fam']['ma'];k=[i for i,p in enumerate(F['params']) if p=={'fast':5,'slow':30,'thr':0}][0]
s=signal('ma',F['params'][k]);i=[j for j in range(n) if s[j]!=F['sig'][k][j]][0]
from fractions import Fraction
ex=lambda j,m: float(sum(Fraction(x) for x in C[j-m+1:j+1])/m)
print('bar',i,'js sig',F['sig'][k][i],'py sig',s[i],'exact fast',repr(ex(i,5)),'exact slow',repr(ex(i,30)), 'diff',ex(i,5)-ex(i,30))
