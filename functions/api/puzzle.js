export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 4);

  const cfg = {
    // higher = more overlap bait + more cryptic generators
    overlapChance: [0.12, 0.18, 0.26, 0.36, 0.52][difficulty - 1],
    crypticChance: [0.10, 0.16, 0.24, 0.34, 0.50][difficulty - 1],
    decoyHeat:     [0.00, 0.08, 0.14, 0.20, 0.28][difficulty - 1],
    wikidataChance:[0.10, 0.18, 0.28, 0.38, 0.50][difficulty - 1],
    rerollMax:     [30,   45,   70,   110,  160][difficulty - 1],
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

/* ---------------- utils ---------------- */
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

/* --------------- pools (bigger + nerdier) --------------- */
function buildPools(){
  const slang = [
    "RIZZ","YEET","GOATED","SUS","CAP","NO CAP","BET","DRIP","FOMO","IYKYK","COPE","MALD",
    "LOCK IN","DELULU","ATE","SERVE","LOWKEY","HIGHKEY","RATIO","TOUCH GRASS","SWEATY","NAUR",
    "GASLIGHT","GATEKEEP","GIRLBOSS","SEND IT","COOKED","MID","BASED","CRINGE","SALTY"
  ];

  const memes = [
    "RICKROLL","DOGE","PEPE","LOSS","AMOGUS","NPC","SKIBIDI","OHIO","GIGACHAD","THIS IS FINE",
    "SURPRISED PIKACHU","UNO REVERSE","DISTRACTED BF","OK BOOMER","BRAIN ROT","MAIN CHARACTER"
  ];

  const internet = [
    "THREAD","SUBTWEET","DOXX","ALT","LURK","SHADOWBAN","DOGPILE","HOT TAKE","SOFT LAUNCH",
    "BLOCKLIST","BAIT","COPE","SEETHE","YAPPING","RATIO","MODMAIL","POSTER","KARMA"
  ];

  const games = [
    "RNG","NERF","BUFF","PATCH","SPAWN","AGGRO","DPS","TANK","HEAL","QUEST","LOOT","BOSS","NPC",
    "CRIT","CLUTCH","SPEEDRUN","HITBOX","NOCLIP","GLITCH","META","GRIND","PVP","PVE","RAID",
    "DUNGEON","RESPAWN","AOE"
  ];

  const moviesTv = [
    "REBOOT","SEQUEL","PREQUEL","RETCON","CAMEO","SPINOFF","MACGUFFIN","PLOT ARMOR","CLIFFHANGER",
    "MONTAGE","COLD OPEN","POST-CREDITS","CANON","FILLER","EASTER EGG","FORESHADOW","DIRECTOR'S CUT"
  ];

  const colors = [
    "CERULEAN","MAGENTA","TAUPE","MAUVE","OCHRE","UMBER","VIRIDIAN","CHARTREUSE","SAFFRON",
    "PERIWINKLE","FUCHSIA","PUCE","VERMILION","INDIGO","TEAL","IVORY","JADE","COBALT","MAROON","CYAN"
  ];

  const weapons = [
    "KATANA","HALBERD","RAPIER","TRIDENT","CROSSBOW","SPEAR","DAGGER","MACE","SABER","WARHAMMER",
    "CUTLASS","BATTLEAXE","JAVELIN","SCIMITAR","NUNCHAKU","LONGSWORD","PIKE","FLAIL"
  ];

  const bigWords = [
    "OBFUSCATE","PERNICIOUS","MENDACIOUS","SYCOPHANT","EPISTEMIC","PALIMPSEST","DEFENESTRATE",
    "APOTHEOSIS","SESQUIPEDALIAN","ZEITGEIST","MACHIAVELLIAN","PERSPICACIOUS","INTRANSIGENT","LACHRYMOSE"
  ];

  const obscure = [
    "KAKISTOCRACY","ULTRACREPIDARIAN","HIRSUTE","SANGUINE","LIMINAL","GNOMIC","NOETIC","CHTHNIC",
    "EIDOLON","SINECURE","COZEN","SIBILANT","APORIA","PALINODE","ANEMIC"
  ];

  const anatomy = [
    "ARCH","TOE","HEEL","SOLE","ANKLE","CALF","SHIN","KNEE","WRIST","PALM","ELBOW","THUMB","JAW","RIB","HIP","TEMPLE"
  ];

  // “Franchise mixer” pools (these are sources, not categories by themselves)
  const fandom = {
    pokemon: ["POKEDEX","POKEBALL","GYM","BADGE","SHINY","STARTER","EVOLVE","LEGENDARY","TYPE","MOVE"],
    starwars: ["JEDI","SITH","PADAWAN","DROID","LIGHTSABER","HYPERDRIVE","HOLOCRON","WOOKIEE","BLASTER"],
    marvel: ["VIBRANIUM","VARIANT","MULTIVERSE","INFINITY","AVENGER","VILLAIN","CAMEO","AFTERCREDITS","SNAP"],
    fantasy: ["MANA","QUEST","DUNGEON","DRAGON","PALADIN","WARLOCK","RANGER","CLERIC","ELIXIR"],
    minecraft: ["CREEPER","REDSTONE","NETHER","ENDERMAN","ENCHANT","PICKAXE","BIOME","SPAWNER","ELYTRA"]
  };

  // Overlap bait words that can plausibly fit multiple groups
  const overlapBait = [
    "CANON","META","PATCH","BOSS","RUSH","CRUSH","SPRITE","ARC","SHIP","RUNE","MINT","BUNDLE",
    "GRIND","SPAWN","JADE","IVORY","QUEST","GLITCH","CAMEO"
  ];

  // Fill-in-the-blank templates
  const afterBlanks = [
    { lead:"DARK", opts:["HORSE","MODE","ROOM","WEB","SIDE","MATTER","STAR","ARTS"] },
    { lead:"SILVER", opts:["LINING","SCREEN","BULLET","FOX","SPOON","TONGUE"] },
    { lead:"GHOST", opts:["TOWN","MODE","SHIP","WRITER","LIGHT","HUNT"] },
    { lead:"FINAL", opts:["BOSS","FORM","CUT","WARNING","FANTASY"] },
    { lead:"TOUCH", opts:["GRASS","DOWN","BASE","SCREEN"] }
  ];

  // Homophones / near-homophones for cryptic sets
  const homophones = [
    ["SCENT","SENT"], ["STEAL","STEEL"], ["PLAIN","PLANE"], ["KNIGHT","NIGHT"],
    ["WAIST","WASTE"], ["HOARD","HORDE"]
  ];

  // Hidden-word seeds: we generate answers that contain a hidden substring
  const hiddenSeeds = ["CAT","RPG","MEL","ARC","SUN","NET","ORE","RUNE"];

  // Portmanteau-ish (fun fake-ish words)
  const portmanteaus = [
    "SPORK","CHILLAX","HANGRY","BROMANCE","MANSPLAIN","FRENEMY","STAYCATION","COSPLAY","SMOG","FANFIC"
  ];

  // One-letter-off pairs
  const oneLetterPairs = [
    ["CANON","CANNON"], ["FORM","FROM"], ["LATER","LATTE"], ["RING","RANG"]
  ];

  return {
    slang, memes, internet, games, moviesTv, colors, weapons, bigWords, obscure, anatomy,
    fandom, overlapBait, afterBlanks, homophones, hiddenSeeds, portmanteaus, oneLetterPairs
  };
}

/* ---------------- wikidata spice (optional) ---------------- */
async function maybeFetchWikidata(prob, maxLen){
  if(Math.random() > prob) return null;

  const queries = [
    `SELECT ?itemLabel WHERE { ?item wdt:P31 wd:Q7889 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80`,
    `SELECT ?itemLabel WHERE { ?item wdt:P31 wd:Q11424 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 80`,
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

/* ---------------- generation core ---------------- */
function generatePuzzle({ cfg, pools, fresh }){
  const baseColors = ["YELLOW","GREEN","BLUE","PURPLE"];

  for(let attempt=0; attempt<cfg.rerollMax; attempt++){
    const used = new Set();
    const groups = [];
    const gens = buildGenerators({ cfg, pools, fresh });

    // Guarantee at least one cryptic group at higher difficulty
    groups.push((Math.random() < cfg.crypticChance ? choice(gens.cryptic) : choice(gens.normal))());

    while(groups.length < 4){
      const bank = (Math.random() < cfg.crypticChance) ? gens.cryptic : gens.normal;
      const g = choice(bank)();

      if(groups.some(x => x.category === g.category)) continue;
      if(!isGroupSane(g, cfg)) continue;
      if(g.words.some(w => used.has(w))) continue;

      g.words.forEach(w => used.add(w));
      groups.push(g);
    }

    if(!isPuzzleSane(groups)) continue;

    // Decoy mechanic: increase “temptation” by ensuring overlaps exist across groups
    if(Math.random() < cfg.decoyHeat){
      heatUpOverlaps(groups, pools, cfg);
      if(!isPuzzleSane(groups)) continue;
    }

    const colorMap = shuffleInPlace([...baseColors]);
    groups.forEach((g,i)=> g.color = colorMap[i]);

    const tiles = [];
    groups.forEach((g, gi)=> g.words.forEach(w => tiles.push({ word:w, groupIndex: gi })));
    shuffleInPlace(tiles);

    return { name:"Enigma", groups, tiles };
  }

  return fallbackPuzzle();
}

function buildGenerators({ cfg, pools, fresh }){
  const normal = [];
  const cryptic = [];

  // Normal buckets
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

  // Franchise Mixer: a category built from multiple fandom pools, but with a coherent theme label
  normal.push(() => franchiseMixer(pools, cfg));

  // Cryptic-ish generators
  cryptic.push(() => addLetterToBodyParts(pools.anatomy));
  cryptic.push(() => wordsAfterBlank(pools.afterBlanks));
  cryptic.push(() => homophonePairs(pools.homophones));
  cryptic.push(() => oneLetterOffPairs(pools.oneLetterPairs));
  cryptic.push(() => hiddenWordSet(pools.hiddenSeeds, cfg));
  cryptic.push(() => portmanteauSet(pools.portmanteaus, cfg));

  return { normal, cryptic };
}

/* ---------------- group builders ---------------- */
function pickDistinct(pool, n, banned, cfg){
  const src = pool.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  const out = [];
  let tries = 0;
  while(out.length < n && tries < 2500){
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

/* ------------ “All three” features ------------ */

// Franchise Mixer: cross-fandom category that’s still solvable.
// We pick a theme label and source words from different fandom pools to match it.
function franchiseMixer(pools, cfg){
  const themes = [
    { cat:"MAGICAL TECH WORDS", take:["minecraft","starwars","marvel","pokemon","fantasy"], words:["ENCHANT","HOLOCRON","VIBRANIUM","POKEDEX","MANA"] },
    { cat:"BOSSES AND LEGENDS", take:["pokemon","minecraft","fantasy","starwars","marvel"], words:["LEGENDARY","ENDER","DRAGON","SITH","VILLAIN"] },
    { cat:"QUEST-LIKE NOUNS", take:["fantasy","minecraft","pokemon","starwars","marvel"], words:["QUEST","DUNGEON","GYM","JEDI","AVENGER"] }
  ];

  // If you want it more chaotic, we can add 30+ of these.
  // These are “mixer” because they blend vocab across fandoms.
  const t = choice(themes);

  const out = t.words.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  // Ensure exactly 4
  while(out.length > 4) out.pop();
  while(out.length < 4) out.push(cleanWord(choice(pools.overlapBait), cfg.maxWordLen) || "META");

  return { category: t.cat, words: out.slice(0,4) };
}

// Cryptic: homophones
function homophonePairs(pairs){
  const picks = shuffleInPlace([...pairs]).slice(0,2).flat().map(upper);
  return { category:"HOMOPHONE PAIRS", words: picks };
}

// Cryptic: hidden words (each contains the hidden seed)
function hiddenWordSet(seeds, cfg){
  const seed = choice(seeds);
  const wrappers = [
    `S${seed}AND`, `C${seed}NAP`, `${seed}ALOG`, `UN${seed}TED`, `B${seed}NUS`, `DE${seed}MO`
  ].map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);

  const words = shuffleInPlace(wrappers).slice(0,4);
  return { category:`HIDDEN "${seed}" INSIDE`, words };
}

// Cryptic: portmanteaus
function portmanteauSet(pool, cfg){
  const banned = new Set();
  const words = pickDistinct(pool, 4, banned, cfg);
  return { category:"PORTMANTEAUS", words };
}

// Cryptic: one-letter-off pairs
function oneLetterOffPairs(pairs){
  const picks = shuffleInPlace([...pairs]).slice(0,2).flat().map(upper);
  return { category:"ONE-LETTER-OFF PAIRS", words: picks };
}

// Your beloved cursed body-part mutation
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

function wordsAfterBlank(afterBlanks){
  const b = choice(afterBlanks);
  const picks = shuffleInPlace([...b.opts]).slice(0,4).map(upper);
  return { category:`WORDS AFTER "${b.lead}"`, words: picks };
}

// Real decoy heat: make 2 different groups share 1 tempting overlap word each (without breaking correctness)
function heatUpOverlaps(groups, pools, cfg){
  const bait = pools.overlapBait.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  if(bait.length < 4) return;

  // pick two groups and inject one bait word into each, swapping out a non-core word
  const idxs = shuffleInPlace([0,1,2,3]).slice(0,2);
  for(const gi of idxs){
    const g = groups[gi];
    const i = randInt(4);
    const pick = choice(bait);
    // do not duplicate within group
    if(g.words.includes(pick)) continue;
    g.words[i] = pick;
  }
}

/* ---------------- validation ---------------- */
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
  groups.forEach((g, gi)=>g.words.forEach(w=>tiles.push({ word:w, groupIndex: gi })));
  shuffleInPlace(tiles);
  return { name:"Enigma", groups, tiles };
}
