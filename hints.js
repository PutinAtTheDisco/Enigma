/* hints.js — Enigma hints that actually help (and sometimes roast you). */

(function () {
  "use strict";

  // Expose a single global function: window.enigmaHint(...)
  window.enigmaHint = function enigmaHint(opts) {
    const {
      puzzle,
      tiles,
      selectedIds,
      toast = defaultToast
    } = opts || {};

    if (!puzzle || !puzzle.groups || !Array.isArray(tiles)) {
      toast("Hint system can't see the puzzle. Classic.");
      return;
    }

    const selectedTiles = [...(selectedIds || [])]
      .map(id => tiles.find(t => t.id === id))
      .filter(Boolean);

    const remainingTiles = tiles.filter(t => !t.locked);

    const groupOf = (t) => puzzle.groups[t.groupIndex];

    // Helper: counts by groupIndex
    const countsByGroup = () => {
      const m = new Map();
      for (const t of selectedTiles) {
        m.set(t.groupIndex, (m.get(t.groupIndex) || 0) + 1);
      }
      return m;
    };

    // 4 selected => "one-away" / submit guidance
    if (selectedTiles.length === 4) {
      const counts = countsByGroup();
      let bestGi = null, best = 0;
      for (const [gi, c] of counts.entries()) {
        if (c > best) { best = c; bestGi = gi; }
      }
      if (best === 4) {
        toast("That's a correct group. Hit submit before you overthink it.");
        return;
      }
      if (best === 3) {
        toast(`One away from: ${groupOf({ groupIndex: bestGi }).category}`);
        return;
      }
      toast("Not one-away. Your selection is basically interpretive dance.");
      return;
    }

    // 3 selected => reveal missing word if they are 3/4 correct
    if (selectedTiles.length === 3) {
      const gi0 = selectedTiles[0].groupIndex;
      const same = selectedTiles.every(t => t.groupIndex === gi0);
      if (same) {
        const g = puzzle.groups[gi0];
        const s = new Set(selectedTiles.map(t => t.word));
        const missing = g.words.find(w => !s.has(w));
        if (missing) toast(`3/4 of "${g.category}". Missing: ${missing}`);
        else toast(`3/4 of "${g.category}". You're basically done. Submit.`);
        return;
      }
      toast("Those 3 aren't from the same group. Swap one tile.");
      return;
    }

    // 2 selected => say if they match and give category
    if (selectedTiles.length === 2) {
      const [a, b] = selectedTiles;
      if (a.groupIndex === b.groupIndex) {
        toast(`Those two match: ${groupOf(a).category}`);
      } else {
        toast("Those two do not match. Betray one of them.");
      }
      return;
    }

    // 1 selected => tell category (no full spoiler)
    if (selectedTiles.length === 1) {
      const g = groupOf(selectedTiles[0]);
      toast(`That tile belongs to: ${g.category}`);
      return;
    }

    // 0 selected => give a starter clue (tile + category)
    if (!remainingTiles.length) {
      toast("No tiles left to hint. Go touch grass.");
      return;
    }
    const t = remainingTiles[Math.floor(Math.random() * remainingTiles.length)];
    toast(`Starter: "${t.word}" belongs to "${groupOf(t).category}"`);
  };

  function defaultToast(msg) {
    // Fallback toast if your app didn't provide one
    alert(msg);
  }
})();
