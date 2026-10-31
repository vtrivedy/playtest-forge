# Clip-driven fox locomotion (sprint 5) — proven shipped patterns

Vivek (Oct 31 after chase clip): movement is "so weird and unnatural" — "doesn't flow or look natural at all." Four sprints of procedural overlays on the Blender-baked clips have plateaued (hovering paws, stiff spine, stick fores, tail flips). **Change approach:** trust authored clips; use tried-and-true game animation patterns only. No novel experiments.

## Asset decision
**Keep** `assets/hero/spirit_fox.glb` (project-owned Blender-baked clips: idle, walk, trot, run, jump_up, jump_apex, jump_fall, land, dash, glide, skid, turn_*, burst). Matches art lock (burnt-orange ember fox + fx bones).

Evaluated and **not swapped**:
- Quaternius Ultimate Animated Animals Fox — CC0, Walk/Gallop/Idle/Jump, **no trot**, low-poly cartoon, wrong look. Candidates at `playtest-forge-artifacts/sprint5/anim/candidates/quaternius-fox.glb`.
- Khronos glTF Fox — mesh CC0 / rig+anim CC-BY 4.0 (PixelMannen / tomkranis), Survey/Walk/Run only, no jump/trot. `candidates/khronos-fox.glb`.
- OGA br-n518 fox — CC0 blend (idle/walk/run/bite/dig/death), no trot/gallop/jump phases; `.blend` only. `candidates/fox_source_v3.zip`.

Retargeting foreign clips onto our 57-bone spirit rig costs more than stripping the procedural warp that is already fighting our own clips. **Approach = (a) keep mesh+clips; rewrite the mixer path.**

## Design (one path — delete the replaced procedural warps)

### Clip layer (primary pose)
1. **1D blend tree** by ground speed: idle → walk → trot → run. Weights via smoothstep bands (existing `trotSpeed` / `gallopSpeed` thresholds OK).
2. **Sync-matched phase** across gaits: when weights change, keep a shared normalized phase so feet don't pop mid-stride (match walk/trot/run cycle phase; do **not** per-leg time-warp).
3. **Stride-length playback**: `playback = speed / (strideLength * cadenceRef)` so stance feet match ground speed (use `spirit_fox.loco.json` stride). No foot skating from wrong rate.
4. **Short crossfades** (0.12–0.2 s) between locomoting gaits; slightly longer into idle (~0.25 s).
5. **Jump state machine**: `jump_up` (anticipation) → `jump_apex` / `jump_fall` (air) → `land` → resume gait. Drive from existing jump input / airborne flags. One-shot clips with clampWhenFinished where appropriate.
6. **Whole-clip playback** — do **not** split clips into body+four leg actions with hermite swing warp (delete that path). The authored clip is the pose.

### Foot IK layer (corrective, light)
7. **Ground raycast** per paw (Rapier castRay down, exclude fox). Stance feet: two-bone IK (shoulder/hip → elbow/stifle → carpus/hock) to hit point + normal align ≤10°.
8. **Pelvis height adjust** from average stance foot error so body doesn't float.
9. **Contact shadows**: small blob/decal at stance hits; polygonOffset (−1, −4).

### Additive procedural only (subtle)
10. Look-at head (existing), slope tilt, turn lean/bank. **No** swing lift overlays, carpal flick layers, gallop flex overlays, idle rest-leg folds that fight the clip, or per-leg phase warp.

### Delete (no compat flags)
- Per-leg clip split + hermite swing warp (`parts` body/legs map).
- Procedural swing lift / carpal flick / hock fold driven as primary motion.
- Any dual-path "legacy procedural vs clips" flags.

Keep: `foxLimbRig` carpus insert (needed for IK chain), flame attach fix, Rapier movement controller, camera.

## Metrics
`__game.loco`: gait, phase, playback, clipWeights, footGap[4], maxSlideMS, spineFlexDeg (from clip, not forced).

## Acceptance
- Chase-cam A/B vs main `c1f928f`/`f15eee5`: same input script, clearly more natural flow (critic + human frames).
- `footGap` stance ≤ ~2 cm; maxSlideMS not worse than main.
- `npx tsc --noEmit` + `npx vite build --config games/fox-spirit/vite.config.ts` clean.
- Land on main with normal push only if clearly better; else leave on `s5-anim-clips`.

## Capture
Local SwiftShader only (Modal spend-blocked). One capture at a time. Out: `playtest-forge-artifacts/sprint5/anim/`.
