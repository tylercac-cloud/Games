# AGENTS.md — operating manual for Astra (or any AI agent)

Read HANDOFF.md first for context. This file is how to change things without breaking them.

---

## Reading guide — spend tokens only where the task is

Approximate sizes (about 4 characters per token for code and prose; number-heavy data costs more).

| Task | Read | ≈ tokens |
|---|---|---|
| Orientation (always) | README.md, HANDOFF.md, this file | ~5.5k |
| Change verdict math, engine, signals, pooling, the next-action instruction | `src/core.js` (+ METHOD.md if the maths changes) | ~6k (+1.5k) |
| Change UI behaviour (loading, pool, runs, register, journal, **persistence**) | `src/ui.js` | ~13k |
| Change layout, copy, styles, the in-app methodology text | `src/shell.html` | ~5k |
| Add or fix a test | `tests/README.md`, `tests/verify.js`, the one test file | ~4k |
| Screener | `screener/screener-v2.html` | ~5k |
| History / why something is the way it is | CHANGELOG.md | ~2.5k |

**Never open** unless the task is specifically about them: `edge-lab/edge-lab-v5.html` (the built app, ~70k+ tokens — edit `src/` instead), `src/data/btc-usd-daily.pack` (134k characters of prices), `tests/fixtures/edge.csv`, `archive/`, `tests/node_modules/`, `tests/reference/*.json`. Use `grep -n` to find a line instead of reading a whole file.

## The loop for every change

1. **Before touching anything:** `cd tests && ./run_all.sh --quick`. It must end in `ALL CHECKS PASSED`. If it doesn't, stop and report; don't build on a red baseline.
2. Make the change **in `src/`**, then run `node build.js` from the project root to regenerate `edge-lab/edge-lab-v5.html`. Never edit the built file directly — the gate's first check fails if it differs from a fresh build.
3. Run `./run_all.sh --quick` again. Exit code 0 is required.
4. If you touched **verdict math, the engine, signals, sweeps, costs or exits**, also run the **simulation gate** (below) and the full `./run_all.sh` (includes real BTC sweeps — disclose the results to the owner).
5. Update CHANGELOG.md with what changed and the evidence. Update HANDOFF.md if behaviour, defaults or numbers changed.
6. Report to the owner: what changed, which checks passed, what you could not verify. Never say "bug-free" or "verified" for something no check covers.

## Where things live

The shipped app is one file on purpose (it must open anywhere with no build step). It is **built** from four source files by `build.js`:

| Source | Contents |
|---|---|
| `src/core.js` | Engine, statistics, signals, sweeps, pooling, trial accounting, `familyStats()`, `judge()`. No DOM access. |
| `src/ui.js` | Everything that touches the page: data loading, pool UI, `doRun()`, `render()`, register, Kelly, journal, storage, import/export. |
| `src/shell.html` | Markup, styles, the in-app methodology tab. |
| `src/data/btc-usd-daily.pack` | Bundled BTC bars, `YYMMDD,open,high,low,close;` — never edit by hand. |

Inside the built file the core is still delimited by these markers (tests extract it from the built file, so they test what ships):

| Marker | Contents |
|---|---|
| `/* ============ normal distribution` … `/* ============ header ============ */` | **The core**: stats, engine, signals, sweeps, bundled data, and `familyStats()` + `judge()`. `tests/extract_core.js` cuts exactly this block into `tests/core.js`, so tests run the shipped code. No DOM access allowed in this block. |
| After the header marker | UI: `doRun()`, `render()`, register, Kelly, journal, storage, import/export. |

**`familyStats()` and `judge()` are the only place verdict math lives.** The UI calls them; the simulations (`tests/sims/v5pipe.js`) call them. Never re-implement verdict logic anywhere else. `MIN_TRADES` is the single trade-minimum constant.

The Python files in `tests/reference/` are an **independent** re-implementation used to catch bugs in the JS. When you intentionally change a rule (e.g. a threshold), change it in both and say so in the CHANGELOG — the reference exists to disagree with you when you're wrong.

## The simulation gate (required for any verdict-affecting change)

Null series (no edge) must essentially never pass; planted edges must be detected at roughly the rates in HANDOFF §6.

```bash
node sims/sim6.js drift 0 30 0 ma       # expect 0–1 passes
node sims/sim6.js garch 0 30 0 rsi      # expect 0–1 passes
node sims/sim6.js drift 0 30 0 brk      # expect 0–1 passes
node sims/sim6.js drift 0.006 14 0 ma   # expect ~12/14
node sims/sim6.js mr 0.3 25 0 rsi       # expect ~13/25
node sims/sim6.js drift 0.006 25 0 brk  # expect ~25/25
```

Single core: ~10 s per MA run. Pooled gate (fast, diagnostics off):

```bash
node sims/simpool.js null 0 300 0.5 0 ma      # expect ~0-2 passes pooled
node sims/simpool.js indep 0.004 150 0.7 0 ma # pooled should beat single (~44 vs ~26)
FULL=1 node sims/simpool.js indep 0.004 150 0.3 0 ma  # full-history case (~92 vs ~29)
```

 If a change raises null passes or drops detection, it does not ship — report the numbers instead.

## Golden values

`tests/verify.js` pins the end-to-end verdicts on bundled BTC at current defaults (`GOLDEN`: MA 0.908, RSI 0.024, breakout 0.820). If they move, either you introduced a bug or you intentionally changed defaults/logic. In the second case: update `GOLDEN`, write why in CHANGELOG.md. **Never change defaults or logic to make a strategy pass.**

## Adding things

- **New coin:** add one line to `COINS` in `src/core.js` (`{id:'XXX-USD', name:'XXX'}`). The dropdown, market refresh and `coinName()` follow. Run `test_coins.js`.
- **New strategy family:** add a `PARAMS` entry, a `signal()` branch (state, not event — see CHANGELOG pass 7), a `SWEEP` set, a Python mirror in `reference/ref_engine.py`, a planted-edge generator in `sims/sim6.js`, and lookahead coverage (test_core T7 loops over families — add yours).
- **New statistic:** put it in the core block as a pure function; add a scipy/paper check in `reference/`; add assertions to `verify.js`.
- **New test:** make it print deterministic lines, then add regex assertions to `verify.js`. A test nobody asserts on doesn't count.
- **Prove the gate can fail:** for any new check, plant the bug it's meant to catch in a scratch copy and confirm `verify.js` exits 1 (CHANGELOG pass 8 shows how).

## Hard rules (repeated from HANDOFF §3 because they matter most)

1. Never tune strategies on bundled BTC to make them pass. Test design ideas on synthetic data with a planted edge.
2. Disclose every run on real data. `./run_all.sh` full mode runs single-asset BTC sweeps; **both modes** run pooled MA sweeps that include bundled BTC (pooling tests).
3. Buy-and-hold is the benchmark; all verdict statistics use excess-over-holding returns.
4. Never execute trades or handle credentials.
5. Don't claim power, profitability or correctness beyond what a check shows.
