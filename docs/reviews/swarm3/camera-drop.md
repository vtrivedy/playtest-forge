# Canopy drop camera — 2026-11-01

Runtime candidate: a24c0d4 (origin/sw3-tallow-camera-drop), based on keeping-d1 ed59c85.

Walking off the roost used to stack focus damping and camera spring lag. At the landing the lens remained 3.4 m above the fox on a 2.5 m boom. The camera showed a steep ground view instead of the grove ahead. Collision telemetry was clear: boomT 1, lift 0, floorLift 0, no blocker.

The opening player now uses a 0.07 s vertical response during descent, easing back through touchdown. Horizontal lag and movement tuning retain their values. The shared camera defaults to its existing response, so other camera clients must explicitly opt in. `fallLag` is adjustable in the opening lil-gui camera folder.

| Completed comparison | Lens-to-chest elevation at drop landing + 2 frames | Maximum optical down-pitch during walk-off |
|---|---:|---:|
| Before (c3c7310) | 44.07° | Not captured |
| 0.07 s | 27.00° | 21.12° |
| 0.04 s | 19.94° | 14.92° |

Both variations met the framing target. Retained 0.07 s as the gentler response. Before/0.07 movement positions match at the drop; 0.04 boot timing shifts route frame numbers, so its comparison uses the actual touchdown event. Spring apex remains 2.428 m. Comparison evidence: `/captures/tallow/camera-drop-007-retry` and `/captures/tallow/camera-drop-004-valid`.

The grove foreground blocker is a separate Flint change (920b2be). This candidate changes the camera's vertical response only.

Final runtime checks: TypeScript and Vite build passed on a24c0d4. The detached 62 s full-slice replay retained 3720 frames and explicit `window.__game` state: Page KEPT with 3 catches / 0 skips at 44.68 s, 3 canopy launches, roost visited, first two ruin folds open and reached, errors []. All 11 acceptance checks passed. Last canopy flight: apex gain 2.428 m, time-to-apex 0.583 s, airtime 1.367 s. Three dashes exercised; final dash distance 0.668 m (the fold interaction truncates it).

Acceptance evidence: `/captures/tallow/camera-drop-a24c0d4-final` (also linked under `playtest-output/fox-spirit/camera-drop-a24c0d4`). `evidence.json` names the runtime SHA; `summary.json` records checks. `drop.webm` is a continuous 3 s / 30 fps / 1280×720 clip from 90 retained frames. Encoding used Playwright's bundled VP9 encoder after simulation; `--encode-only` now reproduces that step without rerunning the game.

Visual review inspected the actual before still and both variation touchdown stills, then the exact final clip frames 20, 30, 35, 42 and 50. The fox remains readable while falling, the forward grove remains visible at touchdown, and the camera returns smoothly through the subsequent turn. The worst drop framing is fixed and retested. Peer camera verdict pending.

## Feel critique — a24c0d4
Verdict: NEEDS REVISION

Scope: the bounded camera change passes its framing target. This is a WIP slice assessment, not a fresh global locomotion milestone.

### Concrete failures
1. `38-dash-the-first-fold.png` still inherits the old near-lens grove crown. Flint owns the independent maple move 920b2be; the camera fix does not move scene geometry.
2. Long sepia travel and intermediate catch reward are the already-recorded full-slice issues. Flint owns step-wash 5363a89. They remain outside this camera candidate.

### What works
- The walk-off stays in a comfortable chase view instead of looking steeply at blank ground.
- Fox silhouette, falling pose, landing and tail/body turn remain readable in the retained clip.
- Canopy and ruin input routes complete with the recorded movement metrics.

### Checklist
| Item | Pass? |
|---|---|
| Feet plant / gait cycles | Readable in landing and turn clip; animation unchanged |
| Body + tail follow-through on turns | Visible after touchdown |
| Jump anticipation + land squash | Land visible; full jump timing not re-certified by this short clip |
| Dash has weight (not teleport) | Exercised 3 times in replay; outside drop clip |
| No skating / orb / rigid language fits | No new gait claim; camera keeps the existing creature legible |
| Retained capture present | Yes: WebM, 90 frames, 56 numbered stills, runtime state |

### Next patch
- Integrate the independently reviewed maple clearance and catch step-wash with this bounded camera fix.
- Review the combined hero before declaring the whole-slice feel milestone complete.
