# Loco-glide — the fox glides, the legs stop scurrying (Sprint 3, Opus A/B stream)

Vivek 9:46 PM: "The movement is too fast and jarring with the legs, fix this and make it look more like a **glide**."

## Measured problem (main 2e0e614, CPU probe `tools/inspect-locomotion.ts` + clip data)
Cadence = speed / blended stride. World strides: walk 0.54 m, trot 0.96 m, run 1.85 m.

| band | speed | cadence now | target |
|---|---|---|---|
| walk  | 1.5 m/s | 2.6 Hz | ~1.6 Hz |
| trot  | 3.8 m/s | 4.0 Hz | ~2.1 Hz |
| gallop| 8.4 m/s | 4.5 Hz | ~2.4 Hz |

A 1.25 m-tall spirit at 4–4.5 Hz reads as a terrier scrabbling. Body path is also snappy: ground accel 30/s (33 ms time constant) and a hard 4.5 rad/s yaw clamp produce step-changes in velocity and heading.

## Approach (competes with Sol `loco`): per-leg phase warp, not uniform retime
Uniformly slowing the clip makes feet skate (stance foot moves slower than the ground). Instead:

1. **Designed cadence curve.** Cadence comes from tunables (`walkHz` 1.8, `trotHz` 2.1, `gallopHz` 2.4 at 1.5/3.8/9 m/s, `cadenceExponent`) blended by gait weight, bounded by each gait's natural cadence so stance is never slower than ground speed.
2. **Per-leg phase warp.** Each gait clip is split at load into a body action and four leg actions (scapula→paw, hip→paw). Every leg plays its *own* clip time: its stance window is time-compressed so the pad sweeps backward at ground speed (stance time = sweep/speed, same as main), and the saved time goes to a slower swing. Lower cadence ⇒ lower effective duty ⇒ longer suspension.
   duty′ = duty · stride · cadence / speed, clamped to [minStanceRatio·duty, duty].
3. **Hermite swing ease** (`swingEase` .35): swing leaves/enters stance at the stance clip rate, removing the paw-velocity kink at lift-off/touch-down.
4. **Body float.** Pelvis/root translation tracks pulled toward their cycle mean (`bodyBob` keeps 45%).
5. **Carriage.** Per-stride back rock removed against a 1.2 Hz low-passed back line (`rockDamp`), gaze leveled against a low-passed head pitch (`headLevel`); slope and turns still read.
6. **Tail.** Carried lower with speed (`tailStream`) plus a stride-locked travelling pitch wave (`tailWave`, `tailWaveLag`), faded in/out.
7. **Standing-jump windup.** 9 cm haunch crouch + nose-up gather with IK-planted feet; fades out above 1–3 m/s.
8. **Damped body path (main.ts).** Critically damped ground velocity (`groundEase` ω=11 → ~0.35 s to 90%, deliberately softer than main's 77 ms snap) and an eased yaw rate (`turnEase`) instead of a hard linear clamp.

Rejected: swing-amplitude scaling of thigh/upperarm (longer strides). The gallop paw path is non-linear in thigh angle; plant error rose to 0.3–0.7 m. So strides are not longer — stance is the same, flight is longer.

Untouched: jump/dash/glide gameplay numbers (level gaps are tuned to them), `moveSpeed` (brisk default 9).

## Metrics / done-bar
- CPU probe: cadence per band, plant error, slide m/s, residual — must not regress vs main (`maxSlideMS` ≈ 0, residual < 3 cm).
- `window.__game.locomotion`: `cadenceHz`, `stanceRatio` published.
- CPU paw-acceleration p95 (jerk proxy): gallop 1139 → 334 m/s², trot 249 → 144.
- GPU: `gait` (side view) + `showcase` (3/4 chase) for main 2e0e614 vs this branch; side-by-side via `tools/compare-gait.py`. Opus + Sol critique both must agree "smooth / gliding".
- Later if capacity: belly-slink on turns, jump anticipation/air pose, gallop suspension distinct from trot.
