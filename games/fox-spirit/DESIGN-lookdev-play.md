# Lookdev play — the hearth-fox runs the P0 clearing

`/?lookdev=p0&play=1`. Goal clip: 30 s of walk / run / jump in the hero clearing, real chase camera.

## Pillars
- **Authored clips are the pose.** Walk / run (+ trot when authored) on a speed-driven gait tree;
  playback rate = ground speed / clip speed (bounded), so paws travel with the ground. Gait changes
  are short crossfades that enter the new clip at the pose-matched phase (lateral walk vs rotary
  gallop never cross-blend opposite legs). Jump = `jumpUp` → `fall` → `land` one-shots/loop.
- **Grounded, flowing, never twitchy.** Body turns at a bounded yaw rate and travels along its
  facing (no sideways skate); speed eases in/out. Jump is short and weighty (≈0.8 m apex,
  ≈0.6 s air, heavier fall), coyote + buffer so it never eats input.
- **Procedural only as small additives** on top of the clip: turn bank, slope / air pitch, head
  lead, stance-foot IK to the ground.
- **Real chase camera**: main's `createFollowCamera` (lag, look-ahead, recentre, 3/4 bias, jump
  track, landing dip), re-tuned for the smaller fox.

## Controls
WASD / arrows (camera-relative), Space jump (hold = full height), Ctrl walk. Harness: world-relative
`setStick(x, z)` (magnitude = speed fraction), `setKeys`, `setManual`, `advance`.

## World
Analytic colliders built from the same data that places the props: rock caps and arch plinth steps
are walkable surfaces, piers / ruin stub / trunks block. Ground = `groundH`.

## Tunables (lil-gui, `?gui`)
runSpeed, walkSpeed, accel/decel, turn rate, jump velocity, gravity, fall gravity, jump cut,
air control, gait fade, rate bounds, camera distance/height/lag.

## Metrics (`state()`)
speed, gait, playback rate, grounded, apexY, airTime, last jump apex/air, max stance-paw slide.
