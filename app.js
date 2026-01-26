const el = (id) => document.getElementById(id);

const COLORS = { YELLOW:"var(--y)", GREEN:"var(--g)", BLUE:"var(--b)", PURPLE:"var(--p)" };
const DIFF_NAMES = {1:"Chill",2:"Normal",3:"Spicy",4:"Hard",5:"Brutal"};

const store = {
  get(k, fallback){
    try{
      const v = localStorage.getItem(k);
      if(v === null || v === undefined) return fallback;
      return JSON.parse(v);
    }catch{ return fallback; }
  },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

const stats = {
  played: store.get("en_played", 0),
  wins: store.get("en_wins", 0),
  losses: store.get("en_losses", 0),
  streak: store.get("en_streak", 0),
  best: store.get("en_best", 0),
};

function renderStats(){
  const wr = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  el("stats").textContent =
    `Played: ${stats.played}   Wins: ${stats.wins}   Losses: ${stats.losses}   Win rate: ${wr}%   Streak: ${stats.streak}   Best: ${stats.best}`;
}

function saveStats(){
  store.set("en_played", stats.played);
  store.set("en_wins", stats.wins);
  store.set("en_losses", stats.losses);
  store.set("en_streak", stats.streak);
  store.set("en_best", stats.best);
  renderStats();
}

function toast(text){
  const t = el("toast");
  if(!t) return alert(text); // fallback
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1400);
}

function randInt(n){ return Math.floor(Math.random()*n); }
function shuffleInPlace(a){
  for(let i=a.length-1;i>0;i--){
    const j = randInt(i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

let difficulty = store.get("en_diff", 4);

function setDifficultyUI(){
  el("diff").value = difficulty;
  el("diffLabel").textContent = DIFF_NAMES[difficulty] || "Hard";
  el("diffHint").textContent =
    difficulty <= 2 ? "Cleaner categories, less overlap." :
    difficulty === 3 ? "Some overlap, more trickery." :
    difficulty === 4 ? "Overlap bait, nerd traps, sharper misdirection." :
    "Maximum overlap. The puzzle is the villain now.";
}

el("diff").addEventListener("input", (e) => {
  difficulty = Number(e.target.value);
  store.set("en_diff", difficulty);
  setDifficultyUI();
});

/* ------------------------------ game state ------------------------------ */

let puzzle = null;
let tiles = [];
let selected = new Set();
let solved = [];
let mistakes = 0;

/* Progressive hint state per puzzle */
let hintTier = 0;           // 0 -> gentle, 1 -> stronger, 2 -> basically tells you
let hintedGroups = new Set(); // groupIndex values we've hinted about

function resetHintState(){
  hintTier = 0;
  hintedGroups = new Set();
}

function renderDots(){
  const dots = el("dots");
  if(!dots) return;
  dots.innerHTML = "";
  const remaining = 4 - mistakes;
  for(let i=0;i<4;i++){
    const d = document.createElement("div");
    d.className = "dot" + (i >= remaining ? " on" : "");
    dots.appendChild(d);
  }
}

function renderSolvedBars(){
  const area = el("solvedArea");
  if(!area) return;
  area.innerHTML = "";
  const order = ["YELLOW","GREEN","BLUE","PURPLE"];
  const ordered = [...solved].sort((a,b)=>order.indexOf(a.color)-order.indexOf(b.color));
  for(const g of ordered){
    const bar = document.createElement("div");
    bar.className = "solvedBar";
    bar.style.background = COLORS[g.color] || "var(--y)";

    const cat = document.createElement("div");
    cat.className = "cat";
    cat.textContent = g.category;

    const words = document.createElement("div");
    words.className = "words";
    words.textContent = g.words.join(", ");

    bar.appendChild(cat);
    bar.appendChild(words);
    area.appendChild(bar);
  }
}

function renderGrid(){
  const grid = el("grid");
  if(!grid) return;
  grid.innerHTML = "";

  const remaining = tiles.filter(t => !t.locked);

  for(const t of remaining){
    const d = document.createElement("div");
    d.className = "tile" + (selected.has(t.id) ? " sel" : "");
    d.textContent = t.word;

    // accessibility-ish
    d.setAttribute("role", "button");
    d.setAttribute("tabindex", "0");

    d.onclick = () => toggleSelect(t.id);
    d.onkeydown = (ev) => {
      if(ev.key === "Enter" || ev.key === " "){
        ev.preventDefault();
        toggleSelect(t.id);
      }
    };

    grid.appendChild(d);
  }

  // Fill blanks so the grid stays a 4x4 shape when rows disappear
  const blanks = Math.max(0, 16 - (solved.length * 4) - remaining.length);
  for(let i=0;i<blanks;i++){
    const b = document.createElement("div");
    b.className = "tile";
    b.style.visibility = "hidden";
    grid.appendChild(b);
  }
}

function updateUIState(){
  const submitBtn = el("submitBtn");
  if(submitBtn) submitBtn.disabled = selected.size !== 4;

  const hintLine = el("hintLine");
  if(hintLine){
    hintLine.textContent =
      selected.size === 0 ? "Select 4 tiles." : `Selected: ${selected.size}/4`;
  }
}

function toggleSelect(id){
  if(selected.has(id)) selected.delete(id);
  else{
    if(selected.size >= 4) return;
    selected.add(id);
  }
  renderGrid();
  updateUIState();
}

function deselectAll(){
  selected.clear();
  renderGrid();
  updateUIState();
}

function shuffleTiles(){
  const locked = tiles.filter(t => t.locked);
  const unlocked = tiles.filter(t => !t.locked);
  shuffleInPlace(unlocked);
  tiles = [...locked, ...unlocked];
  selected.clear();
  renderGrid();
  updateUIState();
}

function oneAwayCheck(picks){
  const counts = new Map();
  for(const p of picks){
    counts.set(p.groupIndex, (counts.get(p.groupIndex) || 0) + 1);
  }
  let best = 0;
  for(const v of counts.values()) best = Math.max(best, v);
  return best === 3;
}

function submit(){
  if(selected.size !== 4) return;

  const picks = [...selected].map(id => tiles.find(t => t.id === id));
  const gi = picks[0].groupIndex;
  const allSame = picks.every(p => p.groupIndex === gi);

  if(allSame){
    const grp = puzzle.groups[gi];
    picks.forEach(p => p.locked = true);
    solved.push(grp);
    selected.clear();
    renderSolvedBars();
    renderGrid();
    updateUIState();
    toast("Correct.");

    // reward: reset hint tier slightly after a solve
    hintTier = Math.max(0, hintTier - 1);

    if(solved.length === 4){
      endGame(true);
    }
    return;
  }

  const oneAway = oneAwayCheck(picks);
  mistakes++;
  selected.clear();
  renderDots();
  renderGrid();
  updateUIState();
  toast(oneAway ? "One away." : "Nope.");

  if(mistakes >= 4){
    endGame(false);
  }
}

/* ------------------------------ REAL hints (progressive) ------------------------------ */
/*
Hint tiers:
0: Reveal a category *type* clue (not name) + one member
1: Reveal 2 members of the same group
2: Reveal full category name for a not-yet-solved group (still no full answer)
*/

function getUnsolvedGroupIndexes(){
  const solvedIdx = new Set();
  solved.forEach(g => {
    // find group index by matching category; safer approach:
    // we’ll use tile locks: if any tile from group is locked, group might be solved.
  });

  // Determine solved groups by checking locked tiles
  const lockedByGroup = new Map();
  for(const t of tiles){
    if(t.locked){
      lockedByGroup.set(t.groupIndex, (lockedByGroup.get(t.groupIndex) || 0) + 1);
    }
  }
  const unsolved = [];
  for(let gi=0; gi<4; gi++){
    const lockedCount = lockedByGroup.get(gi) || 0;
    if(lockedCount < 4) unsolved.push(gi);
  }
  return unsolved;
}

function hint(){
  if(!puzzle || !tiles.length) return;

  const unsolved = getUnsolvedGroupIndexes();
  if(!unsolved.length){
    toast("No hints. You already won. Go outside.");
    return;
  }

  // pick a group we haven't hinted yet when possible
  let candidates = unsolved.filter(gi => !hintedGroups.has(gi));
  if(!candidates.length) candidates = unsolved;

  const gi = candidates[randInt(candidates.length)];
  const grp = puzzle.groups[gi];

  // Get remaining tiles from that group that aren't locked
  const remainingGroupTiles = tiles
    .filter(t => t.groupIndex === gi && !t.locked)
    .map(t => t.word);

  if(remainingGroupTiles.length === 0){
    hintedGroups.add(gi);
    return hint(); // try another
  }

  // Ensure we have enough to reveal
  const pick1 = sampleFrom(remainingGroupTiles, 1)[0];
  const pick2 = sampleFrom(remainingGroupTiles.filter(w => w !== pick1), 1)[0];

  if(hintTier === 0){
    // Give a soft clue about the category without naming it (when possible).
    // If category name is super explicit, we obfuscate it.
    const softened = softenCategoryName(grp.category);
    toast(`Hint: One group is like “${softened}”. Example member: ${pick1}`);
  } else if(hintTier === 1){
    if(pick2){
      toast(`Hint: These two belong together: ${pick1} + ${pick2}`);
    } else {
      toast(`Hint: ${pick1} belongs to a group. Yes, that’s still a hint. Cope.`);
    }
  } else {
    toast(`Hint: Category name: ${grp.category}`);
  }

  hintedGroups.add(gi);
  hintTier = clamp(hintTier + 1, 0, 2);
}

function sampleFrom(arr, n){
  const a = [...arr];
  shuffleInPlace(a);
  return a.slice(0, n);
}

function softenCategoryName(name){
  // Make it less “free answer” by swapping obvious words for vaguer terms.
  // Not perfect, but good enough for chaos.
  let s = String(name || "").toUpperCase();

  const swaps = [
    ["MINECRAFT", "BLOCK GAME"],
    ["POKÉMON", "MONSTER GAME"],
    ["MARVEL", "SUPERHERO"],
    ["STAR WARS", "SPACE OPERA"],
    ["WEAPONS", "POINTY THINGS"],
    ["INTERNET SLANG", "ONLINE WORDS"],
    ["HARRY POTTER", "WIZARD STUFF"],
    ["LORD OF THE RINGS", "FANTASY STUFF"],
    ["SOFTWARE", "CODE THINGS"],
  ];

  for(const [a,b] of swaps){
    if(s.includes(a)){
      s = s.replaceAll(a, b);
      break;
    }
  }

  // if it's too explicit like "WORDS THAT START WITH 'MEGA'" reduce it
  if(s.includes("WORDS THAT START WITH")){
    return "a shared prefix situation";
  }
  if(s.includes("WORDS THAT END WITH")){
    return "a shared suffix situation";
  }

  // keep short-ish
  if(s.length > 32) s = s.slice(0, 32) + "…";
  return s;
}

/* ------------------------------ end game / stats ------------------------------ */

function endGame(won){
  stats.played++;
  if(won){
    stats.wins++;
    stats.streak++;
    stats.best = Math.max(stats.best, stats.streak);
  }else{
    stats.losses++;
    stats.streak = 0;
  }
  saveStats();

  if(!won){
    // Reveal on loss
    solved = [...puzzle.groups];
    renderSolvedBars();
    tiles.forEach(t => t.locked = true);
    renderGrid();
  }

  toast(won ? "Win." : "Loss.");
}

/* ------------------------------ repeat avoidance ------------------------------ */
/*
We store recent "seen tokens" sent by the API (data.seen),
and send them back on the next puzzle request as `recent=`.
This prevents category/word repeats *per user* without KV.
*/

function getRecentTokens(){
  const arr = store.get("en_recent", []);
  if(!Array.isArray(arr)) return [];
  return arr.map(x => String(x).toLowerCase()).slice(-250);
}

function addRecentTokens(tokens){
  if(!Array.isArray(tokens) || !tokens.length) return;
  const cur = getRecentTokens();
  for(const t of tokens){
    const v = String(t).toLowerCase();
    if(!v) continue;
    cur.push(v);
  }
  // cap
  store.set("en_recent", cur.slice(-250));
}

/* ------------------------------ fetch puzzle ------------------------------ */

async function fetchPuzzle(){
  toast("Summoning fresh suffering...");

  const recent = getRecentTokens();
  const url =
    `/api/puzzle?difficulty=${encodeURIComponent(difficulty)}&recent=${encodeURIComponent(recent.join(","))}`;

  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();

  puzzle = data;
  solved = [];
  mistakes = 0;
  selected = new Set();
  resetHintState();

  tiles = data.tiles.map((t, idx) => ({
    id: idx,
    word: String(t.word || "").toUpperCase(),
    groupIndex: Number(t.groupIndex),
    locked: false
  }));

  renderSolvedBars();
  renderDots();
  renderGrid();
  updateUIState();

  // save “seen” tokens so next puzzle avoids repeats
  addRecentTokens(data.seen);

  toast("New puzzle.");
}

/* ------------------------------ wire up buttons ------------------------------ */

const shuffleBtn = el("shuffleBtn");
const deselectBtn = el("deselectBtn");
const submitBtn = el("submitBtn");
const hintBtn = el("hintBtn");
const newBtn = el("newBtn");
const resetStatsBtn = el("resetStatsBtn");

if(shuffleBtn) shuffleBtn.onclick = shuffleTiles;
if(deselectBtn) deselectBtn.onclick = deselectAll;
if(submitBtn) submitBtn.onclick = submit;
if(hintBtn) hintBtn.onclick = hint;
if(newBtn) newBtn.onclick = () => fetchPuzzle().catch(e => toast(e.message));
if(resetStatsBtn) resetStatsBtn.onclick = () => {
  if(!confirm("Reset stats? This erases wins/losses/streaks.")) return;
  stats.played=0; stats.wins=0; stats.losses=0; stats.streak=0; stats.best=0;
  saveStats();
  toast("Stats reset.");
};

renderStats();
setDifficultyUI();
renderDots();
fetchPuzzle().catch(e => toast(e.message));
