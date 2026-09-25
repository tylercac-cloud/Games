# Fable 5k — user workspace

## Start

1. Extract this entire ZIP to a permanent folder.
2. On Windows, double-click **START-WINDOWS.bat**. Python 3 is required. Keep the terminal window open while using the app. On macOS/Linux run `bash START-MAC-LINUX.sh`.
3. Open the displayed `http://127.0.0.1:8765/` address if your browser does not open automatically.
4. Use **Daily research desk** for the scanner, locked study, capital planner and next-open execution audit. Use **Pooled strategy lab** for exploratory multi-asset research and its journal.

For offline use, open **START-HERE.html** directly. Public requests may be blocked in that mode. Browser storage belongs to the exact browser and origin: the direct-file copy and local-server copy do not share records. Use the launcher consistently.

No build or Node installation is needed to use the delivered HTML. No API keys, account login or order execution are implemented.

## Live data

All live data is public Coinbase market data fetched through the local launcher (browsers block direct exchange requests from a page). On start the terminal prints one line per upstream:

- `Live data · OK Coinbase Advanced (daily scan)` — used by **Scan daily markets**.
- `Live data · OK Coinbase Exchange (candles, live stats)` — used by **Fetch**, **Refresh market pool** and the **Live market** strip.

A FAIL line gives the specific cause: SSL certificate (macOS: run *Install Certificates.command* in the Python folder, or `python3 -m pip install certifi`), DNS/offline, timeout, HTTP 403 (VPN/region), rate limit, or a non-JSON block page. Re-test any time with `python market-scan/server.py --check` (Windows: `py -3 market-scan\server.py --check`) or the **Check connection** button in the strip. If port 8765 is busy the launcher uses the next free port and prints it.

The Live market strip (BTC/ETH/SOL last trade, 24h change and range, 24h USD volume, bid/ask spread in bps) refreshes every 30 seconds while the tab is visible. It is informational only; the locked study, scanner, sizing and verdicts use completed daily candles only. Spread is a real execution cost on top of your Coinbase fee tier.

## Autofill and Coinbase account (release 12)

Numbers are entered once and flow everywhere. Any field you type in is never overwritten; clear it to hand it back to autofill. Autofilled fields have a green left edge; hover for the source.

- **Capital plan** fills itself when opened: live mid price, stop at the 30-day low (the H2 exit level), slippage = half the live spread (minimum 1 bp), and — with a View-only key — equity, cash, open risk, high-water mark and your Coinbase fee tier. It then calculates. Change **Asset** to re-plan another coin.
- **Fees and slippage** are shared by Capital plan, Execution and the Test round-trip cost in both tools.
- **Journal** is prefilled from the last plan. **Import from Coinbase** lists completed round trips (volume-weighted entry/exit, summed commissions); **Use** fills the form, **Add trade** logs it once.
- **Sizing** counts wins, trades and win/loss ratio from the Journal. **Budget** takes the years of loaded data.

### Connect Coinbase (optional, View-only)

Follow `private/README.txt`: create a **Secret API key** with **View** permission only (ideally scoped to a separate "Fable 5k" portfolio), download its JSON into `private/`, restart the launcher and confirm `Account · OK`. A *Client API key* will not work. The launcher refuses keys that can trade or transfer, signs requests locally and never sends the key to the page, backups or logs. Never paste a key into a chat.

Open risk counts each position down to its Coinbase stop orders; positions without a stop count at full value. Deposits and withdrawals are not netted out of equity — adjust High-water equity when you add or remove money.

## Daily workflow

- Try **Synthetic preview** once, then **Scan daily markets** after 00:05 UTC. Only completed candles qualify. A failed scan is not a signal to act.
- Download the full scan to preserve raw observations. The app retains exposure summaries and checksums, not every full scan.
- Enter current equity, cash, high-water mark, existing open risk, actual fee assumptions and proposed prices in **Capital plan**. Include unrealized P&L; adjust for deposits/withdrawals. The app cannot read your Coinbase balance or enforce a broker-side stop.
- The two locked BTC hypotheses remain **paper-only**. The original protocol and checksum are preserved. Observations collected late must not be represented as contemporaneous records.
- If you independently place real trades, record actual fills and total fees in one journal, and reconcile it with Coinbase. Do not duplicate the same trades across both tools.

## Preserve your records

The daily desk and pooled lab have separate storage and separate JSON backups. This prevents incompatible versions overwriting one another. Import earlier Claude register backups into the pooled lab; import v7 checkpoint backups into the daily desk. Export each tool you use after every session, verify the files arrived, and keep the originals. Use one active tab per tool. Do not clear browser site data.

The ZIP contains software, protocols and audit evidence. Your private browser/cloud records are not included automatically. Active exploratory locks are session-only; saved lock history survives export/import. Local checksums establish consistency, not independent timestamping.

## Experiment limits

$5,000 starting capital; review at $4,500; stop adding risk at $4,250; hard pause at $4,000 or $1,000 below the cash-flow-adjusted high-water mark. The planner reduces modeled risk at review and forces new position size to zero at the stop-adding-risk/hard-pause stages. These controls are manual planning rules. Realized losses can exceed them.

## Scope and validation

Read **RELEASE-REVIEW.md** for tests and remaining limitations. The scanner, proxy and live strip were tested end to end against a local fake Coinbase. The build environment blocks outbound internet, so a real Coinbase response was not received here; the launcher's startup check verifies it on your machine. Real browser rendering and Windows double-click behavior were not verified here. No real orders were placed. Do not interpret this release as evidence of a profitable strategy or live-trading certification.

Developer entry point: **AGENTS.md**. Edit `src/lab/` or `src/desk/`, run `node build.js`, then `bash tests/run_all.sh`. Both applications and START-HERE.html are generated files.
