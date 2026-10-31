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

## Approach (competes with Sol `loco`): per-leg phase warp + swing amplitude, not uniform retime
Uniformly slowing the clip makes feet skate (stance foot moves slower than the ground). Instead:

1. **Designed cadence curve.** Cadence comes from tunables (`walkHz`, `trotHz`, `gallopHz`) blended by gait weight, capped by each gait's natural cadence so stance can never be slower than ground speed.
2. **Per-leg phase warp.** Each gait clip is split at load into a body action and four leg actions (scapula→paw, hip→paw). Every leg plays its *own* clip time: its stance window is time-compressed so the pad sweeps backward at exactly ground speed (feet stay planted), and the saved time goes to a longer, slower swing. Lower cadence ⇒ lower effective duty ⇒ longer suspension: a floating extended trot and a gallop with real flight — the "glide".
   duty′ = duty · k · stride · cadence / speed, clamped to [minDuty, duty].
3. **Swing amplitude k.** Upper leg bones (upperarm / thigh) rotate about their cycle-mean pose scaled by `k_gait` (≈1.15–1.3), giving genuinely longer strides so duty doesn't collapse.
4. **Body bob damping.** Pelvis/root translation tracks are pulled toward their cycle mean by `bodyBob` (keep ~45%) so the torso floats over the legs instead of pogoing; spine flow comes from the existing lean/bend springs plus a slow hip-sway spring.
5. **Damped body path (main.ts).** Ground velocity uses a critically damped approach with lower accel (glide preset), and grounded yaw follows a spring-limited turn rate instead of a hard linear clamp. Input stays responsive (<150 ms to 90% speed).

Untouched: jump/dash/glide gameplay numbers (level gaps are tuned to them), `moveSpeed` 8.4.

## Metrics / done-bar
- CPU probe: cadence per band, plant error, slide m/s, residual — must not regress vs main (`maxSlideMS` ≈ 0, residual < 3 cm).
- `window.__game.locomotion`: `cadenceHz`, `duty`, `ampScale` published.
- GPU: `gait` (side view) + `feel` (3/4 chase) for main 2e0e614 vs this branch; side-by-side via `tools/compare-gait.py`. Opus + Sol critique both must agree "smooth / gliding".
- Later if capacity: belly-slink on turns, jump anticipation/air pose, gallop suspension distinct from trot.
