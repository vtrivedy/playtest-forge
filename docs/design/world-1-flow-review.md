# World 1 flow review — sprint 2 / levels-sol

**Verdict: FAIL for an uninterrupted realm clear; NEEDS REVISION for level flow.**

Baseline: main `3dbcaf5`, NVIDIA A10, WebGL2, 1920×1080 / 60 fps. Evidence at `/workspace/siyu/playtest-forge-artifacts/sprint2/levels-sol/baseline/`: `route-unassisted.mp4`, per-second state in `route-unassisted.json`, `report.json` (includes `window.__game`), and inspected PNGs. The baseline natural route reaches the Marsh Mouth and stalls at waypoint 7 `(64.5,0.3,31.4)`, with **7 deaths, 0 assists**. It stops after approximately 16 simulated seconds. This is a failed traversal test, not evidence that every human must fail there.

All baseline PNGs were opened, including matching staged pre/post restoration vistas. Later zone stills are **staged**, not proof those zones were reached naturally. Additional independent movement segments from mills, Kiln, canopy and arena are being retained under `levels-sol/flow/`; their results follow below when inspected. Main is changing during the sprint, so each run's SHA matters.

## What works in the observed frames

The hill's lone maple and domed ruin hold the skyline. The world has an autumn photograph value key, the distant islets dissolve into warm paper haze, and permanent restoration gives the canopy a clear rust/red payoff. At the marsh, the fox is readable against the darker path and the stone tops are distinguishable from ink. There is a coherent place here.

Against Ori, the nearby surfaces and effects still compete for the same space: the staged hero frame is mostly a hearth rim and a large translucent light cylinder, with the fox partly hidden. Against BotW, a good landmark is present but the early route does not show the player why its systems matter. An outward silhouette should imply an action, not merely another scenic ruin.

## Pacing, minute by minute

The table is a **design-target audit**, not an invented timed first-clear playtest. Actual uninterrupted evidence ends in minute zero; later pacing is assessed from staged views, the authored route and live segment captures.

| Minute | Intended experience | Current evidence / failure | Correction |
|---|---|---|---|
| 0–1 | Wake leaves; discover a heat lift; choose mills or water | Natural bot follows portal → marsh, bypassing H-a. Repeated failure at first crossing before any shrine or column ride | Place the teaching lift on the strongest paved sightline; repair crossing and validate both supply durations |
| 1–2 | Apply dash as a longer brush; windmill stairs reward height | Western terraces have a strong multi-level silhouette, but the route first diverts east and later returns west across open meadow | Make west the suggested first route without blocking east; trim duplicated neutral travel |
| 2–3 | Kiln: color survives a Shade when freshly dashed; heat fills a bowl | A genuine heat inlet and Shade exist. This is the first promising interaction, but arrival is a precise glide from the top terrace | Keep broad catch shelves; expose bowl above the column and stream leaves toward the onward wind |
| 3–4 | Permanent wind offers a meaningful fork | Wind river is implemented. The authored bot instead glides down toward Amberwood floor and tours the whole valley | Author the permanent wind route as an actual tested hill alternative; show the forest secret from that height |
| 4–5 | Water spill teaches a moving front; aqueduct presents shrine source and destination together | The baseline march stops at SW2's bowl to wait, while its source probes are up on the falls. The route no longer expresses the implemented water puzzle | Route via pier / HP / falls, retain a real water-front solve and a return path |
| 5–6 | Growth changes the shape of the forest, then opens a hill route | Baseline main has no growth module; SW3 is the older canopy climb and no growth-fed inlet. A newer main is incorporating Creek Root | Review the new Creek Root in its own run; do not claim the hollow maple shrine is solved by that alone |
| 6–7 | Hill approach reflects which shrine the player chose | Baseline root bridge opens on SW3; mills wind is the other candidate. The auto route still visits all three shrine locations | Verify hill entries after exactly one latch each; remove all-three hints from HUD |
| 7–8 | A calm climb with a short combined-element test | Summit still fires flood by proximity within 5.2 m; no combined puzzle payoff | Root lifts lintel, heat reaches basin for 2 s; show this cause/effect before the last climb |
| 8–10 | Valley breathes; optional return exploration uses the new routes | Staged matched vista has a visible warm canopy payoff. This does not prove an earned flood or return exploration | Capture a real flood solve, then revisit a previously cold route without forced restoration |

The principal pacing problem is not too little terrain. It is **travel before understanding, followed by a route that asks to visit systems without performing their solves**.

## Forks: why go there?

| Fork | Existing visual pull | Missing reason / consequence | Spatial fix |
|---|---|---|---|
| Arrival west / east | Mills' sails versus lit marsh structure | No heat lesson before choosing, and no contrast in how each route will move the fox | First lift frames both; west promises height/wind, east promises a washed crossing |
| Kiln onward / forest below | Canopy under the player, hill above | Downward glide is obvious; the permanent wind's purpose is weaker | Leaf stream ends on a clearly lit hill landing; one narrow offshoot reveals the islet shrine |
| Marsh channel / aqueduct | Vertical water landmark | Glowing geometry can read as decorative, and the route targets the bowl rather than source | An uninterrupted flume visually joins source and bowl; put the pier stair on the arrival-facing side |
| Forest floor / canopy | Tall trees and high shrine | Canopy climb currently rewards repetition of jumps; root transformation is absent in baseline | Hollow trunk opening and curved root preview should make the changing route visible from ground |
| Summit / back cliff | Lone maple dominates; distant islands imply more | Summit proximity ends the game without testing anything learned | Combined-element summit puzzle; separate optional Crown route leaves through the west arch |

Do not mark these with floating pickups. Use a moving leaf stream, a single audible bell, a gap through the trunk, and the view of a new landing.

## System interactions: shipped versus opportunity

- **Heat + wind:** both alter a glide, but the authored route does not chain the Kiln column into its return wind. Make the handoff overlap and land on a visible shelf, with a low catch. This combines independent forces; it needs no conduction graph.
- **Water + Shade:** severing flow is implemented. A patrol should cross the visible flume where the player can see a water tail continue downstream. A disappearing whole river would teach a different rule. Capture the before/after front, then a dash release.
- **Growth + heat:** the summit's proposed root lifts a lintel that blocks a column. This is the strongest missing combination: both outputs physically explain the result. Retained support must not count as an active inlet.
- **Wind + water:** a wind-assisted glide could reach the upper falls from another zone, providing a second route to the same source. Do not make wind magically melt water; keep the established color probes as the cause.
- **Growth + water:** grown pads can alter the safe approach to a water source, while water clears ink under a permanent bridge. Their spatial effects are complementary; automatic root watering is outside the shared rules.
- **Shade / blight:** Shade drain exists; spreading blight is deferred. Do not describe an unshipped blight heart as live gameplay. A fresh stroke survives drain; a permanent restore cannot be erased.

## Five highest-payoff changes

Concrete tasks were appended to `/workspace/siyu/playtest-forge-artifacts/sprint2/briefs/levels.md` under **SOL FLOW REVIEW** at 13:17 ET, with coordinates and acceptance checks:

1. Repair the Marsh Mouth crossing; verify three zero-death real crossings against water/ink/collision state.
2. Teach heat in the first 30 seconds before the suggested west/east fork.
3. Replace the SW2 route with pier → lift → falls → arriving water → seal, without forced latch.
4. Complete a growth-fed shrine route and test a second independent hill approach.
5. Replace summit proximity win with root + heat feeding the basin.

## Scope / feel gate

No controller values, animation clips or renderer settings were changed for this review. The retained failure is actionable, but it is not a feel approval. **Game feel: NOT ASSESSED as a complete milestone; first traversal: FAIL.** The fox is moving in the route video; pose/foot planting still needs the dedicated gait critic's comparison. World expansion should not hide these blockers under more scenery.

## Segmented follow-up, captured from later main

The first segmented run was interrupted by Modal after completing the mill segment. Its checkout was `d836741` (the retry moved again; do not call this the original baseline). Retained mill video/state: `levels-sol/flow/flow-mills-staged-start.*`. Starting at `cp-mills`, real movement advances to waypoint 44 `(-95,22,0.4)` with **zero deaths and zero assists**, then stalls with feet at y18. The inspected frame shows the fox below a stair/rock overhang, visible only through the occlusion cutout. This is a second concrete blocker: the terrace transition's collision/route does not match the intended stair ascent. It is not evidence that the eventual wind-gap challenge was attempted. The Kiln segment is incomplete and is not counted as a verified traversal.

## Completed four-region GPU follow-up — main 5a75be0

Run `5a75be0299993b204d9868035f3d09f42b1c79c7-flow-20261030-140442-fefdab7352`, A10G / 1080p60. All regional video traces and PNGs retained in `levels-sol/flow-v4/`; every saved scene frame inspected via the labeled contact sheet, with original blocker frames available. Starts are explicitly staged, subsequent movement is unassisted. Total capture 540 s wall time; that is rendering time, not player pacing.

| Segment | Actual simulated result | Verdict |
|---|---|---|
| Mills, from cp-mills | 12.03 s; waypoint 36 `(-75.3,14,28.7)` stalls with feet y11.53; 0 deaths/assists | FAIL: stair is still a blocker on updated locomotion, at an earlier transition than the older run |
| Kiln, from SW1 | 15 s; SW1 latches from heat; fox glides onward toward Amberwood, reaches waypoint 53; 0 deaths/assists | APPROVED only for the heat-fed latch / departure segment; not proof of natural arrival from mills |
| Canopy, from cp-amber | 12.85 s; waypoint 55 `(5.9,0,-7.4)` stalls with feet y−3.38 in creek gorge; 0 deaths/assists | FAIL: pre-growth route treats the gorge as ground and does not solve the knot |
| Hill, from cp-arena | 13.72 s; full switchback route reaches Wellspring and triggers flood; 0 deaths/assists, all 3 Seedwells unlit | APPROVED for traversal; FAIL for progression meaning: a staged arena start can still win by proximity, without the proposed combined-element solve |

Concrete visual failures: the canopy trace puts the lens into the trunk/leaf geometry while the bot waits in the gorge; the Kiln departure end frame is occluded by foreground leaves; at the hill's last stair the fox is elongated up the slope, requiring the locomotion stream's landing/slope review. The summit staged-start completion is deliberately not called a full realm clear. Its clean 14-second ascent is useful evidence that the final hill geography can carry a real puzzle once the proximity win is removed.

These findings strengthen the same priority order: repair authored traversal and update the bot to perform the new element solves before expanding the object count. Growth itself now ships on later main, but an old route walking into its gorge is not a growth playtest.

## Full-route retest — main a863109, 15:33 capture

Evidence `levels-sol/route-main-1533/route-unassisted.*` + inspected contact sheet and route-end.png. The updated route correctly goes from the meadow into the western teaching path, rather than sending the first minute to the marsh. It now reaches waypoint19 of73 after32.5s, with zero deaths/assists. It still stalls at `(-75.8,14,28.2)`, actual feet `(-75.82,11.68,28.74)`. The end frame shows the fox braced into the stair's upper masonry, below the y14 shelf. This is the same class of collision/route seam identified in the staged mill run; the natural first minute now proves it is a critical-path blocker. No later-region/full-clear claim from this run. The extreme lowered head in the stopped frame also needs the locomotion critic's slope/brace review.
