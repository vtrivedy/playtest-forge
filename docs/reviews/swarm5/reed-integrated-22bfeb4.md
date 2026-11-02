# Integrated GPU journey audit — Reed

Build **22bfeb4fa4cdd70a86a54ce2cfc630b278f84f9e**, all five swarm5 streams.
280 wall seconds on Tesla T4/EGL, 1280×720, production renderer without context
overrides. Actual simulation: 7,633 ticks / 254.433 seconds. This follows the
canonical authored input route; it does not establish unaided discovery.

| Capture path | Black / decoded frames | Minimum mean luminance |
|---|---:|---:|
| Native MediaRecorder | 0 / 6,121 | 70.613 |
| Staged MediaRecorder | 0 / 7,633 | 79.599 |
| Independent CDP compositor | 0 / 2,544 | 79.786 |

All 11 journey checks pass: page home, steam, Keeping, bridge, actual Carry,
ember placed, finale kindled, snow, kits curled, card shown, card done. Zero JS
errors. Three page catches, zero skips, five dashes. Final kit↔hero distance
1.14 m; three kits curled, one completed card. Canopy's recorded high→roost
flight: apex gain 2.357 m, time to apex 0.600 s, air time 1.267 s. Last dash
2.085 m. The final 5.967 s air event is a walk-off/glide, not a jump feel test.

## Visual verdict

Inspected native video frames at 240 and 250 seconds and the final screenshot.
The title and subtitle are large and legible in actual canvas recording pixels.
Hero and kits are distinguishable and separated. Hero reads much larger than the
seed review's tiny ending fox. Snow and the warm cradle carry the seasonal beat.
Remaining composition issues: the right-hand timber occupies roughly a quarter
of the frame; foreground kits approach or cross the lower crop during the slow
push. This is a clear readability improvement, not a claim of perfect staging.
No runtime change was made during this audit. Cedar owns follow-up composition.

## Evidence

Durable volume `keeping-swarm5-captures`, directory:
`reed/boundary-baseline-22bfeb4fa4-162128-482f55/`.
Contains native.webm (game audio), staged.webm, compositor-sampled.mp4, every
compositor still, report.json (full game state, timing, source/tool hashes),
run.json, decoded audits, start.png and end.png. Local copies under the same
relative path in `/captures/`; native extracted `card-240.png`, `card-250.png`.
CDP movie is a sampled sequence; real timestamps remain in report.json.

Independent checks: TypeScript, production Vite build, lint:feel/camera envelope,
black-frame bright/single-flash/blank controls and hub detector CPU tests pass.
Kit's separate blind-wander report on this build still has zero catches and
zero overlook on seeds 1–3; keep fix 1's blind-discovery requirement open.

Reproduce:

```sh
modal run tools/modal/recorder_boundary.py --ref 22bfeb4fa4cdd70a86a54ce2cfc630b278f84f9e --seconds 280
```
