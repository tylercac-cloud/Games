# CLAUDE.md — Fable 5k handoff

You're picking up **Fable 5k (release 23)** on the owner's real Windows PC. It was built and tested in a sandbox with no internet, so every external connection has only been tested against simulators. **Your main job is to verify it against the real world and fix only confirmed bugs.**

## Owner
- Tyler. Works in spirits operations and does not code, so explain in plain words and keep it short.
- Wants: real numbers over ranges, step-by-step math, uncertainty flagged openly, no filler, never assume missing values.
- Runs a $5,000 crypto discipline experiment on Coinbase. The **"Main" portfolio holds only experiment money**, and future deposits will also go to Main.

## Hard rules
1. **Never open, print, copy or log anything in `private/`.** It holds a Coinbase View-only key and possibly an Anthropic key. Test key detection by the launcher's output only.
2. **Never ask Tyler to paste a key into chat.** Keys go in only as files saved into `private/`. Two keys were pasted into an earlier chat; confirm with him that both were deleted in Coinbase and replaced.
3. **No trading capability, ever.** Coinbase access is View-only by design and the launcher refuses trade or transfer keys. Add no order endpoints and no Crypta tools that change data, trade or move money.
4. **Don't touch the locked study.** That covers the protocol, its checksum, hypotheses H1/H2 and the stage thresholds. Don't tune rules on data.
5. **Don't set an `ANTHROPIC_API_KEY` environment variable.** It would switch your own billing from Tyler's Pro plan to the API.
6. **Never hand-edit built files.** Edit `src/`, then run `node build.js`; `node build.js --check` must pass.

## What it is
A local app. `START-WINDOWS.bat` starts a Python launcher (standard library only) on `127.0.0.1:8765` and opens the pages.

- **Daily desk** (`edge-lab/edge-lab-v7.html`):
  - daily scan and paper study
  - Capital plan: self-filling position sizing, trade ticket, cooling-off
  - Journal: one-tap import of Coinbase round trips, review, tax CSV
  - equity log, deposits
- **Pooled strategy lab** (`edge-lab/strategy-lab.html`): testing rule ideas under a trial budget.
- **Crypta**: an in-app helper (Alt+C) and an installable window at `/crypta`. Her brain is one of: built-in guide, a free local model through Ollama, or Claude through an Anthropic API key. She has read-only tools plus tab and field navigation.

## Risk rules (from the locked protocol; must not change)

| Rule | Value |
|---|---|
| Per-trade risk | 0.5% of equity |
| Total open risk | 1% of equity |
| Largest single position | 25% of equity |
| Review stage | equity ≤ $4,500; per-trade risk halved |
| No new risk | equity ≤ $4,250 |
| Hard pause | the higher of $4,000 and (high-water mark − $1,000) |
| Cooling-off | 2 losing trades within 24 h stop new sizing for 24 h |

Other rules the app enforces:
- Open risk counts each position down to the lower of its stop and limit prices, plus the taker fee.
- A position with no stop, or whose stop-limit the price has already fallen through, counts at full value.
- Experiment equity = Coinbase total − net deposits.

## Map
| Path | What |
|---|---|
| `market-scan/server.py` | Launcher: pages, public Coinbase proxy (Exchange with Advanced fallback), `/health`, account routes, Crypta routes, loopback/Origin/`X-Fable-Local` checks |
| `market-scan/account.py` | View-only Coinbase: key detection by content, ES256/Ed25519 JWT (pure-Python fallback), snapshot, fills, v2 transfers |
| `market-scan/crypta.py` | Crypta server side: fixed system prompt and tools, Anthropic streaming with prompt caching and monthly cap, Ollama translation and model download |
| `src/desk/*`, `src/lab/*` | Page shells and logic for the two tools |
| `src/autofill.js` | Autofill, linked costs, ticket, journal import, equity log, deposits, tax CSV, cooling-off |
| `src/crypta/*` | Crypta widget, guide (`guide.md`), sprite, PWA files |
| `src/workspace.js/.css` | Shared navigation and live market strip |
| `build.js` | Builds `edge-lab/*.html`, `START-HERE.html` and the Crypta page |
| `tests/` | Everything below |

## Tests
Setup:
- Node 18+ and Python 3.8+.
- `cd tests && npm ci`
- `pip install cryptography pyjwt playwright`
- `python -m playwright install chromium`

Full run: `bash tests/run_all.sh --quick` (about 15 minutes; needs Git Bash). If `python3` isn't found on Windows, run the individual `tests/desk/*.py` files with `py -3`.

Key suites:
- Planner and journal math: `test_properties.js` (randomized properties vs. reference implementations)
- Full scripted trading session: `e2e_trading.py`
- Random real-browser sessions: `e2e_random_browser.py [seed] [steps] [exchange-down]`
- Every button in every failure mode: `e2e_click_everything.py [normal|no-key|bad-key|exchange-down|launcher-dies]`
- Attack from another website: `e2e_hostile_site.py`
- Crypta: `test_crypta.py`, `e2e_crypta.py`, `test_crypta_local.py`, `e2e_crypta_local.py`

The simulators (`sim_coinbase.py`, `fake_anthropic.py`, `fake_ollama.py`) follow published API docs. **Where real behavior differs, the app is what should change.** Then update the simulator to match reality and keep the test.

## Never verified — please check these on the real machine
1. **Launcher output.** `START-WINDOWS.bat` should print `Live data: OK` twice and `Account: OK View-only key accepted (ES256)`. Report the lines verbatim.
2. **Coinbase field names.** Response shapes are assumed from docs: portfolio breakdown, `transaction_summary`, open orders' `order_configuration`, fills (especially `size` when `size_in_quote` is true), and v2 transactions for deposit detection. Compare Capital plan equity, cash and fee % with the Coinbase app.
3. **Open risk after Tyler's first real stop.** It should equal size × (price − limit + limit × fee).
4. **Journal P&L after the first real round trip.** It should equal the change in Coinbase equity.
5. **Deposit detection.** Confirm it only suggests real deposits and ignores the starting balance.
6. **Crypta on Ollama.** Download a model from her settings, then ask about the Capital plan and Journal. Report answer quality and whether her tools fire.
7. **Crypta on Claude** (only if Tyler adds a key file). Confirm one real answer and that usage is recorded.
8. **Taskbar install.** Install Crypta from `127.0.0.1:8765/crypta` in Edge and pin her. She should open with the launcher off and say it isn't running.

## How to work
- Reproduce before fixing. Fix one confirmed bug at a time, add or adjust a test that would have caught it, rerun the relevant suites, then the full run.
- Keep the security design intact:
  - GET-only public proxy
  - account and Crypta routes require the `X-Fable-Local` header and loopback Host/Origin
  - keys never reach the page
  - Crypta's `looksSecret` guard stays
- Update `RELEASE-REVIEW.md` and `CHANGELOG.md` with what you changed and what you verified. Say "not verified" when you couldn't.
- Report to Tyler in plain words: what you checked, what matched, what you fixed, what's still unverified.
