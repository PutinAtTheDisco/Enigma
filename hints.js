(function(){
  "use strict";

  window.enigmaHint = function(opts){
    const { puzzle, tiles, selectedIds, toast } = opts || {};
    const say = toast || ((m)=>alert(m));

    if(!puzzle || !Array.isArray(puzzle.groups) || !Array.isArray(tiles)){
      say("Hint system can't see the puzzle. Which is… on brand.");
      return;
    }

    const selected = [...(selectedIds || [])]
      .map(id => tiles.find(t => t.id === id))
      .filter(Boolean);

    const remaining = tiles.filter(t => !t.locked);
    const group = (gi) => puzzle.groups[gi];

    // 4 selected: check if they are one-away and name the target category
    if(selected.length === 4){
      const counts = new Map();
      for(const t of selected) counts.set(t.groupIndex, (counts.get(t.groupIndex)||0)+1);

      let bestGi = null, best = 0;
      for(const [gi, c] of counts.entries()){
        if(c > best){ best = c; bestGi = gi; }
      }

      if(best === 4){
        say("That’s a correct group. Submit it before you self-sabotage.");
        return;
      }
      if(best === 3){
        say(`One away from: ${group(bestGi).category}`);
        return;
      }
      say("Not one-away. Your selection is a poem. Incorrect, but emotional.");
      return;
    }

    // 3 selected: if they are all same group, reveal missing word
    if(selected.length === 3){
      const gi = selected[0].groupIndex;
      const same = selected.every(t => t.groupIndex === gi);
      if(!same){
        say("Those 3 aren’t in the same group. Swap one.");
        return;
      }
      const g = group(gi);
      const have = new Set(selected.map(t => t.word));
      const missing = g.words.find(w => !have.has(w));
      say(missing ? `3/4 of "${g.category}". Missing: ${missing}` : `3/4 of "${g.category}". Submit.`);
      return;
    }

    // 2 selected: say match or no
    if(selected.length === 2){
      const [a,b] = selected;
      if(a.groupIndex === b.groupIndex) say(`Match: ${group(a.groupIndex).category}`);
      else say("Those two don’t match. Break up.");
      return;
    }

    // 1 selected: reveal category
    if(selected.length === 1){
      say(`That tile belongs to: ${group(selected[0].groupIndex).category}`);
      return;
    }

    // 0 selected: give a starter clue tile + category
    if(!remaining.length){
      say("No tiles left. You did it. Or you failed and it ended. Same vibe.");
      return;
    }
    const t = remaining[Math.floor(Math.random() * remaining.length)];
    say(`Starter: "${t.word}" belongs to "${group(t.groupIndex).category}"`);
  };
})();
