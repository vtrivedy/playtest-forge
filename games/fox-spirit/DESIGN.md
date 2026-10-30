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
