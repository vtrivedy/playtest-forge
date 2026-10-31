# loco-glide-r2 — close the critic's open loco failures (02:45 ET Sat)

Base: main eaf56c9 (fast-forward; no unique branch work lost, b9bf716 slip fix included).
Cadence stays 1.85/2.15/2.40 Hz (Vivek #1 glide). One locomotion path; tunables only where possible.

## Open failures (critic) → scoped change
1. **Turn skate, no visible bank (2.9–3.4 m/s slide in carved trot turns).**
   - Bank: lean is `turn*speed*turnLean` clamped .16 rad; critic says ~2x needed at chase distance.
     Raise turnLean/clamp so a 3 m/s carved turn reads (~.25 rad chest), keep pelvisBank .45 share, head roll stabilised.
   - Skate: measure first with a CPU turn probe (maxSlideMS, residual, early steps) at 2.5–3.2 rad/s.
     Hypothesis: stance anchors are world-fixed while the hips yaw around them; the outer feet hit the
     .9·maxCorrection release and re-step mid-stance, or reach-clamp drags the pad. Candidate fixes, chosen by probe:
     (a) yaw the lateral stance-correction budget (feet rotate with the body around their anchor — real dogs pivot on planted pads),
     (b) slightly tighter turn yaw-rate damping in the controller so carved turns are wider at speed (also more "glide").
2. **Jump: no anticipation / landing.** Standing windup is 3 frames (.05 s). Make windup speed-gated:
   ~.13 s (8 frames) standing → .05 s at ≥3 m/s so running jumps keep their immediacy. Landing defaults
   take the A/B'd .20 squash / 1.0 pitch candidate (captured: removes long-drop first-frame rise, more compression,
   4 contacts kept).
3. **Gallop gather hunch.** Diagnosis on record: neck_01 carries ~46° of head-height compensation at gather.
   Fade headHold with run weight so the gallop head rides with the gather instead of kinking the neck base;
   check torso pitch / residual on CPU.
4. **Hind-thigh flap** is a skin-weight seam (LOCO-HIP-DIAGNOSIS); mesh owner is fox-ember. Out of scope unless time remains.

## Validation
CPU probe A/B (tools/loco-glide-metrics.ts + turn probe), tsc + fox vite build, then one GPU worldgait request
(walk/trot/run side+3/4, carved turn, jump) for candidate vs 2e0e614. Inspect PNGs personally before any claim.

## CPU result (tools/loco-turn-probe.ts, 2.9–4.05 m/s carved trot @2.5–3.2 rad/s; gallop 9 @1.2)
| | re-steps / 6.7s | residual mm | slide p95 m/s | pelvis bank° | chest bank° |
|---|---|---|---|---|---|
| main eaf56c9 | 38 / 40 / 10, gallop 24 | 21 / 41 / 70, gallop 11 | .50 / 0 / 1.16, gallop .48 | 5.4 | 10.6 |
| candidate | 3 / 9 / 9, gallop 24 | 29 / 32 / 18, gallop 12 | 0 / .66 / 0, gallop .09 | 12.8 | 12.9 |
Walk pivot (1.62 m/s) and every straight gait unchanged (cadence 1.85/2.15/2.40, straight residual 0).
- turnPlant=1: touchdown anchor pre-rotated about the actor by half the stance's yaw (trot/gallop only). An "exact arc" prediction was tried and was worse; rejected.
- rootBank=1: grounded bank applied as a whole-body roll about the ground line (legs lean with it) instead of spine roll that lifted the outer hip; turnLean .055 / bankMax .2.
- Jump: standingWindup .13 s (≈8 frames), speed-gated back to .05 s by 3 m/s; buffer latched through the windup. Landing .20 squash / 1.0 pitch (A/B'd candidate).
- gallopHeadHold .8 (was 1.2 for all gaits): neck-vs-back kink range per gallop stride 39.9°→34.2°, head bob 2.2→4.6 cm. Watch for loss of quiet head in capture.

## Sol cross-critique (artifacts/sol-critique-97e58fa.md) → follow-up
- Touchdown snap from pre-rotating the anchor: now late swing (progress .5→.9) steers the paw toward the turn plant via the
  existing correction, and touchdown latches the exact mid-stance anchor. Touchdown shift ~96–160 mm → ~5–18 mm (one 94 mm outlier at 2.9 m/s);
  stance metrics identical to the snap version (residual p95 0/3/0 mm). New metric `maxTouchdownShift`.
- Windup accelerating out of a standing gather now shortens (never lengthens).
- Rejected: buffer-latch concern (latch only runs at windup completion; reset clears windupT). Ground sample at the shifted anchor: ≤.16 m XZ, accepted.

## Gallop suspension (suspensionLift .04)
Root lift = sin envelope over each authored zero-support window of the run gait (gathered .72–1.0 and extended .27–.46 at 9 m/s),
× run weight, grounded only. CPU (tools/loco-suspension-probe.ts): 9 m/s pelvis no longer sinks to its 59 cm low through the gather
(peaks ~65 cm mid-flight), stance residual 12.9 mm and slide .78 m/s unchanged; zero at every touchdown/lift-off.

## Capture review of main be5ce07 (relay loco-r2 d32ee2ff3573, partial worldgait; side lens) — 04:30 ET
Personally inspected dense crops (artifacts/evidence-be5/{run-gather,turn-dense,jump-dense}.png) + per-frame __game.
Live telemetry: turn (0.6 rad/s trot) pelvis bank 6–9°, slide p95 .06 m/s, 0 forced re-steps, touchdown shift ≤2 mm; gallop suspension 4 cm;
moving-jump landing −4 cm; cadence 1.85/2.14/2.40 Hz. Sol visual critique unavailable (Codex quota exhausted until Nov 4) →
independent game-feel-critic subagent (fresh context): gather still the LOWEST pose (hunch) — NEEDS REVISION; turn skate PASS by telemetry,
bank not visible at 0.6 rad/s; jump air pose PASS, landing compression invisible; hind-thigh flap FAIL (skin seam, mesh owner).
Follow-up (branch only, not landed — no capture yet): gatherLift .09 for the window after fore stance (gathered flight) vs .04 extended;
CPU 9 m/s pelvis gather peak 68 cm vs extended 65 cm (was 64 vs 66); residual 12.9→15.2 mm, slide .78→.91 m/s. landSquash .20→.28.
