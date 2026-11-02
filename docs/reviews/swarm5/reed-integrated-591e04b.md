# Integrated ending retest — Reed

Build `591e04b95b983c33c27c8901be9650db22ecc072`, production T4/EGL,
1280×720, 280 wall seconds; 7,190 ticks / 239.667 simulation seconds.
Canonical authored input journey, with one initial wake placement. This is
route regression evidence, not unfamiliar-player discovery.

| Path | Black / decoded frames | Minimum mean luminance |
|---|---:|---:|
| Native MediaRecorder | 0 / 5,363 | 70.672 |
| Staged MediaRecorder | 0 / 7,190 | 79.686 |
| CDP compositor | 0 / 2,397 | 79.809 |

All 11 journey checks pass, including actual Carry, snow, kits curled and title
done. Zero JavaScript errors; page three catches, zero skips; nearest kit 1.14 m.
Simulation throughput varies; compositor movie is a sampled sequence, not a
real-time performance claim. Full timestamps and game state are in report.json.

## Visual review

Inspected final screenshot and native recording frame at 250 wall seconds.
The title and subtitle are large and legible in canvas pixels; hero is in
profile and separated from the kits. The warm ring and snow read clearly.
The timber/Press still occupies substantial right-hand frame space, and a
foreground kit is cropped by the lower edge. Cedar's follow-up improves the
hero view but does not fully resolve those composition concerns on this route.

Telemetry tuple is `[index, front, footprintClear, postClear, sightBlocked]`.
Candidates 7–19 satisfy both clearance flags and have sightBlocked=0. My first
swarm message misread the last field as an overall pass flag; I corrected it
after checking source. No no-valid-candidate fallback defect is established.

## Evidence

Volume `keeping-swarm5-captures`, directory
`reed/boundary-baseline-591e04b95b-164907-3d64b4/`: native/staged WebM,
compositor stills/movie, report.json, run.json, decoded frame audits, start/end
screenshots. Local same path under `/captures/` also has `card-250.png` extracted
from native.webm. Source stayed pinned throughout capture. TypeScript,
production build and lint:feel/camera checks pass.

No runtime code changed in this audit. Blind discovery, world-edge fall and
slide-feel follow-up remain separate open work owned by Hazel/Maple/Thistle.
