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
  toast._t = setTimeout(() => t.classList.remove("show"), 1200);
}

function randInt(n){ return Math.floor(Math.random()*n); }
function shuffleInPlace(a){
  for(let i=a.length-1;i>0;i--){
    const j = randInt(i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const remaining = tiles.filter(t => !t.locked);
  if(!remaining.length) return;
  const pickTile = remaining[randInt(remaining.length)];
  toast(`Hint: "${pickTile.word}" belongs to a real group.`);
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
    // Reveal on loss
    solved = [...puzzle.groups];
    renderSolvedBars();
    tiles.forEach(t => t.locked = true);
    renderGrid();
  }

  toast(won ? "Win." : "Loss.");
}

async function fetchPuzzle(){
  toast("Summoning fresh suffering...");
  const url = `/api/puzzle?difficulty=${encodeURIComponent(difficulty)}`;

  const res = await fetch(url, { cache: "no-store" });
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