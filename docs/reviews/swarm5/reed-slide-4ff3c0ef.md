# Independent wall-motion and village audit — 4ff3c0ef

## Feel critique — 4ff3c0ef / local merge 06018d37
Verdict: APPROVED for the staged wall-facing correction only.

### Concrete failures
None observed for sustained sideways body travel in this placement. This is not
an approval of all locomotion, jump/dash feel, concave-corner recovery, or the
original tenfold village target.

### What works
- Inspected the complete supplied before/after sequences through 10 Hz frame
  sheets, then independently replayed the same 180 input steps locally with
  90 screenshots and a retained 30 fps video. The corrected fox turns along
  the wall near 1.1 s, turns back after the 1.5 s input reversal, and leaves
  after 2.5 s. The baseline stays nose-into-wall substantially longer.
- Local travel/facing median angular error is 0.56° during approach/wall travel
  (steps 20–89), 1.43° during reversal (90–149), and 0.62° leaving (150–179).
  These exclude individual displacements below 5 mm; medians do not bound
  transient turn error. The first interval travels 2.771 m.
- Gait changes through walk/trot/run/lope; body and tail turn with the motion.
  The silhouette remains readable against the cottage and its contact shadow.
- Checked the high paw-slip diagnostic rather than interpreting its peak as
  continuous skating: wall peak 2.575 m/s, open-control peak 2.340 m/s, with
  only 8/180 nonzero steps in each and median/p95 both zero. This limited
  comparison does not prove perfect foot locking.

### Checklist
| Item | Pass? |
|------|-------|
| Feet plant / gait cycles | Sampled cycles present; perfect locking not established |
| Body + tail follow-through on turns | Pass for the staged wall/reversal/exit |
| Jump anticipation + land squash | Not assessed in this ground-only clip |
| Dash has weight (not teleport) | Not assessed in this ground-only clip |
| No sustained sideways body travel / rigid capsule | Pass for the reproduced case |
| Retained capture present | Pass; own 90 screenshots + 30 fps MP4, supplied comparison |

### Next patch
- Keep the wall-facing correction; concentrate further stuck work on named
  concave prop/wall traps rather than claiming the village target complete.

## Independent fresh seeds

Identical corrected naive tool from 4ff3c0ef on both builds, blind policy,
90 simulation seconds, tether 14 m, no staged start, frames disabled, fresh
browser for each seed. Separate Modal CPU8 / 16 GB SwiftShader containers.
Baseline b4fa63a needed the current tool's two discovery library imports copied
alongside the tool; neither library is used by blind policy. An initial baseline
attempt failed before play because those files were missing and is excluded.

| Seed | Baseline unsticks | Candidate unsticks | Baseline stuck seconds | Candidate stuck seconds |
|---|---:|---:|---:|---:|
| 9 | 10 | 8 | 7.40 | 6.62 |
| 10 | 30 | 2 | 24.48 | 0.47 |
| 11 | 18 | 11 | 9.72 | 7.27 |
| Total | **58** | **21** | **41.60** | **14.36** |

All six runs have zero JavaScript errors. Unsticks improve 2.76× and stuck time
2.90× on this held-out cohort. Seed 10 supplies most of that gain; seeds 9/11
still spend more than six seconds stuck per 90 s. This supports an improvement,
not a consistent order-of-magnitude result. Thistle's separately reported eight
seeds also fall short (127 → 34 unsticks; 93.9 → 25.1 stuck seconds).
These tests do not assess unaided opening discovery.

## Remaining trap locations

Mapped the retained event coordinates to `opening/village.ts` and `HOUSES`
without changing controller or geometry. These are source-based candidates for
focused replays, not verified individual collision causes.

| Seed / event time | Repeated position (x, z) | Nearby authored geometry |
|---|---|---|
| 9 / 21.37–26.35 s (six events) | approximately (-16.2, 94.6) | Cottage 0 front edge z=94.55 and crate post at (-15.816, 94.75), radius 0.38 |
| 11 / 64.65–67.63 s (four events) | approximately (-16.63, 87.0) | Cottage 3 front edge z=86.95 and crate post at (-16.236, 87.15), radius 0.38 |
| 11 / 44.33–45.32 s (two events) | approximately (-20.3, 86.97) | Cottage 3 barrel post at (-19.84, 87.1), radius 0.36 |
| 11 / 56.77–57.75 s (two events) | approximately (-20.6, 84.7) | Cottage 3 west wall x=-20.55 |

The two crate pockets account for ten of nineteen events across seeds 9 and 11.
Test those pockets directly before broadening the slide algorithm. Sent these
locations to Thistle, who owns movement work.

## Evidence and verification

Durable volume `keeping-swarm5-captures/reed/slide-motion-review-4ff3c0ef/`:
- `own-replay/slide.mp4`, `frames/`, `trace.json` (local merged 06018d37).
- `open-control/game.json` reads `window.__game` and `__gameHooks.state()`;
  `trace.json` and five screenshots, same input sequence at (-29,87.6).
  Its MP4 contains sparse samples and must not be treated as continuous video.
- Supplied baseline/candidate MP4s and independently extracted 10 Hz sheets.
- `motion-summary.json`; `heldout/` six game-state JSONs and `summary.json`.

Original remote seed jobs: `reed/slide-heldout-4ff3c0ef/` and
`reed/slide-heldout-baseline-b4fa63a-r2/` on the same volume.

TypeScript, Vite production build and lint:feel pass on 06018d37.
No additional gameplay edits were made for this audit. Jump apex/air/dash metrics
are not measured here because the staged comparison contains none of those verbs.
