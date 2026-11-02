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

## Follow-up: integrated controller regression (18:46 UTC)

The original final clip remains valid on `66dac775`; it does not establish that integrated `68a252f0` completes discovery. Reed's later replay caught the page but missed the final landing, and guidance correctly stayed active. An early hypothesis about capture cadence was not supported: scene and camera matrices refresh each simulation tick, and both production and development replays reproduced the failure.

Hazel rebuilt current `e3f785b1` (game source equivalent to integrated `68a252f0`) and ran the production probe with 1.5 s idle, 90 s, no intermediate renders. The page was kept, but the fox remained below the platforms at `jump1` through 90 s. Full state and input trace are in `/captures/hazel/recheck-e3f785b1-state/evidence.json`; the completed final screenshot is `end.png` beside it (inspected). It visibly shows the fox below the paper platforms, with the competing onward instruction.

A controlled isolated worktree at the same revision restored **only** `games/fox-spirit/src/lookdevPlay.ts` verbatim from `66dac775`. The same rebuilt-production state-only probe (50 s, 1.5 s idle) passed all 13 assertions and completed the grounded landing at **44.5167 s**, exactly matching the original clip. `/captures/hazel/recheck-current-old-controller/evidence.json` contains the full state and trace; `control.json` records the deliberate uncommitted controller substitution and both file hashes. This experiment is diagnostic, not a proposed rollback or a shipping candidate. Its final snapshot was disabled.

The current and original sampled rounded positions first diverge at 33.5 s, during the first grounded recovery below the paper platforms: original position `[-28.091,-0.632,73.054]` with zero velocity; current `[-28.132,-0.629,73.031]` with velocity `[1.834,0,1.36]`. Earlier common sampled positions match. The controller wall-slide change is therefore an isolated cause of the changed outcome; the exact correction remains with Thistle. No guidance, policy or observer code changed in this follow-up. Landing safety remains correct, and the blind-wander limitation remains open.

Fresh structural checks: TypeScript passes; Discovery TLC passes with 112 generated / 38 distinct states. Neither proves route reachability. A new integrated rendered discovery clip and state gate are required after the controller correction.

The failed current trace also exposes an onward-teach conflict: at 49 s the shown words become “Follow the warm light home” although discovery is still active at `jump2`. That turns the cue policy's jump action into follow and can prevent recovery. Cedar owns the provider priority correction. The existing `noCompetingHearthHint` assertion is strengthened to reject this onward line while discovery remains active; the prior successful current cue run did not exercise this exact missed-landing recovery. This follow-up changes the diagnostic assertion only, not guidance or physics.
