# Audit of the Method — findings

Two passes. The first found three bugs, one overstated claim, and one unresolved ambiguity. The second pass — because the first clearly hadn't been enough — found **three more**, including the worst one in the whole tool.

## Second pass: what the first pass missed

### 7. BUG (worst one) — the Deflated Sharpe was deflated by the wrong count

A parameter sweep of 45 configurations creates **one** register entry. The code deflated by `HYP.length` — entries — not by configurations searched. So a 45-config sweep was treated as a single trial.

The correct number was already being computed on one line of the file, and used only to print a total in the register table. It never reached the statistic that needed it. The error appeared in **six** places.

| Best Sharpe found | Old DSR (deflated by 1) | Correct DSR (deflated by 45) | |
|---|---|---|---|
| 0.40 | 0.9375 | 0.4035 | same verdict |
| **0.45** | **0.9621** | **0.5059** | **accept → reject** |
| **0.50** | **0.9778** | **0.6058** | **accept → reject** |
| **0.60** | **0.9930** | **0.7757** | **accept → reject** |
| **0.70** | **0.9980** | **0.8889** | **accept → reject** |

Half the tested range flips. Every strategy in that band would have been greenlit. Combined with finding #2, the tool had two independent bugs both pushing the same direction — toward approving things it should reject.

**Fixed:** all six sites now use configurations searched; the header budget counter now compares configs spent against configs allowed rather than mixing units.

### 8. BUG — small-sample Sharpe inflation

`moments()` divided by n rather than n−1. A smaller denominator means a larger Sharpe, so every result was biased upward — **4.45% at 12 trades**, 2.6% at 20, 1.3% at 40. Again in the permissive direction, and worst exactly where samples are smallest and judgement is hardest.

**Fixed:** sample standard deviation for the Sharpe; population moments retained for skewness and kurtosis, which is the conventional estimator pairing.

### 9. BUG — retention displayed 0% when it was undefined

If the best configuration in the first half already had a negative Sharpe, the retention panel showed 0%, which reads as total collapse. There is nothing to decay from. It now says so explicitly.

### Also closed a genuine gap in the first pass

The first pass verified DSR end-to-end but the fit was **insensitive to kurtosis** (values 7 through 15 all fit within 0.004), so the kurtosis convention was never actually pinned down. Checked independently against Lo (2002): for normal returns Var(SR) = (1 + SR²/2)/T. My denominator with raw kurtosis = 3 gives exactly 1.045000 at SR=0.3; the target is 1.045000. An excess-kurtosis reading would give 0.9775 — wrong. Convention confirmed as raw kurtosis, and `moments()` returns raw kurtosis (2.99 measured on 200,000 normal draws), so the two are consistent.

### Clean on second pass

- **No lookahead bias.** Truncation test on all three signals: the signal at bar k is bit-identical whether or not bars after k exist, across 244 checked points each.
- **Exit logic bounded and conservative.** No trade return exceeds target−cost or falls below stop+cost. Stop takes precedence over target within a bar.
- **Browser-feasible.** 45 configurations × 1,500 bars through 924 partitions: 1.3 seconds.
- **Block count isn't load-bearing.** PBO across S=6,8,10,12 spans 0.503–0.599 — a spread of 0.096, well inside the statistic's own noise.
- **Split counts are exactly C(S, S/2)** at every S tested.

---

# First pass findings

Six findings: three bugs, one overstated claim, one unresolved ambiguity, one thing that turned out fine.

---

## 1. Confirmed solid: the DSR reconstruction

The PDF mangled the equations, so I had reconstructed the paper's worked example by inference. That's weak evidence on its own, so I tested whether the reconstruction is **uniquely identified**.

Searching a grid of V[SR] × skewness × kurtosis against **two** independent targets (DSR = 0.9505 at N=46 and 0.9004 at N=100), exactly one value of V fits: **V = 0.50, skew = −3, kurt = 10, error 0.00000**. Kurtosis is weakly identified (7–15 all fit within 0.004), but V is pinned hard — DSR swings from 0.9936 to 0.1118 as V moves from 0.25 to 2.0.

Verdict: confirmed, not merely consistent.

## 2. BUG — the Deflated Sharpe used the wrong variance

**The most serious finding.** V[{SR}] is defined as the variance *across trials* of the estimated Sharpe ratios. I had used **1/n**, the null variance of a single Sharpe estimate.

On the paper's own example, the true dispersion is **2.5×** what 1/n gives:

| | Value |
|---|---|
| Paper's V (de-annualized) | 0.002000 |
| What my 1/n proxy gives | 0.000800 |
| **DSR with the paper's V** | **0.9004** — paper rejects |
| **DSR with my proxy** | **0.9933** — my tool accepts |

My tool would have greenlit a strategy the source paper explicitly rejects. The proxy is correct only when dispersion happens to equal the null; whenever configurations genuinely differ — the normal case — it is too lenient, and the verdict flips from reject to accept once true dispersion exceeds ~2× the null.

**Fixed:** now uses the family's empirical Sharpe dispersion, in per-trade units to match the selected strategy. For a single configuration there is no distribution, so it now reports "not computable" and tells you to run the sweep, rather than inventing a number.

## 3. BUG — Sharpe of a zero-variance series returned 1e10

`moments()` guarded division by zero with `sd || 1e-12`, so a constant return series produced a Sharpe of **ten billion**. A configuration that never traded, or returned the same value every bar, would win the in-sample selection inside PBO every time.

**Fixed:** degenerate series now return Sharpe 0. Verified a degenerate config can no longer beat a normal one in argmax.

## 4. OVERSTATED — PBO is far noisier than I presented it

I reported single PBO values (0.46, 0.654) as if they were stable signatures. They are draws from a wide distribution. Across 100 independent all-noise datasets:

| Strategies searched | Mean | **SD** | 5th–95th pct | Below my 0.25 "pass" line |
|---|---|---|---|---|
| 10 | 0.533 | 0.247 | 0.13–0.91 | **15%** |
| 20 | 0.495 | 0.209 | 0.15–0.82 | **16%** |
| 40 | 0.517 | 0.168 | 0.25–0.79 | 5% |

The mean is right where theory says (≈0.5). The **spread is the problem**: a single reading is ±0.4 at 95%, and roughly one pure-noise run in eight cleared my threshold.

Worse, **more data does not help**. SD stayed ≈0.20 from 600 bars to 5,000. You cannot buy your way out of this with more history.

And power is weak. Against a genuinely skilled strategy:

| True edge | PBO mean | Passes below 0.25 |
|---|---|---|
| 0.00σ/bar (none) | 0.519 | 10% |
| 0.05σ/bar (small, real) | 0.430 | **23%** |
| 0.10σ/bar | 0.176 | 75% |
| 0.20σ/bar | 0.001 | 100% |

A small but real edge is missed three times in four.

**Fixed:** threshold moved from 0.25 to 0.15 (the null's 5th percentile), and the tool now states the uncertainty on the panel itself. **Read PBO coarsely** — above 0.5 is bad news, below 0.15 is good news, the middle is uninformative. The Deflated Sharpe carries the actual decision, because it has a calibrated threshold and PBO does not.

## 5. UNRESOLVED — the effective-trials formula

The source equation was unreadable in the PDF. Two interpolations satisfy both stated limits (ρ→0 gives N̂→M; ρ→1 gives N̂→1) and they disagree enormously:

| Trials | ρ | Linear: ρ+(1−ρ)M | Power: M^(1−ρ) |
|---|---|---|---|
| 500 | 0.7 | 150.7 | 6.5 |
| 500 | 0.9 | **50.9** | **1.9** |

The published figure's banding supports linear, and linear is also the conservative direction — more effective trials means a higher bar. That's what runs. But it is an inference, not a reading, and I'd rather you know that than not.

## 6. Checked and fine

- **PBO implementations agree exactly.** Given identical data, the JavaScript and Python versions both return **0.3377** over 924 splits. The earlier 0.654-vs-0.392 gap was different random draws, not a code difference — which is what exposed finding #4.
- **The random generator is sound.** Chi-square uniformity 11.14 (passes at p=0.01), mean 0.4996, variance 0.0836 vs 1/12, no repeats in 200,000 draws. The Gaussian transform gives mean −0.0015, SD 0.9999, skew 0.0009, kurtosis 2.99, lag-1 and lag-2 autocorrelation under 0.003. The LCG's largest intermediate product is 7.1×10¹⁵ against the 9.0×10¹⁵ precision limit — tight, but inside it.
- **Bar-level and trade-level returns reconcile** to within 0.02% when compounded.
- **MinBTL unchanged** after all fixes: 5 years → 45 configurations, 3 years → 13. Hand-verified: at 3 years, N=13 gives E[max SR] = 0.983 and N=14 gives 1.004.
- **Degenerate inputs** return null rather than crashing or fabricating.

---

## What this changes about how you should use the tool

The budget and the Deflated Sharpe survive the audit and are the two things to trust. PBO demoted from a gate to a coarse sanity check. Forward retention stays as the only test that sees time.

And the general lesson is the one the whole method is about. v2 shipped with a statistic I'd sampled **once** and presented as a property; sampling it a hundred times showed a standard deviation nearly half the scale of the measure. Then the first audit missed a bug that made the tool's central number wrong by a factor of three, in the permissive direction, and it took a second pass to find it.

Six of the nine defects across both passes pushed the same way: toward accepting strategies that should be rejected. That is not coincidence. When you build something to validate your own ideas, the errors you fail to notice are disproportionately the ones that tell you what you want to hear. It is the exact failure the tool exists to catch, made twice by the person who built it — which is the best argument I can give you for why the register and the budget are not optional, and why you should keep asking me to check again.

Not financial advice. This measures; it does not predict.
