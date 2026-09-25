import numpy as np
from scipy.stats import norm
from scipy.optimize import least_squares
g=0.5772156649
def emax(N):  # expected max of N std normals (Bailey et al.)
    return (1-g)*norm.ppf(1-1/N)+g*norm.ppf(1-1/(N*np.e))
def psr(sr,sr0,T,sk,ku):
    return norm.cdf((sr-sr0)*np.sqrt(T-1)/np.sqrt(1-sk*sr+(ku-1)/4*sr**2))

print("=== 1. DSR vs paper example (SR_ann 2.5, T=1250, skew -3, kurt 10, N=100, V_ann 0.5) ===")
sr=2.5/np.sqrt(250); V=0.5/250
sr0=np.sqrt(V)*emax(100)
print("SR0 daily=%.5f  DSR=%.4f (paper 0.9004)"%(sr0,psr(sr,sr0,1250,-3,10)))
# same with excess kurtosis convention
print("  if excess kurtosis used by mistake: %.4f"%psr(sr,sr0,1250,-3,7))
# null variance 1/T mistake
print("  if V=1/T used instead of family dispersion: %.4f"%psr(sr,np.sqrt(1/1250)*emax(100),1250,-3,10))

print("\n=== 2. MinBTL (years) for target SR=1 ===")
for N in [13,45]:
    print("N=%d  MinBTL=%.2f yrs  (upper bound 2lnN=%.2f)"%(N,emax(N)**2,2*np.log(N)))
for yrs in [3,5]:
    Ns=[n for n in range(2,500) if emax(n)**2<=yrs]
    print("%d yrs of data -> max configs = %d"%(yrs,max(Ns)))

print("\n=== 3. Sample-vs-population SD inflation ===")
for n in [12,20]: print("n=%d: %.2f%%"%(n,(np.sqrt(n/(n-1))-1)*100))

print("\n=== 4. N=1 edge case ===")
print("emax(1) =",emax(1))

print("\n=== 5. Paper's second example: same inputs, N=46 trials ===")
sr=2.5/np.sqrt(250); V=0.5/250
print("DSR(N=46)=%.4f (paper 0.9505)"%psr(sr,np.sqrt(V)*emax(46),1250,-3,10))
