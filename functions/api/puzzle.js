export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);

  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 4);

  // Client can send recently used tokens so we avoid repeats *per user*
  // recent=comma,separated,slugs
  const recentParam = (u.searchParams.get("recent") || "").trim();
  const recent = new Set(
    recentParam
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 250) // cap
  );

  const config = {
    difficulty,
    wikidataChance: difficulty >= 4 ? 0.35 : difficulty === 3 ? 0.25 : 0.15,
    maxAttempts: 250,
    avoidRecent: true,
    recentSet: recent,
  };

  const localBank = buildMegaBank();                // huge, curated + templates
  const fresh = await maybeFetchWikidataWords(config).catch(() => null); // optional spice

  const bank = mergeBanks(localBank, fresh);

  const puzzle = generatePuzzle(bank, config);

  return json(puzzle);
}

/* ------------------------------ helpers ------------------------------ */

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------ bank building ------------------------------ */

function mergeBanks(localBank, fresh) {
  if (!fresh) return localBank;

  // Add a few “fresh” categories built from fresh pools
  // This keeps logic valid: categories are “members of X list”
  const add = [];

  if (fresh.people?.length >= 12) {
    add.push({
      id: "fresh-people",
      colorBias: "BLUE",
      category: "FRESH PULL: NOTABLE PEOPLE",
      words: uniq(sampleN(fresh.people, 20)).map(w => w.toUpperCase()),
      type: "set",
    });
  }

  if (fresh.places?.length >= 12) {
    add.push({
      id: "fresh-places",
      colorBias: "GREEN",
      category: "FRESH PULL: PLACES",
      words: uniq(sampleN(fresh.places, 20)).map(w => w.toUpperCase()),
      type: "set",
    });
  }

  if (fresh.things?.length >= 12) {
    add.push({
      id: "fresh-things",
      colorBias: "PURPLE",
      category: "FRESH PULL: THINGS",
      words: uniq(sampleN(fresh.things, 20)).map(w => w.toUpperCase()),
      type: "set",
    });
  }

  return [...localBank, ...add];
}

function buildMegaBank() {
  const bank = [];

  // ---- Curated “sets” (big lists you can pull 4 from)
  // Keep them broad so you don’t repeat fast.

  bank.push(setCat("minecraft-dimensions", "MINECRAFT DIMENSIONS", [
    "NETHER","END","OVERWORLD","AETHER","TWILIGHT","DEEP DARK","END CITY","BASALT DELTAS","CRIMSON FOREST","WARPED FOREST",
  ]));

  bank.push(setCat("minecraft-items", "MINECRAFT ITEMS", [
    "ELYTRA","BEACON","ANVIL","OBSIDIAN","TOTEM","TRIDENT","SHULKER","ENDER PEARL","NETHERITE","REDSTONE","ENCHANTING TABLE","SPAWNER",
  ]));

  bank.push(setCat("pokemon-types", "POKÉMON TYPES", [
    "GHOST","DRAGON","FAIRY","STEEL","PSYCHIC","DARK","FIRE","WATER","GRASS","ICE","GROUND","FLYING",
  ]));

  bank.push(setCat("marvel-heroes", "MARVEL HEROES", [
    "IRON MAN","THOR","HULK","WANDA","VISION","SPIDER-MAN","BLACK PANTHER","HAWKEYE","DEADPOOL","LOKI","CAPTAIN MARVEL","ANT-MAN",
  ]));

  bank.push(setCat("star-wars-places", "STAR WARS PLANETS", [
    "ENDOR","TATOOINE","HOTH","NABOO","CORUSCANT","KAMINO","MUSTAFAR","DAGOBAH","JAKKU","KASHYYYK","GEONOSIS","ALDERAAN",
  ]));

  bank.push(setCat("internet-slang", "INTERNET SLANG", [
    "RIZZ","BASED","NO CAP","SUS","COPE","LURK","BAIT","GLOWUP","RATIO","IYKYK","MAIN CHARACTER","TOUCH GRASS",
  ]));

  bank.push(setCat("weapons-medieval", "MEDIEVAL WEAPONS", [
    "LONGSWORD","CUTLASS","RAPIER","HALBERD","MACE","FLAIL","SPEAR","AXE","DAGGER","WARHAMMER","SCIMITAR","CROSSBOW",
  ]));

  bank.push(setCat("weapons-modern", "MODERN WEAPONS (TERMS)", [
    "CARBINE","SUPPRESSOR","MAGAZINE","BAYONET","CALIBER","OPTIC","STOCK","TRIGGER","HOLSTER","SCOPE","MUZZLE","FOREGRIP",
  ]));

  bank.push(setCat("colors-weird", "OBSCURE COLOR NAMES", [
    "CERULEAN","PERIWINKLE","PUCE","TAUPE","OCHRE","VERMILION","MALACHITE","SAFFRON","FUCHSIA","ALABASTER","CHARTREUSE","AUBURN",
  ]));

  bank.push(setCat("gen-z-words", "GEN-Z TERMS", [
    "SITUATIONSHIP","ICK","DELU-LU","SLAY","BET","CAP","GIVING","ATE","POV","STAN","DRIP","CORE",
  ]));

  bank.push(setCat("video-game-boss-vibes", "VIDEO GAME BOSS VIBES", [
    "ENRAGE","PHASE TWO","AOE","DPS CHECK","RAGE TIMER","MINIONS","ONE-SHOT","TELEGRAPH","IMMUNE","DOT","STUN","AGGRO",
  ]));

  // ---- Template generators (near infinite)

  bank.push(templateCat("prefix-mega", "WORDS THAT START WITH “MEGA”", () => prefixWords("MEGA", 40)));
  bank.push(templateCat("prefix-anti", "WORDS THAT START WITH “ANTI”", () => prefixWords("ANTI", 40)));
  bank.push(templateCat("suffix-core", "WORDS THAT END WITH “CORE”", () => suffixWords("CORE", 40)));
  bank.push(templateCat("suffix-gate", "SCANDALS ENDING IN “-GATE”", () => suffixWords("GATE", 30)));

  bank.push(templateCat("add-letter-foot", "ADD A LETTER: FOOT PARTS → CHAOS", () =>
    addLetterCategory(["TOE","HEEL","ARCH","SOLE"], ["TOEZ","HEELO","ARCHH","SOLEK","TOEK","HEELA","ARCHX","SOLED"])
  ));

  bank.push(templateCat("portmanteaus", "PORTMANTEAUS", () =>
    ["CHILLAX","STAYCATION","MANSPLAIN","COSPLAY","SPORK","BRUNCH","SMOG","FRENEMY","BROMANCE","HANGRY","EDUTAIN","SITCOM"]
  ));

  bank.push(templateCat("homophones", "HOMOPHONE PAIRS", () => {
    // We generate pairs and then sample 4 from the pool
    const pairs = [
      ["SCENT","SENT"],["WAIST","WASTE"],["PAIL","PALE"],["WEAK","WEEK"],["KNIGHT","NIGHT"],
      ["SEA","SEE"],["PAIR","PARE"],["STAIR","STARE"],["WRING","RING"],["HOLE","WHOLE"],
    ];
    return pairs.flat().map(x => x.toUpperCase());
  }));

  bank.push(templateCat("movie-quotes-words", "WORDS FOUND IN CLASSIC MOVIE QUOTES", () => {
    const pool = [
      "MATRIX","CHOICE","SPOON","FORCE","HOPE","FATHER","RUN","FIGHT","LOVE","TRUTH","ALIEN","MAYHEM",
      "FRIEND","ENEMY","CHAOS","DESTINY","FREEDOM","DREAM","REAL","GHOST","TIME","SPACE","RETURN","GAME",
    ];
    return pool;
  }));

  bank.push(templateCat("fake-but-valid", "FAKE WORDS THAT FEEL REAL", () => {
    // These are “allowed” because the category *defines* them.
    const pool = [
      "KANKLE","GLOMP","SHLORP","YEETIFY","CRINGELORD","DOOMSCROLL","VIBRANIUM","SHADOWBAN","RETCON","SUBTWEET",
      "MOONCRAFT","EMBERCRAFT","PIXELCRAFT","DREAMCRAFT","CLICKBAIT","SPOILERCIDE","MEMETIC","GLITCHTIDE",
    ];
    return pool.map(x => x.toUpperCase());
  }));

  // ---- Expandable “topic buckets” that rotate wording and lists
  bank.push(...fandomBuckets());
  bank.push(...nerdBuckets());
  bank.push(...languageBuckets());

  return bank;
}

function setCat(id, category, words, colorBias=null) {
  return {
    id,
    type: "set",
    colorBias,
    category,
    words: uniq(words).map(w => String(w).toUpperCase()),
  };
}

function templateCat(id, category, makeWords, colorBias=null) {
  return {
    id,
    type: "template",
    colorBias,
    category,
    makeWords,
  };
}

function uniq(a){
  const out = [];
  const seen = new Set();
  for(const x of a){
    const k = String(x).toUpperCase().trim();
    if(!k) continue;
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function sampleN(arr, n){
  const a = [...arr];
  shuffle(a);
  return a.slice(0, n);
}

function prefixWords(prefix, target=30){
  // Mix “real-ish” and nerdy words so it’s not the same boring dictionary lines.
  const stems = [
    "CITY","STORE","STAR","LITH","BYTE","BOSS","CHURCH","PHONE","WORLD","DRIVE","MIND","LORD","BUILD","TONE","THREAD","MOTION",
    "SCOPE","CHAD","DOME","VERSE","DUNGEON","ARC","QUEST","GLITCH","WAVE","PIXEL","FORCE","METER","MACHINE","BEAM","DROP","HYPE",
  ];
  const pool = [];
  for(const s of stems){
    pool.push(prefix + s);
  }
  // add a few “real” ones
  ["MEGAPHONE","MEGASTORE","MEGACITY","MEGATON","MEGABYTE","MEGASTAR","MEGACHURCH","MEGALITH"].forEach(x => pool.push(x));
  return uniq(pool).slice(0, target);
}

function suffixWords(suffix, target=30){
  const stems = [
    "HARD","SOFT","IRON","SALT","FATE","DREAM","MEME","CHAOS","NOVA","GEEK","DOOM","STAR","WIND","CLOUD","NEON","PIXEL",
    "DRAMA","FANDOM","SKILL","NIGHT","SPOILER","RAGE","QUEST","VOID","MOON","SHADOW","VIBE","CRINGE",
  ];
  const pool = stems.map(s => s + suffix);
  return uniq(pool).slice(0, target);
}

function addLetterCategory(base, variants){
  // base is canonical. variants are plausible mutated forms.
  return uniq([...base, ...variants]).slice(0, 40).map(x => x.toUpperCase());
}

function fandomBuckets(){
  const buckets = [];

  const franchises = [
    { id:"lotr", name:"LORD OF THE RINGS THINGS", words:["RING","MORDOR","GONDOR","SHIRE","NAZGUL","PALANTIR","HOBBIT","ENT","ORC","ELF","DWARF","MITHRIL"] },
    { id:"harry", name:"HARRY POTTER THINGS", words:["HORCRUX","AUROR","HOWLER","PATRONUS","SNITCH","AZKABAN","MUGGLE","WAND","POTION","SQUIB","HAGRID","SLYTHERIN"] },
    { id:"pokemon-items", name:"POKÉMON ITEMS", words:["POTION","RARE CANDY","MASTER BALL","REPEL","POKEDEX","TM","BERRY","NUGGET","REVIVE","ELIXIR","ULTRA BALL","EVERSTONE"] },
    { id:"zelda", name:"ZELDA THINGS", words:["HYRULE","TRIFORCE","RUPEE","KOKIRI","SHEIKAH","MASTER SWORD","GANON","Epona","BOMB","BOOMERANG","HOOKSHOT","Ocarina"] },
    { id:"halo", name:"HALO WORDS", words:["SPARTAN","CORTANA","RINGWORLD","FLOOD","ELITE","WRAITH","NEEDLER","WARTHOG","ODST","UNSC","REACH","FORERUNNER"] },
  ];

  for(const f of franchises){
    buckets.push(setCat(`fandom-${f.id}`, f.name, f.words));
  }

  return buckets;
}

function nerdBuckets(){
  const buckets = [];

  buckets.push(setCat("math-terms", "MATH WORDS", [
    "COSINE","TANGENT","ARC","VECTOR","MATRIX","PROOF","LEMMA","INTEGRAL","FACTOR","PRIME","MODULO","SERIES"
  ]));

  buckets.push(setCat("software-terms", "SOFTWARE DEV WORDS", [
    "REFACTOR","COMMIT","BRANCH","MERGE","REBASE","PATCH","HOTFIX","ROLLBACK","DEPLOY","BUILD","RELEASE","REGRESSION"
  ]));

  buckets.push(setCat("story-terms", "STORY TERMS", [
    "CANON","RETCON","SEQUEL","REBOOT","ARC","CLIMAX","FORESHADOW","TROPE","MACGUFFIN","PLOT HOLE","PROLOGUE","EPILOGUE"
  ]));

  return buckets;
}

function languageBuckets(){
  const buckets = [];

  buckets.push(setCat("big-words", "OBNOXIOUSLY BIG WORDS", [
    "DEFENESTRATION","PERSPICACIOUS","PERNICIOUS","PUSILLANIMOUS","OBFUSCATE","SESQUIPEDALIAN","MENDACIOUS","CONFLAGRATION",
    "OBSEQUIOUS","PERAMBULATE","PANDEMONIUM","INEFFABLE"
  ]));

  buckets.push(templateCat("rhymes-ish", "NEAR RHYMES", () => {
    const pool = ["SPLICE","SPICE","SLICE","DICE","VICE","RICE","MICE","NICE","TWICE","PRICE","BRICE","ICE"];
    return uniq(pool).map(x => x.toUpperCase());
  }));

  return buckets;
}

/* ------------------------------ puzzle generation ------------------------------ */

function generatePuzzle(bank, config){
  // We need 4 groups of 4. Each group comes from a category source.
  // Avoid repeats using config.recentSet.
  const attempts = config.maxAttempts;

  for(let a=0; a<attempts; a++){
    const chosenCats = pickFourCategories(bank, config);
    if(!chosenCats) continue;

    const groups = [];
    const usedWords = new Set();

    let ok = true;
    for(const cat of chosenCats){
      const pulled = pullFourWords(cat, usedWords, config);
      if(!pulled){ ok = false; break; }

      groups.push({
        color: pickColor(groups.length),
        category: cat.category,
        words: pulled
      });
      pulled.forEach(w => usedWords.add(w));
    }
    if(!ok) continue;

    // Make tiles
    const tiles = [];
    groups.forEach((g, gi) => {
      g.words.forEach(w => tiles.push({ word: w, groupIndex: gi }));
    });

    // Shuffle tiles for gameplay
    shuffle(tiles);

    // Save “seen” tokens into response so client can store it
    const seenTokens = [];
    for(const g of groups){
      seenTokens.push("cat:" + slug(g.category));
      g.words.forEach(w => seenTokens.push("w:" + slug(w)));
    }

    return { groups, tiles, seen: seenTokens };
  }

  // If everything fails, fallback to a safe deterministic puzzle
  return fallbackPuzzle();
}

function pickColor(i){
  return ["YELLOW","GREEN","BLUE","PURPLE"][i] || "YELLOW";
}

function pickFourCategories(bank, config){
  const pool = [...bank];

  // Avoid recently used categories hard
  const filtered = pool.filter(c => {
    if(!config.avoidRecent) return true;
    const token = "cat:" + slug(c.category);
    return !config.recentSet.has(token);
  });

  // If too strict, relax
  const source = filtered.length >= 12 ? filtered : pool;

  shuffle(source);

  // Prefer templates more at high difficulty to create variety
  const wantTemplates = config.difficulty >= 4 ? 2 : config.difficulty === 3 ? 1 : 0;

  const picked = [];
  let templatesPicked = 0;

  for(const c of source){
    if(picked.length === 4) break;

    const isTemplate = c.type === "template";
    if(isTemplate && templatesPicked >= wantTemplates && Math.random() < 0.55) continue;

    // prevent same id duplicates
    if(picked.some(p => p.id === c.id)) continue;

    picked.push(c);
    if(isTemplate) templatesPicked++;
  }

  if(picked.length !== 4) return null;
  return picked;
}

function pullFourWords(cat, usedWords, config){
  let words = [];

  if(cat.type === "set"){
    words = cat.words;
  } else if(cat.type === "template"){
    words = cat.makeWords();
  } else {
    return null;
  }

  words = uniq(words).map(x => String(x).toUpperCase());

  // Avoid words recently seen
  if(config.avoidRecent){
    words = words.filter(w => !config.recentSet.has("w:" + slug(w)));
  }

  // Avoid words already used in this puzzle
  words = words.filter(w => !usedWords.has(w));

  // Need at least 4
  if(words.length < 4) return null;

  // Higher difficulty: increase overlap bait by adding a “decoy-ish” chance
  // (but still valid because we only pick from one true category)
  // The overlap comes from the category *design*, not cheating.

  const picked = sampleN(words, 4);

  // sanity: all unique, not blank
  if(new Set(picked).size !== 4) return null;

  return picked;
}

function fallbackPuzzle(){
  const groups = [
    { color:"YELLOW", category:"MINECRAFT ITEMS", words:["ELYTRA","BEACON","ANVIL","OBSIDIAN"] },
    { color:"GREEN", category:"STORY TERMS", words:["CANON","RETCON","SEQUEL","REBOOT"] },
    { color:"BLUE", category:"INTERNET SLANG", words:["RIZZ","BASED","SUS","NO CAP"] },
    { color:"PURPLE", category:"MEDIEVAL WEAPONS", words:["LONGSWORD","RAPIER","HALBERD","DAGGER"] },
  ];
  const tiles = [];
  groups.forEach((g, gi) => g.words.forEach(w => tiles.push({ word:w, groupIndex: gi })));
  shuffle(tiles);
  const seen = [];
  groups.forEach(g => {
    seen.push("cat:" + slug(g.category));
    g.words.forEach(w => seen.push("w:" + slug(w)));
  });
  return { groups, tiles, seen };
}

/* ------------------------------ optional wikidata ------------------------------ */
/*
  This is deliberately minimal so it won’t break your app.
  It fetches *labels* for a few entity types. If it fails, we just ignore it.

  If you want bigger firehose later: we can add multiple endpoints + caching.
*/

async function maybeFetchWikidataWords(config){
  if(Math.random() > config.wikidataChance) return null;

  const people = await wikidataQuery(`
    SELECT ?itemLabel WHERE {
      ?item wdt:P31 wd:Q5 .
      ?item wdt:P106 ?occ .
    }
    LIMIT 60
  `);

  const places = await wikidataQuery(`
    SELECT ?itemLabel WHERE {
      ?item wdt:P31/wdt:P279* wd:Q17334923 .
    }
    LIMIT 60
  `);

  const things = await wikidataQuery(`
    SELECT ?itemLabel WHERE {
      ?item wdt:P31 wd:Q35120 .
    }
    LIMIT 60
  `);

  return {
    people: people,
    places: places,
    things: things,
  };
}

async function wikidataQuery(sparql){
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql);
  const res = await fetch(url, {
    headers: {
      "accept": "application/sparql-results+json",
      "user-agent": "Connected!/1.0 (educational toy)",
    }
  });
  if(!res.ok) return [];
  const j = await res.json();
  const rows = j?.results?.bindings || [];
  const out = [];
  for(const r of rows){
    const label = r.itemLabel?.value;
    if(!label) continue;
    // keep sane: 1–24 chars, no weird punctuation storms
    const clean = label.replace(/\s+/g, " ").trim();
    if(clean.length < 2 || clean.length > 24) continue;
    out.push(clean.toUpperCase());
  }
  return uniq(out);
}
