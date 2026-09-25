import json,math,numpy as np
from scipy.stats import norm
D=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'pooldump.json')));g=0.5772156649
cfg=dict(stp=.1,hold=365,cost=.01)
def sr(a):
    a=np.asarray(a);return 0.0 if not np.std(a)>1e-10 else a.mean()/a.std(ddof=1)
def eng(bars,sig):
    t,O,H,Lo,C=np.array(bars).T;n=len(C);mu=np.mean(C[1:]/C[:-1]-1);x=np.zeros(n-1);k=0;pos=None
    for i in range(1,n):
        if pos is None:
            if sig[i]==1 and sig[i-1]==0: pos=(C[i],i)
            continue
        e,ei=pos;sp=e*(1-cfg['stp']);xx=None
        if Lo[i]<=sp: xx=min(O[i],sp)
        elif sig[i]==0: xx=C[i]
        elif i-ei>=cfg['hold']: xx=C[i]
        x[i-1]=((xx if xx is not None else C[i])-C[i-1])/C[i-1]-(cfg['cost'] if xx is not None else 0)-mu
        if xx is not None: k+=1;pos=None
    return {int(t[i]//86400):x[i-1] for i in range(1,n)},k
S=[]
for a,b in zip(D['sigA'],D['sigB']):
    xa,ka=eng(D['A'],a);xb,kb=eng(D['B'],b);keys=sorted(set(xa)|set(xb))
    S.append((np.array([np.mean([d[k] for d in (xa,xb) if k in d]) for k in keys]),ka+kb))
Z=np.array([x for x,k in S if k>0]);cm=np.corrcoef(Z);N=len(Z);rho=min(.99,max(0,(cm.sum()-N)/(N*(N-1))))
fam=[sr(x) for x,k in S if k>=5];V=np.var(fam,ddof=1)
bi=max((sr(x),i) for i,(x,k) in enumerate(S) if k>=10)[1];x=S[bi][0]
m=x.mean();sd=x.std(ddof=1);sp=x.std();sk=((x-m)**3).mean()/sp**3;ku=((x-m)**4).mean()/sp**4
Ne=max(rho+(1-rho)*45,2);s0=math.sqrt(V)*((1-g)*norm.ppf(1-1/Ne)+g*norm.ppf(1-1/(Ne*math.e)))
d=norm.cdf((m/sd-s0)*math.sqrt(len(x)-1)/math.sqrt(1-sk*m/sd+(ku-1)/4*(m/sd)**2))
J=D['js']
for k,a,b in [('winner idx',bi,J['bi']),('trades',S[bi][1],J['n']),('bars (union)',len(x),J['T']),('rho',rho,J['rho']),('varSR',V,J['varSR']),('SR0',s0,J['sr0']),('SR',m/sd,J['sr']),('DSR',d,J['dsr'])]:
    print(f'{k:12s} py={a:.10g} js={b:.10g}','OK' if abs(a-b)<=1e-6*max(1,abs(a)) else 'DIFF')
