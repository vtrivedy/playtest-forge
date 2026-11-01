# FEEL.md — three.js redesign vs Godot 4.7 port (honest comparison)

Port of the opening slice (`redesign-p0-lookdev` @ ab7a5b1: Lanternhollow + Arrival Meadow, hearth H-a,
updraft, continuous paint wake, chase cam + occluder fade) by one agent (Oak) in one session.
Everything below was measured, not estimated; captures under `/captures/results/` (paths at the end).

## Feel — numbers first

Same stick inputs on both engines (`tools/threejs-feel-probe.mjs` in Chromium vs `godot -- --probe`,
fox teleported to (−1.5, 80) facing the meadow, world-relative stick, 60 Hz fixed step):

| band (stick) | three.js gait / speed / playback | Godot gait / speed / playback | stance-paw slide p50 / p95 (m/s) three.js | Godot |
|---|---|---|---|---|
| walk (0.15) | walk / 0.48 / 1.026 | walk / 0.48 / 1.026 | 0 / 0.029 | 0 / 0.013 |
| trot (0.35) | trot / 1.12 / 1.197 | trot / 1.12 / 1.197 | 0 / 0 | 0 / 0.001 |
| run (1.0)   | run / 3.20 / 1.007  | run / 3.20 / 1.007  | 0 / 0 | 0 / 0.000 |
| full jump   | apex 0.792 m, air 0.633 s | apex 0.792 m, air 0.633 s | | |

- **Movement maths is a 1:1 port** (same PLAY tunables, same accel/decel/turn-rate/coyote/buffer/jump-cut/
  glide/dash code), so speeds, cadence and the jump arc match to the millimetre. Collision is not the
  same code: three.js samples a hand-rolled heightfield + collider list per axis; Godot uses
  `CharacterBody3D.move_and_slide` on Jolt against a trimesh ground and box/cylinder shapes. Walls slide
  more smoothly in Godot and the fox no longer "treadmills" into a wall (speed follows real velocity).
- **Skating:** the first Godot pass (AnimationTree only) skated — run p95 2.2 m/s. Porting three's
  FootIK as a `SkeletonModifier3D` (stance latch, 6 cm bounded lock, ground rays, pelvis drop,
  two-bone solve keeping pastern/paw world orientation) brought it to three's level. Bug worth
  remembering: the paw ground rays hit the fox's own capsule until the body RID was excluded.
- **Animation graph:** Godot `AnimationTree` (Transition state {idle, loco, jumpUp, fall, land} with
  per-target cross-fade; loco = Transition over walk/trot/lope/run) replaces three's hand-rolled mixer
  weights. Gaits are still *time-driven from their own phase* like FoxAnimator (each gait behind a
  TimeSeek + TimeScale 0, seeked every tick), so the pose-matched gait entry ports exactly: the
  paw-layout match table is built at load from the animation tracks (bone chains composed over the
  rest pose — no playback needed). Measured effect is small once FootIK is in (walk/trot/run p95
  0.016/0.001/0.002 → 0.013/0.001/0.000 m/s): the IK already hides most of a mismatched entry; the
  match is about the swing legs during the 0.2 s cross-fade, which the stance-slide metric does not
  see — not quantified here.
- **Route:** the real-input hero route (village → lych-gate → run + jump → cold hearth → aura ignition →
  updraft ride → glide → shelf; adapted from `tools/opening-hero-route.mjs`, which I did not re-run on
  the three.js side) completes in Godot. Godot ride: entry vy 3.5, peak feet 9.5 m,
  t(+7 m) 1.37 s, landed on the shelf at 4.96 m.

## Look

Side-by-side stills at identical poses, unpainted and painted (`sbs-*.png` in
`/captures/results/godot-oak-side-by-side-01/`): spawn, well, meadow, hearth chase poses
(`tools/opening-stills.mjs` POSES) and the overview / village art cameras.

What still differs, looking at those pairs:
- Distant ink reads **bolder** in Godot (rim groves in the overview/village views) although the hull
  maths is the same; three's SMAA + its thinner far lines look softer. Not resolved.
- The hearth's point-light pool is brighter and yellower in Godot; flames are larger, harder cel
  shapes; the column has fewer airborne embers than three's points.
- Painted grade is a touch warmer/yellower in Godot (canvas grade after tonemapping vs three's linear
  grade before ACES); three keeps more plum in the shadow band.
- Canopy palettes drift on the rim: the RNG is bit-exact, but call counts diverge where my primitive
  welding produces a different unique-vertex count than three's `mergeVertices` → later trees pick
  different palettes. Groves placed from data (TREES / ROCKS / HOUSES / PATHS) match exactly.

- **Pressed ink → living cel** ports almost verbatim: the paper/cel shader body (ragged watercolour
  front, tide line, pigment bleed, paper tooth/fibre/foxing, pressed-ink hatching, trail wake with the
  fibrous wet front) is the same GLSL with Godot names. At the spawn pose the two builds are hard to tell
  apart once three things were fixed (see "Harder").
- **The one structural change:** three.js grades *after* lighting (`outgoingLight`) in
  `onBeforeCompile`. Godot's `fragment()` runs before lighting, so the paper/cel mix moved into
  `light()` for the single directional key; hemi/fill/rim became analytic terms (three never shadowed
  them either). Point lights (hearth, tail) add banded warmth in their own pass. Works, but it is a
  constraint: a second shadowed directional light would need a different design.
- **Ink:** inverted hull as a `next_pass` reading the welded smooth normal + per-part ink width from
  `CUSTOM0` — one mesh per merged village group keeps every part's ink weight. Nicer than three's
  separate hull meshes.
- **Occluder fade:** Godot version screen-door dithers (opaque pipeline, no sorting, no material
  cloning) and drops the ink pass; sight rays hit exact trimesh shapes (faces baked to world space,
  backface collision on so a lens inside the well ring still sees the ring) on a dedicated physics
  layer. three.js uses real transparency, which looks softer; Godot's 4×4 Bayer dither is plainly
  visible as a dot pattern on the faded Great Well at 960×540 (`pose-wellblock` capture). A blue-noise
  threshold or TAA would hide it; not done.
- **Post:** Godot Environment glow + ACES (with `tonemap_white` raised — see below) + a small canvas
  grade (vignette, grain, sepia↔restored split tone). three's grade runs in linear before ACES; Godot's
  canvas grade sees the tonemapped frame, so it is a gentler approximation.

## Iteration speed

- **three.js:** vite hot reload, sub-second turn-around; captures need Playwright + SwiftShader and
  manual-clock hooks to be deterministic.
- **Godot:** no hot reload for this procedural world from the CLI — every look check is a fresh run:
  ~6.6 s world build (GDScript procedural geometry; 9.8 s in wasm) + render. Typical "change shader →
  side-by-side still" loop on this 1-CPU box: ~45 s. Exports: 4 s each for Web and Linux.
- **Movie maker** (`--write-movie --fixed-fps 30`) is the big win: frame-exact, deterministic route
  video from real inputs with zero harness code. On llvmpipe it renders ~35 frames/min.
- GDScript's static inference caught a class of bugs at parse time; the dynamic-Dictionary-heavy layout
  code needed explicit types in ~10 places.

## What was easier in Godot

- CharacterBody3D + Jolt instead of a hand-rolled walk/step/collision solver.
- AnimationTree for the state/gait graph; `SkeletonModifier3D` as the right home for foot IK.
- Global shader uniforms (paint restores, trail map, paper/ink, fog) instead of patching every material.
- `next_pass` ink hull; MultiMesh for grass, leaf litter, flagstones and rim-leaf cards.
- One-command Web + desktop exports; deterministic movie capture.

## What was harder in Godot

- **Colour space traps (cost the most time):** `source_color` vec3 uniforms set from GDScript are not
  linearised in Compatibility → every albedo ~3× too bright; Godot's ACES normalises to
  `tonemap_white = 1` (three's ACESFilmic doesn't) → lifted mids; Godot depth fog at three's density is
  far denser → ported three's height-fog formula into the shaders.
- No post-lighting hook in spatial shaders (see Look).
- No MAX blend for the paint stamp mask → one canvas pass loops ≤ 128 stamps instead.
- Instance uniforms come from a small fixed buffer (4096 slots on llvmpipe) → per-material uniforms.
- GDScript builtin `smoothstep(from, to, x)` silently shadows a same-named class static.
- Procedural geometry in GDScript is ~10× slower than JS (6.6 s build vs ~1 s in three.js).

## Captures (all under `/captures/results/`)

| what | path |
|---|---|
| real-input hero route, movie maker 30 fps + stills + per-tick state | `godot-oak-hero-route-04/` (final; `-03` same build, earlier cold-hearth framing; `-01/-02` superseded) |
| side-by-side stills vs three.js (paper + painted, 6 views) + occluder fade | `godot-oak-side-by-side-01/sbs-*.png`, `godot-occlusion-wellblock.png` |
| three.js reference stills (`tools/opening-stills.mjs`) | `threejs-ref/{paper,paint}/` |
| feel probe, both engines | `godot-oak-feel-probe-01/` |
| web export booted in headless Chromium (keyboard run + jump) | `godot-oak-web-smoke-02/` |

## Verdict

For this slice Godot is at **look parity** at the matched stills and **feel parity** on every probe
metric. Godot wins on engine plumbing (physics, animation graph, IK home, exports, capture); three.js
wins on iteration speed and shader freedom (post-lighting grade, blend modes, real transparency).
Remaining gaps are listed in NOTES.md.
