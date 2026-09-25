#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node build.js --check
node tests/test_final_release.js
node tests/release_verify.js "$@"
node tests/desk/extract_core.js
node tests/desk/extract_research.js
node tests/desk/test_research.js
node tests/desk/test_research_ui.js
node tests/desk/test_execution.js
node tests/desk/test_v6_ui.js
python3 tests/desk/test_market_server.py
python3 tests/desk/test_live_proxy.py
node tests/desk/test_live_strip.js
python3 tests/desk/test_account.py
node tests/desk/test_autofill.js
echo 'COMPLETE WORKSPACE GATE PASSED'
