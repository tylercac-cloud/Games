# Release 23 — Crypta on a free local model

- **Brains:** Automatic (Claude if an Anthropic key is present, else a local model, else the guide), Claude, Local model, or Guide only — chosen in settings.
- **Local model via Ollama** (free, private, on the user's PC): the launcher detects Ollama at 127.0.0.1:11434, lists installed models, and offers one-click downloads of Qwen3 8B, Qwen3 4B or Llama 3.1 8B with live progress (`/crypta/local/pull`, recommended models only). Chat goes through the launcher to Ollama's `/api/chat` with the same instructions, whole guide, screen state and ten read-only tools; the reply is converted to the same event stream as Claude's, so tool use, streaming and the UI behave identically. 16k context; `think:false` for Qwen3-family models; no cost, no usage recorded.
- Tests: `test_crypta_local.py` (6: detection, request translation incl. system/guide/state/tools/context, stream conversion, tool call → tool result round trip, errors, download allowlist, no usage recorded) and `e2e_crypta_local.py` (9, real Chromium: guide → download with GB/% progress → automatic switch → local answer → local tool use).
- Not verified: a real Ollama install and real model quality. Local 4-8B models follow tool instructions less reliably than Claude.

---

# Release 22 — Crypta, much more capable

- **Sees everything, read-only:** six new tools the model can call on demand — `read_screen` (any tab, inputs as "label: value"), `read_journal`, `read_register`, `read_account` (snapshot, deposits, high-water mark, equity log, plans), `read_scan`, `read_market` (live bid/ask/24h and 30 completed days). Still no tool that changes data, trades or touches the study.
- **Better answers:** the whole guide plus her instructions are sent as a cached block (Anthropic prompt caching: repeat questions pay ~10% for it); instructions tell her to read before answering and show her arithmetic; default model Claude Sonnet 5, Haiku 4.5 optional; up to 1,500 output tokens. Cost accounting includes cache writes (1.25×) and reads (0.1×).
- **Guide mode answers from your numbers:** plan math step by step, distance to each limit, open risk by position, journal summary, why a size is $0 (including which fields are empty).
- **Usability:** Alt+C; resizable panel that remembers size and open state; suggestions follow the open tab; Copy and Retry on answers; New chat; tool use shown as chips; tables, headings, code blocks and safe links rendered; cost per typical question shown in settings.
- **Docs corrected:** a Claude Pro subscription does not include API credits (Anthropic Help Center); the API is billed separately.
- Tests: `test_crypta.py` 8 (Sonnet default, cached system block, all ten tools, 1,500-token cap, cache-aware cost); `e2e_crypta.py` 31 (adds plan-math and limit answers, tab-aware suggestions, read_journal/read_screen/read_account/read_market through real Chromium with no key material in results, Retry, Alt+C).

---

# Release 21 — Crypta, the in-app helper

## What she is
A chat helper in both tools (bottom-right button) and in her own installable window at `/crypta` (PWA: manifest, icons, service worker; install from Edge/Chrome and pin to the taskbar). Original pixel-sprite character. She sees a compact snapshot of the open page (tab, planning fields, plan result, ticket, account summary, journal summary, status and warnings on screen) and can use four tools: switch tab, point at a field, refresh Capital plan, open trades to log. Her window drives the most recently focused tool through a BroadcastChannel.

## Modes
- Guide mode (no key): BM25 search over `src/crypta/guide.md` (21 sections) plus live explanations (why the size is $0 from the actual plan; what to do next).
- AI mode: `market-scan/crypta.py` reads an Anthropic key from `private/`, builds the request itself (fixed system prompt with limits, fixed tools, model allowlist Haiku 4.5 / Sonnet 5, max 1,024 output tokens), streams the reply, records token usage and enforces a monthly cap (default $5; list prices $1/$5 and $2/$10 per million tokens, approximate). POST routes need loopback Host/Origin, the custom header, JSON and ≤256 KB.

## Safety
Keys never reach the page; messages that look like API keys, private keys, key names or long base64 secrets are refused before sending and not stored. Model output is escaped before rendering. No tool can trade, move money, change data or touch the study.

## Tests
- `test_crypta.py` (8): guide mode without key; streamed request built server-side (headers, prompt limits, guide, state, tools; key never echoed); the page cannot override prompt, tools, model or token limit; usage and cap ($0.0012 + $0.0004 for 1,200 in / 80 out on Haiku; cap $0 → 402); upstream 429/401 explained; route security (header, origin, host, content type, size; other POSTs 405); Coinbase detection ignores Crypta's files; static assets and manifest.
- `test_crypta_guide.js`: 16 typical questions land on the right guide section; key-like text blocked (including a synthetic Ed25519 secret), ordinary numbers allowed; HTML escaped.
- `e2e_crypta.py` (21, real Chromium): guide mode; plan-aware $0 explanation; pasted Coinbase key refused, not stored, not sent; AI mode switches on when a key file appears; streamed markdown; numbers sent, no keys in the request; go_to_tab and point_at work and results go back as tool_result; injected HTML never runs; her window sees and drives the desk; manifest and service worker present; cap refusal with guide fallback; usage recorded; no page errors.

## Not verified
No real Anthropic call was made (no key in the build environment); the fake follows the documented streaming format. Taskbar install was not exercised in a real Windows shell.

---

# Release 20.1 — verification pass (no application changes)

A full pass looking for bugs found **none in the application**. Application code is byte-identical to release 20; only tests were added or extended.

## What was run
- **Click everything, real Chromium** (`tests/desk/e2e_click_everything.py`, now in the gate): both tools opened from the launcher with simulated Coinbase and a View-only key; every tab visited and 54 distinct buttons pressed in order, collapsed sections opened, long actions (1,800-bar market pool) allowed to finish. No script errors, console errors, server errors or pages wider than the window.
- **Random real-browser sessions**: seed 41 × 100 steps (573 checks) and seed 42 × 80 steps with api.exchange.coinbase.com unreachable, i.e. every price, spread and candle from the Advanced fallback (460 checks). Both passed; journal within 1¢ of the account.
- **Property tests** with three more seeds (1, 99, 31337), 2,000 cases per property each: passed.
- **Full gate without quick mode** (end-to-end BTC sweeps on bundled data, same trials as earlier releases, no new evaluations): ALL CHECKS PASSED (174).
- Re-read of the proxy routing, fallback and account routes: no defects.
- **Second verification pass, also no application defects:**
  - Click-everything in four failure modes (no key; key rejected with HTTP 401; Exchange host down; launcher closed with the page open): no script errors, and the right explanation on screen in each ("Account not connected", "rejected the key (HTTP 401)", "Account read with View-only key" via the fallback, "Launcher not reachable"). All four modes are now in the gate.
  - Random sessions seeds 51 and 52 × 100 steps (578 and 576 checks): passed; journal equal to the account to the cent.
  - **Hostile website, real Chromium:** a page from another origin tried fetch with the custom header (to 127.0.0.1 and localhost), a no-cors fetch, `<img>`/`<script>` tags and a form POST against the account routes. All blocked; zero account requests reached Coinbase. Now in the gate.
  - Complete quick gate (including all four failure modes): passed.
  - **Oldest and newest Python:** the launcher and proxy suites and the full 26-step trading session pass with the launcher on Python 3.8.20 (no `cryptography` package, so every Coinbase request was signed by the built-in pure-Python ES256 code and accepted by the JWT-verifying simulator), 3.13.13 and 3.14.4 (deprecation warnings treated as errors).

## Harness fixes (tests only)
The click-everything harness initially waited on a `<main>` element the lab page does not have, so it skipped nine lab buttons while the market pool was loading; fixed to wait on any busy button. The random runner gained an `exchange-down` option; property tests accept `PROP_SEED`.

---

# Release 20 — fine-tooth pass, real-browser and randomised testing

## New testing (now part of the gate)
- `tests/desk/test_properties.js`: seeded randomised properties, 2,000 cases each — round-trip P&L equals the cash change; tax FIFO equals a unit-by-unit reference; the trade ticket never exceeds risk budget, cash or the 25% cap and sits on Coinbase increments (and is maximal); cooling-off equals a brute-force reference; 400 random plans through the real form equal an independent re-derivation.
- `tests/desk/e2e_random_browser.py [seed] [steps]`: real headless Chromium against the launcher and a stateful Coinbase simulator — random price walks, 8-15% crashes, ticket-sized buys with stop-limits that fill or gap through, full and partial sells, deposits and withdrawals, one-tap logging. After every step: equity, cash and open risk against the simulator, plan stage and size against an independent re-derivation, ticket against its budget; at the end, journal P&L against the account. Twelve seeds of 60-100 steps passed (297-579 checks each; journal within 1¢ of the account every time). The gate runs seed 7 × 30 steps.

## Stop orders exercised
`e2e_trading.py` now drives a stop-limit fill between stop and limit ($2,395), a gap through the limit (price $2,200: order unfilled, whole position counted as open risk, new size $0) and the fill on recovery ($2,295); both round trips are logged and appear as separate tax lines. The random sessions rarely reached stops (0-1 per seed), so this scripted case is the evidence for stop handling.

## Bugs found and fixed
1. Small deposits were not flagged (re-check only on >2% equity jumps, later a 5 s throttle that swallowed the read right after a deposit). Now every account read re-checks; overlapping reads coalesce. Found by the random browser session.
2. A stop-limit whose limit is above the market (triggered or gapped through) counted as protection; open risk understated by the position's value. Now counted as unprotected.
3. Coinbase App transfer times mix `Z` and `-07:00` offsets and were compared as strings; now compared as instants. Account ids are URL-encoded.
4. A failed calculation left the previous trade ticket on screen.
5. A ticket still loading could paint an older calculation over a newer one.
6. Logged-trip ids were not in the backup (restore → trades offered again). Now backed up, and every one-tap entry records its Coinbase trip id.
7. Equity log days used UTC; now your local date.
8. An imported log line without a high-water mark broke the chart.
9. The deposit prompt could not be dismissed when you deliberately keep a different figure: *Keep my figure* silences it until Coinbase's number changes.
10. The lab's Journal was pre-filled from desk plans and live Coinbase trades; live-trade automation is desk-only.

---

# Release 19 — bug hunt (no planted bugs)

## Bugs found and fixed
1. **Day-one funding offered as a deposit.** Funding the account on the day Fable first read it put that $5,000 inside the transfer window; tapping *Use* would have netted experiment equity to about $0. Transfers before Fable's first account reading are now the starting balance and never counted (the Detect list says so).
2. **Round trips overstated profit when a sell included older coins.** Selling 3 coins against a 1-coin trip counted all 3 coins' proceeds and fees. Only the trip's share of such a sell is counted now (example: P&L $17.80, previously $237.80).
3. **Tax year by UTC date.** A sale on the evening of Dec 31 (US time) landed in the next tax year. Tax rows now use your local calendar date.
4. **Coinbase microsecond timestamps** (e.g. `…:41.395380Z`) are normalised before parsing, so plan matching, cooling-off and holding periods don't depend on the browser's date parser.
5. **One-tap logging left that trade's symbol, size and fee in the form**, pre-filling the next manual entry with the wrong numbers. The form is cleared after each one-tap log.
6. **Stop-limit gap accepted negative or empty values**, which could put the limit above the stop. Values outside 0-20% fall back to 0.2%.

## Evidence
Autofill tests 29 (+3: form cleared, 3-coin sell against 1-coin trip, Dec 31 local sale); simulated session 23 steps with the account funded $5,000 two minutes before first launch (no false deposit offer; the later $1,000 deposit detected exactly); full gate passed.

---

# Release 18 — less typing, bug fixes

## Typing removed
Journal auto-loads all unlogged round trips (all coins, 120 days) and logs each with one tap; deposits are re-checked automatically when equity jumps; *Closed on* defaults to today.

## Bugs fixed
1. **Trade ticket could show another coin's numbers.** After switching coin, if the new coin's fill failed, the ticket kept the previous coin's plan under the new name. The ticket is now bound to the exact calculation and coin, and cleared at the start of every fill.
2. **Logging old losing trades triggered cooling-off.** Manual entries were stamped "now". They now use *Closed on*.
3. **Deposit netting left an inflated line in the equity log** until the next refresh. Today's line is rewritten when Net deposits change.
4. **Deposit check ran once per session**, so a deposit made later was never flagged. Now re-checked on equity jumps and every 10 minutes.
5. **Journal import worked one coin at a time**, missing trades in coins you weren't looking at. It now covers every coin.

## Evidence
Simulated session 23 steps (one-tap logging with journal P&L = account change to the cent; automatic deposit flag); autofill tests 26 (one-tap log values, no-plan path, logged trip disappears, ticket cleared for an unplanned coin, dated old trades); full gate passed.

---

# Release 17 — trade ticket, equity log, review, cooling-off, deposit detection, tax CSV

## Added
See README "Release 17 additions". Core changes: Journal trades now store size, fees, prices, plan adherence and close time (older trades still load; imports still validate); the planner refuses new size during cooling-off; the desk backup carries a `desk` section (equity log, high-water mark, net deposits, plan history, costs); new launcher routes `/account/fills?product=ALL` (all fills, 60 pages max, truncation reported) and `/account/transfers?since=` (Coinbase App v2 history, suggestion only).

## Simulated user session (now 22 steps)
Ticket math (buy 0.00396948 BTC, stop 55,200.00, limit 55,089.60; loss at limit within the $25 budget; limit entry at the 0.6% maker fee allows a larger size); the user places exactly the ticket's order; open risk ≤ the ticket's stated loss; review gross − fees = net; two quick losses lock sizing and the lock lifts after 24 h; deposit detected and applied with one click ($5 pro transfer listed, not counted); equity log and high-water mark survive export → wipe → import; tax CSV gain equals the account's equity change. Unit tests: FIFO lots (808.00 / 1,185.60 long-term; 253.00 / 296.40 short-term; missing basis flagged), cooling-off edges, transfer netting and stale-account skipping.

## Unverified
Coinbase App v2 transfer history (field names, whether it respects the key's portfolio) and real product increments. Both fail visibly and never change a number without a click.

---

# Release 16 — final logic pass with a simulated trading session

## Simulation
`tests/desk/e2e_trading.py`: real launcher, real pages, and a stateful Coinbase simulator (balances, fills, stop orders and prices change as the user trades; every account request JWT-verified). A simulated user: scans; plans a BTC trade from $5,000; buys the planned size (rounded to 8 dp) with a stop-limit; re-plans; sells after a rally; imports the round trip into the Journal; then walks equity through REVIEW, NO NEW RISK and HALT; recovers; deposits $1,000; buys ETH without a stop, then adds one. Every plan is checked against an independent re-derivation of the protocol rules, and every account number against the simulator. Journal P&L equals the account's equity change to the cent.

## Bugs the simulation found (fixed)
1. **Journal used a plan made after the trade.** Opening Capital plan right after buying records a new plan; the Journal took the latest plan as the expected entry. It now uses the latest plan made strictly before the first fill (plan history kept per coin).
2. **Account balances were cached for 15 s.** A trade placed seconds earlier didn't show in cash or open risk, so a quick re-plan could exceed the 1% portfolio cap. Account data is now never cached.
3. **Prices were cached for 5 s.** A plan right after a move used the old price. Now 1 s (duplicate calls only).
4. **Deposit netting could crash the planner.** Coinbase cash could exceed netted experiment equity ("cash ≤ equity" error). Cash is capped at experiment equity.
5. **A position with a missing quantity read as zero risk.** Now counted at full value and flagged.

## Evidence
All suites passed, including the simulation (15 steps), both launcher end-to-end runs (normal and Exchange host down), and the account tests (25).

---

# Release 15 — second bug sweep (critical paths only, no planted bugs)

## Bugs found and fixed
1. **Stale numbers could feed an automatic plan.** If a price, stop or account read failed, the previous autofilled value stayed and Capital plan recalculated with it. Now any autofilled value that can't be refreshed is cleared, so the plan waits instead of sizing on old data. Typed values untouched.
2. **Switching asset during a fill mixed coins.** A slow BTC response could land after you picked ETH and be planned as ETH. Results for a coin you've left are discarded and the new coin is filled.
3. **A key added after the page opened was never picked up** until reload. Each fill now re-checks.
4. **Open stop risk understated.** Stop-limit orders were valued at the stop price; they sell at the limit or better, so risk now runs to the lower of stop and limit, plus the taker fee. Stop orders larger than the holding no longer add phantom risk; orders on BTC-USDC protect a BTC position (one Coinbase market).
5. **Quote-sized fills could be mis-sized.** Coinbase doesn't document the unit of `size` when `size_in_quote` is true; the commission now decides (a real fee is 0.001-3% of notional), defaulting to quote units.
6. **Repeated fill pages could double a trade.** Fills are de-duplicated.
7. **Single point of failure on api.exchange.coinbase.com.** Price, spread, 24h stats and candles now fall back to Coinbase Advanced public data when the Exchange host is blocked, down or retired (not on 400/404/429). The startup line says "via Advanced fallback".
8. **Second-launch check could go through a system proxy** on some Windows setups and miss the running app. The loopback probe now bypasses proxies.

## Evidence
- `e2e_launcher.py` now also runs with api.exchange.coinbase.com unreachable: scan, strip, Capital plan, Fetch, Journal import and the 1,800-bar lab pool all pass on the fallback, with zero uncaught script errors.
- New tests: stale-value clearing, asset-switch race, fallback shapes and ordering, stop-limit / oversized / USDC stop risk, fill units both ways, fill de-duplication. Full quick gate passed.

---

# Release 14 — bug sweep

## Bugs found and fixed
1. **Autofill could break a pre-registered lab lock.** The lock signs the Test cost; live-spread slippage changed that cost every refresh (and per asset), so a locked run would be refused. Test cost now = fees both legs + your own slippage (or 1 bp a side), and it never changes while a lock is active. Live spread stays in Capital plan only.
2. **A fee you typed was replaced by the Coinbase tier on the next refresh.** Now kept; clearing the field hands it back to automatic.
3. **Second double-click opened a new address with an empty register.** Port fallback (release 11) moved the app to 8766, a different browser origin, so register, journal and settings looked gone. A second launch now reuses the running launcher; if another program holds 8765 the terminal prints a loud warning.
4. **A non-key .json in private/ hid the real key.** Detection is now by content: first full key file wins, whatever its name; raw secret text and unrelated files get specific messages.
5. **Ed25519 keys may be rejected by Coinbase account endpoints** (Coinbase documents ECDSA as required for Coinbase App/Advanced Trade; its SDK says Ed25519 works). Both are supported; a 401 on an Ed25519 key now says to create an ECDSA key.
6. **Launcher could crash on Python < 3.8** (import-time math) and print `?` or crash on consoles that can't show `—`/`·`. Clear version message; ASCII console output; output errors never fatal.
7. **Journal import used any old plan as the expected price.** Now only a plan from the 7 days before the first fill.
8. **Large balances.** When experiment equity exceeds $7,500 the account panel asks once whether all of it is challenge money; confirming silences it permanently (so a winning run is never mislabelled).
9. **Deposits counted as profit.** New *Net deposits since start* field: Capital plan uses Coinbase total − net deposits; the stored high-water mark shifts by each correction and is exactly reversible (raw peak stored, $5,000 floor applied on use). A typed high-water mark becomes the stored one.

## New evidence
- `e2e_launcher.py`: real launcher process, pages loaded from it, every page request over real HTTP, fake Coinbase verifying every JWT, key saved as `cdp_api_key.json 2.txt`, cp437 console. Covers daily scan, live strip, Capital plan autofill + calculation, desk Fetch, Journal import, lab market pool, and zero uncaught script errors.
- `test_second_launch.py` (2), `test_account.py` (21, +9), `test_autofill.js` (21, +6). Mutations removing the lock guard and the reuse check each fail.
- Complete quick gate passed; full gate with end-to-end BTC sweeps also passed (174 checks) — same bundled-data trials as before, no new evaluations, protocol unchanged.

## Remaining limits
- Still no real Coinbase account read from here (no internet in the build environment).
- High-water mark lives in browser storage and is not in the backup file; clearing browser data resets it to max($5,000, current equity).

---

# Release 13 — key-file detection

## Fix
`account.py` only looked for `*.json`. A key saved from a phone (often `.txt`, no extension, or `" 2"` appended by the OS) went undetected with no explanation — `configured:false`, indistinguishable from no key at all.

`find_key_file()` now: uses a real `.json` file if one exists; otherwise checks every other file in `private/` (skipping the README) by content — valid key JSON, or a bare PEM block. A file with just the raw key text (no `name`/`privateKey` wrapper) is now detected but reported with a specific message telling you to use Coinbase's Download button instead of copying the text.

## Evidence
`test_account.py` (16, +4 new): misnamed/duplicate download found and loads correctly; a real `.json` takes priority over a stray file; raw-text-only file gets the specific message; README and unrelated notes are never mistaken for a key. Full gate passed.

---

# Release 12 — autofill and read-only account

## Changes
- `src/autofill.js` (both tools): linked fees/slippage across Capital plan, Execution and Test cost (shared `fable-shared:costs`, settings only — records stay separated); Capital plan auto-fill and auto-calculate; Journal prefill and Coinbase round-trip import with de-duplication; Sizing from Journal; Budget from loaded data. Typed values always win.
- `market-scan/account.py`: View-only Coinbase access. ES256 and Ed25519 JWTs (`cryptography` when installed, otherwise pure-Python RFC 6979 / RFC 8032). Fixed GET endpoints only: key_permissions, portfolio breakdown, transaction_summary, open orders, fills. Trade/transfer keys refused before any account data is read. Key stays in `private/`, never reaches the page.
- Launcher: `/account/status|snapshot|fills`, requiring the `X-Fable-Local` header (forces a CORS preflight, so other sites cannot trigger reads) plus the existing loopback Host/Origin checks. Startup prints `Account: OK/FAIL`.

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
