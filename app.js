// /app.js (full replacement)
// Key upgrade: client keeps a long “seen groups” backlog and sends it to API.
// That’s your “analysis of backlog” in practical form: we cross-reference seen groupKeys and avoid repeats.

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

/* ------------------- Anti-repeat backlog (“analysis”) ------------------- */

// Store a rolling backlog of seen groups (category+words identity key from API).
// This avoids repeats for a LONG time.
const SEEN_MAX = 2500;
const seen = store.get("en_seen_groups", []); // array of keys

function rememberGroupKeys(keys){
  // Add newest at end, keep unique-ish
  const set = new Set(seen);
  for(const k of keys){
    if(!k) continue;
    if(!set.has(k)){
      seen.push(k);
      set.add(k);
    }
  }
  // Trim
  while(seen.length > SEEN_MAX) seen.shift();
  store.set("en_seen_groups", seen);
}

function getAvoidList(){
  // Send the last N seen keys to API (enough to feel fresh without huge payload).
  const N = 700;
  return seen.slice(Math.max(0, seen.length - N));
}

let difficulty = store.get("en_diff", 4);

function setDifficultyUI(){
  el("diff").value = difficulty;
  el("diffLabel").textContent = DIFF_NAMES[difficulty] || "Hard";
  el("diffHint").textContent =
    difficulty <= 2 ? "Cleaner categories, fewer traps." :
    difficulty === 3 ? "Some overlap bait, more wordplay." :
    difficulty === 4 ? "Sharper misdirection. Expect trick categories." :
    "Brutal pool size. More wordplay. More bait. More regret.";
}

el("diff").addEventListener("input", (e) => {
  difficulty = Number(e.target.value);
  store.set("en_diff", difficulty);
  setDifficultyUI();
});

let puzzle = null;
let tiles = [];
let selected = new Set();
let solved = [];
let mistakes = 0;

function renderDots(){
  const dots = el("dots");
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
  area.innerHTML = "";
  const order = ["YELLOW","GREEN","BLUE","PURPLE"];
  const ordered = [...solved].sort((a,b)=>order.indexOf(a.color)-order.indexOf(b.color));
  for(const g of ordered){
    const bar = document.createElement("div");
    bar.className = "solvedBar";
    bar.style.background = COLORS[g.color];

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
  grid.innerHTML = "";

  const remaining = tiles.filter(t => !t.locked);

  for(const t of remaining){
    const d = document.createElement("div");
    d.className = "tile" + (selected.has(t.id) ? " sel" : "");
    d.textContent = t.word;
    d.onclick = () => toggleSelect(t.id);
    grid.appendChild(d);
  }

  const blanks = Math.max(0, 16 - (solved.length * 4) - remaining.length);
  for(let i=0;i<blanks;i++){
    const b = document.createElement("div");
    b.className = "tile";
    b.style.visibility = "hidden";
    grid.appendChild(b);
  }
}

function updateUIState(){
  el("submitBtn").disabled = selected.size !== 4;
  el("hintLine").textContent = selected.size === 0 ? "Select 4 tiles." : `Selected: ${selected.size}/4`;
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

function hint(){
  // Better hint: reveals ONE category label fragment (not full answer),
  // tied to a random unsolved group.
  if(!puzzle) return;

  const unsolved = puzzle.groups.filter((g, idx) => !solved.some(s => s.category === g.category));
  if(!unsolved.length) return;

  const g = unsolved[randInt(unsolved.length)];
  const clue = makeHintClue(g.category);

  toast(`Hint: ${clue}`);
}

function makeHintClue(category){
  // Reveal a “hinty chunk” of the category.
  // Example: HOMOPHONE PAIRS -> “sound-alikes”
  const c = category.toLowerCase();

  if(c.includes("homophone")) return "sound-alikes are involved.";
  if(c.includes("start with")) return "a shared prefix is involved.";
  if(c.includes("end with")) return "a shared suffix is involved.";
  if(c.includes("morpheme")) return "word-building/mashups are involved.";
  if(c.includes("minecraft")) return "block game brain required.";
  if(c.includes("slang")) return "terminally online vocabulary.";
  if(c.includes("science") || c.includes("math")) return "nerd math/sci terms.";
  if(c.includes("verb") && c.includes("noun")) return "grammar trick: verb+noun dual use.";

  // fallback: give first 2 words of category
  const parts = category.split(/\s+/).slice(0, 2).join(" ");
  return `category starts like: "${parts}..."`;
}

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
    solved = [...puzzle.groups];
    renderSolvedBars();
    tiles.forEach(t => t.locked = true);
    renderGrid();
  }

  toast(won ? "Win." : "Loss.");
}

async function fetchPuzzle(){
  toast("Summoning fresh suffering...");

  // POST with avoid list so we don’t repeat categories you already saw
  const res = await fetch("/api/puzzle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      difficulty,
      avoid: getAvoidList(),
    })
  });

  if(!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();

  puzzle = data;
  solved = [];
  mistakes = 0;
  selected = new Set();

  tiles = data.tiles.map((t, idx) => ({
    id: idx,
    word: t.word,
    groupIndex: t.groupIndex,
    locked: false
  }));

  // Remember the 4 groups we just generated so future puzzles avoid them
  rememberGroupKeys((data.groups || []).map(g => g.key));

  renderSolvedBars();
  renderDots();
  renderGrid();
  updateUIState();
  toast("New puzzle.");
}

el("shuffleBtn").onclick = shuffleTiles;
el("deselectBtn").onclick = deselectAll;
el("submitBtn").onclick = submit;
el("hintBtn").onclick = hint;
el("newBtn").onclick = () => fetchPuzzle().catch(e => toast(e.message));
el("resetStatsBtn").onclick = () => {
  if(!confirm("Reset stats? This erases wins/losses/streaks.")) return;
  stats.played=0; stats.wins=0; stats.losses=0; stats.streak=0; stats.best=0;
  saveStats();
  toast("Stats reset.");
};

renderStats();
setDifficultyUI();
renderDots();
fetchPuzzle().catch(e => toast(e.message));
