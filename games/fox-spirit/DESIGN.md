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
Quaternius CC0 fox silhouette floats in a warm ink wash, wavering without a walk
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
