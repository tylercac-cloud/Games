# Release 12 maintenance contract

Read README.md and RELEASE-REVIEW.md before changing this workspace. Historical HANDOFF.md, REVIEW.md and CHANGELOG.md describe earlier versions and contain superseded claims. Their old fee, live-entry, pre-registration and holdout statements are not current guarantees.

## Canonical source

- `src/lab/core.js`, `src/lab/ui.js`, `src/lab/shell.html`: incoming pooled strategy lab, with final release fixes.
- `src/desk/core.js`, `src/desk/ui.js`, `src/desk/shell.html`: restored checkpoint scanner, frozen study, risk planner and execution audit.
- `src/data/btc-usd-daily.pack`: shared unchanged historical BTC fixture.
- `src/start.html`, `src/workspace.css`, `src/workspace.js`: workspace entry, shared style and accessible navigation.
- `build.js` builds `START-HERE.html`, `edge-lab/strategy-lab.html`, and `edge-lab/edge-lab-v7.html`.

Never edit generated HTML. Edit source, run `node build.js`, then `bash tests/run_all.sh`. `node build.js --check` verifies all three outputs. The archived incoming source is reference only.

## Test contract

Install Node 18+, Python 3 with numpy/scipy, and `cd tests && npm ci`. Run the gate before and after changes. `bash tests/run_all.sh --quick` skips only the final BTC single-asset end-to-end sweeps; both modes still include real BTC reference and pooled tests. Disclose every real-data evaluation. Synthetic checks can be run with `node tests/test_final_release.js`, `node tests/release_verify.js --safety-only`, and the scripts under `tests/desk/` after their extractors.

The `release_*.js` tests target the current strategy-lab output. The runner also validates the restored desk and proxy. A failure must block release. Mutation evidence is in tests/artifacts/release-mutation.log.

## Research and account safeguards

Never tune on bundled BTC, scanned prices or prospective observations. Do not promote 736 documented checkpoint evaluation operations into independent trials or a complete lifetime count: incoming and final audits add exposures, and earlier counts remain unknown. The paper protocol is unchanged; any amendment requires a new dated version retaining the original.

The lab's historical same-close engine/statistical formula and the desk's next-open cash-accounting model serve different purposes. Do not conflate their returns or inferential claims. A verdict-affecting change requires the null and planted-edge simulations described in archive/incoming-AGENTS.md and the full gate; never change golden values merely to get a pass.

The lab uses `edgelab:` storage; the desk uses `fable-desk:` storage. Their backup formats have different extensions. Never overwrite one with the other. Keep backup signatures based on full normalized content (excluding transport timestamps). Keep live trading and credentials absent. The launcher is the only network path: add public GET routes to its allowlist with bounds and a `test_live_proxy.py` case; pages call Coinbase through `routePublic()`. Account access is View-only by construction: only fixed GET routes in `market-scan/account.py`, trade/transfer keys refused, key never sent to the page, `X-Fable-Local` header required. Never add order endpoints. `src/autofill.js` must never overwrite typed values or feed the study. The Live market strip is informational and must never feed the study, scanner, sizing or verdicts. Manual equity and risk limits cannot enforce exchange-side liquidation.

No parallel agents are required by these instructions.
