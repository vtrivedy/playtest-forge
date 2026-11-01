# Homecoming at the well

Phase-2 "make it fun" sprint (Moss; Flint :896). The slice has no ending beat: the Runaway Page is kept on the
ruin's overlook, colour rolls out, and nothing asks you back. The Great Well is where the slice began; make it
the place the slice comes together, so walking back through the village shows the place changed by what you
did. No UI, no counters, no new systems: the unpressed creature kit, the page, and the village kit.

## Beats

1. **The page comes home.** When the Runaway Page is kept and its rise-and-fade ends, a small album page
   (the same inked tree / sun / hills art, in colour) is pinned to the well's west post at eye height, facing
   the lane mouth. It stirs in the wind.
2. **The freed come home.** Creatures you have unpressed gather at the well, each in its own way:
   - hedgehog: already lives by the well (no change);
   - kit: already trots home and curls by the well (no change);
   - hare: leaves the ruin entry and lopes home round the meadow, then sits by the well;
   - heron: one wheeling fly-over of the well, then back to its cliff (it stays: its back is the fling shortcut);
   - stag: stays on the far crag; the Keeping view is its place.
   A creature freed after the page is kept comes home the same way when its own performance ends.
3. **The lanterns.** The well's hood carries five unlit paper lanterns. Each homecoming (the page pinned,
   hedgehog, kit, hare home, heron's pass) kindles one: a soft warm glow and a chime.
   Five lit: the windlass turns and the bucket comes up full, once.

## Rules

- Lanterns kindle only on the homecoming beats above, never on a timer.
- The hare's walk home is authored waypoints on open meadow and the north lane; no colliders on creatures.
- Nothing moves before the page is kept, except creatures that already go to the well (hedgehog, kit):
  they count as home once the page is kept.

## Hooks

`state().opening.homecoming` = `{ pinned, home: string[], lit, bucket }`; dev `__gameHooks.homecoming()`
forces kept-equivalent (pins the page, sends the freed home).
