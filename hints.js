// hints.js — smarter hints for Connected!
// Export: getHint(puzzle, tiles, solved, difficulty)
// Always stays logically correct because it uses the actual puzzle groups.

const VAGUE_WORDS = new Set(["THE","A","AN","OF","AND","TO","IN","ON","FOR","WITH"]);

function maskCategory(cat, difficulty){
  const s = String(cat || "").trim();
  if(!s) return "…";
  if(difficulty <= 2) return s;

  // Harder: obscure it without becoming useless
  if(difficulty === 3){
    // remove vowels
    return s.replace(/[AEIOU]/gi, "•");
  }
  if(difficulty === 4){
    // keep first letters of words
    return s.split(/\s+/).map(w => w[0] ? (w[0].toUpperCase() + "…") : "").join(" ");
  }
  // Brutal: give a “theme vibe” instead of title
  const tokens = s.toUpperCase().split(/[^A-Z0-9]+/).filter(t => t && !VAGUE_WORDS.has(t));
  if(tokens.length) return `Theme includes: ${tokens.slice(0,2).join(", ")}`;
  return "Theme is… a concept.";
}

function groupStillInPlay(group, tiles){
  const remainingWords = new Set(tiles.filter(t => !t.locked).map(t => t.word));
  return group.words.some(w => remainingWords.has(String(w).toUpperCase()));
}

function pickUnsolvedGroup(puzzle, tiles, solved){
  const solvedSet = new Set(solved.map(g => g.category));
  const candidates = puzzle.groups.filter(g => !solvedSet.has(g.category) && groupStillInPlay(g, tiles));
  if(!candidates.length) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

function wordsForGroupInRemaining(group, tiles){
  const remaining = new Set(tiles.filter(t => !t.locked).map(t => t.word));
  return group.words.map(w => String(w).toUpperCase()).filter(w => remaining.has(w));
}

function analyzeSelection(puzzle, tiles, selectedIds){
  const picks = [...selectedIds].map(id => tiles.find(t => t.id === id)).filter(Boolean);
  if(picks.length === 0) return null;

  const counts = new Map();
  for(const p of picks){
    counts.set(p.groupIndex, (counts.get(p.groupIndex) || 0) + 1);
  }
  let bestGI = null;
  let bestCount = 0;
  for(const [gi, c] of counts.entries()){
    if(c > bestCount){
      bestCount = c;
      bestGI = gi;
    }
  }
  return { picks, bestGI, bestCount };
}

export function getHint(puzzle, tiles, solved, difficulty, selected = new Set()){
  // If user has selected 3: tell them if those 3 are “tight” (same group) or not.
  // This is the most useful hint for actual gameplay.
  if(selected && selected.size === 3){
    const a = analyzeSelection(puzzle, tiles, selected);
    if(!a) return "Select tiles first. Yes, that’s how games work.";
    const grp = puzzle.groups[a.bestGI];
    if(a.bestCount === 3){
      // confirm + nudge
      const remaining = wordsForGroupInRemaining(grp, tiles);
      const missing = remaining.filter(w => !a.picks.some(p => p.word === w));
      if(missing.length){
        return `You’re one away. The missing tile is one of: ${missing.slice(0,2).join(" / ")}.`;
      }
      return `You’re one away. Stop overthinking.`;
    }
    return `Those 3 don’t belong together. Try swapping one.`;
  }

  // Otherwise: give a clue toward a real unsolved group.
  const grp = pickUnsolvedGroup(puzzle, tiles, solved);
  if(!grp) return "No hints left. You have achieved… completion.";

  const remaining = wordsForGroupInRemaining(grp, tiles);
  if(remaining.length === 0) return "Hint engine found an empty group. That’s… impressive.";

  // Difficulty affects how direct we are.
  if(difficulty <= 2){
    // basically tells you the group
    return `Category: ${grp.category}. Find: ${remaining.slice(0,2).join(", ")} + two more.`;
  }

  if(difficulty === 3){
    return `Clue: ${maskCategory(grp.category, difficulty)}. Two tiles are: ${remaining.slice(0,2).join(" + ")}.`;
  }

  if(difficulty === 4){
    // hard but useful: two members + partial category
    const pick = remaining.slice(0,2);
    return `Two go together: ${pick.join(" + ")}. Theme: ${maskCategory(grp.category, difficulty)}.`;
  }

  // Brutal: one member + vibe clue (still grounded)
  const one = remaining[Math.floor(Math.random()*remaining.length)];
  return `Start here: ${one}. ${maskCategory(grp.category, difficulty)}.`;
}
