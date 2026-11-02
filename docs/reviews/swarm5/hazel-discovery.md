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

## Follow-up: capture cadence sensitivity

Reed reported a separate 50 s / 4 fps run on his integrated stem-fade candidate on 2026-11-02 at 18:40 UTC: three catches and a kept page, but a missed final landing left guidance active at `jump1`. The final 15 fps proof above remains scoped to its recorded source and cadence. Reed confirmed the discovery probe, policy and guidance code matched this branch; this is not explained by stale tools. His 90 s follow-up was still pending when this note was written.

The geometry observer projects fragments through the camera matrices. Render cadence can affect when those matrices refresh, so cadence-dependent projected perception is a plausible explanation, not yet an isolated cause. The matching rendered/simulation-only samples above cover those two recorded runs only. They do not establish cadence independence. The missed landing is a retained negative result; correctly withholding completion is the expected safety behavior. No guidance or observer change is justified by this report alone.

Correction at 18:42 UTC: Reed identified a development-versus-production mismatch in that comparison and started a matched production replay (`--production 1 --seconds 50 --idle 1.5 --render-every 4`) plus a production state-only gate. `render-every 4` means 15 fps at the fixed 60 Hz simulation clock; the earlier 4 fps capture used a different cadence. Static inspection also finds `scene.updateMatrixWorld(true)` in every simulation frame and `camera.updateMatrixWorld()` in every camera update, so stale camera matrices are not an established explanation. Treat build mode, source revision and capture cadence as separate variables until the matched results arrive. The successful original clip and failed development replay remain separate evidence.
