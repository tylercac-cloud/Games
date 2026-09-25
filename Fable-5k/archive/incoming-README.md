# Fable 5k Project — export

Start with **HANDOFF.md**, then **AGENTS.md** (how to change code safely). METHOD.md has the statistics, CHANGELOG.md the audit history.

- Open `edge-lab/edge-lab-v5.html` in a browser to use the tool. It is built from `src/` by `node build.js`; edit the source, not the built file.
- Open `screener/screener-v2.html` for the token rug-risk checklist.
- Run `tests/run_all.sh --quick` before and after any change; it must print `ALL CHECKS PASSED` and exit 0.

Instructions for an AI assistant: read HANDOFF.md §3 ("non-negotiable rules") before proposing any strategy change.

## Audit 9: getting started

1. Unzip the whole folder and open `edge-lab/edge-lab-v5.html` in a browser.
2. Import your existing register backup first. The ZIP contains the application, not your browser/cloud research records.
3. Use **Refresh BTC + ETH + SOL** for up to 1,800 completed daily candles per asset. If blocked, use CSV. Remove individual assets in the pool panel when needed. This is a fixed three-asset watchlist, not a market-wide screener.
4. Write the mechanism and set the rule/exits/costs. **Lock current hypothesis**, then run once. A changed data snapshot or input requires a new lock; **Deactivate lock** preserves the record and permits exploratory runs.
5. Download a backup and verify it arrived, or copy the manual backup JSON. That box now updates even when browser/cloud storage works; updates pause while you are editing it.

See `REVIEW.md` for this audit's fixes, test coverage and remaining limitations. No strategy, cost default, engine or statistical threshold was tuned in this pass.
