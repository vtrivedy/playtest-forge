# Full-route snow framing recheck — Reed

Tested pushed Cedar integration `417c5587495fbdac993c863ee14fae05f8d48044` (includes fecf2ee). Production T4/EGL, 1280×720, 280 wall seconds, 30 Hz input, one initial wake placement and no later teleports or progression hooks. 7740 simulation ticks / 258 seconds. All 11 canonical journey checks pass; no JavaScript errors. TypeScript, Vite production build, and lint:feel/camera checks pass on the local merge.

| Stream | Black / decoded frames |
|---|---:|
| Native | 0 / 6864 |
| Staged | 0 / 7740 |
| Compositor | 0 / 2580 |

Snow onset inferred from telemetry at wall 216.264 seconds. Native frame at snow +1 second now shows the whole hero and ember ring, with “Let the year turn.” readable underneath. This resolves the below-frame hero seen on integrated 2f5af69 at the same relative time. Native title frame at snow +15 seconds fits hero and all three kits, separated and uncropped. The Press remains a large backdrop. These sampled stills support composition, not an uninterrupted motion-quality verdict. This is an authored-route regression, not blind discovery or broad world-boundary coverage.

Evidence on volume `keeping-swarm5-captures`: `reed/boundary-baseline-417c558749-174006-de3e61` includes all three videos, telemetry, checks, and black-frame audits. Local `/captures/reed/boundary-baseline-417c558749-174006-de3e61` includes native video, report/run JSON, and `snow-plus1.png`, `snow-plus4.png`, `card.png`.
