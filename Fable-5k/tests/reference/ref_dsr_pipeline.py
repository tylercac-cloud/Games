import json,numpy as np,itertools,math
from scipy.stats import norm
D=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'v5dump.json')));O,H,Lo,C=np.array(D['bars']).T;n=len(C);g=0.5772156649
cfg=dict(tgt=.1,stp=.1,hold=365,cost=.008)
mu=np.mean(C[1:]/C[:-1]-1)
def sr(a):
    a=np.asarray(a);return 0.0 if not np.std(a)>1e-10 else a.mean()/a.std(ddof=1)
def eng(sig):
    x=np.zeros(n-1);ntr=0;pos=None
    for i in range(1,n):
        if pos is None:
            if sig[i]==1 and sig[i-1]==0: pos=(C[i],i)
            continue
        e,ei=pos;sp=e*(1-cfg['stp']);xx=None
        if Lo[i]<=sp: xx=min(O[i],sp)
        elif sig[i]==0: xx=C[i]
        elif i-ei>=cfg['hold']: xx=C[i]
        x[i-1]=((xx if xx is not None else C[i])-C[i-1])/C[i-1]-(cfg['cost'] if xx is not None else 0)-mu
        if xx is not None: ntr+=1;pos=None
    return x,ntr
E=[eng(s) for s in D['sig']]
act=[x for x,k in E if k>0]
Z=np.array(act);cm=np.corrcoef(Z);N=len(Z);rho=min(.99,max(0,(cm.sum()-N)/(N*(N-1))))
fam=[sr(x) for x,k in E if k>=5];V=np.var(fam,ddof=1)
elig=[(sr(x),i) for i,(x,k) in enumerate(E) if k>=10];bi=max(elig)[1];x=E[bi][0]  # k>=10 must mirror MIN_TRADES in the app
m=x.mean();sd=x.std(ddof=1);sp=x.std();sk=((x-m)**3).mean()/sp**3;ku=((x-m)**4).mean()/sp**4
Ne=max(rho+(1-rho)*45,2);s0=math.sqrt(V)*((1-g)*norm.ppf(1-1/Ne)+g*norm.ppf(1-1/(Ne*math.e)))
d=norm.cdf((m/sd-s0)*math.sqrt(len(x)-1)/math.sqrt(1-sk*m/sd+(ku-1)/4*(m/sd)**2))
J=D['res']
for k,a,b in [('winner idx',bi,J['bi']),('rho',rho,J['rho']),('effN',Ne,J['used']),('varSR',V,J['varSR']),('SR0',s0,J['sr0']),('skew',sk,J['sk']),('kurt',ku,J['ku']),('DSR',d,J['dsr'])]:
    print(f'{k:10s} py={a:.10g} js={b:.10g}', 'OK' if abs(a-b)<=1e-6*max(1,abs(a)) else 'DIFF')
