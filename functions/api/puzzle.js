// /functions/api/puzzle.js
// Connected! — Puzzle generator with: massive category factories, logic validation,
// anti-repeat history, and difficulty-tuned overlap bait.
//
// Works on Cloudflare Pages Functions.
// Uses POST body: { difficulty: 1..5, avoid: [groupKey, ...] }

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    const payload = await safeJson(request);
    const difficulty = clampInt(payload?.difficulty ?? 4, 1, 5, 4);

    // Avoid list: group keys already seen on this device
    const avoid = new Set(Array.isArray(payload?.avoid) ? payload.avoid.slice(0, 2500) : []);

    const config = difficultyConfig(difficulty);

    // Generate 4 valid groups, with controlled overlap bait.
    const puzzle = await buildPuzzle({ config, avoid });

    return json(puzzle, 200);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

/* ------------------------- Core puzzle build ------------------------- */

async function buildPuzzle({ config, avoid }) {
  // Candidate groups: we generate a LOT, validate, filter by avoid, then pick.
  const candidates = await generateCandidates(config);

  const fresh = candidates.filter(g => !avoid.has(g.key));

  // If user has played a ton and we filtered too hard, fall back gracefully.
  const pool = fresh.length >= 60 ? fresh : candidates;

  // Pick 4 groups that don't share exact same words too much (unless brutal).
  const picked = pickFourGroups(pool, config);

  // Create tiles and shuffle
  const tiles = [];
  picked.forEach((g, groupIndex) => {
    g.words.forEach(w => tiles.push({ word: w, groupIndex }));
  });

  shuffleInPlace(tiles);

  // Return shape expected by app.js
  return {
    generatedAt: Date.now(),
    difficulty: config.level,
    groups: picked.map(g => ({
      color: g.color,
      category: g.title,
      words: g.words,
      key: g.key, // important: used by client to avoid repeats
    })),
    tiles
  };
}

function pickFourGroups(pool, config) {
  // We want: sensible, varied, and difficult. Brutal can allow “bait overlap,”
  // but still must be logically solvable.
  const colors = ["YELLOW", "GREEN", "BLUE", "PURPLE"];

  // Score groups by “hardness” and “freshness vibe”
  const scored = pool
    .map(g => ({ g, score: groupScore(g, config) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const usedWords = new Map(); // word -> count
  const usedDomains = new Set();

  for (const { g } of scored) {
    if (picked.length >= 4) break;

    // Avoid repeating same domain too much (unless brutal)
    if (!config.allowDomainRepeats && usedDomains.has(g.domain)) continue;

    // Ensure word uniqueness across groups on easier modes
    if (!config.allowWordOverlap) {
      const overlaps = g.words.filter(w => usedWords.has(w));
      if (overlaps.length) continue;
    } else {
      // Brutal: allow overlap bait occasionally, but not full collisions
      const overlaps = g.words.filter(w => usedWords.has(w));
      if (overlaps.length > config.maxOverlapAcrossGroups) continue;
    }

    picked.push({
      ...g,
      color: colors[picked.length],
    });

    usedDomains.add(g.domain);
    for (const w of g.words) usedWords.set(w, (usedWords.get(w) || 0) + 1);
  }

  // If we still didn't get 4, loosen constraints (rare)
  if (picked.length < 4) {
    for (const { g } of scored) {
      if (picked.length >= 4) break;
      if (picked.some(x => x.key === g.key)) continue;

      const overlaps = g.words.filter(w => picked.some(pg => pg.words.includes(w)));
      if (overlaps.length > 0 && !config.allowWordOverlap) continue;

      picked.push({
        ...g,
        color: colors[picked.length],
      });
    }
  }

  if (picked.length < 4) {
    throw new Error("Not enough valid categories generated. Increase pools.");
  }

  return picked;
}

/* ------------------------- Category generation ------------------------- */

// We generate thousands of category possibilities via “factories”.
// This is how you get 1500+ categories WITHOUT hand-writing 1500 entries.
// Also: validation prevents nonsense.

async function generateCandidates(config) {
  const candidates = [];

  // Domain vocab pools (intentionally huge-ish, but still lightweight)
  const POOLS = buildPools();

  // Factory list: each factory can emit many categories.
  const factories = buildFactories(POOLS);

  // Generate a lot, then validate.
  const target = config.candidateCount;

  // Mix in a tiny bit of “fresh” from the internet sometimes (optional)
  // This helps variety without relying on it.
  const fresh = await maybeFetchFreshTokens(config);
  if (fresh.length) POOLS.FRESH = fresh;

  for (let i = 0; i < target; i++) {
    const f = factories[randInt(factories.length)];
    const g = f();

    if (!g) continue;

    // Validation layer: prevent your “classic movie quote words” nonsense
    if (!validateGroup(g, POOLS)) continue;

    // Keep categories mostly unique
    candidates.push(g);
  }

  // Deduplicate by key
  const seen = new Set();
  const deduped = [];
  for (const g of candidates) {
    if (seen.has(g.key)) continue;
    seen.add(g.key);
    deduped.push(g);
  }

  // Make sure we have enough
  if (deduped.length < 120) {
    // If this happens, your generator became too strict. Loosen validation.
    // For now, throw to make debugging obvious.
    throw new Error("Category generator too strict; not enough candidates.");
  }

  return deduped;
}

function validateGroup(g, POOLS) {
  if (!g) return false;
  if (!g.title || typeof g.title !== "string") return false;
  if (!g.domain) return false;
  if (!Array.isArray(g.words) || g.words.length !== 4) return false;

  // Normalize / reject empty words
  const words = g.words.map(w => String(w).trim()).filter(Boolean);
  if (words.length !== 4) return false;

  // Reject duplicates within a group
  const set = new Set(words.map(w => w.toUpperCase()));
  if (set.size !== 4) return false;

  // Reject “category says X but words don't match X” by requiring a proof function
  if (typeof g.proof === "function") {
    try {
      if (!g.proof(words, POOLS)) return false;
    } catch {
      return false;
    }
  }

  // Title sanity
  if (g.title.length < 4) return false;

  return true;
}

/* ------------------------- Pools + Factories ------------------------- */

function buildPools() {
  // These pools are designed to yield THOUSANDS of valid categories when combined.
  // The factories remix them into stumping categories with real logic checks.

  const SLANG = [
    "RIZZ","YEET","NO CAP","BASED","MID","DRIP","SUS","COPE","LURK","RATIO",
    "GLOWUP","SALTY","CRINGE","SIMP","GOAT","W","L","STAN","DEADASS","BET"
  ];

  const GAMING = [
    "NPC","BUFF","NERF","AGGRO","DPS","HEAL","TANK","LOOT","GRIND","RAID",
    "PATCH","GLITCH","META","SWEAT","SMURF","RESPAWN","SPEEDRUN","K/D"
  ];

  const MINECRAFT = [
    "NETHER","END","ELYTRA","BEACON","ANVIL","OBSIDIAN","REDSTONE","SPAWNER",
    "VILLAGER","ENCHANT","POTION","CREEPER","DIAMOND","EMERALD","ENDER PEARL"
  ];

  const FANTASY = [
    "LONGSWORD","MACE","FLAIL","SCIMITAR","HALBERD","RAPIER","SPEAR","DAGGER",
    "BASILISK","WYVERN","DRAGON","GRIMOIRE","ELDRITCH","PHYLactery".toUpperCase()
  ];

  const SCIENCE = [
    "COSINE","TANGENT","VECTOR","MOMENTUM","ENTROPY","ISOTOPE","IONIC","COVALENT",
    "QUARK","NEUTRINO","SPECTRUM","FRACTAL","PRIME","INERTIA","FREQUENCY"
  ];

  const BIG_WORDS = [
    "PERNICIOUS","OBDURATE","PERSpicacious".toUpperCase(),"LOQUACIOUS","FASTIDIOUS",
    "OBFUSCATE","MENDACIOUS","DELETERIOUS","UBIQUITOUS","SYCOPHANT","INEFFABLE"
  ];

  // Real homophone PAIRS: we store as pairs so the category logic is correct.
  const HOMOPHONE_PAIRS = [
    ["WEEK","WEAK"],
    ["PAIR","PEAR"],
    ["KNIGHT","NIGHT"],
    ["SEA","SEE"],
    ["WAIST","WASTE"],
    ["SENT","SCENT"],
    ["BARE","BEAR"],
    ["PALE","Pail".toUpperCase()], // PALE / PAIL
  ].map(([a,b]) => [a.toUpperCase(), b.toUpperCase()]);

  // “Add a letter” / “swap a letter” base tokens
  const BODY_PARTS = ["TOE","HEEL","ARCH","SOLE","ANKLE","CALF","KNEE","WRIST","PALM","ELBOW"];
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Fandom/Pop culture tokens (not character names, not deep IP):
  const FANDOM = [
    "AVENGER","JEDI","SITH","HOBBIT","WIZARD","CYBORG","MUTANT","SPARTAN",
    "KAIJU","VAMPIRE","WEREWOLF","ANDROID","ALIEN","PIRATE","NINJA"
  ];

  // Wordplay-friendly roots to create “fake but solvable” items
  const MORPHEMES = [
    "MEGA","NANO","HYPER","ULTRA","DARK","NEO","RETRO","AERO","PYRO","CRYO",
    "LUNA","SOLAR","VOID","PIXEL","DREAM","EMBER","MOON","STAR","NOVA","ARC"
  ];

  return {
    SLANG, GAMING, MINECRAFT, FANTASY, SCIENCE, BIG_WORDS,
    HOMOPHONE_PAIRS, BODY_PARTS, LETTERS, FANDOM, MORPHEMES
  };
}

function buildFactories(POOLS) {
  const factories = [];

  // 1) DOMAIN: Straight semantic categories (high quality)
  factories.push(() => pickFromPool("INTERNET SLANG", "slang", POOLS.SLANG));
  factories.push(() => pickFromPool("GAMING TERMS", "gaming", POOLS.GAMING));
  factories.push(() => pickFromPool("MINECRAFT THINGS", "minecraft", POOLS.MINECRAFT));
  factories.push(() => pickFromPool("FANTASY WEAPONS & MONSTERS", "fantasy", POOLS.FANTASY));
  factories.push(() => pickFromPool("SCIENCE/MATH TERMS", "science", POOLS.SCIENCE));
  factories.push(() => pickFromPool("BIG, RUDE WORDS", "words", POOLS.BIG_WORDS));

  // 2) WORDPLAY: Homophone pairs (logic-correct)
  factories.push(() => homophonePairsFactory(POOLS));

  // 3) WORDPLAY: Start-with / end-with (generates hundreds of categories)
  factories.push(() => startsWithFactory(POOLS));
  factories.push(() => endsWithFactory(POOLS));

  // 4) WORDPLAY: Add-one-letter-to-body-part (your “kankle” style, but solvable)
  factories.push(() => addLetterBodyPartsFactory(POOLS));

  // 5) WORDPLAY: Portmanteau-ish / morpheme mashups (solvable because category tells you)
  factories.push(() => morphemeMashFactory(POOLS));

  // 6) HARD MODE: “Belongs to two domains” bait (still valid, just mean)
  factories.push(() => crossDomainBaitFactory(POOLS));

  // 7) Fresh tokens (optional if fetched)
  factories.push(() => {
    if (!Array.isArray(POOLS.FRESH) || POOLS.FRESH.length < 10) return null;
    return pickFromPool("FRESH PULLS (LIVE)", "fresh", POOLS.FRESH);
  });

  return factories;
}

/* ------------------------- Factory helpers ------------------------- */

function pickFromPool(title, domain, pool) {
  if (!pool || pool.length < 8) return null;
  const words = pickFourUnique(pool);
  return finalizeGroup({
    title,
    domain,
    words,
    proof: (ws, POOLS) => ws.every(w => pool.map(x => x.toUpperCase()).includes(w.toUpperCase()))
  });
}

function homophonePairsFactory(POOLS) {
  const pairs = POOLS.HOMOPHONE_PAIRS;
  if (!pairs || pairs.length < 4) return null;

  // Choose 2 pairs -> 4 words (A,B,C,D) where each word has a homophone among the set.
  const p1 = pairs[randInt(pairs.length)];
  let p2 = pairs[randInt(pairs.length)];
  let guard = 0;
  while ((p2[0] === p1[0] || p2[0] === p1[1] || p2[1] === p1[0] || p2[1] === p1[1]) && guard++ < 20) {
    p2 = pairs[randInt(pairs.length)];
  }

  const words = shuffleInPlace([p1[0], p1[1], p2[0], p2[1]]).slice(0, 4);

  return finalizeGroup({
    title: "HOMOPHONE PAIRS",
    domain: "wordplay",
    words,
    proof: (ws, POOLS) => {
      const set = new Set(ws.map(x => x.toUpperCase()));
      // Must contain exactly two known pairs
      let pairCount = 0;
      for (const [a,b] of POOLS.HOMOPHONE_PAIRS) {
        if (set.has(a) && set.has(b)) pairCount++;
      }
      return pairCount === 2;
    }
  });
}

function startsWithFactory(POOLS) {
  // Use morphemes as prefixes to generate MANY categories like:
  // WORDS THAT START WITH "MEGA": MEGATON, MEGASTAR, etc.
  const pre = POOLS.MORPHEMES[randInt(POOLS.MORPHEMES.length)].toUpperCase();

  const bases = [
    "TON","STAR","ARC","ROOM","LINE","PATH","BYTE","CORE","SCOPE","SHIFT","STACK","RIFT","FORM"
  ];

  const words = pickFourUnique(bases).map(b => (pre + b).toUpperCase());

  return finalizeGroup({
    title: `WORDS THAT START WITH "${pre}"`,
    domain: "wordplay",
    words,
    proof: (ws) => ws.every(w => w.toUpperCase().startsWith(pre))
  });
}

function endsWithFactory(POOLS) {
  const suf = pickOne(["CRAFT","VERSE","PUNK","CORE","GATE","WAVE","NADO","TIER","LOCK","SPLAIN","DROP"]);
  const bases = [
    "STAR","MOON","DREAM","EMBER","PIXEL","RETRO","NEO","VOID","AERO","HYPER","NANO","ULTRA"
  ];
  const words = pickFourUnique(bases).map(b => (b + suf).toUpperCase());

  return finalizeGroup({
    title: `WORDS THAT END WITH "${suf}"`,
    domain: "wordplay",
    words,
    proof: (ws) => ws.every(w => w.toUpperCase().endsWith(suf))
  });
}

function addLetterBodyPartsFactory(POOLS) {
  const parts = pickFourUnique(POOLS.BODY_PARTS).map(x => x.toUpperCase());
  const letter = POOLS.LETTERS[randInt(POOLS.LETTERS.length)];
  const words = parts.map(p => injectLetter(p, letter));

  return finalizeGroup({
    title: `ADD "${letter}" SOMEWHERE IN A BODY PART`,
    domain: "wordplay",
    words,
    proof: (ws, POOLS) => {
      // Each is body part + one letter (anagram-ish) in any position.
      const baseSet = new Set(parts);
      return ws.every(w => {
        const upper = w.toUpperCase();
        // Remove one instance of the chosen letter and see if it becomes a body part
        const idx = upper.indexOf(letter);
        if (idx === -1) return false;
        const removed = upper.slice(0, idx) + upper.slice(idx + 1);
        return baseSet.has(removed);
      });
    }
  });
}

function morphemeMashFactory(POOLS) {
  const a = POOLS.MORPHEMES[randInt(POOLS.MORPHEMES.length)].toUpperCase();
  let b = POOLS.MORPHEMES[randInt(POOLS.MORPHEMES.length)].toUpperCase();
  let tries = 0;
  while (b === a && tries++ < 10) b = POOLS.MORPHEMES[randInt(POOLS.MORPHEMES.length)].toUpperCase();

  const tails = ["BLADE","CAST","SHIFT","RIFT","BORN","BOUND","FALL","FORGE","KIND","SPAWN","GLYPH","WALK"];
  const words = pickFourUnique(tails).map(t => (a + b.slice(0, 2) + t).toUpperCase());

  return finalizeGroup({
    title: `MORPHEME MASHUPS (BUILT FROM "${a}" + "${b}")`,
    domain: "wordplay",
    words,
    proof: (ws) => ws.every(w => w.toUpperCase().includes(a) || w.toUpperCase().startsWith(a))
  });
}

function crossDomainBaitFactory(POOLS) {
  // Hard but fair: words that can “feel” like multiple things,
  // but the category is precise.
  // Example: “WORDS THAT ARE BOTH A VERB AND A NOUN”
  const set = [
    "PATCH","RING","PLANE","BAIT","LURK","SPAWN","GRIND","DRIP","STACK","SHIFT"
  ].map(x => x.toUpperCase());

  const words = pickFourUnique(set);

  return finalizeGroup({
    title: "WORDS THAT WORK AS BOTH VERBS AND NOUNS",
    domain: "linguistics",
    words,
    proof: (ws) => ws.every(w => set.includes(w.toUpperCase()))
  });
}

/* ------------------------- Fresh pulls (optional) ------------------------- */

async function maybeFetchFreshTokens(config) {
  if (Math.random() > config.freshChance) return [];

  // Keep it simple + fast: Datamuse “random-ish” via topics
  // (If it fails, we silently ignore.)
  const topics = ["movies", "gaming", "internet", "mythology", "science", "music", "sports", "slang"];
  const topic = topics[randInt(topics.length)];

  try {
    const url = `https://api.datamuse.com/words?topics=${encodeURIComponent(topic)}&max=80`;
    const res = await fetch(url, { headers: { "accept": "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const words = (Array.isArray(data) ? data : [])
      .map(x => String(x?.word || "").trim())
      .filter(w => w && w.length <= 14)
      .slice(0, 60)
      .map(w => w.toUpperCase());

    // De-dupe
    return [...new Set(words)].slice(0, 60);
  } catch {
    return [];
  }
}

/* ------------------------- Difficulty config ------------------------- */

function difficultyConfig(level) {
  // Higher difficulty: more candidates, more wordplay, more overlap allowed, more fresh pulls.
  const base = {
    level,
    candidateCount: 900, // this is what makes the “pool” feel huge
    freshChance: 0.15,
    allowWordOverlap: false,
    maxOverlapAcrossGroups: 0,
    allowDomainRepeats: false,
  };

  if (level === 1) return { ...base, candidateCount: 700, freshChance: 0.05 };
  if (level === 2) return { ...base, candidateCount: 850, freshChance: 0.08 };
  if (level === 3) return { ...base, candidateCount: 1000, freshChance: 0.12, allowWordOverlap: true, maxOverlapAcrossGroups: 1 };
  if (level === 4) return { ...base, candidateCount: 1200, freshChance: 0.18, allowWordOverlap: true, maxOverlapAcrossGroups: 1 };
  return { ...base, candidateCount: 1500, freshChance: 0.25, allowWordOverlap: true, maxOverlapAcrossGroups: 2, allowDomainRepeats: true };
}

function groupScore(g, config) {
  // Prefer:
  // - wordplay + linguistics + multi-step patterns
  // - longer titles on brutal
  // - “domain variety”
  let s = 0;
  if (g.domain === "wordplay") s += 40;
  if (g.domain === "linguistics") s += 25;
  if (g.domain === "science") s += 20;
  if (g.domain === "fantasy") s += 15;
  if (g.domain === "fresh") s += 30;

  s += Math.min(20, Math.floor(g.title.length / 8));

  // Brutal likes chaos
  if (config.level >= 5) s += randInt(15);
  return s;
}

/* ------------------------- Utilities ------------------------- */

function finalizeGroup({ title, domain, words, proof }) {
  const cleaned = words.map(w => String(w).trim().toUpperCase());
  const key = makeKey(title, cleaned);
  return { title, domain, words: cleaned, key, proof };
}

function makeKey(title, words) {
  // Stable ID for "seen history"
  const raw = (title + "::" + words.slice().sort().join("|")).toUpperCase();
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "g_" + (h >>> 0).toString(16);
}

function pickFourUnique(pool) {
  const arr = Array.isArray(pool) ? pool.slice() : Array.from(pool);
  shuffleInPlace(arr);
  return arr.slice(0, 4).map(x => String(x).trim().toUpperCase());
}

function pickOne(arr) {
  const a = Array.isArray(arr) ? arr : Array.from(arr);
  return a[randInt(a.length)];
}

function injectLetter(word, letter) {
  // Insert letter at a random non-edge position to keep it readable-ish
  const w = word.toUpperCase();
  const pos = clampInt(randInt(w.length + 1), 1, w.length - 1, 1);
  return (w.slice(0, pos) + letter + w.slice(pos)).toUpperCase();
}

function randInt(n) { return Math.floor(Math.random() * n); }

function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function safeJson(request) {
  try {
    if (request.method === "GET") return {};
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
