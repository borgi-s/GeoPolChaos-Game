import React, { useState, useEffect, useRef, useMemo } from 'react';

// ============================================================================
// CONFIGURATION
// ============================================================================
const TOTAL_ROUNDS = 10; // Adjustable after playtest feedback

// ASCENSION LEVELS: drink multiplier per level. 4 = baseline (current behavior).
// Applied to every drink in the game. Fractional multipliers use probabilistic
// rounding so e.g. 0.5x on a 1-drink result = 50% chance to drink this turn.
const ASCENSION_MULTIPLIERS = [
  0.5,  // 0 - chill mode
  0.6,  // 1
  0.75, // 2
  0.9,  // 3
  1.0,  // 4 - BASELINE, unchanged from original design
  1.2,  // 5
  1.4,  // 6
  1.6,  // 7
  1.9,  // 8
  2.2,  // 9
  2.5,  // 10 - apocalypse mode
];
const DEFAULT_ASCENSION = 4;

// Flavor text shown on the intro slide that confirms the ascension level.
// Tone: mock-serious state-department. Keep under ~2 sentences.
const ascensionBriefing = (level) => {
  if (level <= 1) return "Diplomatic pace requested. Low impact forecast. Everyone's happy.";
  if (level === 2) return "Light operational tempo. Casual vibes. Very responsible.";
  if (level === 3) return "Below baseline. Perfect for a school night.";
  if (level === 4) return "Standard operational tempo. The design intent. Nothing unusual expected.";
  if (level === 5) return "Above baseline. Things will get rowdier than usual.";
  if (level === 6) return "Escalated tempo. Ride-share apps recommended.";
  if (level === 7) return "Significant intensity. Everyone's going home with stories.";
  if (level === 8) return "Heavy tempo. Tomorrow's going to be fuzzy.";
  if (level === 9) return "Extreme intensity. Memory not guaranteed.";
  return "☢ MAXIMUM CHAOS MODE. Have a responsible observer on standby.";
};

// Optional: a single line shown at the bottom of the FINAL intro slide, in
// place of the default legal-disclaimer-style placeholder. Edit this to drop
// in a line that only your crew will get. Leave as empty string to keep the
// default placeholder visible.
const INTRO_INSIDE_JOKE = "";

// ============================================================================
// 🎵 SOUNDTRACK
// ============================================================================
// Drop any mp3/wav/ogg/m4a files into src/assets/audio/. The game bundles
// them via Vite, shuffles them, and plays through the list on loop.
// Playback starts after the first user click (browsers block autoplay
// without interaction).
//
// Leave the folder empty to disable background music.
// ============================================================================
// One file can be designated as the "pose sound" (e.g. an air horn). It gets
// EXCLUDED from the background shuffle and played on-demand when a player
// clicks Pose. Match by filename substring (case-insensitive).
const POSE_SOUND_MATCH = 'horn'; // any filename containing this (case-insensitive) is the pose sfx

const SOUNDTRACK_MODULES = import.meta.glob(
  './assets/audio/*.{mp3,wav,ogg,m4a}',
  { eager: true, as: 'url' }
);
// Split the globbed files into the regular playlist and the pose-trigger sfx
const SOUNDTRACK_ALL_ENTRIES = Object.entries(SOUNDTRACK_MODULES);
const POSE_SOUND_URL = (SOUNDTRACK_ALL_ENTRIES.find(
  ([path]) => path.toLowerCase().includes(POSE_SOUND_MATCH.toLowerCase())
) || [])[1] || '';
const SOUNDTRACK = SOUNDTRACK_ALL_ENTRIES
  .filter(([path]) => !path.toLowerCase().includes(POSE_SOUND_MATCH.toLowerCase()))
  .map(([, url]) => url);
const AUDIO_VOLUME = 0.55; // 0.0 to 1.0 (background soundtrack)
const POSE_SOUND_VOLUME = 1.0; // 0.0 to 1.0 (air horn - loud on purpose)

// ============================================================================
// 📺 PODIUM HIJACK VIDEO
// ============================================================================
// A video that "hacks" the podium screen at game end, flickering in via
// TV-static-style squares before taking over the screen at max volume.
// Drop the file into src/assets/videos/ - ANY mp4/webm file found there
// will be used. If multiple files exist, the first one wins.
//
// NOTE: Browsers don't natively play .avi - convert to .mp4 (H.264) or .webm
// first. Free: `ffmpeg -i your.avi -c:v libx264 -c:a aac out.mp4`.
// ============================================================================
// Vite processes these at build time, giving us hashed production-safe URLs.
const HIJACK_VIDEO_MODULES = import.meta.glob(
  './assets/videos/*.{mp4,webm,mov,m4v}',
  { eager: true, as: 'url' }
);
const HIJACK_VIDEO_SOURCES = Object.values(HIJACK_VIDEO_MODULES);
const HIJACK_VIDEO_URL = HIJACK_VIDEO_SOURCES[0] || ''; // first video found, empty string = disabled
const HIJACK_VIDEO_VOLUME = 1.0; // max
const HIJACK_DELAY_MS = 3000; // delay after podium appears before hijack starts

// ============================================================================
// 🎭 CUSTOMIZATION ZONE - DROP YOUR INTERNAL JOKES HERE 🎭
// ============================================================================
// This is where you add the crew's inside jokes, nicknames, and running bits.
// Everything here gets mixed in with the stock content. Delete the examples
// and add your own. You can add as many or as few as you like.
// ============================================================================

// --- CUSTOM TICKER HEADLINES ---
// These scroll across the "Breaking News" page below the scenario.
// Keep them short (3-6 words works best). Add as many as you want.
// These get mixed in with the stock headlines below.
const CUSTOM_TICKER = [
  // "MIKKEL STILL HASNT PAID HIS TAB",
  // "LARS SPOTTED AT BODEGA AGAIN",
  // "THE GROUP CHAT HAS BEEN QUIET",
  // "SOMEONE BROUGHT WARM BEER",
];

// --- CUSTOM SCENARIOS ---
// These appear in the rotation alongside the stock geopolitical ones.
// Each needs: text (the headline) and tags (from: military, escalation, scandal,
// deflect, diplomatic, media, mystery, absurd, cyber, economic).
// Tags control how actions get modified - pick 1-2 that fit.
const CUSTOM_SCENARIOS = [
  // { text: "Henrik claims he 'barely drank' last weekend. Photos emerge.", tags: ["scandal", "absurd"] },
  // { text: "The group chat has been 'on read' for 4 hours. Something is up.", tags: ["media", "mystery"] },
];

// --- CUSTOM ACTIONS ---
// Extra actions that can show up in a player's pick set (alongside the
// standard ones). chaos = how aggressive/reckless the action is (0-10).
// deflection = how well it distracts from the situation (0-5).
// Use sparingly — too many and the stock actions stop appearing.
const CUSTOM_ACTIONS = [
  // { id: 'morten-move', label: 'Pull a Morten', emoji: '🤦', chaos: 3, deflection: 2, desc: "You know exactly what this means." },
];

// --- CUSTOM WILDCARDS ---
// Rare appearances. Same format as custom actions.
const CUSTOM_WILDCARDS = [
  // { id: 'bodega-run', label: 'Bodega Run', emoji: '🏃', chaos: 1, deflection: 3, desc: "Be back in 5." },
];

// ============================================================================
// ============================================================================
// SCENARIO DATABASE
// Tags determine which action modifiers apply. Keep references "dancing around"
// specifics so everyone knows what it's about and argues about it.
// ============================================================================
const STOCK_SCENARIOS = [
  { text: "Border patrol intercepts major smuggling operation in international waters", tags: ["scandal", "deflect", "military"] },
  { text: "Audit reveals funding irregularities in aid disbursement program", tags: ["corruption", "aid", "scandal"] },
  { text: "International meeting devolves into heated debate over military support", tags: ["diplomacy", "alliance", "escalation"] },
  { text: "Government considers reducing military presence at key overseas bases", tags: ["military", "alliance", "deflect"] },
  { text: "Officials defend controversial military operation at major public event", tags: ["controversy", "military", "optics"] },
  { text: "Intelligence reports contradict official claims about operation success", tags: ["intelligence", "scandal", "deflect"] },
  { text: "Government seizes cargo suspected of violating trade restrictions", tags: ["sanctions", "energy", "escalation"] },
  { text: "Tensions rise in key strategic waterway; oil markets react nervously", tags: ["military", "escalation", "energy"] },
  { text: "New defense strategy faces criticism for overlooking major geopolitical challenges", tags: ["policy shift", "deflect", "geopolitics"] },
  { text: "Military operations in multiple regions draw international scrutiny", tags: ["military", "controversy", "scandal"] },
  { text: "Allied nations express concern over controversial military action", tags: ["diplomacy", "alliance", "tension"] },
  { text: "Key ally threatens to restrict military base access over policy disagreement", tags: ["diplomacy", "military", "alliance"] },
  { text: "Opposition politicians warn of fracturing party support over major decision", tags: ["domestic politics", "deflect", "controversy"] },
  { text: "Government faces calls for investigation into alleged misconduct by officials", tags: ["legal", "controversy", "deflect"] },
  { text: "Unexpected polling surge forces early response to political challenges", tags: ["election", "deflect", "scandal"] },
  { text: "Pacific nation deflects criticism over lack of support for military coalition", tags: ["diplomacy", "alliance", "tension"] },
  { text: "Foreign government condemns military operation; demands international inquiry", tags: ["war", "escalation", "diplomacy"] },
  { text: "Opposition coalition turns on government over cabinet member's controversial comments", tags: ["domestic politics", "scandal", "infighting"] },
  { text: "Government announces major restructuring of international aid programs", tags: ["aid", "policy shift", "scandal"] },
  { text: "Government hints at possible withdrawal from international security alliance", tags: ["alliance", "military", "escalation"] },
  { text: "Sporting league faces criticism over controversial referee decisions", tags: ["sports", "controversy", "deflect"] },
  { text: "Political base expresses outrage over handling of classified information release", tags: ["scandal", "domestic politics", "deflect"] },
  { text: "Government official dismissed after public scandal involving document mishandling", tags: ["scandal", "legal", "infighting"] },
  { text: "Legislative committee launches formal investigation into government practices", tags: ["scandal", "congress", "investigation"] },
  { text: "Court rules against government in high-stakes legal dispute with media outlet", tags: ["legal", "scandal", "media"] },
  { text: "Leaked correspondence raises questions about policy implementation and oversight", tags: ["scandal", "policy", "deflect"] },
  { text: "Officials exchange escalating threats over regional security standoff", tags: ["military", "escalation", "diplomacy"] },
  { text: "Global markets react sharply to escalating rhetoric between governments", tags: ["energy", "escalation", "economy"] },
  { text: "Audit reveals accounting irregularities in international development spending", tags: ["corruption", "aid", "scandal"] },
  { text: "Pentagon review uncovers procurement overpayment in military contracts", tags: ["corruption", "military", "scandal"] },
  { text: "Government drastically reduces funding for international programs citing fiscal concerns", tags: ["aid", "policy shift", "scandal"] },
  { text: "Government uses trade policy as leverage in alliance negotiations", tags: ["diplomacy", "alliance", "trade war"] },
  { text: "International leaders caught off-guard by unexpected policy announcement", tags: ["diplomacy", "alliance", "escalation"] },
  { text: "Allied nation threatens restrictions on military facilities over policy disagreement", tags: ["military", "alliance", "diplomacy"] },
  { text: "Political faction warns of electoral consequences over government decisions", tags: ["domestic politics", "scandal", "election"] },
  { text: "Media commentators criticize government over controversial policy announcement", tags: ["media", "scandal", "deflect"] },
  { text: "Congress votes to override government restrictions on information disclosure", tags: ["congress", "scandal", "transparency"] },
  { text: "Foreign nation claims military action violated international norms and protocols", tags: ["military", "escalation", "diplomacy"] },
  { text: "Opposition politician warns party leadership about rising discontent among base", tags: ["domestic politics", "scandal", "infighting"] },
  { text: "Analysis suggests government divisions could impact upcoming electoral cycle", tags: ["domestic politics", "scandal", "election"] },
  { text: "Senior government official resigns amid corruption probe into business dealings", tags: ["corruption", "scandal", "resignation"] },
  { text: "Government claims vindication in ongoing legal disputes with opponents", tags: ["scandal", "deflect", "legal"] },
  { text: "Military report documents significant territorial gains by hostile forces", tags: ["military", "escalation", "scandal"] },
  { text: "Government acknowledges partial implementation of transparency law requirements", tags: ["scandal", "transparency", "legal"] },
  { text: "Energy sector faces disruption as military tensions affect infrastructure", tags: ["energy", "military", "economy"] },
  { text: "International leader criticizes government's use of economic pressure as negotiating tactic", tags: ["diplomacy", "alliance", "trade war"] },
  { text: "Government adviser faces backlash over public statements during sensitive period", tags: ["infighting", "domestic politics", "scandal"] },
  { text: "International legal experts question legality of government military posturing", tags: ["legal", "military", "diplomacy"] },
  { text: "Legislative committee demands testimony from government officials over policy decisions", tags: ["congress", "scandal", "investigation"] },
  { text: "New policy implementation draws complaints from advocacy groups and stakeholders", tags: ["policy", "scandal", "deflect"] },
];
const SCENARIOS = [...STOCK_SCENARIOS, ...CUSTOM_SCENARIOS];

// ============================================================================
// FAMOUS-NAME REPLACEMENT
// ============================================================================
// Patterns that match generic titles and roles. Each match gets
// replaced with a random player's name at scenario-pick time. Patterns are
// applied in order; longer patterns come first.
//
// Regex notes:
//  - \b word boundaries keep us from matching partial words
//  - Titles like "Gov.", "Senator", etc. are stripped alongside names
//  - Possessive 's is captured and restored
// ============================================================================
const FAMOUS_NAME_PATTERNS = [
  // Generic government titles and roles
  /\bthe\s+(?:Chief\s+)?Official\b/g,
  /\bthe\s+Minister\b/g,
  /\bthe\s+Governor\b/g,
  /\bthe\s+Senator\b/g,
  /\bthe\s+Director\b/g,
  /\bthe\s+Secretary\b/g,
  /\bthe\s+Advisor\b/g,
  /\bthe\s+Ambassador\b/g,
  /\bthe\s+Representative\b/g,
  /\bthe\s+Cabinet\s+Member\b/g,
  /\bthe\s+(?:government\s+)?official\b/gi,
  /\bthe\s+(?:foreign|domestic)\s+policy\s+lead\b/g,
  /\bthe\s+(?:national\s+)?security\s+advisor\b/g,
  /\bthe\s+spokesperson\b/g,
];

// Substitute famous names in scenario text with random player names.
// - Uses distinct players within a single scenario where possible
// - Excludes the current picker so nobody's reading a scenario "about themselves"
//   (falls back to including them if there are too few other players)
// - Preserves possessive 's
const substituteNames = (scenarioText, playersList, excludeIdx = null) => {
  if (!playersList || playersList.length === 0) return scenarioText;
  const pool = playersList
    .map((p, i) => ({ name: p.name, idx: i }))
    .filter(p => p.idx !== excludeIdx);
  // If everyone is excluded (1-player game, impossible, but guard anyway)
  const usablePool = pool.length > 0 ? pool : playersList.map((p, i) => ({ name: p.name, idx: i }));
  // Track which players we've already used in THIS scenario so we don't double-assign
  const assignments = new Map(); // matched-text -> player name
  let remaining = shuffle(usablePool);
  const nextPlayer = () => {
    if (remaining.length === 0) remaining = shuffle(usablePool); // recycle if scenario has many names
    return remaining.shift().name;
  };

  let result = scenarioText;
  for (const pattern of FAMOUS_NAME_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Detect possessive to preserve it
      const hasPossessive = /'s$/.test(match);
      const normalizedKey = match.toLowerCase().replace(/'s$/, '');
      // Reuse the same player if the same name appears twice in one scenario
      if (!assignments.has(normalizedKey)) {
        assignments.set(normalizedKey, nextPlayer());
      }
      const playerName = assignments.get(normalizedKey);
      return hasPossessive ? `${playerName}'s` : playerName;
    });
  }
  return result;
};

// ============================================================================
// ACTION DATABASE
// Base chaos + deflection values. Scenario tags modify these.
// ============================================================================
const STOCK_ACTIONS = [
  { id: 'nothing', label: 'Do Nothing', emoji: '🗿', chaos: 0, deflection: 1, desc: [
    "Thoughts and prayers.",
    "We're monitoring the situation.",
    "Many people are saying it'll work itself out."
  ] },
  { id: 'statement', label: 'Strong Statement', emoji: '📢', chaos: 1, deflection: 2, desc: [
    "A sternly worded letter.",
    "We will not stand idly by!",
    "Look, it is what it is. But it won't be."
  ] },
  { id: 'sanctions', label: 'Sanctions', emoji: '💰', chaos: 3, deflection: 2, desc: [
    "Freeze their assets. Again.",
    "The biggest sanctions you've ever seen.",
    "They'll be begging to make a deal."
  ] },
  { id: 'cyber', label: 'Cyber Attack', emoji: '💻', chaos: 4, deflection: 1, desc: [
    "Plausibly deniable.",
    "Somebody did something. Wasn't us.",
    "Very unfair what they're saying about this."
  ] },
  { id: 'strike', label: 'Military Strike', emoji: '🚀', chaos: 7, deflection: 1, desc: [
    "Precision guided, allegedly.",
    "The biggest explosions. Beautiful.",
    "They had it coming. Believe me."
  ] },
  { id: 'distract', label: 'Distract Media', emoji: '🎪', chaos: 1, deflection: 5, desc: [
    "Look over there! Something shiny!",
    "Release a controversial meme. Works every time.",
    "Schedule a surprise announcement for tomorrow.",
    "Crisis? What crisis? Look at this celebrity.",
    "Call a press conference but don't say anything.",
    "Leak something inconsequential. Very distracting.",
    "Start a wild rumor on social media."
  ] },
];
const ACTIONS = [...STOCK_ACTIONS, ...CUSTOM_ACTIONS];

// Wildcards - appear randomly ~25% of rounds
const STOCK_WILDCARDS = [
  { id: 'blame', label: 'Blame Ally', emoji: '👉', chaos: 2, deflection: 4, desc: [
    "It was their idea.",
    "I barely know them. Never met them.",
    "They came to me. What else could I do?",
    "Everyone says they're unreliable."
  ] },
  { id: 'leak', label: 'Leak Something Else', emoji: '🕳️', chaos: 1, deflection: 6, desc: [
    "Change the subject. Now.",
    "Release some boring internal memo.",
    "Who leaked it? Anonymous sources.",
    "Nobody's seen the full context. Trust me."
  ] },
  { id: 'tweet', label: 'Accidental Tweet', emoji: '🐦', chaos: 5, deflection: 3, desc: [
    "Post something cryptic. Very cryptic.",
    "Tweet a typo that becomes iconic.",
    "What did this mean? Nobody knows.",
    "Yikes. Delete it. Too late."
  ] },
  { id: 'summit', label: 'Call a Summit', emoji: '🤝', chaos: 0, deflection: 3, desc: [
    "Schedule a photo-op meeting.",
    "Very productive. Everyone claimed so.",
    "Lots of handshakes. Very firm.",
    "Historic agreement incoming. Probably."
  ] },
  // POSE: a special wildcard that physically moves around so players have to say its name
  { id: 'pose', label: 'Pose', emoji: '🛍', chaos: 1, deflection: 4, desc: [
    "Think about it.",
    "What does it mean?",
    "Only the POSE knows.",
    "Say the name three times.",
  ], special: 'pose' },
];
const WILDCARDS = [...STOCK_WILDCARDS, ...CUSTOM_WILDCARDS];

// How scenario tags modify action values
const TAG_MODIFIERS = {
  military: { strike: { chaos: 3 }, nothing: { chaos: 2 }, statement: { chaos: -1 } },
  escalation: { strike: { chaos: 4 }, sanctions: { chaos: 2 }, cyber: { chaos: 2 } },
  scandal: { distract: { deflection: 3 }, leak: { deflection: 3 }, nothing: { chaos: 3 } },
  deflect: { distract: { deflection: 4 }, leak: { deflection: 4 }, statement: { chaos: 1 } },
  diplomatic: { statement: { deflection: 2 }, summit: { deflection: 3 }, strike: { chaos: 5 } },
  media: { distract: { deflection: 2 }, tweet: { chaos: 3 }, leak: { deflection: 2 } },
  mystery: { cyber: { deflection: 2 }, nothing: { chaos: 1 }, strike: { chaos: 2 } },
  absurd: { tweet: { chaos: 4 }, nothing: { chaos: -1 }, distract: { deflection: 1 } },
  cyber: { cyber: { chaos: 3 }, strike: { chaos: 2 } },
  economic: { sanctions: { chaos: 3 }, distract: { deflection: 1 } },
};

// ============================================================================
// PERSONALITY TRAITS - assigned secretly at game start
// ============================================================================
const TRAITS = [
  { id: 'hawk', label: 'The Eagle', desc: "+2 chaos on all actions", emoji: '🦅' },
  { id: 'dove', label: 'The Dove', desc: "-2 chaos on all actions", emoji: '🕊️' },
  { id: 'clown', label: 'The Clown', desc: "random chaos modifier each round", emoji: '🤡' },
  { id: 'fox', label: 'The Fox', desc: "+3 deflection", emoji: '🦊' },
  { id: 'wildcard', label: 'The Wildcard', desc: "flip a coin every round", emoji: '🎲' },
  { id: 'bureaucrat', label: 'The Bureaucrat', desc: "chaos halved, rounded up", emoji: '📎' },
  { id: 'populist', label: 'The Populist', desc: "chaos doubles on popular actions", emoji: '📣' },
  { id: 'normie', label: 'The Normie', desc: "no modifiers at all", emoji: '😐' },
];

// ============================================================================
// OUTCOME FLAVORS - dramatic result text based on outcome type
// ============================================================================
const OUTCOME_FLAVORS = {
  meltdown: [
    "GLOBAL MELTDOWN. Everything's on fire.",
    "ESCALATION CASCADE. Someone's having a panic attack.",
    "DIPLOMATIC CRISIS. Phone lines burning up.",
    "CHAOS MODE ACTIVATED. Better get the hard drives.",
    "INTERNATIONAL LAW: JUST A SUGGESTION NOW.",
    "BACKUP SYSTEMS ARE FAILING. AGAIN.",
    "THE HARDLINERS HAVE WON. AND THEY'RE THIRSTY.",
    "THIS WILL BE IN TEXTBOOKS. Badly.",
  ],
  weak: [
    "WEAK RESPONSE. Everyone's disappointed.",
    "PATHETIC. Even the interns noticed.",
    "UNDERWHELMING. Tomorrow's headline: 'Nothing Happens'.",
    "TOOTHLESS. The opposition is laughing.",
    "SOMEONE WHISPERED 'IS THAT IT?' LOUDLY.",
    "MARKETS YAWNED. NOBODY CARES.",
    "THIS WAS A WASTE OF EVERYONE'S TIME.",
  ],
  deflected: [
    "PUBLIC SUCCESSFULLY DISTRACTED. Crisis averted (temporarily).",
    "NEWS CYCLE REDIRECTED. Old news already.",
    "SMOKE SCREEN WORKED. Everyone forgot.",
    "NEW DRAMA ERUPTS. Perfect timing.",
    "VIRAL HASHTAG TRENDING. The algorithm wins.",
    "CELEBRITY MELTDOWN DOMINATES HEADLINES. Crisis forgotten.",
    "SCANDAL BURIED IN THE FEED. Out of sight, out of mind.",
    "ALGORITHM CONFUSED. Nobody knows what happened.",
  ],
  chaos_punish: [
    "OVERREACTION PUNISHED. The hot-heads drink.",
    "TOO AGGRESSIVE. Whoever pushed hardest pays.",
    "ESCALATION BACKFIRED. The warmongers drink.",
    "INTERNATIONAL CONDEMNATION. The aggressors drink.",
    "THE MODERATES HAVE SPOKEN. The extremists drink.",
    "HISTORY WILL JUDGE YOU. For now, drink.",
    "CONGRATULATIONS, NOBODY LIKES THIS. Drink accordingly.",
  ],
  peace_punish: [
    "INACTION PUNISHED. The cautious drink.",
    "TOO PASSIVE. The quiet ones drink.",
    "NOTHING EVER CHANGES. The fence-sitters drink.",
    "SOMEONE HAD TO ACT. The passive drink.",
    "YOUR HESITATION WAS NOTED. And exploited. Drink.",
    "DECISIVE PEOPLE WIN. The indecisive drink.",
    "LEADERSHIP REQUIRED. The followers drink.",
  ],
  balanced: [
    "BALANCED RESPONSE. Everyone drinks anyway.",
    "COMPROMISE ACHIEVED. Nobody's satisfied.",
    "THE MIDDLE GROUND. It's miserable. Everyone drinks.",
    "MODERATE. BORING. DRINK.",
    "SPLIT THE DIFFERENCE. Still costs everyone.",
    "A COMMITTEE WAS FORMED. NOTHING HAPPENED. Drink.",
    "EVERYONE LOST A LITTLE. Drink to that.",
  ],
};

// ============================================================================
// TICKER HEADLINES - scroll across the breaking-news screen
// ============================================================================
const STOCK_TICKER = [
  "MARKETS REACTING. Sharply.",
  "ANALYSTS CONCERNED. As always.",
  "ALLIES WATCHING. Nervously.",
  "SOCIAL MEDIA ON FIRE. Takes flying.",
  "OFFICIALS: NO COMMENT. Says everything.",
  "SOURCES: UNNAMED. Convenient.",
  "SITUATION: DEVELOPING. Details unclear.",
  "PRESS SECRETARY IN HIDING. Crafting response.",
  "FOREIGN GOVERNMENT DENIES. Naturally.",
  "GOVERNMENT 'REVIEWING.' Translation: panicking.",
  "MARKETS VOLATILE. Investors nervous.",
  "LAWYERS EXPENSIVE. Very expensive.",
  "LOBBYISTS BUSY. Very busy.",
  "EXPERTS: DEBATING. Of course.",
  "BACKCHANNELS ACTIVE. You won't hear about it.",
];
const TICKER_HEADLINES = [...STOCK_TICKER, ...CUSTOM_TICKER];

// ============================================================================
// UTILITY
// ============================================================================
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Small component that fires `onDone` after 12 seconds.
// Used by the POSEN chant screen.
function ChantAutoAdvance({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 12000);
    return () => clearTimeout(t);
  }, []);
  return null;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getActionDesc = (action) => Array.isArray(action.desc) ? pick(action.desc) : action.desc;

const AMBIENT_IMAGE_SOURCES = Object.values(import.meta.glob('./assets/images/*.{jpg,jpeg}', { eager: true, as: 'url' }));

const AMBIENT_TRAJECTORIES = [
  { start: { top: -18, left: 8 }, dx: '100vw', dy: '110vh', startScale: 0.9, endScale: 1.08, startRotate: -8, endRotate: 6 },
  { start: { top: 10, left: 102 }, dx: '-120vw', dy: '96vh', startScale: 1.05, endScale: 0.95, startRotate: 4, endRotate: -6 },
  { start: { top: 110, left: 20 }, dx: '90vw', dy: '-118vh', startScale: 0.95, endScale: 1.1, startRotate: -5, endRotate: 8 },
  { start: { top: 15, left: -24 }, dx: '128vw', dy: '75vh', startScale: 1.12, endScale: 0.92, startRotate: 7, endRotate: -9 },
  { start: { top: 90, left: 108 }, dx: '-130vw', dy: '-84vh', startScale: 0.94, endScale: 1.06, startRotate: -3, endRotate: 5 },
  { start: { top: 46, left: -16 }, dx: '104vw', dy: '-52vh', startScale: 0.98, endScale: 1.02, startRotate: 2, endRotate: -4 },
  { start: { top: -14, left: 62 }, dx: '14vw', dy: '132vh', startScale: 1.0, endScale: 1.1, startRotate: -2, endRotate: 6 },
  { start: { top: 80, left: 40 }, dx: '64vw', dy: '-120vh', startScale: 0.88, endScale: 1.05, startRotate: 3, endRotate: -5 },
];

const getShuffledAmbientQueue = () => shuffle(AMBIENT_IMAGE_SOURCES);

const createAmbientLayer = (src) => {
  const traj = pick(AMBIENT_TRAJECTORIES);
  return {
    id: `ambient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    backgroundImage: src,
    top: `${traj.start.top}%`,
    left: `${traj.start.left}%`,
    width: `${28 + Math.random() * 30}vw`,
    height: `${28 + Math.random() * 30}vw`,
    dx: traj.dx,
    dy: traj.dy,
    startScale: traj.startScale,
    endScale: traj.endScale,
    startRotate: `${traj.startRotate}deg`,
    endRotate: `${traj.endRotate}deg`,
    duration: `${20 + Math.random() * 12}s`,
    delay: `${Math.random() * 1.2}s`,
    opacityMax: 0.25 + Math.random() * 0.08,
  };
};

// Apply tag modifiers to get effective action values for a scenario
const getEffectiveActions = (actions, scenario) => {
  return actions.map(action => {
    let chaos = action.chaos;
    let deflection = action.deflection;
    scenario.tags.forEach(tag => {
      const mods = TAG_MODIFIERS[tag];
      if (mods && mods[action.id]) {
        chaos += mods[action.id].chaos || 0;
        deflection += mods[action.id].deflection || 0;
      }
    });
    return { ...action, effectiveChaos: Math.max(0, chaos), effectiveDeflection: Math.max(0, deflection) };
  });
};

// Apply personality trait to a player's chaos/deflection contribution
const applyTrait = (trait, chaos, deflection, popularityBoost) => {
  switch (trait.id) {
    case 'hawk': return { chaos: chaos + 2, deflection };
    case 'dove': return { chaos: Math.max(0, chaos - 2), deflection };
    case 'clown': return { chaos: chaos + (Math.floor(Math.random() * 7) - 3), deflection };
    case 'fox': return { chaos, deflection: deflection + 3 };
    case 'wildcard': return Math.random() < 0.5 
      ? { chaos: chaos * 2, deflection } 
      : { chaos: 0, deflection: deflection + 2 };
    case 'bureaucrat': return { chaos: Math.ceil(chaos / 2), deflection };
    case 'populist': return { chaos: popularityBoost ? chaos * 2 : chaos, deflection };
    default: return { chaos, deflection };
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function NothingToSeeHere() {
  const [phase, setPhase] = useState('setup'); // setup, traits, scenario, picking, revealing, result, gameover
  const [playerCount, setPlayerCount] = useState(4);
  const [ascension, setAscension] = useState(DEFAULT_ASCENSION);
  const [introEnabled, setIntroEnabled] = useState(true); // whether to show intro slides
  const [introSlide, setIntroSlide] = useState(0); // current slide index during intro
  const [players, setPlayers] = useState([]); // {name, trait, drinksTotal}
  const [round, setRound] = useState(0);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [availableActions, setAvailableActions] = useState([]);
  const [playerActionSets, setPlayerActionSets] = useState({}); // per-player {playerIdx: actions[]}
  const [playerPicks, setPlayerPicks] = useState({}); // {playerIdx: actionId}
  const [currentPickerIdx, setCurrentPickerIdx] = useState(0);
  const [roundResult, setRoundResult] = useState(null);
  const [escalationMeter, setEscalationMeter] = useState(0); // -meterMax to +meterMax
  const [meterMax, setMeterMax] = useState(50); // computed from player count
  const [usedScenarios, setUsedScenarios] = useState([]);
  const [showTraitReveal, setShowTraitReveal] = useState(false);
  const [flash, setFlash] = useState(null); // 'red' or 'green' or null
  const [zoom, setZoom] = useState(100); // 60-150% scaling
  // Soundtrack state
  const [audioEnabled, setAudioEnabled] = useState(false); // true after user clicks enable
  const [audioPlaylist, setAudioPlaylist] = useState([]); // shuffled list of file URLs
  const [audioIdx, setAudioIdx] = useState(0);
  const audioRef = useRef(null);
  const poseSoundRef = useRef(null); // dedicated element for the air horn SFX
  // Podium hijack state: 'idle' -> 'flickering' -> 'takeover' -> 'done'
  const [hijackPhase, setHijackPhase] = useState('idle');
  const hijackVideoRef = useRef(null);
  const [meterChangeDir, setMeterChangeDir] = useState(null); // 'spike', 'drop', or null
  const [meterCooldownTarget, setMeterCooldownTarget] = useState(null); // animating toward this target after a result
  const cooldownAnimationRef = useRef(null);
  useEffect(() => {
    return () => {
      if (cooldownAnimationRef.current) {
        cancelAnimationFrame(cooldownAnimationRef.current);
      }
    };
  }, []);
  const [freshDrinkers, setFreshDrinkers] = useState([]); // for scoreboard pulse
  const [poseChanter, setPoseChanter] = useState(null); // player name currently being chanted for
  const [pendingAdvance, setPendingAdvance] = useState(null); // callback to run after chant screen
  // Pose dance: maps action index -> current slot (0=left, 1=middle, 2=right)
  // Buttons are rendered in fixed order; we move them to their slot via transform.
  const [poseSlots, setPoseSlots] = useState([0, 1, 2]);
  // Pose melt state: when Pose appears in a player's action set, the OTHER two
  // actions start to melt 300ms later and finish dissolving after ~5s.
  // If a player clicks a melting non-pose action it bubble-pops instead.
  const [isMelting, setIsMelting] = useState(false);
  const [poppingActionId, setPoppingActionId] = useState(null);
  // Stable action-description cache: maps `${pickerIdx}:${actionId}` -> locked
  // description string. Prevents the flavor text from re-rolling on every
  // re-render during a single player's turn. Cleared when a new round starts.
  const actionDescCacheRef = useRef({});
  const poseGridRef = useRef(null);
  const [restartArmed, setRestartArmed] = useState(false);
  const [poseHovered, setPoseHovered] = useState(false);
  const [poseReceiptCounts, setPoseReceiptCounts] = useState({});
  const [ambientQueue, setAmbientQueue] = useState([]);
  const [currentAmbient, setCurrentAmbient] = useState(null);

  useEffect(() => {
    if (currentAmbient) return;
    const queue = getShuffledAmbientQueue();
    const [firstSrc, ...rest] = queue;
    setAmbientQueue(rest);
    setCurrentAmbient(createAmbientLayer(firstSrc));
  }, [currentAmbient]);

  useEffect(() => {
    if (!currentAmbient) return;
    const durationMs = Math.round(parseFloat(currentAmbient.duration) * 1000) + 300;
    const timer = setTimeout(() => {
      setAmbientQueue((prevQueue) => {
        const queue = prevQueue.length ? prevQueue : getShuffledAmbientQueue();
        const [nextSrc, ...rest] = queue;
        setCurrentAmbient(createAmbientLayer(nextSrc));
        return rest;
      });
    }, durationMs);
    return () => clearTimeout(timer);
  }, [currentAmbient]);

  // ==========================================================================
  // POSE DANCE EFFECT (#4)
  // While in picking phase with Pose in the action set, periodically swap
  // Pose with one of the other actions so it actually changes positions.
  // ==========================================================================
  useEffect(() => {
    if (phase !== 'picking') return;
    const myActions = playerActionSets[currentPickerIdx] || [];
    const poseIdx = myActions.findIndex(a => a.special === 'pose');
    if (poseIdx === -1) return;
    // If any button is being hovered, don't run the dance at all.
    if (poseHovered) return;

    // Reset slots whenever a new player is picking
    setPoseSlots([0, 1, 2]);

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setPoseSlots(prev => {
        // Find pose's current slot
        const poseCurrentSlot = prev[poseIdx];
        // Pick a target slot for pose (different from current).
        // ~30% chance of jumping all the way across when possible (left<->right swap)
        const otherSlots = [0, 1, 2].filter(s => s !== poseCurrentSlot);
        let targetSlot;
        if (otherSlots.length === 2 && Math.random() < 0.3) {
          // Try the far slot (index 0 <-> 2)
          const farSlot = poseCurrentSlot === 0 ? 2 : (poseCurrentSlot === 2 ? 0 : pick(otherSlots));
          targetSlot = farSlot;
        } else {
          targetSlot = pick(otherSlots);
        }
        // Find which action is currently in the target slot, swap with pose
        const occupantIdx = prev.findIndex(s => s === targetSlot);
        const next = [...prev];
        next[poseIdx] = targetSlot;
        next[occupantIdx] = poseCurrentSlot;
        return next;
      });
      // Random delay: 0.8 - 1.6s
      const nextDelay = 500 + Math.random() * 4000;
      timeoutId = setTimeout(tick, nextDelay);
    };
    // Initial delay before first swap
    let timeoutId = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [phase, currentPickerIdx, playerActionSets, poseHovered]);

  // Pose melt trigger: after a short reveal delay, the non-pose action buttons
  // begin to melt. This runs once per player-turn that contains Pose and is
  // cleared when the phase or picker changes.
  useEffect(() => {
    // Reset melt/pop on any change
    setIsMelting(false);
    setPoppingActionId(null);
    if (phase !== 'picking') return;
    const myActions = playerActionSets[currentPickerIdx] || [];
    const hasPose = myActions.some(a => a.special === 'pose');
    if (!hasPose) return;
    // Let the player see the intact options for a beat, then start melting.
    const t = setTimeout(() => setIsMelting(true), 400);
    return () => clearTimeout(t);
  }, [phase, currentPickerIdx, playerActionSets]);

  // ==========================================================================
  // SOUNDTRACK
  // ==========================================================================
  // When the user enables audio, build a shuffled playlist. Each track's
  // onEnded handler advances to the next index (looping back to 0). If the
  // player runs through the full list we reshuffle for variety.
  const enableAudio = () => {
    if (SOUNDTRACK.length === 0) {
      setAudioEnabled(true); // mark as "enabled" so the prompt goes away
      return;
    }
    // SOUNDTRACK entries are already resolved URLs from Vite's glob
    setAudioPlaylist(shuffle(SOUNDTRACK));
    setAudioIdx(0);
    setAudioEnabled(true);
  };

  // Auto-play the current track when playlist or index changes
  useEffect(() => {
    if (!audioEnabled || audioPlaylist.length === 0) return;
    const el = audioRef.current;
    if (!el) return;
    el.volume = AUDIO_VOLUME;
    el.src = audioPlaylist[audioIdx];
    // Attempt to play; swallow any error (e.g. browser still blocking)
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => { /* ignore */ });
    }
  }, [audioEnabled, audioPlaylist, audioIdx]);

  // Advance to the next track when the current one ends
  const handleTrackEnded = () => {
    setAudioIdx(prev => {
      const next = prev + 1;
      if (next >= audioPlaylist.length) {
        // Reshuffle and start over for variety
        setAudioPlaylist(shuffle(audioPlaylist));
        return 0;
      }
      return next;
    });
  };

  // Play the pose sound effect (air horn) on top of whatever soundtrack is
  // playing. Does nothing if no pose sound file was found or audio is disabled.
  const playPoseSound = () => {
    if (!POSE_SOUND_URL || !audioEnabled) return;
    const el = poseSoundRef.current;
    if (!el) return;
    try {
      el.volume = POSE_SOUND_VOLUME;
      el.muted = false;
      el.currentTime = 0; // restart if already playing
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => console.warn('[POSE SFX] play rejected:', err?.name));
      }
    } catch (e) {
      console.warn('[POSE SFX] error:', e);
    }
  };

  // ==========================================================================
  // PODIUM HIJACK
  // ==========================================================================
  // When the game ends, a video "hacks" the podium screen. Phase progression:
  //   idle -> flickering (TV-static squares stutter on/off for ~2.5s while
  //           podium is still visible) -> takeover (video goes fullscreen with
  //           max volume) -> done (video dismissed, podium returns)
  useEffect(() => {
    if (phase !== 'gameover' || !HIJACK_VIDEO_URL) {
      setHijackPhase('idle');
      return;
    }
    // Pause the soundtrack during hijack so we don't fight the video audio
    const wasPlaying = audioRef.current && !audioRef.current.paused;
    if (wasPlaying) audioRef.current.pause();

    // Step 1: brief delay so players see the podium first
    const t1 = setTimeout(() => setHijackPhase('flickering'), HIJACK_DELAY_MS);
    // Step 2: after flickering for 2.5s, switch to takeover phase.
    // IMPORTANT: do NOT try to play the video in this callback - the <video>
    // element isn't in the DOM yet. A separate effect listens for the phase
    // change and plays once the ref is attached.
    const t2 = setTimeout(() => setHijackPhase('takeover'), HIJACK_DELAY_MS + 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      // Resume soundtrack if it was playing and we're leaving gameover
      if (wasPlaying && audioRef.current && phase !== 'gameover') {
        audioRef.current.play().catch(() => {});
      }
    };
  }, [phase]);

  // Play the hijack video once the 'takeover' phase renders the <video>
  // element and the ref is attached. This is the fix for the race condition
  // where calling .play() inside the phase-setter saw a null ref.
  useEffect(() => {
    if (hijackPhase !== 'takeover') return;
    // Try repeatedly in case the video element isn't quite ready yet
    let attempts = 0;
    const tryPlay = () => {
      const el = hijackVideoRef.current;
      if (!el) {
        if (attempts++ < 20) {
          setTimeout(tryPlay, 50);
        } else {
          console.warn('[HIJACK] video ref never attached');
        }
        return;
      }
      el.volume = HIJACK_VIDEO_VOLUME;
      el.muted = false;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('[HIJACK] video.play() rejected:', err?.name, err?.message);
        });
      }
    };
    tryPlay();
  }, [hijackPhase]);

  // When video ends, fade back to the podium
  const handleHijackEnded = () => {
    setHijackPhase('done');
    // Audio remains paused at podium
  };

  // Dismiss hijack manually (clicking the video area or pressing anything)
  const dismissHijack = () => {
    if (hijackVideoRef.current) {
      try { hijackVideoRef.current.pause(); } catch (e) { /* ignore */ }
    }
    setHijackPhase('done');
    if (audioEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  // ==========================================================================
  // SETUP PHASE HANDLERS
  // ==========================================================================
  const startGameSetup = (count) => {
    setPlayerCount(count);
    setPlayers(Array(count).fill(null).map(() => ({ name: '', trait: null, drinksTotal: 0, lastRoundDrinks: 0 })));
  };

  const updatePlayerName = (idx, name) => {
    setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, name } : p));
  };

  // Called when DEPLOY is hit. Either go to the intro slides or straight to traits.
  const handleDeploy = () => {
    if (introEnabled) {
      setIntroSlide(0);
      setPhase('intro');
    } else {
      assignTraitsAndStart();
    }
  };

  const assignTraitsAndStart = () => {
    // Assign random traits, can repeat if >8 players
    const assignedTraits = players.map(() => pick(TRAITS));
    const playersWithTraits = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `Player ${i + 1}`,
      trait: assignedTraits[i],
    }));
    setPlayers(playersWithTraits);
    // Scale meter to player count: average net chaos per round ~1.5*n,
    // so 4.5*n means roughly 3 rounds to hit extreme with random play
    const computedMax = Math.max(20, Math.round(playersWithTraits.length * 4.5));
    setMeterMax(computedMax);
    setPhase('traits');
  };

  const beginFirstRound = () => {
    startNewRound(1);
  };

  // ==========================================================================
  // ROUND FLOW
  // ==========================================================================
  const startNewRound = (roundNum) => {
    // Pick an unused scenario (recycle if we run out)
    const available = SCENARIOS.filter((_, i) => !usedScenarios.includes(i));
    const pool = available.length > 0 ? available : SCENARIOS;
    const rawScenario = pick(pool);
    const scenarioIdx = SCENARIOS.indexOf(rawScenario);
    setUsedScenarios(prev => available.length > 0 ? [...prev, scenarioIdx] : [scenarioIdx]);
    // Clear cached descriptions so each round rolls fresh flavor text
    actionDescCacheRef.current = {};

    // Replace any famous-figure references in the text with random player names.
    // This happens at scenario-pick time so the same scenario can appear in a
    // different playthrough with different names.
    const scenario = {
      ...rawScenario,
      text: substituteNames(rawScenario.text, players),
    };

    // Generate a unique set of actions PER PLAYER:
    // - 3 actions total
    // - 25% individual chance that one slot is swapped for a wildcard
    // - When a wildcard rolls, Pose gets a ~50% share so it actually shows up
    const actionSets = {};
    const allActionsUsed = new Set();
    const poseAction = WILDCARDS.find(w => w.special === 'pose');
    const otherWildcards = WILDCARDS.filter(w => w.special !== 'pose');
    const nextPoseReceiptCounts = { ...poseReceiptCounts };

    const poseLimitFor = (playerName) => {
      const normalized = (playerName || '').trim().toLowerCase().replace(/\.$/, '');
      return /^(mads(?:\s+p)?)$/.test(normalized) ? 3 : 1;
    };
    const canReceivePose = (idx) => {
      const playerName = players[idx]?.name || '';
      const limit = poseLimitFor(playerName);
      return (nextPoseReceiptCounts[idx] || 0) < limit;
    };

    players.forEach((_, idx) => {
      const coreShuffled = shuffle(ACTIONS).slice(0, 3);
      const playerActions = [...coreShuffled];
      if (Math.random() < 0.25) {
        const wantsPose = poseAction && canReceivePose(idx) && Math.random() < 0.5;
        const chosenWildcard = wantsPose
          ? poseAction
          : pick(otherWildcards.length > 0 ? otherWildcards : WILDCARDS.filter(w => w.special !== 'pose'));
        const slotToReplace = Math.floor(Math.random() * 3);
        playerActions[slotToReplace] = chosenWildcard;
        if (wantsPose) {
          nextPoseReceiptCounts[idx] = (nextPoseReceiptCounts[idx] || 0) + 1;
        }
      }
      actionSets[idx] = playerActions;
      playerActions.forEach(a => allActionsUsed.add(a.id));
    });
    setPoseReceiptCounts(nextPoseReceiptCounts);

    // Build master action list (union of all player options) for lookups in computeResult
    const allActionsLookup = [...ACTIONS, ...WILDCARDS].filter(a => allActionsUsed.has(a.id));

    setCurrentScenario(scenario);
    setAvailableActions(allActionsLookup);
    setPlayerActionSets(actionSets);
    setPlayerPicks({});
    setCurrentPickerIdx(0);
    setRoundResult(null);
    setRound(roundNum);
    setPhase('scenario');
  };

  const advanceToPicking = () => {
    setPhase('picking');
  };

  const registerPick = (actionId) => {
    const newPicks = { ...playerPicks, [currentPickerIdx]: actionId };
    setPlayerPicks(newPicks);

    // If Pose was picked, show the chant before advancing
    const actionDef = [...ACTIONS, ...WILDCARDS].find(a => a.id === actionId);
    const isPose = actionDef && actionDef.special === 'pose';

    const advanceAfterPick = () => {
      if (currentPickerIdx + 1 < players.length) {
        setCurrentPickerIdx(currentPickerIdx + 1);
      } else {
        // All players have picked, compute result
        computeResult(newPicks);
      }
    };

    if (isPose) {
      playPoseSound(); // 🎺 AIR HORN
      setPoseChanter(players[currentPickerIdx].name);
      setPhase('posen-chant');
      // Note: advanceAfterPick is called when chant screen is dismissed
      // We stash it in closure via the chant screen's click handler below
      // For safety, set a state reference to what to do next
      setPendingAdvance(() => advanceAfterPick);
    } else {
      advanceAfterPick();
    }
  };

  const computeResult = (picks) => {
    const effective = getEffectiveActions(availableActions, currentScenario);
    const actionLookup = Object.fromEntries(effective.map(a => [a.id, a]));

    // Count popularity of each action
    const popularityCount = {};
    Object.values(picks).forEach(aid => {
      popularityCount[aid] = (popularityCount[aid] || 0) + 1;
    });
    const maxPop = Math.max(...Object.values(popularityCount));
    const popularActions = Object.keys(popularityCount).filter(k => popularityCount[k] === maxPop);

    // Calculate each player's effective contribution
    const contributions = players.map((player, idx) => {
      const actionId = picks[idx];
      const action = actionLookup[actionId];
      const isPopular = popularActions.includes(actionId);
      const modified = applyTrait(player.trait, action.effectiveChaos, action.effectiveDeflection, isPopular);
      return {
        playerIdx: idx,
        playerName: player.name,
        action,
        chaos: modified.chaos,
        deflection: modified.deflection,
      };
    });

    const totalChaos = contributions.reduce((s, c) => s + c.chaos, 0);
    const totalDeflection = contributions.reduce((s, c) => s + c.deflection, 0);
    const netChaos = totalChaos - totalDeflection;

    // Thresholds scale roughly with player count
    const n = players.length;
    const meltdownThreshold = 8 * n / 3; // ~8 per 3 players
    const weakThreshold = 1;

    // ----- ESCALATION METER SCALING -----
    // Scale max so the extremes are hit roughly every 6 rounds with random play.
    // Average net chaos per round ~ 1.5 * n. Using ~9 * n gives the desired frequency.
    // NOTE: We intentionally do NOT shadow the state variable `meterMax` with a local
    // `const meterMax` — that was a bug that caused the bar to display against a stale
    // max while the logic used a different one. Bar would show "100%" without ever
    // triggering a meltdown because the thresholds used a larger internal max.
    const computedMax = Math.max(20, Math.round(n * 9));
    // Sync the state max into the computed one if they drifted apart
    if (meterMax !== computedMax) {
      setMeterMax(computedMax);
    }
    const currentMeterMax = computedMax;

    // Zone layout - clearly separated so they don't overlap:
    //   neutral zone:   -40%  to  +40%  (green, safe)
    //   warning zone:   ±40%  to  ±80%  (danger — extra drink to everyone)
    //   extreme zone:   ±80%  to  ±100% (meltdown / irrelevance)
    const neutralEdgePos =  Math.round(currentMeterMax * 0.40);
    const neutralEdgeNeg = -Math.round(currentMeterMax * 0.40);
    const warningEdgePos =  Math.round(currentMeterMax * 0.80);
    const warningEdgeNeg = -Math.round(currentMeterMax * 0.80);

    // Determine outcome
    let outcome, drinkers, flavor;
    let extraDrinkAll = false;
    const projectedMeter = escalationMeter + netChaos - 3;
    const clampedMeter = Math.max(-currentMeterMax, Math.min(currentMeterMax, projectedMeter));
    // Cooldown magnitudes scale with max so they work for any player count
    const passiveCooldown = Math.max(1, Math.round(currentMeterMax * 0.05));
    // After an extreme: snap the meter well into the safe side of the neutral zone
    const extremeCooldownTarget = Math.round(currentMeterMax * 0.50);
    let nextMeter = clampedMeter;

    // 1. Check escalation meter extremes first (meter pushed into the extreme zone)
    const hitHotExtreme = clampedMeter >= warningEdgePos;
    const hitColdExtreme = clampedMeter <= warningEdgeNeg;
    if (hitHotExtreme) {
      outcome = 'meltdown';
      drinkers = players.map((_, i) => i);
      flavor = "☢️ ESCALATION METER MAXED. GLOBAL MELTDOWN. ALLE DRIKKER 2 TÅR.";
      // Snap back deep into the safe side of the neutral zone
      nextMeter = extremeCooldownTarget;
    } else if (hitColdExtreme) {
      outcome = 'weak';
      drinkers = players.map((_, i) => i);
      flavor = "💤 TOTAL IRRELEVANCE. THE WORLD HAS MOVED ON. ALLE DRIKKER 2 TÅR.";
      nextMeter = -extremeCooldownTarget;
    } else if (netChaos > meltdownThreshold) {
      outcome = 'meltdown';
      drinkers = players.map((_, i) => i);
      flavor = pick(OUTCOME_FLAVORS.meltdown);
    } else if (netChaos < weakThreshold && totalDeflection < n) {
      outcome = 'weak';
      drinkers = players.map((_, i) => i);
      flavor = pick(OUTCOME_FLAVORS.weak);
    } else if (totalDeflection > totalChaos * 1.5) {
      // Successful deflection - the most aggressive drink
      outcome = 'deflected';
      const minDrinkers = Math.max(1, Math.ceil(n / 3));
      const sortedByChaos = [...contributions].sort((a, b) => b.chaos - a.chaos);
      const withChaos = sortedByChaos.filter(c => c.chaos > 0);
      const topSlice = withChaos.slice(0, minDrinkers);
      drinkers = topSlice.length > 0 ? topSlice.map(c => c.playerIdx) : [pick(contributions).playerIdx];
      flavor = pick(OUTCOME_FLAVORS.deflected);
    } else {
      // Balanced zone - flip a coin for who drinks
      const minDrinkers = Math.max(1, Math.ceil(n / 3));
      const punishAggressive = Math.random() < 0.55;
      if (punishAggressive) {
        outcome = 'chaos_punish';
        const sortedByChaos = [...contributions].sort((a, b) => b.chaos - a.chaos);
        drinkers = sortedByChaos.slice(0, minDrinkers).map(c => c.playerIdx);
        flavor = pick(OUTCOME_FLAVORS.chaos_punish);
      } else {
        outcome = 'peace_punish';
        const sortedByChaos = [...contributions].sort((a, b) => a.chaos - b.chaos);
        drinkers = sortedByChaos.slice(0, minDrinkers).map(c => c.playerIdx);
        flavor = pick(OUTCOME_FLAVORS.peace_punish);
      }
    }

    // Sometimes just make everyone drink for fun if chaos is middling
    if (outcome !== 'meltdown' && outcome !== 'weak' && Math.random() < 0.08) {
      outcome = 'balanced';
      drinkers = players.map((_, i) => i);
      flavor = pick(OUTCOME_FLAVORS.balanced);
    }

    // 2. Passive cooldown: every non-extreme round the meter drifts slightly toward 0.
    // If we hit an extreme, skip passive cooldown — we already snapped into neutral.
    if (!hitHotExtreme && !hitColdExtreme) {
      if (nextMeter > 0) {
        nextMeter = Math.max(0, nextMeter - passiveCooldown);
      } else if (nextMeter < 0) {
        nextMeter = Math.min(0, nextMeter + passiveCooldown);
      }
    }

    // 3. Warning zone: extra drink for EVERYONE when the meter is in the
    // warning zone (between neutral edge and extreme edge). Uses the pre-cooldown
    // clampedMeter so the threat is based on where the round PUT the meter,
    // not where it settled after passive drift.
    const inDangerZone = (clampedMeter >= neutralEdgePos && clampedMeter < warningEdgePos) ||
                         (clampedMeter <= neutralEdgeNeg && clampedMeter > warningEdgeNeg);
    if (inDangerZone) {
      extraDrinkAll = true;
    }

    // Drink amount: meltdowns and irrelevance give 2 drinks to each drinker.
    // Everything else is 1. Danger-zone +1 stacks on top for all players.
    const baseDrinkAmount = outcome === 'meltdown' || outcome === 'weak' ? 2 : 1;

    // ----- ASCENSION: scale every drink by the global multiplier -----
    // Probabilistic rounding: floor the result, then promote to floor+1 with a
    // probability equal to the fractional part. This preserves the expected
    // value exactly while still giving whole drinks.
    // Example: 1 drink * 0.5x -> 50% chance of 1 drink, 50% chance of 0.
    // Example: 2 drinks * 2.2x -> 4.4 -> 40% chance of 5 drinks, 60% of 4.
    const ascensionMult = ASCENSION_MULTIPLIERS[ascension] ?? 1.0;
    const applyAscension = (raw) => {
      if (raw <= 0) return 0;
      const scaled = raw * ascensionMult;
      const floor = Math.floor(scaled);
      const frac = scaled - floor;
      return floor + (Math.random() < frac ? 1 : 0);
    };

    const updatedPlayers = players.map((p, i) => {
      const rawDrinks =
        (drinkers.includes(i) ? baseDrinkAmount : 0) +
        (extraDrinkAll ? 1 : 0);
      const drinksThisRound = applyAscension(rawDrinks);
      return { ...p, drinksTotal: p.drinksTotal + drinksThisRound, lastRoundDrinks: drinksThisRound };
    });
    const drinkAmount = baseDrinkAmount; // used in display below

    setRoundResult({
      outcome,
      flavor,
      drinkers,
      drinkAmount,
      contributions,
      totalChaos,
      totalDeflection,
      netChaos,
      extraDrinkAll,
      inDangerZone,
      nextMeter,
    });
    setPlayers(updatedPlayers);
    setFreshDrinkers(drinkers);

    // Determine meter change direction for animation
    const prevMeter = escalationMeter;
    setEscalationMeter(clampedMeter);
    if (clampedMeter > prevMeter + 2) {
      setMeterChangeDir('spike');
    } else if (clampedMeter < prevMeter - 2) {
      setMeterChangeDir('drop');
    } else {
      setMeterChangeDir(null);
    }
    setTimeout(() => setMeterChangeDir(null), 1000);

    // Flash effects:
    // - Red explosion ONLY on meltdown (#4)
    // - Green confetti on successful deflection
    // - No flash for balanced/weak/punish outcomes
    if (outcome === 'meltdown') {
      setFlash('red');
      setTimeout(() => setFlash(null), 2200);
    } else if (outcome === 'deflected' && !drinkers.includes(null)) {
      setFlash('green');
      setTimeout(() => setFlash(null), 2200);
    } else {
      setFlash(null);
    }
    setPhase('result');
  };

  const animateEscalationMeterTo = (target, duration = 1400) => {
    if (cooldownAnimationRef.current) {
      cancelAnimationFrame(cooldownAnimationRef.current);
      cooldownAnimationRef.current = null;
    }

    const startValue = escalationMeter;
    const delta = target - startValue;
    if (delta === 0) {
      setEscalationMeter(target);
      setMeterCooldownTarget(null);
      return;
    }

    setMeterCooldownTarget(target);
    const startTime = performance.now();

    const step = (timestamp) => {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + delta * eased);
      const clampedValue = Math.max(-meterMax, Math.min(meterMax, currentValue));
      setEscalationMeter(clampedValue);

      if (progress < 1) {
        cooldownAnimationRef.current = requestAnimationFrame(step);
      } else {
        cooldownAnimationRef.current = null;
        setMeterCooldownTarget(null);
      }
    };

    cooldownAnimationRef.current = requestAnimationFrame(step);
  };

  const advanceRound = () => {
    if (round >= TOTAL_ROUNDS) {
      setPhase('gameover');
    } else {
      if (roundResult && typeof roundResult.nextMeter === 'number') {
        animateEscalationMeterTo(roundResult.nextMeter, 3000);
      }
      startNewRound(round + 1);
    }
  };

  // ==========================================================================
  // STYLES
  // ==========================================================================
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;700&family=Archivo+Black&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body, .chaos-app {
      font-family: 'JetBrains Mono', monospace;
      background: #0a0a0a;
      color: #f5f5f0;
      min-height: 100vh;
      overflow-x: hidden;
    }
    
    .chaos-app {
      background: 
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
        radial-gradient(ellipse at top, #1a0a0a 0%, #0a0a0a 60%);
      position: relative;
      font-size: calc(16px * var(--zoom, 1));
    }
    /* Scale all rem-based sizes by propagating zoom to the container */
    .chaos-app .container {
      zoom: var(--zoom, 1);
    }
    
    .chaos-app::before {
      content: '';
      position: fixed; inset: 0;
      background-image: 
        radial-gradient(circle at 25% 25%, rgba(230, 57, 70, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 75% 75%, rgba(241, 196, 15, 0.05) 0%, transparent 50%);
      pointer-events: none; z-index: 0;
    }

    .ambient-images {
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }
    .ambient-image {
      position: absolute;
      opacity: 0;
      filter: blur(1.2px);
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      mix-blend-mode: screen;
      animation: ambientFloat var(--duration, 1.4s) ease-in-out infinite alternate;
      animation-delay: var(--delay, 0s);
      will-change: transform, opacity;
      animation-fill-mode: both;
    }
    @keyframes ambientFloat {
      0% {
        transform: translate(0, 0) scale(var(--start-scale, 1)) rotate(var(--start-rotation, 0deg));
        opacity: 0;
      }
      20% {
        opacity: 0.04;
      }
      50% {
        transform: translate(var(--dx, 0), var(--dy, 0)) scale(var(--end-scale, 1)) rotate(var(--end-rotation, 0deg));
        opacity: var(--opacity-max, 0.08);
      }
      80% {
        opacity: 0.05;
      }
      100% {
        transform: translate(0, 0) scale(var(--start-scale, 1)) rotate(var(--start-rotation, 0deg));
        opacity: 0;
      }
    }
    
    .grain {
      position: fixed; inset: 0; pointer-events: none; z-index: 1;
      opacity: 0.06;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    
    .container {
      max-width: 1800px; margin: 0 auto; padding: 14px 24px;
      position: relative; z-index: 2;
    }
    
    /* CORNER CONTROLS (restart + intro + zoom, stacked vertically) */
    .corner-controls {
      position: fixed; bottom: 10px; right: 10px; z-index: 100;
      display: flex; flex-direction: column; gap: 4px;
      align-items: stretch;
    }
    .zoom-control, .restart-control, .intro-control {
      background: rgba(10,10,10,0.85); backdrop-filter: blur(8px);
      border: 1px solid #333; padding: 4px 8px;
      display: flex; align-items: center; gap: 8px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      justify-content: space-between;
    }
    .zoom-control button, .restart-control button, .intro-control button {
      background: #1a1a1a; color: #f1c40f; border: 1px solid #333;
      height: 20px; min-width: 20px; cursor: pointer; font-weight: bold;
      font-family: 'JetBrains Mono', monospace;
      padding: 0 6px;
    }
    .zoom-control button:hover { background: #2a1010; border-color: #e63946; }
    .zoom-control .zoom-val { color: #ccc; min-width: 40px; text-align: center; }
    .zoom-control .lbl, .restart-control .lbl, .intro-control .lbl {
      color: #666; text-transform: uppercase; letter-spacing: 0.1em;
      font-size: 9px; font-family: 'Archivo Black', sans-serif;
    }
    .restart-control button {
      color: #e63946; border-color: #3a1010;
      letter-spacing: 0.1em; text-transform: uppercase;
      font-family: 'Archivo Black', sans-serif;
      font-size: 10px;
    }
    .restart-control button:hover { background: #3a1010; border-color: #e63946; color: #f5f5f0; }
    .restart-control button.armed {
      background: #e63946; color: #0a0a0a; border-color: #e63946;
      animation: armed-pulse 0.9s ease-in-out infinite;
    }
    @keyframes armed-pulse {
      0%, 100% { box-shadow: 0 0 0 rgba(230,57,70,0); }
      50%      { box-shadow: 0 0 14px rgba(230,57,70,0.8); }
    }
    /* Intro on/off toggle in corner */
    .intro-control button {
      letter-spacing: 0.12em; text-transform: uppercase;
      font-family: 'Archivo Black', sans-serif;
      font-size: 10px;
      color: #888; border-color: #333;
      min-width: 70px;
    }
    .intro-control button.on {
      color: #f1c40f; border-color: #8a6e00;
      background: #1a1500;
    }
    .intro-control button:hover {
      border-color: #f1c40f;
      color: #f1c40f;
      background: #2a2010;
    }
    
    /* ============================================================ */
    /* AUDIO ENABLE OVERLAY                                          */
    /* ============================================================ */
    .audio-enable-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(10, 10, 10, 0.88);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      animation: audio-overlay-in 0.3s ease-out;
    }
    @keyframes audio-overlay-in {
      0%   { opacity: 0; }
      100% { opacity: 1; }
    }
    .audio-enable-card {
      background: linear-gradient(135deg, rgba(26,10,10,0.9), rgba(10,10,26,0.9));
      border: 3px solid #f1c40f;
      padding: 48px 64px;
      text-align: center;
      box-shadow:
        8px 8px 0 #e63946,
        0 0 60px rgba(241,196,15,0.3);
      max-width: 500px;
    }
    .audio-enable-icon {
      font-size: 4rem; line-height: 1;
      margin-bottom: 14px;
      animation: audio-icon-pulse 1.8s ease-in-out infinite;
    }
    @keyframes audio-icon-pulse {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(241,196,15,0.6)); }
      50%      { transform: scale(1.1); filter: drop-shadow(0 0 18px rgba(241,196,15,1)); }
    }
    .audio-enable-title {
      font-family: 'Anton', sans-serif;
      font-size: 2.2rem; color: #f1c40f;
      letter-spacing: 0.05em; text-transform: uppercase;
      line-height: 1.1; margin-bottom: 14px;
      text-shadow: 3px 3px 0 #e63946;
    }
    .audio-enable-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem; color: #aaa;
      letter-spacing: 0.05em; line-height: 1.4;
      margin-bottom: 24px;
    }
    .audio-enable-skip {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem; color: #666;
      letter-spacing: 0.1em;
      cursor: pointer;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
      padding: 6px 12px;
    }
    .audio-enable-skip:hover { color: #f1c40f; }

    /* ============================================================ */
    /* PODIUM HIJACK - signal interruption overlay                   */
    /* ============================================================ */
    .hijack-overlay {
      position: fixed; inset: 0; z-index: 800;
      pointer-events: none;
    }
    .hijack-overlay.hijack-takeover {
      pointer-events: auto;
      background: #000;
      cursor: pointer;
    }
    
    /* FLICKER PHASE - squares of static punching through the podium */
    .hijack-flicker-grid {
      position: absolute; inset: 0;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(6, 1fr);
      gap: 0;
      pointer-events: none;
    }
    .hijack-square {
      /* Each square is a small patch of "broken signal" that flashes on/off
         at random intervals. The animation is infinite during the flicker
         phase. Content alternates between chroma bars and static noise. */
      position: relative;
      background: #000;
      opacity: 0;
      animation-name: hijack-flicker;
      animation-iteration-count: infinite;
      animation-timing-function: steps(2, jump-none);
      will-change: opacity, background;
    }
    .hijack-square::before {
      content: ''; position: absolute; inset: 0;
      background-image:
        repeating-linear-gradient(0deg,
          rgba(255,255,255,0.9) 0px, rgba(255,255,255,0.9) 1px,
          rgba(0,0,0,0.9) 1px, rgba(0,0,0,0.9) 2px),
        repeating-linear-gradient(90deg,
          rgba(255,0,0,0.3) 0, rgba(255,0,0,0.3) 3px,
          rgba(0,255,0,0.3) 3px, rgba(0,255,0,0.3) 6px,
          rgba(0,0,255,0.3) 6px, rgba(0,0,255,0.3) 9px);
      mix-blend-mode: screen;
    }
    /* Alternating square variants - some are chroma bars, some are pure static */
    .hijack-square:nth-child(3n) {
      animation-name: hijack-flicker-chroma;
    }
    .hijack-square:nth-child(3n)::before {
      background-image:
        linear-gradient(to right,
          #fff 0%, #fff 12.5%,
          #ff0 12.5%, #ff0 25%,
          #0ff 25%, #0ff 37.5%,
          #0f0 37.5%, #0f0 50%,
          #f0f 50%, #f0f 62.5%,
          #f00 62.5%, #f00 75%,
          #00f 75%, #00f 87.5%,
          #000 87.5%, #000 100%);
    }
    .hijack-square:nth-child(5n) {
      animation-name: hijack-flicker-red;
    }
    .hijack-square:nth-child(5n)::before {
      background: #e63946;
      mix-blend-mode: multiply;
    }
    
    @keyframes hijack-flicker {
      0%, 100% { opacity: 0; }
      50%      { opacity: 1; }
    }
    @keyframes hijack-flicker-chroma {
      0%, 100% { opacity: 0; }
      50%      { opacity: 0.85; }
    }
    @keyframes hijack-flicker-red {
      0%, 100% { opacity: 0; }
      50%      { opacity: 0.6; }
    }
    
    .hijack-scanlines {
      position: absolute; inset: 0;
      background-image: repeating-linear-gradient(
        180deg,
        transparent 0, transparent 2px,
        rgba(0, 0, 0, 0.25) 2px, rgba(0, 0, 0, 0.25) 3px
      );
      animation: hijack-scanroll 8s linear infinite;
      pointer-events: none;
      mix-blend-mode: multiply;
    }
    @keyframes hijack-scanroll {
      0%   { transform: translateY(0); }
      100% { transform: translateY(100px); }
    }
    
    .hijack-signal-text {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Anton', sans-serif;
      font-size: clamp(2rem, 5vw, 4rem);
      color: #e63946;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      text-shadow:
        2px 0 0 #0f0,
        -2px 0 0 #00f,
        0 0 20px rgba(230,57,70,0.9);
      animation: hijack-text-glitch 0.18s steps(2) infinite;
      mix-blend-mode: screen;
      white-space: nowrap;
    }
    @keyframes hijack-text-glitch {
      0%, 100% {
        transform: translate(-50%, -50%);
        text-shadow: 2px 0 0 #0f0, -2px 0 0 #00f, 0 0 20px rgba(230,57,70,0.9);
      }
      50% {
        transform: translate(calc(-50% + 4px), calc(-50% - 2px));
        text-shadow: -3px 0 0 #0f0, 3px 0 0 #f0f, 0 0 30px rgba(230,57,70,1);
      }
    }
    
    /* TAKEOVER PHASE - fullscreen video */
    .hijack-video {
      position: absolute;
      inset: 0;
      width: 100%; height: 100%;
      object-fit: contain;
      background: #000;
      animation: hijack-video-in 0.3s steps(4, jump-none);
    }
    @keyframes hijack-video-in {
      0%   { opacity: 0; filter: saturate(3) contrast(2); }
      50%  { opacity: 1; filter: saturate(3) contrast(2); }
      100% { opacity: 1; filter: none; }
    }
    .hijack-dismiss-hint {
      position: absolute;
      bottom: 18px; right: 18px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem; color: rgba(255,255,255,0.4);
      letter-spacing: 0.1em;
      pointer-events: none;
    }

    /* EXPLOSION EFFECT (red - bad outcomes) */
    .explosion {
      position: fixed; inset: 0; z-index: 999; pointer-events: none;
      overflow: hidden;
    }
    .explosion .shockwave {
      position: absolute; top: 50%; left: 50%;
      width: 100px; height: 100px;
      border: 4px solid #ffcc00;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      animation: shockwave 1.2s ease-out forwards;
    }
    .explosion .fireball {
      position: absolute; top: 50%; left: 50%;
      width: 200px; height: 200px;
      border-radius: 50%;
      background: radial-gradient(circle, #ffdd00 0%, #ff6b00 25%, #e63946 55%, #4a0000 85%, transparent 100%);
      transform: translate(-50%, -50%) scale(0);
      filter: blur(4px);
      animation: fireball 1.4s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
      mix-blend-mode: screen;
    }
    .explosion .smoke {
      position: absolute; top: 50%; left: 50%;
      width: 300px; height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(60,60,60,0.9) 0%, rgba(30,30,30,0.6) 50%, transparent 80%);
      transform: translate(-50%, -50%) scale(0);
      filter: blur(20px);
      animation: smoke 2s ease-out forwards;
    }
    .explosion .flash-bg {
      position: absolute; inset: 0;
      background: radial-gradient(circle at center, rgba(255,180,0,0.6), rgba(230,57,70,0.3) 40%, transparent 70%);
      animation: flashbg 0.8s ease-out forwards;
    }
    .explosion .ember {
      position: absolute; width: 8px; height: 8px; border-radius: 50%;
      background: radial-gradient(circle, #ffdd00, #ff6b00);
      box-shadow: 0 0 12px #ff6b00, 0 0 24px #e63946;
      top: 50%; left: 50%;
      animation: ember 1.5s ease-out forwards;
    }
    @keyframes shockwave {
      0% { width: 50px; height: 50px; opacity: 1; border-width: 6px; }
      100% { width: 2400px; height: 2400px; opacity: 0; border-width: 1px; }
    }
    @keyframes fireball {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      20% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
      60% { transform: translate(-50%, -50%) scale(3); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(5); opacity: 0; }
    }
    @keyframes smoke {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
      30% { opacity: 0.9; }
      100% { transform: translate(-50%, -50%) scale(7); opacity: 0; }
    }
    @keyframes flashbg {
      0% { opacity: 0; }
      10% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes ember {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
      100% {
        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2);
        opacity: 0;
      }
    }
    
    /* CONFETTI (green - good outcomes) */
    .confetti-wrap {
      position: fixed; inset: 0; z-index: 999; pointer-events: none;
      overflow: hidden;
    }
    .confetti-wrap .celebration-flash {
      position: absolute; inset: 0;
      background: radial-gradient(circle at center, rgba(39,174,96,0.5), rgba(39,174,96,0.15) 40%, transparent 70%);
      animation: flashbg 0.7s ease-out forwards;
    }
    .confetti {
      position: absolute;
      width: 10px; height: 14px;
      top: 50%; left: 50%;
      transform-origin: center;
      animation: confetti-fall 2.2s cubic-bezier(0.2, 0.6, 0.4, 1) forwards;
    }
    @keyframes confetti-fall {
      0% {
        transform: translate(-50%, -50%) rotate(0deg);
        opacity: 1;
      }
      20% { opacity: 1; }
      100% {
        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy, 500px))) rotate(var(--rot));
        opacity: 0.5;
      }
    }
    
    /* TYPOGRAPHY */
    .display-title {
      font-family: 'Anton', sans-serif;
      font-size: clamp(2.5rem, 7vw, 5rem);
      line-height: 0.9;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }
    .chyron {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    
    /* TOP BAR */
    .top-bar {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 3px solid #e63946;
      padding-bottom: 12px; margin-bottom: 24px;
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.15em;
    }
    .top-bar .live {
      color: #e63946; display: flex; align-items: center; gap: 8px;
    }
    .top-bar .live::before {
      content: ''; width: 10px; height: 10px; background: #e63946;
      border-radius: 50%; animation: pulse 1.2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }
    
    /* ============================================================ */
    /* INTRO SLIDES - multi-step briefing                            */
    /* ============================================================ */
    .intro-wrap {
      max-width: 1080px; margin: 0 auto;
      padding: 22px 18px; position: relative;
      min-height: 65vh;
      display: flex; flex-direction: column; justify-content: center;
    }
    
    /* Progress ticks at the top */
    .intro-progress {
      display: flex; gap: 6px; justify-content: center;
      margin-bottom: 18px;
    }
    .intro-progress-tick {
      width: 44px; height: 5px;
      background: #1a1a1a;
      border: 1px solid #333;
      transition: all 0.3s ease;
    }
    .intro-progress-tick.done {
      background: #444;
      border-color: #555;
    }
    .intro-progress-tick.active {
      background: #f1c40f;
      border-color: #f1c40f;
      box-shadow: 0 0 10px rgba(241,196,15,0.7);
    }
    
    /* The slide card itself - brutalist briefing document */
    .intro-card {
      background: linear-gradient(180deg, rgba(26,10,10,0.5), rgba(10,10,26,0.5));
      border: 3px solid #f1c40f;
      padding: 32px 36px;
      position: relative;
      animation: intro-card-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow:
        10px 10px 0 #e63946,
        0 0 60px rgba(241,196,15,0.12);
      width: 100%;
      max-width: 1080px;
      margin: 0 auto;
      text-align: center;
    }
    .intro-card::before {
      content: '';
      position: absolute; inset: -3px;
      background-image: repeating-linear-gradient(
        45deg,
        transparent 0, transparent 16px,
        rgba(241,196,15,0.04) 16px, rgba(241,196,15,0.04) 18px
      );
      pointer-events: none;
      z-index: 0;
    }
    .intro-card > * { position: relative; z-index: 1; }
    @keyframes intro-card-in {
      0%   { opacity: 0; transform: translateY(20px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    .intro-badge {
      font-family: 'Archivo Black', sans-serif;
      font-size: 1.5rem; letter-spacing: 0.25em;
      color: #e63946;
      padding: 4px 12px 4px 0;
      display: inline-block;
      border-bottom: 2px solid #e63946;
      margin-bottom: 18px;
    }
    
    .intro-title {
      font-family: 'Anton', sans-serif;
      font-size: clamp(2rem, 5vw, 3.8rem);
      line-height: 1.05;
      letter-spacing: -0.01em;
      text-transform: uppercase;
      margin-bottom: 18px;
      color: #f5f5f0;
    }
    .intro-title > div { display: block; }
    
    .intro-body {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.7rem;
      line-height: 1.65;
      color: #ddd;
      margin: 0 auto 18px;
      max-width: 920px;
    }
    
    .intro-footer {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #888;
      letter-spacing: 0.02em;
      padding-top: 18px;
      border-top: 1px dashed #444;
      font-style: italic;
    }
    
    /* Nav row */
    .intro-controls {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
    }
    .intro-nav-btn {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.1em;
      font-size: 1rem;
      padding: 10px 18px;
      cursor: pointer;
      background: #1a1a1a; color: #f5f5f0;
      border: 2px solid #333;
      transition: all 0.15s;
    }
    .intro-nav-btn:hover:not(:disabled) {
      border-color: #f1c40f; background: #2a2010;
      transform: translateY(-2px);
    }
    .intro-nav-btn:disabled {
      opacity: 0.3; cursor: not-allowed;
    }
    .intro-nav-btn.back {
      justify-self: start;
    }
    .intro-nav-btn.next, .intro-nav-btn.deploy {
      justify-self: end;
    }
    .intro-nav-btn.deploy {
      background: #e63946; color: #0a0a0a;
      border-color: #e63946;
      box-shadow: 4px 4px 0 #f1c40f;
    }
    .intro-nav-btn.deploy:hover {
      transform: translate(1px, 1px);
      box-shadow: 3px 3px 0 #f1c40f;
      border-color: #e63946;
    }
    .intro-count {
      font-family: 'JetBrains Mono', monospace;
      color: #888; font-size: 0.85rem;
      letter-spacing: 0.1em;
      justify-self: center;
    }
    
    .intro-skip {
      display: block;
      margin: 12px auto 0;
      background: transparent; border: none;
      color: #666;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem; letter-spacing: 0.1em;
      cursor: pointer;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
    .intro-skip:hover { color: #f1c40f; }
    
    @media (max-width: 700px) {
      .intro-card { padding: 30px 24px; }
      .intro-controls { grid-template-columns: 1fr 1fr; }
      .intro-count { grid-column: 1 / -1; order: -1; margin-bottom: 4px; }
    }

    /* SETUP SCREEN */
    .setup-hero {
      text-align: center; padding: 24px 0 18px;
    }
    .setup-hero h1 {
      font-family: 'Anton', sans-serif;
      font-size: clamp(3rem, 10vw, 7rem);
      line-height: 0.85;
      letter-spacing: -0.03em;
      text-transform: uppercase;
      color: #f5f5f0;
      text-shadow: 6px 6px 0 #e63946, -2px -2px 0 #f1c40f;
    }
    .setup-hero .sub {
      font-family: 'Archivo Black', sans-serif;
      font-size: clamp(0.9rem, 2vw, 1.2rem);
      color: #f1c40f;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .setup-hero .warning {
      font-family: 'JetBrains Mono', monospace;
      color: #888; font-size: 0.75rem;
      padding: 8px 10px; border: 1px dashed #444;
      max-width: 240px;
      text-align: left;
      line-height: 1.5;
      position: absolute;
      right: 10px; top: 10px;
    }
    @media (max-width: 1100px) {
      .setup-hero .warning {
        position: static;
        margin: 14px auto 0;
        max-width: 500px;
        text-align: center;
      }
    }
    .setup-hero { position: relative; }
    
    /* Two-column layout when picking players */
    .setup-two-col {
      display: grid; grid-template-columns: 1fr 1.5fr;
      gap: 24px; align-items: start;
      margin: 18px 0;
    }
    @media (max-width: 900px) {
      .setup-two-col { grid-template-columns: 1fr; gap: 24px; }
    }

    /* ============================================================ */
    /* ASCENSION SLIDER                                              */
    /* ============================================================ */
    .ascension-panel {
      background: linear-gradient(135deg, rgba(26,10,10,0.6), rgba(10,10,26,0.6));
      border: 2px solid #333;
      padding: 14px 18px;
      margin: 16px 0 6px;
      position: relative;
    }
    .ascension-panel .asc-header {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-bottom: 10px;
      flex-wrap: wrap; gap: 8px;
    }
    .ascension-panel .asc-title {
      font-family: 'Archivo Black', sans-serif;
      font-size: 0.85rem; letter-spacing: 0.2em;
      color: #f1c40f; text-transform: uppercase;
    }
    .ascension-panel .asc-readout {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem; color: #aaa;
      letter-spacing: 0.05em;
    }
    .ascension-panel .asc-level {
      font-family: 'Anton', sans-serif;
      font-size: 1.4rem; color: #f5f5f0;
      vertical-align: -1px; margin: 0 6px;
    }
    .ascension-panel .asc-mult {
      color: #f1c40f; font-weight: bold;
    }
    .ascension-slider {
      -webkit-appearance: none; appearance: none;
      width: 100%;
      height: 10px;
      background: linear-gradient(90deg,
        #3498db 0%, #27ae60 40%, #f1c40f 70%, #e63946 100%);
      border: 1px solid #444;
      outline: none;
      cursor: pointer;
    }
    .ascension-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 28px; height: 28px;
      background: #0a0a0a;
      border: 3px solid #f1c40f;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(241,196,15,0.6);
      border-radius: 0;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .ascension-slider::-webkit-slider-thumb:hover {
      transform: scale(1.15);
      box-shadow: 0 0 18px rgba(241,196,15,1);
    }
    .ascension-slider::-moz-range-thumb {
      width: 28px; height: 28px;
      background: #0a0a0a;
      border: 3px solid #f1c40f;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(241,196,15,0.6);
      border-radius: 0;
    }
    .ascension-ticks {
      display: grid;
      grid-template-columns: repeat(11, 1fr);
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem; color: #666;
      text-align: center;
    }
    .ascension-ticks .tick {
      transition: color 0.15s;
    }
    .ascension-ticks .tick.active {
      color: #f1c40f;
      font-weight: bold;
    }
    .ascension-ticks .tick.baseline::after {
      content: '★';
      display: block; color: #888; font-size: 0.6rem;
    }
    .ascension-ticks .tick.baseline.active::after {
      color: #f1c40f;
    }
    .asc-flavor {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem; color: #888;
      margin-top: 6px; letter-spacing: 0.03em;
      line-height: 1.4;
    }
    .asc-flavor.low { color: #3498db; }
    .asc-flavor.high { color: #e63946; }
    .setup-col-header {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.15em;
      color: #f1c40f; font-size: 0.85rem;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #333;
    }
    
    .count-select {
      text-align: left;
    }
    .count-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    }
    .count-btn {
      background: #1a1a1a; color: #f5f5f0; border: 2px solid #333;
      padding: 12px 0; font-family: 'Anton', sans-serif;
      font-size: 1.8rem; cursor: pointer;
      transition: all 0.15s;
    }
    .count-btn:hover { border-color: #e63946; background: #2a1010; transform: translateY(-2px); }
    .count-btn.active {
      background: #e63946; border-color: #e63946;
      box-shadow: 4px 4px 0 #f1c40f;
    }
    
    .name-form {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 8px 12px;
    }
    @media (max-width: 600px) {
      .name-form { grid-template-columns: 1fr; }
    }
    .name-row {
      display: flex; align-items: center; gap: 10px;
    }
    .name-row .num {
      font-family: 'Anton', sans-serif;
      font-size: 1.4rem; color: #e63946; min-width: 38px;
    }
    .name-row input {
      flex: 1; background: #111; border: 2px solid #333; color: #f5f5f0;
      padding: 8px 10px; font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem; text-transform: uppercase;
      min-width: 0;
    }
    .name-row input:focus { outline: none; border-color: #f1c40f; }
    .name-placeholder {
      color: #444; font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem; text-align: center; padding: 24px 16px;
      border: 1px dashed #333;
    }
    
    /* BUTTONS */
    .big-btn {
      display: block; width: 100%; max-width: 500px; margin: 16px auto;
      background: #e63946; color: #0a0a0a;
      font-family: 'Anton', sans-serif; font-size: 1.8rem;
      letter-spacing: 0.05em; text-transform: uppercase;
      padding: 14px; border: none; cursor: pointer;
      box-shadow: 8px 8px 0 #f1c40f;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .big-btn:hover { transform: translate(2px, 2px); box-shadow: 6px 6px 0 #f1c40f; }
    .big-btn:active { transform: translate(8px, 8px); box-shadow: 0 0 0 #f1c40f; }
    .big-btn.secondary { background: #f1c40f; box-shadow: 8px 8px 0 #e63946; }
    .big-btn.secondary:hover { box-shadow: 6px 6px 0 #e63946; }
    
    /* TRAITS REVEAL */
    .traits-intro {
      text-align: center; padding: 12px 0;
    }
    .traits-intro h1 {
      font-family: 'Anton', sans-serif;
      font-size: clamp(3.5rem, 10vw, 7rem);
      line-height: 1; letter-spacing: -0.02em;
      text-transform: uppercase; white-space: nowrap;
      text-shadow: 5px 5px 0 #e63946, -2px -2px 0 #f1c40f;
      margin-bottom: 12px;
    }
    .traits-intro p {
      max-width: 1000px; margin: 0 auto 12px;
      line-height: 1.5; color: #ccc; font-size: 1.15rem;
    }
    .traits-intro p.sub {
      font-size: 1rem; color: #999;
    }
    .trait-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 10px;
      margin: 18px 0;
    }
    .trait-card {
      background: rgba(0,0,0,0.5);
      border: 2px solid #333;
      padding: 16px 18px;
      display: flex; flex-direction: column;
      gap: 10px; min-height: 130px;
      transition: border-color 0.2s;
    }
    .trait-card.revealed { border-color: #f1c40f; background: rgba(26,22,0,0.6); }
    .trait-card .pname {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.08em;
      font-size: 1.35rem; color: #f5f5f0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .trait-card .trait-slot {
      flex: 1; display: flex; align-items: center; justify-content: center;
    }
    .trait-reveal-btn {
      background: #1a1a1a; color: #aaa; border: 1px solid #333;
      padding: 12px 16px; cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 1rem; text-transform: uppercase; letter-spacing: 0.15em;
      width: 100%;
    }
    .trait-reveal-btn:hover { color: #f1c40f; border-color: #f1c40f; }
    .trait-revealed {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      text-align: center;
    }
    .trait-revealed .tname {
      font-family: 'Anton', sans-serif; font-size: 2rem;
      color: #f1c40f; line-height: 1;
    }
    .trait-revealed .tdesc {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem; color: #aaa;
      line-height: 1.4;
    }
    .trait-revealed .hide-btn {
      margin-top: 4px; background: transparent; color: #888;
      border: 1px solid #555; padding: 4px 10px; cursor: pointer;
      font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;
      text-transform: uppercase; letter-spacing: 0.12em;
    }
    .trait-revealed .hide-btn:hover { color: #e63946; border-color: #e63946; }
    
    /* ESCALATION METER */
    .meter-container {
      margin: 14px 0;
      padding: 12px 14px;
      background: linear-gradient(135deg, rgba(26,10,10,0.6), rgba(10,10,26,0.6));
      border: 2px solid #333;
      position: relative;
    }
    .meter-container.hot { border-color: #e63946; }
    .meter-container.cold { border-color: #3498db; }
    .meter-container.idle { border-color: #555; }
    .meter-label {
      display: flex; justify-content: space-between; align-items: center;
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em;
      margin-bottom: 8px;
    }
    .meter-label .left { color: #3498db; }
    .meter-label .center {
      color: #f1c40f; font-size: 0.95rem; letter-spacing: 0.2em;
    }
    .meter-label .right { color: #e63946; }
    .meter-bar {
      height: 32px; background: #0a0a0a;
      border: 1px solid #333;
      position: relative; overflow: visible;
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);
      margin-bottom: 10px;
    }
    .meter-bar > .meter-fill {
      overflow: hidden;
    }
    /* Clip the inner background pattern only, but allow flames to overflow */
    .meter-bar::before {
      content: ''; position: absolute; inset: 0;
      background-image: repeating-linear-gradient(90deg,
        transparent 0, transparent 9%,
        rgba(255,255,255,0.06) 9%, rgba(255,255,255,0.06) 10%);
      pointer-events: none; z-index: 1;
    }
    .meter-center-line {
      position: absolute; top: -4px; bottom: -4px; left: 50%;
      width: 3px; background: #888; z-index: 4;
      box-shadow: 0 0 6px rgba(255,255,255,0.3);
    }
    .meter-fill {
      position: absolute; top: 0; bottom: 0;
      transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2;
    }
    .meter-fill.pos {
      left: 50%;
      background: linear-gradient(90deg, #f1c40f 0%, #ff6b00 50%, #e63946 100%);
      box-shadow: 0 0 20px rgba(230,57,70,0.6);
    }
    .meter-fill.neg {
      right: 50%;
      background: linear-gradient(270deg, #3498db 0%, #2c3e50 100%);
      box-shadow: 0 0 20px rgba(52,152,219,0.4);
    }
    /* Fire layer on top when hot */
    .meter-fill.pos.active::after {
      content: ''; position: absolute; inset: 0;
      background: 
        radial-gradient(ellipse at 20% 100%, rgba(255,221,0,0.9), transparent 60%),
        radial-gradient(ellipse at 60% 100%, rgba(255,107,0,0.8), transparent 55%),
        radial-gradient(ellipse at 85% 100%, rgba(255,221,0,0.7), transparent 50%);
      animation: firelick 1.2s ease-in-out infinite alternate;
      mix-blend-mode: screen;
    }
    @keyframes firelick {
      0% { opacity: 0.6; transform: translateY(2px) scaleY(0.9); }
      100% { opacity: 1; transform: translateY(-2px) scaleY(1.1); }
    }
    /* Cool/frost shimmer on cold side */
    .meter-fill.neg.active::after {
      content: ''; position: absolute; inset: 0;
      background: 
        radial-gradient(ellipse at 30% 50%, rgba(180,220,255,0.5), transparent 60%),
        radial-gradient(ellipse at 70% 50%, rgba(100,180,255,0.3), transparent 60%);
      animation: frostshimmer 2s ease-in-out infinite alternate;
      mix-blend-mode: screen;
    }
    @keyframes frostshimmer {
      0% { opacity: 0.4; }
      100% { opacity: 0.8; }
    }
    /* Idle pulse when meter is near zero */
    .meter-bar.idle-pulse {
      animation: idlepulse 3s ease-in-out infinite;
    }
    @keyframes idlepulse {
      0%, 100% { box-shadow: inset 0 2px 6px rgba(0,0,0,0.6); }
      50% { box-shadow: inset 0 2px 6px rgba(0,0,0,0.6), 0 0 18px rgba(241,196,15,0.18); }
    }
    /* Transient effects on change */
    .meter-container.spike {
      animation: spike 0.8s ease-out;
    }
    @keyframes spike {
      0% { transform: scale(1); box-shadow: 0 0 0 rgba(230,57,70,0); }
      30% { transform: scale(1.02); box-shadow: 0 0 40px rgba(230,57,70,0.7); }
      100% { transform: scale(1); box-shadow: 0 0 0 rgba(230,57,70,0); }
    }
    .meter-container.drop {
      animation: drop 0.8s ease-out;
    }
    @keyframes drop {
      0% { transform: scale(1); box-shadow: 0 0 0 rgba(52,152,219,0); }
      30% { transform: scale(0.98); box-shadow: 0 0 40px rgba(52,152,219,0.6); }
      100% { transform: scale(1); box-shadow: 0 0 0 rgba(52,152,219,0); }
    }
    /* Floating embers on fire */
    .meter-ember {
      position: absolute; bottom: 0; width: 3px; height: 3px; border-radius: 50%;
      background: #ffdd00; box-shadow: 0 0 6px #ff6b00;
      pointer-events: none; z-index: 5;
      animation: ember-rise 1.8s linear infinite;
    }
    @keyframes ember-rise {
      0% { transform: translateY(0); opacity: 0; }
      20% { opacity: 1; }
      100% { transform: translateY(-60px) translateX(var(--drift, 10px)); opacity: 0; }
    }
    /* Persistent flames flickering on the bar (#3) */
    .meter-flame {
      position: absolute; bottom: -6px;
      font-size: 1.5rem;
      pointer-events: none; z-index: 5;
      animation: flame-flicker 1.6s ease-in-out infinite;
      filter: drop-shadow(0 0 6px #ff6b00);
    }
    @keyframes flame-flicker {
      0%, 100% { transform: translateY(0) scale(1); opacity: 0.85; }
      40%      { transform: translateY(-12px) scale(1.15); opacity: 1; }
      60%      { transform: translateY(-8px) scale(0.92); opacity: 0.9; }
      80%      { transform: translateY(-14px) scale(1.05); opacity: 0.95; }
    }
    /* Persistent snowflakes drifting down on the cold side (#3) */
    .meter-snowflake {
      position: absolute; top: -6px;
      font-size: 0.95rem;
      pointer-events: none; z-index: 5;
      color: #c8e6ff;
      animation: snow-fall 2.5s linear infinite;
      filter: drop-shadow(0 0 4px #88ccff);
    }
    @keyframes snow-fall {
      0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
      15%  { opacity: 1; }
      100% { transform: translateY(50px) translateX(var(--drift, 8px)) rotate(360deg); opacity: 0; }
    }
    /* Frost crystals slowly forming on the bar */
    .meter-frost {
      position: absolute; bottom: 4px;
      width: 8px; height: 8px;
      pointer-events: none; z-index: 4;
      background: radial-gradient(circle, #c8e6ff 0%, rgba(200,230,255,0.4) 60%, transparent 100%);
      border-radius: 50%;
      animation: frost-pulse 2.2s ease-in-out infinite;
    }
    @keyframes frost-pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.8); }
      50%      { opacity: 0.9; transform: scale(1.3); }
    }
    /* Zone shading on the meter bar */
    .meter-zone {
      position: absolute; top: 0; bottom: 0; z-index: 0;
      pointer-events: none;
    }
    .meter-zone.zone-neutral {
      left: 30%; width: 40%;
      background: linear-gradient(90deg,
        transparent 0%, rgba(39,174,96,0.10) 20%,
        rgba(39,174,96,0.16) 50%, rgba(39,174,96,0.10) 80%, transparent 100%);
    }
    .meter-zone.zone-warning-hot {
      left: 70%; width: 20%;
      background: repeating-linear-gradient(-45deg,
        rgba(241,196,15,0.20) 0, rgba(241,196,15,0.20) 6px,
        rgba(230,57,70,0.15) 6px, rgba(230,57,70,0.15) 12px);
    }
    .meter-zone.zone-warning-cold {
      left: 10%; width: 20%;
      background: repeating-linear-gradient(45deg,
        rgba(52,152,219,0.18) 0, rgba(52,152,219,0.18) 6px,
        rgba(180,180,200,0.12) 6px, rgba(180,180,200,0.12) 12px);
    }
    .meter-zone.zone-extreme-hot {
      left: 90%; width: 10%;
      background: repeating-linear-gradient(-45deg,
        rgba(230,57,70,0.45) 0, rgba(230,57,70,0.45) 5px,
        rgba(0,0,0,0.45) 5px, rgba(0,0,0,0.45) 10px);
    }
    .meter-zone.zone-extreme-cold {
      left: 0%; width: 10%;
      background: repeating-linear-gradient(45deg,
        rgba(52,152,219,0.45) 0, rgba(52,152,219,0.45) 5px,
        rgba(0,0,0,0.45) 5px, rgba(0,0,0,0.45) 10px);
    }
    /* Border emphasis when in warning zones */
    .meter-container.warning-hot {
      animation: warning-pulse-hot 1.4s ease-in-out infinite;
    }
    .meter-container.warning-cold {
      animation: warning-pulse-cold 1.6s ease-in-out infinite;
    }
    @keyframes warning-pulse-hot {
      0%, 100% { box-shadow: 0 0 12px rgba(230,57,70,0.4); border-color: #e63946; }
      50%      { box-shadow: 0 0 32px rgba(230,57,70,0.8); border-color: #ff6b00; }
    }
    @keyframes warning-pulse-cold {
      0%, 100% { box-shadow: 0 0 12px rgba(52,152,219,0.4); border-color: #3498db; }
      50%      { box-shadow: 0 0 28px rgba(52,152,219,0.8); border-color: #88ccff; }
    }
    .meter-value {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
      font-family: 'Anton', sans-serif; font-size: 1.4rem; z-index: 6;
      color: white;
      text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
      letter-spacing: 0.02em;
    }
    .meter-status {
      margin-top: 6px; font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem; text-align: center;
      color: #888; letter-spacing: 0.05em;
    }
    .meter-status.hot { color: #e63946; }
    .meter-status.cold { color: #3498db; }
    
    /* SCENARIO CARD */
    .scenario-card {
      background: linear-gradient(135deg, #1a0a0a 0%, #0a0a1a 100%);
      border: 3px solid #f1c40f;
      padding: 22px; margin: 14px 0;
      position: relative;
      box-shadow: 10px 10px 0 #e63946;
    }
    .scenario-card::before {
      content: 'BREAKING'; position: absolute;
      top: -10px; left: 20px;
      background: #e63946; color: #0a0a0a;
      padding: 4px 12px;
      font-family: 'Archivo Black', sans-serif;
      font-size: 0.75rem; letter-spacing: 0.2em;
    }
    .scenario-card .round-tag {
      font-family: 'Archivo Black', sans-serif;
      color: #f1c40f; font-size: 0.75rem; letter-spacing: 0.2em;
      margin-bottom: 8px;
    }
    .scenario-text {
      font-family: 'Anton', sans-serif;
      font-size: clamp(1.6rem, 4vw, 2.8rem);
      line-height: 1.1; letter-spacing: -0.01em;
    }
    .scenario-tags {
      display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
    }
    .scenario-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.95rem; padding: 5px 12px;
      background: #333; color: #f5f5f0;
      border-left: 3px solid #e63946;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
    
    /* PICKING PHASE */
    .picker-header {
      text-align: center; padding: 10px 0;
    }
    .picker-header .whos-up {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; font-size: 0.9rem;
      letter-spacing: 0.2em; color: #888; margin-bottom: 8px;
    }
    .picker-header .pname {
      font-family: 'Anton', sans-serif;
      font-size: clamp(3rem, 9vw, 5.5rem);
      color: #f1c40f; line-height: 1;
      text-shadow: 5px 5px 0 #e63946;
    }
    .picker-header .progress {
      font-family: 'JetBrains Mono', monospace;
      color: #888; font-size: 1rem; margin-top: 6px;
      letter-spacing: 0.05em;
    }
    
    .situation-box {
      background: linear-gradient(135deg, #1a0a0a 0%, #0a0a1a 100%);
      border-left: 6px solid #f1c40f;
      padding: 16px 20px;
      margin: 14px 0;
      position: relative;
      box-shadow: 0 0 30px rgba(241,196,15,0.15);
    }
    .situation-box .label {
      font-family: 'Archivo Black', sans-serif;
      color: #f1c40f;
      font-size: 0.85rem;
      letter-spacing: 0.25em;
      margin-bottom: 8px;
      display: block;
    }
    .situation-box .text {
      font-family: 'Anton', sans-serif;
      font-size: clamp(1.4rem, 3vw, 2.2rem);
      line-height: 1.2;
      color: #f5f5f0;
      letter-spacing: -0.01em;
    }
    
    .action-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px auto;
      max-width: 1100px;
    }
    @media (max-width: 800px) {
      .action-grid { grid-template-columns: 1fr; gap: 12px; }
    }
    .action-btn {
      background: #1a1a1a; border: 3px solid #333;
      color: #f5f5f0; padding: 34px 24px;
      cursor: pointer; text-align: left;
      transition: all 0.15s;
      position: relative; overflow: hidden;
      min-height: 240px;
      display: flex; flex-direction: column; justify-content: flex-start;
    }
    .action-btn::before {
      content: ''; position: absolute; top: 0; left: 0;
      width: 8px; height: 100%; background: #e63946;
      transform: scaleY(0); transform-origin: top;
      transition: transform 0.2s;
    }
    .action-btn:hover {
      border-color: #e63946; transform: translateY(-4px);
      background: #201010;
      box-shadow: 0 8px 24px rgba(230,57,70,0.35);
    }
    .action-btn:hover::before { transform: scaleY(1); }
    .action-btn:focus { outline: none; }
    .action-btn:focus:not(:hover) {
      border-color: #333; transform: none; background: #1a1a1a;
      box-shadow: none;
    }
    .action-btn:focus:not(:hover)::before { transform: scaleY(0); }
    .action-btn .emoji {
      font-size: 6rem; margin-bottom: 12px; line-height: 1;
    }
    .action-btn .lbl {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; font-size: 2.3rem;
      letter-spacing: 0.04em; line-height: 1.05;
      margin-bottom: 10px;
    }
    .action-btn .desc {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.3rem; color: #bbb;
      line-height: 1.3;
    }
    .action-btn.wildcard {
      border-color: #f1c40f; background: #1a1a0a;
      box-shadow: 0 0 20px rgba(241,196,15,0.2);
    }
    .action-btn.wildcard::before { background: #f1c40f; }
    .action-btn.wildcard .lbl { color: #f1c40f; }
    .action-btn.wildcard:hover {
      box-shadow: 0 8px 30px rgba(241,196,15,0.4);
    }
    .action-btn .wildcard-badge {
      position: absolute; top: 14px; right: 14px;
      font-family: 'Archivo Black', sans-serif;
      font-size: 0.9rem; color: #f1c40f;
      letter-spacing: 0.15em;
      padding: 5px 12px;
      background: rgba(0,0,0,0.5);
      border: 1px solid #f1c40f;
    }
    
    /* ============================================================ */
    /* POSEN CHANT SCREEN                                            */
    /* ============================================================ */
    .chant-screen {
      position: relative;
      min-height: 60vh;
      background: radial-gradient(ellipse at center, #1a0a2a 0%, #0a0a0a 70%);
      overflow: hidden;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      border: 3px solid #f1c40f;
      box-shadow: 0 0 60px rgba(241,196,15,0.3);
      animation: chant-screen-pulse 0.4s ease-in-out infinite alternate;
    }
    @keyframes chant-screen-pulse {
      0%   { box-shadow: 0 0 40px rgba(241,196,15,0.2); }
      100% { box-shadow: 0 0 80px rgba(241,196,15,0.6); }
    }
    
    /* Strobe lights */
    .chant-lights {
      position: absolute; inset: 0; pointer-events: none;
    }
    .chant-light {
      position: absolute;
      width: 60vw; height: 60vw;
      border-radius: 50%;
      filter: blur(40px);
      mix-blend-mode: screen;
      opacity: 0.5;
    }
    .chant-light.l1 {
      background: #e63946;
      top: -20%; left: -20%;
      animation: strobe-sweep-1 3s ease-in-out infinite;
    }
    .chant-light.l2 {
      background: #f1c40f;
      top: -20%; right: -20%;
      animation: strobe-sweep-2 2.5s ease-in-out infinite;
    }
    .chant-light.l3 {
      background: #8e44ad;
      bottom: -20%; left: -20%;
      animation: strobe-sweep-3 3.3s ease-in-out infinite;
    }
    .chant-light.l4 {
      background: #27ae60;
      bottom: -20%; right: -20%;
      animation: strobe-sweep-4 2.8s ease-in-out infinite;
    }
    @keyframes strobe-sweep-1 {
      0%, 100% { transform: translate(0, 0); opacity: 0.3; }
      50%      { transform: translate(30vw, 20vw); opacity: 0.7; }
    }
    @keyframes strobe-sweep-2 {
      0%, 100% { transform: translate(0, 0); opacity: 0.4; }
      50%      { transform: translate(-30vw, 20vw); opacity: 0.8; }
    }
    @keyframes strobe-sweep-3 {
      0%, 100% { transform: translate(0, 0); opacity: 0.3; }
      50%      { transform: translate(30vw, -20vw); opacity: 0.6; }
    }
    @keyframes strobe-sweep-4 {
      0%, 100% { transform: translate(0, 0); opacity: 0.4; }
      50%      { transform: translate(-30vw, -20vw); opacity: 0.7; }
    }
    
    .chant-content {
      position: relative; z-index: 2;
      text-align: center; padding: 14px;
    }
    .chant-who {
      font-family: 'Archivo Black', sans-serif;
      color: #f1c40f;
      font-size: 1.4rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      margin-bottom: 16px;
      text-shadow: 0 0 20px rgba(241,196,15,0.8);
    }
    .chant-words {
      position: relative;
      height: 32vh;
      display: flex; align-items: center; justify-content: center;
    }
    .chant-word {
      position: absolute;
      font-family: 'Anton', sans-serif;
      font-size: clamp(5rem, 16vw, 13rem);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      line-height: 0.9;
      color: #f1c40f;
      text-shadow:
        0 0 20px rgba(241,196,15,0.9),
        6px 6px 0 #e63946,
        -3px -3px 0 #8e44ad;
      pointer-events: none;
      will-change: transform, opacity;
    }
    .chant-word.w1 { animation: chant-pulse-1 0.6s ease-in-out infinite; }
    .chant-word.w2 { animation: chant-pulse-2 0.62s ease-in-out infinite; animation-delay: 0.1s; }
    .chant-word.w3 { animation: chant-pulse-3 0.58s ease-in-out infinite; animation-delay: 0.2s; }
    .chant-word.w4 { animation: chant-pulse-4 0.64s ease-in-out infinite; animation-delay: 0.3s; }
    .chant-word.w5 { animation: chant-pulse-5 0.59s ease-in-out infinite; animation-delay: 0.4s; }
    .chant-word.w6 { animation: chant-pulse-6 0.61s ease-in-out infinite; animation-delay: 0.5s; }
    @keyframes chant-pulse-1 {
      0%, 100% { transform: scale(0.85) translate(0, 0) rotate(-3deg); opacity: 0.3; }
      50%      { transform: scale(1.15) translate(-15px, -10px) rotate(-5deg); opacity: 1; }
    }
    @keyframes chant-pulse-2 {
      0%, 100% { transform: scale(1.1) translate(20px, 10px) rotate(4deg); opacity: 0.4; }
      50%      { transform: scale(0.9) translate(25px, -5px) rotate(6deg); opacity: 0.9; }
    }
    @keyframes chant-pulse-3 {
      0%, 100% { transform: scale(0.95) translate(-25px, 15px) rotate(-2deg); opacity: 0.5; }
      50%      { transform: scale(1.2) translate(-30px, 20px) rotate(-4deg); opacity: 1; }
    }
    @keyframes chant-pulse-4 {
      0%, 100% { transform: scale(1.05) translate(10px, -15px) rotate(5deg); opacity: 0.35; }
      50%      { transform: scale(0.85) translate(15px, -20px) rotate(8deg); opacity: 0.85; }
    }
    @keyframes chant-pulse-5 {
      0%, 100% { transform: scale(0.9) translate(-10px, 25px) rotate(-6deg); opacity: 0.45; }
      50%      { transform: scale(1.18) translate(-15px, 30px) rotate(-8deg); opacity: 1; }
    }
    @keyframes chant-pulse-6 {
      0%, 100% { transform: scale(1.1) translate(5px, -25px) rotate(2deg); opacity: 0.4; }
      50%      { transform: scale(0.88) translate(10px, -30px) rotate(3deg); opacity: 0.95; }
    }
    
    .chant-dancers {
      margin-top: 18px;
      display: flex; justify-content: center; gap: 14px;
      font-size: clamp(2.5rem, 6vw, 4.5rem);
    }
    .chant-dancer {
      display: inline-block;
      animation: dancer-bop 0.5s ease-in-out infinite;
      filter: drop-shadow(0 0 12px rgba(241,196,15,0.8));
    }
    .chant-dancer.d1 { animation-delay: 0s; }
    .chant-dancer.d2 { animation-delay: 0.1s; }
    .chant-dancer.d3 { animation-delay: 0.2s; }
    .chant-dancer.d4 { animation-delay: 0.3s; }
    .chant-dancer.d5 { animation-delay: 0.4s; }
    @keyframes dancer-bop {
      0%, 100% { transform: translateY(0) rotate(-8deg) scale(1); }
      50%      { transform: translateY(-20px) rotate(8deg) scale(1.15); }
    }
    
    .chant-skip {
      margin-top: 16px;
      font-family: 'JetBrains Mono', monospace;
      color: #888;
      font-size: 0.85rem;
      letter-spacing: 0.1em;
    }
    /* ============================================================ */
    /* When the Pose action is present, all 3 buttons swap positions */
    /* periodically (driven by JS), with subtle wiggling while idle. */
    /* The player can't point — they must SAY the action's name.     */
    /* ============================================================ */
    
    .action-grid.pose-mode {
      position: relative;
      overflow: visible;
      /* Switch to flexbox so we can animate button widths smoothly as the
         non-pose options melt away. Each button starts at flex: 1. */
      display: flex;
      gap: 18px;
    }
    .action-grid.pose-mode .action-btn {
      will-change: transform, flex-grow, opacity, filter;
      transition:
        transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
        flex-grow 5s cubic-bezier(0.55, 0, 0.45, 1),
        flex-basis 5s cubic-bezier(0.55, 0, 0.45, 1);
      z-index: 1;
      flex: 1 1 0;
      min-width: 0;
    }
    /* Freeze mid-motion the instant a button is hovered */
    .action-grid.pose-mode:hover .action-btn {
      transition: none;
    }
    /* Wiggle layered ON TOP of the slot transform via a wrapper inner element */
    .action-btn .wiggle-inner {
      display: flex;
      flex-direction: column;
      width: 100%;
      pointer-events: none;
    }
    .action-grid.pose-mode .action-btn .wiggle-inner {
      animation: pose-wiggle 1.4s ease-in-out infinite;
    }
    .action-grid.pose-mode .action-btn.is-pose .wiggle-inner {
      animation: pose-wiggle-strong 0.9s ease-in-out infinite;
    }
    /* Pose itself rises above the others for a clear hierarchy */
    .action-grid.pose-mode .action-btn.is-pose {
      z-index: 3;
      box-shadow: 0 0 40px rgba(241,196,15,0.55) !important;
    }
    /* On hover the wiggle pauses so players can actually click cleanly */
    .action-grid.pose-mode .action-btn:hover .wiggle-inner {
      animation-play-state: paused;
    }

    /* ============================================================ */
    /* MELT ANIMATION - non-pose actions dissolve over 5 seconds     */
    /* ============================================================ */
    /* Applied via JS-added class 'is-melting'. Uses nested targets   */
    /* inside .wiggle-inner to stagger logo -> text -> box fade.     */
    /* Each non-pose button shrinks flex-grow to 0 while melting.    */
    /*                                                                */
    /* TIMING: 8 seconds total, heavy ease-in curve so nothing moves  */
    /* much for the first ~2 seconds, then gradually builds into a    */
    /* cascading dissolve. Feels like a slow descent, not a snap.     */
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose) {
      animation: melt-droop 8s cubic-bezier(0.7, 0.0, 0.85, 0.35) forwards;
      flex-grow: 0;
      flex-basis: 0;
    }
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose) .emoji {
      animation: melt-emoji 4.5s cubic-bezier(0.6, 0.0, 0.8, 0.4) forwards;
      animation-delay: 0.8s;
    }
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose) .lbl {
      animation: melt-text 3.5s cubic-bezier(0.6, 0.0, 0.8, 0.4) forwards;
      animation-delay: 3.2s;
    }
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose) .desc {
      animation: melt-text 3s cubic-bezier(0.6, 0.0, 0.8, 0.4) forwards;
      animation-delay: 3.6s;
    }
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose) .wildcard-badge {
      animation: melt-badge 2.5s ease-in forwards;
      animation-delay: 0.5s;
    }
    /* Also override the flex-grow transition timing so the width collapse
       matches the slower visual dissolve. */
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose) {
      cursor: default;
      transition:
        transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
        flex-grow 8s cubic-bezier(0.75, 0.0, 0.9, 0.35),
        flex-basis 8s cubic-bezier(0.75, 0.0, 0.9, 0.35);
    }
    .action-grid.pose-mode .action-btn.is-melting:not(.is-pose):hover {
      transform: none;
      box-shadow: none;
      background: #1a1a1a;
      border-color: #333;
    }

    /* Pose grows to claim the space as others melt - gentler, longer curve */
    .action-grid.pose-mode .action-btn.is-pose.pose-grows {
      animation: pose-triumphant 8s cubic-bezier(0.25, 0.1, 0.35, 1) forwards;
    }

    @keyframes melt-droop {
      /* First 35% of timeline: subtle, just a hint something's wrong */
      0%   { transform: translateY(0) rotate(0) scaleY(1); opacity: 1; filter: none; }
      20%  { transform: translateY(1px) rotate(-0.3deg) scaleY(1); opacity: 1; filter: blur(0); }
      35%  { transform: translateY(3px) rotate(-0.8deg) scaleY(0.99); opacity: 1; filter: blur(0.2px); }
      /* Middle phase: noticeable droop, box starting to tilt and lose clarity */
      55%  { transform: translateY(8px) rotate(-1.8deg) scaleY(0.95); opacity: 0.92; filter: blur(0.6px); }
      70%  { transform: translateY(16px) rotate(-3deg) scaleY(0.88); opacity: 0.72; filter: blur(1.4px); }
      /* Final phase: full collapse */
      85%  { transform: translateY(28px) rotate(-5deg) scaleY(0.72); opacity: 0.35; filter: blur(3px); }
      100% { transform: translateY(48px) rotate(-8deg) scaleY(0.45); opacity: 0; filter: blur(7px); padding: 0; border-width: 0; }
    }
    @keyframes melt-emoji {
      0%   { transform: scale(1) translateY(0); filter: blur(0) saturate(1); opacity: 1; }
      25%  { transform: scale(1.02) translateY(1px); filter: blur(0.3px) saturate(1.05); opacity: 1; }
      50%  { transform: scale(1.06) translateY(6px); filter: blur(1.5px) saturate(1.15); opacity: 0.9; }
      75%  { transform: scale(0.92) translateY(18px) skewX(6deg); filter: blur(4px) saturate(0.7); opacity: 0.55; }
      100% { transform: scale(0.3) translateY(36px) skewX(22deg); filter: blur(14px) saturate(0); opacity: 0; }
    }
    @keyframes melt-text {
      0%   { transform: translateY(0) scaleY(1); opacity: 1; letter-spacing: 0.04em; filter: blur(0); }
      30%  { transform: translateY(3px) scaleY(0.96); opacity: 0.9; letter-spacing: 0.07em; filter: blur(0.3px); }
      60%  { transform: translateY(10px) scaleY(0.75); opacity: 0.55; letter-spacing: 0.18em; filter: blur(1.5px); }
      85%  { transform: translateY(18px) scaleY(0.45); opacity: 0.18; letter-spacing: 0.32em; filter: blur(3.5px); }
      100% { transform: translateY(24px) scaleY(0.15); opacity: 0; letter-spacing: 0.5em; filter: blur(6px); }
    }
    @keyframes melt-badge {
      0%   { opacity: 1; transform: translateY(0) rotate(0); }
      40%  { opacity: 0.85; transform: translateY(-2px) rotate(-5deg) scale(0.95); }
      100% { opacity: 0; transform: translateY(-14px) rotate(-25deg) scale(0.5); }
    }
    @keyframes pose-triumphant {
      0%   { transform: scale(1); box-shadow: 0 0 40px rgba(241,196,15,0.55); }
      35%  { transform: scale(1.005); box-shadow: 0 0 48px rgba(241,196,15,0.62); }
      70%  { transform: scale(1.012); box-shadow: 0 0 62px rgba(241,196,15,0.72); }
      100% { transform: scale(1.025); box-shadow: 0 0 95px rgba(241,196,15,0.9); }
    }

    /* ============================================================ */
    /* BUBBLE POP - when a non-pose action is clicked during melt    */
    /* ============================================================ */
    .action-grid.pose-mode .action-btn.is-popping:not(.is-pose) {
      animation: bubble-pop 0.45s cubic-bezier(0.3, 1.5, 0.5, 1) forwards !important;
      flex-grow: 0 !important;
      flex-basis: 0 !important;
      transition: flex-grow 0.45s cubic-bezier(0.55, 0, 0.45, 1),
                  flex-basis 0.45s cubic-bezier(0.55, 0, 0.45, 1) !important;
      pointer-events: none;
    }
    .action-grid.pose-mode .action-btn.is-popping:not(.is-pose) > * {
      animation: bubble-pop-inner 0.35s ease-out forwards !important;
    }
    @keyframes bubble-pop {
      0%   { transform: scale(1) rotate(0); opacity: 1; filter: blur(0) brightness(1); }
      30%  { transform: scale(1.25) rotate(2deg); opacity: 1; filter: blur(0) brightness(1.4); }
      100% { transform: scale(0) rotate(-15deg); opacity: 0; filter: blur(6px) brightness(2); padding: 0; border-width: 0; }
    }
    @keyframes bubble-pop-inner {
      0%   { transform: scale(1); opacity: 1; }
      100% { transform: scale(0); opacity: 0; }
    }
    
    @keyframes pose-wiggle {
      0%, 100% { transform: translateX(0) translateY(0) rotate(0deg); }
      25%      { transform: translateX(2%) translateY(-3px) rotate(0.8deg); }
      50%      { transform: translateX(-1%) translateY(2px) rotate(-0.5deg); }
      75%      { transform: translateX(-2%) translateY(-2px) rotate(-0.6deg); }
    }
    @keyframes pose-wiggle-strong {
      0%, 100% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); }
      20%      { transform: translateX(-4%) translateY(-5px) rotate(-2deg) scale(1.02); }
      40%      { transform: translateX(3%) translateY(4px) rotate(1.5deg) scale(0.98); }
      60%      { transform: translateX(-3%) translateY(-3px) rotate(-1deg) scale(1.03); }
      80%      { transform: translateX(4%) translateY(3px) rotate(2deg) scale(0.99); }
    }
    
    /* Flashing POSE warning banner */
    .pose-warning {
      background: repeating-linear-gradient(-45deg,
        #f1c40f 0, #f1c40f 15px,
        #0a0a0a 15px, #0a0a0a 30px);
      color: #f1c40f;
      text-align: center;
      padding: 12px 14px;
      font-family: 'Anton', sans-serif;
      font-size: 2.4rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 12px 0;
      animation: pose-warning-flash 1.2s ease-in-out infinite;
      border: 3px solid #f1c40f;
      line-height: 1.05;
    }
    .pose-warning .danish {
      background: #0a0a0a; color: #f1c40f;
      padding: 6px 14px; display: inline-block;
      text-shadow: 0 0 8px rgba(241,196,15,0.6);
    }
    .pose-warning .english {
      display: block;
      margin-top: 6px;
      font-size: 1.1rem;
      letter-spacing: 0.18em;
      background: #0a0a0a;
      color: #f1c40f;
      padding: 3px 10px;
      display: inline-block;
    }
    @keyframes pose-warning-flash {
      0%, 100% { box-shadow: 0 0 14px rgba(241,196,15,0.4); }
      50%      { box-shadow: 0 0 40px rgba(241,196,15,1); }
    }
    
    /* RESULT */
    .result-wrap {
      padding: 12px 0;
    }
    .result-banner {
      background: #e63946; color: #0a0a0a;
      padding: 14px; text-align: center;
      font-family: 'Anton', sans-serif;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      line-height: 1.1;
      letter-spacing: -0.01em;
      margin-bottom: 14px;
      text-transform: uppercase;
      position: relative;
      overflow: hidden;
    }
    .result-banner::before {
      content: ''; position: absolute; inset: 0;
      background: repeating-linear-gradient(-45deg,
        transparent 0, transparent 20px,
        rgba(0,0,0,0.08) 20px, rgba(0,0,0,0.08) 22px);
      pointer-events: none;
    }
    .result-banner.green { background: #27ae60; color: #0a0a0a; }
    .result-banner.yellow { background: #f1c40f; color: #0a0a0a; }
    
    /* Two-column result layout */
    .result-two-col {
      display: grid; grid-template-columns: 2.7fr 1fr;
      gap: 12px;
      margin: 14px 0;
    }
    @media (max-width: 900px) {
      .result-two-col { grid-template-columns: 1fr; }
    }
    
    .drinkers-list {
      background: #111; border: 2px solid #333;
      padding: 14px;
    }
    .drinkers-list .drink-header {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.1em;
      color: #e63946; margin-bottom: 8px; font-size: 0.9rem;
    }
    .drinkers-list .drink-names {
      font-family: 'Anton', sans-serif;
      font-size: clamp(1.4rem, 3vw, 2rem);
      line-height: 1.1;
      margin-bottom: 10px;
    }
    .contributions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
      margin-top: 14px; padding-top: 14px; border-top: 1px solid #222;
    }
    .contrib-cell {
      display: flex; flex-direction: column;
      background: #0a0a0a; padding: 10px 12px;
      border-left: 4px solid #333;
      font-size: 0.95rem;
    }
    .contrib-cell.drinker { border-left-color: #e63946; background: #1a0a0a; }
    .contrib-cell.danger-drinker {
      border-left-color: #f1c40f;
      background: #1a1400;
    }
    .contrib-cell .pname {
      color: #ccc; text-transform: uppercase;
      font-family: 'Archivo Black', sans-serif; font-size: 1rem;
      letter-spacing: 0.05em; margin-bottom: 4px;
      display: flex; justify-content: space-between; align-items: center;
      gap: 8px;
    }
    .contrib-cell.drinker .pname { color: #e63946; }
    .contrib-cell.danger-drinker .pname { color: #f1c40f; }
    .contrib-cell .drinks-display {
      display: inline-flex; gap: 1px; flex-wrap: wrap;
      justify-content: flex-end;
    }
    .contrib-cell .drinks-display .beer {
      font-size: 1.3rem; line-height: 1;
      animation: beer-appear 0.4s ease-out backwards;
    }
    .contrib-cell .drinks-display .beer:nth-child(2) { animation-delay: 0.1s; }
    .contrib-cell .drinks-display .beer:nth-child(3) { animation-delay: 0.2s; }
    .contrib-cell .drinks-display .beer:nth-child(4) { animation-delay: 0.3s; }
    @keyframes beer-appear {
      0%   { opacity: 0; transform: translateY(-8px) scale(0.5); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* DANGER ZONE BANNER */
    .danger-zone-banner {
      background: repeating-linear-gradient(-45deg,
        #f1c40f 0, #f1c40f 12px,
        #0a0a0a 12px, #0a0a0a 24px);
      color: #f1c40f;
      text-align: center;
      padding: 12px 14px;
      font-family: 'Archivo Black', sans-serif;
      font-size: 1rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 16px;
      border: 2px solid #f1c40f;
      animation: danger-pulse 1.4s ease-in-out infinite;
    }
    .danger-zone-banner {
      /* Place the text on top of the stripe via a background inset */
      background-color: #0a0a0a;
      background-image: repeating-linear-gradient(-45deg,
        rgba(241,196,15,0.4) 0, rgba(241,196,15,0.4) 10px,
        transparent 10px, transparent 20px);
    }
    @keyframes danger-pulse {
      0%, 100% { box-shadow: 0 0 10px rgba(241,196,15,0.3); }
      50%      { box-shadow: 0 0 26px rgba(241,196,15,0.8); }
    }
    .contrib-cell .drink-icon {
      font-size: 1.3rem;
    }
    .contrib-cell .action {
      font-family: 'JetBrains Mono', monospace;
      color: #bbb; font-size: 0.9rem;
      line-height: 1.3;
    }
    .contrib-cell .stats {
      color: #666; font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem; margin-top: 3px;
    }
    
    /* SCOREBOARD */
    .scoreboard {
      border: 2px solid #333; background: rgba(0,0,0,0.5);
    }
    .scoreboard h3 {
      background: linear-gradient(90deg, #222, #1a0a0a);
      padding: 10px 14px;
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.12em;
      font-size: 0.85rem; color: #f1c40f;
      border-bottom: 2px solid #e63946;
    }
    .score-rows {
      padding: 4px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 4px;
    }
    .score-row {
      display: grid; grid-template-columns: 28px 1fr auto;
      gap: 8px; align-items: center;
      padding: 6px 8px;
      font-family: 'JetBrains Mono', monospace;
      background: #0a0a0a; position: relative; overflow: hidden;
    }
    .score-row .rank {
      font-family: 'Anton', sans-serif; font-size: 1.1rem;
      color: #666; line-height: 1; z-index: 2;
    }
    .score-row.top .rank { color: #f1c40f; }
    .score-row .pname {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.05em;
      font-size: 0.75rem; z-index: 2;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .score-row .drinks {
      color: #e63946; font-weight: bold; z-index: 2;
      font-family: 'Anton', sans-serif; font-size: 1rem;
    }
    .score-row .bar {
      position: absolute; top: 0; bottom: 0; left: 0;
      background: linear-gradient(90deg, rgba(230,57,70,0.25), rgba(230,57,70,0.05));
      z-index: 1;
      transition: width 0.6s ease-out;
    }
    .score-row.top .bar {
      background: linear-gradient(90deg, rgba(241,196,15,0.3), rgba(241,196,15,0.05));
    }
    .score-row.new-drinker {
      animation: scorepulse 1s ease-out;
    }
    @keyframes scorepulse {
      0% { background: #4a0a0a; }
      100% { background: #0a0a0a; }
    }
    
    /* GAME OVER */
    .gameover {
      text-align: center; padding: 12px 0;
    }
    .gameover h1 {
      font-family: 'Anton', sans-serif;
      font-size: clamp(2.5rem, 8vw, 5.8rem);
      line-height: 0.85; letter-spacing: -0.03em;
      text-transform: uppercase;
      text-shadow: 6px 6px 0 #e63946, -2px -2px 0 #f1c40f;
      margin-bottom: 10px;
      white-space: nowrap;
    }
    .gameover .end-subtitle {
      font-family: 'Archivo Black', sans-serif;
      color: #f1c40f; letter-spacing: 0.25em;
      margin-bottom: 14px; font-size: 0.85rem;
    }
    
    /* Top 3 podium hero - 10% smaller */
    .podium-hero {
      display: grid; grid-template-columns: 1fr 1.2fr 1fr;
      gap: 10px; align-items: end;
      max-width: 1080px; margin: 18px auto 10px;
      min-height: 210px;
    }
    @media (max-width: 800px) {
      .podium-hero { grid-template-columns: 1fr; min-height: auto; }
    }
    .podium-block {
      padding: 16px 12px; text-align: center;
      background: linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
      border-top: 4px solid #333;
      position: relative;
    }
    .podium-block.gold {
      border-top-color: #f1c40f;
      background: linear-gradient(180deg, rgba(241,196,15,0.12), rgba(0,0,0,0.8));
      min-height: 210px;
      box-shadow: 0 0 36px rgba(241,196,15,0.2);
    }
    .podium-block.silver {
      border-top-color: #c0c0c0;
      background: linear-gradient(180deg, rgba(192,192,192,0.08), rgba(0,0,0,0.8));
      min-height: 180px;
    }
    .podium-block.bronze {
      border-top-color: #cd7f32;
      background: linear-gradient(180deg, rgba(205,127,50,0.1), rgba(0,0,0,0.8));
      min-height: 160px;
    }
    .podium-block .medal {
      font-size: 2.25rem;
      margin-bottom: 4px;
      filter: drop-shadow(0 0 10px rgba(255,215,0,0.5));
    }
    .podium-block.gold .medal {
      font-size: 3.15rem;
      animation: medal-glow 2s ease-in-out infinite alternate;
    }
    @keyframes medal-glow {
      0% { filter: drop-shadow(0 0 8px rgba(255,215,0,0.4)); }
      100% { filter: drop-shadow(0 0 24px rgba(255,215,0,0.9)); }
    }
    .podium-block .rank {
      font-family: 'Anton', sans-serif;
      font-size: 2rem; color: #666;
      line-height: 1; margin-bottom: 2px;
    }
    .podium-block.gold .rank { color: #f1c40f; font-size: 2.7rem; }
    .podium-block.silver .rank { color: #c0c0c0; font-size: 2.35rem; }
    .podium-block.bronze .rank { color: #cd7f32; font-size: 2.05rem; }
    .podium-block .pname {
      font-family: 'Anton', sans-serif;
      font-size: clamp(1.2rem, 2.2vw, 1.8rem);
      line-height: 1; margin-bottom: 6px;
      text-transform: uppercase;
      word-break: break-word;
    }
    .podium-block.gold .pname {
      font-size: clamp(1.4rem, 3vw, 2.5rem);
      text-shadow: 3px 3px 0 #e63946;
    }
    .podium-block .drinks {
      font-family: 'Anton', sans-serif;
      font-size: 1.8rem; color: #e63946;
      line-height: 1; margin: 8px 0 4px;
    }
    .podium-block.gold .drinks { font-size: 2.5rem; }
    .podium-block .trait-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem; color: #888;
      padding: 4px 8px; background: rgba(0,0,0,0.4);
      border: 1px solid #333;
      display: inline-block; margin-top: 4px;
      letter-spacing: 0.05em;
    }
    
    /* Runners up grid */
    .runners-up {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 8px;
      margin: 16px 0;
    }
    .runner-card {
      display: grid; grid-template-columns: 40px 1fr auto;
      gap: 12px; align-items: center;
      padding: 10px 14px;
      background: #111;
      border-left: 3px solid #333;
    }
    .runner-card .rank {
      font-family: 'Anton', sans-serif;
      font-size: 1.6rem; color: #666;
      line-height: 1;
    }
    .runner-card .info {
      text-align: left; overflow: hidden;
    }
    .runner-card .pname {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.05em;
      font-size: 0.9rem;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .runner-card .trait {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem; color: #666; margin-top: 2px;
    }
    .runner-card .drinks {
      font-family: 'Anton', sans-serif;
      font-size: 1.4rem; color: #e63946;
    }
    
    /* Compact horizontal stat panels: label-value pairs in 2 columns */
    .end-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px; margin: 14px 0;
      max-width: 1080px; margin-left: auto; margin-right: auto;
    }
    @media (max-width: 700px) {
      .end-stats-grid { grid-template-columns: 1fr; }
    }
    .stat-panel {
      background: rgba(0,0,0,0.5);
      border: 2px solid #333;
      padding: 10px 14px;
      display: grid; grid-template-columns: auto 1fr;
      gap: 12px; align-items: center;
      text-align: left;
    }
    .stat-panel .label {
      font-family: 'Archivo Black', sans-serif;
      text-transform: uppercase; letter-spacing: 0.12em;
      font-size: 0.72rem; color: #f1c40f;
      line-height: 1.2;
      min-width: 110px;
    }
    .stat-panel .pair {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: 16px;
    }
    .stat-panel .value {
      font-family: 'Anton', sans-serif;
      font-size: 1.6rem; line-height: 1;
      color: #f5f5f0;
      text-transform: uppercase;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .stat-panel .sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem; color: #999;
      text-align: right;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .stat-panel.red { border-color: #e63946; }
    .stat-panel.red .value { color: #e63946; }
    .stat-panel.yellow { border-color: #f1c40f; }
    .stat-panel.yellow .value { color: #f1c40f; }
    
    /* DECORATIVE */
    .ticker {
      background: #000; border-top: 1px solid #333; border-bottom: 1px solid #333;
      padding: 8px 0; overflow: hidden; position: relative;
      margin: 14px 0;
    }
    .ticker-content {
      white-space: nowrap;
      animation: tick 26s linear infinite;
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.05rem; color: #ccc;
      letter-spacing: 0.03em;
      display: inline-block;
      will-change: transform;
    }
    .ticker-content span { margin: 0 24px; }
    .ticker-content .hot { color: #e63946; font-size: 1.2rem; }
    @keyframes tick {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
  `;

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================
  const renderEscalationMeter = () => {
    const intensity = Math.abs(escalationMeter);
    const meterPct = (escalationMeter / meterMax); // -1 to +1
    const intensityPct = Math.abs(meterPct);     // 0 to 1
    // Warning zone begins at 40% (where +1 drink kicks in for all players).
    // Must match the logic in computeResult.
    const warningHot = meterMax * 0.4;
    const warningCold = -meterMax * 0.4;
    const isHot = escalationMeter > meterMax * 0.06;
    const isCold = escalationMeter < -meterMax * 0.06;
    const inWarningHot = escalationMeter >= warningHot;
    const inWarningCold = escalationMeter <= warningCold;
    const isIdle = !isHot && !isCold;

    const containerClasses = [
      'meter-container',
      isHot ? 'hot' : '',
      isCold ? 'cold' : '',
      isIdle ? 'idle' : '',
      inWarningHot ? 'warning-hot' : '',
      inWarningCold ? 'warning-cold' : '',
      meterChangeDir === 'spike' ? 'spike' : '',
      meterChangeDir === 'drop' ? 'drop' : '',
    ].filter(Boolean).join(' ');

    // Status label matches the three-zone layout (neutral / warning / extreme)
    let statusText = 'STABLE · NOBODY\'S PAYING ATTENTION';
    let statusClass = '';
    if (intensityPct >= 0.8 && escalationMeter > 0) { statusText = '☢ CRITICAL · MELTDOWN IMMINENT'; statusClass = 'hot'; }
    else if (intensityPct >= 0.4 && escalationMeter > 0) { statusText = '🔥 DANGER ZONE · WORLD ON FIRE · +1 DRINK'; statusClass = 'hot'; }
    else if (intensityPct >= 0.15 && escalationMeter > 0) { statusText = '⚠ TENSIONS RISING'; statusClass = 'hot'; }
    else if (intensityPct >= 0.8 && escalationMeter < 0) { statusText = '💤 TOTAL IRRELEVANCE'; statusClass = 'cold'; }
    else if (intensityPct >= 0.4 && escalationMeter < 0) { statusText = '❄ DANGER ZONE · WORLD FROZEN OUT · +1 DRINK'; statusClass = 'cold'; }
    else if (intensityPct >= 0.15 && escalationMeter < 0) { statusText = '📉 ATTENTION FADING'; statusClass = 'cold'; }

    // Persistent fire flames when hot, scaling intensity with meter level (#3)
    const flameCount = isHot ? Math.min(8, Math.ceil(intensityPct * 10)) : 0;
    const flames = Array.from({ length: flameCount }).map((_, i) => {
      const fillWidth = intensityPct * 50; // % of meter that's filled (positive side)
      const left = 50 + (Math.random() * fillWidth);
      const delay = (i * 0.18) % 1.5;
      const duration = 1.4 + Math.random() * 0.8;
      const size = 0.7 + Math.random() * 0.6;
      return (
        <div
          key={`flame-${i}`}
          className="meter-flame"
          style={{
            left: `${Math.min(96, left)}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            transform: `scale(${size})`,
          }}
        >🔥</div>
      );
    });

    // Persistent embers when hot
    const emberCount = isHot ? Math.min(10, Math.ceil(intensityPct * 12)) : 0;
    const embers = Array.from({ length: emberCount }).map((_, i) => {
      const fillWidth = intensityPct * 50;
      const left = 50 + (Math.random() * fillWidth);
      const drift = (Math.random() - 0.5) * 40;
      const delay = (i * 0.2) % 1.8;
      return (
        <div
          key={`ember-${i}`}
          className="meter-ember"
          style={{
            left: `${Math.min(96, left)}%`,
            animationDelay: `${delay}s`,
            '--drift': `${drift}px`,
          }}
        />
      );
    });

    // Persistent snowflakes when cold (#3)
    const snowflakeCount = isCold ? Math.min(8, Math.ceil(intensityPct * 10)) : 0;
    const snowflakes = Array.from({ length: snowflakeCount }).map((_, i) => {
      const fillWidth = intensityPct * 50;
      const right = 50 + (Math.random() * fillWidth);
      const delay = (i * 0.25) % 2;
      const duration = 2 + Math.random() * 1.5;
      const drift = (Math.random() - 0.5) * 30;
      return (
        <div
          key={`snow-${i}`}
          className="meter-snowflake"
          style={{
            right: `${Math.min(96, right)}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            '--drift': `${drift}px`,
          }}
        >❄</div>
      );
    });

    // Frost crystals on the cold side, scaled with intensity
    const frostCount = isCold ? Math.min(6, Math.ceil(intensityPct * 8)) : 0;
    const frostCrystals = Array.from({ length: frostCount }).map((_, i) => {
      const fillWidth = intensityPct * 50;
      const right = 50 + (Math.random() * fillWidth);
      const delay = (i * 0.3) % 2.5;
      return (
        <div
          key={`frost-${i}`}
          className="meter-frost"
          style={{
            right: `${Math.min(96, right)}%`,
            animationDelay: `${delay}s`,
          }}
        />
      );
    });

    return (
      <div className={containerClasses}>
        <div className="meter-label">
          <span className="left">◀ IRRELEVANCE</span>
          <span className="center">ESCALATION METER</span>
          <span className="right">MELTDOWN ▶</span>
        </div>
        <div className={`meter-bar ${isIdle ? 'idle-pulse' : ''}`}>
          <div className="meter-center-line"></div>
          {/* Zone shading: neutral (safe), warning (+1 all drink), extreme (meltdown) */}
          <div className="meter-zone zone-neutral" />
          <div className="meter-zone zone-warning-hot" />
          <div className="meter-zone zone-warning-cold" />
          <div className="meter-zone zone-extreme-hot" />
          <div className="meter-zone zone-extreme-cold" />
          {escalationMeter >= 0 ? (
            <div
              className={`meter-fill pos ${isHot ? 'active' : ''}`}
              style={{ width: `${Math.min(50, (escalationMeter / meterMax) * 50)}%` }}
            />
          ) : (
            <div
              className={`meter-fill neg ${isCold ? 'active' : ''}`}
              style={{ width: `${Math.min(50, (Math.abs(escalationMeter) / meterMax) * 50)}%` }}
            />
          )}
          {flames}
          {embers}
          {snowflakes}
          {frostCrystals}
          <div className="meter-value">{Math.max(-100, Math.min(100, Math.round((escalationMeter / meterMax) * 100)))}%</div>
        </div>
        <div className={`meter-status ${statusClass}`}>{statusText}</div>
      </div>
    );
  };

  // Particle effect for red/bad outcomes - fireball, smoke, shockwave, embers
  const renderExplosion = () => {
    const embers = Array.from({ length: 30 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.3;
      const dist = 200 + Math.random() * 400;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      return (
        <div
          key={i}
          className="ember"
          style={{
            '--dx': `${dx}px`,
            '--dy': `${dy}px`,
            animationDelay: `${Math.random() * 0.2}s`,
          }}
        />
      );
    });
    return (
      <div className="explosion">
        <div className="flash-bg"></div>
        <div className="shockwave"></div>
        <div className="fireball"></div>
        <div className="smoke"></div>
        {embers}
      </div>
    );
  };

  // Particle effect for green/good outcomes - confetti pop
  const renderConfetti = () => {
    const colors = ['#f1c40f', '#27ae60', '#3498db', '#e63946', '#f5f5f0', '#ff6b00'];
    const pieces = Array.from({ length: 80 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 80 + (Math.random() - 0.5) * 0.4;
      const dist = 300 + Math.random() * 500;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist + 200; // extra downward drift (gravity)
      const rot = Math.random() * 1440 - 720;
      const color = colors[i % colors.length];
      return (
        <div
          key={i}
          className="confetti"
          style={{
            background: color,
            '--dx': `${dx}px`,
            '--dy': `${dy}px`,
            '--rot': `${rot}deg`,
            animationDelay: `${Math.random() * 0.15}s`,
          }}
        />
      );
    });
    return (
      <div className="confetti-wrap">
        <div className="celebration-flash"></div>
        {pieces}
      </div>
    );
  };

  // Restart the whole game back to setup. Two-click arm pattern so a misclick
  // doesn't nuke a game mid-round.
  const handleRestart = () => {
    if (!restartArmed) {
      setRestartArmed(true);
      setTimeout(() => setRestartArmed(false), 3000);
      return;
    }
    setRestartArmed(false);
    setPhase('setup');
    setPlayers([]);
    setPlayerCount(4);
    setRound(0);
    setEscalationMeter(0);
    setMeterMax(50);
    setUsedScenarios([]);
    setShowTraitReveal(null);
    setFreshDrinkers([]);
    setRoundResult(null);
    setPlayerPicks({});
    setPlayerActionSets({});
    setPoseReceiptCounts({});
    setCurrentPickerIdx(0);
    actionDescCacheRef.current = {};
  };

  // Corner controls: restart / intro / size, stacked vertically
  const renderCornerControls = () => (
    <div className="corner-controls">
      <div className="restart-control">
        <span className="lbl">GAME</span>
        <button
          className={restartArmed ? 'armed' : ''}
          onClick={handleRestart}
          title={restartArmed ? 'Click again to confirm' : 'Restart the game'}
        >
          {restartArmed ? 'CONFIRM?' : 'RESTART'}
        </button>
      </div>
      <div className="intro-control">
        <span className="lbl">INTRO</span>
        <button
          className={introEnabled ? 'on' : ''}
          onClick={() => setIntroEnabled(v => !v)}
          title={introEnabled ? 'Intro briefing will be shown when DEPLOY is pressed' : 'Intro briefing is skipped on DEPLOY'}
        >
          {introEnabled ? 'INTRO ON' : 'INTRO OFF'}
        </button>
      </div>
      <div className="zoom-control">
        <span className="lbl">SIZE</span>
        <button onClick={() => setZoom(z => Math.max(40, z - 10))} title="Decrease size">−</button>
        <span className="zoom-val">{zoom}%</span>
        <button onClick={() => setZoom(z => Math.min(150, z + 10))} title="Increase size">+</button>
      </div>
    </div>
  );

  const renderScoreboard = () => {
    const sorted = [...players]
      .map((p, i) => ({ ...p, idx: i }))
      .sort((a, b) => b.drinksTotal - a.drinksTotal);
    const maxDrinks = Math.max(1, sorted[0]?.drinksTotal || 1);
    return (
      <div className="scoreboard">
        <h3>Global Liver Index</h3>
        <div className="score-rows">
          {sorted.map((p, rank) => {
            const isFresh = freshDrinkers.includes(p.idx);
            const barWidth = (p.drinksTotal / maxDrinks) * 100;
            return (
              <div
                className={`score-row ${rank === 0 && p.drinksTotal > 0 ? 'top' : ''} ${isFresh ? 'new-drinker' : ''}`}
                key={p.idx}
              >
                <div className="bar" style={{ width: `${barWidth}%` }}></div>
                <span className="rank">#{rank + 1}</span>
                <span className="pname">{p.name}</span>
                <span className="drinks">{p.drinksTotal} 🍺</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTopBar = () => (
    <div className="top-bar">
      <div className="live">● LIVE</div>
      <div>DAY {round} / {TOTAL_ROUNDS}</div>
      <div style={{ color: '#888', fontSize: '0.7rem' }}>
        ASC {ascension} · {ASCENSION_MULTIPLIERS[ascension]}×
      </div>
      <div style={{ color: '#f1c40f' }}>DEFCON {Math.max(1, 5 - Math.floor(((escalationMeter + meterMax) / (meterMax * 2)) * 5))}</div>
    </div>
  );

  const renderTicker = () => {
    // Build a shuffled run, doubled so the loop has no visible seam
    const run = shuffle(TICKER_HEADLINES);
    const doubled = [...run, ...run];
    return (
      <div className="ticker">
        <div className="ticker-content">
          {doubled.map((headline, i) => (
            <React.Fragment key={i}>
              <span className="hot">●</span>
              <span>{headline}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // PHASE RENDERS
  // ==========================================================================
  const renderSetup = () => (
    <div className="container">
      <div className="setup-hero">
        <h1>NOTHING<br/>TO SEE HERE</h1>
        <div className="sub">WELCOME TO THE SHITSHOW</div>
        <div className="warning">
          ⚠ CLASSIFIED: Each player will be assigned a secret trait.<br/>
          Nobody knows anyone else's. Good luck.
        </div>
      </div>

      <div className="setup-two-col">
        <div className="count-select">
          <div className="setup-col-header">◀ HOW MANY HEADS OF STATE?</div>
          <div className="count-grid">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                className={`count-btn ${playerCount === n && players.length === n ? 'active' : ''}`}
                onClick={() => startGameSetup(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="setup-col-header">▶ ROSTER</div>
          {players.length > 0 ? (
            <div className="name-form">
              {players.map((p, i) => (
                <div className="name-row" key={i}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <input
                    type="text"
                    placeholder={`PLAYER ${i + 1}`}
                    value={p.name}
                    onChange={(e) => updatePlayerName(i, e.target.value)}
                    maxLength={20}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="name-placeholder">
              ← PICK A NUMBER OF PLAYERS FIRST
            </div>
          )}
        </div>
      </div>

      {players.length > 0 && (
        <>
          <div className="ascension-panel">
            <div className="asc-header">
              <span className="asc-title">◀ ASCENSION LEVEL ▶</span>
              <span className="asc-readout">
                LEVEL <span className="asc-level">{ascension}</span>
                {/* · <span className="asc-mult">{ASCENSION_MULTIPLIERS[ascension]}×</span> drinks */}
              </span>
            </div>
            <input
              type="range"
              min="0" max="10" step="1"
              value={ascension}
              onChange={(e) => setAscension(Number(e.target.value))}
              className="ascension-slider"
              aria-label="Ascension level"
            />
            <div className="ascension-ticks">
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className={`tick ${i === ascension ? 'active' : ''} ${i === DEFAULT_ASCENSION ? 'baseline' : ''}`}
                >{i}</div>
              ))}
            </div>
            <div className={`asc-flavor ${ascension < 4 ? 'low' : ''} ${ascension > 4 ? 'high' : ''}`}>
              {ascension <= 1 && "Chill mode. Nobody gets hurt. Barely a game."}
              {ascension === 2 && "Light sipping. The group will stay coherent. Maybe."}
              {ascension === 3 && "Slightly toned down. Good for early rounds."}
              {ascension === 4 && "★ Baseline. The design intent. Standard shitshow."}
              {ascension === 5 && "Noticeably rowdier. Uber for the ride home might be wise."}
              {ascension === 6 && "Things escalate. Hope you ate beforehand."}
              {ascension === 7 && "This is a lot. No more work tomorrow."}
              {ascension === 8 && "Serious liquid commitment. Regret is coming."}
              {ascension === 9 && "You will not remember the back half of this game."}
              {ascension === 10 && "☢ APOCALYPSE MODE. Someone's getting carried home."}
            </div>
          </div>

          <button className="big-btn" onClick={handleDeploy}>
            DEPLOY →
          </button>
        </>
      )}
    </div>
  );

  // ==========================================================================
  // INTRO SLIDES
  // ==========================================================================
  // Multi-step intro briefing shown after setup, before traits.
  // Mock-serious state-department tone. Intentionally withholds the fun
  // surprises (Pose, specific traits, specific outcomes) so first-timers
  // discover those organically during play.
  const INTRO_SLIDES = [
    {
      badge: "CLASSIFIED // EYES ONLY",
      title: "HEADS OF STATE,\nYOUR BRIEFING AWAITS.",
      body: "The geopolitical order is, frankly, in pieces. Your governments have entrusted you with response authority. The world is watching. Paryk Jacob is not (thank god).",
      footer: "By proceeding, you confirm legal drinking age in your jurisdiction.",
    },
    {
      badge: "DOCTRINE // ROUND STRUCTURE",
      title: "EACH INCIDENT UNFOLDS\nIN THREE BEATS.",
      body: "One: a situation develops on the world stage. \nTwo: every leader selects a response. \nThree: history judges you. Swiftly. With beer.",
      footer: "Response time per player: 10–20 seconds. Snap decisions encouraged.",
    },
    {
      badge: "INSTRUMENT // ESCALATION METER",
      title: "WATCH THE METER.\nCENTER IS SAFE.",
      body: "Push too hard and the meter slides toward meltdown. Do nothing and it drifts toward irrelevance. The warning bands on either side are a courtesy. Extremes are not.",
      footer: "Meltdown and irrelevance events affect the entire roster. Generously.",
    },
    {
      badge: "PERSONNEL // ASSIGNED TRAITS",
      title: "YOU WILL BE GIVEN\nA SECRET TRAIT.",
      body: "Every leader operates with a private disposition that subtly shifts the weight of their decisions. Do not reveal yours. Suspect others. The guessing is the game.",
      footer: "Trust no one. Particularly not the quiet ones.",
    },
    {
      badge: "ADVISORY // COMMITMENT LEVEL",
      title: `ASCENSION ${ascension} CONFIRMED.\n OPERATIONAL TEMPO.`,
      body: ascensionBriefing(ascension),
      footer: "This setting is locked for the remainder of the session. No rebases.",
    },
    {
      badge: "WAIVER // LIABILITY",
      title: "FINAL LEGAL MATTERS.",
      body: "By pressing DEPLOY you waive all rights to remember this evening clearly, accept that whatever happens reflects poorly only on you, and acknowledge that the United Nations has not endorsed this game, us, or you.",
      footer: "[INSIDE JOKE PLACEHOLDER — edit INTRO_INSIDE_JOKE at the top of the file.]",
    },
  ];

  const renderIntro = () => {
    const slide = INTRO_SLIDES[introSlide];
    const isLast = introSlide === INTRO_SLIDES.length - 1;
    const isFirst = introSlide === 0;
    // On the final slide, swap the placeholder for the user's custom joke if present
    const footer = isLast && (typeof INTRO_INSIDE_JOKE !== 'undefined' && INTRO_INSIDE_JOKE)
      ? INTRO_INSIDE_JOKE
      : slide.footer;
    return (
      <div className="container">
        <div className="intro-wrap">
          <div className="intro-progress">
            {INTRO_SLIDES.map((_, i) => (
              <div
                key={i}
                className={`intro-progress-tick ${i === introSlide ? 'active' : ''} ${i < introSlide ? 'done' : ''}`}
              />
            ))}
          </div>

          <div className="intro-card" key={introSlide /* force remount for re-animate */}>
            <div className="intro-badge">{slide.badge}</div>
            <h2 className="intro-title">
              {slide.title.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </h2>
            <div className="intro-body">
              {slide.body.split('\n').map((line, i) => (
                <div key={i}>{line.trim()}</div>
              ))}
            </div>
            <div className="intro-footer">{footer}</div>
          </div>

          <div className="intro-controls">
            <button
              className="intro-nav-btn back"
              onClick={() => setIntroSlide(s => Math.max(0, s - 1))}
              disabled={isFirst}
            >
              ← BACK
            </button>
            <div className="intro-count">
              {introSlide + 1} / {INTRO_SLIDES.length}
            </div>
            {isLast ? (
              <button className="intro-nav-btn deploy" onClick={assignTraitsAndStart}>
                DEPLOY →
              </button>
            ) : (
              <button
                className="intro-nav-btn next"
                onClick={() => setIntroSlide(s => Math.min(INTRO_SLIDES.length - 1, s + 1))}
              >
                NEXT →
              </button>
            )}
          </div>

          <button
            className="intro-skip"
            onClick={assignTraitsAndStart}
            title="Skip briefing and start the game"
          >
            skip briefing →
          </button>
        </div>
      </div>
    );
  };

  const renderTraits = () => (
    <div className="container">
      {renderTopBar()}
      <div className="traits-intro">
        <h1>TRAITS ASSIGNED</h1>
        <p>
          Each player has been assigned a <span style={{ color: '#f1c40f' }}>secret personality trait</span> that 
          silently modifies their actions. <span style={{ color: '#e63946' }}>Nobody should know anyone else's.</span>
        </p>
        <p className="sub">
          Pass the screen to each player. They tap REVEAL, memorize their trait, then HIDE and pass it on.
        </p>

        <div className="trait-grid">
          {players.map((p, i) => (
            <div className={`trait-card ${showTraitReveal === i ? 'revealed' : ''}`} key={i}>
              <div className="pname">{p.name}</div>
              <div className="trait-slot">
                {showTraitReveal === i ? (
                  <div className="trait-revealed">
                    <div className="tname">{p.trait.emoji} {p.trait.label}</div>
                    <div className="tdesc">{p.trait.desc}</div>
                    <button
                      className="hide-btn"
                      onClick={(e) => { e.currentTarget.blur(); setShowTraitReveal(null); }}
                    >HIDE</button>
                  </div>
                ) : (
                  <button
                    className="trait-reveal-btn"
                    onClick={(e) => { e.currentTarget.blur(); setShowTraitReveal(i); }}
                  >REVEAL</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="big-btn" onClick={beginFirstRound}>
          START GAME →
        </button>
      </div>
    </div>
  );

  const renderScenario = () => (
    <div className="container">
      {renderTopBar()}
      {renderEscalationMeter()}
      <div className="scenario-card">
        <div className="round-tag">INCIDENT #{String(round).padStart(3, '0')}</div>
        <div className="scenario-text">{currentScenario.text}</div>
        <div className="scenario-tags">
          {currentScenario.tags.map(t => (
            <span className="scenario-tag" key={t}>#{t}</span>
          ))}
        </div>
      </div>
      {renderTicker()}
      <button className="big-btn" onClick={advanceToPicking}>
        RESPOND →
      </button>
    </div>
  );

  const renderPicking = () => {
    const currentPlayer = players[currentPickerIdx];
    const myActions = playerActionSets[currentPickerIdx] || [];
    const hasPose = myActions.some(a => a.special === 'pose');

    // Stable description lookup: roll once per action per picker turn, then
    // return the same text on every subsequent re-render.
    const stableDesc = (action) => {
      if (!Array.isArray(action.desc)) return action.desc;
      const key = `${currentPickerIdx}:${action.id}`;
      if (actionDescCacheRef.current[key] == null) {
        actionDescCacheRef.current[key] = pick(action.desc);
      }
      return actionDescCacheRef.current[key];
    };

    return (
      <div className="container">
        {renderTopBar()}
        <div className="picker-header">
          <div className="whos-up">NOW DECIDING</div>
          <div className="pname">{currentPlayer.name}</div>
          <div className="progress">
            {currentPickerIdx + 1} / {players.length} · What do you choose?
          </div>
        </div>

        <div className="situation-box">
          <span className="label">SITUATION</span>
          <div className="text">{currentScenario.text}</div>
        </div>

        {hasPose && (
          <div className="pose-warning">
            <span className="danish">⚠ Du ved godt hvad du skal vælge her ⚠</span>
          </div>
        )}

        <div className={`action-grid ${hasPose ? 'pose-mode' : ''}`} ref={poseGridRef}>
          {myActions.map((action, idx) => {
            const isWildcard = WILDCARDS.some(w => w.id === action.id);
            const isPose = action.special === 'pose';
            // Slot-based transform for Pose mode: move button from natural idx
            // to its currently-assigned slot (poseSlots[idx]).
            // The grid is 3 equal columns with gap, so moving 1 slot = 100% + gap.
            let transformStyle = {};
            if (hasPose) {
              const targetSlot = poseSlots[idx] != null ? poseSlots[idx] : idx;
              const slotDelta = targetSlot - idx;
              // Clamp how far Pose can drift - don't go past the outermost edges of the cluster (#4)
              transformStyle = {
                transform: `translateX(calc(${slotDelta} * (100% + 18px)))`,
              };
            }
            const hoverHandlers = hasPose ? {
              onMouseEnter: () => setPoseHovered(true),
              onMouseLeave: () => setPoseHovered(false),
            } : {};

            // Build classes for the melt/pop behavior
            const isPopping = poppingActionId === action.id;
            const meltClass = hasPose && !isPose && isMelting ? 'is-melting' : '';
            const popClass = isPopping ? 'is-popping' : '';
            const poseGrowsClass = hasPose && isPose && isMelting ? 'pose-grows' : '';

            // Click handler: during melt, clicking a non-pose action triggers a
            // fast bubble-pop before registering the pick. Otherwise normal pick.
            const handleClick = (e) => {
              e.currentTarget.blur();
              if (hasPose && !isPose && isMelting && !isPopping) {
                setPoppingActionId(action.id);
                setTimeout(() => registerPick(action.id), 400);
                return;
              }
              registerPick(action.id);
            };

            return (
              <button
                key={action.id}
                className={`action-btn ${isWildcard ? 'wildcard' : ''} ${isPose ? 'is-pose' : ''} ${meltClass} ${popClass} ${poseGrowsClass}`}
                style={transformStyle}
                onClick={handleClick}
                {...hoverHandlers}
              >
                {/* wiggle wrapper so the secondary wiggle animation doesn't clobber the slot transform */}
                <span className="wiggle-inner">
                  {isWildcard && <span className="wildcard-badge">{isPose ? 'POSE' : 'WILDCARD'}</span>}
                  <div className="emoji">{action.emoji}</div>
                  <div className="lbl">{action.label}</div>
                  <div className="desc">{stableDesc(action)}</div>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Chant screen: shown for ~12 seconds when a player picks Pose
  const renderPosenChant = () => {
    const dismiss = () => {
      setPhase('picking');
      setPoseChanter(null);
      if (pendingAdvance) {
        pendingAdvance();
        setPendingAdvance(null);
      }
    };
    const chantPositions = Array.from({ length: 6 }, () => ({
      left: `${Math.floor(Math.random() * 201) - 100}%`,
      top: `${Math.floor(Math.random() * 101)}%`,
    }));
    return (
      <div className="container">
        <div className="chant-screen" onClick={dismiss}>
          <div className="chant-bg"></div>
          <div className="chant-lights">
            <div className="chant-light l1"></div>
            <div className="chant-light l2"></div>
            <div className="chant-light l3"></div>
            <div className="chant-light l4"></div>
          </div>
          <div className="chant-content">
            <div className="chant-who">
              {poseChanter} HAN SAGDE DET!!!
            </div>
            <div className="chant-words">
              {/* Multiple POSEN elements layered with staggered animations */}
              <span className="chant-word w1" style={chantPositions[0]}>POSEN</span>
              <span className="chant-word w2" style={chantPositions[1]}>POSEN</span>
              <span className="chant-word w3" style={chantPositions[2]}>POSEN</span>
              <span className="chant-word w4" style={chantPositions[3]}>POSEN</span>
              <span className="chant-word w5" style={chantPositions[4]}>POSEN</span>
              <span className="chant-word w6" style={chantPositions[5]}>POSEN</span>
            </div>
            <div className="chant-dancers">
              <span className="chant-dancer d1">🛍</span>
              <span className="chant-dancer d2">🍻</span>
              <span className="chant-dancer d3">🛍</span>
              <span className="chant-dancer d4">🍻</span>
              <span className="chant-dancer d5">🛍</span>
            </div>
            <div className="chant-skip">tap anywhere to skip · auto-continues in 12s</div>
          </div>
          <ChantAutoAdvance onDone={dismiss} />
        </div>
      </div>
    );
  };

const renderResult = () => {
    const { outcome, flavor, drinkers, drinkAmount, contributions } = roundResult;
    const bannerClass = 
      outcome === 'deflected' ? 'green' :
      outcome === 'weak' ? 'yellow' : '';

    return (
      <div className="container">
        {renderTopBar()}
        <div className="result-wrap">
          <div className={`result-banner ${bannerClass}`}>
            {flavor}
          </div>

          {renderEscalationMeter()}

          <div className="result-two-col">
            <div className="drinkers-list">
              {roundResult.extraDrinkAll && (
                <div className="danger-zone-banner">
                  {escalationMeter > 0
                    ? '⚠ DANGER ZONE · MELTDOWN INCOMING · +1 TÅR TIL ALLE'
                    : '❄ DANGER ZONE · FADING INTO OBSCURITY · +1 TÅR TIL ALLE'}
                </div>
              )}
              <div className="drink-header">
                {drinkers.length === players.length ? 'EVERYBODY' : drinkers.length + ' PLAYER' + (drinkers.length === 1 ? '' : 'S')} DRINKS
              </div>
              <div className="drink-names">
                {drinkers.length === players.length 
                  ? 'ALL HANDS ON DECK' 
                  : drinkers.map(i => players[i].name).join(' · ')}
              </div>

              <div className="contributions-grid">
                {contributions.map((c) => {
                  const isDrinker = drinkers.includes(c.playerIdx);
                  // Use the post-ascension actual count from updatedPlayers
                  const actualPlayer = players[c.playerIdx];
                  const totalDrinks = actualPlayer?.lastRoundDrinks ?? 0;
                  return (
                    <div
                      className={`contrib-cell ${isDrinker ? 'drinker' : ''} ${roundResult.extraDrinkAll && !isDrinker ? 'danger-drinker' : ''}`}
                      key={c.playerIdx}
                    >
                      <div className="pname">
                        <span>{c.playerName}</span>
                        {totalDrinks > 0 && (
                          <span className="drinks-display">
                            {Array.from({ length: totalDrinks }).map((_, i) => (
                              <span key={i} className="beer">🍺</span>
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="action">{c.action.emoji} {c.action.label}</div>
                      <div className="stats">chaos: {c.chaos} · deflect: {c.deflection}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {renderScoreboard()}
          </div>

          <button className="big-btn" onClick={advanceRound}>
            {round >= TOTAL_ROUNDS ? 'END GAME →' : `NEXT INCIDENT →`}
          </button>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    const sorted = [...players]
      .map((p, i) => ({ ...p, idx: i }))
      .sort((a, b) => b.drinksTotal - a.drinksTotal);
    const totalDrinks = players.reduce((s, p) => s + p.drinksTotal, 0);
    const avgDrinks = (totalDrinks / players.length).toFixed(1);
    const topDrinker = sorted[0];
    const leastDrinker = sorted[sorted.length - 1];

    // Top 3 for the hero podium, rest in the runners-up grid
    const topThree = sorted.slice(0, 3);
    const runnersUp = sorted.slice(3);
    // Arrange podium: 2nd on left, 1st center, 3rd right
    const podiumOrder = topThree.length === 3
      ? [topThree[1], topThree[0], topThree[2]]
      : topThree.length === 2
        ? [topThree[1], topThree[0]]
        : topThree;

    const medals = { 0: '🥇', 1: '🥈', 2: '🥉' };
    const podiumClasses = { 0: 'gold', 1: 'silver', 2: 'bronze' };

    return (
      <div className="container">
        <div className="gameover">
          <h1>HISTORY ENDS</h1>
          <div className="end-subtitle">
            {TOTAL_ROUNDS} INCIDENTS · {totalDrinks} TOTAL DRINKS · 0 LESSONS LEARNED
          </div>

          {/* HERO PODIUM - top 3 */}
          <div className="podium-hero">
            {podiumOrder.map((p) => {
              if (!p) return <div key="empty" />;
              const actualRank = sorted.findIndex(s => s.idx === p.idx);
              return (
                <div className={`podium-block ${podiumClasses[actualRank]}`} key={p.idx}>
                  <div className="medal">{medals[actualRank]}</div>
                  <div className="rank">#{actualRank + 1}</div>
                  <div className="pname">{p.name}</div>
                  <div className="drinks">{p.drinksTotal} 🍺</div>
                  <div className="trait-tag">{p.trait.emoji} {p.trait.label}</div>
                </div>
              );
            })}
          </div>

          {/* Stats panels - compact 2-column horizontal */}
          <div className="end-stats-grid">
            <div className="stat-panel red">
              <div className="label">JERN<br/>LEVEREN</div>
              <div className="pair">
                <div className="value">{topDrinker.name}</div>
                <div className="sub">{topDrinker.drinksTotal} 🍺 · {topDrinker.trait.emoji} {topDrinker.trait.label}</div>
              </div>
            </div>
            <div className="stat-panel">
              <div className="label">IKKE SÅ<br/>TØRSTIG</div>
              <div className="pair">
                <div className="value">{leastDrinker.name}</div>
                <div className="sub">{leastDrinker.drinksTotal} 🍺 · {leastDrinker.trait.emoji} {leastDrinker.trait.label}</div>
              </div>
            </div>
            <div className="stat-panel yellow">
              <div className="label">AVG TÅR<br/>/ SPILLER</div>
              <div className="pair">
                <div className="value">{avgDrinks}</div>
                <div className="sub">over {TOTAL_ROUNDS} incidents</div>
              </div>
            </div>
            <div className="stat-panel">
              <div className="label">FINAL<br/>ESCALATION</div>
              <div className="pair">
                <div className="value">{escalationMeter > 0 ? '+' : ''}{escalationMeter}</div>
                <div className="sub">
                  {escalationMeter > meterMax * 0.4 ? 'world on fire' :
                   escalationMeter < -meterMax * 0.4 ? 'world asleep' : 'somehow stable'}
                </div>
              </div>
            </div>
          </div>

          {/* Runners up */}
          {runnersUp.length > 0 && (
            <>
              <div style={{
                fontFamily: 'Archivo Black, sans-serif',
                textTransform: 'uppercase', letterSpacing: '0.15em',
                color: '#888', fontSize: '0.8rem',
                textAlign: 'left', margin: '30px 0 10px', paddingBottom: '6px',
                borderBottom: '1px solid #333',
              }}>
                ◀ THE REST
              </div>
              <div className="runners-up">
                {runnersUp.map((p) => {
                  const actualRank = sorted.findIndex(s => s.idx === p.idx);
                  return (
                    <div className="runner-card" key={p.idx}>
                      <div className="rank">#{actualRank + 1}</div>
                      <div className="info">
                        <div className="pname">{p.name}</div>
                        <div className="trait">{p.trait.emoji} {p.trait.label}</div>
                      </div>
                      <div className="drinks">{p.drinksTotal} 🍺</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{
            color: '#666', fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.85rem', margin: '30px 0',
          }}>
            The winner is whoever had the most fun.<br/>
            The loser is whoever still has the tab open tomorrow.
          </div>

          <button className="big-btn" onClick={() => {
            setPhase('setup');
            setPlayers([]);
            setPlayerCount(4);
            setRound(0);
            setEscalationMeter(0);
            setUsedScenarios([]);
            setShowTraitReveal(null);
            setFreshDrinkers([]);
          }}>
            NEW WORLD ORDER →
          </button>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  return (
    <>
      <style>{styles}</style>
      <div className="chaos-app" style={{ '--zoom': zoom / 100 }}>
        <div className="grain"></div>
        <div className="ambient-images" aria-hidden="true">
          {currentAmbient && (
            <div
              key={currentAmbient.id}
              className="ambient-image"
              style={{
                top: currentAmbient.top,
                left: currentAmbient.left,
                width: currentAmbient.width,
                height: currentAmbient.height,
                backgroundImage: `url(${currentAmbient.backgroundImage})`,
                animationDuration: currentAmbient.duration,
                animationDelay: currentAmbient.delay,
                '--dx': currentAmbient.dx,
                '--dy': currentAmbient.dy,
                '--start-scale': currentAmbient.startScale,
                '--end-scale': currentAmbient.endScale,
                '--start-rotation': currentAmbient.startRotate,
                '--end-rotation': currentAmbient.endRotate,
                '--opacity-max': currentAmbient.opacityMax,
              }}
            />
          )}
        </div>
        {flash === 'red' && renderExplosion()}
        {flash === 'green' && renderConfetti()}
        {phase === 'setup' && renderSetup()}
        {phase === 'intro' && renderIntro()}
        {phase === 'traits' && renderTraits()}
        {phase === 'scenario' && renderScenario()}
        {phase === 'picking' && renderPicking()}
        {phase === 'posen-chant' && renderPosenChant()}
        {phase === 'result' && renderResult()}
        {phase === 'gameover' && renderGameOver()}
        {renderCornerControls()}
        {/* Audio element - hidden, controlled imperatively */}
        {audioEnabled && audioPlaylist.length > 0 && (
          <audio
            ref={audioRef}
            onEnded={handleTrackEnded}
            loop={true}
            preload="auto"
          />
        )}
        {/* Pose air-horn SFX - dedicated element so it overlaps the soundtrack */}
        {POSE_SOUND_URL && (
          <audio
            ref={poseSoundRef}
            src={POSE_SOUND_URL}
            preload="auto"
          />
        )}
        {/* Press-to-enable audio overlay, shown on setup before first click */}
        {!audioEnabled && SOUNDTRACK.length > 0 && phase === 'setup' && (
          <div className="audio-enable-overlay" onClick={enableAudio}>
            <div className="audio-enable-card">
              <div className="audio-enable-icon">🔊</div>
              <div className="audio-enable-title">PRESS TO ENABLE SOUND</div>
              <div className="audio-enable-sub">
                {SOUNDTRACK.length} track{SOUNDTRACK.length === 1 ? '' : 's'} loaded ·
                {' '}shuffled playback
              </div>
              <div className="audio-enable-skip" onClick={(e) => { e.stopPropagation(); setAudioEnabled(true); }}>
                continue without sound →
              </div>
            </div>
          </div>
        )}
        {/* ======================================================== */}
        {/* PODIUM HIJACK - flickering signal interruption at endgame */}
        {/* ======================================================== */}
        {phase === 'gameover' && HIJACK_VIDEO_URL && hijackPhase !== 'idle' && hijackPhase !== 'done' && (
          <div
            className={`hijack-overlay hijack-${hijackPhase}`}
            onClick={hijackPhase === 'takeover' ? dismissHijack : undefined}
          >
            {/* Flicker grid - shown during 'flickering' phase, squares of static that
                punch through the podium like a hacked TV signal */}
            {hijackPhase === 'flickering' && (
              <div className="hijack-flicker-grid">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div
                    key={i}
                    className="hijack-square"
                    style={{
                      animationDelay: `${Math.random() * 2.2}s`,
                      animationDuration: `${0.08 + Math.random() * 0.35}s`,
                    }}
                  />
                ))}
                <div className="hijack-scanlines" />
                <div className="hijack-signal-text">
                  ⚠ SIGNAL INTERRUPTION ⚠
                </div>
              </div>
            )}
            {/* Fullscreen video takeover */}
            {hijackPhase === 'takeover' && (
              <>
                <video
                  ref={hijackVideoRef}
                  className="hijack-video"
                  src={HIJACK_VIDEO_URL}
                  onEnded={handleHijackEnded}
                  onError={(e) => {
                    const el = e.currentTarget;
                    const err = el.error;
                    const codes = {1:'MEDIA_ERR_ABORTED',2:'MEDIA_ERR_NETWORK',3:'MEDIA_ERR_DECODE',4:'MEDIA_ERR_SRC_NOT_SUPPORTED'};
                    console.error('[HIJACK] <video> error',
                      'code:', err?.code, codes[err?.code] || '?',
                      'message:', err?.message,
                      'src:', el.currentSrc,
                      'networkState:', el.networkState);
                  }}
                  onLoadedData={() => console.log('[HIJACK] video loaded, readyState:', hijackVideoRef.current?.readyState)}
                  onCanPlay={() => console.log('[HIJACK] video canplay')}
                  playsInline
                  controls={true}
                />
                <div className="hijack-dismiss-hint">click anywhere to dismiss</div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};