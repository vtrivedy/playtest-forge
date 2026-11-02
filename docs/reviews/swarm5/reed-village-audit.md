# Independent village collision audit — Reed

Quantitative pass for Thistle's **f1ffac334017bfb674e41675f9127f43368f6436** against
b4fa63a. These are held-out policy seeds 4–6, separate from Thistle's seeds 1–3.
Both builds run the identical corrected `tools/naive-explore.mjs` from f1ffac3;
the baseline does not otherwise include that branch's changes.

Command per seed and build:

```sh
node tools/naive-explore.mjs --tether 14 --seconds 90 --frames 0 --seed N --out NEW_DIRECTORY
```

Two isolated Modal CPU containers, each with 8 CPUs, 16 GB, Playwright 1.64.1 and
SwiftShader. No source edits during runs, no staged start and no progression
hooks. Each seed boots a fresh browser. Frames are disabled, so these runs provide
measurements rather than motion evidence.

| Seed | Baseline unsticks | Candidate unsticks | Baseline stuck seconds | Candidate stuck seconds |
|---|---:|---:|---:|---:|
| 4 | 13 | 1 | 5.40 | 0.20 |
| 5 | 9 | 2 | 6.72 | 1.72 |
| 6 | 29 | 1 | 24.70 | 0.10 |
| Total | **51** | **4** | **36.82** | **2.02** |

All six runs have zero JavaScript errors. This cohort improves unsticks 12.75×
and stuck time 18.23×. This is a policy/seed cohort result, not an estimate for all
players or all seeds. The old seed bot's 131-unstick figure used a faulty speed
threshold; it is not the baseline for this comparison.

Individual JSONs and `summary.json` are uploaded and verified on
`keeping-swarm5-captures/reed/village-independent-review/`. Original capture
logs and per-run outputs remain under `reed/village-independent-baseline-b4fa63a/`
and `reed/village-independent-candidate-f1ffac3/` on that volume.

Source review flags sent to Thistle: the changed slide resolver should move to
`*.hot.ts`; `[slideSide, -slideSide]` allocates while sliding. An 80° rotated step
with a damped facing can initially travel sideways. These measurements do not
resolve that animation concern; a motion verdict is pending the slide clip.

## Cohort limits after integration

Kit's integrated `591e04b` retest reproduces Thistle's corrected seeds 1–3:
8/4/8 unsticks and 4.65/2.33/5.42 stuck seconds. Thistle's same-tool baseline
for those seeds was 20/11/22 unsticks. That is a real 2.65× reduction, while
the independent seeds 4–6 above improve 12.75×. Across all six reported seeds,
unsticks fall 104 → 24 (4.33×). Only seeds 4–6 were independently rerun against
both builds by Reed; the combined figure includes Thistle's baseline report.

The controller change has therefore moved the corrected metric, but the
order-of-magnitude target is not met consistently. Neither a universal 12.75×
claim nor a claim that only the measurement tool improved is supported.
Blind discovery is a separate failed gate: Kit's untethered seeds 1–3 still
have zero catches on `591e04b`. These observations do not establish whether
sliding looks or feels good; retain that visual review as open.
