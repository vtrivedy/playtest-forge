# Fox locomotion flow pass (sprint 5 anim2) — delta on DESIGN-loco-clips.md

Vivek (Oct 31): clips A/B is grounded but still "doesn't flow". Research: `.agent/quadruped-locomotion.md` (Holden inertialization, RDR2 "don't stop moving", Flame in the Flood pose matching, Barker four-legged beasts). The clip stays the primary pose; everything below is either a **clip re-author** or a **bounded additive** with re-IK. One path — the linear crossfade code and the idle-only entry table are deleted, not flagged.

## P0.1 Jump arc = re-authored clips (baked into the GLB)
`tools/fox-air-clips.ts` reshapes `jump_up` / `jump_apex` / `jump_fall` / `land` in `assets/hero/spirit_fox.glb` (other clips, mesh, skin untouched; only these four animations get new 60 fps samplers). Edits are world-pitch layers on the authored frames (Blender `wrot` idiom), keyed over normalized clip time:
- **jump_up** (anticipation → push): crouch deepens over the first ≥2 frames with easeOut (haunches load, chest drops), then hinds extend back and fores lift/fold — the clamped last frame is the takeoff stretch.
- **jump_apex** (gathered hang, loop): fores folded at the elbow/wrist under the chest, hinds tucked forward under the belly, slow ±4° breathing of the tuck — never legs hanging straight down.
- **jump_fall** (reach, one-shot): eases from the gathered tuck into fores reaching forward-down for the ground and hinds streaming back.
- **land** (absorb → recover, 0.3 s): starts from the fall reach already compressing (no standing frame 0), deepest absorb at ~0.07 s, recovered by 0.3 s.
Spine gather/extend in the air comes from the P1.4 spine layer (driven by vertical speed), not the clip.

## P0.2 Transitions = inertialization (replaces linear crossfades)
Holden "Spring-It-On" / Bollo inertialization. State changes (idle ↔ gait, gait ↔ gait, jump_* ↔ land ↔ gait, dash, glide…) switch the mixer weights **instantly**; at the switch every non-FX bone records offset = displayed − new (rotation as a rotation vector, translation as a vector) plus the source velocity. The offset decays with a critically damped spring (`decaySpring`, half-life):
- gait ↔ gait 0.09 s, into/out of idle 0.13 s (settles ≥0.3 s), land/air → gait 0.15 s, other caller fades → `fade × 0.6` (≥0.05 s).
Entry phase into a gait is a **runtime pose search**: the current pre-IK leg feature (elbow/stifle, carpus/hock, pad in actor space + velocity) against the 64-bin per-gait table. This replaces the idle-only entry table, so land → gallop enters the stride whose legs match the landing pose.
Safety net: a stance/swing pad's actor-space step may not jump more than `padJerk` (4 cm) beyond last frame's step.

## P0.3 Walk flow / start-stop
- Gait selection reads an animation speed smoothed with half-life 0.2 s (cadence still from true speed so stance doesn't skate).
- Walk plays at most `walkMaxRate` (1.0×) of its authored cadence and trot starts at 1.05 m/s → walk cadence ≤1.4 Hz, slower legs, body flows.
- **Don't stop moving:** when the caller asks for idle, the gait keeps cycling (cadence floor) until it reaches a phase whose pose matches idle (≤0.3 s), then inertializes into idle.

## P1 bounded additives (after clip, before foot IK so IK re-plants)
4. **Spine**: gather/extend pitch on spine_01..04 (+ pelvis counter) — gallop from the stance phase, air from vertical speed (rising = extend, apex = gather, fall = extend), land absorb = gather. Lateral bend ∝ turnRate × speed. Spring-smoothed, each capped at 13°. Metric `spineFlexDeg`.
5. **Tail**: per-bone spring chain on tail_01..08 driven by root acceleration (fore/aft + vertical) and turn rate; settle ≤0.3 s; root pitch never more than 35° above rest and the chain never past vertical. FX plume bones untouched. Metric `tailPitchDeg`.
6. **Carpal / hock give**: stance load (stance weight × pelvis drop + land absorb) flexes the inserted carpus (fore) and the hind_foot hock, ≤18°, after pad normal align; the pad keeps its world orientation (IK re-places). Metric `carpalGiveDeg`.
7. **Bank + look-ahead**: bankMax 0.22 rad, turnLean 0.07; head leads toward the move direction (`headLead` 0.38) plus a turn-rate term.

## Metrics / tuning
`__game.loco` adds `spineFlexDeg`, `spineBendDeg`, `tailPitchDeg`, `carpalGiveDeg`, `inertiaDeg`, `inertiaCm`, `padJerkCm`, `stopHold`. All params in lil-gui "Clip locomotion".

## Acceptance
- CPU (`npx tsx tools/loco-clips-metrics.ts`): stance gap ≤2 cm, slide not worse; land→run scenario max single-frame pad jump ≤5 cm (was ~60 cm).
- Strip (`blender -b -P tools/blender/scripts/hero_v2_strip.py`) of the four air clips reads anticipation → hang → reach → absorb.
- GPU chase A/B by parent after DONE.
