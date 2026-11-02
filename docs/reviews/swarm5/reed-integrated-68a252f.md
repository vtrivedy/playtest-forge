# Integrated journey regression — 68a252f

Tested immutable integration commit `68a252f0cd2a3ddafef96f18b14ea55d35f9c41c`
in a production Vite build on Tesla T4 / EGL, 1280×720. The 280 wall-second
capture advances 7,780 fixed 30 Hz input ticks (259.333 simulation seconds).
One initial wake placement; no later teleports or forced progression.

All eleven canonical journey checks pass, with zero JavaScript errors. Final
state: snow, three curled kits, title card done/shown once, nearest kit 1.13 m
from the hero. `report.json` retains final state and one-second samples from the
game hooks; these hooks share the `state` function exposed by `window.__game`
in `opening/scene.ts`. `game.json` is an extracted copy of that final state.

| Capture path | Black frames / decoded frames |
|---|---|
| Native canvas MediaRecorder | 0 / 7,027 |
| Persistent staged canvas | 0 / 7,780 |
| Independent compositor | 0 / 2,593 |

Reviewed native frames near snow onset +1 s and +15 s. The early frame keeps
the whole hero and ember ring beneath “Let the year turn.” The title frame
keeps the hero and all three kits separated and uncropped; every subtitle
letter reads across the bright Album and dark timber. The large Press backdrop
and blocky ember-ring stones remain visible limitations. This is a still-frame
composition check, not an uninterrupted motion-quality verdict.

Local merged branch b3efccc passes TypeScript, Vite build, lint:feel/camera
checks, and check:stuck. The latter reports seeds 1/2/3: 5/4/4 unsticks and
2.40/2.88/3.37 stuck seconds, mean 2.88 s under the 4 s regression budget,
all with zero errors. This gate does not establish the original tenfold target;
the independent held-out audit still records that shortfall.

This authored route does not establish unaided discovery or verify the new
overlook guidance with a fresh-player policy. No gameplay changes were made.

Evidence: `keeping-swarm5-captures/reed/boundary-baseline-68a252f0cd-182025-e11193/`.
The volume contains three videos, `run.json` black-frame audits, and
`report.json` telemetry. Local same directory under `/captures/reed/` contains
native footage, reports, extracted `game.json`, `snow-plus1.png`, and `card.png`.
