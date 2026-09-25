# Release tests

From the project root: `bash tests/run_all.sh`. Requires Node 18+, Python 3 with numpy/scipy and `cd tests && npm ci`. Add `--quick` only to skip the final BTC single-asset end-to-end block; both modes contain other real BTC evaluations. Record every run. The runner validates both built apps, recovery/input safety and the public proxy. New release tests are named release_*.js. See RELEASE-REVIEW.md and tests/artifacts/workspace-final-gate.log for evidence and limitations.
