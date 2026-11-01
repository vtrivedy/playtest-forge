# PORT_PLAN — The Keeping opening → Godot 4.7 (`games/fox-spirit-godot/`)

Author: Oak · branch `godot-port` (cut from `main` @ ab7a5b1 == `redesign-p0-lookdev` tip at start).
Source of truth: `games/fox-spirit/src/opening/*`, `lookdevKit.ts`, `lookdevGround.ts`, `lookdevFox.ts`,
`lookdevPlay.ts`, `chem/updraft.ts` + `chem/reactor.ts`, `src/render/colorField.ts`.

## Global decisions

| Topic | Decision | Why |
|---|---|---|
| Renderer | **Compatibility (GL 3.3 / WebGL2)** for desktop *and* web | One look on both targets; web export requires it; software GL (Xvfb + llvmpipe) can render movie-maker captures on a CPU box. |
| Language | GDScript only, typed where cheap | Task rule. |
| Physics | **Jolt** (`physics/3d/physics_engine`) + `CharacterBody3D` | Native move-and-slide/floor snap replaces the hand-rolled `surface()` / `moveTo` per-axis stepper. |
| Layout | Same world coordinates as three.js (x east, z south, y up; three.js and Godot are both right-handed Y-up, so coordinates copy 1:1) | Side-by-side stills at identical spots. |
| Determinism | Port `rng()` (mulberry32) bit-exact, seed 11 | Same groves / jitter look; deterministic captures. |
| Build | Procedural at `_ready()` like three.js (no baked .tscn geometry) | Port stays a readable transliteration of layout data; iteration = edit numbers + rerun. |

## System map

| three.js system | Godot port | Notes |
|---|---|---|
| `layout.ts` (SPAWN, WELL, HEARTH_A, SHELF, HOUSES, PATHS, BOUNDS, `pathDist`, `rimK`, `groundH`) | `scripts/layout.gd` (static consts + funcs) | Verbatim maths. |
| `lookdevKit.toon()` + `patchPaint()` (MeshToon + paper↔cel onBeforeCompile) | `shaders/world_cel.gdshader` — custom `light()` bands the key light into 3 steps (ramp 70/150/255) and builds the final paper/cel colour there; `fragment()` computes paint mask, tide, bloom, hatch params into varyings. Fill/rim/hemi are analytic terms (global uniforms), only the key is a real `DirectionalLight3D` (shadows). `ambient_light_disabled` so the shader owns the whole grade. | three.js mixes on `outgoingLight`; Godot has no post-lighting hook in `fragment()`, so the mix moves into `light()` for the single directional key. Point lights (hearth, tail) add banded cel warmth in additive passes. |
| `paintU` shared uniforms (uRestore[4], uRestoreCount, uTrailMap, uTrailBounds, uPaper, uPaperInk) | **Global shader uniforms** (`project.godot [shader_globals]`): `paint_restore_0..3` vec4, `paint_restore_count`, `trail_map`, `trail_bounds`, `paper`, `paper_ink`, `world_paint` | Godot's native "every material shares this" mechanism. No arrays in globals → 4 vec4s. |
| `inked()` inverted hull + `hullGeometry` (mergeVertices → smooth normals) | `shaders/ink_hull.gdshader` as **`next_pass`** of the world material; smooth normal + ink width baked into `CUSTOM0` (xyz normal, w width) by the kit mesh builder; `cull_front`, unshaded, distance-scaled grow, optional brush wobble. | One mesh, one draw-list entry, ink width per vertex so merged village buckets keep their individual weights. |
| `jitter` / `hewn` / three primitives (Box, Cylinder, Dodeca/Icosa polyhedra, Extrude, Shape, Tube, Cone, Sphere) | `scripts/geo.gd` — small primitive generators returning triangle soups (`PackedVector3Array`), coherent jitter via position-welded hash, flat-normal hewn | Godot's PrimitiveMeshes don't match three's segment/vertex layouts that jitter relies on. |
| `village.ts` `Kit` (vertex-coloured parts merged per ink weight) | `scripts/kit.gd` — `add(tris, color, at, rot, ink, scale)` + `at(x,y,z,yaw, Callable)` frame stack → one `ArrayMesh` (COLOR + CUSTOM0) per group | Same call sites as TS; village.gd reads almost line-for-line. |
| `meadow.ts` (ground, shelf columns, hearth plinth, groves, rocks, rim, grass, leaves, distance ridges) | `scripts/meadow.gd`; ground = one `ArrayMesh` (vertex colour) + `HeightMapShape3D`/trimesh collider; grass & leaf litter = `MultiMeshInstance3D` with per-instance colour; maples = `scripts/maple.gd` (plume tubes, canopy pads, rim-leaf cards as MultiMesh) | MultiMesh = native InstancedMesh. |
| `village.ts` (cottages, well, gate, lane walls, fire-pit, festoons, fences, cart, shed, flagstones, chimney smoke) | `scripts/village.gd` | Smoke = CPUParticles3D-free: 7 animated puffs like TS (cheap, deterministic). |
| Colliders `{cap, box, post}` + `surface()`/`moveTo()` step logic | `StaticBody3D` per collider: box → `BoxShape3D`, post → `CylinderShape3D`, cap → `CylinderShape3D` low disc (rock tops are walkable); terrain → `HeightMapShape3D` | Native. Step-up handled by floor snap + capsule; low caps behave as ramps. |
| `lookdevPlay.ts` controller (PLAY tunables, accel/decel, turn-rate, coyote, buffer, jump-cut, glide, dash, updraft lift) | `scripts/fox_controller.gd` on `CharacterBody3D`; same PLAY dictionary of tunables (exported vars) | Feel tunables keep identical names/defaults for honest comparison. |
| `FoxAnimator` (speed-driven gait tree, pose-matched gait change, jumpUp/fall/land) | **`AnimationTree`**: `AnimationNodeStateMachine` {loco, jumpUp, fall, land}; loco = `BlendSpace1D` (walk/trot/lope/run at authored clip speeds) → `TimeScale` (stride-matched rate, clamped 0.6–1.7) | Native blend replaces hand-rolled mixer weights. Pose-match table not ported (BlendSpace1D `sync` instead) — note in FEEL.md. |
| `FootIK` | Deferred; candidate: Godot 4.6+ `TwoBoneIK3D` modifiers | Only after core look + capture is green. |
| `lookdevFox.ts` coat shader (2-tone cel + hatch + ember UV.x + rim), skinned ink hull, flame tongues, motes, tail light | `shaders/fox_coat.gdshader` (+ `next_pass` ink hull on skinned mesh), `CPUParticles3D` motes off tail bone (`BoneAttachment3D`), `OmniLight3D` tail light, billboard flame quads | |
| `camera.ts` follow cam (lag, recenter, look-ahead, side bias, boom) | `scripts/chase_cam.gd` — critically damped boom behind facing, recenter, look-ahead, terrain clearance ray | Rewritten, not transliterated (task rule). |
| `opening/occlusion.ts` (sight-ray bundle → clone materials → transparent fade, hide ink) | `scripts/occlusion.gd` — 6-ray bundle via `PhysicsDirectSpaceState3D.intersect_ray` against a **sight layer** (cottage boxes, column posts, canopy proxy spheres as `Area3D`s); each occluder unit fades via **instance uniform** `fade` → dithered (screen-door) discard in both world + ink passes | No material cloning, no transparent sorting; native per-instance params. |
| `ColorField` (aura, trail ring buffer, restores, `sample()`, GPU stamp mask RT) | `scripts/color_field.gd` (CPU sim identical) + mask = `SubViewport` 512² with one `ColorRect` canvas shader looping a `vec4[128]` stamp array (max-blend in-shader) → `ViewportTexture` bound to global `trail_map` | Godot canvas has no MAX blend; looping in one shader is simpler than instanced stamps. |
| `opening/paint.ts` TRAIL_BLEND (cel interior, fibrous wet front, pooled rim) | In `world_cel.gdshader` verbatim | |
| `chem/reactor.ts` + `chem/updraft.ts` (heat, ignite/hold/gutter, liftAt, ride log) | `scripts/hearth.gd` (Reactor maths + lift) with ember `CPUParticles3D`, flame cards, `OmniLight3D`; `Area3D` teach-prompt zone | |
| `buildSky` (paper sky ↔ painted dusk) | `shaders/sky.gdshader` (`shader_type sky`), `world_paint` global drives the sweep | |
| `applyHeightFog` + `matchFogToSky` | `Environment` depth + height fog, colour lerped paper-mist → autumn-mist | |
| `createPostStack` (bloom 0.35/0.9, vignette 0.3, grain, ACES) | `Environment` glow + ACES tonemap + MSAA; vignette/grain/restore grade = `CanvasLayer` screen shader | |
| `__gameHooks` (`state`, `advance`, `shot`, teleport) | `scripts/capture.gd` (scripted route driver + named stills) run via movie maker; JSON state dump per still | Godot equivalent of `window.__game`. |

## Build order

1. Scaffold project, import `hearth_fox.glb` (copied under `assets/`), CharacterBody3D + AnimationTree moving on a flat test ground.
2. world_cel + ink hull shaders, kit/geo, ground + layout.
3. Meadow (shelf, hearth, groves, rocks, grass, leaves, rim).
4. Village (cottages, well, gate, props).
5. ColorField + trail mask, restores, sky/fog/post grade.
6. Hearth + updraft + glide/dash; chase cam + occlusion fade.
7. Capture route (movie maker under Xvfb), web + linux exports, side-by-side vs three.js stills, FEEL.md.
