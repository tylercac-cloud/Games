# Current release notice

Read README.md and RELEASE-REVIEW.md first. The historical content below is preserved for provenance; its old source paths, fee claims and live-trading wording may be superseded. Canonical source is src/lab/ and src/desk/.

---

# Edge Lab v5 — Method

All formulas below are implemented in `edge-lab/edge-lab-v5.html` between the markers `/* ============ normal distribution` and `/* ============ header`. `tests/extract_core.js` pulls exactly that block out for testing.

---

## 1. Return stream

For each config, the engine produces per-bar returns `r_t` (flat bars = 0; exit bar includes the round-trip cost). Let `μ` = the asset's mean per-bar simple return over the loaded sample, and `inPos_t` = 1 on bars held in a position.

**Excess stream:** `x_t = r_t − inPos_t · μ`

Every statistic uses `x_t`. This removes the return a long-only rule earns just by being exposed to a rising asset.

## 2. Sharpe

`SR = mean(x) / sd(x)` with sample SD (n−1). Zero-variance series → 0. Annualized: `SR · √(bars per year)`; bars per year = 31,557,600 / median bar spacing in seconds (365.25 for daily crypto).

## 2b. Pooling across assets

For each config, every asset *a* produces its own excess stream `x_a,t` (drift-adjusted with **that asset's** mean return). The pooled stream is the equal-weight average over the assets that have data on date *t*: `x_t = mean{ x_a,t : a listed on t }`. Dates are aligned by UTC day for daily data (by timestamp otherwise); datasets must share a candle size and all be dated (or all undated). Trades are summed across assets (the 10-trade minimum applies to the total) and time-ordered by exit date for display. Everything downstream (Sharpe, DSR, PBO, retention, power) is computed on the pooled stream exactly as for one asset, so cross-asset correlation is reflected in the pooled stream's own volatility — no correlation estimate needed.

**Trial accounting.** Each register entry lists the datasets it touched (`comps`). The effective trial count for a test is the sum over every real entry that touched **any** dataset in the current test.

## 3. Deflated Sharpe Ratio (the verdict)

Expected maximum Sharpe of N zero-skill trials (γ = 0.5772…):

`SR₀ = √V · [ (1−γ)·Φ⁻¹(1 − 1/N) + γ·Φ⁻¹(1 − 1/(N·e)) ]`

- `V` = sample variance of per-bar Sharpe across the family's configs with 5+ trades (needs ≥4).
- `N` = effective trials **on this dataset** = Σ over register entries of `ρᵢ + (1−ρᵢ)·Mᵢ` (Mᵢ configs in entry i, ρᵢ its measured mean pairwise correlation of `x` streams; single-config entries count 1; entries assumed independent of each other). Floored at 2 for sweeps.

Probabilistic Sharpe, with raw kurtosis κ and skew s:

`DSR = Φ( (SR − SR₀)·√(T−1) / √(1 − s·SR + (κ−1)/4 · SR²) )`

T = number of bars. If the variance term ≤ 1e-6 the result is "not computable" (no clamping). **Pass if DSR ≥ 0.95** and the dataset's effective trials are within budget (if a budget is set).

**Pre-registered test:** a single config that is the only trial ever run on the dataset uses SR₀ = 0 (nothing was selected).

**Sweep winner:** best excess Sharpe among configs with ≥10 trades (fallback ≥5). Fewer than 10 trades in the evaluated config → "not enough trades".

## 4. Power

Minimum detectable annualized excess Sharpe at ~80% power (z₀.₉₅ + z₀.₈₀ = 2.4865), years = T / bars-per-year:

- Pre-registered: `MDS = 2.4865 / √years`
- After a run: `MDS = SR₀,annual + 2.4865 / √years` (uses the observed luck threshold)
- Budget-tab planning (no run yet): fixed point `s = √(1/y + s²(N−1)/N²) · E_max(N) + 2.4865/√y` — conservative because real families are correlated.

## 5. Budget (MinBTL)

Largest N such that `√(1/years) · E_max(N) < target Sharpe`. 5 years → 45, 3 years → 13 at target 1.

## 6. PBO (warning only)

CSCV: split `x` into S = 12 blocks; for each of C(12,6) = 924 halvings, pick the in-sample best config, find its out-of-sample rank ω (mid-rank on ties) among N configs, λ = ln(ω̄/(1−ω̄)), ω̄ = rank/(N+1). PBO = share of splits with λ ≤ 0. On pure noise PBO ≈ 0.5 ± 0.2, and it is ≈ random when all configs share a real edge — hence not a veto.

## 7. Forward retention (warning only)

Pick the best config on the first half of `x`; mean Sharpe over 8 equal blocks of the second half ÷ first-half Sharpe. Below 40% → "edge may be fading" warning.

## 8. Signals

- **MA crossover**: 1 while SMA(fast) > SMA(slow)·(1 + thr%). Sweep: fast {5,10,20,40} × slow {30,50,80,120} × thr {0,0.5,1.5}, fast < slow → 45 configs.
- **RSI oversold**: 1 while Wilder RSI(period) < level. Sweep: period {7,14,21} × level {20,25,30,35} → 12 configs. In signal-exit mode the trade closes when RSI recovers above the level.
- **Donchian breakout**: turns on at a close above the prior N-bar high, off at a close below the prior round(N/2)-bar low. Sweep: N {10,20,40,60} → 4 configs.

## 8c. Next action (translating a config to an order)

`nextAction(bars,st,p,cfg)` reconstructs position state exactly as `runEngine()` does (enter only on a fresh 0->1 cross; exit on stop/target/signal-off/max-hold), so a flat rule whose condition is already satisfied is reported as **not armed** — no false entry. For MA it returns the closed-form next-bar close that flips the fast/slow relation (`maTriggerClose`), which is the price to watch — the MA level itself is not, since one candle barely moves a long average. RSI reports direction, not a single price (oversold needs sustained down-closes). Breakout is already a price level. The bracket states stop-first priority (checked intrabar, worse-of-open/stop on a gap), the signal/target exit, and the max-hold expiry date. Sizing is illustrative (2% of $5,000, split across pooled assets), not an enforced limit. It decides nothing; `judge()` owns pass/fail.

## 9. Engine rules

- Entry: close of bar i when signal goes 0→1.
- Exit checks from bar i+1: stop (low ≤ entry·(1−stop%) → fill min(open, stop)); then target in fixed mode (high ≥ target → fill max(open, target)) or signal-off in signal mode (fill at close); then max hold (close).
- One exit per bar; no re-entry until the signal goes 0→1 again.
- Cost: round-trip % subtracted once at exit. Default 1.0% (Coinbase Advanced US entry tier from 2026-09-16: 0.50% maker / 0.90% taker per side).

## 10. Kelly (sizing tab)

Wilson 95% lower bound p_lo on win rate; Kelly f = p − (1−p)/b at p_lo; recommendation = f/2. Valid only for fixed-size wins/losses (R-multiple b).

## 11. Journal

Signed slippage (adverse positive). Verdict on per-trade return expectancy with a 95% normal CI; ≥30 trades required to read.
