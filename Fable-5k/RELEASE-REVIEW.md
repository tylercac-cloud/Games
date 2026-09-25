# Release 12 — autofill and read-only account

## Changes
- `src/autofill.js` (both tools): linked fees/slippage across Capital plan, Execution and Test cost (shared `fable-shared:costs`, settings only — records stay separated); Capital plan auto-fill and auto-calculate; Journal prefill and Coinbase round-trip import with de-duplication; Sizing from Journal; Budget from loaded data. Typed values always win.
- `market-scan/account.py`: View-only Coinbase access. ES256 and Ed25519 JWTs (`cryptography` when installed, otherwise pure-Python RFC 6979 / RFC 8032). Fixed GET endpoints only: key_permissions, portfolio breakdown, transaction_summary, open orders, fills. Trade/transfer keys refused before any account data is read. Key stays in `private/`, never reaches the page.
- Launcher: `/account/status|snapshot|fills`, requiring the `X-Fable-Local` header (forces a CORS preflight, so other sites cannot trigger reads) plus the existing loopback Host/Origin checks. Startup prints `Account · OK/FAIL`.

## Evidence
- `test_account.py` (12): all key formats parse; library and pure-Python signatures verify against `cryptography`; fake Coinbase verifies every JWT (signature, uri, iss/sub/kid, 120 s expiry, nonce); snapshot numbers (equity $5,123.45, cash $3,100, BTC stop risk $75, unprotected ETH $500, taker 1.2%); Ed25519 path; fills normalisation; trade and transfer keys refused after only the permission call; 401 message; missing header / foreign origin blocked; key material and key name absent from every response and the log.
- `test_autofill.js` (15): full Capital plan fill with hand-derived expected values and auto-calculation; fee/slippage propagation (2.42% and 1.85% round trips); typed values preserved; import with VWAP entry/exit and summed fees; stale plan not used as expected price; logged trips cannot be imported twice; Sizing/Budget; no-key and off-launcher behaviour; trip-builder edge cases.
- Mutations (removing the typed-value guard; accepting trade-permission keys) each fail the gate.
- Complete workspace gate passed (quick mode; same bundled-BTC reference tests as before; no new evaluations; protocol checksum unchanged).

## Limits
- Not yet run against a real Coinbase account: the build environment has no internet. First launch with your key is the verification.
- Open-order parsing covers stop-limit and bracket configurations; other stop types show as "none" (counted at full value).
- Round trips from fills assume long-only spot; partial sells stay open until ≥99% is sold.

---

# Release 11 — live data

## Why live data failed in release 10

1. **Build environment, not code:** release 10's only live check ran from a sandbox whose egress proxy blocks api.coinbase.com; the proxy's block page is not JSON, which is the recorded `JSONDecodeError`. This release's environment shows the same block (`HTTP 403, x-deny-reason: host_not_allowed`).
2. **Real code defects that would have failed on a user machine:**
   - **Fetch** (desk and lab) and **Refresh market pool** called `api.exchange.coinbase.com` directly from the page. The launcher had no route for it, so those buttons depended on browser CORS behaviour instead of the local proxy.
   - The desk's **Fetch** used an older downloader that kept the **in-progress daily candle** and had no timeout or input validation. It now uses the lab's hardened downloader (completed bars only, 15 s timeout, bounded 429 retry, malformed-candle rejection).
   - The proxy collapsed every failure into one generic 502. SSL-certificate failures (standard on python.org macOS installs), DNS, timeouts, VPN/region 403s and HTML block pages were indistinguishable.
   - A second launch failed outright because port 8765 was already taken.
   - The product-listing loop threw "repeated page" if Coinbase ignored `limit` and returned the full list in one response; it now stops on a short page, an oversize page, or `pagination.has_next=false`.
   - `build.js` injected the shared script with a string replacement, so any `$'` in shared code was silently expanded into page HTML. Found by the new test; fixed with function replacers.

## Changes

- `market-scan/server.py`: GET-only allowlist extended to `/coinbase-exchange/products/{ID}/{candles|stats|ticker}` and `/coinbase-public/market/products/{ID}`, with product-ID pattern and bounded windows (≤300 bars; 1h/6h/1d only). certifi trust store when installed. Specific, actionable error messages. 5 s cache on live stats, 30 s on candles (prevents rate-limit bursts). `/health` endpoint, startup self-check printed to the terminal, `--check` CLI, port fallback 8765–8774. Still no credentials, account routes, POST or order access.
- Pages: `routePublic()` sends Coinbase public requests through the launcher when served from it; unchanged elsewhere. Upstream error text is shown verbatim. Stale "artifact sandbox" copy removed; an unescaped error message in the desk was escaped.
- **Live market strip** in both tools: BTC/ETH/SOL last trade, 24h change, 24h high/low, 24h USD volume, bid/ask spread in bps, connection dot, last-update age, 30 s refresh while visible, **Check connection** diagnostics. Auto-refresh only under the launcher or a local file; on any other origin it waits for a click. Informational only — it feeds no study, scan, sizing or verdict.

## Evidence

- `tests/desk/test_live_proxy.py` (8 tests): real launcher against a local fake Coinbase — every browser route passes through, cache collapses 4 requests to 1, 10 disallowed paths return 400 with **zero** upstream calls, non-JSON upstream named, `/health` OK and failing states, specific SSL/DNS/timeout/403/429/refused messages, port fallback.
- `tests/desk/test_live_strip.js` (12 checks, both built apps): proxied auto-refresh renders the expected numbers, routing maps only Coinbase public origins, `fetchCandles` uses the launcher and drops the in-progress day, launcher error text reaches strip and Fetch, launcher-down message, no automatic requests off-launcher.
- `tests/desk/test_research.js`: new listing-termination case (12 groups).
- Mutations: removing `routePublic` from the lab downloader, breaking the spread formula, and reverting the listing stop condition each fail the gate.
- Complete workspace gate (`bash tests/run_all.sh --quick`) passed: lab 168 checks, then all desk, execution, proxy and live-data suites.

## Real-data exposure

The quick gate re-ran the existing BTC reference and pooled tests, as in release 10. No new historical evaluations, sweeps or tuning. No verdict, statistic, engine, signal, threshold, fee default or protocol changed; the locked protocol checksum is unchanged. No live Coinbase data was received in this environment.

## Remaining limits

- **Real Coinbase connectivity is still unverified from the build environment** (outbound blocked). The first launch on your machine is the verification: both startup lines must read OK.
- Response shapes for Exchange `stats`/`ticker` and Advanced `market/products` follow Coinbase's published schemas as checked on 2026-09-22; a schema change would surface as a named error, not wrong numbers.
- All other release-10 limits below still apply.

---

# Release 10 — final-use review

This package combines the incoming pooled research build and the saved v7 checkpoint in a single local workspace, with separate tools and records. It does not claim a validated trading edge or authorize real-capital use of the locked paper study.

## Changes

- Added a clear start page, coordinated dark theme, responsive layouts, high-contrast storage messages, keyboard tab navigation and direct links to Capital plan.
- Restored the one-button USD market overview, completed BTC/ETH/SOL candles, unchanged paper protocol and fingerprint, scan observations, fixed BTC warm-up anchor, next-open execution accounting, buy-and-hold comparisons and fee-aware risk planner.
- Retained the incoming multi-asset pooling, exact-data exploratory locks, dataset persistence, coin-aware trial accounting and journal.
- Separated storage namespaces so the older desk cannot overwrite newer lab records. Both tools have explicit backup instructions; their registers are not silently combined.
- Replaced the lab's current-order language with historical model state. Passing results no longer display the fixed 2% sizing illustration. Kelly is labeled theoretical. The capital planner is the relevant manual sizing workflow.
- Replaced permissive CSV substitution with rejection of malformed/missing OHLC, invalid dates, duplicate or uneven candle intervals. No artificial prices are inserted.
- Backup identity now includes full normalized trial/trade content: different dataset, cost or return fields survive import. Object key order and transport timestamps do not create duplicates.
- Saving a cloud budget preserves the saved dataset document instead of replacing it.
- Source-owned builds cover both tools and the entry page. The local server serves only explicitly allowed pages and public market routes; source files, traversal, cross-origin requests, account/order routes and POST are rejected.

## Evidence

**Final result: the complete workspace gate passed.** The lab full gate passed 174 checks, followed by all restored desk, execution and proxy tests. The three historical DSR golden values remained MA 0.908, RSI 0.024 and breakout 0.820. None meets 0.95. The separately assembled delivery copy also passed source/build consistency and synthetic recovery checks.

The incoming quick baseline passed 168 checks. The final combined gate is recorded in `tests/artifacts/workspace-final-gate.log`; its final status is authoritative. Earlier failed runs are retained. Their failures identified invalid synthetic OHLC in a persistence fixture and truncated pool display output; the fixtures were corrected, without weakening the importer. The new recovery/input suite is in `release-recovery.log`. It exercises differing-record import, idempotence, backup completeness, normalized signatures, strict OHLC, cloud-budget preservation, navigation and historical-only result labels. A source mutation restoring the incomplete signature was rebuilt separately and correctly failed the first recovery assertion; the mutant is not shipped.

The desk checks cover 11 scanner/protocol assertion groups, 19 execution/input/risk groups, both UI workflows and two proxy-security tests. Results are in `desk-final.log`. These use synthetic/mocked data. The locked protocol fingerprint is unchanged. No engine, signal, sweep, statistical threshold or cost default was tuned for better BTC results.

## Real-data exposure record

The original checkpoint's 736 evaluation operations are preserved as a documented subset, not a total across this release. Incoming audit exposures are described in REVIEW.md. This final-use pass ran the incoming quick baseline, an initial full regression, a workspace full regression, and a final combined full gate after fixture correction. Each includes historical BTC fixed-exit comparisons, signal/DSR reference calculations, pooled runs, storage sweeps, lock/research controls and action-panel testing. Full modes add the pinned MA 45, RSI 12 and breakout 4 sweeps plus a later single test. Some action-panel inputs are synthetic. Repeated implementation checks are not independent discoveries. No exact lifetime total is claimed.

Raw logs retain pass/fail evidence. These isolated test records do not appear in the user's private register. No newly fetched exchange prices or unseen holdout were backtested. One public product-list connectivity check was attempted; it did not produce readable JSON. No live trades, credentials or private Coinbase endpoints were used.

The owner reports no personal research to date. References to unknown prior searches concern inherited AI/project evaluation history; they are not a claim that the owner conducted undisclosed manual research. Original checkpoint records are retained as provenance.

## Remaining limits

- Live Coinbase connectivity did not verify: `release-connectivity.json` records an unreadable response. Scanner failure handling is tested; a real successful scan remains unverified.
- Chromium installation failed because the downloaded archive was invalid. UI checks use jsdom and mocked canvas. Desktop/mobile visual rendering, actual browser downloads, and the Windows launcher were not exercised in a real Windows browser.
- Cloud storage is platform-specific and only mocked here. Its inherited 1,000-document query cap and concurrent whole-document writes remain limitations. Use one active tab, preserve original backups and do not treat a partial or empty register as fresh research history.
- Statistical trial history remains incomplete. Coin-aware accounting does not fully resolve unlabelled/renamed CSV overlap, unknown earlier searches or cross-tool history. Local locks do not prove data was unseen. Historical DSR results therefore are not certification for live use.
- Capital inputs are manual and can be stale. Stop prices, gaps, slippage, fee tiers, exchange outages and non-executing protection orders can cause losses beyond the planned amount. No broker-side account limit is enforced.
- The study is paper-only and descriptive. Few trades, missed observations or late reconstruction do not establish an edge. The two hypotheses are correlated, and scaling to larger capital requires evidence beyond this software review.

## Official references checked

- Public/private endpoint separation: https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/rest-api
- Account-specific fees and order preview: https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees
- Order types and non-guaranteed downside protection: https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/order-types

These references inform the connection boundary and wording. They do not verify the user's account, fee tier or orders.
