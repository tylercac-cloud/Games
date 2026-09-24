BLACKJACK BUDDY  -  taskbar widget (Windows, Electron)
=====================================================

SETUP (once)
1. Install Node.js (LTS) from https://nodejs.org - run the installer, defaults are fine.
2. Unzip this folder somewhere you'll keep it, e.g. Documents\BlackjackBuddy.
3. Double-click "Run Blackjack Buddy.bat".
   The first run downloads Electron (about 100 MB) and takes a minute. After that it starts instantly.
   The first run also puts a "Blackjack Buddy" shortcut with her face on your desktop - use that from
   now on. (Deleted it? Double-click "Create Desktop Shortcut.bat" to get it back.)
   She appears bottom-right, standing on the taskbar.

CONTROLS
- Click her ............ open / close the table (she steps behind it)
- Tray icon ............ her face lives in the taskbar's notification area: click it to hide/show her,
                         right-click it for the menu (rules, reset chips, quit)
- Count pill ........... top of the table: Hi-Lo running count and true count (decks left shows on the table).
                         Click it to hide the count and count along yourself; click again to check.
- Table / Casino / Shop  switch between blackjack, the casino (passive income) and the shop
- VIP chip ............. the gem next to the tabs: your VIP tier. Click it for the Stats screen.
                         The thin line along the top of the table is your progress to the next tier.
                         When the table is closed, a small VIP pill sits beside her.
- Speaker button ....... sound on / off (also in the right-click menu)
- Drag her or the table  move the widget (position is remembered)
- Right-click .......... menu: open/close, rules, stats & VIP, sound, top-up (only when broke), quit
- Bet / Pairs / 21+3 ... - and + step the main bet by 10 and the side bets by 5.
                         Hold a button and it speeds up (x10 after a second, x100 after three).
                         Shift-click steps x10. No caps: the only limit is your chips.
- Min / ½ / x2 / Max ... quick-bet buttons next to Deal.
- Keyboard ............ H hit, S stand, D double, P split, R surrender, I / N insurance, Space or Enter deal,
                         Esc closes the rules
                         (table open, Table tab, window focused: click her or the table first).
- Sticky bets .......... after a loss your bets shrink to what you can afford, then grow back to the
                         amount you picked once your chips allow it.
- Action bar .......... shows only what you can do right now: Deal while betting; Hit / Stand /
                         Double / Split / Surrender during a hand; Take / No thanks when insurance is offered
- "-" button ........... hide the table      "x" button ........... quit

HOUSE RULES
- Two decks. One card is burned after every shuffle.
- Cut card: placed at a random depth, 55-75% into the shoe. When it comes out, the hand
  in progress finishes, then the shoe is shuffled before the next deal ("Cut card out"
  shows on the table until then). The table shows decks left in the shoe.
- Dealer stands on all 17s. Blackjack pays 3:2. Dealer peeks for blackjack.
- Double down on any first two cards (one card, then stand).
- Late surrender on your first two cards: half the bet back. Not available after a hit or double.
- Insurance when the dealer shows an ace: costs half your bet, pays 2:1 if the dealer has blackjack.
  (With a blackjack of your own this works out to even money.)
- Split any pair of the same rank for another bet of the same size, up to 4 hands.
  Double after split is allowed. Split aces get one card each; no re-splitting or doubling aces.
  A 21 on a split hand is not a blackjack and pays 1:1. Surrender only before splitting.
  Split hands sit side by side; the gold underline marks the hand you're playing, and each hand's tag
  shows its total, then its result.
- You start with 500 chips. If you go broke with an empty casino (no attractions, no auto-tipper), the Deal
  button becomes "Top up" (500, more at higher VIP tiers). Once your casino earns, it refills you instead:
  Deal points you to the tip jar. Top-ups are at most one per 10 minutes (the button counts down).
  (This closes two loops: spending down to 0 and topping up, and betting a free top-up all-in again and again.)
- Totals: soft hands show both values, e.g. 7/17.
- Quit mid-hand and the same hand is waiting next launch: the shoe and the round are saved, so the cards
  (and the count) are exactly where you left them.

CASINO TAB (earning chips without playing)
- Tip jar: click it for chips. "Bigger tips" doubles the tip (100, then 1,000, 10,000, ...).
- Twelve floor attractions pay out every second while she is running, each 15% pricier per copy:
    Slot machine 60 (+6/min) ... Casino empire 50M (+4M/min) ... Cruise ship 400M (+30M/min),
    Private island 3.5B (+240M/min), Orbital casino 30B (+1.9B/min), Lunar resort 250B (+15B/min)
- Milestone tiers: every attraction permanently doubles its own output at each tier:
    Bronze 10 · Silver 25 · Gold 50 · Emerald 100 · Sapphire 150 · Ruby 200 · Diamond 300 (x128)
  The icon ring takes the tier's colour (Gold and up glow, Diamond pulses), the bar under each row fills
  toward the next tier in its colour, and crossing a tier flashes the row.
- Boosts (one-time, whole-floor multipliers): Train staff x2 (5K), Ads x2 (250K), Whales x3 (5M),
  The Strip x5 (200M), Star host x3 (10B), Global brand x5 (500B). Only the next one is shown.
- Away earnings: the floor keeps earning while she is closed or the PC sleeps, for up to 4 hours (8 or 24 with shop perks).

FRANCHISE (long-term progression)
- Button at the bottom of the Casino tab. Unlocks once this run's floor has earned 1M.
- Sells the casino and opens a new location: back to 500 chips with no attractions, boosts or tip
  upgrades. You keep everything bought in the Shop, and you gain stars.
- Stars earned = (log10 of this run's earnings - 5) ^ 1.6, rounded down:
    1M = 1 · 1B = 9 · 1T = 22 · 1Qa = 39 · 1Qi = 60
  (Changed from the old square-root formula, which let stars snowball into the trillions within weeks.)
- Every star you keep banked adds +25% to all income and tips. The star pill next to the tabs shows
  your banked stars; hover
  them for your rank: Dealer, Pit boss (1), Floor manager (10), Casino owner (40), Tycoon (120),
  Mogul (300), Legend (600), Myth (1,000).
- STAR SHOP (Shop -> Stars): spend stars on permanent upgrades that survive every franchise.
  Spent stars stop adding income, so it's a trade - income now for a faster engine every run after.
    Head start (6 levels) ....... franchise starts with 5K, 50K ... up to 500M chips      3-300 stars
    Loyal staff (6) ............. keep your first 1-6 boosts after a franchise             5-600
    Bargain builders (5) ........ attraction price growth 15% -> 10% per copy             10-500
    Milestone mastery (4) ....... each milestone tier x2 -> x3 (Diamond x128 -> x2,187)    8-200
    Star power (4) .............. each banked star +25% -> +45%                           20-400
    Finder's fee (5) ............ +10% to +50% stars from every franchise                  4-220
    Big tippers (5) ............. tip jar x3 per level (x243 max)                          2-75
    Night owl (4) ............... +4h to +16h away earnings                                2-40
  Maxing everything costs about 3,800 stars; simulated players reach 1,500-1,800 lifetime
  stars by month 3, so the last levels are a long-term goal.
- The Franchise button fills up toward your next star and gets a moving gold border once it's ready.
- Click once to arm it, click again within 4 seconds to confirm. It can't be used mid-hand.

SHOP (spend your chips)
- Perks (change how the game plays):
    Auto-tipper 25K ........ the tip jar tips itself once a second
    Night manager 150K ..... away earnings up to 8 hours
    Second dealer 2M ....... auto-tipper twice as fast (needs Auto-tipper)
    Overnight crew 5M ...... away earnings up to 24 hours (needs Night manager)
- Dealer: ribbon colours, outfits (vest, shirt and bow tie) and accessories: flower clip, star clips,
  big bow, glasses, beret, shades, cat ears, headphones, Santa hat, tiara.
  Hover an item to try it on her before buying.
- Cards: card backs, including an animated holographic one.
- Table: felt colours for the card area.
- Buying an item equips it; click anything you own to switch back. Shop items survive a franchise.
- Items marked with a gem are VIP exclusives: they can't be bought, they unlock at that VIP tier.
  Dealer items can still be hovered to try on.

VIP (lifetime, never resets - not even by a franchise)
- Your tier follows total chips wagered: main bet, doubles, splits, side bets and insurance.
- 13 tiers (Sp = 10^24):
    Tier        Wagered   Badge                 Typical   Heavy    Light
    Wood        0         wooden token          start
    Bronze      10K       medal, 1 pip          ~15 min   ~15 min  ~10 min at the table
    Silver      1B        medal, 2 pips         day 1     day 1    day 2
    Gold        100Qa     medal, 3 pips         day 2     day 2    day 2
    Platinum    200Qi     medal, 4 pips         day 5     day 4    day 8
    Pearl       1Sx       pearl                 day 8     day 6    day 9
    Jade        10Sx      jade cabochon         day 10    day 9    day 12
    Sapphire    50Sx      cushion sapphire      day 13    day 10   day 19
    Ruby        200Sx     heart ruby            day 20    day 12   day 31
    Emerald     1Sp       emerald cut           day 33    day 21   day 54
    Diamond     3Sp       brilliant diamond     day 52    day 30   day 83
    Obsidian    10Sp      obsidian shard        day 81    day 47   day 129
    Celestial   30Sp      celestial star        day 122   day 71   day 164
  The casino grows your bankroll exponentially, so the ladder is geometric. Days come from an economy
  simulation (buys the best casino upgrade every 2 hours, franchises every ~5 days). Typical = 45 min
  of hands a day betting ~1.5 minutes of casino income; heavy = 90 min at 3 minutes; light = 20 min
  at 1 minute. A real player shops less often than the sim, so the early tiers stretch out.
- A tier, once reached, is kept for life, even if the ladder is retuned.
- Saves from before 2.1 keep the tier they had earned under the old comp-point ladder.
- Every tier: +5% casino income and tips (x1.6 at Celestial), cashback on losing rounds
  (0.1% at Bronze up to 1.25% at Celestial), a bigger broke top-up (500 x (tier+1)^2), and a one-time
  chip bonus when you reach it.
- Exclusive unlocks: Walnut felt (Bronze), Silver card back (Silver), Gold lame outfit (Gold),
  Platinum ribbon (Platinum), Pearl outfit (Pearl), Jade felt (Jade), Sapphire outfit (Sapphire),
  Ruby card back (Ruby), Emerald ribbon (Emerald), Crown (Diamond), Obsidian outfit + card back
  (Obsidian), Halo + Celestial outfit + Starfield felt (Celestial).
- Her vest pin shows your tier colour.

STATS (click the VIP chip). "Units" = results in starting bets, so a 10-chip hand and a 1B hand count
the same.
- Overview: VIP tier card and ladder (hover a gem for its perks and unlocks), session net, hourly,
  rounds, wagered this session, time to the next tier at this session's pace, total wagered,
  lifetime net, win rate, VIP perks.
- History: running units over the last 200 rounds and the last 50 hands (hover a row for bets,
  count, side bets, insurance and cashback). Export CSV saves the last 250 hands as a spreadsheet.
- Casino: lifetime earnings, income, highest balance, tips, attractions, franchises, stars, rank,
  time with her, time at the table, days played, sessions.

SOUND
- Every action has a sound: dealing, hits, stands, busts, doubles, splits, surrender, insurance,
  the peek and hole-card flip, the cut card and shuffle, wins/losses/pushes/blackjacks, bet steppers,
  tabs, opening and closing the table, her speech bubbles, tips, purchases, equipping cosmetics,
  locked items, milestones, franchise arm and confirm, star upgrades, top-ups, away earnings and
  VIP tier-ups. The auto-tipper and her idle chatter are silent on purpose (she chats every 30-55 s while
  the table is open, every 2-4 min while it is closed).
  All sounds are generated by the app itself (no audio files). Mute with the speaker button.

CARD COUNTING (Hi-Lo)
- 2-6 count +1, 7-9 count 0, 10-A count -1.
- The running count includes every card you have seen this shoe: not the burn card, and the
  dealer's hole card only once it is turned over.
- True count = running count / decks left in the shoe (cards left / 52).
- Both reset at the shuffle (i.e. when the cut card comes out and the next hand starts).

SIDE BETS (settled right after the deal)
- Perfect Pairs, on your first two cards:
    Mixed pair (same rank, different colour) ...... 8 to 1
    Coloured pair (same colour, different suit) ... 14 to 1
    Perfect pair (identical cards) ................ 35 to 1
    House edge 0.97% (was 22.3% with the 6-deck 25/12/6 table).
- 21+3, on your two cards plus the dealer's up card as a 3-card poker hand:
    Flush ......................................... 5 to 1
    Straight (ace high or low, no wrap-around) .... 10 to 1
    Three of a kind ............................... 45 to 1
    Straight flush ................................ 60 to 1
  Suited three of a kind is impossible with two decks, so that tier is omitted.
  House edge 0.95% (was 11.2% with trips at 30 and straight flush at 40).

WHERE YOUR DATA LIVES
Chips, bets, stats, VIP progress and the window position are stored in %APPDATA%\blackjack-buddy
(save.json). The save is written the moment a card is dealt, so closing or force-quitting the game can't
undo a hand you have already seen - it is waiting for you next launch.
Your existing save carries over; lifetime stats and VIP start counting from this version.

START WITH WINDOWS (optional)
Win+R, type  shell:startup , Enter. Copy the "Blackjack Buddy" desktop shortcut into that folder.

STANDALONE .EXE (optional)
Open a command prompt in this folder and run:  npm run package
You get dist\BlackjackBuddy-win32-x64\BlackjackBuddy.exe (with her icon) - that folder runs on any Windows
PC without Node. It shares the same save as the .bat version.

TROUBLESHOOTING
- Black box instead of a transparent widget: open main.js in Notepad and remove the two slashes
  in front of  app.disableHardwareAcceleration();  then run again.
- Nothing happens: run the .bat once more; if it printed an error, that's the message to send back.
