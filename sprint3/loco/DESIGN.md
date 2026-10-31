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
