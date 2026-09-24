# Blackjack Buddy — handoff notes for the next developer / LLM

Read this before touching the code. `README.txt` is the player-facing manual; this file is the
engineering context: what exists, why it is the way it is, what was verified, and what the owner
has already accepted or rejected.

## What it is

A Windows desktop widget (Electron 44): a pixel-art redhead dealer stands on the taskbar; click her
to open a 544×220 blackjack table. Around the blackjack game is an idle/incremental casino economy
(attractions, boosts, tip jar, franchise/prestige with stars, a star shop), a cosmetics shop, and a
lifetime VIP ladder. Version **2.1.0**.

Owner profile: finance-minded, wants real numbers, stated assumptions, and dislikes over-building.
Keep replies terse. Ask before adding features; the owner has already trimmed stats once (see below).

## Files

| File | Role |
|---|---|
| `main.js` | Electron main: frameless transparent always-on-top window, click-through, tray, context menu, drag, window position, CSV download dialog. |
| `preload.js` | `window.buddy` bridge (ignoreMouse, drag, contextMenu, quit, onMenu). |
| `index.html` | Markup + rules panel text (keep in sync with README). |
| `app.js` | Everything else: rules, state, save/load, economy, VIP, shop, sprite, rendering, input. ~1,770 lines, one classic script (not a module). Top-level function declarations are globals — tests stub them via `window.fn = ...`. |
| `style.css` | All styles. Window is 560×412; colour tokens in `:root`. |
| `sprites/`, `fonts/`, `icon.png` | Assets. Sprite recolouring swaps exact palette RGBs (`RIBBON_SRC`, `VEST_SRC`, ...). |
| `README.txt` | Player manual. **CRLF line endings — preserve them.** |
| `Run Blackjack Buddy.bat` | First-run `npm install`, then launches Electron. |

`app.js` section banners (`// ------ name`): casino, star shop, VIP ladder, shop catalogue, sound,
rules, state, saving an unfinished round, shoe, bets, game flow, stats + VIP, casino flow,
progression visuals, VIP + stats visuals, franchise, shop, sprite, mascot, rendering, input, go.

Style: dense one-line helpers, short trailing `//` comments, `\u` escapes for non-ASCII in strings,
no framework, DOM built with strings. Match it.

## Game rules (as implemented)

2 decks, 1 burn card, cut card at 55–75%. Dealer stands on all 17s, peeks for blackjack, BJ pays 3:2.
Double any two cards, double after split, split same rank up to 4 hands, split aces one card each,
no resplit aces, late surrender (first two cards, before splitting), insurance 2:1.
Side bets (settled after the deal), tuned to ~1% house edge for two decks:
- Perfect Pairs 35/14/8 → −0.97% (exact). Was 25/12/6 = −22.3%.
- 21+3 flush 5, straight 10, trips 45, straight flush 60 → −0.95% (exact). Was −11.2%.
Hi-Lo running/true count shown in a pill (true count = RC / (shoe cards / 52)).

## Key systems

- **State** lives in `G`. Lifetime stats in `G.st` (`NEW_STATS()`); load copies only keys present in
  `NEW_STATS` with matching `typeof`, so removed fields vanish from saves automatically.
- **Save** = `localStorage['blackjack-buddy']` (Electron userData). Saved every 5 s, after every round,
  on `beforeunload`. Includes the shoe and any **round in progress** (`round`), which `resumeRound()`
  continues on launch with the same cards (no refund — a refund would let players abort bad hands).
- **Bets**: `G.betWant/ppWant/tpWant` = what the player chose; `fitBets()` trims `G.bet/pp/tp` to chips
  and restores them later ("sticky bets"). `render()` calls `fitBets()` while betting.
- **Top-up** (`canTopup`): only when chips < 10 AND casino income is 0 AND no auto-tipper. Otherwise the
  Deal button sends you to the tip jar. Closes a spend-down/top-up free-chips loop.
- **VIP**: tier from `G.st.wagered` (every chip staked: main, doubles, splits, sides, insurance).
  Ladder `VIP[]` (geometric: 10K, 1B, 100Qa, 200Qi, 1Sx, 10Sx, 50Sx, 200Sx, 1Sp, 3Sp, 10Sp, 30Sp).
  `st.vipFloor` makes tiers permanent (set every round; migrations from the old comp ladder and the
  first 2.1 ladder via `st.vipV`). Tier-up pays chips and unlocks VIP cosmetics.
  Badges (`gemSVG`/`GEM_SHAPES`): wood token, 4 metal medals with 1–4 pips, pearl, jade, sapphire,
  heart ruby, emerald cut, diamond, obsidian shard, celestial star.
- **Economy tick** (`setInterval` 250 ms): passive income; gaps > 10 min (PC sleep) are treated as
  away time with the offline cap; auto-tips credited in batches; periodic re-renders skipped while
  the mouse is pressed (rebuilding a button mid-press swallows the click — verified in Chromium).
- **Stats tab** (after the owner's trim): Overview (VIP card + ladder + 9 tiles), History (running
  units chart of last 200 rounds, last 50 of 250 stored hands, Export CSV), Casino.
- **Keyboard**: H/S/D/P/R, I/Y/N insurance, Space/Enter deal (table open, Table tab, window focused).
  Clicked buttons are blurred so Space never re-presses them.

## Verified numbers (headless Chromium, real game code, fake timers)

- Main game, perfect basic strategy: **−0.25% ±0.04%** per starting bet (7.3M rounds pooled).
  Chip accounting drift: **0** over >4M rounds.
- Side bets in-game: PP −0.80%, 21+3 −0.87% over 2M rounds (hit rates match exact theory).
- At Celestial the 1.25% loss cashback makes the main game ≈ **+0.1% for the player** (pre-existing
  design; owner informed, not changed).
- VIP pacing from an economy sim (greedy casino buyer every 2 h, franchise ~5 days): typical player
  (45 min/day, bets ≈1.5 min of income) Bronze ~15 min, Silver day 1, Gold day 2, Platinum day 5,
  Emerald day 33, Celestial ~day 122; heavy ~day 71; light ~day 164. Sim runs faster than a real
  player early on. Bet size relative to income moves pacing more than hours played.

## Decisions already made by the owner

- Accepted: all bug fixes; side bets ~1%; top-up rule; resume-hand; VIP from total wagered; quick
  bets + sticky bets; soft totals (7/17); hand history + CSV; keyboard shortcuts; respaced ladder.
- **Rejected / removed (do not re-add without asking):** Session/Play/Edge stats pages, basic-strategy
  and Illustrious-18 decision grading, EV engine and mistake cost, luck σ / theo / drawdown, dealer
  up-card / true-count / starting-hand breakdowns, side-bet breakdowns, 30-day log. All of it is in
  commit `5099f26` if ever wanted back.
- Not requested: an in-game strategy coach.

## Git history (branch `claude/happy-lovelace-mv77s0`, repo tylercac-cloud/games)

```
92c7899 Respace the VIP ladder and give each tier family its own badge
174af38 Trim Stats to Overview, History and Casino
5099f26 Count-play chart, mistake cost, keyboard shortcuts, 30-day log   (stats later removed)
1028e0b Track decisions against basic strategy; export hand history as CSV
f31e2b3 Blackjack Buddy 2.1: fair side bets, VIP by wagered, stats overhaul
44e0706 Fix action races, sleep income exploit, lost clicks and stuck Deal
3a4a3fd Add Blackjack Buddy 2.0.0 as uploaded
```

## Real Electron smoke test (Linux, no display)

`npm install` then:
`BB_TEST=1 BB_PHASE=1 xvfb-run -a node_modules/electron/dist/electron . --no-sandbox` and again with `BB_PHASE=2`.
`test-hook.js` (loaded by `main.js` when `BB_TEST` is set; excluded from `npm run package`) plays 5
rounds by keyboard, quits mid-hand via the app's quit path, exports CSV, then on phase 2 checks the
hand resumes identically and finishes it. Screenshots/CSV go to `shots/` (or `BB_OUT`). Last run: all
checks passed, zero renderer errors.

## How to test without Windows

Serve the folder (`python3 -m http.server 8701`) and drive it with Playwright/Chromium; `file://`
taints the sprite canvas, so use HTTP. `window.__bb` exposes internals (G, startHand, hit, stand,
split, insurance, fitBets, setTab, renderStats, franchise, VIP, vipIdx, ...). For fast simulations
replace `setTimeout` with a manual queue and stub `render`, `say`, `sfx`, `drawGirl`, **and `save`**
(hundreds of thousands of localStorage writes exhaust headless Chromium's memory). A random-action
fuzzer (9 seeds, ~46,000 random actions incl. mid-hand relaunches) checks: chips integer and never negative,
wagered never decreasing, bets fit chips, no card more than twice, tier never below its floor.
The Windows build itself (tray, click-through) still needs a manual check.

## Known limitations / ideas not built

- Possible next steps the owner may ask for: in-game coach, hand replay, two-deck count indices.
