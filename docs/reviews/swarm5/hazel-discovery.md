# Discovery invitation — Hazel, swarm5

The opening page now waits in front of the waking fox, then flees down the village exit. Four warm leaf-shaped scraps lead from the first catch through the canopy and paper ruin. Canvas instructions teach each action when it becomes relevant. The first chase is forgiving; later stages retain their dodges and three-catch progression.

Guidance continues after the airborne third catch until the fox actually lands on the overlook. A missed landing reuses the opened-paper route. Completion requires both the ruin's authoritative arrival event and current grounded support, expressed as a private typed contact token. The next story cue remains available afterward.

## Proof

Final production source: `66dac7757b17ce8b335a8ff9f01323aa74d031ee`.

- Clip: `/captures/hazel/discovery-final-66dac775/discovery.mp4`.
- Full `window.__game`, input-derived trace, assertion results and tool hashes: `/captures/hazel/discovery-final-66dac775/evidence.json`.
- Frames and final still live beside the clip. Capture is 50 simulation seconds, 640×360, 15 fps, offline fixed-60-Hz simulation, silent. It does not measure real-time rendering performance.
- All 13 assertions pass, all 750 frames and the final still captured. First/second/third catches: 1.7167 / 13.1333 / 43.8333 s. Grounded `land → done`: 44.5167 s. One roost visit, two ruin misses and recovery, zero skips, zero JS errors.
- Rendered versus simulation-only counterpart: all 217 common samples have identical rounded positions and full page state. This comparison covers this route, not every possible input.
- Final own visual review: fox silhouette and page goal readable, four anchored leaf guides distinct from rectangular Album page, action words readable against the sky, landing pose fully in frame. Independent final verdict is recorded below, including a canopy camera limitation.

The route-independent cue policy starts at the ordinary wake position, including 1.5 seconds idle. It uses ordinary movement/jump/dash inputs, camera-frustum fragment geometry and currently shown teaching words. It has no authored waypoint route and does not read hidden discovery goal/action/leg to steer. Geometry observation is not pixel vision or an occlusion guarantee. This proves the cue-following policy, not an unfamiliar human trial.

Additional checks:

- `/captures/hazel/discovery-safe-land-confirmed/evidence.json`: production simulation-only, all 13 assertions pass; grounded guidance completion at 44.5167 s. No-idle variant also passes at approximately 34 s.
- `/captures/hazel/naive-cue-68a252f0/naive.json`: 90 s cue-policy trial after integrating newer controller/subtitle work; three catches, kept page, actual overlook visit and completed guidance; one unstick, 0.85 stuck seconds, zero JS errors. The earlier `66dac775` run had the same milestones and one unstick / 0.88 stuck seconds.
- Matched original blind-policy controls, 120 s, seeds 1–3, same tool and manual clock: baseline `591e04b9` first catches 0/0/0; `4f67f9ac` 1/1/0. All six have zero overlook visits. Random wandering still does not solve the jumping route; keep that distinction when citing discovery results.
- Original authored 110 s page route on `4f67f9ac`: three catches, page kept and pinned home, finite state, zero JS errors. `/captures/hazel/page-regression-4f67f9ac/`.

## Structural regression protection

`Discovery.tla`: 112 generated / 38 distinct states, no errors. Removing the grounded Finish guard fails `DoneAfterLanding` in five states. The model covers state synchronization and completion safety, not continuous geometry or reachability. `TeachOrder.tla`: 4/4; early publication and delayed text redraw have failing negative controls. `RunawayPage.tla`: 24/9, retaining the three-catch accounting.

`lint:feel` includes AST checks and negative fixtures for early teaching consumption, delayed replacement words, direct guide completion and raw-token bypass. TypeScript requires narrowing the nullable contact proof. New simulation work lives in `discovery.hot.ts` with pooled temporaries; state exposes read-only support views. TypeScript, Vite production build and feel lint pass after integration merge `68a252f0`.

## Visual iteration and preserved failures

Peer reviews identified an exhaust-like swarm of tiny scraps and confusion between rectangular guide cards and the real page. The final version uses four anchored leaf silhouettes, a brighter glow on the real page, Follow before Dash, and immediate instruction replacement. Earlier captures remain under `/captures/hazel/`; the aborted `discovery-final-7a4cecdd` exposed the airborne completion bug, and `discovery-safe-land-sim` exposed an outer-pad/arrival-event discrepancy. Neither is presented as a successful final capture.

Independent final review — Reed, 2026-11-02 18:30 UTC: first goal PASS; leaf-versus-page PASS; action words PASS. He reviewed a 2 s continuity sheet, 13–16 s at 4 fps, all 13 evidence checks and the recorded game state. Recovery and retries read clearly. He flagged a separate camera defect: an opaque canopy branch/trunk briefly crosses the lens around 14–15.25 s, nearly filling it at 15 s. This is retained in the final clip and sent to Thistle; the discovery evidence does not claim camera perfection or classify that obstruction as a GPU black frame.

## Integration recovery regression and correction

Integrated `68a252f0` changes the recovery path enough to miss the overlook after the third catch. At 49 s, the finale then replaces the still-active discovery jump instruction with “Follow the warm light home.” The cue follower stops jumping and remains below the paper platforms through 90 s. The real landing guard correctly withholds completion. The original successful `66dac775` clip remains valid on its source; it does not prove this integrated recovery.

Candidate `f8442a9d` adds a read-only `canTeachOnward` callback, supplied by scene as `discovery.finished`. The finale only offers onward words after real discovery completion. The controller, motes, caption handling and grounded support gate are preserved. The existing `noCompetingHearthHint` assertion now also rejects the onward line during active discovery. The recorded failed trace provides a negative control: 166 competing-hint samples, first at 49 s; the original successful clip still passes the stronger assertion.

Controlled production experiments, fixed 60 Hz simulation with 1.5 s idle:

| Source / controlled substitution | Result | Evidence directory under `/captures/hazel/` |
| --- | --- | --- |
| Current `e3f785b1` (68-equivalent), 90 s | Kept page, missed overlook, active `jump1`; inspected final screenshot shows wrong onward words | `recheck-e3f785b1-state/` |
| Same source, only controller restored verbatim from66 | All 13 checks; grounded done44.5167 s | `recheck-current-old-controller/` |
| Same source, current controller retained, only onward teach disabled | All 13 checks; grounded done55.95 s | `recheck-current-no-onward-teach/` |
| Actual guarded candidate `f8442a9d`, 65 s | All 13 checks; grounded done55.95 s; inspected final still shows whole fox on overlook and appropriate onward words | `discovery-priority-f8442a9d-state/` |
| Guarded candidate merged with keeping `ecb7d903`, tip `c0eb9d41`, 65 s | All 13 checks; same grounded done55.95 s; all283 sampled rounded positions match candidate | `discovery-priority-c0eb9d41-integrated/` |

Each directory contains `evidence.json` with full state and trace. Deliberate experimental substitutions have a separate `control.json` with file hashes; they are diagnostic controls, not shipping rollbacks. Only the failed current run and actual candidate state run captured final stills (`end.png`); the other state-only controls intentionally disabled snapshots.

The controller first changes the sampled recovery position at 33.5 s, but the retained current-controller experiment proves that it can recover once jump words retain priority. A physics rollback is unnecessary for this reproduced failure. Reed independently reproduced the pre-fix failure in both production and development; render cadence was an early unsupported hypothesis, and camera/scene matrices refresh each simulation tick.

TypeScript, production build and feel lint (including camera envelope and world bounds) pass on the merged candidate. Discovery TLC remains112 generated/38 distinct states. These structural checks do not establish route reachability.

Continuous verification is complete on two render backends:

- Local production `f8442a9d`: 60 s / 4 fps, all240 frames, all13 checks, zeroJSerrors, actualgroundeddone55.95 s. `/captures/hazel/discovery-priority-f8442a9d-rendered-detached/` contains `discovery.mp4`, full `evidence.json`, `end.png`, and inspected `recovery-review.jpg` / `landing-review.jpg`. The 45/47/49/51 s sheet preserves landing words and retry jumps; the 49/53/56/59 s sheet shows the final retry and homeward words only after the landing. Whole fox silhouette and action words remain readable in these recovery frames. The known earlier canopy occlusion caveat remains separate; this candidate does not include Reed's stem patch.
- Independent Reed T4 production `c0eb9d41`: 70 s /15fps, all1050 frames, all13 checks, zeroJSerrors, grounded done55.95 s after four ruin misses. He found zero active-discovery warm-hint samples and58 post-completion warm-hint samples, and inspected continuity plus the43–60 s retry sheet. Evidence volume `reed/discovery-priority-c0eb9d41` (same capture-directory name on Reed's workspace). His narrow source review confirms the callback is read-only and correctly gated.

The first local 60 s/4fps foreground attempt was terminated after57 frames and remains under `discovery-priority-f8442a9d-rendered/` as incomplete negative capture evidence; it is not used as a successful replay. Blind-wander overlook discovery remains open.

## Exact-tip blind control after recovery approval

`2551ca124a8473b3d3476f6fa4be3277f9050915`, unchanged original blind policy,
120 seconds, seed 1, corrected stuck detector: one catch, no overlook visit,
minimum overlook distance 9.4178 m, 12 unsticks / 8.08 stuck seconds, zero JS
errors. Full saved game state and trajectory:
`/captures/hazel/blind-2551ca12-seed1/naive.json`. This is simulation-only evidence;
it contains no screenshots or motion capture.

The fox leaves the village and passes the canopy rather than taking its jumping
route: position (-4.0,68.6) at10 s, (3.7,58.5) at20 s and (-16.4,57.1) at30 s.
Eight unstick events cluster near the Millbrook edge (-67..-66,104) during60–74 s,
outside the village test area. These coordinates identify a replay target, not
a verified geometry cause. Sent to Thistle. This independently reproduces Kit's
blind-control finding; it does not satisfy the unaided-overlook requirement.
Discovery TLC recheck remains112 generated /38 distinct states, no errors.

## Five-minute unchanged blind control

On `bcc9747821bf94c6d70a26b8621bc9b38862da81`, seed2 with the original blind
policy ran the full300 simulation seconds: one catch, no kept page, no overlook
visit and no completed guidance. Minimum horizontal overlook distance was
5.5146m;32 unsticks /24.92 stuck seconds; zeroJSerrors. It left the village and
entered Millbrook. Full state and trajectory are saved in
`/captures/hazel/blind-bcc97478-seed2-300/naive.json`. This is simulation-only
evidence, with no motion-quality or visual claim.

The fox passed south of the canopy at20s (-10.5,57.9), then west of the ruin
at50s (-35.4,80.6); merely extending the run to five minutes did not recover
the missed traversal. The blind policy deliberately ignores both rendered leaf
guides and action words. Its failure remains a failure of the requested blind
control, even though the separate cue follower completes the route. Do not
silently replace that requirement with the cue-policy result or weaken the
real-landing guard to make the score pass. No gameplay change accompanies this
control. Discovery TLC rechecked112 generated /38 distinct states, no errors.

Bounded visual replay on the same source:60 simulation seconds, one screenshot
every2 seconds,30 frames; `/captures/hazel/blind-bcc97478-seed2-visual/`
contains the movie, full `window.__game` in `naive.json`, and `review.jpg`.
All120 half-second rounded trajectory samples exactly match the corresponding
prefix of the300-second state-only run. The movie plays at4x simulation speed;
these sparse frames support only a composition/path observation, not continuous
motion review. The first catch and leaf invitation are visible, but the blind
fox runs around the canopy and up the adjoining slope. Large foreground geometry
obscures part of the fox around14–22s and again near tree trunks later. This
source predates Reed's stem-fade fix; a combined-tip comparison is required
before calling that an unresolved integrated defect.

Combined comparison completed on immutable
`b13dfe15800b4c3a4d9e5f2f9b6e875651432216`, which includes Reed's stem fix.
The24-second replay has12 frames and zeroJSerrors; all48 sampled positions
match the baseline prefix. The20s still retains the same large foreground
obstruction and partial fox. Evidence:
`/captures/hazel/blind-b13dfe15-seed2-occlusion/` (movie, frames, full state).
This approach therefore remains a separate camera finding after the stem fix;
the mesh responsible has not yet been identified. It does not invalidate the
independently approved13–16s cue-following stem improvement.

## Blind-approach obstruction identified

A read-only inspection replay on the same immutable `b13dfe15` source identifies
the large foreground obstruction as terrain, not a canopy stem or tree.
At20s, camera position is(-12.3058,5.3955,57.4716) and fox feet are
(-10.4613,3.7253,57.9273). A45-ray screen grid hits the same unregistered
`PlaneGeometry` terrain mesh(runtime id69) first on29 rays. The sample at
NDC(-0.4,0) hits it only0.4630m from the lens. This is a ray sample count,
not a pixel-area measurement.

`before.png` reproduces the diagonal terrain sheet covering the left half of
the shot and part of the fox. Hiding only mesh69 for `hidden-first.png` reveals
the complete fox and removes the ground sheet elsewhere too. This isolates the
visible blocker; it is a diagnostic intervention, not a proposed terrain-fade
fix. Both stills were inspected. The control ends after20s with one catch,
zeroJSerrors and unchanged gameplay input policy. No gameplay source changed.

Evidence is uploaded and listed in Modal volume `keeping-swarm5-captures`,
directory `hazel/blind-b13-mesh-diagnose`: full `window.__game` in `naive.json`,
all ray hits in `mesh-diagnosis.json`, both stills and the exact temporary
`probe.mjs`. The first two inspection attempts failed because Vite denied the
probe's dynamic inspection import; the successful helper grants access only in
its own temporary server configuration. Neither failed attempt is verification.

Source observations for the camera owner: `lookdevGround.ts:buildGround` creates
terrain as a deformed `PlaneGeometry`; opening meadow terrain is intentionally
excluded from prop occlusion. `camera.ts:sweepBoom` can retain minimum body room
past a blocking surface and report `boom.fade`, but prop cutouts exclude terrain.
This is an investigation lead, not proof of which camera branch caused this
specific pose. Thistle and Reed received the mesh, pose and diagnostic result.
Reed independently reproduced the opaque terrain/partial-fox screenshot on an
unchanged runtime equivalent to `b13dfe15`. The previously approved canopy stem
fix remains a separate, narrower result. Blind discovery still fails.

## Exact terrain owner and lens clearance

A second read-only replay of immutable `b13dfe15`, unchanged blind seed2 at20s,
records the blocker's geometry parameters: width120, height85,170×120 segments.
These uniquely match the meadow `buildGround` call (`meadow.ts:247`,
`BOUNDS.rx*3` and `BOUNDS.rz*3.4`), rather than Millbrook, Hermitage or finale
ground. The final fox and camera positions exactly reproduce the earlier probe.

The lens is above the terrain: cameraY5.395522, analytic groundY5.115522,
rendered triangle groundY5.104050. Its analytic clearance is0.28m. Six samples
between fox feet and lens show rising ground from3.725285 to5.115522. The
inspected `before.png` still shows the same diagonal foreground sheet covering
part of the fox. Thus an endpoint floor guarantee does not establish a clear
sightline to the whole animal; this is not evidence that the lens is buried or
that rendered and analytic terrain disagree substantially. The earlier
`readableT` branch remains a source hypothesis, not an instrumented branch trace.

Evidence: `/captures/hazel/blind-b13-owner/`, including `mesh-diagnosis.json`,
`before.png`, diagnostic mesh-hidden still, exact temporary `probe.mjs` and
full `window.__game` in `naive.json`.20s input-only replay, onecatch,
2unsticks/1.37stuckseconds, zeroJSerrors. The owner metadata and endpoint
measurements were sent to Thistle and Reed; no gameplay or camera code changed.
