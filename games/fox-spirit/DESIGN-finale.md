# Finale — the Scribe's Press (Wren, swarm4)

Seed DESIGN v1: "At the end you set warmth down, rest with the kits, and let the year turn." Arc: Care → Understanding → Release (Album opens; leaves fall; snow). This is that last beat, in a new place.

## Place: Press Hollow

Past the Hearthtree bridge the far crag looks down the vista gap at the Still Crown. Below the crag, a sheltered hollow (floor ≈ 7 m under the crag top) holds the Scribe's Press: two tall stone boards — the Album's covers — clamped by an iron screw frame, pressed page edges with leaves sticking out between them, and a cold ash cradle at its foot. Beside it the Scribe's empty stool and a cold lamp. Behind the Press the hollow's far lip drops into the deep valley, so from the crag the Press stands against the Crown.

- **Arrive:** jump off the crag and glide down into the hollow (glide 3:1 → ~22 m). It's the slice's one big descent; the Press grows in the frame as you glide.
- **Leave:** a birch lane runs NW out of the hollow through the south rim and ends on a ~2 m ledge you drop off into the meadow by the canopy. One-way: you can't walk in from the meadow, so the bridge is the way in.
- Set dressing: birch/maple stumps, leaf drifts, a ring of pressed-flat standing stones, page-scraps caught in the grass.

## Beat

1. **Bring warmth.** The ember from the root-hearth (the same one coal; carry.ts says it never runs out) — pick it up off the terrace, carry it across the bridge, glide down with it, set it in the Press cradle.
2. **Warming** (~2.5 s): the cradle flares, the iron screw glows from the bottom up, ink frost cracks off the boards.
3. **Unbinding** (~3 s): the screw turns and rises; the frame lifts away.
4. **Open** (~3 s): the front cover swings open like a book; the Album's pages lift.
5. **Released** (~6 s): pages peel off in a spiral and fly up the valley toward the Crown, turning to leaves; the Crown (crown.ts) lets go of everything — a long leaf river over the horizon. Three pages drift down and unpress into fox kits.
6. **Snow:** the first snow begins everywhere, soft and slow; the light warms around the cradle. The kits trot to the cradle and curl up round it.
7. **Rest:** when the fox stands still by the cradle (or after a grace timeout, so it's never missed), the camera eases out to a held composition — fox, kits, ember, the open Album, the bare Crown in snow — and a title card fades: *The Keeping*. It fades, play continues in the snow.

## Rules

- The Press is sealed until the first Keeping has settled. Once kindled the sequence is latched and automatic: carrying the ember away doesn't stop or rewind it (TLA `Latched`, `Monotone`).
- Kits pop only after release; the card shows once, in snow, with every kit curled (TLA `Safe`).
- No UI except the one end card; no counters.
- Per-frame code in `finale.hot.ts`: preallocated, real `dt`, no `Math.random`, seeded rand only at build.

## Model

`tla/Finale.tla` (+ `.cfg`): `tlc -workers 2 -config Finale.cfg Finale.tla` → 366 distinct states, no error. Broken variants (Kindle without the settled gate; Advance waiting on the ember) fail `Safe` / `EndsOnce` respectively.

## Hooks

`state().opening.finale` = `{ phase, t, kits, card, snow }`; dev `__gameHooks.finale()` (settle the Keeping + put the ember in the cradle).
