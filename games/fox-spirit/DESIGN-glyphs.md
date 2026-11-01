# Ink glyph stones (puzzle)

Phase-2 activity #5 (Moss): the slice's one reading puzzle, built only on verbs the fox already has (passive aura, run, dash).

## The loop

1. **Read.** Three standing stones in the east meadow look blank. Run past one and the aura paints it: an ink glyph surfaces (leaf, flame, moon) and fades again as the paint dries (~10 s trail life).
2. **Find the order.** A paper-door shrine at the rim foot (sealed with the fox mark) carries three small glyphs on its lintel — also only readable while painted. That is the order (moon → leaf → flame).
3. **Write.** Paint the stones in that order. The next stone in turn lights: its glyph turns ember and glows, with a rising chime. Painting a stone out of turn, or letting 16 s pass after the last light, gutters every lit stone (soft falling notes). No fail state, retry immediately.
4. **Open.** The third light unfolds the shrine's paper door (pop-up flap swing with overshoot, chord). Inside, on the back slab, a pressed **fox kit** page appears — the fourth unpressed creature. Dash it: it pops, looks at you, trots home across the meadow and curls up asleep by the Great Well.

## Why it is fun

Route planning on top of movement you already enjoy: the meadow has a tree between stones and the stones are spread so the obvious path (west → east from the village) paints them in the wrong order. Reading is cheap and immediate (run past = see it), mistakes cost seconds, and the payoff is a living creature that changes the hub.

## Tunables / hooks

`GLYPH_FEEL` (reveal 0.16, touch 0.22 aura supply ≈ 1.6 m from the fox; door open 1.8 s); `GLYPHS` in layout.ts (stone anchors, order, shrine, window 16 s); `KIT` (page anchor + path home). `state().opening.glyphs` = `{ progress, solved, gutters, lastGutter, order, stones[] }`; dev `__gameHooks.glyphSolve()`. Probe: `node tools/glyphs-probe.mjs <out>` (one staged start, then stick + real Shift only: wrong order gutters, right order solves, kit freed and home).
