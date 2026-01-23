// functions/api/puzzle.js
export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const difficulty = clampInt(url.searchParams.get("difficulty"), 1, 5, 4);

    const puzzle = buildPuzzle(difficulty);

    return new Response(JSON.stringify(puzzle), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: String(err?.message || err),
    }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[randInt(a.length)]; }
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
function upperWords(ws){ return ws.map(w => String(w).trim().toUpperCase()); }

const COLORS = ["YELLOW","GREEN","BLUE","PURPLE"];

// -----------------------------
// BIG BANKS (variety + fandoms)
// -----------------------------
const BANK = {
  SLANG: [
    "RIZZ","SUS","YEET","NO CAP","BASED","CRINGE","COPE","LURK","BAIT","RATIO","SUBTWEET","SHADOWBAN","FYP","IYKYK",
    "MID","GLOWUP","STAN","MAIN CHARACTER","DEADASS","GASLIGHT","SOFT LAUNCH","HARD LAUNCH","SIMP","W","L"
  ],
  GAMING: [
    "NPC","DPS","RAID","LOOT","PATCH","NERF","BUFF","SPAWN","GLITCH","SPEEDRUN","HITBOX","AGGRO","COOLDOWN","AOE","RNG","META"
  ],
  MINECRAFT: [
    "NETHER","ENDER","REDSTONE","CREEPER","ELYTRA","BEACON","WITHER","SPAWNER","ANVIL","VILLAGER","ENCHANT","OBSIDIAN","STRIDER"
  ],
  POKEMON: [
    "PIKACHU","DITTO","EEVEE","MEWTWO","GENGAR","LUCARIO","SNORLAX","PSYDUCK","CHARIZARD","JIGGLYPUFF","POKEDEX"
  ],
  MARVEL: [
    "AVENGER","WAKANDA","ASGARD","VIBRANIUM","MULTIVERSE","MJOLNIR","THANOS","LOKI","SPIDEY","INFINITY"
  ],
  STARWARS: [
    "JEDI","SITH","PADAWAN","DROID","WOOKIEE","LIGHTSABER","HYPERDRIVE","TATOOINE","ENDOR","HOLOCRON"
  ],
  HORROR: [
    "SLASHER","FINAL GIRL","JUMPSCARE","HAUNTED","POSSESSED","POLTERGEIST","NOSFERATU","LYCANTHROPE","BANSHEE","WENDIGO"
  ],
  WEAPONS: [
    "KATANA","CUTLASS","RAPIER","SABER","HALBERD","WARHAMMER","NUNCHAKU","DAGGER","SPEAR","LONGBOW"
  ],
  COLORS: [
    "IVORY","JADE","MAUVE","OCHRE","UMBER","CERULEAN","INDIGO","MAGENTA","VIRIDIAN","SAFFRON","ONYX","AZURE"
  ],
  BIGWORDS: [
    "PERNICIOUS","OBFUSCATE","ABSTRUSE","MENDACIOUS","PERSPICACIOUS","ANTEDILUVIAN","LUGUBRIOUS","SANGUINE","RECALCITRANT","INSOUCIANT"
  ],
  INTERNET: [
    "THREAD","HOT TAKE","REPLY GUY","DOOMSCROLL","ALGORITHM","CLICKBAIT","PAYWALL","VIRAL","MEME","PASTA","RAGEQUIT"
  ],
  TV_MOVIE: [
    "CAMEO","REBOOT","SEQUEL","SPINOFF","CANON","RETCON","MONTAGE","CLIFFHANGER","CREDITS","TRAILER"
  ],
};

// Real homophone PAIRS (we only use 2 pairs per category, not a random soup)
const HOMO_PAIRS = [
  ["PLAIN","PLANE"],
  ["SCENT","SENT"],
  ["WAIST","WASTE"],
  ["SOUL","SOLE"],
  ["STEEL","STEAL"],
  ["KNIGHT","NIGHT"],
  ["STAIR","STARE"],
  ["WEAK","WEEK"],
  ["SIGHT","SITE"],
  ["ROLE","ROLL"],
].map(([a,b]) => [a.toUpperCase(), b.toUpperCase()]);

// Portmanteaus (real/common)
const PORTMANTEAUS = [
  "BRUNCH","CHILLAX","STAYCATION","MANSPLAIN","SPORK","SMOG","COSPLAY","EDUTAINMENT","INFOMERCIAL","HANGRY","BROMANCE","FANFIC"
].map(x => x.toUpperCase());

// Prefix/suffix pools (clean patterns)
const MEGA_WORDS = [
  "MEGAPHONE","MEGABYTE","MEGACITY","MEGASTORE","MEGAPLEX","MEGATON","MEGASTAR","MEGAMALL","MEGADETH","MEGAFAN"
].map(x => x.toUpperCase());

const AFTER_QUICK = ["FIX","SAND","SILVER","STUDY","DRAW","CHANGE","STEP","FIRE"].map(x=>x.toUpperCase());

// Safe “fake words” (category admits it)
const FAKE_BASES = [
  ["ANKLE","KNEE"],["TOE","ANKLE"],["FOOT","KNEE"],["MOON","MINE"],["PIXEL","CRAFT"],["DRAMA","LLAMA"],["GOBLIN","VIBES"],
  ["CHAOS","COFFEE"],["DOOM","SCROLL"],["WIZARD","LIZARD"]
];

// -----------------------------
// CATEGORY FACTORIES (STRICT)
// -----------------------------
function catHomophones() {
  const pairs = shuffle([...HOMO_PAIRS]).slice(0, 2);
  const words = upperWords([pairs[0][0], pairs[0][1], pairs[1][0], pairs[1][1]]);
  return {
    kind: "homophones",
    category: "HOMOPHONE PAIRS",
    words,
    validator: (w) => words.includes(w) // locked set
  };
}

function catPortmanteaus() {
  const words = shuffle([...PORTMANTEAUS]).slice(0, 4);
  return { kind:"portmanteau", category:"PORTMANTEAUS", words };
}

function catMega() {
  const words = shuffle([...MEGA_WORDS]).slice(0, 4);
  return { kind:"prefix", category:'WORDS THAT START WITH "MEGA"', words, validator:(w)=>w.startsWith("MEGA") };
}

function catAfterQuick() {
  const words = shuffle([...AFTER_QUICK]).slice(0,4);
  return { kind:"phrase", category:'WORDS AFTER "QUICK"', words, validator:(w)=>AFTER_QUICK.includes(w) };
}

function catBank() {
  const entries = Object.entries(BANK);
  const [key, list] = pick(entries);
  const words = shuffle([...list]).slice(0, 4).map(w => String(w).toUpperCase());
  const title = ({
    SLANG:"INTERNET SLANG",
    GAMING:"GAMING TERMS",
    MINECRAFT:"MINECRAFT TERMS",
    POKEMON:"POKÉMON TERMS",
    MARVEL:"MARVEL TERMS",
    STARWARS:"STAR WARS TERMS",
    HORROR:"HORROR TERMS",
    WEAPONS:"WEAPONS",
    COLORS:"COLOR WORDS",
    BIGWORDS:"WORDS THAT MAKE YOU FEEL INADEQUATE",
    INTERNET:"ONLINE LIFE",
    TV_MOVIE:"TV/MOVIE TERMS",
  })[key] || key;
  return { kind:"bank", category:title, words };
}

function blend(a,b) {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  const aPart = A.slice(0, Math.min(3, Math.max(2, Math.floor(A.length/2))));
  const bPart = B.slice(Math.max(0, B.length - 4));
  return (aPart + bPart).replace(/\s+/g,"");
}

function catFakeButDeclared() {
  const picks = shuffle([...FAKE_BASES]).slice(0,4);
  const words = picks.map(([a,b]) => blend(a,b)).map(w => w.toUpperCase());
  return { kind:"fake", category:"FAKE WORDS THAT SOUND PLAUSIBLE", words };
}

function catFandomCrossover() {
  const sources = [
    ["MARVEL","MARVEL"],
    ["STAR WARS","STARWARS"],
    ["POKÉMON","POKEMON"],
    ["MINECRAFT","MINECRAFT"],
    ["GAMING","GAMING"],
    ["INTERNET","INTERNET"],
    ["SLANG","SLANG"],
    ["TV/MOVIE","TV_MOVIE"],
    ["HORROR","HORROR"],
  ];
  shuffle(sources);
  const chosen = sources.slice(0,4);
  const words = chosen.map(([_, key]) => pick(BANK[key]).toUpperCase());
  const label = `FANDOM CROSSOVER: ${chosen.map(([name]) => name).join(", ")}`;
  return { kind:"crossover", category:label, words };
}

// -----------------------------
// BUILD PUZZLE (NO LOGIC CRIMES)
// -----------------------------
function buildPuzzle(difficulty) {
  const factories = [
    catHomophones,
    catPortmanteaus,
    catBank,
    catFandomCrossover,
    catMega,
    catAfterQuick,
    catFakeButDeclared,
  ];

  // Weighting: higher difficulty = more trap categories
  const weights = (difficulty) => {
    if (difficulty <= 2) return [3,2,6,1,2,1,0];   // mostly bank + easy patterns
    if (difficulty === 3) return [3,3,5,2,2,2,1];
    if (difficulty === 4) return [3,3,4,3,2,2,2];
    return [3,3,3,4,2,2,3]; // brutal: more crossover + fake
  };

  const w = weights(difficulty);
  const picks = [];
  while (picks.length < 10) {
    const idx = weightedIndex(w);
    picks.push(factories[idx]());
  }

  // Select 4 categories that do NOT share words
  const groups = [];
  const used = new Set();

  for (const g of shuffle(picks)) {
    const words = uniq(upperWords(g.words));
    if (words.length !== 4) continue;
    if (words.some(x => used.has(x))) continue;
    groups.push({
      color: COLORS[groups.length],
      category: String(g.category).toUpperCase(),
      words
    });
    words.forEach(x => used.add(x));
    if (groups.length === 4) break;
  }

  // Fallback: if we somehow didn’t get 4, brute fill with bank categories
  while (groups.length < 4) {
    const g = catBank();
    const words = uniq(upperWords(g.words));
    if (words.length !== 4) continue;
    if (words.some(x => used.has(x))) continue;
    groups.push({ color: COLORS[groups.length], category: String(g.category).toUpperCase(), words });
    words.forEach(x => used.add(x));
  }

  // Build tiles
  const tiles = [];
  groups.forEach((g, groupIndex) => g.words.forEach(word => tiles.push({ word, groupIndex })));
  shuffle(tiles);

  return { groups, tiles };
}

function weightedIndex(weights) {
  const total = weights.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (let i=0;i<weights.length;i++){
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
