# Finale — the Scribe's Press (Wren, swarm4)

Seed DESIGN v1: "At the end you set warmth down, rest with the kits, and let the year turn." Arc: Care → Understanding → Release (Album opens; leaves fall; snow). This is that last beat, in a new place.

## Place: Press Hollow

Past the Hearthtree bridge the far crag looks down the vista gap at the Still Crown. Below the crag, a sheltered hollow (floor ≈ 7 m under the crag top) holds the Scribe's Press: the Album lies shut on a stone plinth under a timber book-press, an iron screw driving a platen down on its cover, pressed leaves sticking out between the pages, and a cold ash cradle at its foot. Beside it the Scribe's empty stool and a cold lamp. Behind the Press the hollow's far lip drops into the deep valley, so from the crag the Press stands against the Crown.

- **Arrive:** jump off the crag and glide down into the hollow (glide 3:1 → ~22 m). It's the slice's one big descent; the Press grows in the frame as you glide.
- **Walk in / out:** the south lane (a worn path from the H-a apron past the canopy, through a cut in the south rim) walks both ways between the meadow and the hollow; the vista floor was already walkable from the meadow, so there is no one-way ledge. The story gate is the Press itself: sealed until the Keeping has settled. Carrying the ember down the lane works as well as the glide.
- **Way:** once the Keeping has settled, a thin stream of warm motes runs from the root-hearth across the bridge, off the crag and down to the cradle, until the Press is kindled.
- Set dressing: a ring of maples on the hollow's slopes, leaf drifts, pressed-flat standing stones, loose album pages in the grass.

## Beat

1. **Bring warmth.** The ember from the root-hearth (the same one coal; carry.ts says it never runs out) — pick it up off the terrace, carry it across the bridge, glide down with it, set it in the Press cradle.
2. **Warming** (~2.5 s): the cradle flares, the iron screw glows from the bottom up, ink frost cracks off the boards.
3. **Unbinding** (~3 s): the wheel turns and the screw backs out, lifting the platen clear.
4. **Open** (~3 s): the cover turns over the spine and comes to rest on a stone; the pages show.
5. **Released** (~6 s): pages peel off in a spiral and fly up the valley toward the Crown, turning to leaves; the Crown (crown.ts) lets go of everything — a long leaf river over the horizon. Three pages drift down and unpress into fox kits.
6. **Snow:** the first snow begins everywhere, soft and slow; the light warms around the cradle. The kits trot to the cradle and curl up round it.

Album captions (≤ 6 words, the slice's only words): unbinding — *The Scribe pressed the autumn shut*; release — *so it would never end.*; snow — *Let the year turn.* The sequence plays wide (a camera path rises behind the ember to frame Press, Album and Crown; any input after 5 s takes it back).

7. **Rest:** when the fox stands still by the cradle (or after a grace timeout, so it's never missed), the camera eases out to a held composition — fox, kits, ember, the open Album, the bare Crown in snow — and a title card fades: *The Keeping*. It fades, play continues in the snow.

## Rules

- The Press is sealed until the first Keeping has settled. Once kindled the sequence is latched and automatic: carrying the ember away doesn't stop or rewind it (TLA `Latched`, `Monotone`).
- Kits pop only after release; the card shows once, in snow, with every kit curled (TLA `Safe`).
- No UI except three short captions and the one end card; no counters.
- Per-frame code in `finale.hot.ts`: preallocated, real `dt`, no `Math.random`, seeded rand only at build.

## Model

`tla/Finale.tla` (+ `.cfg`): `tlc -workers 2 -config Finale.cfg Finale.tla` → 366 distinct states, no error. Broken variants (Kindle without the settled gate; Advance waiting on the ember) fail `Safe` / `EndsOnce` respectively.

## Hooks

`state().opening.finale` = `{ phase, t, kits, card, snow }`; dev `__gameHooks.finale()` (settle the Keeping + put the ember in the cradle).
