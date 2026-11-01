# Fox Spirit — autumn feel prototype

See `docs/vision.md`. Refs: `assets/concept/fox-turnaround.jpg`, `world-keyart.jpg`.

## Core verb
Stalk through a sepia world leaving temporary autumn color; awaken the shrine so fall floods permanently.

## Hero look
Burnt-orange fox, cream chest, dark socks, ember-flame tail. Grounded / mysterious — not cute. Particles: embers + falling leaves.

## Controls
- WASD move (camera-relative)
- Space = jump (edge-triggered + coyote + buffer); release early = short hop (`jumpCut`)
- Hold Space while falling = glide
- Shift = dash

## Feel (preset `brisk`, `?feel=spring` to compare)
Chosen on Russetvale's real gaps — both presets clear the full route unassisted; brisk reads weightier
(spring's 1.05 s hang is floaty) and runs the route in 100 s vs 110 s.

| | brisk | game-design target |
|---|---|---|
| Full jump apex / running airtime | 1.85 m / 0.80 s | 1.8 m / 0.78 s |
| Running full jump | 7.2 m | 6 m (margin on authored gaps) |
| Jump + air-dash | 11.0 m | 10 m |
| Ground dash | 4.0 m | 4.0 m |
| Glide | 2.95 : 1 | 3 : 1 |

- Coyote 0.10 s, jump buffer 0.12 s, one-shot jump cut ×0.40, fall gravity ×1.5, apex hang ×0.75 while held
- Glide after 0.08 s hold while falling; eases from fast falls into the 2.7 m/s sink, then holds it
- Landing weight lives in the camera (dip + FOV kick scaled by fall speed), never mesh scaling
- Dash: FOV punch +5°, light trauma shake. Ember pickup: 45 ms hit-stop. Seedwell/flood: shake + two-shot

## Animation state
Airborne `dash` wins → `glide` → `jump_up` (vy > 2.2) / `jump_apex` / `jump_fall` (vy < −1.6).
Walking off a ledge keeps the stride through the coyote window. `land` plays 0.10–0.38 s on contact
(scaled by impact; cut short when running on). `run` playback = ground speed / 8.4 m/s (0.55–1.45×).

## Camera
Traversal rig (critically damped spring) is separate from the rendered pose (dip, shake, FOV, cinematic).
- 4.6 m / 1.75 m on the ground → 5.4 m in sustained air → 6.4 m gliding; FOV 54 (+3 run, +7 glide)
- Vertical: locked to last ground, follows 45 % of a jump; tracks drops and glides
- Look-ahead 1.6 m along velocity (damped). Auto-recentre 1.25 rad/s behind the heading after 1.2 s
  without drag-orbit; never while running at the lens. 3/4 framing bias (0.22 rad) is lens-only —
  input reads the unbiased yaw (biasing it made forward-hold spiral)
- Airborne: aim slides toward the predicted landing (same ballistic/glide model); drops raise + tilt
- Boom vs walkable surfaces: lift over slopes, pull in at walls (fast in / slow out), lens floor clamp
- Hard framing guard keeps the fox inside a safe angular window
- Shots (seedwell, flood): pose solved once, look tracks subjects, bow out if the fox leaves frame or jumps
- Occlusion: screen-space Bayer cutout around the fox on every world material, only while the
  sight line is blocked (collision march + canopy ray)

## Post
Grain 0.015, shadows only (fades through mid-tones so haze stays clean), elliptical hole on the hero.
FX toggle writes `post.params.bloomStrength` (the stack re-applies params each frame).

## Win
Activate the shrine. Gems optional path juice.

## Verify
- `node tools/feel-capture.mjs --mode framing|presets|honest|moments|shots|video` → playtest-output/fox-spirit/feel/
  (manual 60 Hz clock; every output labelled UNASSISTED or STAGED)
- `npm run playtest` → playtest-output/fox-spirit/ (`metrics.json` splits unassisted vs staged)

## Audio — procedural autumn pass
One WebAudio graph in `src/audio/`: lazy user-gesture unlock, smoothed master volume,
M mute, visibility suspension, bounded transient voices and seeded noise. No asset requests.
Pressed ambience is thin wind and hollow low fifths. Permanent ColorField wavefronts
near the fox crossfade over seconds into warmer wind, leaf rustles, sparse bird/cricket
calls and a quiet suspended autumn pad. Ignore the fox's own aura (otherwise it would
always sound restored). Glide air follows movement state; leaf/stone steps follow
collider surface and speed. Landing uses impact, pickups rise gently within a streak.
Restoration has one rumble/crackle/chord envelope; existing `play('shrine')` + `swell()`
coalesce into one cue. Settings are available in the existing tuning panel.
Verification: shared synthesis functions rendered through browser OfflineAudioContext
into review WAVs, keyboard traversal, mute/unlock checks, staged restoration, screenshots,
`window.__game` and audio diagnostics. Do not change movement, camera or visual tuning.

## Sprint 2 authored locomotion (LOCO-SOL)

> Current locomotion design: [`DESIGN-loco-clips.md`](DESIGN-loco-clips.md) (sprint 5 clip-driven blend tree + foot IK). Sections below are history.
Existing hero geometry/materials remain the baseline. Blender-baked walk/trot/rotary gallop clips provide the primary pose; AnimationMixer blends by speed with stride-matched playback. Grounded contact correction and damped tail/torso overlays provide terrain and momentum response. Turn, skid, jump/air/land remain authored states. Expose blend speeds, stride scale, plant correction, turn lean and spring damping in the existing debug GUI and publish contact/state metrics through the game hooks. Verify on the remote GPU gait gym before comparison; this branch stays isolated pending driver selection.

## Sprint 2 gait review gym
`?gym=gait` places the live fox/controller on an uncluttered measured course away
from Russetvale: flat runway, 15-degree ascent, crest, descent. Same lighting,
materials, animation and physics as gameplay. A harness-only world-space analog
stick (magnitude 0..1) exercises walk/trot/gallop without changing feel parameters.
The GPU harness records deterministic idle, speed bands, tight turns, hard stop,
jump/landing and slopes; a quarter-speed segment uses smaller simulation steps,
not duplicated frames. Side tracking keeps paws large enough to judge contact.
1080p60 MP4, labelled pose contact sheet, per-frame state and __game snapshots
are the evidence. Staged resets are explicitly recorded; route remains unassisted.

## Sprint 2 Shade encounter
The Keeping caught a woodland animal mid-stride. Its enlarged, vertically drawn
Quaternius CC0 antlered stag silhouette floats in a warm ink wash, wavering without a walk
cycle. SW1's authored loop is the first playable encounter. A 3 m drain suppresses
weak temporary supply; fresh dash strokes and permanent restoration still win.
Contact costs one of three wisps, grants one second of grace and pushes the fox
3 m over a short eased impulse, through the existing wall checks. Dash through
the silhouette to free it permanently: ink breaks into falling leaves whose
sepia warms to copper and russet. No explosion, score pickup or respawn. The dash
passes through with no knockback; its post-dash skid (≤ 0.2 s, still > 1.25× run
speed) also counts, and a dash cancels any knockback still in flight. Each Shade
frees exactly once (`tools/tests/shade-dash.ts`).

Expose patrol speed (2.2 m/s), bob (0.3 m), hit/drain radii, release timing,
knockback distance and invulnerability in lil-gui. Debug spline and drain off by
default. Publish actors, wisps, hits, frees and impulse travel on __game.shades.
GPU review must retain patrol, contact/grace, and a real dash-through release,
including drain/strong-stroke assertions, then receive an Opus critique and retest.
### Independent contact evidence for the matched locomotion review
Capture actual paw-bone world positions after the solver, independently of either
stream's target/anchor telemetry. Calibrate each paw's standing ground clearance
from the initial idle, then report horizontal speed during low, grounded contact
and height error against the collision surface. Keep requested target vs actual
paw errors separate. These are bone landmarks, not claimed toe-mesh measurements.
The review must disclose that limitation and exclude staged teleport transitions.

### Encounter review
The explicit `shade` GPU shot stages the fox near the first live Shade, then records
patrol, real contact/knockback and a real dash through it. Resets are labelled staged;
no health or freed flags are forced. Preserve per-second __game/state and key frames.

Driver 12:05 correction: use the licensed antlered stag with long legs and an
authored lowered-head pose over mid-stride legs. The creature is drifting ink,
with a dark ground wash that communicates its 3 m drain. Smaller maple leaves
warm within 0.8 s, settle as colored litter, and fade after a quiet hold.

### Real-fox comparison edit
A separate three-panel review edit pairs the two game candidates with documented
walk/trot/run/pounce excerpts. Crop only for readability and label all playback
changes. Wildlife source playback is uncalibrated and not phase-aligned; use it for
anatomy, support, gathering and head/tail behavior, never numeric biological timing.

## Sprint 2 Water — implementation contract
Marsh Mouth (57,36) teaches color → melt → moving front → washed crossing. The amber spill melts in 0.6 s, holds 3 s after supply, then refreezes for 2 s with no new output. Water travels at 8 m/s; both its leading front and trailing end move along the channel. Only wet sections suppress ink and reveal the stone bed. The waterfall at (100,18) has probes at y10–15 and feeds a 32 m flume; only arriving water feeds SW2 for 7 s. Shade drains sever downstream flow, and restored sources stay on. All timings and speed live in the Water GUI and telemetry. No movement changes.

Verification: GPU water shot retains frozen/melt/front/wash/refreeze stills and video, captures __game, and checks front/tail timing and SW2 inlet. Review visuals, apply critique, rerun.

Water review corrections (12:15 ET): the crossing has a permanent shallow stone bed; flowing water removes the ink hazard, never the supporting ground. A local ink skin covers the dry channel. The final 0.8 s of hold warns that the wash is ending. Driver 12:05 changes the frozen look to pale translucent ice with warm inner light. Water already past a Shade drains away at 8 m/s; the Shade cannot erase it instantly. Flume beds and water are batched. No controller/animation edits.

### Authored fox action refinement — 13:15
Jump poses must show an anatomical hind push, all-four gathered paws at apex, then forepaw reach before landing. Author each action on the current hero armature with sagittal IK, preserving bone scale; show loading immediately and launch after50ms for grounded jumps; coyote jumps launch immediately. Dash receives a distinct low extended pose, and the tail plume keeps a visible air gap above the floor. Verify every frame and compare independent bone measurements against planted-only metrics; low planted residual alone does not prove natural swing.
Stag lookdev r2: a solid sepia-ink core with a thin translucent, wavering back-face
wash. Only the fringe is translucent; masonry must not show through the torso.
Capture uses one fixed exterior lens per moment and renders the late lifecycle
after advancing the simulation so empty-state stills match their diagnostics.

Water completion slice: S1 pond-grotto falls at (−30,62) uses the same reactor and opens its frozen sheet collider only while flowing. The grotto floor remains solid; the fox can relight from either side. Full flood restores all water. A slow authored flume Shade patrol uses the existing encounters public drain predicate; water already past it runs out normally. Original procedural assets only (CREDITS.md).
### Fox pass 7 — 2026-10-30 13:20 ET
Preserve the published quadruped rig and locomotion ownership. Refine the existing CC0 scaffold toward the concept: reduce ear height, retain a continuous soft brush through the tail tip, reduce detached flame cards, and strengthen coherent saddle/chest values. Keep the reference scene cameras and lights fixed. Verify with Modal concept comparisons, in-game close/chase frames and state logs; request cross-model critique before claiming the milestone. Use quick headless Blender exports because Blender MCP has no live connection; all renders remain remote.

Stag lookdev r3: the drain wash clips to nearby walkable ground instead of
floating beyond a cliff. Release consumes the silhouette from feet to antlers
with a broken watercolor edge, avoiding round holes across the torso. Contact
review starts outside the hit radius and walks into the real encounter.
### Regional route review
`--route-from N --route-to M` captures real traversal of a waypoint interval after
an explicit staged start on a validated walkable surface. It never forces element
latches/restoration or bypasses a failed move. Regional success means reaching M
with no assists/deaths, not winning the realm. The default full route remains an
unassisted restoration test. This lets level streams review later regions while
earlier crossings are under repair, without hiding those failures.

### Capture hero staging — 14:15 ET
The relocated arrival hearth occludes the old poseHero location in review stills.
Use the same collision-checked open meadow (6,78) and three-quarter lens as the
fox review shot, with the actual idle actor. Keep gameplay routes unchanged;
this is an explicitly staged character review, not traversal evidence.
Flume encounter placement correction: patrol along a narrow return loop sampled
from the real Reed Falls channel, preserving its authored height. A grounding
query may adjust feet only to a nearby surface, never to the valley floor below
an elevated aqueduct. Keep the brief's 2.2 m/s patrol speed.

Remaining encounters use authored loops on existing walkable shelves. Two hill
Shades occupy the first and final intact flights, leaving the broken gaps clear.
Restored-edge Shades remain dormant until their Seedwell latch, activate once,
and never respawn after release. Activation adds no new collection loop and does
not undo permanently restored chemistry. The unavailable SW3 hollow-floor/K1
geometry remains a level dependency; do not place a creature inside a solid trunk.

Placement review correction: return loops need enough width for the frozen
silhouette to drift through a turn. Increase the flume/stair return offset within
the existing channel/flight width; skinny hairpins caused a near-instant reversal.
Keep speed and encounter collision unchanged.
### World surface pass — 13:40
Keep all landmark transforms and collision unchanged. Reuse the library's CC0
ambientCG Rock035 and Poly Haven bark to give water masonry and timber readable,
world-scaled surfaces. Stone combines softened scan values with damp seams and
moss on upward faces; timber uses grain and dark joints. Preserve restoration
color, atmospheric values and the full-route harness. Review matched remote GPU
stills and water frames before landing; record concrete failures and retest.
### Landing support transfer — 13:35
At travel speed, hold the contact clip only for the first50ms, then resume authored strides. Carry the remaining absorption with a damped pelvis translation spring, driven by pre-contact vertical speed, so fixed feet do not trail behind a moving body for300ms. Stationary landings keep the full authored recovery. Expose squash and spring frequency; report spring displacement and planted residual separately. Graft only the landing impulse idea from b59448c; retain the selected movement controller.

### Rendered pad contact calibration — 14:05
Derive each pad from the actual core mesh vertices weighted at least65% to its paw bone. Average its lowest15mm band in bind pose, retain that point in paw-local space, and pin that point rather than the wrist/MTP landmark. Lower the visual rig by the mean pad offset so the forelegs remain reachable, then solve to pad-derived wrist targets while preserving paw rotation. Report the contact landmark explicitly. Keep independent capture joint telemetry and rendered-pad checks separate. No controller or fox-look changes.

### Brake intent pose — 14:10
Use input release/opposition and measured deceleration only to drive a restrained nose-up, rump-down brace. Do not graft the competing movement controller. A dedicated authored skid has forepaws ahead, hind feet beneath the rump, a quick load and a held recovery. Blend a small brake-load layer onto moving gaits so the animal braces before it has already stopped. Expose load amplitude and retain per-frame brake telemetry. Capture this as a separate pass after landing/pad contact.

## Listening Crown extension
Design: `docs/design/wellspring-summit.md`. From the Wellspring west arch, a permanent stair reaches a compact cliff ruin. Two existing hearth columns reach a heat-fed crown bowl. A two-second element inlet latches permanent heat and an inward wind route to the summit; dash-through Shade or strong stroke are both valid. No new inputs, ability, collectible, or World 1 gate. Safe stairs remain available. Tunable seal time, saved latch, and `__game.crown` state support GPU verification.

Stag lookdev r4: retain the opaque ink core, add sparse soft sepia wash wisps
rising from shoulders and flank. Deterministic shader billboards fade in/out and
curl slowly; no glow, additive sparks, or glass torso. Expose wash size/opacity.
They fade with the released silhouette; colored maple leaves remain the payoff.

### Water appearance follow-up
Animate the existing pond/creek water shaders from the realm tick (their time
uniform currently stays at zero). Add soft warm-sky Fresnel reflection to live
flume/fall surfaces, retaining wet/dry masks, front/tail timing, gates and colliders.
The marsh hazard stays dark ink, with restrained moving sky reflection. Verify
frozen/flowing/warning states and retain water acceptance telemetry on GPU.

### CC0 masonry dressing
Reuse Poly Haven's six-piece moss-rock scan as shallow, half-buried rubble at
existing masonry bases and along the grotto roof. Normalize the imported forms,
restyle through the shared stone palette, and batch into the existing world
buckets. Keep traversable edges and collider footprints unchanged; no random
scatter in route corridors. Review the grotto and meadow at gameplay distance.
### Milestone locomotion showcase
One clean20-second GPU-rendered720p clip: walk2s, trot2s, gallop3s, two turns2s, flat jump2s, slope ascent3s, jump/landing on the actual15-degree ascent2s, descent3s, stop1s. Staged resets between demonstrations are disclosed in JSON/README, with all movement generated by live controller input. Hide UI, keep per-frame state and slope-landing acceptance, retain stills. This is a demonstration, not a60-second free-play acceptance. Render only after pad and landing checks complete, then run the required critic.
### Capture blocker: empty foliage buckets — 14:20 ET
GPU levels502c57f and main476a6eb fail before window.__game boot with an
undefined geometry.index read in mergeGeometries called by NatureKit.build.
Standalone foliage extraction can leave a previously existing cell empty.
Skip empty buckets during build; also skip them when extracting standalone
foliage so an old empty cell cannot contribute undefined geometry. Actual
populated foliage and gameplay remain on the same path. Verify with GPU boot
and region stills before considering the startup regression repaired.
### Fox leg and fur follow-up — driver 14:10
After validating clear review cameras, broaden the forearm and upper rear-leg coat without moving rig joints. Replace the abrupt black sock boundary with a longer rust → umber → charcoal transition; preserve compact dark paws and the authored gait contract. Remove the cream nape stripe by restricting the chest blaze to forward-facing surfaces. Compare fixed concept cameras and both gameplay grades before claiming an improvement.

### Review-helper shot parity — 14:45 ET
Expose the landed flow, Crown, and showcase shots through the one-command
review helper. These use the same GPU harness and report verification already
used by direct Modal invocation; do not maintain a helper-only capture path.
Integrated boot repair: standalone tree extraction can leave an existing cell
with zero geometries. Skip empty cells in nature-kit build before calling Three's
mergeGeometries; its empty input dereferences the nonexistent first geometry.
This preserves all populated batches and is required for the integrated GPU run.
### Landing support transfer — 13:35
At travel speed, hold the contact clip only for the first50ms, then resume authored strides. Carry the remaining absorption with a damped pelvis translation spring, driven by pre-contact vertical speed, so fixed feet do not trail behind a moving body for300ms. Stationary landings keep the full authored recovery. Expose squash and spring frequency; report spring displacement and planted residual separately. Graft only the landing impulse idea from b59448c; retain the selected movement controller.

### Rendered pad contact calibration — 14:05
Derive each pad from the actual core mesh vertices weighted at least65% to its paw bone. Average its lowest15mm band in bind pose, retain that point in paw-local space, and pin that point rather than the wrist/MTP landmark. Lower the visual rig by the mean pad offset so the forelegs remain reachable, then solve to pad-derived wrist targets while preserving paw rotation. Report the contact landmark explicitly. Keep independent capture joint telemetry and rendered-pad checks separate. No controller or fox-look changes.

### Brake intent pose — 14:10
Use input release/opposition and measured deceleration only to drive a restrained nose-up, rump-down brace. Do not graft the competing movement controller. A dedicated authored skid has forepaws ahead, hind feet beneath the rump, a quick load and a held recovery. Blend a small brake-load layer onto moving gaits so the animal braces before it has already stopped. Expose load amplitude and retain per-frame brake telemetry. Capture this as a separate pass after landing/pad contact.

## Listening Crown extension
Design: `docs/design/wellspring-summit.md`. From the Wellspring west arch, a permanent stair reaches a compact cliff ruin. Two existing hearth columns reach a heat-fed crown bowl. A two-second element inlet latches permanent heat and an inward wind route to the summit; dash-through Shade or strong stroke are both valid. No new inputs, ability, collectible, or World 1 gate. Safe stairs remain available. Tunable seal time, saved latch, and `__game.crown` state support GPU verification.

Foliage extraction: standalone trees remove only geometry appended by their own placement. Empty material cells never reach mergeGeometries.

### Arrival lantern support
Replace the lantern's plain stacked rectangular support with the CC0 Quaternius
Column asset, scaled to the same 1.9 m support height and collision footprint.
Keep the lamp, light, checkpoint and all site positions. Batch its fluted shaft,
base and capital into the existing weathered stone bucket; no parallel old stem.

### Windmill / kiln ground-level ruin pass
The kiln's tall rectangular glyph stones dominate the cold-start camera. Reuse
the same CC0 carved column for those supports, scaled within their original
width/depth/height envelopes, retaining the glyph positions and every inlet.
Add shallow scanned fragments and leaf banks at existing ruin feet on the
terraces and kiln ledge. Do not alter collision, launch edges or route waypoints.

### Wind visual readability
The live current particles currently render as square Points sprites. Reuse the
existing maple-leaf atlas, selecting one alpha-cut leaf cell for each sprite.
Keep particle count, paths, speed, opacity/reactor timing and current force intact.
Verify the same wind-gap traversal with leafy silhouettes in place of squares.
Water critique correction: reduce the falls' local lamp from 2–5 to 0.8–2 light
units and give the marsh ink subtle animated normals plus a soft highlight
shoulder. It remains dark hazard ink; only surface response changes. Restored
falls acquire a warmer ochre tint. Retest the water crossing and lifecycle.
### World showcase + turn/head correction — 15:15
Keep the selected controller and constrain its grounded travel to the same turning envelope as the visible fox. Opposed input brakes while the fox pivots, preventing a full-speed sideways stance. Feed the intended look direction into a spring-led head/neck turn; distribute a smaller body bend along the four spine bones and cancel part of terrain pitch at the head. Retain authored clips as the primary pose. Re-shoot20s on real Reedmarsh boardwalk and Windmill Rise approach terrain using the gameplay camera, warm grade, and per-frame state. Staged cuts remain disclosed.
### Opus capture audit follow-up — 15:36 ET
Preserve failed retry files below attempt-N directories before writing a fresh
attempt, preventing mixed sheets. Verify durable success against route interval,
size/fps, and matching report/tool hashes. Order route evidence chronologically
with endpoint last and state labels. Save structured route acceptance with an
explicit stall/budget/death/assist reason. Existing play failures remain failures.

### Opus world critique — 15:36 follow-up
Backdrop satellite islets remain floating, as in the canonical keyart. Make two
near silhouettes larger and irregular; push minor scenery farther into lower
mist, with varied altitude, sloping caps and long uneven hanging spires. These
scenery-only islands have no gameplay colliders; realm landmarks and traversal
geography stay locked. Do not enlarge the playable summit.
The temporary ColorField render grade should blend through the full mask range
with world-space edge variation; keep gameplay supply sampling unchanged. Lower
ground chroma toward muted brown, leaving bright autumn accents to leaves and
fox. This addresses the orange-disc appearance without extending the source.

### Remaining stacked supports
Use one loaded CC0 column source for ruin piers, including arch supports and shrine
piers. Retain the arch ring, span, height and footprint; intact and snapped source
variants share the same material and preserve small authored leans. Remove the
stacked-box pier construction. Source geometry stays alive while region builders
use the kit. Keep sacred glyphs and all gameplay collision unchanged.
Hero still staging correction: use (0,70); the former (6,78) photo lens lay inside
the H-a shelf and clipped its face into the foreground. Record the changed stage
in capture provenance. This does not change the live third-person camera.

### Small landmark material corrections
Checkpoint lamps stay warm amber at a restrained emissive level rather than
reading as white boxes. Windmill sailcloth sits behind its existing timber ribs
and receives broad seam/lattice shading; no sail collision or rotation changes.
Reduce foliage texture-value contrast so clump lighting carries the silhouette
instead of fine photographic noise. Retain coherent crown gaps and branches.
Retest adjustment: halve ink ripple amplitude, vary phase to break parallel bands,
and compress only ink highlights more strongly. Broaden masonry texture scale to
read as old stone courses at play distance instead of a tiny repeated brick grid.

Isolated in-world dissolve evidence: after the real SW1 latch ceremony has ended,
dash through its newly awakened edge Shade using a collision-checked runway.
Keep one exterior camera and record the .8s silhouette release, falling colored
leaves, settled litter, and empty end. This isolates the small payoff from the
kiln's bright restoration flash without disabling world effects or forcing free.

Opus15:36 correction: sepia #3a2c22 ink at85% core opacity, soft fresnel edge,
lower-leg smoke fade and sparse antler-tip wisps. Strengthen the dark3m drain
wash; enlarge a smaller set of mesh-sampled maple leaves so the memory release
reads apart from ambient litter. Clear post-latch edge capture replaces the
kiln-obscured release view. Preserve authored patrol and sad frozen-motion premise.
Opus clear-contact evidence moves to the high-hill patrol: open southern camera,
terrain-checked approach/recoil/dash on the intact stair flight. This also avoids
depending on whether the earlier staged SW1 dash happened to latch the Seedwell.
No progression or freed state is forced; missing actor or missed contact fails.
World showcase review: settle the real gameplay camera for300ms while stationary at each disclosed cut; use slightly closer default chase framing (3.8m,1.5m height) so the creature stays readable through scenery. Add a small impact/brake head nod and pelvis-load tail lift, leaving FOX-owned tail appearance intact. Expose look and load spring tunables.

Final visibility correction: use the already-authored Arrival Meadow clearing for trot, gallop, turns, flat jump and dash. Its ground-cover exclusion keeps the fox and leaf-textured ground visible; no scenery is hidden or removed for capture. Retain Reedmarsh boardwalk walk and Windmill entrance ascent/jump/landing. Query the actual floor at staged meadow starts. Keep20seconds and the standard gameplay camera.
### Driver 16:05 — ground cover and distant platform silhouettes
The showcase red carpet is dense `bush_red` dressing under the fox, separate from
the ColorField. Keep walkable ground cover at 0.18–0.23 m, open coherent gaps and
mix most of its color back toward leaf brown. Sparse leaves and soil carry the
wake; no opaque bush may hide the lower legs.
Dress the already shipped Crown/Reach shelf undersides and bridge bays with the
existing hanging-spire/ruin kit. Keep every platform top, collider and route fixed.
Add arched structural silhouettes below the thin causeway so it reads as an old
aqueduct rather than a screen-space line. No new traversal or gate is added.

### Final camera/feel verification
Track85% of jump rise with faster airborne focus so the fox stays in frame; pull the gameplay boom back up to15% at gallop speed. Retain a60-second scripted live-input loop in the authored meadow clearing, one initial placement and no resets, mixing jumps and dashes. It is controller verification, not a claim of observed human fun.

### Final locomotion read correction — 16:50
Author a longer rotary gallop with23% combined suspension (hind duty.32,fore.28), matched stance sweeps and a slower physical cadence. Keep the paw below the elbow and limit carpal fold. Carry tail segments in a shallow backward stream rather than the imported curl. Air pose reaches forelegs and gathers hind legs. Turn roll belongs in spine/shoulders; cap total flat-ground pelvis drop to10cm. Showcase now uses a disclosed side/three-quarter cinematic lens on the clear real-world lanes; remote-camera owns gameplay follow camera.
### Color mask overlap correction
Render mask sources with per-pixel MAX blending, matching gameplay's strongest-
source rule. Additive blending saturated dozens of overlapping trail stamps
while idle, turning a feathered aura into a hard disc. Keep sources, radius,
lifetime and CPU supply evaluation unchanged. Let permanently restored ground
recover full authored chroma and a mild warm lift; temporary ground stays muted.

### Far scenery composition
The generic distant-land layer is distinct from the dressed satellite islets.
Reduce its repeated shapes from22 to14, move its depth range to300–600m and
reduce its scale range to10–30m. Lower it mostly into the cloud sea. This removes
large crisp saucer shapes behind the hero while retaining the two dressed
nearer island silhouettes. Scenery only; no playable world geometry changes.

### Near-plane ruin-face fade
The normal-camera showcase can brush the near face of a stair cheek even while
the fox remains visible. Reuse the existing ordered near-camera dither on rock
and stone faces over0.3–1.25m. Keep terrain/ground caps opaque, geometry/collision
unchanged, and landing surfaces beyond that near plane fully visible. Recheck
actual showcase cuts, especially the windmill stair approach.


### Final occluder correction
Clear the full fox silhouette when a world face blocks the camera: remove the
28% retained ghost, enlarge the protected ellipse, and include near-depth faces
that touch the body. Keep a dithered outer edge. Remove the ineffective global
near-face fade on stone/rock; ground and collision remain unchanged. Retest the
normal-camera showcase, including stair approach frames239 and1079–1199.

### Sprint final delivery — driver17:10
At17:30 pin the settled main once. Record three20-second live-input chapters
(Arrival Meadow, Windmill Rise, Reedmarsh shrine approach) at720p30 with normal
camera, explicit staged chapter starts, no forced solves, retained state/deaths.
Lanternhollow hub is not implemented; disclose Arrival Meadow substitution.
Also capture a six-second close run and six concept-angle hero stills. Assemble
a50-second trailer on Modal from that run, best20-second loco showcase,12seconds
of summit-r4 restoration and12seconds of Reach. List every source commit and
staging limitation; this is editorial footage, not a claimed continuous clear.

## Redesign sprint 1 — SOL ground slice
Pressed Ink → Living Cel stays melancholy autumn. Ground should carry broad cool umber/moss masses with a restrained cream-ochre worn path so the burnt-orange fox separates at wide distance. Leaf litter groups along shoulders rather than evenly covering the clearing; short dry tufts stay outside the route. A cool ink contact pool anchors the fox. Preserve paper-to-paint restore and existing movement tuning. Ownership agreed in sprint COMMS.md (chat :15/:24): extract four ground functions to lookdevGround.ts, pass world helpers as context, remove old implementations. Verify 01/02/03/05 stills, tsc/vite gates, gameplay __game; review worst visual issue and recapture once. FOX reviews distance read; WORLD reviews palette/detail.

## Redesign swarm — ground refinement
Keep the existing clearing, route, paint restoration and locomotion fixed. The ground is a quiet supporting plane for the burnt-orange fox. Reduce only ground-material paper hatching so the pale ruled strip in the half-painted close view no longer dominates. Temper the worn path toward weathered ochre and break its long bright run with broad, low-contrast earth variation. Preserve the muted moss/umber field and short route-edge dressing. Shared shader support is owned by Cinder; ground requests an explicit hatch weight. Compare matched 01/02/03/04/05 stills, inspect restored and paper ground, and obtain a teammate verdict before landing. No movement tuning is part of this slice.

Ground contact API: return the existing ground mesh from buildGround so world dressing can raycast the actual triangulated surface when placing contact marks. This changes no geometry, material, placement, or render output.
## Swarm world refinement
Keep the clearing in Pressed Ink → Living Cel. Canopy sprigs render only at the
view silhouette; chunky crown outlines have uneven lobes and gaps. Exposed limbs
curve upward and taper to fine tips. Rust foliage keeps ochre accents and three
readable values. Cloud hatching stays on the lower shaded rim. Verify the five
fixed lookdev shots before requesting an independent teammate verdict.

### World review correction — crown and rock contact
Ember rated 98c3cd1 MARGINALLY against d419723: crown lobes read as stacked
pillows, the low hero lobe appears detached, and smooth silhouettes lost leaf
texture. Keep each lobe's sphere topology but cut several deeper, uneven angular
sinuses through its radial contour and add smaller teeth across elevation as
well as azimuth. Pull limb-end foliage inward/down toward its supporting branch;
retain exposed branch gaps. Use the returned ground mesh for downward contact
samples, then bisect each crossing rock edge against that actual surface and
lift contact ink 2.5 cm. Verify five fixed stills, fix the weakest read, retest,
and request another named-SHA verdict before integration.
