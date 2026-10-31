# Glide-first locomotion — scoped Sol pass

The fox should flow along the ground with measured footfalls, quiet shoulders, and a continuous gait. Preserve move + jump + dash and hold-jump glide. Preserve route speed and jump reach in this first pass.

## Changes before capture
- Widen walk/trot/run blends and use their actual smoothed weights for both phase distance and foot support. Retain contacts across gait-name changes: dominant gait is a reporting label, not a physical event.
- Add a conservative tunable stride extension (8%) with existing bounded contact IK absorbing the extra stance travel. Report cycle frequency and effective stride. Reject extension if GPU reports show residual/slide growth or knee reach failure.
- Reduce repeated head bob, soften braking compression, and damp ground steering into the turn instead of an immediate constant angular-rate corner. Keep yaw and velocity aligned.
- Reduce grounded acceleration while preserving top speed and air/dash/jump parameters. No new art/assets/licenses.

## Validation / rejection
TypeScript and fox Vite build. Remote GPU gait gym at walk/trot/run, side and chase, before baseline 2e0e614 and candidate with matching controls. Inspect all supplied PNGs and window.__game contact metrics. Ask Opus to critique contact handoffs, cadence, and turn weight. No merge or visual-pass claim before evidence. Capture artifacts and comparison belong in /streams/loco/artifacts/glide-ab/.

## Risks
Longer cadence can outpace authored stance sweep; bounded IK is only a small correction, not permission for skating. Broad blends can disagree on support: use actual evaluated weights and preserve contacts only while support remains. Keep the extension small pending captures; do not introduce a separate animation path.

## Opus code review follow-up
Separate ground acceleration/turn tunables from inherited air parameters. Damped angular velocity turns the heading; scalar ground speed follows that heading to prevent lateral skating. Normalize contact votes, add stance hysteresis, and keep IK strength consistent through a stance. Blend head bob from evaluated run weight, never the gait label. CPU A/B found 8% extension increases trot reach residual; reduce to 3% until captured foot contact can justify more. Preserve fast authored landing/air exit fades.

Second Opus review: retain incoming signed/lateral momentum on landing, transport existing ground velocity with the body's incremental yaw, and damp lateral recovery instead of redirecting its full magnitude. Ground dash faces its impulse. Fade cached foot correction briefly into swing so the authored pose does not receive the entire contact offset in one frame.

## Transition rig diagnostic
CPU ramp (1.4→9→1.4m/s over 5s repeated) revealed inherited large contact-solver failures. Baseline peak reported residual 1.14m; broad candidate 1.00m. Narrowed speed blend half-widths to .35m/s, retained longer temporal easing, raised release threshold from .30 to .45: ramp peak 0.46m; steady 6m/s turn residual ~40mm versus broad pass ~90mm, baseline ~36mm. These are failures requiring GPU inspection, not acceptance. Prefer narrower candidate; do not merge on CPU results.

## Round 2 — contact handoff correction
Returned 90483ad capture personally inspected: deep gathered gallop, elevated tail, almost invisible anticipation. Cadence only 3% below baseline is insufficient. Parallel Opus branch supplies a separate phase-warp candidate; evaluate it rather than duplicating authored work.

For this branch's remaining mixed-gait failure, contact votes alone cannot establish support when the rendered mixed pad is high in recovery. Gate touchdown against actual rendered pad height and retain support only while the requested vertical correction remains in the bounded IK envelope. Explicitly report rejected support votes and their maximum height: no residual suppression disguised as success. Preserve existing IK correction bound, report missed support, and verify CPU ramp + captured transitions before any acceptance. Reject this approach if it trades a stretch/pop for unsupported floating.
