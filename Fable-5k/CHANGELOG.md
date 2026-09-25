# Current release notice

Read README.md and RELEASE-REVIEW.md first. The historical content below is preserved for provenance; its old source paths, fee claims and live-trading wording may be superseded. Canonical source is src/lab/ and src/desk/.

---

# Edge Lab — Audit History

## Release 23.1 — live verification (2026-09-25)
- New `tests/desk/live_check.py` (62 checks) runs the real launcher with no key against the real Coinbase public API and drives both pages in Chromium; `--sim` runs it against the simulator. GitHub workflow `fable-live-check.yml` runs it on Linux and Windows. Both passed 62/62.
- Fixed (found against a real Ollama 0.34.4): Crypta's model download showed "NaN of 2.50 GB (NaN%)" and "NaN of 0.00 GB" because real Ollama sends a layer's total before any `completed`, then tiny layers. Missing `completed` now counts as 0 and only layers of 100 MB+ show GB progress. `fake_ollama.py` now sends the real stream shape; `e2e_crypta_local.py` fails on the old code (9/10) and passes on the fix (10/10).
- Fixed (found against a real Ollama 0.34.4): Ollama's `qwen3:4b` tag is now the Qwen3-4B Thinking-2507 build, which cannot switch reasoning off. With `think:false` its reasoning ("Okay, let's see... Wait...") went into Crypta's answer text, and the first plan answer took 8 min 54 s on a 4-core CPU. The launcher now reads each model's thinking options from Ollama's `/api/show`: models that can switch it off get `think:false`, always-thinking models get `think:true` so the reasoning comes back separately and is never shown. The lighter recommended download is now `qwen3:4b-instruct` (same 2.5 GB, no reasoning: 14 output tokens vs 281 for a one-line answer). An already downloaded `qwen3:4b` still works. `fake_ollama.py` now reports `/api/show` and reproduces the leak; new test `test_reasoning_never_reaches_the_answer` fails on the old launcher and passes on the fix.
- Verified on a real Ollama 0.34.4 after the fixes: download, local answers, go_to_tab and read_journal tools (`tests/desk/live_crypta_local.py`, 12/12).

## Release 23 — free local brain for Crypta (2026-09-24)
- Ollama support with one-click model download; brain selector; same tools and stream as Claude.

## Release 22 — Crypta upgrade (2026-09-24)
- Read-only tools to see any part of the app; cached full guide; Sonnet 5 default; number-aware guide answers; Alt+C, resize, tab-aware suggestions, copy/retry/new chat.

## Release 21 — Crypta (2026-09-24)
- In-app helper and installable taskbar window; guide mode without a key; AI mode via the launcher with fixed prompt/tools and a spending cap; secret guard; 3 new test suites.

## Release 20.1 — verification pass (2026-09-24)
- No application changes. Added real-browser click-everything test to the gate; extra random-session and property seeds; fallback-mode random session.

## Release 20 — real-browser and randomised testing (2026-09-24)
- 10 fixes (deposit detection, gapped stop-limits, transfer time zones, ticket staleness x2, backup of logged trips, local log dates, chart guard, dismissable prompt, desk-only journal automation). Property tests and a real-Chromium random session added to the gate.

## Release 19 — bug hunt (2026-09-24)
- Day-one funding excluded from deposits; trip proceeds prorated; local tax dates; timestamp normalisation; form cleared after one-tap; gap validation.

## Release 18 — less typing (2026-09-24)
- One-tap Journal logging for all coins; automatic deposit re-check; Closed-on date. Fixed: ticket/coin mismatch, false cooling-off from old trades, inflated log line after netting, single deposit check, single-coin import.

## Release 17 — ticket, equity log, review, cooling-off, deposits, tax CSV (2026-09-24)
- Six features, stored in the desk backup; simulated session extended to 22 steps.

## Release 16 — simulated trading pass (2026-09-24)
- Journal matches the plan made before the trade; account data uncached; 1 s price cache; cash capped at netted equity; missing quantity never zero risk. New stateful Coinbase simulator and trading-session test.

## Release 15 — second bug sweep (2026-09-23)
- Stale autofill values cleared on failure; asset-switch race fixed; late key pickup; stop-limit risk to limit + fee; USDC stops; quote-sized fills; fill de-dup; Exchange->Advanced fallback; proxy-safe loopback probe.

## Release 14 — bug sweep (2026-09-23)
- Fixed: autofill vs lab locks, manual fee overwrite, second-launch empty-register, key detection by content, Ed25519 401 guidance, Python/console robustness, stale expected price, whole-account warning. Added real-launcher end-to-end test.

## Release 13 — key-file detection (2026-09-22)
- Key lookup no longer requires a `.json` extension; detects by content so a misnamed/duplicated phone download still works, with a specific message for raw-text-only files.

## Release 12 — autofill and View-only account (2026-09-22)
- Linked inputs, self-filling Capital plan, Journal import from Coinbase fills, Sizing/Budget autofill. View-only key support (ES256/Ed25519) in the launcher; trade/transfer keys refused. New suites: account (12), autofill (15).

## Release 11 — live data (2026-09-22)
- Local launcher now proxies every public Coinbase route the pages use (Advanced scan, Exchange candles/stats/ticker) with specific failure diagnostics, certifi support, caching, `/health`, `--check` and port fallback.
- Desk Fetch switched to the hardened downloader (drops the in-progress candle). Listing loop tolerates ignored `limit`. `build.js` `$'` injection bug fixed.
- Live market strip (price, 24h change/range, USD volume, spread) in both tools; informational only.
- New suites: live proxy e2e against fake Coinbase (8), live strip/routing in both apps (12), listing termination (1). Gate passed; three mutations fail it.

## Data persistence + coin registry (2026-09-22)
- **Loaded price data now persists across reloads**, not just the register. The working single-asset series and the pool are packed compactly (t+OHLC arrays) and saved to the same store as the register (a `datasets` blob on the meta doc in db mode, its own key in localStorage). On load they are restored and the pool's on/off state with them; synthetic data is never persisted; the cap is 6,000 bars per series. New storage primitives `getDoc`/`setDoc` handle single-blob values (the register's per-item collections were wrong for this).
- **Coins are now a registry.** `COINS` in `src/core.js` is the one place a market is defined; the fetch dropdown, the market-pool refresh, `coinName()` and validation all derive from it. Adding a coin is a single line (verified: adding LINK-USD flows to the dropdown, refresh list and trial accounting automatically). `assetKey()` still groups a coin's sources (bundled/86400s/21600s) so trials count per coin.
- Tests: persistence round-trip via a mock db across two app instances (single dataset and pool both restore; pool re-activates), a break-`single` mutation fails the guard, and a coin-registry suite (ids are PAIR-USD, name resolution, source grouping). Gate: 174/174.

## Trade-panel accuracy audit (2026-09-22)
- Self-review of the trade panel found 5 gaps vs the engine, all fixed: (1) it implied entry whenever the condition was true, but the engine enters only on a fresh 0->1 cross — the panel disagreed with the engine on 1,691 bundled bars; now it reconstructs engine state exactly and reports "flat but not armed". (2) MA showed the moving-average *level* ($67.9k) as if it were the price to watch; the tradeable close is the exact closed-form solution ($107.4k). (3) RSI now states it needs sustained down-closes rather than a fake single price. (4) Bracket now states stop-first priority and gap-fill risk plus the max-hold expiry date. (5) Pooled sizing splits the 2% risk across assets (~$333/coin for 3) instead of implying one $1,000 position.
- Removed a fragile bisection trigger-solver (returned $74M) in favour of closed-form MA.
- Tests rewritten to check panel state against runEngine()'s own trade records on every bar (0 mismatches, all families/modes), the closed-form cross, the armed flag, bracket wording, expiry, and single-vs-pooled sizing. Three planted mutations (already-satisfied entry, level-as-price, inverted state) each fail the gate. Gate: 159/159.

## Trade-instruction panel (2026-09-22)
- Added `nextAction()` (pure, in `src/core.js`): turns the evaluated config into the concrete order for the next bar per asset — position state now, exact entry/exit trigger levels from current data, stop/target/max-hold bracket as dollar prices, and an illustrative 2%-of-$5,000 size.
- The result card renders it after the verdict. A **pass** frames it as the rule's instruction; a **fail** shows the same levels under a "did NOT survive testing" banner, so a rejected rule can't be traded by skipping the verdict. Empty before any run.
- Verdict/statistics math untouched; three golden BTC verdicts unchanged. `nextAction` is unit-tested against `signal()` (state match, exact cross/entry/stop/target levels, off-by-one guard on a flipping final bar) and the panel is UI-tested (empty→fail-banner→pass-order+sizing). An off-by-one mutant fails the guard.
- Gate: 154/154.

## Release review of audit 9 (2026-09-22, before shipping)
- Reviewed Astra's audit 9 against the prior release: every one of the 79 original named gate checks retained with unchanged patterns; golden BTC verdicts unchanged; `src/core.js` changes confined to candle download (validated: completed candles only, 15 s timeout, bounded 429 retries, impossible-OHLC rejection). No new outside domains. All new page text is escaped.
- **Fixed a trial-accounting loophole the one-click refresh made trivial.** Refreshed Coinbase BTC was tagged `BTC-USD 86400s`, a different name from bundled BTC, so its ~2.7 years of overlap with the searched bundled history carried **0** prior trials instead of **22.38**; the first test on a refreshed BTC pool would have been judged with no deflation. Trials now count by coin across bundled and Coinbase tags (`assetKey()`). New gate suite (7 checks); re-planting the loophole fails 3 of them.
- Gate: 138/138 full, from a clean extract.

## Audit pass 9 — 2026-09-22: lock, data and backup reliability

Exact OHLC snapshots in locks; serialized runs and synchronous lock consumption; atomic daily refresh with prior-data preservation; completed-only paginated candles, finite response validation, bounded rate-limit retries and request timeouts; individual pool removal; manual backups in every storage mode; honest download status; stricter journal/history/import validation. New synthetic regression gate and a deliberate stale-fingerprint mutation check. See `REVIEW.md` for evidence, exposure disclosure and remaining limitations. Statistical math and strategy defaults are unchanged.

Each pass lists what was wrong, the evidence, and the fix. Earlier passes checked formulas against papers; later passes added an independent Python implementation, UI crawling, and null/power simulation — which is why later passes kept finding bugs the earlier ones missed.

---

## Audit pass 8 — 2026-09-22: research custody and one-click daily data

- Added immutable hypothesis locks. A lock snapshots the dataset/pool, strategy parameters, exits, cost and mechanism before a run; the next exact matching run records the lock ID and consumes it. A first test is only described as **pre-registered** in the UI when a lock matched.
- Added append-only research-history repairs. Reconstructed trials carry no performance result but spend their configuration count against the named dataset.
- Backup format v3 preserves locks and still imports v2. Cloud and browser storage keep locks separately.
- Added one-click Coinbase refresh for 1,800 BTC, ETH and SOL daily candles. Each series is validated; partial refreshes are discarded; no strategy runs automatically.
- Added gate coverage for lock linkage, repair accounting and the one-click pool. Verdict math, defaults, strategies and bundled BTC data did not change.

---

## v1 → v2 (initial research pass)
- Bonferroni replaced by the **Deflated Sharpe Ratio**; verified against the paper (0.9505, 0.9004).
- Added a **trial budget** (MinBTL): 5 yrs → 45 configs, 3 yrs → 13 at target Sharpe 1.
- Single 70/30 holdout replaced by **PBO via CSCV** (924 splits).
- Added a time-ordered **decay test** because PBO shuffles blocks and is blind to regime decay.

## Pass 1–2 (on v2)
- DSR used null variance 1/n instead of cross-trial dispersion → accepted the paper's own reject example (0.9933 vs 0.9004). Fixed.
- Zero-variance series returned Sharpe 1e10. Fixed (returns 0).
- DSR deflated by register *entries*, not configurations (a 45-config sweep counted as 1). Flipped verdicts at SR 0.45–0.60. Fixed.
- Population SD inflated Sharpe 4.45% at n=12. Fixed (sample SD).
- Retention showed 0% when in-sample Sharpe was negative. Fixed (undefined).

## Pass 3 → v3
- **Critical:** `render()` referenced `famSR`, scoped inside `doRun()` → `ReferenceError` on every sweep with 20+ trades. **No DSR verdict ever rendered in shipped v2.** Fixed.
- Sweeps judged the typed config, not the sweep winner (10/50 vs actual winner 10/120). Fixed.
- Import merged by ID; every session minted T-001 → merge lost 90 of 225 configs. Fixed (content merge, unique IDs).
- Default cost 0.5% round trip < verified 0.80% maker. Fixed.
- Journal judged win rate instead of expectancy. Fixed.
- Stops filled at stop price through gaps. Fixed (worse of open and stop).
- PBO ranked ties at first occurrence. Fixed (mid-rank).
- Ported to hosted artifact with owner-only cloud storage and downloads.

## Pass 4 → v4
- **Critical: the test rewarded drift, not timing.** With BTC-like drift and zero timing skill, the verdict passed **59%** of simulated series. Hidden in earlier versions by the fixed 10% target. Fixed: all statistics use returns in excess of holding for the same bars → **0/120**.
- Correlation between configs was a typed-in 0.7; measured on BTC sweeps 0.20–0.25 → effective trials 14 instead of 34 (bar less than half as high). Fixed: measured per sweep.
- Synthetic practice runs counted against the real budget. Fixed.
- Two tabs could overwrite each other's saved register (whole-array writes). Fixed: one record per trial, keyed by content hash. Mock-store test: 16/16 kept.
- Runs started before the saved register loaded could be wiped. Fixed.
- CSV `"1,050"` parsed as 100. Fixed (quote-aware parser).
- **Exit rule**: fixed 10% target erased a planted trend edge (0/40 detected); signal-off + 10% stop detected 14/40 with 3.5% null false-pass. New default.
- Differential test vs independent Python engine: bit-exact except one exact float tie.

## Pass 5 → v5
- Statistics moved from per-trade to **per-bar** (same power in simulation, 16% vs 18%, but skew/kurtosis estimated on ~3,400 points instead of ~30).
- **Power readout** added to every verdict and the Budget tab.
- **Pre-registered test** path: a lone config that is the only trial on a dataset is judged without deflation (detectable Sharpe 0.81 on 9.3 yrs; sim 77%).
- Trials counted **per dataset** (untagged legacy entries = bundled BTC).
- **20-trade minimum destroyed power**: strong trends make few long trades; 74% of strong-edge runs had <20 trades → 8% detected. Lowered to 10 → 72% detected, 0/100 null false passes.
- Input validation on exit/strategy fields.
- **Screener:** all-Unknown token scored 100 "Low risk" → Unknown now scored as worst case; mint/freeze/LP-lock must be confirmed to clear. Active mint/freeze authority or unlocked LP → Critical. Live-lookup colour reflects findings.

## Pass 6 (final v5)
- **PBO and forward-retention vetoes removed** (now warnings). DSR alone: 0 false passes in 139 null series (BTC-like drift, no drift, fat-tailed GARCH). The vetoes cut detection of a real Sharpe-1.05 edge from 19/25 to 1/25 — PBO ranks configs that share an edge essentially at random. After removal: 12/14 detected at Sharpe 1.10, 3/14 at 0.70, 1/14 at 0.54.
- Power readout made conditional on the observed luck threshold (matches simulation); Budget tab formula labelled as conservative.
- Full regression suite + independent reference packaged in `tests/`.

## Pass 7 (final v5, verification pass)
- **Breakout exits were one day long.** The breakout signal was an event (true only on the breakout bar), so signal-off exits closed every breakout the next day: planted trend edge winner Sharpe 0.13, 3/25 detected. Now a Donchian channel state → winner Sharpe 1.03, 25/25 detected; nulls 0/120.
- **Default cost raised to 1.0% round trip.** Coinbase Advanced US entry-tier fees changed on 2026-09-16 to 0.50% maker / 0.90% taker (confirmed by Investing.com, Securities.io and CryptoSlate reports of the change).
- **Cloud save self-test** (write, read back, delete) on every load; falls back to browser storage if it fails (tested with a failing mock). The real hosted store was checked with a write/read/delete round trip.
- **Screener**: live-lookup error text blamed the network for every failure; now only for network errors. Live lookup tested against documented Solana RPC shapes (renounced/active authorities, holder concentration, 1e18 supply precision, missing account, non-mint, failed holder call, blocked network, bad address).
- **RSI and breakout families simulated** (previously MA only). False passes overall: 1 of 377 null series (0.3%; nominal bar allows 5%).
- Paper's second DSR example (N=46 → 0.9505) reproduced; PBO noise calibration and power-formula calibration re-run on the final code.
- Archived and Comal files confirmed byte-identical to the originals; every HTML file loads and every button clicks without script errors.
- Published artifact confirmed byte-identical to `edge-lab/edge-lab-v5.html`.

## Pass 8 (infrastructure for agents)
- **One source of verdict math.** `familyStats()` and `judge()` (pure functions in the core block) now hold every verdict rule; the UI and the simulations both call them. Previously the simulations used a hand-copied replica that could silently drift from the app. Equivalence proven before switching: old replica vs shipped functions, 9 cases (BTC + 2 synthetic × 3 families), 0 mismatches; UI verdicts unchanged (MA 0.908, RSI 0.024, breakout 0.820, pre-registered 0.135).
- **`MIN_TRADES` constant** replaces three separate hard-coded thresholds.
- **Assertion-based release gate** (`tests/verify.js`, 77 checks, 71 in quick mode, exit code 0/1) replaces printouts a human had to read. Golden values pin the BTC verdicts.
- **The gate was shown to catch bugs**: four planted bugs in scratch copies — removing the buy-and-hold adjustment, excess-kurtosis in the DSR, restoring the 20-trade minimum, letting Unknown tokens clear the screener — each made `verify.js` exit 1. The 20-trade bug initially slipped through (the Python reference also used 20); fixed by aligning the reference to `MIN_TRADES` and adding 7 `judge()` unit tests.
- **AGENTS.md** added: change loop, code map, simulation gate, golden-value policy.
- The gate caught one of my own mistakes during this pass: an edit to the Python reference accidentally commented out part of a line, and the clean-extract run failed with 2 checks. Fixed, re-zipped, 77/77; planted bugs re-run against the final gate and still caught, with the reference running cleanly.

## Pass 9 (pooled multi-asset testing)
- **Built:** pooled testing across assets (`poolStreams`, `familyStatsPooled`, `poolCheck`) on the shared verdict core, plus the Data → Pool UI. Each asset is judged against its own buy-and-hold; the pooled stream averages whichever assets exist on each date.
- **Trial accounting:** entries now record every dataset they touched; a test counts all trials on any of its datasets (pooling BTC inherits BTC's history).
- **Verified:** pool of one asset = that asset (max diff 0); pool of identical copies = the asset; union-of-dates alignment; independent Python rebuild of the full pooled pipeline on BTC + a later-listing coin (8/8 quantities match); single-asset results unchanged vs the pre-pooling build (9 cases incl. PBO and retention, 0 mismatches); UI flow (10 checks).
- **Simulation gate:** pooled null false passes 6/1,800 (0.3%); power gains 17%→29% (staggered listings, correlation 0.7) up to 19%→61% (full history, correlation 0.3). See HANDOFF §6.
- **Security bug fixed:** the register and journal wrote imported text into the page unescaped — a shared backup could run code in the owner's page (old build: 12 injected elements from one crafted file; new: 0). All imported and CSV-derived text is escaped.
- **Import bug fixed:** a malformed trade in a backup crashed the journal and aborted the whole import. Imported entries are now type-checked; bad ones are skipped and counted.
- **Gate:** 102 checks (96 quick). Four planted bugs (sum instead of average, pooled trials not counted, unescaped notes, no pool validation) each failed the gate. A first attempt at planting them silently failed and the gate passed — the planting script, not the gate; re-run correctly.
- `familyStats` accepts `{diag:false}` to skip PBO/retention (warnings only) in simulations; verdicts identical.

## Pass 10 (token-efficient layout for AI agents)
- The app makes no AI calls; the token cost is AI agents reading the project. The built app is ~229k characters, 134k of them one line of bundled prices, so any edit meant reading ~70k+ tokens.
- **Source split:** `src/core.js` (~6k tokens), `src/ui.js` (~12k), `src/shell.html` (~5k), `src/data/btc-usd-daily.pack` (never read). `build.js` reassembles the app; the rebuilt file is **byte-identical** to the previous release, so functionality is unchanged by construction. `node build.js --check` is now the gate's first check, and it was shown to fail when a source file is altered.
- **Reading guide** in AGENTS.md: which files to open per task, approximate token cost, and what never to open.
- `SHA256SUMS` added for the shipped files.

## Cannot be verified from here (stated, not hidden)
- The in-browser cloud-save path on the owner's device (no browser was connected). The page now self-tests it on load and says so on screen.
- A live call from the screener to Solana's public RPC (outbound network blocked in this environment). Response handling is tested against the documented formats.
- Future performance of any strategy. The tool measures past evidence only.
