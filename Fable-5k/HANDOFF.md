# Current release notice

Read README.md and RELEASE-REVIEW.md first. The historical content below is preserved for provenance; its old source paths, fee claims and live-trading wording may be superseded. Canonical source is src/lab/ and src/desk/.

---

# Fable 5k Project — Handoff Brief

Read this whole file before touching anything, then AGENTS.md before changing any code. It is written for an AI assistant (or a human) picking up this project cold. Last updated: 2026-09-22 (audit pass 9). Read REVIEW.md for current safeguards and limitations.

---

## 1. What this project is

The owner has **$5,000** dedicated to a crypto research/trading experiment, using **Coinbase Advanced (spot, long-only)**. The goal is to build evidence before considering larger capital. The owner does not want to lose the account and becomes uncomfortable around a **$1,000 loss**; do not describe the full amount as expendable tuition. The app does not enforce account-level loss limits.

The project started as an AI-automation service for small Texas accounting firms ("Comal Automation"). That was **shelved before launch**; its files are kept in `comal-automation/` for reference only.

The central tool is **Edge Lab**, a single-file browser app that answers one question honestly: *"Does this trading rule have a real edge, or did I just find the luckiest of many things I tried?"*

## 2. How the owner wants to work

- Direct, concise, commercial. No filler, no pleasantries, no generic definitions.
- **Show the full step-by-step math. Never assume missing values. Flag uncertainty openly.**
- Make a clear recommendation rather than an open-ended menu.
- Preserve capital and research honesty; respect the stated $1,000 loss discomfort.
- The owner does not code. Deliver working files, not code snippets to paste.
- Distinguish accounting profit from cash; always show fees, slippage and tax drag.

## 3. The non-negotiable rules for anyone working on this

1. **Never tune a strategy on the bundled BTC data to make it look profitable.** Every configuration you try is a trial. The best-looking result of many trials is the luckiest one. Test strategy *design* changes on synthetic data with a known planted edge (see `tests/sims/`), not on BTC.
2. **Disclose every look at real data.** If you run a sweep on BTC (including inside tests), tell the owner which configs and what verdict, so it can be logged in the register. `tests/run_all.sh` runs real BTC sweeps in its end-to-end block — that is disclosed in the script.
3. **Buy-and-hold is the benchmark.** All statistics use returns *in excess of simply holding the asset for the same bars*. A long-only rule on an asset that rose 200× looks brilliant by accident otherwise (this was the worst bug in the project's history — see CHANGELOG pass 4).
4. **Do not claim "bug-free" or "enough power".** Report what was tested, what passed, and what wasn't tested. Power is limited by years of data (see §6).
5. **Never execute trades or handle credentials.** The owner presses the buttons.
6. **Every verdict change must be validated in simulation for both false-pass rate (null data) and detection rate (planted edge)** before shipping. Numbers, not reasoning.

## 4. Files

| Path | What it is | Status |
|---|---|---|
| `src/` + `build.js` | **Source of the app**: `core.js` (stats/engine/`nextAction`/`COINS` registry), `ui.js` (page logic, storage, data persistence), `shell.html` (markup), `data/` (bundled prices). `node build.js` rebuilds the app byte-for-byte. Add a coin by adding one line to `COINS` in `core.js`. | Current |
| `edge-lab/edge-lab-v5.html` | Self-contained browser app with 3,402 bundled BTC/USD daily bars, 2015-01-01 → 2024-04-24. Built from src. The externally hosted copy was not updated by this audit. | **Current.** Audit pass 9. |
| `screener/screener-v2.html` | Solana token rug-risk checklist. Optional live lookup of mint/freeze authority and top-holder concentration via Solana public RPC (works when opened as a local file; hosted/sandboxed pages block it). | **Current.** Audit pass 7. |
| `tests/` | Release gate, independent Python reference and calibration simulations. See `tests/README.md` and `REVIEW.md`. | Audit 9 coverage. |
| `METHOD.md` | The statistical method, formulas, and why each choice was made. | Current |
| `CHANGELOG.md` | Every audit pass, every bug, with the evidence. | Current |
| `AGENTS.md` | **How an AI agent (e.g. Astra) should make changes**: the test loop, where the verdict code lives, the simulation gate, golden values. | Current |
| `archive/` | Earlier versions and their docs (v1, v2 as shipped, screener v1), byte-identical to the originals. Kept for diffing only — **do not use**; v2 crashes before rendering a verdict and screener v1 scores an all-Unknown token as low risk. | Historical |
| `comal-automation/` | Shelved business launch kit, byte-identical to the originals; both HTML pages load and click without script errors. Content (pricing, claims, email copy) was not re-reviewed. | Shelved |

**Hosted copy:** the owner also has v5 published as a Claude artifact with a private cloud-saved register. Outside Claude, the file falls back to browser `localStorage`, and if that is blocked, to a copy/paste text box. To move the register between environments use **Register → Download backup file / Import**. The backup format is:

```json
{"format":"edge-lab","version":3,"exported":"ISO date","budget":{...}|null,
 "hyp":[{ "id","t","st","p","spent","why","n","sr","srBasis","pbo","ret","rho","data","cfg","lockId" }],
 "locks":[{ "id","locked","data","comps","st","p","cfg","why","sweep","sig" }],
 "trades":[{ "d","sym","rule","slip","pnl","ret" }]}
```

Import merges on content signatures, not ID alone. These signatures still omit some fields, so the merge is not a complete forensic record; retain original backups.

Audit 9 adds `snapshots` (tag, row count, date range and OHLC fingerprint) to newly created locks and trials; backup format remains v3. Existing v2/v3 backups remain importable. Historical locks are preserved, but active locks are session-only. Local records are not tamper-proof. See REVIEW.md for remaining deduplication/persistence limitations.

## 5. How Edge Lab works (short version — full detail in METHOD.md)

1. **Load data**: bundled BTC, a pasted CSV (any OHLC export; quote-aware), or synthetic noise for practice (practice runs don't count against real budgets).
2. **Budget tab**: years of data → how many configurations can be searched before a fake Sharpe of 1 becomes the *expected* result (Bailey et al. MinBTL: 5 years → 45, 3 years → 13). Also shows the smallest edge detectable at 80% power.
3. **Test**: pick a strategy family (MA crossover, RSI oversold, Donchian breakout), exit rule (default: exit when signal turns off, 10% stop; alternative: fixed target/stop/time), cost (default 1.0% round trip = Coinbase Advanced US entry-tier maker 0.50% × 2 since 2026-09-16; taker both sides is 1.8%), and state the mechanism. Run a single config or a pre-defined sweep.
4. **Engine**: entry at the signal bar's close on a 0→1 transition; exit priority stop (fill at worse of open and stop) → target (fixed mode) or signal-off (signal mode) at close → max hold. One engine feeds every statistic.
5. **Statistics** (all on per-bar returns in excess of holding):
   - **Deflated Sharpe Ratio** decides the verdict (bar 0.95). Deflated by effective trials on *that dataset*, using correlation measured from the sweep.
   - **Pre-registered test**: a single config that is the only trial ever run on a dataset is judged with no deflation — the most powerful test available.
   - **PBO** (CSCV, 924 splits) and **forward retention** are shown as **warnings, not vetoes** (they destroyed power without reducing false passes — CHANGELOG pass 6).
   - Every verdict states the **minimum detectable annualized excess Sharpe** at ~80% power.
6. **Trade this rule (after every run)**: the result card ends with the concrete order the evaluated config implies now, per asset, from the latest bar — position state (in/flat), the exact price or level that flips it next bar, the stop/target/max-hold bracket in dollars, and an illustrative 2%-of-$5,000 size. A **passing** rule shows it as the rule's instruction; a **failing** rule shows the same mechanics under a "did NOT survive testing" banner. Entry is at the bar close. `nextAction()` in `src/core.js`, tested against `signal()`.
7. **Pooling (Data → "Pool several assets")**: load a dataset, name it, add it; repeat; tick "Run tests on the pool". The same rule runs on every asset, each measured against holding that asset; the verdict judges the equal-weight portfolio of the results (on each date, only assets that existed then). Pooled trials count against **every** member dataset, so pooling BTC does not reset BTC's search history. Pool data lives in the tab only.
8. **Register**: every run is logged with configs spent, measured correlation, dataset, exit settings. Clearing it resets deflation — the app warns. Loaded price data (single series and the pool) also persists across reloads and is restored on open; synthetic data is not persisted.
9. **Kelly tab**: sizing on the lower confidence bound of win rate; valid only for fixed-size win/loss strategies.
10. **Journal**: live trades with signed slippage; verdict on per-trade expectancy with a 95% CI (not win rate).

## 6. Power — the hard limit (read this before promising anything)

Power comes from **years of independent data and the size of the edge**, not from the statistic. All figures are simulations on 3,400-bar series (9.3 years daily) at 0.8% cost unless noted; scripts in `tests/sims/`.

| Test | Planted edge (winner's annualized excess Sharpe) | Detected |
|---|---|---|
| One pre-registered config | at the predicted threshold 0.81 | 77% (300 runs) |
| MA sweep, 45 configs | ~1.10 | 12/14 (also 12/14 at 1.0% cost) |
| MA sweep | ~0.70 / ~0.54 | 3/14 / 1/14 |
| RSI sweep, 12 configs (mean-reversion edge) | ~1.04 / ~0.51 | 13/25 / 3/25 |
| Breakout sweep, 4 configs (trend edge) | ~1.03 / ~0.51 | 25/25 / 7/25 |

**False passes on null data (no timing edge): 1 of 377 series (0.3%)** — MA 167 (BTC-like drift, no drift, fat-tailed GARCH), RSI 90, breakout 120. The one pass was an MA sweep on a drifting series (seed 212); it passes at both 0.8% and 1.0% cost. The 0.95 bar nominally allows 5%, so the test is conservative.

Every verdict prints the minimum detectable Sharpe for that exact run; the Budget tab prints a conservative planning figure before any run (0.81 for one pre-registered test, 1.75 for a 45-config sweep on 9.3 years).

**Pooling across assets** (simulated MA sweeps, 3 coins, crypto-like noise correlation 0.7, BTC-like drift):

| Setup | Single asset | Pooled |
|---|---|---|
| Coins listing ⅓ and ⅔ of the way in (like ETH/SOL), separate edges | 26/150 (17%) | 44/150 (29%) |
| Same, one shared edge | 39/150 (26%) | 46/150 (31%) |
| Weaker separate edges | 9/150 | 9/150 (no gain) |
| All coins full history, correlation 0.7 | 35/150 (23%) | 72/150 (48%) |
| All coins full history, correlation 0.3 | 29/150 (19%) | 92/150 (61%) |

Pooled false passes on null data: 6 of 1,800 (0.3%) across correlations 0.2–0.8 and all three families. Gains are real but modest when coins move together and history is staggered — which is the crypto case.

**The only real levers:** pre-register one hypothesis; add independent data (pooling other assets, BTC after 2024-04-24 as a holdout); search fewer configs. Faster bars (4h/1h) add bars, not years — they help only if the edge itself is short-horizon.

## 7. Where things stand

- **Real-data trials already spent on bundled BTC** (by the owner and by assistants during audits): MA, RSI and breakout sweeps under both exit rules, plus earlier v1–v2 runs. None survived deflation under the current method. At the current defaults (signal exits, 10% stop, 1.0% cost): MA sweep DSR 0.908 (excess Sharpe 0.66 vs luck threshold 0.23, PBO 77%), breakout DSR 0.820 (0.66 vs 0.36, forward-retention warning), RSI DSR 0.024. **Do not re-tune around this result** — that is exactly the selection bias the tool exists to prevent.
- Bundled data ends 2024-04-24 on purpose: everything after is untouched and usable as a genuine holdout for **one** pre-registered test.
- The owner has not placed live trades from Edge Lab.

## 8. Open work, in priority order

1. **Cleanest powered test available now**: take the BTC sweep winner, pool **ETH + SOL only** (never searched), lock the exact single configuration, then run it. BTC in the pool would inherit BTC's search history. The one-click daily refresh includes BTC for broad monitoring, so remove BTC before this clean test.
2. **Holdout test**: BTC daily OHLC from 2024-04-25 → today, one pre-registered config (≈2.4 years → detectable Sharpe ≈1.6; underpowered, say so).
3. **Volatility-targeted sizing** as a strategy-design experiment (synthetic data first).
4. **Kelly tab** for continuous returns (f = μ/σ² on the lower CI of μ).
5. Screener: liquidity, LP-lock, deployer and age still require manual lookup; the public RPC can't see them.

## 9. Known limitations (not bugs, but must stay disclosed)

- Entry at the signal bar's close is mildly optimistic (you only know the close after it prints). The live slippage log is the correction.
- Effective-trials formula ρ̄ + (1−ρ̄)·M is the linear reading of an equation that was unreadable in the source PDF; it is the conservative choice.
- Drift benchmark uses the full-sample mean return (fine for a significance test, not a tradeable benchmark).
- Normal CDF uses Abramowitz–Stegun (error ≤1.5×10⁻⁷); DSR matches scipy to ~5×10⁻⁸.
- One exact floating-point tie (MA 5/30, bar 215, fast = slow = 283.212) resolves differently in JS vs Python. Immaterial; documented in the test output.
- Live Coinbase fetch is blocked in hosted/sandboxed pages; CSV paste always works.
- Bundled BTC closes sit within ~1% of CoinMarketCap-style aggregate prices on spot-checked dates (2020-03-08: 8,042.74 vs 8,108; 2017-12-17 high 19,927 vs 20,089) — single-exchange data, not an average. On the 2020-03-12 crash day the gap is larger, as exchanges diverged.
- Simulations used the MA, RSI and breakout families with planted trend or mean-reversion edges; real edges may look different.
- Trial accounting keys datasets by **coin** where the tag names one: bundled BTC and any Coinbase tag (`BTC-USD 86400s`, `ETH-USD 21600s`…) for the same pair share one history, so refreshing data never resets a coin's search count. CSV tags carry no coin name and count only against themselves — reuse the same file for the same coin, and don't paste a coin you've already searched as a new CSV to escape its history.
- Pooling weights assets equally and ignores volatility differences; a volatile coin dominates the pooled stream.
- Persisted price data is capped at 6,000 bars/series and stored whole (last-writer-wins); two tabs editing data can overwrite each other's saved copy (the register is unaffected — it stays per-item). Refreshed data overwrites the saved single series and pool.
- Cloud save is verified on every load by a write/read/delete self-test; the owner's hosted register was empty at export time (no cloud data to migrate).

## 10. Sources

Bailey & López de Prado, *The Deflated Sharpe Ratio* (J. Portfolio Management, 2014). Bailey, Borwein, López de Prado & Zhu, *Pseudo-Mathematics and Financial Charlatanism* (Notices of the AMS, 2014) and *The Probability of Backtest Overfitting* (J. Computational Finance, 2017). Lo, *The Statistics of Sharpe Ratios* (FAJ, 2002).
