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
- `npm run playtest:fox` → playtest-output/fox-spirit/ (`metrics.json` splits unassisted vs staged)

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
sepia warms to copper and russet. No explosion, score pickup or respawn.

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
