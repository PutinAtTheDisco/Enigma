/* EnigmaHints: real hints based on the actual solution.
   Usage:
     const msg = EnigmaHints.getHint({ puzzle, tiles, selectedIds });
     if(msg) toast(msg);
*/

window.EnigmaHints = (() => {
  function getHint({ puzzle, tiles, selectedIds }) {
    if (!puzzle || !Array.isArray(puzzle.groups) || !Array.isArray(tiles)) {
      return "No puzzle loaded. Touch grass for 3 seconds, then hit New Puzzle.";
    }

    const selected = [...(selectedIds || [])]
      .map(id => tiles.find(t => t.id === id))
      .filter(Boolean);

    const remaining = tiles.filter(t => !t.locked);

    if (!remaining.length) return "Everything is solved. Go brag to someone who cares.";

    const groupOf = (tile) => tile.groupIndex;
    const group = (gi) => puzzle.groups[gi];

    // If 4 selected: tell one-away status or category if correct
    if (selected.length === 4) {
      const counts = new Map();
      for (const t of selected) {
        const gi = groupOf(t);
        counts.set(gi, (counts.get(gi) || 0) + 1);
      }
      let bestGi = null;
      let best = 0;
      for (const [gi, c] of counts.entries()) {
        if (c > best) { best = c; bestGi = gi; }
      }

      if (best === 4) return `Correct group: "${group(bestGi).category}". Submit it.`;
      if (best === 3) return `One away from: "${group(bestGi).category}". Swap ONE tile.`;
      return "Not one-away. Your selection is vibes-based, not logic-based.";
    }

    // If 3 selected: if they match, reveal missing word (strong hint)
    if (selected.length === 3) {
      const gis = selected.map(groupOf);
      const allSame = gis.every(x => x === gis[0]);
      if (allSame) {
        const gi = gis[0];
        const g = group(gi);
        const have = new Set(selected.map(t => t.word));
        const missing = g.words.find(w => !have.has(w));
        if (missing) return `3/4 of "${g.category}". Missing tile: ${missing}`;
        return `3/4 of "${g.category}". You are basically there.`;
      }
      return "Those 3 are from different groups. Betray one of them.";
    }

    // If 2 selected: say if they share a group and name category if yes
    if (selected.length === 2) {
      const [a, b] = selected;
      if (groupOf(a) === groupOf(b)) return `Those match: "${group(groupOf(a)).category}".`;
      return "Those two do not match. Break them up.";
    }

    // If 1 selected: category reveal for that tile
    if (selected.length === 1) {
      const gi = groupOf(selected[0]);
      return `"${selected[0].word}" belongs to: "${group(gi).category}".`;
    }

    // If none selected: starter hint
    const t = remaining[Math.floor(Math.random() * remaining.length)];
    return `Starter: "${t.word}" belongs to "${group(groupOf(t)).category}".`;
  }

  return { getHint };
})();
