// hints.js
// Uses the solved groups from the puzzle payload (already in app.js as `puzzle.groups`).
// Returns a human hint that is actually helpful.

export function getHint(puzzle, tiles, solved, difficulty) {
  const solvedIdx = new Set(solved.map(g => g.category));
  const remainingGroups = puzzle.groups.filter(g => !solvedIdx.has(g.category));

  if (!remainingGroups.length) return "No hints. You already suffered enough.";

  // Prefer the hardest remaining group to hint, because cruelty builds character.
  const g = pick(remainingGroups);

  // Hint styles: category nudge, two-word nudge, pattern nudge
  const hintStyle = weightedPick([
    ["categoryNudge", 4],
    ["twoWordNudge", 4],
    ["patternNudge", 3],
    ["eliminate", 2],
  ]);

  const words = g.words;

  if (hintStyle === "categoryNudge") {
    return categoryHint(g.category);
  }

  if (hintStyle === "twoWordNudge") {
    const w = shuffle([...words]).slice(0, 2);
    return `Two of the same group: ${w[0]} + ${w[1]}.`;
  }

  if (hintStyle === "patternNudge") {
    return patternHint(g.category, words);
  }

  if (hintStyle === "eliminate") {
    // pick a tile not in this group and tell them it’s NOT part of the group
    const remainingTiles = tiles.filter(t => !t.locked);
    const notInGroup = remainingTiles.map(t => t.word).filter(w => !words.includes(w));
    if (notInGroup.length) return `Not in the hinted group: ${pick(notInGroup)}.`;
    return categoryHint(g.category);
  }

  return categoryHint(g.category);
}

function categoryHint(category) {
  const c = category.toUpperCase();

  if (c.includes("HOMOPHONE")) return "Listen, don’t look: same sound, different spelling.";
  if (c.includes("PORTMANTEAU")) return "Two words smashed together into one.";
  if (c.includes("START WITH \"MEGA\"")) return "All four start with the same prefix.";
  if (c.includes("WORDS AFTER \"QUICK\"")) return "Think common phrases. QUICK ____.";
  if (c.includes("FANDOM CROSSOVER")) return "These are from different fandom worlds. Nerd brain required.";
  if (c.includes("WEAPONS")) return "Pointy, slashy, historically problematic objects.";
  if (c.includes("SLANG")) return "Words that make older people tired.";
  if (c.includes("MINECRAFT")) return "Block game terminology. Yes, that one.";
  if (c.includes("POK")) return "Pocket monsters. Creature names and related terms.";
  if (c.includes("STAR WARS")) return "Space wizards with laser swords.";
  if (c.includes("MARVEL")) return "Superhero universe terms.";
  if (c.includes("WORDS THAT MAKE YOU FEEL INADEQUATE")) return "Fancy vocabulary. Pretend you’re in a thesis defense.";

  return `Category clue: ${titleCase(c)}.`;
}

function patternHint(category, words) {
  const c = category.toUpperCase();
  if (c.includes("MEGA")) return `All four literally start with MEGA.`;
  if (c.includes("QUICK")) return `All four can follow QUICK.`;
  if (c.includes("HOMOPHONE")) return `Two pairs: same pronunciation, different spelling.`;
  // fallback: give the shortest shared feature (first letter)
  const first = words[0][0];
  const allSameFirst = words.every(w => w[0] === first);
  if (allSameFirst) return `They all start with "${first}".`;
  return "Look for a hidden rule: prefix, sound, or theme.";
}

function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function weightedPick(entries){
  const total = entries.reduce((s, [,w]) => s+w, 0);
  let r = Math.random()*total;
  for(const [k,w] of entries){
    r -= w;
    if(r<=0) return k;
  }
  return entries[0][0];
}
function titleCase(s){
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
