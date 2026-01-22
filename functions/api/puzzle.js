export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 4);

  const cfg = {
    overlapChance: [0.18, 0.26, 0.34, 0.44, 0.60][difficulty - 1],
    crypticChance: [0.16, 0.24, 0.34, 0.46, 0.62][difficulty - 1],
    decoyHeat:     [0.06, 0.12, 0.18, 0.26, 0.34][difficulty - 1],
    wikidataChance:[0.14, 0.22, 0.32, 0.42, 0.55][difficulty - 1],
    rerollMax:     [60,   90,   140,  220,  320][difficulty - 1],
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

/* ---------------- pools: huge variety ---------------- */
function buildPools(){
  const slang = [
    "RIZZ","YEET","GOATED","SUS","CAP","NO CAP","BET","DRIP","FOMO","IYKYK","COPE","MALD",
    "LOCK IN","DELULU","ATE","SERVE","LOWKEY","HIGHKEY","RATIO","TOUCH GRASS","SWEATY","NAUR",
    "COOKED","MID","BASED","CRINGE","SALTY","SEND IT","GASLIGHT","STAN","GLOW UP","ICK"
  ];

  const memes = [
    "RICKROLL","DOGE","PEPE","LOSS","AMOGUS","NPC","GIGACHAD","THIS IS FINE","UNO REVERSE",
    "SURPRISED PIKACHU","OK BOOMER","MAIN CHARACTER","BRAIN ROT","IS THIS A PIGEON","SHEESH"
  ];

  const internet = [
    "THREAD","SUBTWEET","DOXX","ALT","LURK","SHADOWBAN","DOGPILE","HOT TAKE","SOFT LAUNCH",
    "BLOCKLIST","BAIT","COPE","SEETHE","YAPPING","MODMAIL","KARMA","REPOST","VIRAL","RATIOED"
  ];

  const gaming = [
    "RNG","NERF","BUFF","PATCH","SPAWN","AGGRO","DPS","TANK","HEAL","QUEST","LOOT","BOSS","NPC",
    "CRIT","CLUTCH","SPEEDRUN","HITBOX","NOCLIP","GLITCH","META","GRIND","PVP","PVE","RAID",
    "DUNGEON","RESPAWN","AOE"
  ];

  const screenwriting = [
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
    "EIDOLON","SINECURE","COZEN","SIBILANT","APORIA","PALINODE","ANEMIC","EUTRAPELIA"
  ];

  const mythology = [
    "ARES","HADES","ODIN","LOKI","THOR","FREYA","ANUBIS","RA","ATHENA","HERA","MORRIGAN","SET"
  ];

  const science = [
    "ION","PLASMA","NEUTRON","PHOTON","ENTROPY","ORBIT","SPECTRUM","FUSION","GRAVITY","VECTOR","GENOME","QUARK"
  ];

  const music = [
    "CHORUS","BRIDGE","VERSE","REFRAIN","CODA","TEMPO","KEY","HARMONY","MELODY","LYRIC","OCTAVE","RIFF"
  ];

  const food = [
    "UMAMI","SUSHI","RAMEN","TACOS","PANINI","CURRY","BAGEL","MOCHI","BISQUE","SORBET","GUMBO","PAELLA"
  ];

  const anatomy = [
    "ARCH","TOE","HEEL","SOLE","ANKLE","CALF","SHIN","KNEE","WRIST","PALM","ELBOW","THUMB","JAW","RIB","HIP","TEMPLE"
  ];

  const portmanteaus = [
    "SPORK","CHILLAX","HANGRY","FRENEMY","BROMANCE","MANSPLAIN","STAYCATION","COSPLAY","SMOG","FANFIC","BLOOPER"
  ];

  const homophones = [
    ["SCENT","SENT"], ["STEAL","STEEL"], ["PLAIN","PLANE"], ["KNIGHT","NIGHT"],
    ["WAIST","WASTE"], ["HOARD","HORDE"]
  ];

  const oneLetterPairs = [
    ["CANON","CANNON"], ["FORM","FROM"], ["LATER","LATTE"], ["RING","RANG"],
    ["WILD","WIELD"], ["SCAR","SCARF"]
  ];

  const afterBlanks = [
    { lead:"DARK", opts:["HORSE","MODE","ROOM","WEB","SIDE","MATTER","STAR","ARTS"] },
    { lead:"SILVER", opts:["LINING","SCREEN","BULLET","FOX","SPOON","TONGUE"] },
    { lead:"GHOST", opts:["TOWN","MODE","SHIP","WRITER","LIGHT","HUNT"] },
    { lead:"FINAL", opts:["BOSS","FORM","CUT","WARNING","FANTASY"] },
    { lead:"TOUCH", opts:["GRASS","DOWN","BASE","SCREEN"] },
    { lead:"HIT", opts:["BOX","LIST","MAN","RATE","POINT"] }
  ];

  const prefixes = ["DARK","NIGHT","STAR","MOON","VOID","NEO","CYBER","MEGA","ULTRA","GIGA","SHADOW","PIXEL","GHOST"];
  const suffixes = ["CORE","CODE","PUNK","LORD","MANCER","GATE","VIBE","LOCK","WAVE","VERSE","SPAWN","CRAFT","MAXX"];

  // Massive fandom sampler: broad and shallow, but endless combos
  const fandom = {
    pokemon: ["POKEDEX","POKEBALL","GYM","BADGE","SHINY","STARTER","EVOLVE","TYPE","MOVE","LEGENDARY"],
    starwars: ["JEDI","SITH","PADAWAN","DROID","LIGHTSABER","HYPERDRIVE","WOOKIEE","BLASTER","HOLOCRON"],
    marvel: ["VIBRANIUM","VARIANT","MULTIVERSE","INFINITY","AVENGER","VILLAIN","CAMEO","SNAP","AFTERCREDITS"],
    minecraft: ["CREEPER","REDSTONE","NETHER","ENDERMAN","ENCHANT","PICKAXE","BIOME","SPAWNER","ELYTRA"],
    fantasy: ["MANA","QUEST","DUNGEON","DRAGON","PALADIN","WARLOCK","RANGER","CLERIC","ELIXIR"],
    scifi: ["ANDROID","CYBORG","WARP","HYPERSPACE","ALIEN","CLONE","MECH","NANITE","SINGULARITY"],
    horror: ["SLASHER","HAUNTED","POSSESSION","PHANTOM","CURSED","NOIR","GORE","CULT","ABYSS"],
    anime: ["SENPAI","TSUNDERE","KAIJU","SHONEN","ISEKAI","MECHA","CHIBI","YANDERE","DOJIN"],
    tabletop: ["D20","CRITICAL","INITIATIVE","CAMPAIGN","MINIATURE","DM","ALIGNMENT","HOMEBREW","ONE-SHOT"]
  };

  // Overlap bait for misdirection
  const overlapBait = [
    "CANON","META","PATCH","BOSS","RUSH","CRUSH","SPRITE","ARC","SHIP","RUNE","QUEST","GLITCH",
    "CAMEO","IVORY","JADE","TEMPO","KEY","RAID"
  ];

  return {
    slang, memes, internet, gaming, screenwriting, colors, weapons, bigWords, obscure,
    mythology, science, music, food, anatomy,
    portmanteaus, homophones, oneLetterPairs, afterBlanks, prefixes, suffixes,
    fandom, overlapBait
  };
}

/* ---------------- wikidata spice ---------------- */
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
  return uniq(out).slice(0, 70);
}

/* ---------------- generation ---------------- */
function generatePuzzle({ cfg, pools, fresh }){
  const baseColors = ["YELLOW","GREEN","BLUE","PURPLE"];

  for(let attempt=0; attempt<cfg.rerollMax; attempt++){
    const used = new Set();
    const groups = [];

    const gens = buildGenerators({ cfg, pools, fresh });

    // Force at least one hard/cryptic group often
    groups.push((Math.random() < cfg.crypticChance ? choice(gens.cryptic) : choice(gens.hard))());

    while(groups.length < 4){
      const bank = Math.random() < cfg.crypticChance ? gens.cryptic : gens.hard;
      const g = choice(bank)();

      if(groups.some(x => x.category === g.category)) continue;
      if(!isGroupSane(g, cfg)) continue;
      if(g.words.some(w => used.has(w))) continue;

      g.words.forEach(w => used.add(w));
      groups.push(g);
    }

    // Heat up overlaps for pain
    if(Math.random() < cfg.decoyHeat){
      heatUpOverlaps(groups, pools, cfg);
      if(!isPuzzleSane(groups)) continue;
    }

    if(!isPuzzleSane(groups)) continue;

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
  const hard = [];
  const cryptic = [];

  // Hard: big pools, lots of domains, and overlap injections
  hard.push(() => fromPool("SLANG CHECK", pools.slang, cfg, pools));
  hard.push(() => fromPool("MEME GRAVEYARD", pools.memes, cfg, pools));
  hard.push(() => fromPool("INTERNET BEHAVIOR", pools.internet, cfg, pools));
  hard.push(() => fromPool("GAMER DIALECT", pools.gaming, cfg, pools));
  hard.push(() => fromPool("SCREENWRITING TRAPS", pools.screenwriting, cfg, pools));
  hard.push(() => fromPool("NAMED COLORS", pools.colors, cfg, pools));
  hard.push(() => fromPool("WEAPONS AND BLADES", pools.weapons, cfg, pools));
  hard.push(() => fromPool("BIG WORD ENERGY", pools.bigWords, cfg, pools));
  hard.push(() => fromPool("OBSCURE VOCAB", pools.obscure, cfg, pools));
  hard.push(() => fromPool("MYTHOLOGY NAMES", pools.mythology, cfg, pools));
  hard.push(() => fromPool("SCIENCE WORDS", pools.science, cfg, pools));
  hard.push(() => fromPool("MUSIC TERMS", pools.music, cfg, pools));
  hard.push(() => fromPool("FOOD WORDS", pools.food, cfg, pools));
  hard.push(() => fromFreshOrFallback("FROM THE WILD INTERNET", fresh, pools.overlapBait, cfg, pools));

  // Hard: fandom blender with endless combinations
  hard.push(() => fandomMixer(pools, cfg));

  // Cryptic: generators that create fresh categories
  cryptic.push(() => addLetterToBodyParts(pools.anatomy));
  cryptic.push(() => wordsAfterBlank(pools.afterBlanks));
  cryptic.push(() => wordsThatStartWith(pools.prefixes));
  cryptic.push(() => wordsThatEndWith(pools.suffixes));
  cryptic.push(() => homophonePairs(pools.homophones));
  cryptic.push(() => oneLetterOffPairs(pools.oneLetterPairs));
  cryptic.push(() => portmanteauSet(pools.portmanteaus, cfg));
  cryptic.push(() => hiddenSubstringSet(cfg));

  return { hard, cryptic };
}

/* ---------------- group builders ---------------- */
function pickDistinct(pool, n, banned, cfg){
  const src = pool.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  const out = [];
  let tries = 0;
  while(out.length < n && tries < 3000){
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

/* ---------------- the chaos: fandom mixer ---------------- */
function fandomMixer(pools, cfg){
  const keys = Object.keys(pools.fandom);
  shuffleInPlace(keys);

  // Pick 4 different fandom buckets to mix
  const picked = keys.slice(0, 4);

  // Randomized label so it does not repeat much
  const labelBits = [
    "FANDOM CROSSOVER", "NERD LORE", "CONVENTION BAIT", "CANON CHAOS",
    "MULTIVERSE STATIC", "GEEK TRAP", "CROSS-IP VIBES", "LORE TOKENS"
  ];
  const category = `${choice(labelBits)}: ${picked.map(k => k.toUpperCase()).join(", ")}`;

  // Take 1 word from each fandom pool
  const words = [];
  const used = new Set();
  for(const k of picked){
    const pool = pools.fandom[k];
    let w = cleanWord(choice(pool), cfg.maxWordLen);
    let tries = 0;
    while((!w || used.has(w)) && tries < 50){
      tries++;
      w = cleanWord(choice(pool), cfg.maxWordLen);
    }
    if(w){ words.push(w); used.add(w); }
  }

  // Ensure exactly 4, fill with overlap bait if needed
  while(words.length < 4){
    const fill = cleanWord(choice(pools.overlapBait), cfg.maxWordLen) || "META";
    if(!used.has(fill)){ words.push(fill); used.add(fill); }
  }

  return { category, words: words.slice(0,4) };
}

/* ---------------- cryptic generators ---------------- */
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

function wordsThatStartWith(prefixes){
  const pre = choice(prefixes);
  const tails = ["MODE","SIDE","WORLD","ROOM","WEB","GATE","LINE","LIGHT","DRIVE","FIELD","PATH"];
  const words = shuffleInPlace(tails).slice(0,4).map(t => `${pre}${t}`);
  return { category:`WORDS THAT START WITH "${pre}"`, words };
}

function wordsThatEndWith(suffixes){
  const suf = choice(suffixes);
  const heads = ["STAR","MOON","VOID","NEON","PIXEL","GHOST","DREAM","NIGHT","EMBER","RUNE","CHAOS"];
  const words = shuffleInPlace(heads).slice(0,4).map(h => `${h}${suf}`);
  return { category:`WORDS THAT END WITH "${suf}"`, words };
}

function homophonePairs(pairs){
  const picks = shuffleInPlace([...pairs]).slice(0,2).flat().map(upper);
  return { category:"HOMOPHONE PAIRS", words: picks };
}

function oneLetterOffPairs(pairs){
  const picks = shuffleInPlace([...pairs]).slice(0,2).flat().map(upper);
  return { category:"ONE-LETTER-OFF PAIRS", words: picks };
}

function portmanteauSet(pool, cfg){
  const banned = new Set();
  const words = pickDistinct(pool, 4, banned, cfg);
  return { category:"PORTMANTEAUS", words };
}

function hiddenSubstringSet(cfg){
  // Generates fake-ish but solvable hidden-substring categories without a dictionary.
  const seeds = ["ARC","NET","SUN","RUNE","ORE","CAT","HEX","MOD"];
  const seed = choice(seeds);

  const shells = [
    `CA${seed}ON`, `SU${seed}TWEET`, `DE${seed}FEN`, `SH${seed}DOW`, `RE${seed}BOOT`, `IN${seed}ERT`,
    `MA${seed}IC`, `CO${seed}E`, `RA${seed}ID`, `SP${seed}WN`
  ];

  const cleaned = uniq(shells.map(s => cleanWord(s, cfg.maxWordLen)).filter(Boolean));
  shuffleInPlace(cleaned);
  return { category:`HIDDEN "${seed}" INSIDE`, words: cleaned.slice(0,4) };
}

/* ---------------- decoy heat ---------------- */
function heatUpOverlaps(groups, pools, cfg){
  const bait = pools.overlapBait.map(w => cleanWord(w, cfg.maxWordLen)).filter(Boolean);
  if(bait.length < 6) return;

  // Inject overlap words into 2 groups to increase temptation without breaking solvability
  const idxs = shuffleInPlace([0,1,2,3]).slice(0,2);
  for(const gi of idxs){
    const g = groups[gi];
    const i = randInt(4);
    const pick = choice(bait);
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
    { color:"GREEN", category:"SCREENWRITING TRAPS", words:["REBOOT","SEQUEL","RETCON","CAMEO"] },
    { color:"BLUE", category:"NAMED COLORS", words:["CERULEAN","OCHRE","TEAL","INDIGO"] },
    { color:"PURPLE", category:"ADD A LETTER TO BODY PARTS", words:["KANKLE","TOEZ","HEELO","SOLEN"] }
  ];
  const tiles = [];
  groups.forEach((g, gi)=>g.words.forEach(w=>tiles.push({ word:w, groupIndex: gi })));
  shuffleInPlace(tiles);
  return { name:"Enigma", groups, tiles };
                           }
