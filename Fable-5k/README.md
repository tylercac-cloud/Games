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

- `Live data: OK Coinbase Advanced (daily scan)` — used by **Scan daily markets**.
- `Live data: OK Coinbase Exchange (candles, live stats)` — used by **Fetch**, **Refresh market pool** and the **Live market** strip.

The key file's exact name doesn't matter — any `.json` file is used, and if none exists, any other file in `private/` (besides this README) whose content is a Coinbase key. If api.exchange.coinbase.com is unreachable, prices and candles come from Coinbase Advanced instead and the line says "via Advanced fallback". A FAIL line gives the specific cause: SSL certificate (macOS: run *Install Certificates.command* in the Python folder, or `python3 -m pip install certifi`), DNS/offline, timeout, HTTP 403 (VPN/region), rate limit, or a non-JSON block page. Re-test any time with `python market-scan/server.py --check` (Windows: `py -3 market-scan\server.py --check`) or the **Check connection** button in the strip. Double-clicking the launcher again just reopens the running app. If another program holds port 8765, Fable uses the next port and warns that your saved data belongs to the 8765 address.

The Live market strip (BTC/ETH/SOL last trade, 24h change and range, 24h USD volume, bid/ask spread in bps) refreshes every 30 seconds while the tab is visible. It is informational only; the locked study, scanner, sizing and verdicts use completed daily candles only. Spread is a real execution cost on top of your Coinbase fee tier.

## Autofill and Coinbase account (release 12)

Numbers are entered once and flow everywhere. Any field you type in is never overwritten; clear it to hand it back to autofill. Autofilled fields have a green left edge; hover for the source.

- **Capital plan** fills itself when opened: live mid price, stop at the 30-day low (the H2 exit level), slippage = half the live spread (minimum 1 bp), and — with a View-only key — equity, cash, open risk, high-water mark and your Coinbase fee tier. It then calculates. Change **Asset** to re-plan another coin.
- **Fees** are shared by Capital plan, Execution and the Test round-trip cost in both tools; slippage you type is shared the same way. Live spread only feeds Capital plan. Test cost never changes while a lab lock is active.
- **Journal** is prefilled from the last plan. **Import from Coinbase** lists completed round trips (volume-weighted entry/exit, summed commissions); **Use** fills the form, **Add trade** logs it once.
- **Sizing** counts wins, trades and win/loss ratio from the Journal. **Budget** takes the years of loaded data.

### Release 17 additions (Daily desk)

- **Trade ticket** under the Capital plan result: the exact order to place — quantity rounded down to Coinbase's step, stop and stop-limit prices rounded to its tick, Copy buttons, a minimum-order check, and the loss if the stop-limit fills at its limit (never above the risk budget). Switch to a limit entry to see the maker-fee size.
- **Equity log**: one entry per day when Capital plan reads the account, charted against $4,500, $4,250 and the hard floor. Saved in the desk backup together with the high-water mark, deposits and plan history, so clearing the browser no longer resets them (import never lowers a recorded peak).
- **Journal review**: gross P&L, fees, net P&L, fees as % of traded value and of gross profit, maker-fee saving, and results split by "Followed the plan?" (optional answer per trade).
- **Cooling-off**: two losing trades closed within 24 hours stop new sizing until the older one is 24 hours old. Fixed rule, no override.
- **Deposit detection**: *Detect from Coinbase* lists fiat deposits, withdrawals and crypto sends/receives since a date; *Use* fills Net deposits. Never applied without the click. The Coinbase App history this reads may include accounts outside the key's portfolio — check each line.
- **Tax CSV**: Form 8949-style lines for a year from every Coinbase fill, FIFO per coin (USD and USDC books combined), fees in basis and proceeds, holding period, and sales without a matching purchase flagged. Not tax advice; reconcile with Coinbase's 1099-DA and your CPA.

### Release 18: less typing

- **Journal logs trades in one tap.** Opening the Journal lists every unlogged Coinbase round trip from the last 120 days, all coins at once. Tap *Followed*, *Partly* or *Didn't* and it's logged with size, entry, exit, fees, close time and the plan's expected price. Trades with no earlier plan get one button, *Log (no plan)*.
- **Deposits are flagged for you.** Every account read re-checks Coinbase transfer history and offers the correction if it disagrees with Net deposits (*Use*, or *Keep my figure* to stop the prompt until Coinbase's figure changes). Money that arrived before Fable's first reading is the starting balance and never counted.
- **Manual journal entries** have a *Closed on* date (defaults to today), so logging old trades never triggers cooling-off.

## Crypta, your helper (release 23)

Crypta is the round button at the bottom right of both tools (or **Alt+C**), and her own installable window at `127.0.0.1:8765/crypta` (Edge or Chrome → Install → pin to the taskbar). The panel is resizable and remembers its size and whether it was open.

- **She can see anything in the app, read-only:** any tab's contents with every value labelled, the Journal, the research register, the Coinbase account snapshot with equity history and plan history, the daily scan, and live market data for any pair. She can switch tabs, highlight a field, refresh Capital plan and open trades to log.
- **Guide mode** (no key): built-in guide plus answers worked out from your live numbers — plan math, distance to each limit, open risk by position, how your trades are going, why a size is $0.
- **Free local brain:** install Ollama (ollama.com/download), start it, then download Qwen3 8B or 4B from Crypta's settings with one click. Free and private (nothing leaves your PC); slower and less sharp than Claude.
- **Claude brain:** an Anthropic API key file in `private/`. **A Claude Pro subscription does not include API credits**: the API is billed separately through console.anthropic.com. Default model Claude Sonnet 5: about $0.02 per typical question with prompt caching (the first question of a session about $0.035, list prices), Haiku 4.5 selectable at about half; a monthly cap (default $5) is enforced by the launcher.
- She will not predict prices, pick trades, or help around the loss limits, cooling-off or study locks. Anything that looks like a key is refused before it leaves the page.

### Connect Coinbase (optional, View-only)

Follow `private/README.txt`: create a **Secret API key** with **View** permission only (ideally scoped to a separate "Fable 5k" portfolio), download its JSON into `private/`, restart the launcher and confirm `Account: OK`. A *Client API key* will not work. Choose **ECDSA** under Advanced Settings: Coinbase documents it as required for account access. The launcher refuses keys that can trade or transfer, signs requests locally and never sends the key to the page, backups or logs. Never paste a key into a chat.

Open risk counts each position down to its Coinbase stop orders; positions without a stop count at full value. When you add money to the portfolio, enter it under **Net deposits since start** in the account panel (withdrawals negative). Capital plan then uses experiment equity = Coinbase total − net deposits, so a deposit never counts as profit or hides a loss, and the high-water mark shifts by the same amount.

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
