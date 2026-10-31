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

Height-gated contact experiment rejected: ramp peak residual only fell from .46m to .31m with 4.78m/s solved-pad slide; steady turn remained .04m. Height gating alone cannot reconcile incompatible trajectories and would discard support without correcting motion. No runtime change retained. Evidence /streams/loco-r2/artifacts/cpu-contact-heightgate.jsonl. Next compare phase-warp alternative before further contact changes.

## Round 2 integration candidate
Frozen GPU traces confirm phase-warp alternative cadence 1.85/2.15/2.40 Hz versus baseline 2.97/4.22/4.87. Sol 90483ad only achieves 2.89/4.10/4.72. Provisional choice: adopt Opus phase-warp/carriage implementation with attribution from s3-loco-glide, retain Sol heading-aligned signed ground momentum and dash-facing fixes to avoid restoring vector-turn slide. Keep Opus cadence tunables, jump crouch input, and a single runtime. Merge on s3-loco only; no main landing before captured integration + critique. Validate captured mesh pad traces cautiously: lowest-vertex identity changes confound gallop slide, so inspect actual images and report this limit rather than treating a zero IK residual as proof.

## Phase-warp contact continuity experiment
Integrated phase-warp CPU ramp peaks at .077m residual / 4.63m/s solved-pad slide. Compare preserving stance across reporting-label changes, normalized contact vote hysteresis, stable plant strength, and 40ms correction release already developed on Sol. Keep these only if ramp/turn/reverse metrics do not regress materially; residual and slide remain visible. No acceptance based on metrics alone.

## Toe-clearance probe
Fixed core-mesh vertices confirm integrated near-floor recovery movement is real: trot near-floor median .44m/s vs baseline .005, gallop p95 7.63m/s vs 1.26. These samples include toe-off/touchdown and do not alone prove skating, but warrant a controlled trial. Try a bounded 0 / 1.5 / 3cm minimum recovery clearance, eased to zero at touchdown/toe-off, only for grounded free paws. The same two-bone solver applies it; do not redefine support or hide residual metrics. Report recovery clearance separately. Reject if it creates floating pads or breaks reach; request a fresh capture if retained.

Recovery-clearance floor rejected: 1.5/3cm trials did not reduce near-floor high-speed tails and elevated the walk pads. Runtime restored. Next compare full endpoint-tangent swing ease (1.0 versus .35); the existing comment promises continuous clip rate only at 1.0. Keep only if diagnostics improve without worsened reach.

## Integration critique follow-up
Opus review found head-bob gait-label discontinuity, mutable plant strength, correction release bypasses (re-step/quick re-entry/missing terrain), stance-ratio remapping during acceleration, and full-vector speed driving forward gaits on sideways landings. Restore evaluated-weight head bob; latch full plantStrength on touchdown and preserve the currently corrected contact when re-anchoring; treat missing terrain as recovery instead of returning early; drive grounded cadence with nonnegative forward velocity projection. Keep actual total speed for physics and action selection. Probe swingEase .35/.65/1: full tangent substantially improves flat near-floor walk/trot p95 (.77→.003 and 5.58→.43m/s), though gallop still ~4.26m/s, so pick 1 with explicit gallop risk. Instrument stance-ratio rate before changing its timing model.

Ratio instrumentation after main merge: worst ramp slide 3.20m/s occurs at ratio rate .535/s; maximum ratio rate 1.61/s. Steady turn slide 2.25m/s occurs at zero ratio rate, so ratio remapping does not explain all remaining error. Test bounded ratio response only as a reversible CPU experiment; reject if it trades remapping for stance speed mismatch/reach error. Current capture candidate remains ffce175 until evidence supports another change.

## Follow-up blockers
Opus follow-up confirms six fixes but finds two new edge failures: a continuous re-anchor can repeat at the correction cap, and forward-only cadence can freeze a walk pose during sideways/backward landing travel. Release an overextended contact before the cap for a short recovery interval (80ms) before normal replanting; count the release once. Select existing skid pose when non-forward ground travel dominates, keeping actual momentum. Clarify Hermite endpoint match is bounded by the monotonicity cap. No extra gameplay verb or parallel animation path.

Ratio-response-8 trial rejected: ramp residual .064m vs .057m and slide 3.37 vs 3.20m/s. No runtime change retained. Fixed-mesh probe source retained as tools/loco-mesh-contact.ts; it tracks consistent vertex IDs and reports near-floor motion plus a low-vertical-speed subset. The full-tangent choice reduced flat near-floor trot p95 from 5.58 to .43m/s in CPU trials but gallop recovery still needs visual assessment. No metric-only pass.

## Gather fix selected from parallel Opus pass
Dense personally inspected GPU frames show the gathered gallop pinching the back and crowding the thigh against the flank. The parallel Opus pass c5f96dd independently identifies the same failure, damps authored spine flex toward the cycle mean, and removes the body-lift experiment after it caused reach slip. Our merged-main lift also worsened steady turning/slope residuals. Adopt that scoped fix with Opus attribution; retain existing Sol contact/controller fixes and full swing tangents. Evaluate lower-leg recovery tuck separately only after the spine pass. Exact old ed80e9c capture remains useful as BEFORE for this correction; request a fresh combined capture for the new candidate.

## Driver 22:35 ownership — bank, jump, suspension
Merge current main (5986881) including the selected Opus cadence/spine/recovery tuck. Preserve 1.8/2.1/2.4Hz design targets. This stream owns body banking, jump/landing weight, and suspension on top.

Turn-bank trial: the current lean is distributed only through the spine, leaving the pelvis/hip mass upright. Try sharing 0 / .45 / .65 of the same bounded bank with the pelvis, with the remainder through spine; preserve total chest angle, head roll partly stabilizes, and IK maintains contact. Expose actual bank angle, windup load, landing impulse and no-support frames in __game. Choose a conservative share only if CPU turn/reverse and slope contacts do not regress materially, then require side/chase captures for visible weight. No speed/cadence or physics reach changes.

Bank critique follow-up: use a damped grounded-only pelvis share so ordinary jumps retain the inherited air pose. Rename spring output bankCommand and measure actual rest-relative pelvis/chest bank from bone up vectors. Separate authored-flight votes from zero solved supports, count both support-loss frames and seconds, and clear diagnostic counters/last impact on reset. Report raw landing impact (0..1), while the spring may retain its minimum perceptible response. Seeded tests favor .45 over .65 with <.3mm contact regression; unseeded variants are invalid A/B evidence and retained only for audit.

Bank coverage: seeded .45 vs 0 share gives turn residual .03160 vs .03138m; reverse .03188 vs .03163m. Incline turns ±15° add .7–1.1mm residual over zero-share and retain the existing ~.07m worst error, explicitly not a contact pass. Air/glide turns settle to identical measured pelvis angles with .45 and 0 because the added share fades out. Choose .45 conservatively; no cadence changes. Both authored contact-flight and solver no-support are now independently observable. Opus axis/sign/overlay review found no blocking bank bug; metrics/air changes receive follow-up review.

## Standing jump gather blend
CPU actual-rig windup probe found existing .04s pose blend drops chest 10cm on frame 1, then rises on frames 2–3: a pop/recovery rather than load/push. At .12s, drops are 6.35cm then another 1.73cm, then a 2.49cm push; all four supports stay down and max residual falls .011→.0067m. Opus design review approves a standing-only slower blend, with no change to the .05s physics windup or clip clock. Use the same 1→3m/s smooth gate as procedural crouch, returning to original .04 above 3m/s so running jumps remain unchanged; expose jumpGatherBlend=.12 in lil-gui. The same-clip .12 fade carries into the first ascent frames intentionally; no restart/extra lag. Verify standing and running jump PNGs at the exact capture SHA before acceptance.

Speed-gated gather probe (same phase/inputs) confirms 4.05 and 9m/s trajectories are identical to existing .04s blend. At 1.62m/s, first-frame drop .0466→.0311m with zero residual; at 2.6m/s, peak residual .0305→.0267m. Standing first-frame drop .0999→.0633m and max residual .0111→.0069m. Retain the smooth gate; evidence cpu-windup-speedgate.jsonl. These are pose diagnostics, not GPU approval or changed jump physics metrics.

## Long-fall pose hold
Found jump_fall configured as looping although its authored start is tucked and its end is a landing reach. Actual GLB CPU probe confirms a .199m paw jump at each .4s wrap (frames24/48/72). Treat jump_fall as a clamped one-shot alongside jump_up/land/skid; normal state re-entry already calls reset(), so each new fall can play the reach again. Probe with LoopOnce has zero wraps and late-frame paw step .0041m. No new animation path, timing or physics change; require a long-fall GPU take when captures resume.

## Remote long-drop coverage
The normal short jump never exercises the .4s fall-clip wrap. Extend only the World1 showcase with an explicit staged 8m meadow drop (real gravity/controller, no forced pose, no settle advance), capturing takeoff/fall/reach/landing. This can cost one wisp but should not cause a death. Keep the existing first 20s segments unchanged for comparison. Correct the showcase provenance label to tracked 3/4 review camera (it uses photo overrides, not the ordinary gameplay camera). Request showcase separately from frozen gait so the new immutable capture module actually runs; gait stays matched to the frozen baseline.

Add an explicit standing-gather take after the original showcase route so its first three frames are retained even if the old moving-jump camera is occluded. Report fallPoseTime/fallPoseHeld through __game and require a held fall frame after >.4s, plus observed standing windup/air/land, in the remote acceptance JSON. These review fixtures exercise the new secondary work with real physics and keep the original first20s unchanged.

Diagnostic follow-up while GPU pending: include fixed-vertex height minima, not only median/p95/max. Near-floor speed subsets exclude deep toe penetration, so they must never be cited alone as no-skating evidence. Read the actual mesh's low points in the current main-derived gait and retain any below-ground failure explicitly; cadence/forepaw timing remains the Opus stream's ownership per driver.

## Driver 23:05 — forelimb skim integration
Merge main375ff0d and take its selected gait/cadence, neck-only head carriage, late-swing ground clamp and early touchdown. Preserve this stream's bank, standing gather, clamped long fall and continuous bounded contact/release. Use the upstream placePaw helper as the one IK path; integrate the swing floor into the existing cached correction so a ground-clamp correction cannot vanish at lift-off. Keep maxCorrection bound and expose early touches, clamped feet and pre-clamp penetration rather than suppressing residuals. Then inspect fixed mesh vertex minima and test carpal recovery fold/paw lift if the skim persists. Current pre-merge gallop fixed vertex minimum -.096m is a documented failure.
