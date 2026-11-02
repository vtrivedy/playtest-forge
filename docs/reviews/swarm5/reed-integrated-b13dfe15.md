# Combined-source production journey — b13dfe15

Immutable source `b13dfe15800b4c3a4d9e5f2f9b6e875651432216`, including the
canopy stem fade and discovery instruction-priority fix. Independent production
build on Tesla T4/EGL, 1280×720, native canvas VP8/Opus recording for 280 wall
seconds. One initial wake placement; authored input route thereafter, without
later teleports or forced story progression.

All eleven canonical journey checks pass, with zero JavaScript errors:
7,886 fixed 30 Hz ticks / 262.8667 simulation seconds. Native black-frame audit
passes: zero dark frames among 7,602 decoded frames; minimum frame mean luma
69.599. Full state from the shared game state function is retained in
`report.json` and extracted to local `game.json`.

Homecoming visual verdict remains FAIL. Reviewed arrival frames every second
from recording seconds 68–89, then every quarter second from 74–80.75. The
fox drops below the frame during the well reveal and remains hidden or cropped
in the sampled 75–80 second views. The roof dominates the lower foreground;
“Follow the warm light home” appears concurrently with “One page still holds
the autumn.” around 74–78 seconds. These samples substantiate the framing and
competing-text failures; they are not an every-frame motion audit. The tan
plaza and grey stacked slabs also retain the previously reported unfinished
appearance. No homecoming correction is included in this tested source.

Finale composition samples at snow +1 and +15 wall seconds preserve the whole
hero, separated curled kits, ember ring and readable title. This bounded still
review supports the existing finale composition verdict, not an audio or
continuous animation-quality approval. This authored route does not prove
unaided discovery or the original blind-wander overlook requirement.

Evidence volume:
`keeping-swarm5-captures/reed/boundary-baseline-b13dfe1580-190424-547be6/`.
Native footage, errors, state samples and black audit are retained there. Local
same directory under `/captures/reed/` additionally contains `game.json`,
`arrival-finale-sheet.jpg`, `arrival-quartersec.jpg` and extracted source stills.
No gameplay or capture code changed for this review. Use this same route for
the pending homecoming camera/caption/plaza candidate comparison.

## Independent blind seed 2 camera reproduction

An unchanged development replay on `d63f32a7` (runtime source identical to
`b13dfe15`) independently reproduces Hazel's separate foreground obstruction.
Command: `node tools/naive-explore.mjs --seconds 24 --seed 2 --frames 0.5`.
SwiftShader, 960×540, fixed 60 Hz simulation, twelve screenshots, no staged
start or progression changes. Zero JavaScript errors; one catch, two unsticks,
1.37 stuck seconds, no kept page or overlook visit. Full `window.__game` state
is retained inside `naive.json`.

Inspected `frames/f00009.jpg`, captured at 20 simulation seconds: a large opaque
diagonal terrain face fills most of the left image and crops the fox's body.
This verifies the visible failure independently; Hazel's separate ray inspection
identifies the intersected PlaneGeometry as terrain, rather than the registered
canopy stems. This replay does not independently identify that mesh, fix camera
clearance, or establish the duration of obstruction between two-second samples.
The earlier cue-route stem approval therefore does not cover this approach.

Artifacts: `keeping-swarm5-captures/reed/blind-b13-seed2-investigate/`, including
the sampled movie, all twelve frames and full state. The movie plays at four
times simulation speed and is not continuous motion evidence. A candidate
camera correction must replay this seed and preserve the existing discovery
landing/recovery checks; global terrain hiding is not a validated correction.
