# GPU reviews

No local browser. From the repository root:

```sh
python3 tools/review-capture.py s2-loco
```

Resolves the exact remote branch once, pins its commit, and launches gait, route and
stills in separate Modal containers. Fetches MP4/PNG/JSON into
`/workspace/siyu/playtest-forge-artifacts/sprint2/capture/<ref>-<time>-<id>/`.
Each shot has its own durable volume ID. `review.json` records the requested ref;
`results.json` records outcomes; each shot's `run.json` verifies the actual commit.
A route failure returns nonzero and preserves the artifacts: it is useful review evidence.
Requires Modal authentication, GitHub access through `gh`, and local Pillow for sheets.
The target ref must include the gait gym implementation (merge current main).

```sh
# Fast locomotion/art review, skipping the ~2-minute gameplay route
python3 tools/review-capture.py s2-loco --shots gait,stills
# Character review angles from the fox stream
python3 tools/review-capture.py s2-fox --shots gait,fox
# Rebuild contact sheets from fetched images
python3 tools/review-capture.py --sheet-only /absolute/path/to/review
# Low-level single shot; run ID is printed for later recovery
modal run tools/modal/gpu_capture.py --ref s2-loco --shots gait --out /absolute/path
modal run tools/modal/gpu_capture.py --fetch-only RUN_ID --out /absolute/path
```

Gait is 23 output seconds, 1080p60, deterministic random seed 42. The live controller
receives analog world-space inputs at walk/trot/gallop speed bands, tight left/right turns, reversal, stop,
short jump, dash and 15-degree slopes. Names describe requested tests; they do not
assert that the target implements those gaits. Staged teleports reset jump/dash/slope
segments; the JSON script labels them. Quarter-speed uses 1/240 s simulation steps.
Gait is locked to 60 fps so jump-edge timing stays identical between runs.
The tracking camera follows ground height so jump height stays visible. Normal play
can enter the same course with `?gym=gait`; WASD, Space and Shift still work.

`gait.mp4`, `gait-contact-sheet.png`, `gait-script.json` and `gait.json` contain the video,
labelled key poses, inputs, per-frame position/velocity/animation/ground state/dt,
and per-second `window.__game` snapshots. Metadata reports measured jump and dash
metrics. A death or departure from the measured flat area fails the run.

The route uses real inputs and no teleport assists. `--route-seconds` defaults to 120
in the helper; increase it when a new route is longer. Stills are explicitly staged:
meadow, marsh, hill, shrine, hero and a matched sepia/restored overview. They do not
prove progression. `perf` is the heavier five-pose, three-quality benchmark.

Read the PNGs and inspect trace/state before judging a branch. A beautiful still does
not establish foot planting; use the quarter-speed strip and 1 m floor marks. Real
fox reference clips and cautions about uncalibrated video are in sprint2/ref/fox-gait/.

## FX lookdev contact sheets

Soft-realism VFX loop (not pixel art): `.claude/skills/vfx-lookdev-loop/`.

```sh
npx tsx tools/fx-capture.ts --effect hearth-updraft --out playtest-forge-artifacts/sprint2/fx/hearth-updraft/r1
```

Needs chem/updraft on the branch. Fixed-step `setManual` + `advance`. SwiftShader is
smoke-only; judge column glow on Modal GPU (`updraft` shot in `gpu-capture.mjs`).
`--shots shade` is an explicit encounter probe for refs with the Shade hooks. It
records patrol, contact/knockback and dash-free on safe collision-checked lanes.
`python3 tools/compare-gait.py LEFT/gait RIGHT/gait --out REVIEW` builds the matched
side-by-side MP4 and joint-landmark tables. Both captures must use the same tool hash,
quality, timing and gym metadata. Read the stated proxy limitations before scoring.
