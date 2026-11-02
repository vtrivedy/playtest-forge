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

Album captions (≤ 6 words, the slice's only words; `ctx.captions.say`), the whole arc: page kept — *A page escaped the Scribe's Album.*; Hearthtree settles — *The tree finished falling, at last.*; the Hermitage desk (Bramble) — *Here the Scribe kept every autumn*; unbinding — *The Scribe pressed the autumn shut*; release — *so it would never end.*; snow — *Let the year turn.* The sequence plays wide (a camera path rises behind the ember to frame Press, Album and Crown; any input after 5 s takes it back).

7. **Rest:** the kits lie down round the ember (authored `lieDown`/`rest` clips, `tools/blender/scripts/hearth_fox_rest.py`); when the fox stands still by the cradle it lies down with them (asking to move plays the lie-down back while the controller is held, then hands control over — feel critic PASS 48a800b). When the fox rests (or after a grace timeout, so it's never missed) the camera eases out to a held composition — fox, kits, ember, the open Album, the bare Crown in snow — and a title card fades: *The Keeping*. It fades, play continues in the snow.

## Rules

- The Press is sealed until the first Keeping has settled. Once kindled the sequence is latched and automatic: carrying the ember away doesn't stop or rewind it (TLA `Latched`, `Monotone`).
- Kits pop only after release; the card shows once, in snow, with every kit curled (TLA `Safe`).
- No UI except three short captions and the one end card; no counters.
- Per-frame code in `finale.hot.ts`: preallocated, real `dt`, no `Math.random`, seeded rand only at build.

## Model

`tla/Finale.tla` (+ `.cfg`): `tlc -workers 2 -config Finale.cfg Finale.tla` → 540 distinct states, no error (incl. the hero lying / getting up: `NeverStuck`, a held controller is always released). Broken variants (Kindle without the settled gate; Advance waiting on the ember; no fairness on StoodUp) fail `Safe` / `EndsOnce` / `NeverStuck`.

## Hooks

`state().opening.finale` = `{ phase, t, kits, card, snow }`; dev `__gameHooks.finale()` (settle the Keeping + put the ember in the cradle).

## Homecoming handover correction (Fern, Nov 2)

The main path catches the runaway page and returns to the well without freeing
all four optional creatures. Requiring five lit lanterns for the onward trail
therefore strands the main path in an idle plaza. Returning the page is enough
to reveal the next story step; the full bucket remains the separate reward for
bringing every creature home.

Start the existing well-to-ember mote stream as soon as the page is pinned.
Keep the reveal pending while the fox is away, and play it once when the fox enters the
well's 9 m plaza and pauses. The camera must never travel from a remote region to
the well. The shot keeps its accepted timings and movement interruption.
Carry/near-ember fade and the actual finale's settled-Keeping + placed-ember
requirements remain intact. Verify page-only homecoming (zero optional frees),
remote pin then return, and the prior full-well case with rendered screenshots
and window.__game. Explicitly distinguish staged hooks from natural traversal.

Keep the natural page-only handover regression in
`tools/page-only-handover-probe.mjs`: run the shared slice from its initial wake
position, save beat screenshots and all 100 final-hold frames with
`window.__game`, and fail if the page-only trail/reveal or return to follow
regresses. Parse the documented `camera.boom` shot diagnostic rather than
assuming a numeric `camera.shot` field. This is an offline visual/state check,
not a realtime feel or audio verdict.

## Sell the ending on screen (Cedar, swarm5 fix 3)

Kit's review of b4fa63a: after *Let the year turn* the clip shows ~60 s of a tiny fox by a fire, kits standing
inside the hero (reads as duplicate/glitch foxes, `frames/end-245.jpg`), and no title — the card and captions are
DOM, so canvas recordings never contain them.

- **Words live in the canvas.** Captions and the end card draw into one camera-fixed lettering plane (CanvasTexture,
  redrawn only when the text changes; the hot step only sets opacity). Every capture path, screenshot or
  MediaRecorder, sees exactly what the player sees. No DOM text remains (one path).
- **The card is big.** Title *Russet Vale* fills ~45% of the frame width in the upper third (over sky/Crown), the
  subtitle *and the year turned* under it.
- **The rest shot is composed on the family, not the cradle.** Framed on the midpoint of hero and cradle from the
  approach side, close and low enough that hero + kits read as a group (hero ≥ ~110 px tall at 720p), Press and
  Crown behind. It holds — drifting slowly — until the player moves (no snap back to the follow lens behind a
  resting fox).
- **Kits never stand inside the hero.** Kits are visibly younger (smaller). Curl spots are picked from a ring of
  slots round the cradle, farthest from the hero and from each other. A curled kit the hero walks into (< 0.9 m)
  hops up and trots to a free slot (a new `Disturb` step in `tla/Finale.tla`; card liveness re-checked).
- Measure: min hero↔kit distance over the rest hold (target ≥ 0.8 m); hero on-screen px in the card frame; card
  pixels present in a canvas readback.

### Subtitle contrast correction (Reed, swarm5)

The full-route native title frame on 417c558 shows cream subtitle letters crossing
both the bright open Album and dark timber. Depth testing is already disabled;
this is background contrast, not geometry occlusion. Give only the end-card
subtitle a restrained warm-dark outline (rounded joins, drawn before cream fill),
so every letter remains continuous across either background. Keep the family
composition and title size. Verify on rendered title frames with runtime state,
then review the shot again after the change.
