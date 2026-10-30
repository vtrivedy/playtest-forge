# Marsh Mouth repair and first-minute heat route

Design before code. Audit against current `water.ts`, `russetvale.ts`, `main.ts`, and SOL FLOW REVIEW13:17. This document distinguishes observed failure from proposed repairs. No movement tuning is needed.

## Evidence: failure is not just ignition delay

Retained baseline: `/workspace/siyu/playtest-forge-artifacts/sprint2/levels-sol/baseline/route-unassisted.json` and inspected `route-unassisted-00600.png`.

| Video frame | Fox position / route | Water | Deaths |
|---|---|---|---|
|540| (54.073,0.895,39.732), idx6 |cold /0 m wet|0|
|600| (52.336,1.010,41.707), idx7 |heat1 /1.25 m wet|1|
|660| (51.919,1.032,42.060), idx7 |heat1 /6 m wet|2|
|780| (51.451,1.054,42.457), idx7 |heat1 /6 m wet|4|
|840| (56.964,−1.237,37.785), idx7 |heat1 /6 m wet|4|
|960| (55.591,0.779,38.949), idx7 |guttering /0 m wet|6|

The water was fully flowing during repeated failures. The route advanced past source waypoint before death, but retries retained idx7 (far waypoint64.5,31.4). From the respawn/checkpoint approach, the bot then cuts directly toward the far bank instead of returning to the near boardwalk/source. Frame840 is south of the source, outside the washed channel; the fox is already falling into marsh ink. The inspected frame600 shows the near boardwalk and stone spout, not a completed crossing. A one-second trace cannot identify the exact first hazardous simulation tick; do not claim this audit alone proves its cause.

## Geometry / hazard audit

- Source=(57,36), hanging water y3.5→0; probes at lip and foot y0.6. Water needs full heat1 after0.6 s supply to flow. The front travels8 m/s down the≈6 m strip, so full arrival needs≈0.75 s after flow starts.
- Strip ends at(62.034,32.736), width2.2. Bed collider top−0.05, bottom−0.4, permanently solid. The near boardwalk runs(55.2,37.5)→(57,36), top0.3,width2.0. Far boardwalk runs strip end→(66,30.5), same top/width. The0.35 m rises are inside STEP_UP0.6.
- The nominal authored line(57,36.3)→(64.5,31.4) is only≈0.25 m off the water centre near its far end, so these two nominal points are not themselves grossly misaligned. Early waypoint acceptance (radius0.9), shortcut steering and retry-state retention matter.
- `crossingAt` finds nearest quarter-metre sample and returns wet/cold only inside radius`width*0.48=1.056`. Actual bed half-width1.1 is slightly larger. These circular sample tests also shrink near strip ends. Thus a thin solid edge can be classified neither washed nor cold.
- Realm hazard: `waterInkAt && feetY<0.2` **or** `!waterWashedAt && marshE<0.9 && feetY<−1.30` (MARSH.ink−1.45+0.15). A cold bed at−0.05 triggers the first condition; a fully wet bed is safe. Being outside the wash mask while falling below−1.30 triggers ordinary marsh ink. Near boardwalk top0.3 stays above the cold-channel threshold.
- Baseline y positions are fox roots, while hazard uses feetY; retain both fields in the next timeline rather than comparing them as identical.

## Minimal repairs, in priority order

1. **Explicit near-bank ready point and centreline waypoints.** After checkpoint(54,40), approach(55.2,37.5) → (57,36.3), label the latter `water-ready:marsh-mouth`. Hold on the stable plank until `water.arriving('marsh-mouth')` is true; this tests the real source/front, not a fixed timer and not a forced latch. Then follow(58,35.3516) → (60,34.0548) → (62.034,32.736) → (64.5,31.4). All are centreline points except the safe plank point. Restrict acceptance radius to0.3 m for these labelled crossing points; otherwise a0.9 m early turn consumes nearly all the1.056 m wash half-width. This is harness steering precision, not a change to player controls.
2. **Reset retry intent after death.** If this crossing fails, restart its route at the safe approach checkpoint/source, or stop the segment and report failure. Never continue steering at the far-bank waypoint from a respawn behind the source. Captures must reset both position and route index between trials. This is essential even if collision is otherwise correct.
3. **One shared strip footprint for wet/cold query.** Replace nearest-sample circular ownership with closest-point projection onto each consecutive path segment, clamped to that segment, using half the actual bed width (`width/2`) and endpoint caps. Wet state still comes from the closest water sample / parcel distance; no global wash flag. Match visual/collider endpoints with a small≤0.15 m ownership overlap if required. The same footprint determines both `inkAt` and `washedAt`, ensuring no cold safe edge. Do not raise the hazard threshold or disable the surrounding marsh to hide an off-path fall.
4. **Small transition aprons only if keyboard trials still expose a seam.** Widen the incoming/far boardwalks2.0→2.6 m for their last/first1.2 m and overlap their ends0.35 m into the stone strip. Keep boardwalk tops0.3, bed−0.05; no stair or movement retuning. A widened permanent apron must not span the full six-metre teaching gap.

The water timing is intentional: a cold sprint may outrun the melt/front. An aura trial means brush the source, pause on the near plank to watch the front, then walk/run across. A dash trial means dash **through the source while still on the near approach**, brake on the plank, wait for the front, then cross. A dash that immediately carries the fox onto cold water should not receive artificial immunity.

## Verification / acceptance

- First trial from(54,40): cold frame, brief aura ignition, wait for front, real keyboard crossing to(64.5,31.4), zero deaths and no assists. Repeat three times with fresh cold state.
- Repeat three fresh trials with a dash stroke; record source supply, heat/state, front head/tail, crossing wet result, feetY and deaths at≥10 Hz. Do not restore the water or teleport mid-crossing.
- Stop supplying and retain flowing→holding→guttering/refreezing frames. Water already downstream runs out physically. Verify cold strip still hazards and active strip does not.
- Deliberately miss the strip once: recovery/retry returns to near-bank ready point and does not cut across open ink to the far bank.
- Inspect each retained image; compare visible water extent against the queried safe footprint. Fresh-player comprehension remains unassessed.

## First-minute H-a: teach the shipped hearth

The brief's(−14,66) is the canonical design location, but the shipped actor is(5.6,74.2), base=`groundRaw(5.6,74.2)`, column9 m. Its shelf is centred(13,75.5), width/depth9, top=`groundRaw(13,75.5)+5`, yaw0.12. **Route to the actual actor first**, rather than move the actor and invalidate its already tuned shelf/capture arrangement.

Proposed opening route / paving:

```text
portal(0,90) → (0,82) → (3.8,78)
 → launch(5.6,76.1) [aura ignites H-a; jump + hold]
 → column centre(5.6,74.2) [rise while held]
 → shelf west landing(9.6,75.5, shelfTop) → shelf centre(13,75.5)
 → glide east to safe meadow(22,76)
 → ground fork(25,66): west mills / east glass waterfall
```

Use real input stages for the rise: approach outside the brazier's0.82 m solid radius; jump/hold into column; stay near centre until feet≥shelfTop+0.8; steer east to landing while still holding. Do not use a route waypoint whose unqualified `act:'glide'` immediately flies toward the shelf before gaining height. The source-to-shelf-edge distance≈3 m is intentionally an updraft exit, not a ground step. Record ignition, column entry, peak feet, tPlus7 and shelf landing using `lastRide`; the first30 s must contain ignition and held-jump ascent.

Ground bypass: skirt the shelf on its south side through(4,82)→(13,82)→(22,80)→(25,66); no wall blocks the rest of the realm if a player declines the toy. The raised route earns a vista and glide shortcut rather than an arbitrary gate. Adjust only local paving / leaf density to pull the camera past the hearth and keep the shelf landing clear. At the shelf viewpoint retain a wide frame showing west mill silhouettes and east aqueduct/glass waterfall. Do not promise their visibility until the GPU image is inspected.

**Acceptance:** opening keyboard video≤30 s with H-a ignition, held rise and stable shelf landing; `window.__game` ride metrics; second run on ground bypass without damage; one shelf vista image actually containing both destinations. If exact target(−14,66) is later required, relocate the whole teach arrangement together in a separate measured pass.
