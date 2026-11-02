# GPU black-frame isolation — Reed, swarm5

Fix 5 passes on **4ed97a0278628618a04166eac0907cd7b3eaf317**: a 280-second
T4/EGL recording has no black frames and completes the whole journey. The runtime
fix is the single WebGL constructor change in 74c7db9: `antialias: false`. The
composer retains bloom, grade, SMAA and output. No gameplay or camera code changed.

## Controlled hardware comparison

All controls use the b4fa63a game source at 1280×720. Entries are black/decoded
frames, including individual flashes; clips use actual variable frame timestamps.

| 120-second control | Native recording | Staged recording | Independent CDP |
|---|---:|---:|---:|
| Original canvas MSAA | 20/2,545 | 33/3,400 | 11/1,133 |
| Preserve drawing buffer | 18/2,751 | 23/3,392 | 7/1,131 |
| Disable canvas MSAA | 0/2,643 | 0/3,422 | 0/1,141 |
| Original MSAA, no recorder or captureStream | absent | absent | 0/1,156 |

The interaction is triggered by GPU canvas recording with MSAA. In paired runs,
the shared canvas can already contain black pixels before encoding, so persistent
2D staging does not repair it. The recorder-free compositor control remains clean.
This isolates the tested interaction; it does not identify a particular internal
driver defect or establish behavior on every GPU/browser.

Diagnostic sources: 764b338 (baseline), 0a4862d (context controls), 8495afb
(recorder-free control). All artifacts remain on `keeping-swarm5-captures/reed/`.

## Actual constructor verification

The first production test, 74c7db9 for 250 seconds, has zero black frames:
0/5,604 native, 0/6,948 staged, 0/2,316 CDP. However, my probe omitted interact
input and stalled at coal pickup. This is rendering evidence, **not a journey
clear**. That failed route is retained. I added a pooled immutable three-button
encoder, interaction/combination tests in `lint:feel`, and canonical route checks
that reject incomplete long captures.

The corrected **4ed97a0** capture uses the production renderer with **no context
override**. Its 280-second recording contains 7,802 simulation ticks (260.067 s):

| Path | Black/decoded frames | Minimum mean luminance |
|---|---:|---:|
| Native | **0/6,834** | 71.339 |
| Staged | **0/7,802** | 80.219 |
| CDP compositor | **0/2,601** | 80.372 |

All 11 canonical checks pass: page home, steam, Keeping, bridge, actual Carry,
ember placed, finale kindled, snow, kits curled, card shown and card done.
The page has three catches and zero skips; there are no JavaScript errors.
The final state has snow, three curled kits and one completed card. Five dashes
are recorded. The final 5.967-second air event is the crag walk-off/glide, not a
jump-height tuning test.

Artifacts under `/captures/reed/boundary-baseline-4ed97a0278-160525-1fd249/`:

- `native.webm`: full live recording with post-limiter game audio.
- `end.png`: inspected ending screenshot.
- `report.json`: source/tool hashes, complete `__game`, source samples, CDP timestamps.
- `run.json`: GPU identity, decoded-frame audits and video SHA256 hashes.

The same relative `reed/.../` directory is durable on `keeping-swarm5-captures`.
The CDP movie is a sampled image sequence encoded at 10 fps for review; actual
irregular timestamps remain in the report. Its movie duration is not wall time.

## Visual and regression review

Matched opening screenshots retain the same framing, paint and fox silhouette;
mean absolute RGB difference is 0.417/255, with no observed new edge problem.
A silent 10-second comparison is at
`reed/msaa-comparison-0a4862d/baseline-left-no-msaa-right.mp4`: original source on
the left, no-MSAA context control on the right. These are independent runs,
resampled to 30 fps. All 16 consecutive frames around the first flash were
inspected: the left flashes while the right stays visible. This comparison is
separate from the final production clear. The isolated renderer branch retains
the original ending composition; Cedar's fix 3 owns that visual problem.

`check-black-frames.py` inspects every decoded frame, including terminal frames:
mean luminance ≤12 and at least 98% of pixels ≤16 after a 32×18 area downsample.
Bright, single-flash and wholly blank controls verify the gate. `lint:feel` now
rejects native MSAA, dynamic flags and overriding context/spread construction.
The RecorderBoundary TLC model passes 11 states; its deliberate broken variant
fails in five steps. It proves publication ordering, not GPU pixel correctness.

TypeScript, production build, feel lint, route-input tests, decoded-frame gates
and the full journey checks pass.

```sh
modal run tools/modal/recorder_boundary.py --ref 4ed97a0278628618a04166eac0907cd7b3eaf317 --seconds 280
python3 tools/check-black-frames.py PATH_TO_VIDEO --out audit.json
python3 tools/tests/black-frame-gate.py
npm run lint:feel
```

The Modal command uses `GH_TOKEN` from the environment as an ephemeral secret.
