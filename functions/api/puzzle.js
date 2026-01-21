export async function onRequest(context) {
  const { request } = context;
  const u = new URL(request.url);
  const difficulty = clampInt(u.searchParams.get("difficulty"), 1, 5, 4);

  // Weighted chaos: higher difficulty increases overlap bait + obscure pulls + nerd traps.
  const config = {
    overlapChance: [0.08, 0.12, 0.20, 0.30, 0.42][difficulty - 1],
    wikidataChance: [0.10, 0.18, 0.28, 0.38, 0.50][difficulty - 1],
    purpleBias:     [1, 2, 3, 4, 6][difficulty - 1]
  };

  const localPools = buildLocalPools();

  // Pull a few “fresh” words from the internet sometimes (Wikidata).
  // If it fails, we fall back to local pools. No babysitting required.
  const fresh = await maybeFetchWikidataWords(config.wikidataChance).catch(() => null);

  const puzzle = generatePuzzle({ difficulty, config, localPools, fresh });

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

function buildLocalPools(){
  return {
    slang: ["RIZZ","YEET","GOATED","SUS","CAP","NO CAP","BET","L","W","DRIP","FOMO","SIMP","COOKING","MID","BASED","CRINGE","SALTY","IYKYK","COPE","MALD","DEADASS","NAUR"],
    memes: ["RICKROLL","DOGE","PEPE","LOSS","AMOGUS","NPC","SKIBIDI","OHIO","GIGACHAD","SHEESH","YASS","SLAY","RATIO","TOUCH GRASS","MAIN CHARACTER"],
    games: ["RNG","NERF","BUFF","PATCH","SPAWN","AGGRO","DPS","TANK","HEAL","QUEST","LOOT","BOSS","NPC","CRIT","CLUTCH","SPEEDRUN","HITBOX","NOCLIP","GLITCH","META"],
    movies: ["REBOOT","SEQUEL","PREQUEL","RETCON","CAMEO","SPINOFF","MACGUFFIN","PLOT ARMOR","CLIFFHANGER","MONTAGE","COLD OPEN","POST-CREDITS","RED SHIRT","CANON","FILLER"],
    colors: ["CERULEAN","MAGENTA","TAUPE","MAUVE","OCHRE","UMBER","VIRIDIAN","CHARTREUSE","SAFFRON","PERIWINKLE","FUCHSIA","PUCE","VERMILION","INDIGO","TEAL","BEIGE"],
    weapons: ["KATANA","HALBERD","FLAIL","RAPIER","TRIDENT","CROSSBOW","SPEAR","DAGGER","MACE","SABER","GREATSWORD","WARHAMMER","BOWIE","STILETTO","SCIMITAR","NUNCHAKU"],
    bigWords: ["OBFUSCATE","PERNICIOUS","LACHRYMOSE","MENDACIOUS","SYCOPHANT","EPISTEMIC","ANTEDILUVIAN","PALIMPSEST","DEFENESTRATE","APOTHEOSIS","SESQUIPEDALIAN","ZEITGEIST"],
    obscure: ["KAKISTOCRACY","ULTRACREPIDARIAN","HIRSUTE","SANGUINE","AUSTERE","LIMINAL","ANEMIC","GNOMIC","NOETIC","CHTHNIC","EIDOLON","SINECURE","COZEN","SIBILANT"],
    anatomy: ["ARCH","TOE","HEEL","SOLE","ANKLE","CALF","SHIN","KNEE","WRIST","PALM","ELBOW","THUMB","JAW","RIB","HIP","TEMPLE"],
    brands: ["KLEENEX","VELCRO","TASER","XEROX","POST-IT","CHAPSTICK","JET SKI","BAND-AID","ONESIE"],
    internet: ["THREAD","SUBTWEET","DOXX","ALT","LURK","SHADOWBAN","DEGEN","PILLED","BAIT","COPE","SEETHE","SUSSY","YAPPING"],
    overlap: ["CANON","META","PATCH","BOSS","RUSH","CRUSH","SPRITE","ARC","SHIP","RUNE","MINT","WAD","BUNDLE","FORTUNE"]
  };
}

async function maybeFetchWikidataWords(prob){
  if(Math.random() > prob) return null;

  // A few SPARQL queries that tend to yield fun nouns.
  const queries = [
    // video game weapons (general items)
    `SELECT ?itemLabel WHERE {
      ?item wdt:P31/wdt:P279* wd:Q12796 .
      ?item wdt:P279* wd:Q728 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 60`,
    // fictional characters
    `SELECT ?itemLabel WHERE {
      ?item wdt:P31 wd:Q95074 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 60`,
    // internet memes
    `SELECT ?itemLabel WHERE {
      ?item wdt:P31 wd:Q567 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 60`
  ];

  const q = queries[Math.floor(Math.random() * queries.length)];
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q);

  const res = await fetch(url, {
    headers: {
      "accept": "application/sparql-results+json",
      "user-agent": "EnigmaConnections/1.0 (educational; contact: none)"
    }
  });

  if(!res.ok) return null;
  const data = await res.json();

  const out = [];
  for(const b of data?.results?.bindings || []){
    const label = b?.itemLabel?.value;
    if(!label) continue;
    const cleaned = label
      .replace(/\s+\(.*\)$/g, "")
      .replace(/[^A-Za-z0-9 ':-]/g, "")
      .trim();

    if(cleaned.length < 2) continue;
    if(cleaned.length > 18) continue; // keep tiles readable
    out.push(cleaned.toUpperCase());
  }

  return uniq(out).slice(0, 50);
}

function uniq(arr){
  return [...new Set(arr)];
}

function generatePuzzle({ config, localPools, fresh }){
  const banned = new Set();
  const groups = [];

  // Template bank: we generate categories, not you. You just suffer.
  const templates = [
    () => groupFromPool("YELLOW", "SLANG CHECK", localPools.slang, banned, config),
    () => groupFromPool("GREEN", "MEME GRAVEYARD", localPools.memes, banned, config),
    () => groupFromPool("GREEN", "GAMER DIALECT", localPools.games, banned, config),
    () => groupFromPool("BLUE", "MOVIE AND TV TERMS", localPools.movies, banned, config),
    () => groupFromPool("YELLOW", "NAMED COLORS", localPools.colors, banned, config),
    () => groupFromPool("BLUE", "WEAPONS AND BLADES", localPools.weapons, banned, config),
    () => groupFromPool("PURPLE", "BIG WORD ENERGY", localPools.bigWords, banned, config),
    () => groupFromPool("PURPLE", "OBSCURE VOCAB", localPools.obscure, banned, config),
    () => groupFakeMutation("PURPLE", "ADD A LETTER TO BODY PARTS", localPools.anatomy, banned),
    () => groupFromPool("BLUE", "BRANDS THAT BECAME NOUNS", localPools.brands, banned, config),
    () => groupFromPool("GREEN", "INTERNET BEHAVIOR", localPools.internet, banned, config),
    () => groupFromFreshOrPool("PURPLE", "FROM THE INTERNET'S BRAIN", fresh, localPools.overlap, banned, config)
  ];

  // Guarantee at least one purple.
  const purpleTemplates = templates.filter(fn => {
    const s = fn.toString();
    return s.includes('"PURPLE"');
  });
  groups.push(purpleTemplates[Math.floor(Math.random() * purpleTemplates.length)]());

  // Pick remaining 3 with bias toward purple as difficulty rises.
  while(groups.length < 4){
    const roll = Math.floor(Math.random() * 10);
    const pickPurple = roll < config.purpleBias;
    const t = pickPurple
      ? purpleTemplates[Math.floor(Math.random() * purpleTemplates.length)]
      : templates[Math.floor(Math.random() * templates.length)];

    const g = t();
    if(groups.some(x => x.category === g.category)) continue;
    groups.push(g);
  }

  // Force the nice Y/G/B/P layout always
  const colors = ["YELLOW","GREEN","BLUE","PURPLE"];
  shuffleInPlace(colors);
  for(let i=0;i<groups.length;i++){
    groups[i].color = colors[i];
  }
  groups.sort((a,b)=>colorsOrder(a.color)-colorsOrder(b.color));

  // Flatten into tiles
  const tiles = [];
  groups.forEach((g, gi) => g.words.forEach(w => tiles.push({ word:w, groupIndex: gi })));
  shuffleInPlace(tiles);

  return {
    name: "Enigma",
    groups,
    tiles
  };
}

function colorsOrder(c){
  return ["YELLOW","GREEN","BLUE","PURPLE"].indexOf(c);
}

function groupFromPool(color, category, pool, banned, config){
  let words = pickDistinct(pool, 4, banned);

  // Overlap bait: sometimes inject a word that could belong elsewhere
  if(Math.random() < config.overlapChance){
    const overlapPool = ["CANON","META","PATCH","BOSS","RUSH","CRUSH","SPRITE","ARC","SHIP","RUNE","MINT","WAD","BUNDLE","FORTUNE"];
    const candidates = overlapPool.filter(w => !banned.has(w));
    if(candidates.length){
      const idx = Math.floor(Math.random() * 4);
      banned.delete(words[idx]);
      words[idx] = candidates[Math.floor(Math.random() * candidates.length)];
      banned.add(words[idx]);
    }
  }

  return { color, category, words };
}

function groupFromFreshOrPool(color, category, fresh, fallbackPool, banned, config){
  const source = (fresh && fresh.length >= 8) ? fresh : fallbackPool;
  let words = pickDistinct(source, 4, banned);
  if(Math.random() < config.overlapChance && fresh && fresh.length){
    // Sneak in one from fresh to keep it spicy.
    const c = fresh.filter(w => !banned.has(w));
    if(c.length){
      const idx = Math.floor(Math.random() * 4);
      banned.delete(words[idx]);
      words[idx] = c[Math.floor(Math.random() * c.length)];
      banned.add(words[idx]);
    }
  }
  return { color, category, words };
}

function groupFakeMutation(color, category, anatomyPool, banned){
  const base = pickDistinct(anatomyPool, 4, new Set()); // do not ban base directly
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const mutated = base.map(w => {
    const up = String(w).toUpperCase();
    if(up === "ANKLE") return "KANKLE";
    const c = letters[Math.floor(Math.random() * letters.length)];
    const pos = Math.floor(Math.random() * (up.length + 1));
    return (up.slice(0,pos) + c + up.slice(pos));
  });

  const words = [];
  for(const m of mutated){
    if(banned.has(m)) continue;
    words.push(m);
    banned.add(m);
  }

  while(words.length < 4){
    const filler = ["KANKLE","TOEZ","HEELO","SOLEN","WRISTY","THUMBL"].map(x=>x.toUpperCase());
    const cand = filler[Math.floor(Math.random() * filler.length)];
    if(banned.has(cand)) continue;
    words.push(cand);
    banned.add(cand);
  }

  return { color, category, words };
}

function pickDistinct(pool, n, banned){
  const src = pool.map(w => String(w).toUpperCase());
  const out = [];
  let tries = 0;
  while(out.length < n && tries < 1000){
    tries++;
    const w = src[Math.floor(Math.random() * src.length)];
    if(!w) continue;
    if(banned.has(w)) continue;
    if(out.includes(w)) continue;
    out.push(w);
    banned.add(w);
  }
  return out;
}

function shuffleInPlace(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
