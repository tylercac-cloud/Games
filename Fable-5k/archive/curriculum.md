# The Method — learning to trade on a $5K account

The goal is not to make money on $5,000. It's to arrive at your exit with a **measured** track record instead of a story. Everything below serves that.

The tool (`lab.html`) enforces most of this. This document is why.

---

## The core problem

You cannot learn to trade by trading. Proving a 55% win rate is real rather than luck takes **613 trades** (one-sided test, 5% significance, 80% power). At three swings a month that's 17 years. To prove a 52% edge takes 3,858 trades — about a century.

So live trading can't be the learning mechanism. Historical testing has to be, and historical testing has one dominant failure mode.

## The dominant failure mode: you are searching, not discovering

Searching 500 rules on a **driftless random walk** — data with no pattern in it, by construction — produced this:

| | In-sample | Out-of-sample (200 fresh series) |
|---|---|---|
| Best rule found | +191% | **−62.4%** |
| Top-10 average | +173% | **−55.6%** |

Nothing was there to find. The search manufactured the result. This is the multiple-comparisons problem: test enough hypotheses and some clear any threshold by chance. Test 20 and roughly one clears p<0.05 for free.

**The correction:** divide your significance threshold by the number of hypotheses you've tested. Twenty hypotheses means α=0.0025, not 0.05. The counter in the lab's header does this automatically — which is also why clearing the register is self-sabotage, not housekeeping.

---

## Phase 1 — Register before you test (weeks 1–4)

Write the rule and the **mechanism** before running it. "It backtested well" is not a mechanism. A mechanism is a sentence about why some participant is reliably on the other side of your trade, and who they are.

Log every test, including the embarrassing ones. The register is only load-bearing if it's complete.

**Done when:** you've logged 10+ hypotheses and killed most of them without flinching.

## Phase 2 — Hold data back (months 1–6)

Build on the first 70%. Validate on the last 30%. **Once you look at the held-out slice, it's spent** — if you tune parameters after seeing it, it has become in-sample and you have no validation left.

Kill fast. A killed rule is information. A kept-but-unvalidated rule is a liability you'll fund later.

Watch for:
- **Lookahead bias** — using data the rule wouldn't have had at decision time
- **Survivorship** — testing only on assets that still exist. 53.2% of tokens tracked since 2021 are dead; backtesting "altcoins" on today's list quietly excludes every one that went to zero
- **Too few trades** — a 60% win rate on 12 trades has a confidence interval roughly 30%–85%. That is not a finding

**Done when:** you have one rule whose held-out lower CI bound clears its breakeven rate on 30+ trades.

## Phase 3 — Live small, log slippage (months 6–18)

Backtests fill at prices you may never get. Trade minimum size and record expected vs actual fill on **every** entry.

Slippage above ~0.2% per side deletes most retail edges. It's the single most common reason a validated backtest loses money live, and the only way to measure it is to trade.

This phase also builds the thing no backtest can: evidence that you follow your own rules during a drawdown. That's the variable that decides whether you should trade $250K.

**Done when:** 50+ live trades logged, measured slippage, and zero rule violations you can't explain.

## Phase 4 — Scale decision (at exit)

Deploy real capital only on rules with held-out **and** live evidence.

Two cautions that only appear at size:
- **Strategies dependent on small size break when you have capital.** Thin-book and micro-cap edges evaporate the moment your order moves the book. Deliberately avoid learning those — they're a skill that expires exactly when you need it.
- **The same percentage hurts more.** A 10% drawdown is $500 today and $25,000 on $250K. Identical math, completely different to live through. The discipline you build now is the only thing that transfers.

---

## Hard-won constants, from the math we ran

| | |
|---|---|
| Max risk per trade | **10%** — past Kelly, more risk produces *less* money |
| Leverage | **None.** At p=0.55, 3x turns 0%/trade into −3.2%/trade |
| Minimum target | **10%+** — below that, fees dominate |
| R:R | **1:2 or better** — at 1:3 on 10% targets, breakeven is 26% |
| Trade frequency | **Low.** Fee drag scales linearly with it |
| Volatility | **Lower is better.** ±50% swings need a 63% win rate before a single fee, purely from variance drain |
| Exchange | **One**, not several — splitting capital pins you to the worst fee tier on both |

## What this is not

This is a measurement method, not investment advice, and it can't predict anything. Its main job is telling you when you don't know something yet — which will be most of the time, and is the correct answer.
