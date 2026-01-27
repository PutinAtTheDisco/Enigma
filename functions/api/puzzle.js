// functions/api/puzzle.js
// Cloudflare Pages Functions: /api/puzzle
// Goal: generate Connections-style puzzles that are HARD but FAIR.
// No invisible logic. No "trust me bro" categories.
//
// Query params:
//   difficulty=1..5  (default 4)
//   seen=comma words (optional) - client can pass recently seen words to reduce repeats
//   seenCats=comma cat ids (optional) - client can pass recent category ids to reduce repeats

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

const clampInt = (v, min, max, fallback) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const uniqUpper = (s) => String(s || "").trim().toUpperCase();

const WORD_MAX = 12; // keep tiles readable; longer words should be avoided by generator

// ---------------------------
// BIG WORD POOLS (curated + fair)
// ---------------------------

// Keep pools compact-ish but varied.
// Add more anytime, but keep them "solvable from the grid" style.

const POOLS = {
  // Common but crisp
  COLORS: ["IVORY", "JADE", "AMBER", "TEAL", "MAUVE", "OCHRE", "SABLE", "TAUPE", "CORAL", "INDIGO"],
  SHAPES: ["ARC", "RING", "CONE", "CUBE", "SPHERE", "PRISM", "TORUS", "OVAL", "WEDGE", "HELIX"],

  // Language / academia
  GREEK: ["ALPHA", "BETA", "GAMMA", "DELTA", "THETA", "LAMBDA", "SIGMA", "OMEGA"],
  LATIN_PHRASES: ["AD HOC", "ET AL", "A PRIORI", "PER SE", "DE FACTO", "IN VIVO", "IN SITU", "EX POST"],
  LOGIC: ["AXIOM", "LEMMA", "PROOF", "CLAIM", "COROLLARY", "THEOREM", "INFERENCE", "FALLACY"],
  RHETORIC: ["ETHOS", "PATHOS", "LOGOS", "IRONY", "SATIRE", "HYPERBOLE", "METAPHOR", "EUPHEMISM"],

  // Pop/nerd culture terms (still fair categories)
  GAME_TERMS: ["NPC", "SPAWN", "RAID", "LOOT", "PATCH", "NERF", "BUFF", "GLITCH", "QUEST", "BOSS"],
  COMIC: ["HERO", "VILLAIN", "ORIGIN", "CAMEO", "CANON", "RETCON", "REBOOT", "SEQUEL"],
  MEME_SLANG: ["RIZZ", "BASED", "SUS", "COPE", "YEET", "DRIP", "NO CAP", "LURK", "BAIT", "GLOWUP"],

  // Science-y but not nonsense
  SI_BASE: ["AMPERE", "KELVIN", "SECOND", "METER", "KILOGRAM", "MOLE", "CANDELA"],
  CHEM_SYMBOLS: ["H", "HE", "C", "N", "O", "NA", "CL", "FE", "AG", "AU", "SN", "PB"],
  ASTRONOMY: ["ORBIT", "ECLIPSE", "NEBULA", "COMET", "GALAXY", "QUASAR", "PULSAR", "AURORA"],

  // Weapons (safe list)
  MED_WEAPONS: ["FLAIL", "MACE", "SPEAR", "DAGGER", "CUTLASS", "SCIMITAR", "HALBERD", "LONGBOW"],

  // Minecraft-ish but accurate
  MINECRAFT: ["NETHER", "END", "ELYTRA", "ANVIL", "BEACON", "OBSIDIAN", "REDSTONE", "CREEPER", "VILLAGER", "ENCHANT"],
};

// Some “made-up” words are allowed only inside specific *visible* rules.
// Example: add a letter, spoonerize, replace vowel, etc.
// We’ll generate those rather than storing random fake junk.

// ---------------------------
// CATEGORY GENERATORS (each returns { id, category, words, explain?, tags? })
// Must be FAIR: relationship inferable from the 4 words themselves.
// ---------------------------

const makeCategory = (id, category, words, meta = {}) => ({
  id,
  category,
  words,
  ...meta,
});

const isGoodWord = (w) => {
  const x = uniqUpper(w);
  if (!x) return false;
  if (x.length > WORD_MAX) return false;
  // avoid strings that are only punctuation
  if (!/[A-Z0-9]/.test(x)) return false;
  return true;
};

const normalizeWords = (words) =>
  words.map(uniqUpper).filter(isGoodWord);

// Validators: prevent "invisible logic"
const validators = {
  // For homophone pairs, we must include both sides for each pair.
  homophonePairs(words, pairs) {
    const set = new Set(words);
    // At least 2 pairs visible (4 words)
    return pairs.every(([a, b]) => set.has(a) && set.has(b));
  },

  // For prefix/suffix rule, all words must share prefix/suffix visibly.
  startsWith(words, prefix) {
    return words.every((w) => w.startsWith(prefix));
  },
  endsWith(words, suffix) {
    return words.every((w) => w.endsWith(suffix));
  },

  // For anagram set, all words must be anagrams of the same sorted letters.
  allAnagrams(words) {
    const key = (w) => w.replace(/\s+/g, "").split("").sort().join("");
    const k0 = key(words[0]);
    return words.every((w) => key(w) === k0);
  },

  // For "one-letter-off" family, all must differ by exactly one letter from a base.
  oneLetterFromBase(words, base) {
    const b = base.replace(/\s+/g, "");
    const dist = (a, b) => {
      if (a.length !== b.length) return 999;
      let d = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
      return d;
    };
    const clean = (w) => w.replace(/\s+/g, "");
    return words.every((w) => dist(clean(w), b) === 1);
  },
};

function genPrefixStarts(prefix, pool, id) {
  // pull words from pool that start with prefix
  const picks = shuffle(pool.map(uniqUpper).filter((w) => w.startsWith(prefix)));
  const words = picks.slice(0, 4);
  if (words.length < 4) return null;
  if (!validators.startsWith(words, prefix)) return null;
  return makeCategory(id, `WORDS THAT START WITH "${prefix}"`, words);
}

function genPrefixEnds(suffix, pool, id) {
  const picks = shuffle(pool.map(uniqUpper).filter((w) => w.endsWith(suffix)));
  const words = picks.slice(0, 4);
  if (words.length < 4) return null;
  if (!validators.endsWith(words, suffix)) return null;
  return makeCategory(id, `WORDS THAT END WITH "${suffix}"`, words);
}

function genSetFromPool(category, pool, id) {
  const picks = shuffle(pool.map(uniqUpper).filter(isGoodWord)).slice(0, 4);
  if (picks.length < 4) return null;
  return makeCategory(id, category, picks);
}

function genHomophonePairs(id) {
  // Visible pairs only. Always.
  const PAIRS = [
    ["SEA", "SEE"],
    ["KNIGHT", "NIGHT"],
    ["PAIR", "PEAR"],
    ["WEEK", "WEAK"],
    ["MALE", "MAIL"],
    ["STAKE", "STEAK"],
    ["PAIN", "PANE"],
    ["SENT", "SCENT"],
    ["PLAIN", "PLANE"],
    ["RIGHT", "WRITE"],
    ["SON", "SUN"],
    ["HOLE", "WHOLE"],
  ].map(([a, b]) => [uniqUpper(a), uniqUpper(b)]);

  const twoPairs = shuffle(PAIRS).slice(0, 2);
  const words = normalizeWords([twoPairs[0][0], twoPairs[0][1], twoPairs[1][0], twoPairs[1][1]]);
  if (words.length !== 4) return null;
  if (!validators.homophonePairs(words, twoPairs)) return null;
  return makeCategory(id, "HOMOPHONE PAIRS", words);
}

function genPortmanteau(id) {
  // Visible portmanteaus, common enough to be fair.
  const pool = ["STAYCATION", "CHILLAX", "MANSPLAIN", "FANFIC", "BRUNCH", "SPORK", "FRENEMY", "HANGRY"];
  const words = shuffle(pool).slice(0, 4).map(uniqUpper);
  return makeCategory(id, "PORTMANTEAUS", words);
}

function genLogicSet(id) {
  return genSetFromPool("FORMAL LOGIC WORDS", POOLS.LOGIC, id);
}

function genRhetoricSet(id) {
  return genSetFromPool("RHETORICAL DEVICES", POOLS.RHETORIC, id);
}

function genGreekLetters(id) {
  const words = shuffle(POOLS.GREEK).slice(0, 4).map(uniqUpper);
  return makeCategory(id, "GREEK LETTERS", words);
}

function genComicCanon(id) {
  return genSetFromPool("STORY CONTINUITY TERMS", POOLS.COMIC, id);
}

function genGameTerms(id) {
  return genSetFromPool("VIDEO GAME TERMS", POOLS.GAME_TERMS, id);
}

function genMinecraftSet(id) {
  return genSetFromPool("MINECRAFT THINGS", POOLS.MINECRAFT, id);
}

function genWeapons(id) {
  return genSetFromPool("MEDIEVAL WEAPONS", POOLS.MED_WEAPONS, id);
}

function genSIBase(id) {
  const words = shuffle(POOLS.SI_BASE).slice(0, 4).map(uniqUpper);
  return makeCategory(id, "SI BASE UNITS", words);
}

function genChemSymbols(id) {
  const words = shuffle(POOLS.CHEM_SYMBOLS).slice(0, 4).map(uniqUpper);
  return makeCategory(id, "CHEMICAL SYMBOLS", words);
}

function genAstronomy(id) {
  return genSetFromPool("ASTRONOMY WORDS", POOLS.ASTRONOMY, id);
}

function genPalindrome-ish(id) {
  // Fair: words that become a different word when reversed is NOT fair.
  // Instead: actual palindromes or known ones.
  const pool = ["LEVEL", "RADAR", "CIVIC", "ROTOR", "KAYAK", "REFER"];
  const words = shuffle(pool).slice(0, 4).map(uniqUpper);
  return makeCategory(id, "PALINDROMES", words);
}

function genOneLetterOff(id) {
  // Choose a base word and create 4 variants differing by one letter.
  const bases = ["STONE", "PLANE", "CABLE", "TRACE", "SCORE", "RANGE", "SPORE"];
  const base = pick(bases).toUpperCase();
  // build variants by swapping one position
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const mk = (pos, ch) => base.slice(0, pos) + ch + base.slice(pos + 1);
  const variants = new Set();
  while (variants.size < 4) {
    const pos = Math.floor(Math.random() * base.length);
    const ch = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (ch === base[pos]) continue;
    variants.add(mk(pos, ch));
  }
  const words = [...variants].map(uniqUpper);
  if (!validators.oneLetterFromBase(words, base)) return null;
  return makeCategory(id, `ONE-LETTER CHANGES OF "${base}"`, words);
}

function genStartsWithMega(id) {
  // Make sure these are real-ish or at least consistent and readable.
  const pool = ["MEGAPHONE", "MEGACITY", "MEGASTAR", "MEGATON", "MEGABYTE", "MEGALITH", "MEGASTORE", "MEGAPLEX"];
  return genPrefixStarts("MEGA", pool, id);
}

function genEndsWithCraft(id) {
  // Your nerd heart asked for it.
  const pool = ["MOONCRAFT", "EMBERCRAFT", "DREAMCRAFT", "PIXELCRAFT", "STARCRAFT", "WITCHCRAFT", "HANDCRAFT", "SOULCRAFT"];
  return genPrefixEnds("CRAFT", pool, id);
}

function genSlangSet(id) {
  return genSetFromPool("INTERNET SLANG", POOLS.MEME_SLANG, id);
}

// Scholar-y wordplay that stays fair:
function genHiddenWord(id) {
  // The category is: "CONTAINS ___"
  // All 4 words contain the same trigram.
  const chunks = ["ARC", "ION", "MAL", "TAR", "RIZ", "NETH", "LOG", "THE"];
  const chunk = pick(chunks).toUpperCase();

  // Build words that contain the chunk; mix real + plausible, but keep readable.
  // Avoid going too fake: we use a small curated bank per chunk.
  const bank = {
    ARC: ["ARCH", "ARCADE", "MONARCH", "SEARCH"],
    ION: ["IONIC", "POTION", "LION", "UNION"],
    TAR: ["STAR", "TAROT", "GUITAR", "TARMAC"],
    LOG: ["LOGIC", "PROLOG", "CATALOG", "BLOG"],
    THE: ["THEME", "THEORY", "THESIS", "THEATER"],
    MAL: ["MALICE", "NORMAL", "ANOMALY", "MALLET"],
    RIZ: ["RIZZ", "BRIZ", "RIZZO", "RIZAL"], // okay, spicy
    NETH: ["NETHER", "ANETH", "NETHIN", "NETHERS"], // will be validated by length
  };

  const pool = (bank[chunk] || []).map(uniqUpper).filter(isGoodWord);
  if (pool.length < 4) return null;
  const words = shuffle(pool).slice(0, 4);
  // visible validation
  if (!words.every((w) => w.includes(chunk))) return null;
  return makeCategory(id, `CONTAINS "${chunk}"`, words);
}

// ---------------------------
// “Freshness” source (Wikidata labels)
// We keep this optional + safe.
// We only use it to build one category: "FAMOUS ___ (FROM WIKIDATA)" with strict rules.
// ---------------------------

async function fetchWikidataLabels(limit = 40) {
  // Pull English labels for random-ish items via a generic query.
  // Guard: if fetch fails, we just return [].
  const endpoint = "https://query.wikidata.org/sparql";
  const query = `
    SELECT ?item ?itemLabel WHERE {
      ?item wdt:P31 ?type .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${Math.max(10, Math.min(80, limit))}
  `;

  try {
    const url = endpoint + "?format=json&query=" + encodeURIComponent(query);
    const res = await fetch(url, {
      headers: { "user-agent": "Connected!/CF Pages Function" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const labels = (data?.results?.bindings || [])
      .map((b) => b?.itemLabel?.value)
      .filter(Boolean)
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z][A-Za-z\s\-]{1,20}$/.test(s)) // keep it tile-friendly
      .map((s) => s.toUpperCase())
      .filter((s) => s.length <= WORD_MAX);
    // De-dup
    return [...new Set(labels)];
  } catch {
    return [];
  }
}

function genFromWikidata(labels, id) {
  // Make a fair category: "FOUR REAL-WORLD NAMES" is not fair.
  // So we do a category that is self-contained: "FOUR SINGLE-WORD PROPER NOUNS"
  // It's still knowledge-based, but coherent and not invisible.
  const pool = labels.filter((s) => s.split(/\s+/).length === 1);
  if (pool.length < 20) return null;
  const words = shuffle(pool).slice(0, 4).map(uniqUpper);
  return makeCategory(id, "PROPER NOUNS (WIKIDATA PULL)", words);
}

// ---------------------------
// Category bank + weighting
// ---------------------------

const BANK = [
  { id: "HOMOPHONE_PAIRS", w: 8, fn: genHomophonePairs },
  { id: "PORTMANTEAUS", w: 6, fn: genPortmanteau },
  { id: "LOGIC", w: 6, fn: genLogicSet },
  { id: "RHETORIC", w: 6, fn: genRhetoricSet },
  { id: "GREEK", w: 6, fn: genGreekLetters },
  { id: "COMIC_CANON", w: 6, fn: genComicCanon },
  { id: "GAME_TERMS", w: 6, fn: genGameTerms },
  { id: "MINECRAFT", w: 6, fn: genMinecraftSet },
  { id: "WEAPONS", w: 5, fn: genWeapons },
  { id: "SI_BASE", w: 5, fn: genSIBase },
  { id: "CHEM_SYMBOLS", w: 5, fn: genChemSymbols },
  { id: "ASTRONOMY", w: 5, fn: genAstronomy },
  { id: "PALINDROMES", w: 4, fn: genPalindrome-ish },
  { id: "ONE_LETTER_OFF", w: 6, fn: genOneLetterOff },
  { id: "STARTS_MEGA", w: 4, fn: genStartsWithMega },
  { id: "ENDS_CRAFT", w: 4, fn: genEndsWithCraft },
  { id: "SLANG", w: 6, fn: genSlangSet },
  { id: "HIDDEN_WORD", w: 7, fn: genHiddenWord },
];

// Weighted choice with exclusion
function weightedPick(exclusions = new Set()) {
  const options = BANK.filter((x) => !exclusions.has(x.id));
  const total = options.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const opt of options) {
    r -= opt.w;
    if (r <= 0) return opt;
  }
  return options[options.length - 1];
}

// ---------------------------
// Puzzle assembly + strict fairness
// ---------------------------

function scoreOverlap(groups) {
  // Counts how many tiles could plausibly fit multiple groups by naive heuristics.
  // We want more overlap at higher difficulty, but still valid groups.
  const allWords = groups.flatMap((g) => g.words);
  const counts = new Map();
  for (const w of allWords) counts.set(w, (counts.get(w) || 0) + 1);
  // duplicates should be zero; if any duplicates, overlap score is max (bad)
  const dup = [...counts.values()].some((c) => c > 1);
  if (dup) return 999;

  // Soft overlap heuristics: shared prefixes/suffixes across groups
  const prefix2 = (w) => w.replace(/\s+/g, "").slice(0, 2);
  const suffix2 = (w) => w.replace(/\s+/g, "").slice(-2);
  let overlaps = 0;
  const seenP = new Map();
  const seenS = new Map();
  for (const w of allWords) {
    const p = prefix2(w);
    const s = suffix2(w);
    seenP.set(p, (seenP.get(p) || 0) + 1);
    seenS.set(s, (seenS.get(s) || 0) + 1);
  }
  for (const v of seenP.values()) if (v >= 3) overlaps += 1;
  for (const v of seenS.values()) if (v >= 3) overlaps += 1;
  return overlaps;
}

function validatePuzzle(groups) {
  if (groups.length !== 4) return false;

  // all words must be unique + tile-safe
  const all = groups.flatMap((g) => g.words.map(uniqUpper));
  if (all.length !== 16) return false;

  const set = new Set(all);
  if (set.size !== 16) return false;

  // avoid ultra-long words
  if (all.some((w) => w.length > WORD_MAX)) return false;

  return true;
}

// Colors by difficulty; harder = more likely BLUE/PURPLE are evil
const COLOR_ORDER = ["YELLOW", "GREEN", "BLUE", "PURPLE"];

function difficultyConfig(difficulty) {
  // difficulty 1: simplest categories, less overlap pressure
  // difficulty 5: maximum overlap bait + more wordplay categories
  return {
    attempts: 40 + difficulty * 10,
    overlapTarget: difficulty <= 2 ? 0 : difficulty === 3 ? 1 : difficulty === 4 ? 2 : 3,
    allowWikidata: difficulty >= 4, // optional spice
    wikidataChance: difficulty >= 5 ? 0.35 : difficulty >= 4 ? 0.2 : 0.0,
    preferWordplay: difficulty >= 4,
  };
}

async function buildPuzzle(difficulty, seenWordsSet, seenCatsSet) {
  const cfg = difficultyConfig(difficulty);

  // Preload Wikidata sometimes (non-blocking failure)
  let wikidataLabels = [];
  if (cfg.allowWikidata && Math.random() < cfg.wikidataChance) {
    wikidataLabels = await fetchWikidataLabels(60);
  }

  for (let attempt = 0; attempt < cfg.attempts; attempt++) {
    const usedCats = new Set();
    const groups = [];

    // optionally exclude recently seen categories
    const catExclusions = new Set(seenCatsSet || []);
    // build 4 groups
    while (groups.length < 4) {
      const opt = weightedPick(new Set([...usedCats, ...catExclusions]));
      let g = opt.fn(opt.id);

      // Wikidata slot sometimes replaces a mid group, but only if it succeeds
      if (!g && opt.id === "WIKIDATA") continue;

      // Sometimes add Wikidata as an extra option
      if (!g && wikidataLabels.length && Math.random() < 0.15) {
        g = genFromWikidata(wikidataLabels, "WIKIDATA");
      } else if (!g && wikidataLabels.length && groups.length === 2 && Math.random() < 0.25) {
        g = genFromWikidata(wikidataLabels, "WIKIDATA");
      }

      if (!g) continue;

      // normalize + reject seen words to reduce repeats (best effort)
      g.words = normalizeWords(g.words);
      if (g.words.length !== 4) continue;
      if (g.words.some((w) => seenWordsSet.has(w))) continue;

      usedCats.add(opt.id);
      groups.push(g);
    }

    // strict validation
    if (!validatePuzzle(groups)) continue;

    // overlap tuning: keep overlap at/near target
    const overlapScore = scoreOverlap(groups);
    const target = cfg.overlapTarget;
    // We accept if within 1 of target; higher difficulty wants more overlap.
    if (Math.abs(overlapScore - target) > 1) continue;

    // assign standard NYT-ish colors in order, but shuffle which category gets which
    const colors = shuffle([...COLOR_ORDER]);
    const colored = groups.map((g, i) => ({
      color: colors[i],
      category: g.category,
      words: g.words,
      _id: g.id,
    }));

    // Build tiles and shuffle
    const tiles = shuffle(
      colored.flatMap((g, gi) => g.words.map((w) => ({ word: w, groupIndex: gi })))
    );

    return { groups: colored, tiles };
  }

  // last-resort fallback: just make something valid even if overlap isn't perfect
  const fallbackGroups = [
    genHomophonePairs("HOMOPHONE_PAIRS"),
    genPortmanteau("PORTMANTEAUS"),
    genGameTerms("GAME_TERMS"),
    genLogicSet("LOGIC"),
  ].map((g, i) => ({
    color: COLOR_ORDER[i],
    category: g.category,
    words: g.words.map(uniqUpper),
    _id: g.id,
  }));

  const tiles = shuffle(
    fallbackGroups.flatMap((g, gi) => g.words.map((w) => ({ word: w, groupIndex: gi })))
  );

  return { groups: fallbackGroups, tiles };
}

// ---------------------------
// CF Pages Function entry
// ---------------------------

export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);

  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 4);

  const seenWords = (u.searchParams.get("seen") || "")
    .split(",")
    .map(uniqUpper)
    .filter(Boolean);

  const seenCats = (u.searchParams.get("seenCats") || "")
    .split(",")
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  const seenWordsSet = new Set(seenWords);
  const seenCatsSet = new Set(seenCats);

  const puzzle = await buildPuzzle(difficulty, seenWordsSet, seenCatsSet);
  return json(puzzle);
}
