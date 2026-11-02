# Integrated production replay — Reed

Source `2f5af69eb7fcbc109dc77b1d9d6a6cc1202ed48c`, T4/EGL, production build, 1280×720, 280 wall seconds, fixed 30 Hz inputs on real-time rAF. One initial wake placement; no later teleports or forced progression. 7,768 ticks / 258.933 simulated seconds. Actual renderer reports antialias:false; no context override.

All 11 canonical journey checks pass. Page: three catches, zero skips, kept. No JavaScript errors. TypeScript, production build, feel lint and camera release checks pass.

| Stream | Black / decoded frames |
|---|---:|
| Native | 0 / 6905 |
| Staged | 0 / 7768 |
| Compositor | 0 / 2589 |

## Visual review

Snow begins approximately wall 216.380 s (first snow state wall time minus its snow timer; one-second sample precision). Native snow+1 s still centres the Press and crops the foxes at the bottom. At snow+4 s the hero is fully visible; the nearest kit remains close to the lower edge. Native snow+15 s title frame fits the hero and all three kits without overlap; title/subtitle are large and legible. One kit sits directly against the Press base, but its face and tail remain visible. The Press still occupies much of the backdrop. The family shot improves the lower crop versus earlier tested versions; early snow handoff remains a visual follow-up. Stills alone do not establish continuous camera transition quality.

## Evidence and limits

Durable volume `keeping-swarm5-captures/reed/boundary-baseline-2f5af69eb7-172101-1cbfc1` contains native/staged WebMs, compositor sequence/movie, decoded audits, full game state in report.json, run.json, start/end screenshots. Local `/captures/reed/boundary-baseline-2f5af69eb7-172101-1cbfc1` contains native.webm, report/run, end, and extracted snow-plus1.png, snow-plus4.png, card.png. Extracted card wall time: 231.380 s.

This authored-route replay verifies recorder regression and integrated journey completion. It does not establish blind discovery success, village sliding feel, or exhaustive world-edge coverage.

## Snow timing cross-check

`2f5af69` already contains Cedar `80238fd` (Album clearance and 2.2-second snow ease), confirmed by ancestry and source. A redundant replay of the older Cedar branch was stopped before completion; it supplies no additional result.

The independent compositor frame `compositor/frame-01962.jpg` has timestamp minus `startEpochMs` of 217.38994 seconds. Snow begins approximately 216.3801 seconds, so this is snow +1.01 seconds. It independently shows the Press centred and the family cropped by the lower edge, matching the native snow+1 frame. This observation is not a native recording time-offset artifact. The existing title-frame verdict still stands: hero and all three kits fit, without overlap. Camera transition continuity remains unreviewed.
