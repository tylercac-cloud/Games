## What Fable 5k is
Fable 5k is a research and discipline workspace for a $5,000 crypto experiment on Coinbase. It never places orders and cannot move money. It tells you how big a trade may be, records what happened, and stops you when the experiment's loss limits are reached. There are two tools: the Daily desk (daily routine, sizing, journal) and the Pooled strategy lab (testing rule ideas across coins). Keep live trades in the desk journal only.

## Starting the app
Double-click START-WINDOWS.bat and leave the black window open. It must print "Live data: OK" twice. With a Coinbase View-only key it also prints "Account: OK View-only key accepted". Closing that window stops live data; pages then say "Launcher not reachable". Double-clicking the launcher again just reopens the running app at the same address, so your saved data stays visible.

## Daily routine
After 00:05 UTC: open the Daily desk, press Scan daily markets, download the scan. Before any real trade, open Capital plan: it fills itself and calculates. Place exactly the order on the trade ticket in Coinbase, including the stop-limit. After a trade closes, open the Journal and tap one button to log it. Export the backup file and confirm it saved.

## Capital plan
Capital plan sizes a trade so a stop-out loses at most the risk budget. It fills itself: live mid price, stop at the 30-day low, slippage from half the live spread (minimum 1 basis point), and, with a View-only key, equity, cash, open risk, high-water mark and your Coinbase fee tier. Any number you type is kept; clear a field to hand it back to autofill. Change Asset to plan another coin. Autofilled fields have a green left edge; hover to see the source.

## Risk budget and limits
Per-trade risk is 0.5% of equity ($25 at $5,000). Total open risk across positions is capped at 1% of equity. A single position is capped at 25% of equity. Stages: within limits; review at $4,500 (per-trade risk halved); no new risk at $4,250 (size $0); hard pause at the higher of $4,000 or $1,000 below the high-water mark. These limits come from the locked protocol and cannot be raised in the app.

## Trade ticket
The ticket under the Capital plan result is the exact order to place: quantity rounded down to Coinbase's step, stop and stop-limit prices rounded to its tick, with Copy buttons. It shows the loss if the stop-limit fills at its limit, which never exceeds the risk budget. Stop-limit gap % sets how far below the stop the limit sits (default 0.2%). A limit entry at the maker fee allows a larger size for the same risk but may not fill. If price gaps below the limit, the stop-limit does not fill and the position is unprotected.

## Open risk
Open risk counts each position down to its Coinbase stop orders: quantity × (price − the lower of stop and limit + that price × fee). A position with no stop order, or whose stop-limit the price has already fallen through, counts at full value. Place a stop in Coinbase to free the room.

## Cooling-off
Two losing trades closed within 24 hours stop new sizing until the older loss is 24 hours old. The rule is fixed and has no override. Old trades logged by hand use their Closed on date, so logging last week's losses does not trigger it.

## Journal: log trades in one tap
Opening the Journal lists every unlogged Coinbase round trip from the last 120 days, all coins. Tap Followed, Partly or Didn't to log it with size, entry, exit, fees, close time and the planned price. Trades with no plan before them get Log (no plan). The review shows gross P&L, fees, net P&L, fees as a share of profit, the saving at maker fees, and results split by whether you followed the plan. With few trades those splits are anecdotes, not evidence.

## Deposits and withdrawals
Money you add is not profit. Every account read re-checks Coinbase transfer history and offers Use when it disagrees with Net deposits; Keep my figure silences it until Coinbase's number changes. Capital plan uses experiment equity = Coinbase total − net deposits. Money that arrived before Fable first read the account is the starting balance. The high-water mark shifts with each correction.

## Equity history and backup
Each day Capital plan reads the account it records equity, high-water mark and stage, charted against $4,500, $4,250 and the hard floor. The desk backup file carries the journal, register, equity log, high-water mark, net deposits, plan history and logged trades. Clearing browser data without a backup loses them. Import never lowers a recorded high-water mark.

## Tax CSV
The Journal's Tax CSV builds Form 8949-style lines for a year from every Coinbase fill: FIFO lots per coin (USD and USDC books combined), fees added to cost and taken from proceeds, holding period, sales without a matching purchase flagged. It is not tax advice; Coinbase's 1099-DA may use a different method. Reconcile with your CPA.

## Connecting Coinbase
Create a Secret API key in the Coinbase Developer Platform with View permission only, ECDSA signature algorithm, scoped to the portfolio that holds the experiment money. Download its JSON file and save it in the private folder. The launcher refuses keys that can trade or transfer. Never paste a key into a chat, including this one. A Client API key does not work.

## Connecting Crypta's AI
Without a brain Crypta answers from this built-in guide. There are two brains: a free local model through Ollama (see "Crypta's free local brain") or Claude. For full answers, create an Anthropic API key at console.anthropic.com. A Claude Pro subscription does not include API credits; the API is paid for separately there. Save the key as a text file in the private folder (for example private/anthropic-key.txt); no restart needed. The key never reaches the page. Set a monthly spending cap in Crypta's settings; Crypta refuses requests past it.

## Live market strip
The strip at the top shows BTC, ETH and SOL last price, 24-hour change and range, 24-hour volume and bid/ask spread, refreshed every 30 seconds. It is context only; nothing in the study, scanner or sizing uses it. If Coinbase's Exchange host is unreachable, prices come from Coinbase Advanced and the launcher says "via Advanced fallback".

## Daily scan and the locked study
Scan daily markets reads every Coinbase USD pair and completed daily candles for BTC, ETH and SOL, and records the two frozen BTC hypotheses: H1, the 20-day moving average crossing above the 120-day; H2, a close above the 60-day high with an exit on a close below the 30-day low. They were frozen before any data was seen and are paper only. The desk records what they say; it does not tell you to trade them.

## Strategy lab and trial budget
The lab tests rule ideas across coins. Every run spends a trial; the budget tab estimates how many configurations the data can support before a winner is likely luck. Passing needs a Deflated Sharpe Ratio of at least 0.95 against buy-and-hold. So far moving-average cross scored 0.908, breakout 0.820 and RSI 0.024 on BTC: all failed. Locking a test before running it keeps the result honest; changing the rule or data after locking voids the lock.

## Troubleshooting: Live data FAIL, Account FAIL, empty register
"Live data: FAIL" names the cause: SSL certificates (on macOS run Install Certificates.command), DNS or offline, a VPN or region block (HTTP 403), rate limit, or a block page. "Account: FAIL" with HTTP 401 means the key was rejected: check it is not deleted, the PC clock is automatic, and it uses ECDSA. If the saved register looks empty, check the address is 127.0.0.1:8765 in the same browser. Run the launcher with --check to re-test connections.

## Crypta's free local brain
Crypta can run on a free model on your own PC through Ollama. Install Ollama from ollama.com/download and start it. In Crypta's settings (⚙) the Local model box then offers one-click downloads: Qwen3 8B (about 5 GB, best, needs about 16 GB of RAM) or Qwen3 4B (about 2.5 GB, for 8 GB of RAM). When the download finishes she switches to it automatically; Brain = Automatic uses Claude if an Anthropic key is present, otherwise the local model, otherwise the guide. Local answers are free and never leave your PC, but they are slower and less sharp than Claude, especially on long multi-step questions.

## Crypta on your taskbar
Open Crypta's own window with the ⧉ button in her chat, or go to 127.0.0.1:8765/crypta. In Edge or Chrome choose Install (the install icon in the address bar, or Crypta's settings → Install on taskbar), then right-click her taskbar icon and pick Pin to taskbar. Her window works next to the Daily desk: she sees the desk you used last and can switch its tabs. If the launcher is not running she still opens and says so.

## What Crypta will not do
Crypta explains the app and your numbers, and can move between tabs or point at a field. She can read any tab, the Journal, the register, the account snapshot, the daily scan and live market data, but only reads. She does not predict prices, pick trades, or help work around the loss limits, cooling-off or study locks. She cannot place orders or see your keys.
