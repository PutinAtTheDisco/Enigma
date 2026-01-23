// functions/api/puzzle.js
export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 5);

  const puzzle = buildPuzzle(difficulty);
  return json(puzzle);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[randInt(arr.length)]; }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uniq(arr) {
  const s = new Set();
  const out = [];
  for (const x of arr) if (!s.has(x)) { s.add(x); out.push(x); }
  return out;
}

const COLORS = ["YELLOW", "GREEN", "BLUE", "PURPLE"];

// ---------- Core word banks (expand anytime) ----------
const BANK = {
  // Pop culture / nerd bait
  MARVEL: ["AVENGER","VIBRANIUM","MJOLNIR","SNAP","MULTIVERSE","ASGARD","WAKANDA","THANOS","LOKI","SPIDEY"],
  STARWARS: ["JEDI","SITH","PADAWAN","DROID","WOOKIEE","HOLOCRON","LIGHTSABER","HYPERDRIVE","TATOOINE","ENDOR"],
  POKEMON: ["EEVEE","MEWTWO","GENGAR","LUCARIO","SNORLAX","DITTO","PSYDUCK","CHARIZARD","JIGGLYPUFF","PIKACHU"],
  MINECRAFT: ["NETHER","ENDER","REDSTONE","CREEPER","STRIDER","ELYTRA","SPAWNER","ANVIL","BEACON","WITHER"],
  GAMING: ["NPC","NERF","BUFF","HEAL","DPS","RAID","LOOT","GLITCH","PATCH","LAG","SPAWN","SPEEDRUN"],

  // Slang / internet
  SLANG: ["RIZZ","SUS","YEET","NO CAP","BASED","CRINGE","COPE","LURK","BAIT","GASLIGHT","RATIO","SUBTWEET","SHADOWBAN"],

  // Real vocab: spicy but real
  HARDWORDS: ["PERNICIOUS","OBFUSCATE","PANEGYRIC","ABSTRUSE","MENDACIOUS","DEFENESTRATE","PERSPICACIOUS","ANTEDILUVIAN","SANGUINE","LUGUBRIOUS"],

  // Weapons etc
  WEAPONS: ["KATANA","CUTLASS","RAPIER","SABER","LONGBOW","SPEAR","NUNCHAKU","HALBERD","WARHAMMER","DAGGER"],

  // Colors / vibes
  COLORS: ["IVORY","JADE","MAUVE","OCHRE","UMBER","CERULEAN","INDIGO","MAGENTA","VIRIDIAN","SAFFRON"],
};

// Homophone pairs: real pairs only.
const HOMOPHONE_PAIRS = [
  ["WAIST","WASTE"],
  ["SCENT","SENT"],
  ["ARC","ARK"],
  ["SOUL","SOLE"],
  ["PLAIN","PLANE"],
  ["KNIGHT","NIGHT"],
  ["STEEL","STEAL"],
  ["PALE","Pail"], // careful: casing fixed below
  ["WEAK","WEEK"],
  ["STAIR","STARE"],
].map(([a,b]) => [String(a).toUpperCase(), String(b).toUpperCase()]);

// Portmanteaus: real-ish common blends
const PORTMANTEAUS = [
  "MANSPLAIN","STAYCATION","CHILLAX","BRUNCH","SPORK","SMOG","FANFIC","SEXTORTION","COSPLAY","EDUTAINMENT",
].map(x => x.toUpperCase());

// “Fake but declared” blends we allow ONLY when category says so
const FAKE_BLEND_BASES = [
  ["ANKLE","KNEE"], ["TOE","KNEE"], ["FOOT","ELBOW"], ["DORK","WIZARD"], ["MOON","MINE"], ["PIXEL","CRAFT"],
];

// Prefix category: ensure real-ish words (no “MEGAROOM” nonsense)
const MEGA_WORDS = [
  "MEGAPHONE","MEGABYTE","MEGASTAR","MEGACITY","MEGATON","MEGAPLEX","MEGASTORE","MEGADETH","MEGAFAN","MEGAMALL"
].map(x => x.toUpperCase());

// ---------- Category factories ----------
function makeHomophoneCategory() {
  // choose 2 distinct pairs => 4 words
  const pairs = shuffle([...HOMOPHONE_PAIRS]).slice(0, 2);
  const words = [pairs[0][0], pairs[0][1], pairs[1][0], pairs[1][1]].map(w => w.toUpperCase());
  return {
    type: "fixed",
    category: "HOMOPHONE PAIRS",
    words,
  };
}

function makePortmanteauCategory() {
  const words = shuffle([...PORTMANTEAUS]).slice(0, 4);
  return { type: "fixed", category: "PORTMANTEAUS", words };
}

function makeMegaCategory() {
  const words = shuffle([...MEGA_WORDS]).slice(0, 4);
  return { type: "prefix", category: 'WORDS THAT START WITH "MEGA"', words, validator: (w)=>w.startsWith("MEGA") };
}

function makeFandomCrossoverCategory() {
  // pick 4 fandom banks, then 1 iconic term from each
  const options = [
    ["MARVEL","MARVEL"],
    ["STAR WARS","STARWARS"],
    ["POKÉMON","POKEMON"],
    ["MINECRAFT","MINECRAFT"],
    ["GAMING","GAMING"],
    ["INTERNET SLANG","SLANG"],
  ];
  shuffle(options);
  const chosen = options.slice(0, 4);
  const words = chosen.map(([_, key]) => pick(BANK[key]).toUpperCase());
  const label = `FANDOM CROSSOVER: ${chosen.map(([name]) => name).join(", ")}`;
  return { type: "fixed", category: label, words };
}

function makeBankCategory() {
  // pick a bank and take 4
  const entries = Object.entries(BANK);
  const [key, arr] = pick(entries);
  const words = shuffle([...arr]).slice(0, 4).map(w => String(w).toUpperCase());
  const nice = {
    MARVEL: "MARVEL TERMS",
    STARWARS: "STAR WARS TERMS",
    POKEMON: "POKÉMON TERMS",
    MINECRAFT: "MINECRAFT TERMS",
    GAMING: "GAMING TERMS",
    SLANG: "INTERNET SLANG",
    HARDWORDS: "HIGH-LEVEL VOCAB",
    WEAPONS: "WEAPONS",
    COLORS: "COLOR WORDS",
  }[key] || `CATEGORY: ${key}`;
  return { type: "fixed", category: nice, words };
}

function makeFakeButDeclaredCategory() {
  // Build 4 fake blends that still follow a rule, and the category admits it.
  const bases = shuffle([...FAKE_BLEND_BASES]).slice(0, 4);
  const words = bases.map(([a,b]) => blend(a,b).toUpperCase());
  return {
    type: "fake",
    category: "FAKE WORDS THAT SOUND PLAUSIBLE",
    words,
    note: "These are invented, but consistently formed."
  };
}

function blend(a,b) {
  // simple mash: first 2-3 letters of a + last 3-4 of b
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  const aPart = A.slice(0, Math.min(3, Math.max(2, Math.floor(A.length/2))));
  const bPart = B.slice(Math.max(0, B.length - 4));
  return aPart + bPart;
}

// Infinite-ish pattern generator: "WORDS CONTAINING ___"
const CONTAINS_SEEDS = ["ARC","NETH","CRAFT","BYTE","LOOT","RING","FANG","VOID","NEON","HEX"];
const CONTAINS_POOL = uniq([
  ...BANK.GAMING, ...BANK.MINECRAFT, ...BANK.SLANG, ...BANK.HARDWORDS, ...BANK.WEAPONS, ...BANK.COLORS,
  ...BANK.MARVEL, ...BANK.STARWARS, ...BANK.POKEMON
].map(x => String(x).toUpperCase()));

function makeContainsCategory() {
  const seed = pick(CONTAINS_SEEDS);
  const matches = CONTAINS_POOL.filter(w => w.includes(seed) && w.length <= 12);
  if (matches.length < 4) return makeBankCategory();
  const words = shuffle([...matches]).slice(0, 4);
  return { type: "pattern", category: `WORDS THAT CONTAIN "${seed}"`, words, validator:(w)=>w.includes(seed) };
}

// ---------- Puzzle assembly with validation ----------
function buildPuzzle(difficulty) {
  const wanted = [];

  // Always include at least one “logic-safe” category
  wanted.push(makeHomophoneCategory());

  // Add harder/nerdier based on difficulty
  if (difficulty >= 3) wanted.push(makePortmanteauCategory());
  if (difficulty >= 4) wanted.push(makeContainsCategory());
  if (difficulty >= 5) wanted.push(makeFandomCrossoverCategory());

  // Fill remaining slots with variety
  while (wanted.length < 4) {
    const roll = randInt(100);
    let c;
    if (roll < 15) c = makeMegaCategory();
    else if (roll < 35) c = makeFandomCrossoverCategory();
    else if (roll < 55) c = makeContainsCategory();
    else if (roll < 70) c = makeFakeButDeclaredCategory();
    else c = makeBankCategory();
    wanted.push(c);
  }

  // Now enforce uniqueness and correctness
  const groups = [];
  const used = new Set();

  for (const g0 of shuffle(wanted).slice(0, 4)) {
    const g = normalizeGroup(g0);

    // Validate words match the category rules (if present)
    if (g.validator) {
      for (const w of g.words) {
        if (!g.validator(w)) {
          // If this happens, the category factory is broken.
          // Replace with a safe bank category.
          const safe = normalizeGroup(makeBankCategory());
          groups.push(safe);
          safe.words.forEach(w2 => used.add(w2));
          continue;
        }
      }
    }

    // Ensure 4 unique words within group
    g.words = uniq(g.words);
    if (g.words.length !== 4) {
      const safe = normalizeGroup(makeBankCategory());
      groups.push(safe);
      safe.words.forEach(w2 => used.add(w2));
      continue;
    }

    // Ensure no duplicate words across groups
    const overlap = g.words.some(w => used.has(w));
    if (overlap) {
      const safe = normalizeGroup(makeBankCategory());
      groups.push(safe);
      safe.words.forEach(w2 => used.add(w2));
      continue;
    }

    groups.push(g);
    g.words.forEach(w => used.add(w));
  }

  // Difficulty-based “overlap feel”: not word-overlap, but category adjacency
  // We do it by making category names more similar / misleading at high difficulty.
  if (difficulty >= 5) {
    // Slightly meaner labels (still true)
    for (const g of groups) {
      if (g.category === "HIGH-LEVEL VOCAB") g.category = "WORDS THAT MAKE YOU FEEL INADEQUATE";
      if (g.category === "INTERNET SLANG") g.category = "TERMS THAT MAKE ADULTS ANGRY";
    }
  }

  // Assign colors
  const colored = groups.map((g, i) => ({
    color: COLORS[i],
    category: g.category,
    words: g.words
  }));

  // Flatten into tiles
  const tiles = [];
  colored.forEach((grp, gi) => {
    grp.words.forEach(w => tiles.push({ word: w, groupIndex: gi }));
  });

  shuffle(tiles);

  return {
    groups: colored,
    tiles
  };
}

function normalizeGroup(g) {
  return {
    category: String(g.category).toUpperCase(),
    words: g.words.map(w => String(w).toUpperCase()),
    validator: g.validator || null
  };
}
