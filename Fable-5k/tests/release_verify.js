#!/usr/bin/env node
/* verify.js — the release gate. Runs every suite and ASSERTS on its output.
   Exit code 0 = every check passed; 1 = at least one failed. Nothing ships
   unless this prints ALL CHECKS PASSED.  Usage: node tests/verify.js [--quick]
   --quick skips the end-to-end BTC sweeps (they are real trials on BTC data).

   Golden values: the end-to-end block pins the verdicts on bundled BTC at the
   current defaults. If you intentionally change defaults or verdict logic,
   update GOLDEN below AND record why in CHANGELOG.md — never to make a
   strategy look better. */
const {execFileSync}=require('child_process');const path=require('path');const fs=require('fs');
const here=__dirname,quick=process.argv.includes('--quick'),safetyOnly=process.argv.includes('--safety-only');
const GOLDEN={ma:'0.908',rsi:'0.024',brk:'0.820'};
let pass=0,fail=0;const failures=[];
function run(cmd,args){if(safetyOnly&&args[0]!=='release_test_release_safety.js')return '';try{return execFileSync(cmd,args,{cwd:here,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64e6,timeout:600000})}
  catch(e){return (e.stdout||'')+(e.stderr||'')+'\nPROCESS FAILED: '+e.message}}
function check(suite,name,ok){if(ok){pass++}else{fail++;failures.push(suite+' :: '+name)}
  console.log((ok?'  PASS ':'  FAIL ')+name)}
function suite(title,cmd,args,expects,forbids){if(safetyOnly&&title!=='release safety regressions')return '';console.log('\n== '+title);const out=run(cmd,args);
  for(const [name,re] of expects)check(title,name,re.test(out));
  for(const [name,re] of (forbids||[]))check(title,name,!re.test(out));
  return out}
const noCrash=[['no uncaught errors',/UNCAUGHT|ReferenceError|PROCESS FAILED|SyntaxError/]];

if(!fs.existsSync(path.join(here,'node_modules','jsdom'))){console.log('installing jsdom…');run('npm',['install','--silent'])}
suite('shipped app == fresh build from src/','node',['../build.js','--check'],[['build check passes',/BUILD CHECK: shipped file matches a fresh build/]],noCrash);
suite('extract shipped core','node',['release_extract_core.js'],[['core.js extracted',/core\.js extracted/]],noCrash);
suite('core math, data, lookahead','node',['release_test_core.js'],[
  ['DSR matches paper example 0.9004',/T1 DSR paper example.*\s0\.9004\s*$/m],
  ['MinBTL 5y -> 45 configs',/budgetN\(5y.*\s45\s*$/m],
  ['MinBTL 3y -> 13 configs',/budgetN\(3y.*\s13\s*$/m],
  ['zero-variance Sharpe is 0',/zero-variance series\s+0\s*$/m],
  ['3,402 bundled bars 2015-01-01 -> 2024-04-24',/T5 bundled bars\s+3402\s+2015-01-01 -> 2024-04-24/],
  ['bundled data passes integrity checks',/T5 validateBars issues\s+\[\]/],
  ['no lookahead in 1,200 truncation checks',/1200 checks, 0 violations/],
  ['judge: 12 trades is judged',/J1 12 trades is judged \(min 10\)\s+(pass|fail)\s*$/m],
  ['judge: 9 trades is few-trades',/J2 9 trades is few-trades\s+few-trades\s*$/m],
  ['judge: lone first trial undeflated',/J3 lone first trial: prereg, SR0\s+true 0\s*$/m],
  ['judge: sweep floor of 2 effective trials',/J4 sweep floors effective trials at 2\s+2\s*$/m],
  ['judge: over budget cannot pass',/J5 over budget cannot pass\s+fail\s*$/m],
  ['judge: MDS 0.815',/J6 MDS 1 pre-registered test, 9\.31y\s+0\.815\s*$/m],
  ['judge: MIN_TRADES is 10',/J7 MIN_TRADES\s+10\s*$/m]],noCrash);
run('node',['reference/dump_fixed.js']);
suite('independent Python engine (fixed exits)','python3',['reference/ref_engine.py'],[
  ['MA PBO identical',/ma: PBO .* OK/],['RSI PBO identical',/rsi: PBO .* OK/],['breakout PBO identical',/brk: PBO .* OK/],
  ['only difference is the known exact float tie',/diffs: \["ma signal \{'fast': 5, 'slow': 30, 'thr': 0\} \(1 diffs\)"\]/],
  ['that tie is exact (fast == slow)',/exact fast 283\.212 exact slow 283\.212 diff 0\.0/]],
  [...noCrash,['no PBO mismatch',/MISMATCH/]]);
run('node',['reference/dump_v5.js']);
suite('independent Python DSR pipeline (signal exits)','python3',['reference/ref_dsr_pipeline.py'],[
  ['8 quantities match',/(OK[\s\S]*){8}/]],[...noCrash,['no DIFF',/DIFF/]]);
suite('paper formulas (scipy)','python3',['reference/verify_papers.py'],[
  ['DSR 0.9004',/DSR=0\.9004 \(paper 0\.9004\)/],['DSR N=46 0.9505',/DSR\(N=46\)=0\.9505/],
  ['MinBTL(45)=5.00y',/N=45\s+MinBTL=5\.00/],['sample SD +4.45% at n=12',/n=12: 4\.45%/]],noCrash);
suite('pooling: structure','node',['reference/dump_pool.js'],[
  ['pool of one asset == that asset',/P1 pool of one asset == that asset, max diff 0 \| length 3401 3401/],
  ['pool of identical copies == the asset',/P2 pool of two identical copies == the asset, max diff 0 \| trades doubled true/],
  ['pooled length = union of dates',/P3 pooled length = union of dates: 3401/],
  ['single-member pool refused',/P4 single-member pool refused: A pool needs at least two datasets\./],
  ['mixed candle sizes refused',/P5 mixed candle sizes refused: All pooled datasets must use the same candle size\./]],noCrash);
suite('pooling: independent Python rebuild','python3',['reference/ref_pool.py'],[['8 quantities match',/(OK[\s\S]*){8}/]],[...noCrash,['no DIFF',/DIFF/]]);
suite('pooling: simulation smoke test (null + planted edge)','node',['sims/simpool.js','null','0','60','0.5','0','ma'],[
  ['null: pooled false passes <= 2 of 60',/pooled\(3 assets, staggered\) \{"pass":[0-2],/]],noCrash);
suite('pooling: UI flow','node',['release_test_pool_ui.js'],[
  ['toggle refused while pool empty',/U1 pool toggle refused while empty: true/],
  ['same dataset twice refused',/U2 same dataset twice refused: That dataset is already in the pool\./],
  ['pool lists both assets',/U3 pool info: BTC 3,402 bars.*ALT 3,400 bars.*tests run on the pool/],
  ['pooled verdict rendered',/U4 pooled verdict: (Indistinguishable from luck|Survives deflation)/],
  ['winner labelled as pooled',/U5 evaluated label: sweep winner .* · pooled BTC\+ALT/],
  ['register records the pool',/U6 register entry: .*pool\[BTC\+ALT\]/],
  ['pooled trials count against BTC single tests',/U8 single BTC run after pooled sweep: Deflated Sharpe not computable/],
  ['synthetic + dated pool refused',/U9 synthetic \+ dated pool refused: Mixing dated and undated data cannot be aligned\./],
  ['synthetic pool is practice',/U10 synthetic pool is practice: header before\/after (\d+) \/ \1 .*practi/],
  ['no stray alerts',/alerts left: none/]],noCrash);
suite('hostile backup import','node',['release_test_hostile_import.js'],[
  ['no injected elements, no handlers fired',/injected <img> elements in page: 0 \| onerror handlers fired: 0/],
  ['well-typed hostile entry still imported (as inert text)',/Added 1 register entries and 1 trades/]],noCrash);
suite('position sizing: single vs pooled','node',['release_test_sizing.js'],[
  ['single-asset position is full 2%',/^S single-1000 true$/m],
  ['single-asset line does not mention a split',/^S single-not-split true$/m],
  ['3-asset pool splits risk per asset',/^S pool-splits-333 true$/m],
  ['pool line explains the split',/^S pool-mentions-split true$/m],
  ['total risk stays 2% of account',/^S total-risk-constant true$/m]],noCrash);
suite('coin registry drives the app','node',['release_test_coins.js'],[
  ['registry non-empty',/^C registry-nonempty true$/m],
  ['ids are PAIR-USD',/^C ids-are-pairs true$/m],
  ['coinName resolves known',/^C coinName-known true$/m],
  ['coinName falls back for unknown',/^C coinName-unknown true$/m],
  ['isKnownCoin',/^C isKnownCoin true$/m],
  ['assetKey groups a coin\'s sources',/^C assetKey-groups true$/m]],noCrash);
suite('data persistence across a reload','node',['release_test_persistence.js'],[
  ['coin dropdown filled from COINS',/^P dropdown-count 3 first BTC-USD$/m],
  ['pool built in first session',/^P tab1-pool true$/m],
  ['datasets written to storage',/^P datasets-saved true$/m],
  ['fresh session shows restored message',/^P restored-msg true$/m],
  ['pool restored and active',/^P pool-restored true$/m],
  ['single dataset written to storage',/^P single-saved true$/m],
  ['single dataset restored in fresh session',/^P single-restored true$/m]],noCrash);
suite('trial accounting follows the coin, not the tag','node',['release_test_asset_accounting.js'],[
  ['bundled BTC counts its sweeps',/^A1 bundled BTC 22\.38$/m],
  ['Coinbase-refreshed BTC inherits them',/^A2 refreshed BTC 22\.38$/m],
  ['other candle sizes of BTC inherit them',/^A3 refreshed 6h BTC 22\.38$/m],
  ['a pool containing BTC inherits them (+ ETH/SOL trials)',/^A4 refreshed pool incl BTC 24\.88$/m],
  ['pooled ETH+SOL trials count against ETH',/^A5 ETH alone after ETH\+SOL pool 2\.50$/m],
  ['unrelated CSV untouched',/^A6 unrelated CSV 0\.00$/m],
  ['asset keys',/^A7 keys BTC-USD SOL-USD csv x$/m]],noCrash);
suite('next-action instructions','node',['release_test_next_action.js'],[
  ['state matches the ENGINE on every bar (0 mismatches)',/^N state-vs-engine mismatches 0$/m],
  ['MA trigger close produces a clean cross',/^N ma trigger-close clean-cross true$/m],
  ['MA trigger close is the price, not the MA level',/^N ma trigger-close differs from MA level true$/m],
  ['already-satisfied flat rule is not armed (no false entry)',/^N armed-false-when-already-satisfied true$/m],
  ['bracket states stop-first + gap risk',/^N bracket-stop-first true$/m],
  ['signal mode has no fixed target',/^N bracket-signal-mode-no-target true$/m],
  ['fixed mode shows the target',/^N bracket-fixed-has-target true$/m],
  ['expiry date shown when in a position',/^N expiry-date-when-in-position true$/m]],noCrash);
suite('action panel: rejection banner and historical paper-only model','node',['release_test_action_panel_ui.js'],[
  ['empty before any run',/PANEL empty before run: true/],
  ['failed rule shows did-not-survive banner',/FAIL banner: true/],
  ['failed rule still shows the levels',/FAIL levels: true/],
  ['passed rule shows historical model label',/PASS order: true/],
  ['passed rule links to fee-aware capital planner',/PASS sizing: true/]],noCrash);
suite('cloud storage (mock, two tabs)','node',['release_test_storage.js'],[
  ['self-test banner shown',/Cloud register verified/],['both tabs\' trials kept (16)',/fresh tab sees configs: 16/],
  ['clear empties register',/after clear, fresh tab configs: 0/]],noCrash);
suite('storage fallback','node',['release_test_storage_fallback.js'],[['falls back to browser storage',/Saved on this browser only/]],noCrash);
suite('backup import merge','node',['release_test_import.js'],[['no trials lost (225)',/Total now 225 configurations/],
  ['re-import adds nothing',/Added 0 register entries/]],noCrash);
suite('pre-registered test + validation','node',['release_test_prereg.js'],[
  ['first lone trial judged undeflated',/single run 1 : .*Pre-registered test/],
  ['second lone trial refused',/single run 2 : Deflated Sharpe not computable/],
  ['power line printed',/80% probability/],['negative stop rejected',/Exit settings must be positive numbers/]],noCrash);
suite('research controls','node',['release_test_research_controls.js'],[
  ['hypothesis lock persists',/R1 lock saved: true/],['trial links to prior lock',/R2 run linked to lock: true/],
  ['history repair spends seven configs',/R3 history repair counts: 8 \| true/],
  ['one-click daily pool loads',/R4 one-click pool: Daily market pool readyBTC .*ETH .*SOL /],
  ['no unexpected alerts',/alerts: none/]],noCrash);
const safetyChecks=['lock includes exact data snapshot','same-tag changed prices rejected','double click spends one trial',
  'lock consumed before another run','invalid lock settings rejected','manual backup works with local storage',
  'lock snapshots survive idempotent import','null import rejected safely','zero fill rejected',
  'failed download is not called exported','fractional repair count rejected','completed candles and exact count',
  'malformed candles rejected','rate limit stops after three attempts','stalled request times out',
  'daily refresh commits all three assets','partial failure retains all prior data','BTC removable without losing ETH SOL',
  'no page errors or unexpected alerts'];
suite('release safety regressions','node',['release_test_release_safety.js'],safetyChecks.map(n=>[n,new RegExp('^SAFE '+n+'$','m')]),noCrash);
suite('screener scoring','node',['release_test_screener.js'],[
  ['all-Unknown cannot clear',/all unknown\s+: 0 Incomplete - cannot clear/],['clean token scores 100',/all clean\s+: 100 Low flagged-risk/],
  ['unknown LP lock blocks clear',/clean but LP unknown : \d+ Incomplete/],['active mint is Critical',/mint active only\s+: \d+ Critical/]],noCrash);
suite('screener live lookup (documented RPC shapes)','node',['release_test_screener_live.js'],[
  ['renounced + 20% parsed',/renounced, 20% top10.*fields: renounced renounced lt30/],
  ['active mint flagged',/mint ACTIVE, 60% top10\s+\| verdict fail.*fields: active renounced gt50/],
  ['active freeze flagged',/freeze ACTIVE, 40%\s+\| verdict fail.*fields: renounced active 30to50/],
  ['1e18 supply precision',/huge supply 1e18.*35\.0% of supply/],
  ['missing account handled',/account missing\s+\| verdict fail \| Live check failedNo account found/],
  ['non-mint handled',/not a mint\s+\| verdict fail/],
  ['holder-call failure degrades gracefully',/holders call fails.*fields: renounced renounced unknown/],
  ['network note on network errors',/network blocked.*Hosted and sandboxed pages/],
  ['bad address rejected',/bad address.*Doesn't look like a Solana address/]],
  [...noCrash,['no network note on non-network errors',/account missing[^\n]*Hosted and sandboxed/]]);
suite('every HTML loads, every button clicks','node',['release_test_load_all.js','../edge-lab/strategy-lab.html','../screener/screener-v2.html','../comal-automation/landing.html','../comal-automation/demo.html'],[
  ['Edge Lab clean',/strategy-lab\.html\s+script errors: none \| broken #anchors: none/],
  ['screener clean',/screener-v2\.html\s+script errors: none \| broken #anchors: none/],
  ['landing clean',/landing\.html\s+script errors: none \| broken #anchors: none/],
  ['demo clean',/demo\.html\s+script errors: none \| broken #anchors: none/]],noCrash);
suite('UI crawl','node',['release_test_ui_crawl.js'],[
  ['only the deliberate bad-input alert',/errors: \[ 'alert:Check the inputs\.' \]/],
  ['quoted thousands parsed',/csv commaThousands: 100 bars parsed/],
  ['practice runs not counted',/header configs: 0/]],noCrash);
if(!quick){
  suite('end-to-end sweeps on bundled BTC (real trials — disclose)','node',['release_test_e2e.js'],[
    ['MA verdict = golden',new RegExp('ma sweep -> verdict: "Indistinguishable from luckDeflated Sharpe '+GOLDEN.ma.replace('.','\\.'))],
    ['RSI verdict = golden',new RegExp('rsi sweep -> verdict: "Indistinguishable from luckDeflated Sharpe '+GOLDEN.rsi.replace('.','\\.'))],
    ['breakout verdict = golden',new RegExp('brk sweep -> verdict: "Indistinguishable from luckDeflated Sharpe '+GOLDEN.brk.replace('.','\\.'))],
    ['single run after sweeps refused',/ma single -> verdict: "Deflated Sharpe not computable/],
    ['no page errors',/errors: none/]],noCrash);
}
console.log('\n'+'='.repeat(60));
if(fail){console.log(`${fail} CHECK(S) FAILED, ${pass} passed:`);failures.forEach(f=>console.log('  - '+f));process.exit(1)}
console.log(`ALL CHECKS PASSED (${pass})${safetyOnly?' — synthetic release-safety checks only':quick?' — quick mode, end-to-end BTC sweeps skipped':''}`);
