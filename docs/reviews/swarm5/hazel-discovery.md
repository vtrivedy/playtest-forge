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
