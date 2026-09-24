'use strict';
/* Blackjack Buddy — renderer. Game rules and the dealer's behaviour live here. */

const $ = id => document.getElementById(id);
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];          // ♠ ♥ ♦ ♣
const RED = new Set(['\u2665', '\u2666']);
const RANK_ORDER = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));   // A=1 … K=13
const DECKS = 2, CUT_RANGE = [0.55, 0.75];
const START_CHIPS = 500, MIN_BET = 10, STEP = 10, SIDE_STEP = 5;

const LINES = {
  hello: ['Hi! Click me to play \u2665', 'Table\'s open whenever you are~'],
  idle: ['Wanna play a hand? \u2660', 'I shuffled just for you.', 'Feeling lucky today?',
    'Psst. I deal fair. Mostly.', 'Bored... deal me in?'],
  deal: ['Good luck!', 'Here we go~', 'Cards up!'],
  blackjack: ['Blackjack!! \u2605', 'A natural 21! Look at you~'],
  win: ['You got me! \u2665', 'Nice hand!', 'Ooh, well played~'],
  dealer_bust: ['Whoops, I busted~', 'Take it, take it!'],
  push: ['Push. We\'re even.', 'A tie! Again?'],
  lose: ['House wins~ hehe', 'Sorry! Dealer\'s luck.', 'Better luck next hand \u2660'],
  dealer_bj: ['Dealer blackjack! Sorry~'],
  dealer_bj_insured: ['Blackjack... but you were covered \u2665'],
  bust: ['Oops... bust.', 'Aww. Next one\'s yours.'],
  surrender: ['Folding, hm? Half back~', 'Playing it safe \u2660'],
  insurance: ['Ace up. Insurance?', 'I\'m showing an ace~ cover it?'],
  topup: ['Out of chips? This one\'s on me \u2665'],
  cut: ['Cut card! Shuffle after this hand.'],
  shuffle: ['Fresh shuffle~', 'New shoe, new luck.'],
  nochips: ['Not enough chips for that!'],
  buy: ['Ooh, a new toy for the floor~', 'Business is booming \u2665', 'Cha-ching!', 'The regulars will love it.'],
  tip: ['Thanks \u2665', 'For me? \u2665', 'Hehe, tips~', 'You\'re sweet.'],
  tipup: ['Bigger tips! You spoil me~'],
  split: ['Splitting! Two hands~', 'Double the fun \u2660', 'Ooh, a split!'],
  multiwin: ['Clean sweep! \u2665', 'Both hands?! Wow~'],
  streak: ['That\'s {n} in a row! \u2605', '{n} straight wins... are you counting? hehe'],
  bigbet: ['Whoa, big bet! \u2665', 'High roller at my table~'],
};

// ---------------------------------------------------------------- casino (passive income)
const ICO = (body) => '<svg viewBox="0 0 16 16" fill="currentColor">' + body + '</svg>';
const GENS = [
  { id: 'slot', name: 'Slot machine', cost: 60, rate: 6,
    icon: ICO('<rect x="1.5" y="3" width="10" height="10" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="3.5" y="6" width="1.8" height="4" rx=".5"/><rect x="6" y="6" width="1.8" height="4" rx=".5"/><rect x="8.5" y="6" width="1.8" height="4" rx=".5"/><path d="M13.5 5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13.5" cy="4" r="1.4"/>') },
  { id: 'poker', name: 'Poker table', cost: 400, rate: 40,
    icon: ICO('<rect x="2" y="4" width="7" height="10" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.3" transform="rotate(-12 5.5 9)"/><rect x="7" y="2" width="7" height="10" rx="1.3" fill="#181a20" stroke="currentColor" stroke-width="1.3" transform="rotate(12 10.5 7)"/><circle cx="10.5" cy="7" r="1.3"/>') },
  { id: 'roulette', name: 'Roulette wheel', cost: 2500, rate: 250,
    icon: ICO('<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.8v12.4M1.8 8h12.4M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" stroke="currentColor" stroke-width="1"/><circle cx="8" cy="8" r="1.8"/>') },
  { id: 'vip', name: 'High-roller room', cost: 15000, rate: 1500,
    icon: ICO('<path d="M2 12.5V5l3.6 2.8L8 3l2.4 4.8L14 5v7.5Z"/><rect x="2" y="13.2" width="12" height="1.4" rx=".5"/>') },
  { id: 'floor', name: 'Casino floor', cost: 100000, rate: 10000,
    icon: ICO('<path d="M1.5 6 8 1.8 14.5 6Z"/><rect x="3" y="7" width="2" height="5.5"/><rect x="7" y="7" width="2" height="5.5"/><rect x="11" y="7" width="2" height="5.5"/><rect x="1.5" y="13" width="13" height="1.5" rx=".5"/>') },
  { id: 'club', name: 'Nightclub', cost: 750000, rate: 70000,
    icon: ICO('<path d="M5.5 3 12 4v2L7 5v6.2A2.4 2.4 0 1 1 5.5 9V3Z"/><circle cx="12" cy="4.4" r="1.2"/>') },
  { id: 'resort', name: 'Casino resort', cost: 6000000, rate: 520000,
    icon: ICO('<path d="M1.5 14V7l3-2 3 2v7Z"/><path d="M8 14V4l3.2-2.2L14.5 4v10Z"/><rect x="3" y="8.5" width="1.3" height="1.3"/><rect x="3" y="11" width="1.3" height="1.3"/><rect x="9.5" y="5.5" width="1.3" height="1.3"/><rect x="11.7" y="5.5" width="1.3" height="1.3"/><rect x="9.5" y="8.5" width="1.3" height="1.3"/><rect x="11.7" y="8.5" width="1.3" height="1.3"/>') },
  { id: 'empire', name: 'Casino empire', cost: 50000000, rate: 4000000,
    icon: ICO('<path d="M8 1 9.6 4.2 13 4.6l-2.5 2.4.6 3.4L8 8.8 4.9 10.4l.6-3.4L3 4.6l3.4-.4Z"/><rect x="2" y="12" width="12" height="2.4" rx=".6"/>') },
  { id: 'cruise', name: 'Cruise ship', cost: 4e8, rate: 3e7,
    icon: ICO('<path d="M1.5 10h13l-2 4h-9Z"/><rect x="4" y="6.5" width="8" height="3" rx=".6"/><rect x="6" y="3.5" width="3" height="3" rx=".5"/><path d="M1 15.2c1.2 0 1.2-.7 2.4-.7s1.2.7 2.4.7 1.2-.7 2.4-.7 1.2.7 2.4.7 1.2-.7 2.4-.7 1.2.7 2.4.7" fill="none" stroke="currentColor" stroke-width=".9"/>') },
  { id: 'island', name: 'Private island', cost: 3.5e9, rate: 2.4e8,
    icon: ICO('<ellipse cx="8" cy="13.2" rx="6.5" ry="1.8"/><path d="M8.2 12.5c.2-3 .1-5.6-.6-8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.6 4.5C6 2.5 3.4 2.7 2 4c2 .1 3.6.6 5.6.5ZM7.6 4.5c1-2.4 3.6-3 5.4-2.2-1.8.6-3.4 1.4-5.4 2.2ZM7.6 4.5c2.5-.6 4.6.8 5.2 2.6-1.8-.8-3.4-1.5-5.2-2.6Z"/>') },
  { id: 'orbit', name: 'Orbital casino', cost: 3e10, rate: 1.9e9,
    icon: ICO('<circle cx="8" cy="8" r="3.6"/><ellipse cx="8" cy="8" rx="7" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.1" transform="rotate(-18 8 8)"/><circle cx="13.5" cy="3" r=".9"/><circle cx="2.5" cy="13" r=".7"/>') },
  { id: 'moon', name: 'Lunar resort', cost: 2.5e11, rate: 1.5e10,
    icon: ICO('<path d="M10.8 1.8A6.4 6.4 0 1 0 14.2 11 5.2 5.2 0 0 1 10.8 1.8Z"/><circle cx="6" cy="9" r="1" fill="#181a20"/><circle cx="8.6" cy="12" r=".7" fill="#181a20"/>') },
];
// each attraction permanently doubles its own output at every milestone
const MILESTONES = [10, 25, 50, 100, 150, 200, 300];
const milestoneMult = n => Math.pow(2 + 0.25 * su('mastery'), MILESTONES.filter(m => n >= m).length);
// global upgrades the whole floor benefits from
const BOOSTS = [
  { id: 'staff', name: 'Train staff', desc: 'all income x2', cost: 5000, mult: 2 },
  { id: 'marketing', name: 'Ads', desc: 'all income x2', cost: 250000, mult: 2 },
  { id: 'highroller', name: 'Whales', desc: 'all income x3', cost: 5000000, mult: 3 },
  { id: 'monopoly', name: 'The Strip', desc: 'all income x5', cost: 200000000, mult: 5 },
  { id: 'celebrity', name: 'Star host', desc: 'all income x3', cost: 1e10, mult: 3 },
  { id: 'global', name: 'Global brand', desc: 'all income x5', cost: 5e11, mult: 5 },
];
const boostMult = () => BOOSTS.reduce((a, b) => a * (G.boosts[b.id] ? b.mult : 1), 1);

const COST_GROWTH = 1.15;
const costGrowth = () => COST_GROWTH - 0.01 * su('builders');
const STAR_BONUS = 0.25;                                          // +25% income and tips per franchise star
// ---------------------------------------------------------------- star shop (permanent, survives franchises)
// Stars you keep banked add income; stars you spend stop adding income but buy a permanent upgrade.
const STAR_UPS = [
  { id: 'headstart', name: 'Head start', costs: [3, 8, 20, 50, 120, 300], fx: l => l ? 'Franchise starts with ' + fmtBig(START_CHIPS * Math.pow(10, l)) + ' chips' : 'Franchise starts with 500 chips' },
  { id: 'keepboosts', name: 'Loyal staff', costs: [5, 15, 40, 100, 250, 600], fx: l => l ? 'Keep your first ' + l + ' boost' + (l > 1 ? 's' : '') + ' after a franchise' : 'Boosts reset on franchise' },
  { id: 'builders', name: 'Bargain builders', costs: [10, 30, 80, 200, 500], fx: l => 'Attraction prices rise ' + (15 - l) + '% per copy' },
  { id: 'mastery', name: 'Milestone mastery', costs: [8, 25, 70, 200], fx: l => 'Each milestone tier \u00d7' + trimZeros((2 + 0.25 * l).toFixed(2)) + ' (Diamond \u00d7' + fmtBig(Math.round(Math.pow(2 + 0.25 * l, 7))) + ')' },
  { id: 'starpower', name: 'Star power', costs: [20, 60, 150, 400], fx: l => 'Each banked star +' + (25 + 5 * l) + '% income and tips' },
  { id: 'finder', name: "Finder's fee", costs: [4, 12, 35, 90, 220], fx: l => '+' + 10 * l + '% stars from every franchise' },
  { id: 'tips', name: 'Big tippers', costs: [2, 5, 12, 30, 75], fx: l => 'Tip jar \u00d7' + fmtBig(Math.pow(3, l)) },
  { id: 'nightowl', name: 'Night owl', costs: [2, 6, 15, 40], fx: l => '+' + 4 * l + 'h away earnings' },
];
const su = id => (G.su && G.su[id]) || 0;
const banked = () => Math.max(0, G.stars - G.starsSpent);
const starBonus = () => STAR_BONUS + 0.05 * su('starpower');
const starMult = () => 1 + starBonus() * banked();
// stars from a run: (log10(earned) - 5)^1.6  ->  1M = 1, 1B = 9, 1T = 22, 1e18 = 60. Logarithmic, so franchising can't run away.
const starsExact = r => r >= 1e6 ? Math.pow(Math.log10(r) - 5, 1.6) : 0;
const finderMult = () => 1 + 0.1 * su('finder');
const starsAvailable = () => Math.floor(starsExact(G.runEarned) * finderMult() + 1e-9);
const runForStars = n => Math.pow(10, 5 + Math.pow(n / finderMult(), 1 / 1.6));
const offlineCapMs = () => ((G.owned.crew ? 24 : G.owned.night ? 8 : 4) + 4 * su('nightowl')) * 3600 * 1000;
const genCost = g => Math.round(g.cost * Math.pow(costGrowth(), G.gens[g.id] || 0));
const genRate = g => g.rate * (G.gens[g.id] || 0) * milestoneMult(G.gens[g.id] || 0);
const incomePerMin = () => GENS.reduce((a, g) => a + genRate(g), 0) * boostMult() * starMult() * vipMult();
const tipValue = () => Math.floor(Math.pow(2, G.tipLevel) * Math.pow(3, su('tips')) * starMult() * vipMult());
const tipCost = () => 100 * Math.pow(10, G.tipLevel);
// ---------------------------------------------------------------- VIP ladder (lifetime chips wagered)
// Tiers follow total chips wagered: main bets, doubles, splits, side bets and insurance. The casino economy grows
// exponentially, so the ladder is spaced geometrically. Calibrated with an economy sim (see README).
const VIP = [
  { name: 'Wood',      at: 0,    c: ['#d9a46b', '#b07a45', '#6b4424'] },
  { name: 'Bronze',    at: 1e4,  c: ['#f2b98a', '#d8925a', '#8a5230'] },
  { name: 'Silver',    at: 1e9,  c: ['#f6f7f9', '#c3c8cf', '#6c727c'] },
  { name: 'Gold',      at: 1e17, c: ['#fff0b0', '#f5c451', '#b07d12'] },
  { name: 'Platinum',  at: 2e20, c: ['#ffffff', '#cdd9fb', '#5d6cb0'] },
  { name: 'Pearl',     at: 1e21, c: ['#ffffff', '#f2dfec', '#b98fab'] },
  { name: 'Jade',      at: 1e22, c: ['#b6f0d2', '#5fbf8f', '#2a7a55'] },
  { name: 'Sapphire',  at: 5e22, c: ['#b3cfff', '#4f8dff', '#1f4fb0'] },
  { name: 'Ruby',      at: 2e23, c: ['#ffb0bf', '#ff4f6d', '#a8183a'] },
  { name: 'Emerald',   at: 1e24, c: ['#9ff7cf', '#1fd18a', '#0a7a4c'] },
  { name: 'Diamond',   at: 3e24, c: ['#ffffff', '#b9f3ff', '#4fb2d4'] },
  { name: 'Obsidian',  at: 1e25, c: ['#cfc2ff', '#7b5cff', '#241757'] },
  { name: 'Celestial', at: 3e25, c: ['#fff6d0', '#ffc86a', '#ff6fb5'] },
];
const OLD_COMP_AT = [0, 1000, 5000, 15000, 40000, 100000, 200000, 400000, 700000, 1100000, 1700000, 2600000, 4000000];   // pre-2.1 comp ladder
const V21_AT = [0, 1e4, 1e7, 1e10, 1e15, 1e18, 1e21, 1e22, 1e23, 1e24, 3e24, 1e25, 3e25];                                 // first wagered ladder (2.1)
const vipIdx = () => { let i = 0; while (i + 1 < VIP.length && G.st.wagered >= VIP[i + 1].at) i++; return Math.max(i, G.st.vipFloor); };
const vipMult = () => 1 + 0.05 * vipIdx();                         // +5% income and tips per tier above Wood
const VIP_CASHBACK = [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1, 1.1, 1.25];   // % of a losing round refunded
const cashbackPct = i => VIP_CASHBACK[i === undefined ? vipIdx() : i];
const topupAmount = () => START_CHIPS * Math.pow(vipIdx() + 1, 2);
const vipProgress = () => { const i = vipIdx(); if (i === VIP.length - 1) return 1; return Math.max(0, Math.min(1, (G.st.wagered - VIP[i].at) / (VIP[i + 1].at - VIP[i].at))); };

// ---------------------------------------------------------------- shop catalogue
const SHOP = {
  perks: [
    { id: 'autotip', name: 'Auto-tipper', desc: 'The tip jar tips itself once a second', cost: 25000 },
    { id: 'night', name: 'Night manager', desc: 'Away earnings for up to 8 hours', cost: 150000 },
    { id: 'autotip2', name: 'Second dealer', desc: 'Auto-tipper works twice as fast', cost: 2000000, needs: 'autotip' },
    { id: 'crew', name: 'Overnight crew', desc: 'Away earnings for up to 24 hours', cost: 5000000, needs: 'night' },
  ],
  dealer: [
    { slot: 'ribbon', group: 'Ribbon', items: [
      { id: 'mint', name: 'Mint', cost: 0, sw: ['#50b084', '#ffd666'] },
      { id: 'cherry', name: 'Cherry', cost: 2000, sw: ['#e2404c', '#ffd666'] },
      { id: 'sakura', name: 'Sakura', cost: 5000, sw: ['#ff96be', '#ffffff'] },
      { id: 'gold', name: 'Gold', cost: 25000, sw: ['#f5c451', '#fff5c8'] },
      { id: 'midnight', name: 'Midnight', cost: 100000, sw: ['#343860', '#a0aaff'] },
      { id: 'platinum', name: 'Platinum', vip: 4, sw: ['#d4e3ee', '#ffffff'] },
      { id: 'emerald', name: 'Emerald', vip: 9, sw: ['#1fd18a', '#9ff7cf'] },
      { id: 'flame', name: 'Flame', ms: 'streak', sw: ['#ff7828', '#ffde60'] },
      { id: 'silk', name: 'Silk', ms: 'insured', sw: ['#ece6f8', '#ffd678'] },
      { id: 'neon', name: 'Neon', ms: 'counter', sw: ['#28f0c8', '#ff5adc'] } ] },
    { slot: 'outfit', group: 'Outfit', items: [
      { id: 'navy', name: 'Navy', cost: 0, sw: ['#2e3046', '#f8f5ef'] },
      { id: 'burgundy', name: 'Burgundy', cost: 10000, sw: ['#6e2230', '#f8f5ef'] },
      { id: 'forest', name: 'Forest', cost: 10000, sw: ['#24543e', '#f8f5ef'] },
      { id: 'plum', name: 'Plum', cost: 40000, sw: ['#563470', '#f8f5ef'] },
      { id: 'ivory', name: 'Ivory', cost: 250000, sw: ['#ece4d4', '#8c806e'] },
      { id: 'tuxedo', name: 'Tuxedo', cost: 20000, sw: ['#18191f', '#ffffff'] },
      { id: 'denim', name: 'Denim', cost: 35000, sw: ['#3b5f94', '#dbe8f7'] },
      { id: 'rose', name: 'Rose', cost: 60000, sw: ['#e87fa4', '#fff4ec'] },
      { id: 'lavender', name: 'Lavender', cost: 90000, sw: ['#9a86d8', '#f3efff'] },
      { id: 'holiday', name: 'Holiday', cost: 400000, sw: ['#c42a36', '#2e8a4e'] },
      { id: 'royal', name: 'Royal', cost: 3000000, sw: ['#3a1f6e', '#f5c451'] },
      { id: 'goldvest', name: 'Gold lam\u00e9', vip: 3, sw: ['#e0a92a', '#fff0b0'] },
      { id: 'pearl', name: 'Pearl', vip: 5, sw: ['#f7eef4', '#d98fb4'] },
      { id: 'sapphire', name: 'Sapphire', vip: 7, sw: ['#2a5cc8', '#b3cfff'] },
      { id: 'obsidian', name: 'Obsidian', vip: 11, sw: ['#15121f', '#9b7cff'] },
      { id: 'celestial', name: 'Celestial', vip: 12, sw: ['#fff6d0', '#ff8fc8'] },
      { id: 'charcoal', name: 'Charcoal', ms: 'comeback', sw: ['#404248', '#f5c451'] },
      { id: 'clover', name: 'Clover', ms: 'charlie', sw: ['#287846', '#ffd666'] },
      { id: 'midsuit', name: 'Midnight suit', ms: 'r10000', sw: ['#1a244e', '#d2283c'] },
      { id: 'gilded', name: 'Gilded', ms: 'mogul', sw: ['#c89a32', '#18181e'] } ] },
    { slot: 'acc', group: 'Accessory', items: [
      { id: 'none', name: 'None', cost: 0, sw: ['#2a2c34', '#2a2c34'] },
      { id: 'flower', name: 'Flower clip', cost: 15000, sw: ['#ff96be', '#ffd666'] },
      { id: 'glasses', name: 'Glasses', cost: 30000, sw: ['#3a221e', '#dfe6f0'] },
      { id: 'catears', name: 'Cat ears', cost: 120000, sw: ['#ea6a3c', '#ffb0ba'] },
      { id: 'tiara', name: 'Tiara', cost: 1000000, sw: ['#ffd666', '#e6466e'] },
      { id: 'stars', name: 'Star clips', cost: 8000, sw: ['#ffd246', '#fff4aa'] },
      { id: 'bow', name: 'Big bow', cost: 20000, sw: ['#ff78aa', '#ffc8de'] },
      { id: 'beret', name: 'Beret', cost: 45000, sw: ['#c42c3e', '#ec606e'] },
      { id: 'sunglasses', name: 'Shades', cost: 80000, sw: ['#14141a', '#8ca0c8'] },
      { id: 'headphones', name: 'Headphones', cost: 150000, sw: ['#46485c', '#ff8cb4'] },
      { id: 'santa', name: 'Santa hat', cost: 400000, sw: ['#d6323a', '#fafafc'] },
      { id: 'crown', name: 'Crown', vip: 10, sw: ['#ffd250', '#dc2846'] },
      { id: 'halo', name: 'Halo', vip: 12, sw: ['#fff4aa', '#ffd650'] } ] },
  ],
  cards: [
    { slot: 'back', group: 'Card backs', items: [
      { id: 'classic', name: 'Royal', cost: 0, sw: ['#3f4fb0', '#fbfaf7'] },
      { id: 'crimson', name: 'Crimson', cost: 3000, sw: ['#b8323f', '#fbfaf7'] },
      { id: 'emerald', name: 'Emerald', cost: 8000, sw: ['#1f8a5b', '#fbfaf7'] },
      { id: 'onyx', name: 'Onyx & gold', cost: 60000, sw: ['#16171c', '#f5c451'] },
      { id: 'sakura', name: 'Sakura', cost: 200000, sw: ['#f3a3c0', '#ffffff'] },
      { id: 'holo', name: 'Holographic', cost: 2500000, sw: ['#7ee8fa', '#eec0ff'] },
      { id: 'silver', name: 'Silver', vip: 2, sw: ['#c8d3e4', '#7d8aa0'] },
      { id: 'ruby', name: 'Ruby', vip: 8, sw: ['#c8173a', '#ffb0bf'] },
      { id: 'obsidian', name: 'Obsidian', vip: 11, sw: ['#15121f', '#9b7cff'] },
      { id: 'natural', name: 'Natural', ms: 'natural', sw: ['#c8283c', '#ffffff'] },
      { id: 'split', name: 'Split', ms: 'fourway', sw: ['#3f4fb0', '#c8283c'] },
      { id: 'twin', name: 'Twin', ms: 'perfect', sw: ['#7b3fb0', '#d070b0'] },
      { id: 'grinder', name: 'Grinder', ms: 'r1000', sw: ['#222228', '#f5c451'] } ] },
  ],
  table: [
    { slot: 'felt', group: 'Table felt', items: [
      { id: 'green', name: 'Classic', cost: 0, sw: ['#40a876', '#1a3a2a'] },
      { id: 'ocean', name: 'Ocean', cost: 6000, sw: ['#3c82dc', '#15283e'] },
      { id: 'crimson', name: 'Crimson', cost: 20000, sw: ['#d24650', '#3a1418'] },
      { id: 'violet', name: 'Violet', cost: 75000, sw: ['#9664e6', '#261838'] },
      { id: 'gold', name: 'Gold rush', cost: 500000, sw: ['#e6b446', '#3a2c10'] },
      { id: 'walnut', name: 'Walnut', vip: 1, sw: ['#b07a45', '#3a2412'] },
      { id: 'jade', name: 'Jade', vip: 6, sw: ['#5fbf8f', '#123a28'] },
      { id: 'starfield', name: 'Starfield', vip: 12, sw: ['#6a5cff', '#0c0a24'] },
      { id: 'teal', name: 'Teal', ms: 'doubles', sw: ['#14aaaa', '#0c3434'] },
      { id: 'royal', name: 'Royal blue', ms: 'sflush', sw: ['#2850d2', '#101c44'] },
      { id: 'mahogany', name: 'Mahogany', ms: 'r100', sw: ['#963c2d', '#34120c'] },
      { id: 'vegas', name: 'Vegas night', ms: 'bigwin', sw: ['#dc328c', '#2c0a1e'] } ] },
  ],
};
const DEFAULT_EQUIP = { ribbon: 'mint', outfit: 'navy', acc: 'none', back: 'classic', felt: 'green' };
// sprite recolours: exact base-palette colours -> replacement
const RIBBON_SRC = [[80, 176, 132], [48, 122, 92], [255, 214, 102]];
const RIBBONS = { mint: null, cherry: [[226, 64, 76], [170, 40, 52], [255, 214, 102]], sakura: [[255, 150, 190], [220, 100, 150], [255, 255, 255]],
  gold: [[245, 196, 81], [196, 146, 40], [255, 245, 200]], midnight: [[52, 56, 96], [30, 32, 60], [160, 170, 255]],
  platinum: [[212, 227, 238], [140, 162, 180], [255, 255, 255]], emerald: [[31, 209, 138], [10, 122, 76], [159, 247, 207]],
  flame: [[255, 120, 40], [200, 64, 24], [255, 222, 96]], silk: [[236, 230, 248], [176, 166, 200], [255, 214, 120]],
  neon: [[40, 240, 200], [16, 150, 130], [255, 90, 220]],
  hidden: [[-1], [-1], [-1]] };                                  // -1 = make transparent
// outfits recolour three palette groups on the base sprite: vest, shirt (also her cuffs), bow tie
const VEST_SRC = [[46, 48, 70], [18, 19, 30], [78, 81, 112]];
const SHIRT_SRC = [[248, 245, 239], [216, 208, 196], [150, 138, 122]];
const TIE_SRC = [[232, 74, 80], [176, 48, 56]];
const OUTFITS = {
  navy: {},
  burgundy: { vest: [[110, 34, 48], [44, 10, 18], [150, 60, 74]] },
  forest: { vest: [[36, 84, 62], [12, 34, 24], [62, 120, 92]] },
  plum: { vest: [[86, 52, 112], [34, 18, 48], [122, 86, 150]] },
  ivory: { vest: [[236, 228, 212], [140, 128, 110], [184, 172, 150]] },
  tuxedo: { vest: [[26, 27, 34], [8, 8, 12], [70, 72, 86]], tie: [[30, 30, 38], [10, 10, 14]] },
  denim: { vest: [[59, 95, 148], [26, 44, 78], [110, 146, 196]], shirt: [[226, 236, 248], [186, 202, 224], [120, 136, 160]], tie: [[214, 66, 60], [150, 40, 36]] },
  rose: { vest: [[232, 127, 164], [150, 60, 96], [255, 186, 208]], shirt: [[255, 246, 238], [236, 218, 206], [170, 142, 128]], tie: [[150, 36, 70], [100, 20, 46]] },
  lavender: { vest: [[154, 134, 216], [74, 58, 128], [196, 182, 244]], shirt: [[248, 245, 255], [218, 212, 236], [150, 142, 176]], tie: [[255, 214, 102], [206, 160, 50]] },
  holiday: { vest: [[196, 42, 54], [100, 14, 24], [236, 96, 104]], tie: [[46, 138, 78], [24, 90, 48]] },
  royal: { vest: [[58, 31, 110], [24, 10, 52], [110, 76, 170]], tie: [[245, 196, 81], [184, 132, 30]] },
  goldvest: { vest: [[224, 169, 42], [120, 78, 10], [255, 230, 140]], tie: [[40, 30, 20], [16, 10, 6]] },
  pearl: { vest: [[247, 238, 244], [176, 140, 164], [255, 255, 255]], shirt: [[255, 250, 252], [232, 214, 226], [170, 140, 158]], tie: [[217, 143, 180], [170, 90, 132]] },
  sapphire: { vest: [[42, 92, 200], [14, 34, 96], [110, 160, 255]], tie: [[230, 240, 255], [160, 184, 220]] },
  obsidian: { vest: [[21, 18, 31], [4, 3, 8], [155, 124, 255]], shirt: [[40, 36, 54], [28, 24, 40], [16, 14, 24]], tie: [[155, 124, 255], [96, 70, 200]] },
  charcoal: { vest: [[64, 66, 72], [28, 29, 33], [100, 103, 112]], tie: [[245, 196, 81], [184, 132, 30]] },
  clover: { vest: [[40, 120, 70], [16, 60, 32], [80, 170, 110]], tie: [[255, 214, 102], [206, 160, 50]] },
  midsuit: { vest: [[26, 36, 78], [10, 14, 36], [64, 86, 150]], shirt: [[240, 244, 255], [206, 214, 236], [140, 150, 180]], tie: [[210, 40, 60], [150, 20, 40]] },
  gilded: { vest: [[200, 154, 50], [112, 82, 20], [244, 210, 120]], shirt: [[255, 250, 240], [232, 222, 204], [170, 150, 122]], tie: [[24, 24, 30], [8, 8, 12]] },
  celestial: { vest: [[255, 246, 208], [214, 170, 90], [255, 214, 120]], shirt: [[255, 255, 255], [236, 226, 246], [180, 166, 200]], tie: [[255, 111, 181], [214, 70, 140]] },
};
const HIDES_RIBBON = new Set(['catears', 'headphones', 'beret', 'bow', 'santa', 'crown']);

const RESULT_NAMES = {
  blackjack: 'Blackjack!', win: 'You win', dealer_bust: 'Dealer bust', push: 'Push',
  lose: 'Dealer wins', dealer_bj: 'Dealer blackjack', bust: 'Bust', surrender: 'Surrendered',
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n, signed) => (signed && n > 0 ? '+' : '') + n.toLocaleString('en-US');
// drop trailing zeros after a decimal point only: '3.50' -> '3.5', '2.00' -> '2', '250' stays '250'
// tight spots (hand tags, split total): 12,500 -> 12.5K; millions and up as fmtBig
const fmtShort = (n, signed) => Math.abs(n) < 1e4 ? fmt(Math.round(n), signed) : Math.abs(n) < 1e6 ? (n < 0 ? '-' : signed ? '+' : '') + trimZeros((Math.abs(n) / 1e3).toFixed(Math.abs(n) < 1e5 ? 1 : 0)) + 'K' : fmtBig(n, signed);
const fmtMult = m => m < 100 ? trimZeros(m.toFixed(2)) : fmtBig(Math.round(m));   // x1.25, x53,846, x1.2M
const trimZeros = t => t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t;
// compact form for big numbers: 1,234,567 -> 1.23M
const fmtBig = (n, signed) => {
  const a = Math.abs(n);
  if (a < 1e6) return fmt(Math.round(n), signed);
  if (a >= 1e30) return (n < 0 ? '-' : signed ? '+' : '') + trimZeros((a / Math.pow(10, Math.floor(Math.log10(a)))).toFixed(2)) + 'e' + Math.floor(Math.log10(a));
  const [div, suf] = [[1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'], [1e18, 'Qi'], [1e15, 'Qa'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M']].find(u => a >= u[0]);
  const v = a / div, txt = trimZeros(v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  return (n < 0 ? '-' : signed ? '+' : '') + txt + suf;
};

// ---------------------------------------------------------------- sound (synthesised, no files)
let AC = null, master = null, noiseBuf = null;
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return AC; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.32 * G.volume;
    const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
  return AC;
}
function tone(f, t, dur, { type = 'sine', vol = 0.3, attack = 0.004, slide = 0 } = {}) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, { freq = 3000, q = 1, vol = 0.3, type = 'bandpass' } = {}) {
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
}
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const SFX = {
  card: t => { noise(t, 0.07, { freq: 2600 + Math.random() * 900, q: 0.9, vol: 0.35 }); noise(t + 0.012, 0.04, { freq: 900, q: 0.7, vol: 0.12, type: 'lowpass' }); },
  flip: t => { noise(t, 0.09, { freq: 1800, q: 0.8, vol: 0.28 }); },
  shuffle: t => { for (let i = 0; i < 9; i++) noise(t + i * 0.035, 0.05, { freq: 2200 + Math.random() * 1500, q: 1, vol: 0.18 }); },
  chips: t => { for (let i = 0; i < 3; i++) { const u = t + i * 0.045 + Math.random() * 0.01; tone(3100 + Math.random() * 500, u, 0.07, { vol: 0.07 }); tone(4700 + Math.random() * 400, u, 0.05, { vol: 0.04 }); noise(u, 0.02, { freq: 5000, q: 2, vol: 0.06 }); } },
  tip: t => { tone(NOTE(88), t, 0.09, { type: 'triangle', vol: 0.12 }); tone(NOTE(93), t + 0.05, 0.12, { type: 'triangle', vol: 0.1 }); },
  buy: t => { SFX.chips(t); tone(NOTE(84), t + 0.08, 0.16, { type: 'triangle', vol: 0.12 }); tone(NOTE(91), t + 0.14, 0.2, { type: 'triangle', vol: 0.1 }); },
  win: t => { [72, 76, 79].forEach((n, i) => tone(NOTE(n), t + i * 0.08, 0.28, { type: 'triangle', vol: 0.16 })); },
  blackjack: t => { [72, 76, 79, 84, 88].forEach((n, i) => tone(NOTE(n), t + i * 0.07, 0.4, { type: 'triangle', vol: 0.16 }));
    [96, 100].forEach((n, i) => tone(NOTE(n), t + 0.38 + i * 0.06, 0.3, { vol: 0.06 })); },
  push: t => { tone(NOTE(74), t, 0.22, { type: 'triangle', vol: 0.1 }); },
  lose: t => { tone(NOTE(67), t, 0.22, { type: 'triangle', vol: 0.12 }); tone(NOTE(62), t + 0.13, 0.32, { type: 'triangle', vol: 0.11 }); },
  milestone: t => { [79, 84, 88, 91].forEach((n, i) => { tone(NOTE(n), t + i * 0.06, 0.6, { vol: 0.12 }); tone(NOTE(n + 12), t + i * 0.06, 0.4, { vol: 0.03 }); }); },
  tierup: t => { [60, 64, 67, 72].forEach((n, i) => tone(NOTE(n), t + i * 0.11, 0.35, { type: 'triangle', vol: 0.16 }));
    [72, 76, 79, 84].forEach(n => tone(NOTE(n), t + 0.5, 1.1, { type: 'triangle', vol: 0.1 }));
    [96, 100, 103, 108].forEach((n, i) => tone(NOTE(n), t + 0.55 + i * 0.07, 0.5, { vol: 0.04 })); },
  click: t => { tone(1800, t, 0.03, { type: 'square', vol: 0.025 }); },
  tick: t => { tone(2600, t, 0.018, { type: 'triangle', vol: 0.035 }); },
  tab: t => { tone(NOTE(84), t, 0.05, { vol: 0.05 }); tone(NOTE(88), t + 0.035, 0.07, { vol: 0.045 }); },
  stand: t => { noise(t, 0.06, { freq: 380, q: 0.7, vol: 0.22, type: 'lowpass' }); tone(170, t, 0.08, { vol: 0.08, slide: 0.7 }); },
  fold: t => { tone(620, t, 0.22, { type: 'triangle', vol: 0.07, slide: 0.5 }); noise(t, 0.12, { freq: 1200, q: 0.6, vol: 0.08 }); },
  bust: t => { tone(210, t, 0.3, { type: 'triangle', vol: 0.14, slide: 0.55 }); noise(t, 0.09, { freq: 300, q: 0.6, vol: 0.14, type: 'lowpass' }); },
  cut: t => { tone(NOTE(93), t, 0.25, { vol: 0.06 }); tone(NOTE(98), t + 0.09, 0.3, { vol: 0.05 }); },
  coins: t => { for (let i = 0; i < 7; i++) { const u = t + i * 0.06 + Math.random() * 0.02; tone(2900 + Math.random() * 900, u, 0.08, { vol: 0.06 }); tone(4400 + Math.random() * 500, u, 0.05, { vol: 0.03 }); } },
  open: t => { noise(t, 0.2, { freq: 900, q: 0.5, vol: 0.06 }); tone(320, t, 0.18, { type: 'triangle', vol: 0.05, slide: 1.9 }); },
  close: t => { noise(t, 0.18, { freq: 700, q: 0.5, vol: 0.05 }); tone(560, t, 0.16, { type: 'triangle', vol: 0.045, slide: 0.55 }); },
  pop: t => { tone(880, t, 0.05, { vol: 0.03, slide: 1.5 }); },
  arm: t => { tone(660, t, 0.07, { type: 'square', vol: 0.03 }); tone(880, t + 0.08, 0.1, { type: 'square', vol: 0.03 }); },
  equip: t => { tone(NOTE(88), t, 0.14, { vol: 0.07 }); tone(NOTE(95), t + 0.06, 0.2, { vol: 0.06 }); },
  star: t => { SFX.chips(t); [96, 100, 103, 108].forEach((n, i) => tone(NOTE(n), t + 0.05 + i * 0.05, 0.45, { vol: 0.055 })); tone(NOTE(84), t, 0.5, { type: 'triangle', vol: 0.08 }); },
  deny: t => { tone(150, t, 0.1, { type: 'square', vol: 0.04 }); },
  peek: t => { noise(t, 0.04, { freq: 2200, q: 1, vol: 0.12 }); },
};
let lastTickSfx = 0;
function sfx(name) {
  if (G.muted || !SFX[name]) return;
  if (!audio()) return;
  try { SFX[name](AC.currentTime + 0.005); } catch (e) { /* audio is optional */ }
}

// ---------------------------------------------------------------- rules
function handValue(cards) {
  let total = 0, aces = 0;
  for (const [r] of cards) {
    if (r === 'A') { total += 11; aces++; }
    else if (r === 'J' || r === 'Q' || r === 'K') total += 10;
    else total += parseInt(r, 10);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

function isSoft(cards) {                              // an ace still counted as 11
  let total = 0, aces = 0;
  for (const [r] of cards) { if (r === 'A') { total += 11; aces++; } else total += r === 'J' || r === 'Q' || r === 'K' ? 10 : parseInt(r, 10); }
  while (total > 21 && aces) { total -= 10; aces--; }
  return aces > 0;
}
const totalText = cards => { const v = handValue(cards); return isSoft(cards) && v < 21 ? (v - 10) + '/' + v : String(v); };

function perfectPairs(c1, c2) {                       // -> [name, odds] or null
  if (c1[0] !== c2[0]) return null;
  if (c1[1] === c2[1]) return ['Perfect pair', 35];            // 35/14/8 on two decks: house edge 0.97%
  if (RED.has(c1[1]) === RED.has(c2[1])) return ['Coloured pair', 14];
  return ['Mixed pair', 8];
}

function twentyOnePlusThree(c1, c2, up) {            // -> [name, odds] or null
  const ranks = [c1, c2, up].map(c => RANK_ORDER[c[0]]).sort((a, b) => a - b);
  const flush = new Set([c1[1], c2[1], up[1]]).size === 1;
  const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const straight = (ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) ||
    (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13);
  if (straight && flush) return ['Straight flush', 60];          // 5/10/45/60 on two decks: house edge 0.95%
  if (trips) return ['Three of a kind', 45];
  if (straight) return ['Straight', 10];
  if (flush) return ['Flush', 5];
  return null;
}

// ---------------------------------------------------------------- state
const G = {
  shoe: [], cutAt: 0, dealt: 0, shufflePending: false,
  chips: START_CHIPS, bet: 50, pp: 0, tp: 0, betWant: 50, ppWant: 0, tpWant: 0,   // *Want: the bet you asked for; bets trim to your chips and come back
  hands: [], cur: 0, dealer: [], holeHidden: true, handBet: 0, ins: 0,
  state: 'BET',            // BET → DEALING → (INSURANCE) → PLAYER → DEALER → BET
  result: null, net: 0, sideResults: [], insResult: null,
  seen: [], holeCounted: false, countVisible: true,     // Hi-Lo running count of every card seen this shoe
  gens: {}, boosts: {}, tipLevel: 0, tips: 0, frac: 0, lastSeen: 0, tab: 'table', earned: 0,
  stars: 0, franchises: 0, runEarned: 0, owned: {}, equip: { ...DEFAULT_EQUIP }, shopCat: 'perks', autoFrac: 0,
  st: null, statCat: 'vip', muted: false, cashback: 0, starsSpent: 0, su: {},
  roundStake: 0, roundTC: 0, hist: [], lastTopup: 0,
  volume: 1, chatter: 'normal', fast: false,                // Settings: sound volume, her idle chatter, deal speed
};
// lifetime stats: never reset, not even by a franchise
const NEW_STATS = () => ({
  rounds: 0, hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, dealerBusts: 0, dealerBJ: 0,
  doubles: 0, doubleWins: 0, splits: 0, splitWins: 0, surrenders: 0, insTaken: 0, insWon: 0,
  ppBets: 0, ppHits: 0, tpBets: 0, tpHits: 0, sideWagered: 0, sideNet: 0,
  wagered: 0, net: 0, comp: 0, cashback: 0, biggestWin: 0, biggestLoss: 0, biggestBet: 0, bestStreak: 0, streak: 0, worstStreak: 0,
  tcHiBet: 0, tcHiN: 0, tcLoBet: 0, tcLoN: 0,
  highChips: 0, attractions: 0, playMs: 0, days: 0, lastDay: '', since: 0, topups: 0, tierUps: 0,
  vipV: 3, vipFloor: 0,                                 // VIP from wagered (2.1+); vipFloor keeps a tier earned under the old comp ladder
  units: 0, tableMs: 0, sessions: 0,
  curve: [],                                           // units of the last 200 rounds
  fourWay: 0, comebacks: 0, perfectPairs: 0, straightFlushes: 0, charlies: 0, maxTC: 0,   // milestone counters
  ach: {},                                             // milestone id -> time unlocked
});
// ---------------------------------------------------------------- milestones (each unlocks one cosmetic)
const TROPHY = '<svg class="troph" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M3 1h6v1h2v2a2.5 2.5 0 0 1-2.2 2.5A3 3 0 0 1 6.5 8v1.5H8V11H4V9.5h1.5V8a3 3 0 0 1-2.3-1.5A2.5 2.5 0 0 1 1 4V2h2zm0 2H2v1a1.5 1.5 0 0 0 1 1.4zm6 0v2.4A1.5 1.5 0 0 0 10 4V3z"/></svg>';
const ACH = [
  { id: 'natural', name: 'Natural', desc: 'Get a blackjack', v: () => G.st.blackjacks, goal: 1 },
  { id: 'r100', name: 'Regular', desc: 'Play 100 rounds', v: () => G.st.rounds, goal: 100 },
  { id: 'doubles', name: 'Double trouble', desc: 'Win 25 doubled hands', v: () => G.st.doubleWins, goal: 25 },
  { id: 'insured', name: 'Covered', desc: 'Win an insurance bet', v: () => G.st.insWon, goal: 1 },
  { id: 'streak', name: 'On fire', desc: 'Win 7 rounds in a row', v: () => G.st.bestStreak, goal: 7 },
  { id: 'comeback', name: 'Comeback', desc: 'Win right after losing 5 in a row', v: () => G.st.comebacks, goal: 1 },
  { id: 'charlie', name: 'Five-card Charlie', desc: 'Win a hand holding 5+ cards', v: () => G.st.charlies, goal: 1 },
  { id: 'perfect', name: 'Perfect pair', desc: 'Hit a Perfect Pair (same rank and suit)', v: () => G.st.perfectPairs, goal: 1 },
  { id: 'counter', name: 'Card counter', desc: 'Bet into a true count of +5 or more', v: () => G.st.maxTC, goal: 5 },
  { id: 'fourway', name: 'Four-way split', desc: 'Split into four hands', v: () => G.st.fourWay, goal: 1 },
  { id: 'r1000', name: 'Grinder', desc: 'Play 1,000 rounds', v: () => G.st.rounds, goal: 1000 },
  { id: 'sflush', name: 'Straight flush', desc: 'Hit a 21+3 straight flush', v: () => G.st.straightFlushes, goal: 1 },
  { id: 'bigwin', name: 'Whale', desc: 'Win 1B or more in one round', v: () => G.st.biggestWin, goal: 1e9 },
  { id: 'mogul', name: 'Mogul', desc: 'Open 5 franchises', v: () => G.franchises, goal: 5 },
  { id: 'r10000', name: 'Lifer', desc: 'Play 10,000 rounds', v: () => G.st.rounds, goal: 10000 },
];
const achReward = id => { for (const cat of ['dealer', 'cards', 'table']) for (const grp of SHOP[cat]) for (const it of grp.items) if (it.ms === id) return { slot: grp.slot, group: grp.group, ...it }; return null; };
function checkAch(silent, delay = 0) {                   // stamp newly reached milestones now; announce them (after `delay`) unless silent
  const got = ACH.filter(a => !G.st.ach[a.id] && a.v() >= a.goal);
  for (const a of got) G.st.ach[a.id] = Date.now();
  if (got.length && !silent) setTimeout(() => announceAch(got), delay);
  return got.length;
}
function announceAch(got) {
  const a = got[0], r = achReward(a.id);
  toastAch(a, r, got.length - 1);
  setMood('surprised', 1800); setTimeout(() => setMood('happy', 2500), 900);
  say('Milestone: ' + a.name + '! ' + (r ? r.name + ' ' + r.group.toLowerCase() + ' unlocked \u2665' : ''), 4500);
  sfx('milestone');
  renderShop(); if (G.tab === 'stats') renderStats();
}
function toastAch(a, r, more) {
  const old = document.querySelector('.achtoast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'achtoast';
  el.innerHTML = TROPHY + '<div><b>' + a.name + '</b><small>' + (r ? 'Unlocked: ' + r.name + ' ' + r.group.toLowerCase() : a.desc) + (more > 0 ? ' \u00b7 +' + more + ' more' : '') + '</small></div>';
  $('table').appendChild(el);
  el.onclick = () => el.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4200);
}

G.st = NEW_STATS();
// this launch only: the Session stats page
const SES = { t0: Date.now(), rounds: 0, wag: 0, net: 0, tableMs: 0, lastAct: 0 };
const HIST_MAX = 250, HIST_SHOW = 50, CURVE_MAX = 200;
function tableClock() {                                 // time at the table: gaps over a minute between actions don't count
  const now = Date.now(), gap = now - SES.lastAct;
  if (SES.lastAct && gap < 60000) { SES.tableMs += gap; G.st.tableMs += gap; }
  SES.lastAct = now;
}
const hand = () => G.hands[G.cur];
const firstHand = () => G.hands[0] ? G.hands[0].cards : [];

const hiLo = card => { const r = card[0]; return r === 'A' || r === '10' || r === 'J' || r === 'Q' || r === 'K' ? -1 : (r === '7' || r === '8' || r === '9' ? 0 : 1); };
const runningCount = () => G.seen.reduce((a, c) => a + hiLo(c), 0);
const decksLeft = () => G.shoe.length / 52;
const trueCount = () => decksLeft() > 0 ? runningCount() / decksLeft() : 0;
function revealHole() {
  G.holeHidden = false; mustCommit = true;
  if (!G.holeCounted && G.dealer.length > 1) { G.seen.push(G.dealer[1]); G.holeCounted = true; }
}

function load() {
  try {
    const parse = t => { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } };
    const file = window.buddy && window.buddy.loadSync ? parse(window.buddy.loadSync()) : null, ls = parse(localStorage.getItem('blackjack-buddy'));
    const d = (file && ls ? ((file.lastSeen || 0) >= (ls.lastSeen || 0) ? file : ls) : file || ls) || {};   // newest of the two
    if (Number.isFinite(d.chips)) G.chips = Math.max(0, Math.floor(d.chips));
    if (Number.isFinite(d.bet)) G.bet = Math.floor(d.bet);
    if (Number.isFinite(d.pp)) G.pp = Math.floor(d.pp);
    if (Number.isFinite(d.tp)) G.tp = Math.floor(d.tp);
    G.betWant = Number.isFinite(d.betWant) ? Math.max(MIN_BET, Math.floor(d.betWant)) : G.bet;
    G.ppWant = Number.isFinite(d.ppWant) ? Math.max(0, Math.floor(d.ppWant)) : G.pp;
    G.tpWant = Number.isFinite(d.tpWant) ? Math.max(0, Math.floor(d.tpWant)) : G.tp;
    if (typeof d.countVisible === 'boolean') G.countVisible = d.countVisible;
    if (d.gens && typeof d.gens === 'object') for (const g of GENS) G.gens[g.id] = Math.max(0, Math.floor(d.gens[g.id] || 0));
    if (Number.isFinite(d.tipLevel)) G.tipLevel = Math.max(0, Math.floor(d.tipLevel));
    if (Number.isFinite(d.tips)) G.tips = Math.max(0, Math.floor(d.tips));
    if (Number.isFinite(d.frac)) G.frac = Math.max(0, d.frac);
    if (Number.isFinite(d.lastSeen)) G.lastSeen = d.lastSeen;
    if (d.boosts && typeof d.boosts === 'object') for (const b of BOOSTS) G.boosts[b.id] = !!d.boosts[b.id];
    if (Number.isFinite(d.earned)) G.earned = Math.max(0, d.earned);
    if (Number.isFinite(d.stars)) G.stars = Math.max(0, Math.floor(d.stars));
    if (Number.isFinite(d.franchises)) G.franchises = Math.max(0, Math.floor(d.franchises));
    G.runEarned = Number.isFinite(d.runEarned) ? Math.max(0, d.runEarned) : G.earned;   // older saves: count everything so far
    if (d.owned && typeof d.owned === 'object') for (const k in d.owned) G.owned[k] = !!d.owned[k];
    if (d.equip && typeof d.equip === 'object') for (const k in DEFAULT_EQUIP) if (typeof d.equip[k] === 'string') G.equip[k] = d.equip[k];
    if (d.st && typeof d.st === 'object') {
      for (const k in G.st) if (typeof d.st[k] === typeof G.st[k] && d.st[k] !== null) G.st[k] = d.st[k];
      if (Array.isArray(G.st.ach)) G.st.ach = {};
      for (const k in G.st.ach) if (!Number.isFinite(G.st.ach[k])) delete G.st.ach[k];
      if (!Array.isArray(G.st.curve) || !G.st.curve.every(Number.isFinite)) G.st.curve = [];
      if (d.st.vipV === undefined) {                      // older save: keep the tier it earned under the comp ladder
        let i = 0; while (i + 1 < OLD_COMP_AT.length && G.st.comp >= OLD_COMP_AT[i + 1]) i++;
        G.st.vipFloor = i; G.st.vipV = 2;
      }
      if (G.st.vipV === 2) {                              // ladder was respaced: nobody drops a tier
        let i = 0; while (i + 1 < V21_AT.length && G.st.wagered >= V21_AT[i + 1]) i++;
        G.st.vipFloor = Math.max(G.st.vipFloor, i); G.st.vipV = 3;
      }
    }
    if (Array.isArray(d.hist)) G.hist = d.hist.filter(r => r && typeof r === 'object' && Array.isArray(r.h)).slice(-HIST_MAX);
    loadShoe(d.shoe); loadRound(d.round);
    if (typeof d.muted === 'boolean') G.muted = d.muted;
    if (Number.isFinite(d.volume)) G.volume = Math.max(0, Math.min(1, d.volume));
    if (['normal', 'quiet', 'off'].includes(d.chatter)) G.chatter = d.chatter;
    if (typeof d.fast === 'boolean') G.fast = d.fast;
    if (Number.isFinite(d.lastTopup)) G.lastTopup = Math.min(d.lastTopup, Date.now());   // clock set back: no longer than one cooldown
    if (Number.isFinite(d.starsSpent)) G.starsSpent = Math.max(0, Math.min(G.stars, Math.floor(d.starsSpent)));
    if (d.su && typeof d.su === 'object') for (const u of STAR_UPS) G.su[u.id] = Math.max(0, Math.min(u.costs.length, Math.floor(d.su[u.id] || 0)));
  } catch (e) { /* fresh start */ }
  if (G.state === 'BET') fitBets();
}
let mustCommit = false;                                  // a card or the hole card was revealed: save before it is painted
let restoring = false;                                   // a backup is being loaded: nothing may overwrite it on the way out
function save() {
  mustCommit = false;
  if (restoring) return;
  let json;
  try { json = JSON.stringify({ chips: G.chips, bet: G.bet, pp: G.pp, tp: G.tp, countVisible: G.countVisible,
      betWant: G.betWant, ppWant: G.ppWant, tpWant: G.tpWant, hist: G.hist,
      shoe: { cards: G.shoe, cutAt: G.cutAt, dealt: G.dealt, pending: G.shufflePending, seen: G.seen },
      round: G.state === 'BET' ? null : { state: G.state, hands: G.hands, cur: G.cur, dealer: G.dealer, holeHidden: G.holeHidden, holeCounted: G.holeCounted,
        handBet: G.handBet, ins: G.ins, stake: G.roundStake, tc: G.roundTC, sides: G.sideResults, insResult: G.insResult, pp: G.pp, tp: G.tp },
      gens: G.gens, boosts: G.boosts, tipLevel: G.tipLevel, tips: G.tips, frac: G.frac, lastSeen: Date.now(), earned: G.earned,
      stars: G.stars, franchises: G.franchises, runEarned: G.runEarned, owned: G.owned, equip: G.equip, st: G.st, muted: G.muted, starsSpent: G.starsSpent, su: G.su, lastTopup: G.lastTopup, volume: G.volume, chatter: G.chatter, fast: G.fast }); } catch (e) { return; }
  if (window.buddy && window.buddy.saveSync) { try { window.buddy.saveSync(json); } catch (e) { /* */ } }
  try { localStorage.setItem('blackjack-buddy', json); } catch (e) { /* */ }
}

// ---------------------------------------------------------------- saving an unfinished round
// The shoe and any round in progress are saved, so quitting mid-hand resumes the same hand (same cards) next launch.
const okCard = c => Array.isArray(c) && c.length === 2 && RANKS.includes(c[0]) && SUITS.includes(c[1]);
const okCards = a => Array.isArray(a) && a.every(okCard);
function loadShoe(sh) {
  if (!sh || !okCards(sh.cards) || !sh.cards.length || !okCards(sh.seen) || !Number.isFinite(sh.cutAt) || !Number.isFinite(sh.dealt)) return;
  G.shoe = sh.cards; G.seen = sh.seen; G.cutAt = sh.cutAt; G.dealt = sh.dealt; G.shufflePending = !!sh.pending;
}
function loadRound(r) {
  if (!r || typeof r !== 'object') return;
  const hands = Array.isArray(r.hands) ? r.hands : [];
  const valid = ['DEALING', 'INSURANCE', 'PLAYER', 'DEALER'].includes(r.state) && hands.length >= 1 && hands.length <= MAX_HANDS &&
    hands.every(h => h && okCards(h.cards) && Number.isFinite(h.bet) && h.bet > 0) && okCards(r.dealer) && Number.isFinite(r.cur) && hands[r.cur];
  if (!valid) {                                          // unreadable: hand the stakes back rather than lose them
    const back = hands.reduce((a, h) => a + (h && Number.isFinite(h.bet) ? h.bet : 0), 0);
    if (back > 0) G.chips += back;
    return;
  }
  Object.assign(G, { state: r.state, hands, cur: r.cur, dealer: r.dealer, holeHidden: r.holeHidden !== false, holeCounted: !!r.holeCounted,
    handBet: +r.handBet || hands[0].bet, ins: +r.ins || 0, roundStake: +r.stake || 0, roundTC: +r.tc || 0,
    sideResults: Array.isArray(r.sides) ? r.sides : [], insResult: Number.isFinite(r.insResult) ? r.insResult : null,
    pp: +r.pp || 0, tp: +r.tp || 0, result: null });
}
function resumeRound() {                                 // pick up where the saved round stopped
  if (G.state === 'DEALING') return dealSeq(['p', 'd', 'p', 'd'].slice(G.hands[0].cards.length + G.dealer.length), afterDeal);
  if (G.state === 'PLAYER') return nextHand();
  if (G.state === 'DEALER') {
    const h0 = G.hands[0], natural = G.hands.length === 1 && !h0.split && h0.cards.length === 2 && handValue(h0.cards) === 21;
    revealHole(); render();
    if (G.hands.some(h => !h.bust && !h.surrendered) && !natural && handValue(G.dealer) !== 21) return setTimeout(dealerStep, T(750));
    return setTimeout(settle, T(700));
  }
  render();                                              // INSURANCE: the question is still on the table
}

// ---------------------------------------------------------------- shoe
function shuffle() {
  const cards = [];
  for (let d = 0; d < DECKS; d++) for (const r of RANKS) for (const s of SUITS) cards.push([r, s]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.pop();                                          // burn card
  G.shoe = cards;
  const n = cards.length;
  const lo = Math.floor(n * CUT_RANGE[0]), hi = Math.floor(n * CUT_RANGE[1]);
  G.cutAt = lo + Math.floor(Math.random() * (hi - lo + 1));
  G.dealt = 0;
  G.shufflePending = false;
  G.seen = [];
}

function drawCard(faceDown) {
  if (!G.shoe.length) {                                 // ran dry mid-hand (very rare): reshuffle without the cards on the table
    shuffle();
    for (const c of G.dealer.concat(...G.hands.map(h => h.cards))) { const i = G.shoe.findIndex(x => x[0] === c[0] && x[1] === c[1]); if (i >= 0) G.shoe.splice(i, 1); }
  }
  const card = G.shoe.pop();
  G.dealt++; mustCommit = true;
  if (!faceDown) G.seen.push(card);
  if (!G.shufflePending && G.dealt >= G.cutAt) {
    G.shufflePending = true;
    say(pick(LINES.cut), 3500); sfx('cut');
  }
  return card;
}

// ---------------------------------------------------------------- bets (no caps, only your chips)
const floorTo = (v, s) => Math.floor(v / s) * s;
function fitBets() {                                   // the bet you asked for, trimmed to your chips (it comes back when you can afford it)
  G.bet = Math.max(MIN_BET, Math.min(G.betWant, floorTo(G.chips, STEP)));
  let rem = G.chips - G.bet;
  G.pp = Math.max(0, Math.min(G.ppWant, floorTo(rem, SIDE_STEP)));
  rem -= G.pp;
  G.tp = Math.max(0, Math.min(G.tpWant, floorTo(rem, SIDE_STEP)));
}
const totalStake = () => G.bet + G.pp + G.tp;
const canDeal = () => G.state === 'BET' && G.chips >= MIN_BET && G.chips >= totalStake();

function adjustBet(delta) {
  if (G.state !== 'BET') return;
  setBet(G.bet + delta);
}
function setBet(v) {
  if (G.state !== 'BET') return;
  const cap = floorTo(G.chips - G.pp - G.tp, STEP);
  G.bet = G.betWant = Math.max(MIN_BET, Math.min(floorTo(v, STEP), cap));
  save(); render();
}
function quickBet(q) {                                   // Min / half / double / Max
  if (G.state !== 'BET' || G.chips < MIN_BET) return;
  const max = floorTo(G.chips - G.pp - G.tp, STEP);
  const low = Math.max(MIN_BET, floorTo(G.chips * 0.01, STEP));   // Min: 1% of your chips; pressed again, the table minimum
  setBet(q === 'min' ? (G.bet > low ? low : MIN_BET) : q === 'half' ? G.bet / 2 : q === 'dbl' ? G.bet * 2 : max);
  sfx('tick');
}
// typed amounts: 2500, 2,500, 2.5k, 1.2M, 3Qa, 1e21 (suffixes as fmtBig prints them)
const AMT_SUF = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18, sx: 1e21, sp: 1e24, oc: 1e27 };
function parseAmount(txt) {
  const m = String(txt).trim().toLowerCase().replace(/[,_\s]/g, '').match(/^(\d+(?:\.\d*)?|\.\d+)(e\d{1,2})?(k|m|b|t|qa|qi|sx|sp|oc)?$/);
  if (!m) return NaN;
  const v = parseFloat(m[1] + (m[2] || '')) * (m[3] ? AMT_SUF[m[3]] : 1);
  return Number.isFinite(v) ? v : NaN;
}
let editing = null;                                        // 'bet' | 'pp' | 'tp' while an amount is being typed
function editAmount(which) {
  if (G.state !== 'BET' || G.chips < MIN_BET || editing) return;
  const b = $('v-' + which), inp = document.createElement('input');
  editing = which; inp.className = 'amtin'; inp.spellcheck = false; inp.maxLength = 16;
  inp.value = String(which === 'bet' ? G.bet : G[which]); inp.title = 'Type an amount: 2500, 2.5k, 1.2M, 3Qa \u00b7 Enter to set, Esc to cancel';
  b.parentNode.insertBefore(inp, b.nextSibling); b.classList.add('hid'); inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    const v = parseAmount(inp.value);
    inp.remove(); b.classList.remove('hid'); editing = null;
    if (ok && G.state === 'BET' && !Number.isNaN(v)) {
      if (which === 'bet') setBet(Math.max(v, MIN_BET)); else adjustSide(which, floorTo(v, SIDE_STEP) - G[which]);
      const got = which === 'bet' ? G.bet : G[which];
      if (v >= got + (which === 'bet' ? STEP : SIDE_STEP)) say('That\'s all you can cover \u2014 ' + fmtBig(got) + '~', 2500);   // typed more than the chips allow
      sfx('tick');
    } else { if (ok && inp.value.trim()) sfx('deny'); render(); }
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}
function adjustSide(which, delta) {
  if (G.state !== 'BET') return;
  const other = which === 'pp' ? G.tp : G.pp;
  const cap = floorTo(G.chips - G.bet - other, SIDE_STEP);
  const cur = which === 'pp' ? G.pp : G.tp;
  G[which] = G[which + 'Want'] = Math.max(0, Math.min(cur + delta, cap));
  save(); render();
}

// ---------------------------------------------------------------- game flow
// A round holds 1-4 player hands (splits). Each hand: { cards, bet, doubled, done, split, aces, res, net }
const newHand = (cards, bet, split) => ({ cards, bet, doubled: false, done: false, split: !!split, aces: false, res: null, net: 0, surrendered: false });
const MAX_HANDS = 4;
const T = ms => G.fast ? Math.round(ms * 0.45) : ms;   // Settings > Deal speed: Fast plays the table about twice as quickly

function startHand() {
  if (!canDeal()) return;
  const toast = document.querySelector('.achtoast'); if (toast) toast.remove();   // the deal area is needed again
  if (G.shufflePending) { shuffle(); say(pick(LINES.shuffle)); sfx('shuffle'); }
  else if (G.bet >= Math.max(1000, G.chips * 0.25) && Math.random() < 0.6) say(pick(LINES.bigbet), 2500);
  else if (Math.random() < 0.35) say(pick(LINES.deal), 2500);
  G.handBet = G.bet; G.ins = 0;
  G.chips -= totalStake();
  G.roundStake = totalStake();
  recordBetCount(); tableClock();
  G.hands = [newHand([], G.bet)]; G.cur = 0; G.dealer = [];
  G.holeHidden = true; G.holeCounted = false; G.result = null; G.net = 0; G.cashback = 0;
  G.sideResults = []; G.insResult = null;
  G.state = 'DEALING';
  setMood('idle'); sfx('chips');
  render();
  dealSeq(['p', 'd', 'p', 'd'], afterDeal);
}

function dealSeq(seq, done) {
  if (!seq.length) return done();
  const hole = seq[0] === 'd' && G.dealer.length === 1;
  (seq[0] === 'p' ? G.hands[0].cards : G.dealer).push(drawCard(hole));
  sfx('card');
  render();
  setTimeout(() => dealSeq(seq.slice(1), done), T(260));
}

function afterDeal() {
  resolveSideBets();
  const insCost = Math.floor(G.handBet / 2);
  if (G.dealer[0][0] === 'A' && insCost > 0 && G.chips >= insCost) {
    G.state = 'INSURANCE';
    say(pick(LINES.insurance), 8000);
    render();
  } else {
    peek();
  }
}

function resolveSideBets() {
  const res = [], p = firstHand();
  if (G.pp) {
    const hit = perfectPairs(p[0], p[1]);
    const win = hit ? G.pp * (hit[1] + 1) : 0;
    G.chips += win;
    res.push(['Pairs', win - G.pp, hit ? hit[0] : null]);
    G.st.ppBets++; if (hit) G.st.ppHits++; if (hit && hit[1] === 35) G.st.perfectPairs++;
  }
  if (G.tp) {
    const hit = twentyOnePlusThree(p[0], p[1], G.dealer[0]);
    const win = hit ? G.tp * (hit[1] + 1) : 0;
    G.chips += win;
    res.push(['21+3', win - G.tp, hit ? hit[0] : null]);
    G.st.tpBets++; if (hit) G.st.tpHits++; if (hit && hit[1] === 60) G.st.straightFlushes++;
  }
  G.sideResults = res;
  for (const r of res) { G.st.sideWagered += r[0] === 'Pairs' ? G.pp : G.tp; G.st.sideNet += r[1]; }
  const hits = res.filter(r => r[1] > 0);
  if (hits.length) { setMood('surprised', 2500); say(hits[0][2] + '! \u2605', 3500); sfx('win'); }
}

function insurance(take) {
  if (G.state !== 'INSURANCE') return;
  if (take && G.chips < Math.floor(G.handBet / 2)) { say(pick(LINES.nochips), 2500); sfx('deny'); return; }   // spent in the casino meanwhile
  hush();
  if (take) { G.ins = Math.floor(G.handBet / 2); G.chips -= G.ins; G.roundStake += G.ins; G.st.insTaken++; sfx('chips'); } else sfx('click');
  peek();
}

function peek() {                                     // dealer checks the hole card; also catches a natural
  const p = handValue(firstHand()), d = handValue(G.dealer);
  if (d === 21) {
    if (G.ins) { G.chips += G.ins * 3; G.insResult = G.ins * 2; G.st.insWon++; }
  } else {
    if (G.ins) G.insResult = -G.ins;
  }
  sfx('peek');
  if (d === 21 || p === 21) {
    G.hands[0].done = true;
    revealHole(); sfx('flip'); G.state = 'DEALER'; render();
    setTimeout(() => settle(), T(700));
  } else {
    G.state = 'PLAYER'; render();
  }
}

// the current hand can take an action: not finished, and not still waiting for its second card after a split
const canAct = () => G.state === 'PLAYER' && !!hand() && !hand().done && hand().cards.length >= 2;
const canSplit = () => {
  if (!canAct()) return false;
  const h = hand();
  return h.cards.length === 2 && h.cards[0][0] === h.cards[1][0] && !h.aces && G.hands.length < MAX_HANDS && G.chips >= h.bet;
};
const canDouble = () => canAct() && hand().cards.length === 2 && !hand().aces && G.chips >= hand().bet;
const canSurrender = () => canAct() && G.hands.length === 1 && hand().cards.length === 2;

function hit() {
  if (!canAct()) return;
  const h = hand();
  h.cards.push(drawCard()); sfx('card');
  const v = handValue(h.cards);
  if (v > 21) { h.done = true; h.bust = true; setMood('sad', 900); sfx('bust'); render(); setTimeout(nextHand, T(500)); }
  else if (v === 21) { render(); stand(); }
  else render();
}

function stand() {
  if (!canAct()) return;
  hand().done = true; sfx('stand');
  nextHand();
}

function doubleDown() {
  if (!canDouble()) { if (canAct() && hand().cards.length === 2 && !hand().aces) { say(pick(LINES.nochips), 2500); } return; }
  const h = hand();
  G.chips -= h.bet; G.roundStake += h.bet; h.bet *= 2; h.doubled = true;
  sfx('chips');
  h.cards.push(drawCard()); sfx('card');
  h.done = true; if (handValue(h.cards) > 21) { h.bust = true; setTimeout(() => sfx('bust'), 180); }
  render();
  setTimeout(nextHand, T(450));
}

function split() {
  if (!canSplit()) return;
  const h = hand();
  G.chips -= h.bet; G.roundStake += h.bet;
  const moved = h.cards.pop();
  const other = newHand([moved], h.bet, true);
  h.split = true;
  if (moved[0] === 'A') { h.aces = true; other.aces = true; }  // split aces: one card each, no resplit, no double
  G.hands.splice(G.cur + 1, 0, other);
  G.st.splits++; if (G.hands.length === 4) G.st.fourWay++;
  if (Math.random() < 0.5) say(pick(LINES.split), 2200);
  sfx('chips'); render();
  setTimeout(() => {
    h.cards.push(drawCard()); sfx('card');
    if (h.aces || handValue(h.cards) === 21) h.done = true;
    render();
    if (h.done) setTimeout(nextHand, T(450));
  }, T(320));
}

function surrender() {
  if (!canSurrender()) return;
  hand().surrendered = true; hand().done = true; sfx('fold');
  G.state = 'DEALER'; revealHole(); setTimeout(() => sfx('flip'), 200); render();
  setTimeout(() => settle(), T(600));
}

// move to the next unfinished hand; split hands get their second card when they come up
function nextHand() {
  if (G.state !== 'PLAYER') return;
  const i = G.hands.findIndex(h => !h.done);
  if (i < 0) return finishPlayer();
  G.cur = i;
  const h = hand();
  if (h.cards.length === 1) {
    render();
    setTimeout(() => {
      h.cards.push(drawCard()); sfx('card');
      if (h.aces || handValue(h.cards) === 21) h.done = true;
      render();
      if (h.done) setTimeout(nextHand, T(450));
    }, T(320));
  } else render();
}

function finishPlayer() {
  G.state = 'DEALER'; revealHole(); sfx('flip');
  const live = G.hands.some(h => !h.bust && !h.surrendered);
  render();
  if (!live) return setTimeout(() => settle(), T(700));
  setMood('think'); setTimeout(dealerStep, T(750));
}

function dealerStep() {
  if (handValue(G.dealer) < 17) {
    G.dealer.push(drawCard()); sfx('card'); render();
    setTimeout(dealerStep, T(650));
  } else settle();
}

function settleHand(h, d, dbj) {
  const p = handValue(h.cards), bet = h.bet;
  const pbj = G.hands.length === 1 && !h.split && h.cards.length === 2 && p === 21 && !h.doubled;
  let res, pay;
  if (h.surrendered) { res = 'surrender'; pay = Math.floor(bet / 2); }
  else if (pbj && dbj) { res = 'push'; pay = bet; }
  else if (pbj) { res = 'blackjack'; pay = bet + Math.floor(bet * 3 / 2); }
  else if (dbj) { res = 'dealer_bj'; pay = 0; }
  else if (p > 21) { res = 'bust'; pay = 0; }
  else if (d > 21) { res = 'dealer_bust'; pay = bet * 2; }
  else if (p > d) { res = 'win'; pay = bet * 2; }
  else if (p < d) { res = 'lose'; pay = 0; }
  else { res = 'push'; pay = bet; }
  h.res = res; h.net = pay - bet;
  return pay;
}

function settle() {
  const d = handValue(G.dealer);
  const dbj = G.dealer.length === 2 && d === 21;
  let pay = 0, staked = 0;
  for (const h of G.hands) { staked += h.bet; pay += settleHand(h, d, dbj); }
  G.chips += pay;
  const mainNet = pay - staked;
  const sideNet = G.sideResults.reduce((a, r) => a + r[1], 0) + (G.insResult || 0);
  const roundNet = mainNet + sideNet;
  // VIP cashback on a losing round
  let cash = 0;
  if (roundNet < 0) { cash = Math.floor(-roundNet * cashbackPct() / 100); G.chips += cash; }
  G.net = mainNet; G.cashback = cash;
  G.result = G.hands.length === 1 ? G.hands[0].res : 'multi';
  G.state = 'BET';
  tableClock();
  recordRound(d, dbj, roundNet, cash);
  fitBets(); save();

  let mood, line;
  if (G.hands.length === 1) {
    const res = G.hands[0].res;
    mood = { blackjack: 'happy', win: 'happy', dealer_bust: 'happy', push: 'idle', lose: 'smug',
      dealer_bj: 'smug', bust: 'sad', surrender: 'smug' }[res];
    line = res;
    if (res === 'dealer_bj' && G.ins) { mood = 'happy'; line = 'dealer_bj_insured'; }
  } else {
    const allWon = G.hands.every(h => h.net > 0);
    mood = mainNet > 0 ? 'happy' : mainNet < 0 ? 'smug' : 'idle';
    line = allWon ? 'multiwin' : mainNet > 0 ? 'win' : mainNet < 0 ? 'lose' : 'push';
  }
  setMood(mood, 4500);
  const st = G.st;
  if (st.streak >= 3 && roundNet > 0 && (st.streak === 3 || st.streak % 5 === 0)) say(pick(LINES.streak).replace('{n}', st.streak), 4500);
  else say(pick(LINES[line]), 4500);
  if (mood === 'happy') hop();
  sfx(G.result === 'blackjack' ? 'blackjack' : mainNet > 0 ? 'win' : mainNet < 0 ? 'lose' : 'push');
  render();
}

// ---------------------------------------------------------------- stats + VIP
function recordBetCount() {                           // how your bet tracked the true count (counting practice)
  const tc = trueCount();
  G.roundTC = tc;
  G.st.maxTC = Math.max(G.st.maxTC, Math.floor(tc));
  if (tc >= 2) { G.st.tcHiBet += G.bet; G.st.tcHiN++; }
  else if (tc <= 0) { G.st.tcLoBet += G.bet; G.st.tcLoN++; }
}
function recordRound(d, dbj, roundNet, cash) {
  const st = G.st, before = vipIdx();
  st.rounds++; st.hands += G.hands.length;
  st.wagered += G.roundStake; st.net += roundNet + cash; st.cashback += cash;
  st.biggestBet = Math.max(st.biggestBet, G.roundStake);
  if (roundNet > 0) st.biggestWin = Math.max(st.biggestWin, roundNet);
  if (roundNet < 0) st.biggestLoss = Math.max(st.biggestLoss, -roundNet);
  if (d > 21) st.dealerBusts++;
  if (dbj) st.dealerBJ++;
  for (const h of G.hands) {
    if (h.net > 0) st.wins++; else if (h.net < 0) st.losses++; else st.pushes++;
    if (h.res === 'blackjack') st.blackjacks++;
    if (h.res === 'bust') st.busts++;
    if (h.res === 'surrender') st.surrenders++;
    if (h.doubled) { st.doubles++; if (h.net > 0) st.doubleWins++; }
    if (h.split && h.net > 0) st.splitWins++;
    if (h.net > 0 && h.cards.length >= 5 && h.res !== 'blackjack') st.charlies++;
  }
  if (roundNet > 0 && st.streak <= -5) st.comebacks++;
  if (roundNet > 0) { st.streak = Math.max(0, st.streak) + 1; st.bestStreak = Math.max(st.bestStreak, st.streak); }
  else if (roundNet < 0) { st.streak = Math.min(0, st.streak) - 1; st.worstStreak = Math.max(st.worstStreak, -st.streak); }
  recordAnalysis(roundNet, cash);
  const after = vipIdx();
  st.vipFloor = after;                                  // tiers are for life, even if the ladder is retuned
  if (after > before) vipTierUp(before, after);
  checkAch(false, after > before ? 6800 : 1600);          // announce after her round line (or the tier-up card)
}
// the main game in units (net / starting bet), so results compare across bet sizes
function recordAnalysis(roundNet, cash) {
  const st = G.st, mainNet = G.hands.reduce((a, h) => a + h.net, 0);
  const u = Math.round(mainNet / G.handBet * 1000) / 1000;
  st.units += u;
  st.curve.push(u); if (st.curve.length > CURVE_MAX) st.curve.splice(0, st.curve.length - CURVE_MAX);
  // session
  SES.rounds++; SES.wag += G.roundStake; SES.net += roundNet + cash;
  // hand history
  G.hist.push({ n: st.rounds, t: Date.now(), d: G.dealer.map(c => c.join('')), tc: Math.round(G.roundTC * 10) / 10,
    h: G.hands.map(h => ({ c: h.cards.map(c => c.join('')), b: h.bet, r: h.res, n: h.net })),
    s: G.sideResults.reduce((a, r) => a + r[1], 0), i: G.insResult || 0, net: roundNet, cb: cash });
  if (G.hist.length > HIST_MAX) G.hist.splice(0, G.hist.length - HIST_MAX);
}
const tierReward = t => Math.max(1000 * Math.pow(t + 1, 2), Math.floor(incomePerMin() * 15));
function vipTierUp(from, to) {                         // pay every tier crossed right away; the celebration follows
  let reward = 0;
  for (let t = from + 1; t <= to; t++) { reward += tierReward(t); G.st.tierUps++; }
  G.chips += reward;
  save();
  setTimeout(() => { render(); celebrateVip(to, reward, from); }, 1100);
}

function clearTable() { G.hands = []; G.dealer = []; G.cur = 0; G.holeHidden = true; G.result = null; G.net = 0; G.sideResults = []; G.insResult = null; G.cashback = 0; }
// top-up is for an empty casino: with attractions or the auto-tipper, the floor refills you (no spend-down-and-top-up loop)
// and at most one every 10 minutes, so a free top-up can't be bet all-in over and over (a loss costs nothing)
const TOPUP_COOLDOWN = 10 * 60000;
const topupWait = () => Math.max(0, G.lastTopup + TOPUP_COOLDOWN - Date.now());
const canTopup = () => G.state === 'BET' && G.chips < MIN_BET && incomePerMin() === 0 && !G.owned.autotip && topupWait() === 0;
const mmss = ms => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function topup() {
  if (!canTopup()) return;
  G.chips = topupAmount(); fitBets(); G.st.topups++; G.lastTopup = Date.now();
  clearTable();
  save(); setMood('happy', 3000); say(pick(LINES.topup), 4000); sfx('coins'); render();
}

// ---------------------------------------------------------------- casino flow
function tick(dtMs) {                                  // passive income, accrued to whole chips
  const rate = incomePerMin();
  if (rate <= 0) return 0;
  G.frac += rate * dtMs / 60000;
  const whole = Math.floor(G.frac);
  if (whole > 0) { G.frac -= whole; G.chips += whole; G.earned += whole; G.runEarned += whole; }
  return whole;
}
function awayEarnings(ms) {                             // the floor keeps earning while she is closed, up to the cap
  const elapsed = Math.min(Math.max(0, ms), offlineCapMs());
  const earned = Math.floor(incomePerMin() * elapsed / 60000);
  if (earned > 0) { G.chips += earned; G.earned += earned; G.runEarned += earned; }
  return earned;
}
const offlineEarnings = () => G.lastSeen ? awayEarnings(Date.now() - G.lastSeen) : 0;
function greetAway(away) {
  if (away > 0) { say('While you were away the floor made +' + fmtBig(away) + ' \u2665', 6000); setMood('happy', 3000); sfx('coins'); }
}
function buyGen(id) {
  const g = GENS.find(x => x.id === id);
  if (!g || G.chips < genCost(g)) return false;
  G.chips -= genCost(g);
  const tierBefore = tierOf(G.gens[id] || 0);
  G.gens[id] = (G.gens[id] || 0) + 1; G.st.attractions++;
  const tierAfter = tierOf(G.gens[id]);
  if (tierAfter && tierAfter !== tierBefore) { save(); renderCasino(); render(); celebrateMilestone(g, tierAfter); sfx('milestone'); return true; }
  sfx('buy'); save(); setMood('happy', 2500); say(pick(LINES.buy), 3000); renderCasino(); render();
  return true;
}
function tipClick(x, y, auto, n = 1) {                  // n > 1: a batch of auto-tips credited at once
  const v = tipValue() * n;
  G.chips += v; G.earned += v; G.runEarned += v; G.tips += n;
  if (!auto && G.tips % 25 === 0) { say(pick(LINES.tip), 2500); setMood('happy', 1800); }
  if (!auto) sfx('tip');
  if (x !== undefined) {
    const f = document.createElement('div'); f.className = 'float'; f.textContent = '+' + fmtBig(v);
    f.style.left = (x - 10) + 'px'; f.style.top = (y - 24) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 900);
    const j = $('tipjar'); j.classList.remove('bump'); void j.offsetWidth; j.classList.add('bump');
  }
  if (!auto && G.tips % 10 === 0) save();
  if (!auto) { renderCasino(); render(); }
}
function buyBoost(id) {
  const b = BOOSTS.find(x => x.id === id);
  if (!b || G.boosts[id] || G.chips < b.cost) return false;
  G.chips -= b.cost; G.boosts[id] = true; sfx('milestone');
  save(); setMood('surprised', 2200); say('The whole floor just got better \u2605', 3200); renderCasino(); render();
  return true;
}
function buyTipUpgrade() {
  if (G.chips < tipCost()) return false;
  G.chips -= tipCost(); G.tipLevel++; sfx('buy');
  save(); setMood('surprised', 2000); say(pick(LINES.tipup), 3000); renderCasino(); render();
  return true;
}
// ---------------------------------------------------------------- progression visuals
const TIERS = [                                        // one tier per milestone
  { at: 10, name: 'Bronze', c: '#d8925a' }, { at: 25, name: 'Silver', c: '#c8d3e4' }, { at: 50, name: 'Gold', c: '#f5c451' },
  { at: 100, name: 'Emerald', c: '#4fd49a' }, { at: 150, name: 'Sapphire', c: '#5aa0ff' }, { at: 200, name: 'Ruby', c: '#ff5a7a' },
  { at: 300, name: 'Diamond', c: '#b9f3ff' }];
const tierOf = n => [...TIERS].reverse().find(t => n >= t.at) || null;
const RANKS_BY_STARS = [[0, 'Dealer'], [1, 'Pit boss'], [10, 'Floor manager'], [40, 'Casino owner'], [120, 'Tycoon'], [300, 'Mogul'], [600, 'Legend'], [1000, 'Myth']];
const rankOf = st => [...RANKS_BY_STARS].reverse().find(r => st >= r[0])[1];
let svgId = 0;
function starSVG(cls) {                                // gold star with a travelling glint
  const id = 'st' + (++svgId);
  return '<svg class="' + (cls || 'star') + '" viewBox="0 0 24 24"><defs>' +
    '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f7c948"/><stop offset="1" stop-color="#d98f1c"/></linearGradient>' +
    '<clipPath id="' + id + 'c"><path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8l-6.2 3.3 1.2-7L1.9 9.2l7-1z"/></clipPath></defs>' +
    '<path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8l-6.2 3.3 1.2-7L1.9 9.2l7-1z" fill="url(#' + id + 'g)" stroke="#a8650e" stroke-width=".9" stroke-linejoin="round"/>' +
    '<g clip-path="url(#' + id + 'c)"><rect class="glint" x="-14" y="-4" width="6" height="32" fill="#fff" opacity=".75" transform="rotate(25 12 12)"/></g></svg>';
}
function burst(x, y, n, colors, spread) {             // sparkle particles in window coordinates
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = (spread || 60) * (0.45 + Math.random() * 0.55);
    p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.cos(a) * d + 'px;--dy:' + Math.sin(a) * d + 'px;background:' +
      colors[i % colors.length] + ';animation-delay:' + Math.random() * 120 + 'ms';
    document.body.appendChild(p); setTimeout(() => p.remove(), 1200);
  }
}
function celebrateMilestone(g, tier) {
  const row = document.querySelector('.gen[data-id="' + g.id + '"]');
  if (row && G.tab === 'casino') {
    row.classList.remove('levelup'); void row.offsetWidth; row.classList.add('levelup');
    const r = row.querySelector('.icon').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 14, [tier.c, '#fff', tier.c]);
    const f = document.createElement('div'); f.className = 'float tierfloat'; f.style.color = tier.c;
    f.textContent = tier.name + ' \u00d72'; f.style.left = (r.right + 4) + 'px'; f.style.top = (r.top - 6) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1100);
  }
  setMood('surprised', 2200); say(tier.name + ' ' + g.name.toLowerCase() + 's! Output \u00d72 \u2605', 3200);
}
function celebrateFranchise(gain, before) {
  const ov = document.createElement('div'); ov.className = 'celebrate';
  const rankChanged = rankOf(before) !== rankOf(G.stars);
  ov.innerHTML = '<div class="rays"></div><div class="big">' + starSVG('bigstar') + '</div>' +
    '<div class="gain">+<span class="cnt">0</span></div>' +
    '<div class="sub">Location #' + (G.franchises + 1) + ' \u00b7 income \u00d7' + fmtMult(starMult()) + ' forever</div>' +
    (rankChanged ? '<div class="rank">New rank: ' + rankOf(G.stars) + '</div>' : '') +
    '<div class="tap">click to continue</div>';
  $('table').appendChild(ov);
  const cnt = ov.querySelector('.cnt'), t0 = performance.now();
  (function count(t) {                                 // count the stars up
    const k = Math.min(1, (t - t0) / 900); cnt.textContent = Math.round(gain * (1 - Math.pow(1 - k, 3))) + ' \u2605';
    if (k < 1) requestAnimationFrame(count);
  })(t0);
  const r = $('table').getBoundingClientRect();
  setTimeout(() => burst(r.left + r.width / 2, r.top + 78, 34, ['#ffd76a', '#fff1b0', '#ffffff', '#f5a623'], 150), 250);
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 300); };
  ov.onclick = close; setTimeout(close, 4200);
}

// ---------------------------------------------------------------- VIP + stats visuals
// each tier family has its own silhouette, so tiers read apart even at 16px
const GEM_SHAPES = [
  // 0 Wood: turned wooden token with grain rings
  (hi, mid, lo, g) => '<circle cx="12" cy="12" r="9.6" fill="url(#' + g + ')" stroke="' + lo + '" stroke-width="1.2"/>' +
    '<circle cx="12" cy="12" r="6.3" fill="none" stroke="' + lo + '" stroke-width=".9" opacity=".55"/><circle cx="12" cy="12" r="3" fill="none" stroke="' + lo + '" stroke-width=".9" opacity=".55"/>' +
    '<path d="M6.5 7.5a7 7 0 0 1 4-2.6" stroke="#fff" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".55"/>',
  null, null, null, null,                                  // 1-4 metals: faceted hex medal (below)
  // 5 Pearl: glossy sphere
  (hi, mid, lo, g) => '<circle cx="12" cy="12.5" r="9.2" fill="url(#' + g + 'r)" stroke="' + lo + '" stroke-width=".9"/>' +
    '<ellipse cx="9" cy="8.6" rx="3.4" ry="2.2" fill="#fff" opacity=".85" transform="rotate(-30 9 8.6)"/><circle cx="15.5" cy="16.5" r="1.3" fill="#fff" opacity=".35"/>',
  // 6 Jade: polished oval cabochon
  (hi, mid, lo, g) => '<ellipse cx="12" cy="12" rx="8.2" ry="10" fill="url(#' + g + 'r)" stroke="' + lo + '" stroke-width="1.1"/>' +
    '<ellipse cx="12" cy="12" rx="5.4" ry="7" fill="none" stroke="' + hi + '" stroke-width=".8" opacity=".6"/><path d="M8.2 7.2a5 6 0 0 1 3-3.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".8"/>',
  // 7 Sapphire: cushion octagon with a star table
  (hi, mid, lo, g) => '<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="' + mid + '" stroke="' + lo + '" stroke-width="1.1" stroke-linejoin="round"/>' +
    '<path d="M9.5 6.5h5l3 3v5l-3 3h-5l-3-3v-5z" fill="url(#' + g + ')"/><path d="M8 2 9.5 6.5M16 2l-1.5 4.5M22 8l-4.5 1.5M22 16l-4.5-1.5M16 22l-1.5-4.5M8 22l1.5-4.5M2 16l4.5-1.5M2 8l4.5 1.5" stroke="' + hi + '" stroke-width=".7" opacity=".7"/>' +
    '<path d="M10 8.5l2-1" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>',
  // 8 Ruby: heart cut
  (hi, mid, lo, g) => '<path d="M12 21.5 3.2 12.4A5.2 5.2 0 0 1 12 5.6a5.2 5.2 0 0 1 8.8 6.8z" fill="' + mid + '" stroke="' + lo + '" stroke-width="1.1" stroke-linejoin="round"/>' +
    '<path d="M12 18 6.4 12.2a3.2 3.2 0 0 1 5.6-3.1 3.2 3.2 0 0 1 5.6 3.1z" fill="url(#' + g + ')"/><path d="M6.2 8.6a2.6 2.6 0 0 1 2.4-1.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".85"/>',
  // 9 Emerald: step-cut rectangle
  (hi, mid, lo, g) => '<path d="M7.5 2h9L20 5.5v13L16.5 22h-9L4 18.5v-13z" fill="' + mid + '" stroke="' + lo + '" stroke-width="1.1" stroke-linejoin="round"/>' +
    '<path d="M9 5h6l2 2v10l-2 2H9l-2-2V7z" fill="none" stroke="' + hi + '" stroke-width=".8" opacity=".75"/><path d="M10.2 8h3.6l.9.9v6.2l-.9.9h-3.6l-.9-.9V8.9z" fill="url(#' + g + ')"/>' +
    '<path d="M10.4 9.6v2.6" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".85"/>',
  // 10 Diamond: round brilliant, side view
  (hi, mid, lo, g) => '<path d="M2.5 9 7 3.5h10L21.5 9 12 21.5z" fill="' + mid + '" stroke="' + lo + '" stroke-width="1.1" stroke-linejoin="round"/>' +
    '<path d="M2.5 9 7 3.5h10L21.5 9z" fill="url(#' + g + ')"/><path d="M2.5 9h19M7 3.5 9.5 9 12 3.5 14.5 9 17 3.5M9.5 9 12 21.5 14.5 9" fill="none" stroke="' + lo + '" stroke-width=".7" opacity=".7"/>' +
    '<path d="M8.2 5.2 7.4 7" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>',
  // 11 Obsidian: volcanic shard with a violet edge
  (hi, mid, lo, g) => '<path d="M12 1.5 19 9.5 14.5 22.5 5 15.5 6.5 6z" fill="' + lo + '" stroke="' + mid + '" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M12 1.5 13 11 19 9.5M13 11l1.5 11.5M13 11 5 15.5M13 11 6.5 6" fill="none" stroke="' + mid + '" stroke-width=".7" opacity=".8"/>' +
    '<path d="M12 1.5 6.5 6 13 11z" fill="url(#' + g + ')" opacity=".75"/>',
  // 12 Celestial: four-point star with a halo
  (hi, mid, lo, g) => '<circle cx="12" cy="12" r="10.5" fill="none" stroke="' + mid + '" stroke-width=".8" opacity=".6"/>' +
    '<path d="M12 1 14.2 9.8 23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" fill="url(#' + g + ')" stroke="' + lo + '" stroke-width=".9" stroke-linejoin="round"/>' +
    '<path d="M12 5.5 13 11l-1 1-1-1z" fill="#fff" opacity=".85"/><circle cx="18.5" cy="5.5" r="1" fill="' + hi + '"/><circle cx="5.2" cy="18.4" r=".8" fill="' + hi + '"/>',
];
const METAL = (hi, mid, lo, g, tier) => '<path d="M12 1.5 21.5 7v10L12 22.5 2.5 17V7z" fill="' + mid + '" stroke="' + lo + '" stroke-width="1.1" stroke-linejoin="round"/>' +
  '<path d="M12 1.5 21.5 7 17 9.2 12 6.4 7 9.2 2.5 7z" fill="' + hi + '" opacity=".9"/>' +
  '<path d="M2.5 17 7 14.8 12 17.6 17 14.8 21.5 17 12 22.5z" fill="' + lo + '" opacity=".75"/>' +
  '<path d="M12 6.4 17 9.2v5.6l-5 2.8-5-2.8V9.2z" fill="url(#' + g + ')"/>' +
  // 1-4 pips on the medal face: Bronze one ... Platinum four
  [[12], [10.3, 13.7], [9.2, 12, 14.8], [8.6, 10.9, 13.1, 15.4]][tier - 1].map(x => '<circle cx="' + x + '" cy="12.4" r=".95" fill="' + lo + '" opacity=".75"/>').join('') +
  '<path d="M8.4 9.6 12 7.6" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>';
function gemSVG(i, cls) {                             // the tier's badge, in its colours
  const [hi, mid, lo] = VIP[i].c, id = 'gm' + (++svgId);
  return '<svg class="gem ' + (cls || '') + (i === VIP.length - 1 ? ' celestial' : '') + '" viewBox="0 0 24 24"><defs>' +
    '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hi + '"/><stop offset="1" stop-color="' + mid + '"/></linearGradient>' +
    '<radialGradient id="' + id + 'r" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="' + hi + '"/><stop offset=".6" stop-color="' + mid + '"/><stop offset="1" stop-color="' + lo + '"/></radialGradient></defs>' +
    (GEM_SHAPES[i] ? GEM_SHAPES[i](hi, mid, lo, id) : METAL(hi, mid, lo, id, i)) + '</svg>';
}
function vipPerksText(i) {
  return 'Income & tips \u00d7' + trimZeros((1 + 0.05 * i).toFixed(2)) + ' \u00b7 Cashback ' + cashbackPct(i) + '% \u00b7 Top-up ' + fmtBig(START_CHIPS * Math.pow(i + 1, 2));
}
function renderVipBadges() {
  const i = vipIdx(), t = VIP[i], nx = VIP[i + 1], prog = vipProgress();
  const style = el => { el.style.setProperty('--v1', t.c[0]); el.style.setProperty('--v2', t.c[1]); el.style.setProperty('--v3', t.c[2]);
    el.style.setProperty('--vn', nx ? nx.c[1] : t.c[1]); el.style.setProperty('--vp', (prog * 100).toFixed(2) + '%'); };
  const tip = 'VIP ' + t.name + ' \u00b7 ' + fmtBig(G.st.wagered) + ' wagered' +
    (nx ? ' \u00b7 ' + fmtBig(nx.at - G.st.wagered) + ' more to ' + nx.name : ' \u00b7 top tier') + '\n' + vipPerksText(i);
  for (const id of ['vipchip', 'vippill']) {
    const el = $(id); style(el); el.title = tip;
    if (el.dataset.tier !== String(i)) { el.dataset.tier = i; el.querySelector('.gemslot').innerHTML = gemSVG(i); el.querySelector('.vname').textContent = t.name; }
  }
  $('vipchip').classList.toggle('active', G.tab === 'stats');
  style($('xpbar')); $('xpbar').title = tip;
}
function celebrateVip(to, reward, from) {
  const t = VIP[to], items = [];
  for (let k = (from === undefined ? to - 1 : from) + 1; k <= to; k++) items.push(...vipRewards(k));
  const shown = items.slice(0, 4), more = items.length - shown.length;
  const ov = document.createElement('div'); ov.className = 'celebrate vipcel';
  ov.style.setProperty('--v1', t.c[0]); ov.style.setProperty('--v2', t.c[1]); ov.style.setProperty('--v3', t.c[2]);
  ov.innerHTML = '<div class="rays"></div><div class="big">' + gemSVG(to, 'biggem') + '</div>' +
    '<div class="kicker">VIP tier reached</div><div class="gain">' + t.name + '</div>' +
    '<div class="sub">' + vipPerksText(to) + '</div>' +
    '<div class="rewards"><span class="rchip">+' + fmtBig(reward) + ' chips</span>' +
    shown.map(it => '<span class="rchip"><i style="--a:' + it.sw[0] + ';--b:' + it.sw[1] + '"></i>' + it.name + ' ' + it.group.toLowerCase() + '</span>').join('') +
    (more > 0 ? '<span class="rchip">+' + more + ' more unlocks</span>' : '') + '</div>' +
    '<div class="tap">click to continue</div>';
  if (!document.body.classList.contains('open')) toggle();
  $('table').appendChild(ov);
  const r = $('table').getBoundingClientRect();
  setTimeout(() => burst(r.left + r.width / 2, r.top + 60, 36, [t.c[0], t.c[1], '#ffffff', t.c[2]], 160), 250);
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 300); };
  ov.onclick = close; setTimeout(close, 6500);
  setMood('surprised', 2000); setTimeout(() => { setMood('happy', 3000); hop(); }, 900);
  say('VIP ' + t.name + '! You\'re one of my favourites \u2665', 5000);
  sfx('tierup'); drawGirl(); renderVipBadges();
}

const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '\u2014';
const dur = ms => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60; return h ? h + 'h ' + m + 'm' : m + 'm'; };
function statTiles(rows) {
  return '<div class="sgrid">' + rows.map(([k, v, cls, tip]) => '<div class="stile"' + (tip ? ' title="' + tip + '"' : '') + '><small>' + k + '</small><b class="' + (cls || '') + '">' + v + '</b></div>').join('') + '</div>';
}
const signCls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const fmtU = (u, d = 1) => (u > 0 ? '+' : u < 0 ? '\u2212' : '') + Math.abs(u).toFixed(d) + 'u';
const cardTxt = c => { const r = c.slice(0, -1), su = c.slice(-1); return '<span class="' + (RED.has(su) ? 'red' : '') + '">' + r + su + '</span>'; };
const sect = t => '<div class="sgroup">' + t + '</div>';
function sparkline(vals, fmtV, name) {                   // one series: cumulative result, zero line, hover per point
  if (vals.length < 2) return '<div class="sparkline empty">Play a few rounds to draw the chart</div>';
  const W = 400, H = 58, lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
  const x = i => i / (vals.length - 1) * W, y = v => 4 + (hi - v) / span * (H - 8);
  const pts = vals.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' '), last = vals[vals.length - 1];
  const hits = vals.map((v, i) => '<rect x="' + (x(i) - W / vals.length / 2).toFixed(1) + '" y="0" width="' + (W / vals.length).toFixed(2) + '" height="' + H + '"><title>' +
    name + ' ' + (i) + ': ' + fmtV(v) + '</title></rect>').join('');
  return '<div class="sparkline"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<line class="zero" x1="0" x2="' + W + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>' +
    '<polyline class="' + (last >= 0 ? 'up' : 'down') + '" points="' + pts + '"/><g class="hit">' + hits + '</g></svg>' +
    '<div class="sp-lab"><span>high ' + fmtV(hi) + '</span><span>low ' + fmtV(lo) + '</span><b class="' + signCls(last) + '">now ' + fmtV(last) + '</b></div></div>';
}
// ---------------------------------------------------------------- settings
const desktop = () => !!(window.buddy && window.buddy.settings);
let updateInfo = null, backupMsg = '', pendingRestore = null;
function renderSettings() {
  const info = desktop() ? window.buddy.settings() : { onTop: null, version: '', packaged: false, update: { state: 'dev' }, startup: null };
  if (!updateInfo) updateInfo = info.update || { state: 'dev' };
  const u = updateInfo;
  const sw = (id, on, off) => '<button class="switch' + (on ? ' on' : '') + '" data-set="' + id + '"' + (off ? ' disabled' : '') + ' aria-pressed="' + !!on + '"><i></i></button>';
  const seg = (id, opts, cur) => '<span class="seg">' + opts.map(([v, l]) => '<button data-set="' + id + '" data-v="' + v + '" class="' + (cur === v ? 'on' : '') + '">' + l + '</button>').join('') + '</span>';
  const row = (label, sub, ctl) => '<div class="setrow"><div class="sl"><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + ctl + '</div>';
  const upText = { dev: 'Self-updating comes with the installed version', idle: 'Checks GitHub automatically', checking: 'Checking\u2026',
    none: 'You have the latest version', downloading: 'Downloading ' + (u.version || '') + '\u2026 ' + (u.percent || 0) + '%',
    ready: 'Version ' + u.version + ' is ready to install', error: 'Couldn\u2019t check for updates' + (u.message ? ' (' + u.message + ')' : '') }[u.state] || '';
  const upBtn = u.state === 'ready' ? '<button class="sbtn primary" data-set="install">Restart to update</button>'
    : '<button class="sbtn" data-set="check"' + (!info.packaged || u.state === 'checking' || u.state === 'downloading' ? ' disabled' : '') + '>Check now</button>';
  const vol = Math.round(G.volume * 100);
  $('setBody').innerHTML =
    sect('Her') +
    row('Always on top', 'Untick for movies and fullscreen games', sw('ontop', info.onTop, !desktop())) +
    row('Hide her', 'The tray icon brings her back', '<button class="sbtn" data-set="hide"' + (desktop() ? '' : ' disabled') + '>Hide to tray</button>') +
    row('Chatter', 'How often she chats when you\u2019re idle', seg('chatter', [['normal', 'Normal'], ['quiet', 'Quiet'], ['off', 'Off']], G.chatter)) +
    (info.startup !== null ? row('Start with Windows', '', sw('startup', info.startup)) : '') +
    sect('Table') +
    row('Deal speed', 'Fast plays about twice as quickly', seg('fast', [['0', 'Normal'], ['1', 'Fast']], G.fast ? '1' : '0')) +
    row('Show the count', 'Hi-Lo running and true count', sw('count', G.countVisible)) +
    sect('Sound') +
    row('Sound', '', sw('sound', !G.muted)) +
    row('Volume', '', '<span class="vol"><input type="range" min="0" max="100" step="5" value="' + vol + '" data-set="volume"' + (G.muted ? ' disabled' : '') + '><em>' + vol + '%</em></span>') +
    sect('Updates') +
    row('Version ' + (info.version || '\u2014'), upText, upBtn) +
    sect('Backup') +
    (pendingRestore
      ? '<div class="setrow warn"><div class="sl"><b>Replace your progress?</b><small>Backup from ' + new Date(pendingRestore.lastSeen || 0).toLocaleString() + ' \u00b7 ' + fmtBig(pendingRestore.chips) + ' chips. Your current progress will be replaced.</small></div>' +
        '<span class="btns"><button class="sbtn" data-set="restore-no">Cancel</button><button class="sbtn danger" data-set="restore-yes">Restore</button></span></div>'
      : row('Save backup', backupMsg || 'A copy of your whole save, wherever you like', '<span class="btns"><button class="sbtn" data-set="export"' + (desktop() ? '' : ' disabled') + '>Save\u2026</button><button class="sbtn" data-set="import"' + (desktop() ? '' : ' disabled') + '>Restore\u2026</button></span>'));
}
async function settingsAction(el) {
  const k = el.dataset.set, v = el.dataset.v;
  if (k === 'ontop') window.buddy.setOnTop(!el.classList.contains('on'));
  else if (k === 'startup') window.buddy.setStartup(!el.classList.contains('on'));
  else if (k === 'hide') window.buddy.hideHer();
  else if (k === 'chatter') G.chatter = v;
  else if (k === 'fast') G.fast = v === '1';
  else if (k === 'count') G.countVisible = !G.countVisible;
  else if (k === 'sound') { G.muted = !G.muted; if (!G.muted) sfx('chips'); }
  else if (k === 'check') { updateInfo = { state: 'checking' }; window.buddy.checkUpdate(); }
  else if (k === 'install') { save(); window.buddy.installUpdate(); }
  else if (k === 'export') { save(); try { const path = await window.buddy.exportBackup(localStorage.getItem('blackjack-buddy') || '{}'); backupMsg = path ? 'Saved to ' + path : backupMsg; } catch (e) { backupMsg = 'Couldn\u2019t save there. Try another folder'; sfx('deny'); } }
  else if (k === 'import') {
    if (G.state !== 'BET') { backupMsg = 'Finish the hand in play first'; sfx('deny'); }
    else {
      let txt = null, d = null; try { txt = await window.buddy.importBackup(); } catch (e) { txt = '-'; }   // unreadable file: reported below
      if (txt) { try { d = JSON.parse(txt); } catch (e) { d = null; } }
      if (txt && !(d && Number.isFinite(d.chips) && d.st && typeof d.st === 'object')) { backupMsg = 'That file isn\u2019t a Blackjack Buddy backup'; sfx('deny'); }
      else if (d) pendingRestore = d;
    }
  }
  else if (k === 'restore-no') pendingRestore = null;
  else if (k === 'restore-yes' && pendingRestore && G.state !== 'BET') { pendingRestore = null; backupMsg = 'Finish the hand in play first'; sfx('deny'); }
  else if (k === 'restore-yes' && pendingRestore) {
    const d = pendingRestore; d.lastSeen = Date.now();              // restoring is not time away: no away earnings for it
    const json = JSON.stringify(d); restoring = true;
    try { window.buddy.saveSync(json); } catch (e) { /* */ } try { localStorage.setItem('blackjack-buddy', json); } catch (e) { /* */ }
    location.reload(); return;
  }
  if (k !== 'hide') sfx('click');
  save(); render(); renderSettings();
}
let statsKey = '';
function renderStats(periodic) {
  document.querySelectorAll('#statCats button').forEach(b => b.classList.toggle('active', b.dataset.cat === G.statCat));
  const box = $('statBody'), st = G.st, keep = box.scrollTop;
  const key = G.statCat + '|' + st.rounds + '|' + G.hist.length;
  if (periodic && G.statCat === 'hist' && key === statsKey) return;   // static pages: redraw only after a round
  const samePage = statsKey.split('|')[0] === G.statCat;
  statsKey = key;
  const decided = st.wins + st.losses;
  if (G.statCat === 'vip') {
    const i = vipIdx(), t = VIP[i], nx = VIP[i + 1];
    const next = nx ? vipRewards(i + 1).map(it => it.name + ' ' + it.group.toLowerCase()) : [];
    const hrs = SES.tableMs / 3600000, rate = SES.tableMs > 120000 ? SES.wag / hrs : 0, left = nx ? nx.at - st.wagered : 0;
    box.innerHTML =
      '<div class="vipcard" style="--v1:' + t.c[0] + ';--v2:' + t.c[1] + ';--v3:' + t.c[2] + ';--vn:' + (nx ? nx.c[1] : t.c[1]) + '">' + gemSVG(i, 'cardgem') +
      '<div class="vc-main"><div class="vc-top"><b>VIP ' + t.name + '</b><span>' + fmtBig(st.wagered) + (nx ? ' / ' + fmtBig(nx.at) : '') + ' wagered</span></div>' +
      '<div class="vc-bar"><i style="width:' + (vipProgress() * 100).toFixed(2) + '%"></i></div>' +
      '<div class="vc-next">' + (nx ? '<b>' + nx.name + '</b> in ' + fmtBig(left) + ' wagered' + (next.length ? ' · unlocks ' + next.join(', ') : '') : 'Top tier. The house salutes you.') + '</div></div></div>' +
      '<div class="ladder">' + VIP.map((v, k) => '<span class="rung' + (k < i ? ' got' : k === i ? ' cur' : '') + '" title="' + v.name + ' · ' + fmtBig(v.at) + ' wagered\n' + vipPerksText(k) +
        (vipRewards(k).length ? '\nUnlocks: ' + vipRewards(k).map(it => it.name + ' ' + it.group.toLowerCase()).join(', ') : '') + '">' + gemSVG(k) + '</span>').join('') + '</div>' +
      statTiles([
        ['Session net', fmtBig(SES.net, true), signCls(SES.net), 'Blackjack, side bets, insurance and cashback since launch'],
        ['Hourly', hrs > 0.03 ? fmtBig(Math.round(SES.net / hrs), true) + '/h' : '—', signCls(SES.net), 'Session net per hour at the table'],
        ['Session rounds', fmt(SES.rounds) + (hrs > 0.03 ? ' · ' + fmt(Math.round(SES.rounds / hrs)) + '/h' : '')],
        ['Wagered this session', fmtBig(SES.wag)],
        ['Next tier ETA', nx && rate ? (left / rate < 1 ? Math.max(1, Math.round(left / rate * 60)) + ' min' : (left / rate).toFixed(1) + ' h') : '—', '', 'Table time to the next tier at this session’s pace'],
        ['Total wagered', fmtBig(st.wagered)],
        ['Lifetime net', fmtBig(st.net, true), signCls(st.net), 'All rounds incl. side bets, insurance and cashback'],
        ['Win rate', pct(st.wins, decided), '', 'Wins ÷ (wins + losses), pushes excluded'],
        ['VIP perks', '\u00d7' + trimZeros(vipMult().toFixed(2)) + ' \u00b7 ' + cashbackPct() + '%', '', vipPerksText(i)]]);
  } else if (G.statCat === 'hist') {
    let cum = 0; const curve = [0].concat(st.curve.map(u => (cum += u)));
    box.innerHTML = sect('Last ' + st.curve.length + ' rounds \u00b7 running units') + sparkline(curve, v => fmtU(v, 1), 'Round') +
      '<div class="histhead">' + sect('Hand history \u00b7 newest first') + (G.hist.length ? '<button class="csv" id="csv" title="Save your last ' + G.hist.length + ' hands as a spreadsheet (CSV)">Export CSV</button>' : '') + '</div>' +
      (G.hist.length ? '<div class="hist">' + G.hist.slice(-HIST_SHOW).reverse().map(r => {
        const hands = r.h.map(h => h.c.map(cardTxt).join(' ')).join(' <i>|</i> ');
        const res = r.h.length === 1 ? RESULT_NAMES[r.h[0].r] || '' : r.h.map(h => fmtBig(h.n, true)).join(' / ');
        const tip = new Date(r.t).toLocaleString() + ' \u00b7 bet ' + r.h.map(h => fmtBig(h.b)).join(' + ') + ' \u00b7 TC ' + r.tc +
          (r.s ? ' \u00b7 side bets ' + fmtBig(r.s, true) : '') + (r.i ? ' \u00b7 insurance ' + fmtBig(r.i, true) : '') + (r.cb ? ' \u00b7 cashback +' + fmtBig(r.cb) : '');
        return '<div class="hrow" title="' + tip + '"><span class="hn">#' + fmt(r.n) + '</span><span class="hh">' + hands + '</span><span class="hd">vs ' + r.d.map(cardTxt).join(' ') +
          '</span><span class="hr">' + res + '</span><b class="' + signCls(r.net) + '">' + fmtBig(r.net, true) + '</b></div>';
      }).join('') + '</div>' : '<div class="sparkline empty">No rounds yet</div>');
  } else if (G.statCat === 'ach') {
    const n = ACH.filter(a => G.st.ach[a.id]).length;
    box.innerHTML = sect(n + ' / ' + ACH.length + ' milestones') + '<div class="achlist">' + ACH.map(a => {
      const got = G.st.ach[a.id], r = achReward(a.id), v = Math.min(a.v(), a.goal), p = got ? 1 : v / a.goal;
      return '<div class="ach' + (got ? ' got' : '') + '" title="' + a.desc + (got ? ' \u00b7 unlocked ' + new Date(got).toLocaleDateString() : '') + '">' + TROPHY +
        '<div class="am"><b>' + a.name + '</b><small>' + a.desc + '</small>' + (got ? '' : '<div class="abar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>') + '</div>' +
        '<div class="ar">' + (r ? '<span class="sw sw-' + r.slot + '-' + r.id + '" style="--a:' + r.sw[0] + ';--b:' + r.sw[1] + '"></span><small>' + r.name + '</small>' : '') +
        '<small class="ap">' + (got ? 'Unlocked' : a.goal > 1 ? fmtBig(Math.floor(v)) + ' / ' + fmtBig(a.goal) : 'Locked') + '</small></div></div>';
    }).join('') + '</div>';
  } else {
    box.innerHTML = statTiles([
      ['Lifetime earned', fmtBig(G.earned)], ['Income', fmtBig(Math.round(incomePerMin())) + '/min'], ['Highest balance', fmtBig(st.highChips)],
      ['Tips', fmt(G.tips)], ['Attractions bought', fmt(st.attractions)], ['Franchises', fmt(G.franchises)],
      ['Stars', fmt(G.stars)], ['Rank', rankOf(G.stars)], ['VIP tier-ups', fmt(st.tierUps)],
      ['Time with her', dur(st.playMs)], ['Time at the table', dur(st.tableMs)], ['Days played', fmt(st.days)],
      ['Sessions', fmt(st.sessions)], ['Top-ups', fmt(st.topups)], ['Playing since', st.since ? new Date(st.since).toLocaleDateString() : '\u2014'],
    ]);
  }
  box.scrollTop = samePage ? keep : 0;
  const csv = $('csv'); if (csv) csv.onclick = exportHistory;
}
function exportHistory() {                              // last HIST_MAX hands as CSV (opens a save dialog)
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['round', 'time', 'true count', 'your cards', 'dealer cards', 'results', 'bets', 'main net', 'side bets', 'insurance', 'cashback', 'round net']];
  for (const r of G.hist) {
    const main = r.h.reduce((a, h) => a + h.n, 0);
    rows.push([r.n, new Date(r.t).toISOString(), r.tc, r.h.map(h => h.c.join(' ')).join(' | '), r.d.join(' '), r.h.map(h => h.r).join(' | '),
      r.h.map(h => h.b).join(' | '), main, r.s, r.i, r.cb, r.net]);
  }
  const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(x => x.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = 'blackjack-buddy-hands-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); sfx('click');
}

// ---------------------------------------------------------------- franchise (prestige)
let franchiseArmed = 0;
function franchise(confirmed) {
  const gain = starsAvailable();
  if (gain < 1 || G.state !== 'BET') return false;
  if (!confirmed && Date.now() - franchiseArmed > 4000) {             // first click arms it, second click within 4s confirms
    franchiseArmed = Date.now(); sfx('arm'); renderCasino(); setTimeout(renderCasino, 4100); return false;
  }
  franchiseArmed = 0;
  const starsBefore = G.stars;
  G.stars += gain; G.franchises++;
  G.chips = START_CHIPS * Math.pow(10, su('headstart')); G.gens = {}; G.boosts = {}; G.tipLevel = 0; G.frac = 0; G.runEarned = 0;
  BOOSTS.slice(0, su('keepboosts')).forEach(b => { G.boosts[b.id] = true; });
  clearTable(); G.betWant = 50; G.ppWant = 0; G.tpWant = 0; fitBets();
  save(); setMood('happy', 4000); hop(); celebrateFranchise(gain, starsBefore); sfx('tierup');
  say('New location! +' + gain + ' \u2605 \u2014 income \u00d7' + fmtMult(starMult()), 6000);
  renderCasino(); render();
  checkAch(false, 3000);
  return gain;
}

// ---------------------------------------------------------------- shop
const perkById = id => SHOP.perks.find(p => p.id === id);
function shopItem(slot, id) {
  for (const cat of ['dealer', 'cards', 'table']) for (const grp of SHOP[cat]) if (grp.slot === slot) return grp.items.find(i => i.id === id);
  return null;
}
const ownsItem = (slot, id) => { const it = shopItem(slot, id); return !!it && (it.vip !== undefined ? vipIdx() >= it.vip : it.ms ? !!G.st.ach[it.ms] : it.cost === 0 || !!G.owned[slot + ':' + id]); };
const vipRewards = i => { const out = []; for (const cat of ['dealer', 'cards', 'table']) for (const grp of SHOP[cat]) for (const it of grp.items) if (it.vip === i) out.push({ slot: grp.slot, group: grp.group, ...it }); return out; };
function buyPerk(id) {
  const p = perkById(id);
  if (!p || G.owned[id] || (p.needs && !G.owned[p.needs]) || G.chips < p.cost) return false;
  G.chips -= p.cost; G.owned[id] = true; sfx('buy');
  save(); setMood('happy', 2500); say(p.name + ' hired \u2665', 3000); renderShop(); render();
  return true;
}
function buyOrEquip(slot, id) {
  const it = shopItem(slot, id);
  if (!it) return false;
  let bought = false;
  if (!ownsItem(slot, id)) {
    bought = true;
    if (it.vip !== undefined || it.ms || G.chips < it.cost) { sfx('deny'); return false; }
    G.chips -= it.cost; G.owned[slot + ':' + id] = true; sfx('buy');
    setMood('happy', 2500); say(slot === 'back' || slot === 'felt' ? 'Ooh, fancy~' : 'Do I look cute? \u2665', 3000);
  }
  if (!bought && G.equip[slot] !== id) sfx('equip');
  G.equip[slot] = id;
  applyCosmetics(); save(); renderShop(); render();
  return true;
}
let preview = null;                                   // hovering a dealer item tries it on
function applyCosmetics() {
  document.body.dataset.back = G.equip.back;
  document.body.dataset.felt = G.equip.felt;
  if (typeof drawGirl === 'function') drawGirl();
}
let lastShopChips = -1;
function refreshShopAffordability() {                  // re-render only when affordability could have changed
  if (Math.floor(Math.log10(G.chips + 1) * 20) !== lastShopChips) { lastShopChips = Math.floor(Math.log10(G.chips + 1) * 20); renderShop(); }
}
function buyStarUp(id) {
  const u = STAR_UPS.find(x => x.id === id), l = su(id);
  if (!u || l >= u.costs.length || banked() < u.costs[l]) { sfx('deny'); return false; }
  G.starsSpent += u.costs[l]; G.su[id] = l + 1;
  sfx('star'); setMood('surprised', 2000); say(u.name + ' ' + (l + 1) + '! \u2605', 3000);
  const row = document.querySelector('.starup[data-id="' + id + '"]');
  if (row) { const r = row.getBoundingClientRect(); burst(r.right - 50, r.top + r.height / 2, 14, ['#ffd76a', '#fff1b0', '#ffffff']); }
  save(); renderShop(); render(); renderCasino();
  return true;
}
function renderStarShop(box) {
  const head = document.createElement('div'); head.className = 'starhead';
  head.innerHTML = starSVG('bigmini') + '<div class="sh-main"><b>' + fmt(banked()) + ' banked</b><small>Banked stars add +' + (25 + 5 * su('starpower')) +
    '% income each (now \u00d7' + fmtBig(starMult()) + '). Spent stars stop adding income, but upgrades are permanent.</small></div>' +
    '<span class="sh-spent">' + fmt(G.starsSpent) + ' spent</span>';
  box.appendChild(head);
  for (const u of STAR_UPS) {
    const l = su(u.id), max = l >= u.costs.length, cost = max ? 0 : u.costs[l], can = !max && banked() >= cost;
    const row = document.createElement('div'); row.className = 'perk starup' + (max ? ' owned' : ''); row.dataset.id = u.id;
    row.innerHTML = '<div class="pinfo"><b>' + u.name + '<span class="lv">' + u.costs.map((c, i) => '<i class="' + (i < l ? 'on' : '') + '"></i>').join('') + '</span></b>' +
      '<small>' + (max ? u.fx(l) : (l ? 'Next: ' : '') + '<em>' + u.fx(l + 1) + '</em>') + '</small></div>';
    row.title = 'Now: ' + u.fx(l) + (max ? '' : '\nNext: ' + u.fx(l + 1));
    const b = document.createElement('button'); b.className = 'buy' + (can ? ' can' : '');
    b.innerHTML = max ? 'Maxed' : '<span class="cost">' + fmt(cost) + '</span>' + starSVG('mini');
    b.disabled = !can;
    b.title = max ? 'Fully upgraded' : 'Spending ' + cost + ' stars lowers income by ' + fmtBig(Math.round(cost * starBonus() * 100)) + ' percentage points';
    b.onclick = () => buyStarUp(u.id);
    row.appendChild(b); box.appendChild(row);
  }
}
function renderShop() {
  document.querySelectorAll('#shopCats button').forEach(b => b.classList.toggle('active', b.dataset.cat === G.shopCat));
  const box = $('shopItems');
  box.innerHTML = '';
  if (G.shopCat === 'stars') { renderStarShop(box); return; }
  if (G.shopCat === 'perks') {
    for (const p of SHOP.perks) {
      const owned = !!G.owned[p.id], locked = p.needs && !G.owned[p.needs];
      const row = document.createElement('div'); row.className = 'perk' + (owned ? ' owned' : '') + (locked ? ' locked' : '');
      row.innerHTML = '<div class="pinfo"><b>' + p.name + '</b><small>' + (locked ? 'Needs ' + perkById(p.needs).name : p.desc) + '</small></div>';
      const b = document.createElement('button'); b.className = 'buy' + (!owned && !locked && G.chips >= p.cost ? ' can' : '');
      b.innerHTML = owned ? 'Owned' : '<span class="cost">' + fmtBig(p.cost) + '</span>';
      b.disabled = owned || locked || G.chips < p.cost;
      b.onclick = () => buyPerk(p.id);
      row.appendChild(b); box.appendChild(row);
    }
    return;
  }
  for (const grp of SHOP[G.shopCat]) {
    const h = document.createElement('div'); h.className = 'sgroup'; h.textContent = grp.group; box.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'tiles'; box.appendChild(grid);
    for (const it of grp.items) {
      const owned = ownsItem(grp.slot, it.id), on = G.equip[grp.slot] === it.id;
      const t = document.createElement('button');
      const vip = it.vip !== undefined, ms = it.ms ? ACH.find(a => a.id === it.ms) : null, locked = vip || !!ms;
      t.className = 'tile' + (on ? ' on' : '') + (owned ? ' owned' : locked ? ' vip' : G.chips >= it.cost ? ' can' : ' poor') + (locked ? ' vipitem' : '');
      if (locked) t.style.setProperty('--vip', vip ? VIP[it.vip].c[1] : '#ffd76a');
      t.innerHTML = '<span class="sw sw-' + grp.slot + '-' + it.id + '" style="--a:' + it.sw[0] + ';--b:' + it.sw[1] + '"></span>' +
        '<span class="tname">' + it.name + '</span><span class="tstate">' + (on ? 'Equipped' : owned ? 'Equip' :
          vip ? gemSVG(it.vip, 'tgem') + VIP[it.vip].name : ms ? TROPHY + 'Milestone' : fmtBig(it.cost)) + '</span>';
      if (vip && !owned) t.title = 'VIP exclusive: unlocks at ' + VIP[it.vip].name + ' (' + fmtBig(VIP[it.vip].at) + ' wagered)';
      if (ms && !owned) t.title = 'Milestone reward: ' + ms.name + ' \u2014 ' + ms.desc;
      t.disabled = !owned && (locked ? G.shopCat !== 'dealer' : G.chips < it.cost);
      t.onclick = () => buyOrEquip(grp.slot, it.id);
      if (G.shopCat === 'dealer') {
        t.onmouseenter = () => { preview = { slot: grp.slot, id: it.id }; drawGirl(); };
        t.onmouseleave = () => { preview = null; drawGirl(); };
      }
      grid.appendChild(t);
    }
  }
}

function setTab(tab) {
  if (tab !== 'settings') pendingRestore = null;
  G.tab = tab;
  document.body.dataset.tab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  if (preview) { preview = null; drawGirl(); }
  renderCasino();
  if (tab === 'shop') renderShop();
  if (tab === 'stats') renderStats();
  if (tab === 'settings') { backupMsg = ''; renderSettings(); }
  $('btn-settings').classList.toggle('active', tab === 'settings');
  renderVipBadges();
}
function renderCasino() {
  $('tipval').textContent = '+' + fmtBig(tipValue());
  $('tipcost').textContent = fmtBig(tipCost());
  $('tipup').disabled = G.chips < tipCost();
  $('tipstat').textContent = fmt(G.tips) + (G.tips === 1 ? ' tip' : ' tips');
  $('incomestat').textContent = '+' + fmtBig(Math.round(incomePerMin())) + ' / min';

  // boosts: only the next unowned one is offered, so the list stays short
  const bbox = $('boosts');
  if (!bbox.children.length) for (const b of BOOSTS) {
    const el = document.createElement('button'); el.className = 'boost'; el.dataset.id = b.id;
    el.onclick = () => buyBoost(b.id); bbox.appendChild(el);
  }
  // only the next boost is offered; the ones you own are summarised in the footer line
  const nextBoost = BOOSTS.find(b => !G.boosts[b.id]);
  for (const b of BOOSTS) {
    const el = bbox.querySelector('[data-id="' + b.id + '"]');
    el.style.display = b === nextBoost ? '' : 'none';
    if (b !== nextBoost) continue;
    el.className = 'boost' + (G.chips >= b.cost ? ' can' : '');
    el.innerHTML = '<span class="pips">' + BOOSTS.map(x => '<i class="' + (G.boosts[x.id] ? 'on' : '') + '"></i>').join('') + '</span>' +
      '<span class="bn">' + b.name + ' <em>\u00d7' + b.mult + '</em></span><b>' + fmtBig(b.cost) + '</b>';
    el.title = b.desc;
    el.disabled = G.chips < b.cost;
  }
  const owned = BOOSTS.filter(b => G.boosts[b.id]);
  if (!nextBoost) {                                      // all boosts owned: show the complete medal set
    const el = bbox.querySelector('[data-id="' + BOOSTS[BOOSTS.length - 1].id + '"]');
    el.style.display = ''; el.disabled = true; el.className = 'boost done';
    el.innerHTML = '<span class="pips">' + BOOSTS.map(() => '<i class="on"></i>').join('') + '</span><span class="bn">All boosts</span><b>\u00d7' + fmtBig(boostMult()) + '</b>';
  }
  const mult = boostMult();
  $('lifetime').innerHTML = (owned.length ? '<span style="color:var(--good)">Boosts \u00d7' + mult + '</span>  \u00b7  ' : '') +
    'This run ' + fmtBig(Math.floor(G.runEarned));
  // franchise: disabled until this run has earned at least one star
  const fb = $('franchise'), gain = starsAvailable();
  const nextAt = runForStars(gain + 1);
  const armed = Date.now() - franchiseArmed < 4000;
  fb.disabled = gain < 1 || G.state !== 'BET';
  fb.classList.toggle('ready', gain >= 1); fb.classList.toggle('armed', armed && gain >= 1);
  const exact = starsExact(G.runEarned);                  // progress toward the next star
  const frac = gain < 1 ? Math.min(1, G.runEarned / 1e6) : exact - gain;
  fb.innerHTML = '<i class="fill" style="width:' + (frac * 100).toFixed(1) + '%"></i>' + (armed ? '<i class="timer"></i>' : '') +
    (gain < 1 ? '<span>Franchise</span><small>' + fmtBig(Math.floor(G.runEarned)) + ' / 1M</small>'
      : armed ? '<span>Click again to sell</span><b>+' + gain + starSVG('mini') + '</b>'
      : '<span>Franchise</span><b>+' + gain + starSVG('mini') + '</b>');
  fb.title = 'This run: ' + fmtBig(Math.floor(G.runEarned)) + ' earned. ' + (gain < 1 ? 'Earn 1M on the floor this run to franchise.' :
    'Sell this casino and start over with +' + gain + ' stars (+' + Math.round(gain * starBonus() * 100) + '% income while banked). Next star at ' + fmtBig(nextAt) + '.');

  const box = $('gens');
  if (!box.children.length) {
    for (const g of GENS) {
      const row = document.createElement('div'); row.className = 'gen'; row.dataset.id = g.id;
      row.innerHTML = '<span class="icon">' + g.icon + '</span>' +
        '<span class="info"><span class="top"><span class="name">' + g.name + '</span><span class="owned"></span></span>' +
        '<span class="sub"></span><span class="bar2"><i></i></span></span>' +
        '<button class="buy"></button>';
      row.querySelector('.buy').onclick = () => buyGen(g.id);
      box.appendChild(row);
    }
  }
  for (const g of GENS) {
    const row = box.querySelector('[data-id="' + g.id + '"]'), n = G.gens[g.id] || 0, cost = genCost(g);
    row.classList.toggle('locked', n === 0 && G.chips < cost);
    const tier = tierOf(n), nextTier = TIERS.find(t => t.at > n);
    row.dataset.tier = tier ? tier.name.toLowerCase() : '';
    row.style.setProperty('--tier', tier ? tier.c : 'transparent');
    row.style.setProperty('--next', nextTier ? nextTier.c : tier.c);
    row.querySelector('.icon').title = tier ? tier.name + ' tier \u00b7 output \u00d7' + milestoneMult(n) : 'No tier yet';
    row.querySelector('.owned').textContent = n ? '\u00d7' + n : '';
    const next = MILESTONES.find(m => m > n), prev = [...MILESTONES].reverse().find(m => m <= n) || 0;
    const sub = row.querySelector('.sub');
    sub.innerHTML = n
      ? '<span class="y">+' + fmtBig(Math.round(genRate(g) * mult * starMult())) + '/min</span>' + (next ? '  \u00b7  ' + TIERS.find(t => t.at === next).name + ' at ' + next : '  \u00b7  Diamond')
      : '+' + fmtBig(Math.round(g.rate * mult * starMult())) + '/min each';
    row.querySelector('.bar2 i').style.width = next ? Math.round((n - prev) / (next - prev) * 100) + '%' : '100%';
    row.querySelector('.bar2').style.visibility = n ? 'visible' : 'hidden';
    const b = row.querySelector('.buy');
    b.innerHTML = '<span class="cost">' + fmtBig(cost) + '</span>';
    b.disabled = G.chips < cost; b.classList.toggle('can', G.chips >= cost);
  }
}


// ---------------------------------------------------------------- the sprite
const SPRITES = {}, FACES = ['idle', 'blink', 'happy', 'sad', 'smug', 'surprised', 'think'];
let baseAlpha = null, blinking = false;
const gctx = $('girl').getContext('2d'), hctx = $('hands').getContext('2d');
gctx.imageSmoothingEnabled = false; hctx.imageSmoothingEnabled = false;
function loadSprite(name, file) {
  return new Promise(res => { const im = new Image(); im.onload = () => { SPRITES[name] = im; res(); }; im.onerror = res; im.src = 'sprites/' + file; });
}
const ACCS = ['flower', 'glasses', 'catears', 'tiara', 'stars', 'bow', 'beret', 'sunglasses', 'headphones', 'santa', 'crown', 'halo'];
Promise.all([loadSprite('base', 'base.png'), loadSprite('hands', 'hands.png')].concat(ACCS.map(a => loadSprite('acc_' + a, 'acc_' + a + '.png')))
  .concat(FACES.map(f => loadSprite('face_' + f, 'face_' + f + '.png')))).then(() => {
  const c = document.createElement('canvas'); c.width = 48; c.height = 64;
  const cx = c.getContext('2d'); cx.drawImage(SPRITES.base, 0, 0);
  baseAlpha = cx.getImageData(0, 0, 48, 64).data;
  drawGirl();
});
const baseCache = {};
function recolor(img, maps) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    for (const [src, dst] of maps) {
      const k = src.findIndex(c3 => c3[0] === d[i] && c3[1] === d[i + 1] && c3[2] === d[i + 2]);
      if (k >= 0) { if (dst[k][0] < 0) d[i + 3] = 0; else { d[i] = dst[k][0]; d[i + 1] = dst[k][1]; d[i + 2] = dst[k][2]; } break; }
    }
  }
  return img;
}
function outfitMaps(outfit) {
  const o = OUTFITS[outfit] || {}, maps = [];
  if (o.vest) maps.push([VEST_SRC, o.vest]);
  if (o.shirt) maps.push([SHIRT_SRC, o.shirt]);
  if (o.tie) maps.push([TIE_SRC, o.tie]);
  return maps;
}
function recoloredBase(ribbon, outfit) {                 // swap ribbon, vest, shirt and tie palettes on the base sprite
  const key = ribbon + '|' + outfit;
  if (baseCache[key]) return baseCache[key];
  const c = document.createElement('canvas'); c.width = 48; c.height = 64;
  const cx = c.getContext('2d'); cx.drawImage(SPRITES.base, 0, 0);
  const maps = outfitMaps(outfit);
  if (RIBBONS[ribbon]) maps.unshift([RIBBON_SRC, RIBBONS[ribbon]]);
  cx.putImageData(recolor(cx.getImageData(0, 0, 48, 64), maps), 0, 0);
  return (baseCache[key] = c);
}
let handsKey = '';
function drawHands(outfit) {                           // her cuffs follow the shirt colour
  if (!SPRITES.hands || handsKey === outfit) return;
  handsKey = outfit;
  hctx.clearRect(0, 0, 32, 10); hctx.drawImage(SPRITES.hands, 0, 0);
  hctx.putImageData(recolor(hctx.getImageData(0, 0, 32, 10), outfitMaps(outfit)), 0, 0);
}
function drawGirl() {
  if (!SPRITES.base) return;
  const mood = document.body.dataset.mood || 'idle';
  const face = blinking && (mood === 'idle' || mood === 'think') ? 'blink' : (FACES.includes(mood) ? mood : 'idle');
  const look = { ...G.equip }; if (preview) look[preview.slot] = preview.id;
  const ribbon = HIDES_RIBBON.has(look.acc) ? 'hidden' : look.ribbon;
  gctx.clearRect(0, 0, 48, 64);
  gctx.drawImage(recoloredBase(ribbon, look.outfit), 0, 0);
  if (SPRITES['face_' + face]) gctx.drawImage(SPRITES['face_' + face], 0, 0);
  if (look.acc !== 'none' && SPRITES['acc_' + look.acc]) gctx.drawImage(SPRITES['acc_' + look.acc], 0, 0);
  // VIP name-tag pin on her vest, in the tier's colours
  const v = VIP[vipIdx()].c;
  gctx.fillStyle = v[2]; gctx.fillRect(28, 49, 3, 3);
  gctx.fillStyle = v[1]; gctx.fillRect(28, 49, 3, 2);
  gctx.fillStyle = v[0]; gctx.fillRect(28, 49, 1, 1);
  drawHands(look.outfit);
}
function girlOpaque(clientX, clientY) {           // is this point on one of her painted pixels?
  if (!baseAlpha) return true;
  const r = $('girl').getBoundingClientRect();
  const x = Math.floor((clientX - r.left) / r.width * 48), y = Math.floor((clientY - r.top) / r.height * 64);
  if (x < 0 || y < 0 || x >= 48 || y >= 64) return false;
  return baseAlpha[(y * 48 + x) * 4 + 3] > 0;
}

// ---------------------------------------------------------------- mascot
let moodToken = 0, bubbleToken = 0;
function setMood(mood, ms) {
  document.body.dataset.mood = mood;
  drawGirl();
  const tok = ++moodToken;
  if (ms) setTimeout(() => { if (tok === moodToken) { document.body.dataset.mood = 'idle'; drawGirl(); } }, ms);
}
function say(text, ms = 4000, quiet) {
  const b = $('bubble');
  b.textContent = text;
  b.classList.remove('show');
  void b.offsetWidth;                                  // restart the pop animation
  b.classList.add('show'); if (!quiet) sfx('pop');
  const tok = ++bubbleToken;
  setTimeout(() => { if (tok === bubbleToken) b.classList.remove('show'); }, ms);
}
function hush() { bubbleToken++; $('bubble').classList.remove('show'); }   // take down a question that has been answered
function hop() {
  const g = $('girl');
  g.classList.remove('hop'); void g.offsetWidth; g.classList.add('hop');
}
function blinkLoop() {
  const m = document.body.dataset.mood;
  if (m === 'idle' || m === 'think') {
    blinking = true; drawGirl();
    setTimeout(() => { blinking = false; drawGirl(); }, 130);
  }
  setTimeout(blinkLoop, 2500 + Math.random() * 2700);
}
function chatterLoop() {
  if (G.chatter !== 'off' && G.state === 'BET' && !$('bubble').classList.contains('show') && document.body.dataset.mood === 'idle') {
    say(pick(LINES.idle), 4500, true);
  }
  const often = G.chatter === 'normal' && document.body.classList.contains('open');   // Quiet: always the slow pace
  setTimeout(chatterLoop, often ? 30000 + Math.random() * 25000 : 120000 + Math.random() * 120000);
}

// ---------------------------------------------------------------- rendering
function cardEl(card, hidden) {
  const el = document.createElement('div');
  el.className = 'card deal' + (RED.has(card[1]) ? ' red' : '') + (hidden ? ' hidden' : '');
  const idx = '<span class="idx tl">' + card[0] + '<small>' + card[1] + '</small></span>';
  el.innerHTML = '<div class="inner"><div class="face front">' + idx + '<span class="pip">' + card[1] + '</span>' +
    idx.replace('idx tl', 'idx br') + '</div><div class="face back"></div></div>';
  return el;
}

function renderHand(container, cards, hideSecond) {
  // rebuild if any card on screen no longer matches the hand (new deal, etc.)
  const kids = [...container.children];
  if (kids.some((el, i) => i < cards.length && el.dataset.card !== cards[i].join(''))) container.innerHTML = '';
  else kids.slice(cards.length).forEach(el => el.remove());   // a split takes a card away: keep the rest where they are (no re-deal animation)
  for (let i = container.children.length; i < cards.length; i++) {
    const el = cardEl(cards[i], hideSecond && i === 1); el.dataset.card = cards[i].join(''); container.appendChild(el);
  }
  if (cards.length > 1) container.children[1].classList.toggle('hidden', !!hideSecond);
}

function renderPlayer() {                            // one group per hand; split hands sit side by side
  const box = $('phand');
  while (box.children.length > G.hands.length) box.lastChild.remove();
  while (box.children.length < G.hands.length) {
    const g = document.createElement('div'); g.className = 'hgroup';
    g.innerHTML = '<div class="hc"></div><span class="htag"></span>'; box.appendChild(g);
  }
  const multi = G.hands.length > 1;
  G.hands.forEach((h, i) => {
    const g = box.children[i];
    renderHand(g.querySelector('.hc'), h.cards, false);
    g.classList.toggle('active', multi && G.state === 'PLAYER' && i === G.cur);
    g.classList.toggle('waiting', multi && G.state === 'PLAYER' && i !== G.cur);
    g.dataset.n = h.cards.length;
    const tag = g.querySelector('.htag');
    if (!multi) { tag.textContent = ''; tag.className = 'htag'; return; }
    if (h.res) { tag.textContent = h.res === 'bust' ? 'Bust' : fmtShort(h.net, true); tag.className = 'htag ' + (h.net > 0 ? 'win' : h.net < 0 ? 'lose' : 'push'); }
    else { tag.textContent = h.cards.length ? totalText(h.cards) + (h.doubled ? ' \u00d72' : '') : ''; tag.className = 'htag' + (h.bust ? ' lose' : ''); }
  });
}

function setValue(id, v) {
  const el = $(id), txt = fmtBig(v);
  el.textContent = txt;
  el.classList.toggle('long', txt.length > 5);
}

function render() {
  if (mustCommit) save();                              // every card draw is followed by a render in the same task: commit first
  const inHand = G.state !== 'BET', betOk = G.state === 'BET';
  if (betOk) fitBets();                                // chips spent in the casino or shop: trim the bet so Deal still works
  const broke = G.chips < MIN_BET && !inHand, topOk = canTopup();
  $('chips').textContent = fmtBig(G.chips);
  if (G.chips > G.st.highChips) G.st.highChips = G.chips;
  $('rate').textContent = incomePerMin() > 0 ? '+' + fmtBig(Math.round(incomePerMin())) + '/min' : '';
  $('rate').title = 'Boosts \u00d7' + fmtBig(boostMult()) + ' \u00b7 Stars \u00d7' + fmtMult(starMult()) + ' \u00b7 VIP \u00d7' + trimZeros(vipMult().toFixed(2));
  const sb = $('stars');
  if (G.stars) {
    if (sb.dataset.n !== String(G.stars) + '/' + banked()) {
      const grew = sb.dataset.n && +sb.dataset.n.split('/')[0] < G.stars;
      sb.innerHTML = starSVG() + '<b>' + fmtBig(banked()) + '</b>'; sb.dataset.n = G.stars + '/' + banked();
      if (grew) { sb.classList.remove('pop'); void sb.offsetWidth; sb.classList.add('pop'); }
    }
    sb.title = rankOf(G.stars) + ' \u00b7 ' + fmt(G.stars) + ' stars earned, ' + fmt(banked()) + ' banked \u00b7 +' + fmtBig(Math.round(banked() * starBonus() * 100)) + '% income and tips' +
      (G.starsSpent ? ' \u00b7 ' + fmt(G.starsSpent) + ' spent in the Star shop' : '') +
      (G.franchises ? ' \u00b7 location #' + (G.franchises + 1) : '');
  } else { sb.innerHTML = ''; sb.dataset.n = ''; }
  setValue('v-bet', inHand ? G.handBet : G.bet);
  if (broke) $('v-bet').textContent = '\u2014';
  setValue('v-pp', G.pp); setValue('v-tp', G.tp);

  const betCap = floorTo(G.chips - G.pp - G.tp, STEP);
  const ppCap = floorTo(G.chips - G.bet - G.tp, SIDE_STEP);
  const tpCap = floorTo(G.chips - G.bet - G.pp, SIDE_STEP);
  const en = {
    betdown: betOk && G.bet > MIN_BET, betup: betOk && G.bet < betCap,
    ppdown: betOk && G.pp > 0, ppup: betOk && G.pp < ppCap,
    tpdown: betOk && G.tp > 0, tpup: betOk && G.tp < tpCap,
  };
  document.querySelectorAll('[data-step]').forEach(b => { b.disabled = !en[b.dataset.step]; });

  // side-bet and insurance outcomes sit next to the bet they belong to
  const delta = (id, v) => { const el = $(id), t = v === null ? '' : fmtBig(v, true); el.textContent = t; el.title = t; el.className = 'delta ' + (v > 0 ? 'pos' : 'neg') + (t.length > 5 ? ' long' : ''); };
  const side = name => { const r = G.sideResults.find(x => x[0] === name); return r ? r[1] : null; };
  delta('d-pp', side('Pairs')); delta('d-tp', side('21+3'));
  delta('d-bet', G.result ? G.net : null);
  const hitNames = G.sideResults.filter(r => r[1] > 0).map(r => r[2]);
  $('sideres').textContent = hitNames.length ? hitNames.join(' \u00b7 ') + '!' : '';
  const ir = $('insrow');
  ir.textContent = G.insResult !== null ? 'Insurance ' + fmtBig(G.insResult, true) : '';
  ir.classList.toggle('won', (G.insResult || 0) > 0);

  // count pill
  const cp = $('count');
  cp.classList.toggle('off', !G.countVisible);
  if (G.countVisible) {
    const rc = runningCount(), tc = trueCount();
    const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
    cp.innerHTML = '<span><span class="k">RC</span><span class="v ' + cls(rc) + '">' + fmt(rc, true) + '</span></span>' +
      '<span class="sep"></span><span><span class="k">TC</span><span class="v ' + cls(Math.round(tc * 10)) + '">' +
      (tc > 0 ? '+' : '') + tc.toFixed(1) + '</span></span>' +
      '';
  } else cp.innerHTML = '<span class="k">COUNT HIDDEN</span>';

  // stage
  $('dval').textContent = G.dealer.length ? totalText(G.holeHidden ? G.dealer.slice(0, 1) : G.dealer) : '';
  const multi = G.hands.length > 1, settled = G.state === 'BET' && !!G.result;
  document.querySelector('.cards').classList.toggle('multi', multi);
  $('pwho').textContent = multi ? (settled ? 'Total' : 'Hand ' + (G.cur + 1) + '/' + G.hands.length) : 'You';
  const pv = $('pval');
  if (multi && settled) { pv.textContent = fmtShort(G.net, true); pv.className = 'sm ' + signCls(G.net); }
  else { pv.textContent = G.hands.length && hand() && hand().cards.length ? totalText(hand().cards) : ''; pv.className = ''; }
  const shoe = $('shoe');
  shoe.textContent = G.shufflePending ? 'Cut card out' : decksLeft().toFixed(1) + ' decks left';
  shoe.title = G.shoe.length + ' cards in the shoe';
  shoe.classList.toggle('cut', G.shufflePending);
  const r = $('result');
  if (G.result && !multi) {
    r.textContent = RESULT_NAMES[G.result] + '  ' + fmtBig(G.net, true);
    r.className = 'result ' + (G.net > 0 ? 'win' : G.net < 0 ? 'lose' : 'push');
  } else { r.textContent = ''; r.className = 'result'; }
  renderHand($('dhand'), G.dealer, G.holeHidden);
  renderPlayer();
  $('hint').style.display = (G.hands.length || G.dealer.length) ? 'none' : '';
  $('cashrow').textContent = G.result && G.cashback ? 'VIP cashback +' + fmtBig(G.cashback) : '';

  // action bar: one context at a time
  document.body.dataset.phase = G.state === 'BET' ? 'bet' : G.state === 'INSURANCE' ? 'ins' : 'play';
  const deal = $('btn-deal');
  const wait = broke && !topOk && incomePerMin() === 0 && !G.owned.autotip ? topupWait() : 0;
  deal.textContent = broke ? (topOk ? 'Top up ' + fmtBig(topupAmount()) + ' chips' : wait ? 'Top-up in ' + mmss(wait) + ' \u00b7 tip jar \u2192' : 'Out of chips \u00b7 tip jar \u2192') : 'Deal  \u00b7  ' + fmtBig(totalStake());
  deal.title = broke && !topOk ? 'Your casino refills you: ' + (incomePerMin() > 0 ? '+' + fmtBig(Math.round(incomePerMin())) + '/min, ' : '') + 'or click the tip jar' : 'Deal (Space)';
  document.querySelectorAll('[data-q]').forEach(b => { b.disabled = !betOk || broke; });
  deal.disabled = !(broke || canDeal());
  $('btn-hit').disabled = !canAct();
  $('btn-stand').disabled = !canAct();
  $('btn-double').disabled = !canDouble();
  $('btn-split').disabled = !canSplit();
  $('btn-surrender').disabled = !canSurrender();
  renderVipBadges();
  $('mute').classList.toggle('off', G.muted);
  $('ins-cost').textContent = fmtBig(Math.floor(G.handBet / 2));
  $('ins-yes').disabled = G.chips < Math.floor(G.handBet / 2);
}

// ---------------------------------------------------------------- input
function toggle() { document.body.classList.toggle('open'); sfx(document.body.classList.contains('open') ? 'open' : 'close'); }

// steppers fire on press and repeat while held
let repeatTimer = null;
function stepAction(name, mult = 1) {
  const up = name.endsWith('up');
  if (name.startsWith('bet')) adjustBet((up ? 1 : -1) * STEP * mult);
  else adjustSide(name.slice(0, 2), (up ? 1 : -1) * SIDE_STEP * mult);
}
document.querySelectorAll('[data-step]').forEach(b => {
  b.addEventListener('pointerdown', e => {
    if (e.button !== 0 || b.disabled) return;
    e.preventDefault();
    stepAction(b.dataset.step, e.shiftKey ? 10 : 1); sfx('tick');
    clearTimeout(repeatTimer);
    const t0 = Date.now();
    const loop = () => {                                     // speeds up the longer you hold
      if (b.disabled) return;
      const held = Date.now() - t0;
      stepAction(b.dataset.step, held > 3000 ? 100 : held > 1200 ? 10 : 1);
      if (Date.now() - lastTickSfx > 90) { lastTickSfx = Date.now(); sfx('tick'); }
      repeatTimer = setTimeout(loop, 70);
    };
    repeatTimer = setTimeout(loop, 380);
    const ends = ['pointerup', 'pointercancel', 'blur'];
    const stop = () => { clearTimeout(repeatTimer); ends.forEach(t => window.removeEventListener(t, stop)); b.removeEventListener('pointerleave', stop); };
    ends.forEach(t => window.addEventListener(t, stop)); b.addEventListener('pointerleave', stop);   // sliding off the button stops it too
  });
});

['bet', 'pp', 'tp'].forEach(w => { $('v-' + w).onclick = () => editAmount(w); });
$('btn-deal').onclick = () => { if (G.chips < MIN_BET && G.state === 'BET') { if (canTopup()) topup(); else { sfx('tab'); setTab('casino'); } } else startHand(); };
document.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => quickBet(b.dataset.q); });
$('btn-hit').onclick = hit;
$('ins-yes').onclick = () => insurance(true);
$('ins-no').onclick = () => insurance(false);
$('btn-stand').onclick = stand;
$('btn-double').onclick = doubleDown;
$('btn-surrender').onclick = surrender;
$('btn-split').onclick = split;
$('vipchip').onclick = () => { sfx('tab'); setTab(G.tab === 'stats' ? 'table' : 'stats'); };
$('vippill').onclick = () => { if (!document.body.classList.contains('open')) toggle(); setTab('stats'); };
$('mute').onclick = () => { G.muted = !G.muted; save(); render(); if (!G.muted) sfx('chips'); };
document.querySelectorAll('#statCats button').forEach(b => { b.onclick = () => { G.statCat = b.dataset.cat; renderStats(); sfx('click'); }; });
document.addEventListener('pointerdown', () => audio(), { once: true });
$('btn-hide').onclick = toggle;
$('btn-settings').onclick = () => { sfx('tab'); setTab(G.tab === 'settings' ? 'table' : 'settings'); };
$('setBody').addEventListener('click', e => { const b = e.target.closest('button[data-set]'); if (b && !b.disabled) settingsAction(b); });
$('setBody').addEventListener('input', e => {
  if (e.target.dataset.set !== 'volume') return;
  G.volume = +e.target.value / 100; if (master) master.gain.value = 0.32 * G.volume;
  e.target.nextElementSibling.textContent = e.target.value + '%';
});
$('setBody').addEventListener('change', e => { if (e.target.dataset.set === 'volume') { save(); sfx('chips'); } });
if (window.buddy && window.buddy.onUpdate) window.buddy.onUpdate(u => {
  updateInfo = u;
  if (G.tab === 'settings') renderSettings();
  if (u.state === 'ready') say('Update ' + u.version + ' is ready~ restart it from Settings \u2665', 5000);
});
$('count').onclick = () => { G.countVisible = !G.countVisible; sfx('click'); save(); render(); };
document.querySelectorAll('.tab').forEach(t => { t.onclick = () => { if (G.tab !== t.dataset.tab) sfx('tab'); setTab(t.dataset.tab); }; });
$('tipjar').onclick = e => tipClick(e.clientX, e.clientY);
$('tipup').onclick = buyTipUpgrade;
$('franchise').onclick = () => franchise();
document.querySelectorAll('#shopCats button').forEach(b => { b.onclick = () => { G.shopCat = b.dataset.cat; sfx('click'); renderShop(); }; });
$('btn-quit').onclick = () => window.buddy && window.buddy.quit();
$('rules-close').onclick = () => { $('rules').classList.remove('show'); sfx('click'); };

// drag anywhere on her or the table; a plain click on her opens / closes the table
let drag = null, ignoring = true, held = false;
window.addEventListener('pointerdown', () => { held = true; }, true);
['pointerup', 'pointercancel', 'blur'].forEach(t => window.addEventListener(t, () => { held = false; }, true));
document.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('button, input, .rules')) return;
  const onGirl = e.target.id === 'girl' && girlOpaque(e.clientX, e.clientY);
  if (!onGirl && !e.target.closest('.panel, .bubble')) return;
  drag = { sx: e.screenX, sy: e.screenY, moved: false, onGirl };
  if (window.buddy) window.buddy.dragStart();
});
document.addEventListener('mousemove', e => {
  if (drag) {
    const dx = e.screenX - drag.sx, dy = e.screenY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved && window.buddy) window.buddy.dragMove(dx, dy);
    return;
  }
  if (held) return;                                     // a button is held: stay clickable so the release is ours
  // click-through: let the mouse fall through wherever there is nothing under it
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const hit = !!(el && el !== document.body && el !== document.documentElement &&
    (el.id !== 'girl' || girlOpaque(e.clientX, e.clientY)));
  if (hit === ignoring) { ignoring = !hit; if (window.buddy) window.buddy.ignoreMouse(ignoring); }
});
document.addEventListener('mouseup', () => {
  if (!drag) return;
  if (drag.onGirl && !drag.moved) toggle();
  drag = null;
});
document.addEventListener('mouseleave', () => {
  if (!drag && !held && !ignoring) { ignoring = true; if (window.buddy) window.buddy.ignoreMouse(true); }
});
// keyboard: H hit, S stand, D double, P split, R surrender, I / N insurance, Space or Enter deal
const KEYS = { h: () => hit(), s: () => stand(), d: () => doubleDown(), p: () => split(), r: () => surrender() };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('rules').classList.contains('show')) { $('rules').classList.remove('show'); sfx('click'); return; }
  if (e.target && e.target.tagName === 'INPUT') return;          // typing a bet or dragging the volume slider
  const arrow = e.key === 'ArrowUp' || e.key === 'ArrowDown';
  if ((e.repeat && !arrow) || e.ctrlKey || e.altKey || e.metaKey || !document.body.classList.contains('open') || G.tab !== 'table') return;
  const k = e.key.toLowerCase();
  if (arrow) {                                             // betting: up/down double/halve, with Shift step by 10 (100 while held)
    if (G.state !== 'BET') return;
    const up = e.key === 'ArrowUp';
    if (e.shiftKey) stepAction(up ? 'betup' : 'betdown', e.repeat ? 10 : 1); else if (!e.repeat) quickBet(up ? 'dbl' : 'half');
    if (e.shiftKey) sfx('tick');
    e.preventDefault(); return;
  }
  if (G.state === 'INSURANCE' && (k === 'i' || k === 'y' || k === 'n')) insurance(k !== 'n');
  else if (G.state === 'PLAYER' && KEYS[k]) KEYS[k]();
  else if (G.state === 'BET' && (k === ' ' || k === 'enter')) $('btn-deal').click();
  else return;
  e.preventDefault();
});
// a clicked button keeps no focus, so Space never re-presses it
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
document.addEventListener('contextmenu', e => { e.preventDefault(); if (window.buddy) window.buddy.contextMenu(); });
if (window.buddy) window.buddy.onMenu(cmd => {
  if (cmd === 'toggle') toggle();
  else if (cmd === 'rules') { $('rules').classList.toggle('show'); sfx('click'); }
  else if (cmd === 'reset') { if (canTopup()) topup(); else say(G.chips < MIN_BET && G.state === 'BET' ? (topupWait() && incomePerMin() === 0 && !G.owned.autotip ? 'Next top-up in ' + mmss(topupWait()) + ' \u2014 tip jar meanwhile~' : 'Your casino pays you, hun~ try the tip jar') : 'Top-ups are for when you\'re broke~', 3000); }
  else if (cmd === 'mute') { G.muted = !G.muted; save(); render(); }
  else if (cmd === 'settings') { if (!document.body.classList.contains('open')) toggle(); setTab('settings'); }
  if (['ontop-off', 'ontop-on', 'mute'].includes(cmd) && G.tab === 'settings') renderSettings();
  if (cmd === 'ontop-off') say('Movie time? I\'ll stay behind your windows~ \u2665', 4000);
  else if (cmd === 'ontop-on') say('Back on top of everything~', 3000);
  else if (cmd === 'stats') { if (!document.body.classList.contains('open')) toggle(); setTab('stats'); }
});

// ---------------------------------------------------------------- go
shuffle();
load();
checkAch(true);                                          // existing players: credit what they already did, quietly
const away = offlineEarnings();
applyCosmetics();
setTab('table');
render();
G.st.sessions++;
if (G.state !== 'BET') resumeRound();
save();                                                  // stamp lastSeen now, so a crash can't pay the away earnings twice
let lastTick = Date.now(), lastSave = Date.now(), lastStats = 0;
if (!G.st.since) G.st.since = Date.now();
// a press in progress: skip the periodic re-render so buttons aren't rebuilt under the cursor (that swallows the click)
let pressAt = 0;
window.addEventListener('pointerdown', () => { pressAt = performance.now(); }, true);
window.addEventListener('pointerup', () => { pressAt = 0; }, true);
const pressing = () => pressAt && performance.now() - pressAt < 1500;
let dirty = false;
const LONG_GAP = 10 * 60000;                             // PC slept (not just a throttled hidden window): the gap counts as time away
setInterval(() => {
  const now = Date.now(), dt = now - lastTick;
  let changed;
  if (dt > LONG_GAP) {
    const away = awayEarnings(dt);
    changed = away > 0; greetAway(away);
  } else {
    changed = tick(dt) > 0;
    if (G.owned.autotip) {                               // auto-tipper: 1 tip/s, 2/s with the second dealer
      G.autoFrac += dt / 1000 * (G.owned.autotip2 ? 2 : 1);
      const n = Math.floor(G.autoFrac);
      if (n > 0) { G.autoFrac -= n; tipClick(undefined, undefined, true, n); changed = true; }
    }
  }
  dirty = dirty || changed;
  if (dirty && !pressing()) {
    dirty = false;
    $('chips').textContent = fmtBig(G.chips);
    $('rate').textContent = incomePerMin() > 0 ? '+' + fmtBig(Math.round(incomePerMin())) + '/min' : '';
    if (G.chips > G.st.highChips) G.st.highChips = G.chips;
    if (G.tab === 'casino') renderCasino(); else if (G.tab === 'shop') refreshShopAffordability(); else if (G.state === 'BET') render();
  }
  G.st.playMs += Math.min(5000, now - lastTick);
  const today = new Date().toDateString();
  if (G.st.lastDay !== today) { G.st.lastDay = today; G.st.days++; }
  if (G.tab === 'table' && G.state === 'BET' && G.chips < MIN_BET && now - lastStats > 1000 && !pressing()) { render(); lastStats = now; }   // top-up countdown
  if (G.tab === 'stats' && now - lastStats > 1000 && !pressing()) { renderStats(true); lastStats = now; }
  lastTick = now;
  if (now - lastSave > 5000) { save(); lastSave = now; }
}, 250);
window.addEventListener('beforeunload', save);
if (away > 0) setTimeout(() => greetAway(away), 1500);
setTimeout(blinkLoop, 2500);
setTimeout(chatterLoop, 25000);
setTimeout(() => say(G.state === 'BET' ? pick(LINES.hello) : 'Where were we? Your hand~ \u2665'), 1200);

// exposed for automated tests only
window.__bb = { parseAmount, ACH, checkAch, achReward, renderSettings, topupWait, gemSVG, SES, quickBet, setBet, canTopup, totalText, isSoft, resumeRound, canAct, awayEarnings, buyStarUp, STAR_UPS, banked, starBonus, costGrowth, finderMult, su, split, canSplit, canDouble, canSurrender, nextHand, VIP, vipIdx, vipMult, cashbackPct, topupAmount, vipTierUp, celebrateVip,
  renderStats, renderVipBadges, sfx, starsExact, runForStars, vipRewards, OUTFITS, recordRound, NEW_STATS, G, handValue, perfectPairs, twentyOnePlusThree, startHand, hit, stand, doubleDown, surrender,
  insurance, adjustBet, adjustSide, fitBets, shuffle, topup, setMood, say, render, toggle, canDeal, totalStake, settle,
  hiLo, runningCount, trueCount, decksLeft, tick, offlineEarnings, buyGen, tipClick, buyTipUpgrade, genCost, incomePerMin,
  tipValue, tipCost, setTab, renderCasino, GENS, TIERS, tierOf, rankOf, celebrateFranchise, BOOSTS, buyBoost, boostMult, milestoneMult, genRate, girlOpaque, drawGirl,
  franchise, starsAvailable, starMult, offlineCapMs, buyPerk, buyOrEquip, ownsItem, renderShop, SHOP, fmtBig, applyCosmetics };
