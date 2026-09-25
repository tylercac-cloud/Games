# The Method, v2 — what the research changed

Version 1 was directionally right and technically wrong in three places. This documents what changed and why. Every formula below is verified against the source papers' own worked numbers.

---

## What v1 got wrong

**1. I used Bonferroni.** Dividing α by the number of hypotheses is blunt. It ignores how dispersed your results were, how long your sample is, and how fat-tailed the returns are. The right correction is the **Deflated Sharpe Ratio**, which folds in all four.

**2. I used a single 70/30 holdout.** Bailey and López de Prado are explicit that this doesn't work: holdout evaluates a rule as if one trial had taken place. Apply it twenty times and false positives aren't unlikely, they're expected. In my own testing, pure-noise strategies cleared a single 50/50 holdout **about half the time**.

**3. I had no budget.** The most important number wasn't in v1 at all. Given how much data you have, there's a hard ceiling on how many configurations you can test before a fake Sharpe becomes the *expected* result.

---

## The budget — set this before anything else

**Minimum Backtest Length.** With `y` years of data, the Sharpe you should expect from the luckiest of N zero-skill configurations is

E[max SR] = √(1/y) · [(1−γ)·Z⁻¹(1−1/N) + γ·Z⁻¹(1−1/(N·e))]  where γ = 0.5772

Solved for N at a target Sharpe of 1.0:

| Data available | Independent configs you can afford |
|---|---|
| 2 years | **7** |
| 3 years | **13** |
| 5 years | **45** |
| 10 years | 724 |
| 20 years | 145,785 |

Five years supporting ~45 configurations is the published figure, and it reproduces exactly. The rule of thumb version: MinBTL in years < 2·ln(N) / SR².

**This is the single biggest change to how you should work.** With three years of BTC daily data you get roughly **thirteen** independent configurations. Not thirteen hundred. A parameter sweep of 4×4×3 spends 48 and puts you four times over budget before you've learned anything.

**Correlated trials count for less.** Parameter variants of one rule aren't independent. Effective trials ≈ ρ̄ + (1−ρ̄)·M (linear reading of an equation the PDF mangled; a power-law reading also fits the stated limits and gives far fewer — linear is the conservative choice). At ρ̄ = 0.9, five hundred raw configs count as about 51 — which is why sweeping one family is far cheaper than testing fifty unrelated ideas, and why you should prefer a few well-motivated families.

**When to stop searching:** from optimal stopping, sample about 37% (1/e) of the configurations you can theoretically justify, then continue only until one beats all of those. That's your candidate.

---

## The test — two failure modes, two tests

**Selection bias** — you found the luckiest of N. Caught by **PBO** (Probability of Backtest Overfitting) via combinatorially symmetric cross-validation: split the sample into 12 time blocks, form all 924 half-and-half partitions, and measure how often the in-sample winner lands in the bottom half out of sample. High PBO means the search produced the result.

**Regime decay** — the effect was real and has ended. **PBO cannot see this**, because it shuffles time blocks, so a dead edge still looks alive within the sample. It needs a separate time-ordered test: pick the winner on the first half, then measure its Sharpe in each later block.

Verified on constructed cases:

| Case | PBO | Forward retention | Caught by |
|---|---|---|---|
| Pure noise, winner by search | ~0.5 | — | PBO (weakly — see below) |
| Genuinely persistent edge | 0.00 | **173%** | passes both |
| Edge that dies halfway | 0.08 | **−10%** | time-ordered only |

Note the decaying strategy **passes PBO cleanly**. If you only ran PBO you would fund it.

**PBO must be read coarsely.** Across 100 independent all-noise datasets it averages 0.52 as theory predicts, but with a standard deviation of **0.20** and a 5th–95th range of 0.15–0.82. A single reading is ±0.4 at 95%, and more data does not narrow it — the spread was identical from 600 to 5,000 bars. About one noise run in eight scores below 0.25. Power is also weak: a small real edge (0.05σ/bar) is missed three times in four. Above 0.5 is bad news, below 0.15 is good news, the middle is uninformative. The Deflated Sharpe carries the decision.

**The fix differs by mode.** Selection bias is fixed by testing fewer things. Regime decay is not fixable — only detectable. That's a reason to prefer rules with a mechanism you can name, since a mechanism tells you when the regime has changed.

**The acceptance bar:** Deflated Sharpe ≥ 0.95, PBO below ~0.15, forward retention above ~70%. Passing all three makes a rule a candidate for minimum live size — not for capital.

---

## The sizing — bet the lower bound, then halve it

Kelly assumes you know your win rate. You have an estimate with a confidence interval, and the asymmetry is brutal:

| True win rate | Full Kelly (f=10%) | Half Kelly (f=5%) |
|---|---|---|
| 0.55 — you were right | **+0.501%**/trade | +0.375%/trade |
| 0.52 — off by 3 points | **−0.101%** | **+0.075%** |
| 0.50 — wrong | −0.503% | −0.125% |

Three points of estimation error turns full Kelly **negative** while half-Kelly stays positive. At the correct win rate, half-Kelly keeps **75%** of the growth. At p=0.50 it does **4× less damage**.

So: compute Kelly on the *lower bound* of your confidence interval, then halve it. If the lower bound implies no edge, no size is justified — trade minimum size for information, not for return.

---

## What carries over from v1 unchanged

| | |
|---|---|
| Max risk per trade | 10% ceiling — past Kelly, more risk yields less money |
| Leverage | none; at p=0.55, 3× turns 0%/trade into −3.2%/trade |
| Minimum target | 10%+; below that fees dominate |
| Volatility | lower is better — ±50% swings need a 63% win rate from variance drain alone |
| Exchange | one, not several |
| Live phase | 50+ trades at minimum size, logging expected vs actual fill every time |
| Sample size | proving a 55% win rate takes 613 trades; you cannot learn this by trading |

---

## Corrections found in the second audit pass

- **The Deflated Sharpe must be deflated by configurations searched, not by entries logged.** A 45-config sweep is one register entry. Deflating by 1 instead of 45 flipped the verdict from accept to reject across half the plausible Sharpe range (at SR 0.45: 0.9621 vs 0.5059). If you build your own version of this, that is the single easiest place to fool yourself.
- **Use the sample standard deviation, not the population one.** Dividing by n inflates Sharpe by 4.45% at 12 trades and 2.6% at 20 — in the permissive direction, worst exactly where your samples are smallest.
- **The kurtosis in the PSR denominator is raw, not excess.** Verified against Lo (2002): for normal returns Var(SR) = (1 + SR²/2)/T, which requires γ₄ = 3, not 0.
- **Retention is undefined, not zero, when the best in-sample Sharpe is negative.** There is nothing to decay from.

## Honest limits of all this

- **The math corrects for luck, not for a bad idea.** DSR and PBO tell you whether a result survives the search you ran. They cannot tell you whether the mechanism is real.
- **PBO is time-blind** — stated above, but worth repeating, because it's the failure that looks most like success.
- **The Deflated Sharpe needs a family, not a single rule.** It requires the observed spread of Sharpe ratios across the configurations you searched. One configuration gives no distribution and no DSR — run the sweep.
- **The correlation estimate is itself uncertain.** With many configs and a short sample, ρ̄ can be overfit too. Prefer the conservative direction: assume your trials are more correlated than you think, which shrinks your effective budget.
- **Crypto's history is short.** Three to five years of clean daily data for most pairs means a budget of 13–45 configurations, permanently. That constraint doesn't improve with better tooling.
- **Entry executes at the close of the signal bar.** Conventional, but mildly optimistic — real fills happen after the close is known. Treat the live slippage log as the correction for this, not an optional extra.
- Not financial advice. This measures; it does not predict.

**Sources:** Bailey & López de Prado, *The Deflated Sharpe Ratio* (Journal of Portfolio Management, 2014); Bailey, Borwein, López de Prado & Zhu, *Pseudo-Mathematics and Financial Charlatanism* (Notices of the AMS, 2014); same authors, *The Probability of Backtest Overfitting* (Journal of Computational Finance, 2017).
