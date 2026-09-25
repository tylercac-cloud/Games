import numpy as np
from scipy.stats import norm
from scipy.optimize import least_squares
from itertools import combinations
g=0.5772156649
emax=lambda N:(1-g)*norm.ppf(1-1/N)+g*norm.ppf(1-1/(N*np.e))
def psr(sr,sr0,T,sk,ku): return norm.cdf((sr-sr0)*np.sqrt(T-1)/np.sqrt(np.maximum(1e-9,1-sk*sr+(ku-1)/4*sr**2)))
SR=np.array([.40,.45,.50,.60]); old=np.array([.9375,.9621,.9778,.9930]); new=np.array([.4035,.5059,.6058,.7757])

print("=== 5. Flip table consistency ===")
# old column: N=1 -> SR0 clamped to 0. Fit T,skew,kurt (3 params, 4 points)
f=lambda p: psr(SR,0,p[0],p[1],p[2])-old
r=least_squares(f,[17,0,3],bounds=([3,-10,1],[500,10,100]))
T,sk,ku=r.x; print("old fit: T=%.2f skew=%.3f kurt=%.3f  max resid=%.5f"%(T,sk,ku,abs(r.fun).max()))
# new column: same T,sk,ku, N=45, fit V
f2=lambda p: psr(SR,np.sqrt(p[0])*emax(45),T,sk,ku)-new
r2=least_squares(f2,[0.01],bounds=([1e-8],[5]))
print("new fit: V=%.5f  max resid=%.5f"%(r2.x[0],abs(r2.fun).max()))

print("\n=== 6. PBO on pure noise (CSCV, S=12 -> 924 splits, 45 configs) ===")
rng=np.random.default_rng(7)
combos=list(combinations(range(12),6))
def pbo(R,S=12):
    T,N=R.shape; B=np.array_split(np.arange(T),S); lam=[]
    for c in combos:
        IS=np.concatenate([B[i] for i in c]); OS=np.setdiff1d(np.arange(T),IS)
        sI=R[IS].mean(0)/R[IS].std(0,ddof=1); sO=R[OS].mean(0)/R[OS].std(0,ddof=1)
        best=np.argmax(sI); w=(sO<sO[best]).sum()+1  # rank 1..N
        w=w/(N+1); lam.append(np.log(w/(1-w)))
    return np.mean(np.array(lam)<=0)
for T in [600,3000]:
    v=np.array([pbo(rng.standard_normal((T,45))) for _ in range(100)])
    print("T=%d: mean=%.3f sd=%.3f p5=%.2f p95=%.2f  share<0.25=%.2f share<0.15=%.2f"%(T,v.mean(),v.std(),*np.percentile(v,[5,95]),(v<.25).mean(),(v<.15).mean()))
