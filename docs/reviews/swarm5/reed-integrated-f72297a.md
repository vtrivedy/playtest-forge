# Combined opening and world-boundary regression — Reed

Source `f72297a05ebefb41aa4846a5cb8a510cfaffa265` combines Hazel `8ef092c5`
and Maple `34da53fe` atop the previously audited integration. Production
T4/EGL, 1280×720, fixed 30 Hz inputs driven by real-time rAF, 280-second
capture window. 7,723 simulation ticks / 257.433 simulation seconds.
The reported wallSeconds includes recording finalization (296.282 seconds).

All 11 canonical journey checks pass: pinned page, steam, Keeping, bridge,
real Carry, ember placement, kindling, snow, curled kits, title shown and done.
Page catches 3, skips 0; zero JavaScript errors. TypeScript, Vite production
build and lint:feel/camera release checks pass.

| Capture | Black / decoded frames | Minimum mean luminance |
|---|---:|---:|
| Native MediaRecorder | 0 / 6,791 | 70.349 |
| Staged MediaRecorder | 0 / 7,723 | 79.391 |
| CDP compositor | 0 / 2,574 | 79.580 |

This is an authored route regression with one initial wake placement and no
later teleports or forced progression. It does not establish unfamiliar-player
discovery or independently exercise every world-mask edge.

## Visual review

Inspected end.png and native frames at 240 and 250 wall seconds. At 240 the
large title/subtitle are legible and the hero is clearly separated from kits.
The Press still dominates the right third and the nearest kit is cropped by
the lower edge during the title shot. The new far-lip rail does not visibly
obstruct these inspected finale views. It is not prominent enough in them to
judge its appearance separately. Snow and warm hearth read clearly.

No additional camera change was made in this audit; composition concerns
remain for the ending owner. No runtime changes beyond merging the two
requested candidate branches.

## Evidence

Volume `keeping-swarm5-captures`, directory
`reed/boundary-baseline-f72297a05e-165747-768030/`: native/staged WebM,
compositor sequence/movie, report.json (full game state and route checks),
run.json, decoded audits and start/end screenshots. Local same directory
under `/captures/` contains downloaded native.webm, report/run/end and extracted
card-240.png/card-250.png. Modal app `ap-IEE7fRiRa5lyfAtXmenu6d` completed.
