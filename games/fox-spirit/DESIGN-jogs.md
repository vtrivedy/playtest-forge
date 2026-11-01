# The jogs (alive and pointing)

Phase-2 "make it fun" sprint, item (5) (Moss; Flint :831). The slice's longest run with nothing in it is the
meadow leg from the canopy's foot to the west grove's paper ruin (≈ 25 m: north up the meadow, then west).
It reads as flat beige: nothing tells you where to go and nothing is alive. Make the ground and one creature
lead the eye there. No new systems: the unpressed creature kit, meadow rocks and leaf litter only.

## What goes in

1. **The hare (an unpressed creature that points).** A pressed hare on a low waymark stone at the canopy's
   foot, its face toward the roost so it is seen as you drop off the last leaf. Dash it: it pops, sits up,
   then lopes ahead along the jog to the grove. It keeps a few metres ahead of the fox: if you lag it stops,
   sits up and looks back at you, ears up, and goes on when you come. At the end it sits at the ruin's
   entry, facing the folded paper, and lives there (washing its face, ears flicking; it turns its head to
   watch the fox when near). Found or not, the route still reads (the cairns and leaves below).
2. **Waymark cairns.** Three knee-high cairns of stacked stones at the jog's bends (canopy foot, the turn west,
   the grove edge). Each is topped by a long flat finger-stone laid toward the next bend. Off the line by
   ~1.5 m, low cap colliders (you can hop on them), painted by the aura like the rest of the meadow.
3. **Leaf ribbon.** A thin wind-combed drift of maple leaves along the jog's shoulder from cairn to cairn, so
   the ground itself draws the line. Separate litter pass; tree drifts are unchanged.

The gate → canopy leg is short and already looks at the canopy: untouched.

## Rules

- The hare never blocks: no collider on it; it trots on the floor surface and it is not on the hero route's
  critical path (the route still walks; the hare is extra).
- Hare lead: it advances along its path only while the fox is within `HARE.lead` m of it; beyond that it
  sits and looks back. It never leaves the path (authored, not AI).
- Colour as in DESIGN-unpressed.md: plain toon materials, no `field.restore`.

## Hooks

`state().opening.unpressed.creatures` gains `hare`; dev `__gameHooks.unpress('hare')`.
Stills: `node tools/jogs-stills.mjs <out>` (chase-cam poses along the jog; `--hare 1` dashes the hare and
follows it).
