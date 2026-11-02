# Expanded-world camera and sprite visibility — Fern

Camera/VFX regression verdict: **APPROVED for the recorded routes**. Runtime camera default1.8m (`b24abc5`); shared updraft appearance `8292211`; final integrated verification `7ea02f2` includes keeping-d2 `75d09eb` and Bramble's bank-height bridge/dressing `42af413`. Whole-game gait/fun is not certified here.

## Outcome

The expanded map exposed tail cropping that the ruin-only1.5m clearance test missed. Keep1.8m opening clearance; normal2.45m follow boom and controller are unchanged. Continue using cff7a25's swept gradual release from elevated escape poses. The complete western route now reaches and paints the lookout with no timeout skips, and the final original chase and ending still complete.

The camera's distance/pitch gate alone was insufficient: the skinned tail left the image in6 of30 matching27–29s frames beside the wheel. Compare the same interval using the existing GUI override:

| Clearance | Skinned-body frames inside2% margin | Maximum NDC y |
|---|---:|---:|
|1.5m|24/30|1.233 (outside view)|
|1.8m|30/30|0.786|
|2.0m|30/30|0.595|

Keep1.8m: it gives the whole raised tail room while retaining a larger fox in tight views. The initial1.5m diagnostic was stopped once the failure was proven; its checkpoint is marked incomplete and is not an accepted full run.

The original bridge targets also cut the side rails. Aligning the bot exposed an actual0.56m deck-entry step. Bramble supplied the6m bank-height arched bridge with per-plank walk boxes. The route uses precise centerline waypoints, without timeout skips. `--expect-beat` now makes missing route completion an explicit failure.

## Played proof

All clips below are offline480×270,15fps timeline and silent. They prove the stated motion/framing segments, not realtime performance or audio quality. Initial placement is staged once; later travel is controller input. Captures retain `window.__game`, full traces, source SHA, stills and camera checks.

| Evidence | Result |
|---|---|
|`/captures/fern/millbrook-final-motion/`,60e4a2c|70s full western route; explicit complete beat;510 consecutive26–60s body frames pass2% margin;0JS errors|
|`/captures/fern/millbrook-plume-retest/`,d0a3ee3|70s full route after shader fix and integration;120 consecutive29–37s frames pass;0JS/console errors|
|`/captures/fern/final-room18-success/`,7ea02f2|90s original chase:3catches/0skips, fox returns to well, homecoming.pinned=true;0JS/console errors|
|`/captures/fern/room18-ruin-miss/`,b24abc5|90s intentional miss:2catches retained,30/30 body frames pass; minimum chest1.909m, pitch43.01°, peak11.86m/s;0JS errors|
|`/captures/fern/final-room18-finale/`,7ea02f2|All7 staged crag/Press/card/return legs complete;45 continuous handoff frames;0JS/console errors|

Western route: lane → mill → dash leaf dam → water/wheel/paint → kiln lit → ride warm air → Weir reached → bridge → orchard → lookout painted. Final state confirms every system; no debug burst/restore and no mid-route teleport. Full-route camera minimum chest1.844m, max pitch39.81°, peak lens speed12.02m/s. All510 source frames were inspected via adjacent-frame sheets: body, ears and tail remain in view; camera releases continuously after Weir landing and follows the bridge without entering the fox. Near world geometry fades as designed.

Final original success late camera:1.929m/24.66°/12.01m/s. Jump remains .750m apex/.300s to apex/.633s air at30Hz;4dashes. This is page/home traversal, not a claim that every freed creature is home or the well is full. The earlier intentional-miss check uses the same1.8m clearance and unchanged solver; later shader/caption/bridge additions did not change that solver.

Finale staging explicitly dev-releases the Keeping, picks up the ember with E, and places the fox on the far crag. Controller input thereafter. Crag camera minimum chest2.275m/max pitch41.35°/peak12.00m/s; handoff2.413m/19.57°/3.86m/s; return bank2.071m/28.64°/12.00m/s. The new45-frame handoff was inspected; no body clipping or abrupt hand-back. This is not an uninterrupted opening-to-ending progression proof.

## Visual review → fix → retest

Review of the510-frame camera pass exposed another problem: large foreground ember/leaf billboards repeatedly veiled the fox beside the kiln, although body bounds passed. The shared shader had unbounded perspective point size, and only leaves faded near the lens. Cap ember/leaf sizes at12/24pixels and fade both between0.8–2.6m lens depth. Positions, heat, lift, timers and colliders are unchanged.

The actual live shader was cloned into controlled96×96 GPU raster tests (`tools/updraft-sprite-probe.mjs`), not checked using source-text patterns. At1.5m, ember visible footprint32×32→6×6pixels, leaf94×50→21×12. At0.5m the old ember fills the96×96 test frame; the new sprite fades completely. Farther samples remain visible, preventing an accidentally blank shader from passing. Current6/6cases pass; the prior shader fails4/6. Evidence: `/captures/fern/updraft-sprites-v2/`, including comparison.png. No shader or console errors.

Retest all120 in-game hold/rise frames with bloom and overlapping particles: the face remains legible, foreground glare is reduced, and the warm riding column remains visible. All frames reviewed. Full route still completes with identical bounded camera metrics. The visibility workflow is encoded in `.claude/skills/updraft-sprite-visibility/SKILL.md`.

## Validation and reproduction

TypeScript, production build and `npm run lint:feel` pass, including asset/hot-path guards,28 terrain-lane checks and the30/60/120Hz camera release regression. The existing9-state CameraEnvelope model verifies publication ordering; neither it nor the raster test proves arbitrary geometry or whole-game beauty. Probe startup now uses`?manual=1` and collects console errors to catch shader failures.

```sh
node tools/camera-drop-probe.mjs OUT .07 70 5198 \
  --route-module tools/millbrook-camera-route.mjs --check-from 1 \
  --expect-beat 'complete Millbrook' --dt 0.03333333333333333 \
  --size 480x270 --check-camera --sparse-stills \
  --clip --clip-from 29 --clip-seconds 8 --check-silhouette
node tools/updraft-sprite-probe.mjs OUT --baseline-sha 60e4a2c
node tools/finale-camera-probe.mjs OUT --clip-handoff
```

Retained local copy: `playtest-output/fox-spirit/fern-expanded-camera/`. Main remains Kit-owned; normal branch push only.

## Feel critique —7ea02f2

Verdict: **NOT ASSESSED for the whole locomotion/fun milestone**. The bounded camera/VFX verdict above is approved.

| Item | Observation |
|---|---|
|Feet plant/gait cycles|Walking cycles visible; no controller or gait retune|
|Body/tail follow-through|Visible in close turn, glide and landing; whole silhouette retained|
|Jump anticipation/land squash|Not recertified; original jump metrics preserved, Weir landing inspected|
|Dash weight|Not independently recertified; original traversal still uses4dashes|
|Skating/rigidity|No new defect observed in retained segments; no global gait claim|
|Retained capture|510+120 western frames,45 finale handoff frames,stills and__game|

Next camera reviews: Kit's low Hearthtree bridge composition and Sorrel's Hermitage desk arrival angle, on a separately pinned integration. They are outside this landing's approval.
