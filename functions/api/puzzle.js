export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 4);

  const cfg = {
    overlapChance: [0.10, 0.14, 0.22, 0.32, 0.48][difficulty - 1],
    weirdChance:   [0.12, 0.18, 0.26, 0.38, 0.52][difficulty - 1],
    decoyChance:   [0.00, 0.06, 0.10, 0.16, 0.22][difficulty - 1],
    wikidataChance:[0.10, 0.18, 0.28, 0.38, 0.50][difficulty - 1],
    rerollMax:     [20,   30,   45,   70,   100][difficulty - 1],
    maxWordLen: 18
  };

  const pools = buildPools();
  const fresh = await maybeFetchWikidata(cfg.wikidataChance, cfg.maxWordLen).catch(() => null);

  const puzzle = generatePuzzle({ cfg, pools, fresh });

  return new Response(JSON.stringify(puzzle), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clampInt(v, min, max, fallback){
  const n = Number(v);
  if(!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
function randInt(n){ return Math.floor(Math.random() * n); }
function choice(arr){ return arr[randInt(arr.length)]; }
function shuffleInPlace(a){
  for(let i=a.length-1;i>0;i--){
    const j = randInt(i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uniq(arr){ return [...new Set(arr)]; }
function upper(s){ return String(s).toUpperCase(); }

function cleanWord(w, maxLen){
  const x = upper(w)
    .replace(/\s+\(.*\)$/g, "")
    .replace(/[^\w ':-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if(!x) return null;
  if(x.length < 2 || x.length > maxLen) return null;
  return x;
}

/* -------------------- BIGGER POOLS -------------------- */
function buildPools(){
  // The point is breadth. If it exists in English, it can get drafted.

  const slang = [
    "RIZZ","YEET","GOATED","SUS","CAP","NO CAP","BET","DRIP","FOMO","IYKYK","COPE","MALD",
    "LOCK IN","DELULU","ATE","SERVE","LOWKEY","HIGHKEY","RATIO","TOUCH GRASS","SWEATY","NAUR"
  ];

  const memes = [
    "RICKROLL","DOGE","PEPE","LOSS","AMOGUS","NPC","SKIBIDI","OHIO","GIGACHAD","THIS IS FINE",
    "SURPRISED PIKACHU","UNO REVERSE","DISTRACTED BF","OK BOOMER","BRAIN ROT","MAIN CHARACTER"
  ];

  const internet = [
    "THREAD","SUBTWEET","DOXX","ALT","LURK","SHADOWBAN","DOGPILE","HOT TAKE","SOFT LAUNCH","BLOCKLIST",
    "FARMING","BAIT","COPE","SEETHE","YAPPING"
  ];

  const games = [
    "RNG","NERF","BUFF","PATCH","SPAWN","AGGRO","DPS","TANK","HEAL","QUEST","LOOT","BOSS","NPC",
    "CRIT","CLUTCH","SPEEDRUN","HITBOX","NOCLIP","GLITCH","META","GRIND","PVP","PVE","RAID"
  ];

  const moviesTv = [
    "REBOOT","SEQUEL","PREQUEL","RETCON","CAMEO","SPINOFF","MACGUFFIN","PLOT ARMOR","CLIFFHANGER",
    "MONTAGE","COLD OPEN","POST-CREDITS","CANON","FILLER","EASTER EGG","FORESHADOW","DIRECTOR'S CUT"
  ];

  const colors = [
    "CERULEAN","MAGENTA","TAUPE","MAUVE","OCHRE","UMBER","VIRIDIAN","CHARTREUSE","SAFFRON","PERIWINKLE",
    "FUCHSIA","PUCE","VERMILION","INDIGO","TEAL","IVORY","JADE","COBALT","MAROON","CYAN"
  ];

  const weapons = [
    "KATANA","HALBERD","RAPIER","TRIDENT","CROSSBOW","SPEAR","DAGGER","MACE","SABER","WARHAMMER",
    "CUTLASS","BATTLEAXE","JAVELIN","SCIMITAR","NUNCHAKU","LONGSWORD"
  ];

  const bigWords = [
    "OBFUSCATE","PERNICIOUS","MENDACIOUS","SYCOPHANT","EPISTEMIC","PALIMPSEST","DEFENESTRATE",
    "APOTHEOSIS","SESQUIPEDALIAN","ZEITGEIST","MACHIAVELLIAN","PERSPICACIOUS"
  ];

  const obscure = [
    "KAKISTOCRACY","ULTRACREPIDARIAN","HIRSUTE","SANGUINE","LIMINAL","GNOMIC","NOETIC","CHTHNIC",
    "EIDOLON","SINECURE","COZEN","SIBILANT","APORIA","PALINODE"
  ];

  const anatomy = [
    "ARCH","TOE","HEEL","SOLE","ANKLE","CALF","SHIN","KNEE","WRIST","PALM","ELBOW","THUMB","JAW","RIB","HIP","TEMPLE"
  ];

  const nerdFranchises = {
    "POKEMON THINGS": ["POKEDEX","POKEBALL","GYM","BADGE","EVOLVE","SHINY","STARTER","LEGENDARY"],
    "STAR WARS WORDS": ["JEDI","SITH","PADAWAN","DROID","LIGHTSABER","HYPERDRIVE","HOLOCRON","WOOKIEE"],
    "MARVEL-ISH": ["VIBRANIUM","MULTIVERSE","INFINITY","VARIANT","AVENGER","VILLAIN","CAMEO","AFTERCREDITS"],
    "FANTASY RPG": ["MANA","QUEST","DUNGEON","DRAGON","PALADIN","WARLOCK","RANGER","CLERIC"],
    "MINECRAFT-ISH": ["CREEPER","REDSTONE","NETHER","ENDERMAN","ENCHANT","PICKAXE","BIOME","SPAWNER"]
  };

  const overlapBait = [
    "CANON","META","PATCH","BOSS","RUSH","CRUSH","SPRITE","ARC","SHIP","RUNE","MINT","BUNDLE",
    "GRIND","SPAWN","JADE","IVORY","QUEST"
  ];

  const prefixes = ["DARK","NIGHT","STAR","MOON","VOID","NEO","CYBER","MEGA","ULTRA","GIGA","SHADOW","PIXEL","GHOST"];
  const suffixes = ["CORE","CODE","PUNK","LORD","MANCER","GATE","VIBE","LOCK","WAVE","VERSE","SPAWN","CRAFT"];

  const afterBlanks = [
    { lead:"DARK", opts:["HORSE","MODE","ROOM","WEB","SIDE","MATTER","STAR","ARTS"] },
    { lead:"SILVER", opts:["LINING","SCREEN","BULLET","FOX","SPOON","TONGUE"] },
    { lead:"GHOST", opts:["TOWN","MODE","SHIP","WRITER","LIGHT","HUNT"] },
    { lead:"FINAL", opts:["BOSS","FORM","CUT","WARNING","FANTASY"] },
    { lead:"TOUCH", opts:["GRASS","DOWN","BASE","SCREEN"] }
  ];

  const oneLetterPairs = [
    ["CANON","CANNON"], ["WASTE","WAIST"], ["SCENT","SENT"], ["STEAL","STEEL"],
    ["FORM","FROM"], ["LATER","LATTE"], ["PLAIN","PLANE"], ["HOARD","HORDE"]
  ];

  return {
    slang, memes, internet, games, moviesTv, colors, weapons, bigWords, obscure, anatomy,
    nerdFranchises, overlapBait, prefixes, suffixes, afterBlanks, oneLetterPairs
  };
}

/* -------------------- WIKIDATA SPICE -------------------- */
async function maybeFetchWikidata(prob, maxLen){
  if(Math.random() > prob) return null;

  const queries = [
    // video games
    `SELECT ?itemLabel WHERE { ?item wdt:P31 wd:Q7889 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80`,
    // films
    `SELECT ?itemLabel WHERE { ?item wdt:P31 wd:Q11424 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80`,
    // TV series
    `SELECT ?itemLabel WHERE { ?item wdt:P31 wd:Q5398426 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80`
  ];

  const q = choice(queries);
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q);

  const res = await fetch(url, {
    headers: {
      "accept": "application/sparql-results+json",
      "user-agent": "Enigma/1.0 (puzzle generator)"
    }
  });

  if(!res.ok) return null;
  const data = await res.json();

  const out = [];
  for(const b of data?.results?.bindings || []){
    const label = b?.itemLabel?.value;
    const c = cleanWord(label, maxLen);
    if(c) out.push(c);
  }
  return uniq(out).slice(0, 60);
}

/* -------------------- GENERATION -------------------- */
function generatePuzzle({ cfg, pools, fresh }){
  const colorsOrder = ["YELLOW","GREEN","BLUE","PURPLE"];

  for(let attempt=0; attempt<cfg.rerollMax; attempt++){
    const used = new Set();
    const groups = [];

    const gens = buildGenerators({ cfg, pools, fresh });

    // Guarantee at least one “weird/cryptic” group sometimes
    if(Math.random() < cfg.weirdChance) groups.push(choice(gens.weird)());
    else groups.push(choice(gens.normal)());

    while(groups.length < 4){
      const bank = (Math.random() < cfg.weirdChance) ? gens.weird : gens.normal;
      const g = choice(bank)();

      if(groups.some(x => x.category === g.category)) continue;
      if(!isGroupSane(g, cfg)) continue;
      if(g.words.some(w => used.has(w))) continue;

      g.words.forEach(w => used.add(w));
      groups.push(g);
    }

    if(!isPuzzleSane(groups)) continue;

    // Shuffle color mapping so difficulty isn't predictable by color
    const map = shuffleInPlace([...colorsOrder]);
    groups.forEach((g,i)=> g.color = map[i]);

    const tiles = [];
    groups.forEach((g, gi)=> g.words.forEach(w => tiles.push({ word:w, groupIndex: gi })));
    shuffleInPlace(tiles);

    // Optional “decoy heat”: one extra overlap injection per puzzle at higher difficulty
    if(Math.random() < cfg.decoyChance){
      // We don't alter solutions; we just make the board more tempting by swapping ONE tile word
      // with a plausible overlap word that still exists as a word.
      // NOTE: This keeps puzzle solvable because groupIndex stays the same.
      const i = randInt(tiles.length);
      const bait = pools.overlapBait.map(w=>cleanWord(w,cfg.maxWordLen)).filter(Boolean);
      if(bait.length) tiles[i].word = choice(bait);
    }

    return { name:"Enigma", groups, tiles };
  }

  // fallback
  return fallbackPuzzle();
}

function buildGenerators({ cfg, pools, fresh }){
  const normal = [];
  const weird = [];

  // Normal categories (big pools)
  normal.push(() => fromPool("SLANG CHECK", pools.slang, cfg, pools));
  normal.push(() => fromPool("MEME GRAVEYARD", pools.memes, cfg, pools));
  normal.push(() => fromPool("INTERNET BEHAVIOR", pools.internet, cfg, pools));
  normal.push(() => fromPool("GAMER DIALECT", pools.games, cfg, pools));
  normal.push(() => fromPool("MOVIE AND TV TERMS", pools.moviesTv, cfg, pools));
  normal.push(() => fromPool("NAMED COLORS", pools.colors, cfg, pools));
  normal.push(() => fromPool("WEAPONS AND BLADES", pools.weapons, cfg, pools));
  normal.push(() => fromPool("BIG WORD ENERGY", pools.bigWords, cfg, pools));
  normal.push(() => fromPool("OBSCURE VOCAB", pools.obscure, cfg, pools));
  normal.push(() => fromFreshOrFallback("FROM THE WILD INTERNET", fresh, pools.overlapBait, cfg, pools));

  // Franchise pulls: dynamic category names
  normal.push(() => fromFranchise(pools.nerdFranchises, cfg, pools));

  // Weird / cryptic-ish generators
  weird.push(() => addLetterToBodyParts(pools.anatomy));
  weird.push(() => wordsThatStartWith(pools.prefixes));
  weird.push(() => wordsThatEndWith(pools.suffixes));
  weird.push(() => wordsAfterBlank(pools.afterBlanks));
  weird.push(() => oneLetterOffPairs(pools.oneLetterPairs));
  weird.push(() => doubleMeaningBait(cfg, pools));

  return { normal, weird };
}

function pickDistinct(pool, n, banned, cfg){
  const src = pool.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  const out = [];
  let tries = 0;
  while(out.length < n && tries < 2000){
    tries++;
    const w = choice(src);
    if(!w) continue;
    if(banned.has(w) || out.includes(w)) continue;
    out.push(w);
    banned.add(w);
  }
  return out;
}

function maybeInjectOverlap(words, cfg, pools, banned){
  if(Math.random() >= cfg.overlapChance) return words;

  const candidates = pools.overlapBait
    .map(w => cleanWord(w, cfg.maxWordLen))
    .filter(w => w && !banned.has(w));

  if(!candidates.length) return words;

  const idx = randInt(words.length);
  banned.delete(words[idx]);
  words[idx] = choice(candidates);
  banned.add(words[idx]);
  return words;
}

function fromPool(category, pool, cfg, pools){
  const banned = new Set();
  let words = pickDistinct(pool, 4, banned, cfg);
  words = maybeInjectOverlap(words, cfg, pools, banned);
  return { category, words };
}

function fromFreshOrFallback(category, fresh, fallback, cfg, pools){
  const banned = new Set();
  const src = (fresh && fresh.length >= 16) ? fresh : fallback;
  let words = pickDistinct(src, 4, banned, cfg);
  words = maybeInjectOverlap(words, cfg, pools, banned);
  return { category, words };
}

function fromFranchise(franchises, cfg, pools){
  const keys = Object.keys(franchises);
  const cat = choice(keys);
  const banned = new Set();
  let words = pickDistinct(franchises[cat], 4, banned, cfg);
  words = maybeInjectOverlap(words, cfg, pools, banned);
  return { category: cat, words };
}

/* ---- cryptic-ish ---- */
function addLetterToBodyParts(anatomy){
  const base = shuffleInPlace([...anatomy]).slice(0,4).map(upper);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const words = base.map(w => {
    if(w === "ANKLE") return "KANKLE";
    const c = letters[randInt(letters.length)];
    const pos = randInt(w.length + 1);
    return w.slice(0,pos) + c + w.slice(pos);
  });
  return { category:"ADD A LETTER TO BODY PARTS", words: uniq(words).slice(0,4) };
}

function wordsThatStartWith(prefixes){
  const pre = choice(prefixes);
  const tails = ["MODE","SIDE","WORLD","ROOM","WEB","GATE","LINE","LIGHT","DRIVE","FIELD"];
  const words = shuffleInPlace(tails).slice(0,4).map(t => `${pre}${t}`);
  return { category:`WORDS THAT START WITH "${pre}"`, words };
}

function wordsThatEndWith(suffixes){
  const suf = choice(suffixes);
  const heads = ["STAR","MOON","VOID","NEON","PIXEL","GHOST","DREAM","NIGHT","EMBER","RUNE"];
  const words = shuffleInPlace(heads).slice(0,4).map(h => `${h}${suf}`);
  return { category:`WORDS THAT END WITH "${suf}"`, words };
}

function wordsAfterBlank(afterBlanks){
  const b = choice(afterBlanks);
  const picks = shuffleInPlace([...b.opts]).slice(0,4).map(upper);
  return { category:`WORDS AFTER "${b.lead}"`, words: picks };
}

function oneLetterOffPairs(pairs){
  const picks = shuffleInPlace([...pairs]).slice(0,2).flat().map(upper);
  return { category:"ONE-LETTER-OFF PAIRS", words: picks };
}

function doubleMeaningBait(cfg, pools){
  const themes = [
    { cat:"WORDS USED IN BOTH STORIES AND GAMES", pool:["CANON","ARC","META","LOOT","BOSS","PATCH","GRIND","SPAWN"] },
    { cat:"WORDS THAT CAN BE A THING OR AN ACTION", pool:["SHIP","CAST","STACK","GRIND","RANK","PATCH","BAN","SPAWN"] },
    { cat:"WORDS THAT FEEL LIKE SPEED", pool:["RUSH","DASH","JET","BLITZ","ZIP","BOLT","BURN","HUSTLE"] }
  ];
  const t = choice(themes);
  const banned = new Set();
  const words = pickDistinct(t.pool, 4, banned, cfg);
  return { category: t.cat, words };
}

/* -------------------- VALIDATION -------------------- */
function isGroupSane(g, cfg){
  if(!g || !g.category || !Array.isArray(g.words) || g.words.length !== 4) return false;
  const cleaned = g.words.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  if(cleaned.length !== 4) return false;
  if(new Set(cleaned).size !== 4) return false;

  const avgLen = cleaned.reduce((a,w)=>a+w.length,0)/4;
  if(avgLen < 3) return false;

  g.words = cleaned;
  g.category = String(g.category);
  return true;
}

function isPuzzleSane(groups){
  if(groups.length !== 4) return false;
  const all = groups.flatMap(g => g.words);
  if(new Set(all).size !== 16) return false;
  return true;
}

function fallbackPuzzle(){
  const groups = [
    { color:"YELLOW", category:"SLANG CHECK", words:["RIZZ","NO CAP","SUS","YEET"] },
    { color:"GREEN", category:"MOVIE AND TV TERMS", words:["REBOOT","SEQUEL","RETCON","CAMEO"] },
    { color:"BLUE", category:"NAMED COLORS", words:["CERULEAN","OCHRE","TEAL","INDIGO"] },
    { color:"PURPLE", category:"ADD A LETTER TO BODY PARTS", words:["KANKLE","TOEZ","HEELO","SOLEN"] }
  ];
  const tiles = [];
  groups.forEach((g, gi)=>g.words.forEach(w=>tiles.push({ word:w, groupIndex:gi })));
  shuffleInPlace(tiles);
  return { name:"Enigma", groups, tiles };
}
