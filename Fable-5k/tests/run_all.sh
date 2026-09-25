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
python3 tests/desk/test_second_launch.py
python3 tests/desk/e2e_launcher.py
python3 tests/desk/e2e_launcher.py exchange-down
python3 tests/desk/e2e_trading.py
node tests/desk/test_properties.js
python3 tests/desk/e2e_random_browser.py 7 30
python3 tests/desk/e2e_click_everything.py
for mode in no-key bad-key exchange-down launcher-dies; do python3 tests/desk/e2e_click_everything.py $mode; done
python3 tests/desk/e2e_hostile_site.py
python3 tests/desk/test_crypta.py
node tests/desk/test_crypta_guide.js
python3 tests/desk/e2e_crypta.py
python3 tests/desk/test_crypta_local.py
python3 tests/desk/e2e_crypta_local.py
echo 'COMPLETE WORKSPACE GATE PASSED'
