# Integrated ending camera replay — Reed

Source b8caa4a09d3ae936ea4d888d7a4d4819c7e8a5e6 merges Cedar 9d353f9 into the previously tested Hazel/Maple integration f72297a. T4/EGL production build, 1280×720, 280 wall seconds, fixed 30 Hz inputs driven by real-time rAF. One initial wake placement, no later teleports or forced progression. 260.067 simulated seconds.

All 11 journey checks pass; no JavaScript errors. TypeScript, production build, and lint:feel/camera checks pass.

| Stream | Black / decoded frames |
|---|---:|
| Native | 0 / 6958 |
| Staged | 0 / 7802 |
| Compositor | 0 / 2601 |

## Visual review

Snow begins at approximately wall 215.130 s, inferred from the first snow sample's wall time minus snow timer. At snow +1 s (216.130), the camera still faces the Press and the foxes fall below the frame. At snow +4 s (219.130), the hero and all three kits fit comfortably; the Press fills the left third. The title frame at 229.864 is large and legible, with hero separated from kits; the leftmost kit is partly occluded by the Press base. This improves lower-edge cropping, but the early snow handoff still needs the ending owner's attention. Stills do not establish continuous transition quality.

## Evidence

Volume keeping-swarm5-captures, reed/boundary-baseline-b8caa4a09d-170628-e873b9 contains paired WebMs, compositor sequence/movie, full game state and route checks in report.json, run.json, decoded audits, start/end screenshots. Local /captures at the same path contains report/run/native/end and extracted snow-plus1.png, snow-plus4.png, card.png. The extracted frame times are above; snow time is accurate within the one-second state sampling interval and real-time scheduling variation.
