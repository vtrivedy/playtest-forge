# Matched World 1 locomotion A/B

Before: `2e0e614b39c40eee1c1b6e7c26517cb561a95b22`.
After: `b9bf716e0b44396dad4e31dca28faa62a255af54`.
Both: NVIDIA A10, high quality, 1920×1080, 60 fps, seed 42.
Frozen capture module: `05c70945327fc877d78eb801fa89c1092cc767d6863945ea8774e99e1ffee32f`.

All six live-controller segments start at (40, −0.427565, 88), with identical east-side and rear-side tracking photo lenses. No animation pose is forced. Both builds have zero deaths in every segment.

`showcase.mp4` is a 16-second, 1920×580, 60 fps side-by-side assembly. It preserves all source clip durations: side walk 3s, trot 3s, run 2s; then rear-side walk 3s, trot 3s, run 2s. Before is left; after is right. Labels identify both SHAs. This is an edit of recorded GPU footage, with no new 3D rendering.

Source directories: `world-before-r2/world-before-r2/` and `world-b9/world-b9bf716/` under the stream artifacts directory. `contact-sheet.png` retains frame 60 from each segment; the six `dense-*.png` galleries compare consecutive 30 fps samples from 0.6–1.4 seconds. The final assembly was also personally inspected through `showcase-review-sheet.png`.

## Measurements

Median wrapped phase delta divided by actual frame time, after frame 60:

| Gait | Before Hz | After Hz | Reduction |
|---|---:|---:|---:|
| Walk | 2.973 | 1.849 | 37.8% |
| Trot | 4.222 | 2.147 | 49.1% |
| Run | 4.867 | 2.400 | 50.7% |

Ground acceleration also changes visibly: time to 90% of requested speed rises from 0.083s to 0.400s in all three gaits. The first captured frame still moves; first-frame run speed falls from 3.893 to 0.856 m/s. There is no measured speed overshoot. This supports a gentler start, not a claim about human fun or whole-body jitter. See `acceleration.json`.

Both lenses agree on cadence. Trot steady maximum solver slide improves from 1.052/0.913 m/s to approximately zero. Run improves from 1.768/1.569 to 0.661/approximately zero. Walk regresses from 0.420/0.435 to 0.570/0.523 m/s. See `metrics.json` for residuals and starting positions. Solver landmarks do not establish complete mesh-sole planting.

## Visual verdict: NEEDS REVISION

Sol personally inspected all six matched frame pairs and all six dense galleries. Trot looks calmer, with longer recovery and a steadier back line. Gallop shows distinct gathered suspension and extension, with less nose diving than baseline. The pale hinged hip panel, gathered hind-paw crowding and restrained walk lift remain. Landing absorption is outside this straight-only comparison. Old tail ribbons remain in this captured SHA; newer main brush work has separate pending evidence.

Independent Sol visual review agrees this is a clear improvement but withholds final approval because of hip deformation, paw separation and weight transfer. Opus remains quota-limited until 06:40 UTC; its approval is still required.

This comparison matches camera, inputs and tooling, but is not an isolated animation-parameter experiment: buildings and character appearance also differ between SHAs. Teleport preserves gait phase, so corresponding frame numbers need not show the same pose. Compare temporal progression and cadence. No ordinary gameplay-camera or continuous-route claim is made.

The latest 14582be west-lens capture separately verifies clearer composition. A current-main ten-segment fixture adds turns and jumps, pushed as bd9e5e6; it still needs GPU review. The primary 14582be landing A/B capture request remains pending.
