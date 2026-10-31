I reviewed the source only. I didn't run anything and I'm not giving visual approval.

**Signs and directions are correct.**
- The fox is placed at `+2.6` or `+2.7` along `(dx,dz)` and pushed along `-d` (stick `[-dx,-dz]`, yaw `atan2(-dx,-dz)`). So `r<0` is the exit side, and `r=-5.5` means 5.5 m past the Shade.
- That leaves about 1.2 m beyond the 4.3 m coast seen in 23046ef. That margin comes from one run, not from the controller math.
- `(-dz, dx)` is a correct perpendicular. The ±0.35 offsets give the stated 0.7 m across three lanes.
- `&&safe` on the outer loop, together with `break` on the inner one, exits correctly. Floating-point build-up just adds a harmless extra sample near `r≈3.1`.
- On the flat runs, the lower shelf is caught: `groundAt(...,y+.1)` returns the shelf, and a drop of more than 0.2 fails the lane.

**Problems:**

1. **Evidence honesty: the "fox remains supported" check doesn't exist yet.** The DESIGN paragraph says the GPU run "must verify fox remains supported after release". But nothing after `shade-free`, `shade-clear-free` or `shade-play` checks `grounded`, `pos[1]` against the setup height, or `deaths`. `validatePair` (`tools/gpu-capture.mjs:305`) only checks framing. A repeat of the 5 m fall would still pass, and `shade-live-acceptance.json` / `shade-two-frees-acceptance.json` would look clean. A fix: after each take, push a failure if the trace has any `deaths`, or if the final `pos[1]` is below the setup height minus a small tolerance (or minus the slope tolerance for the hill). Until that's in, the doc should say the check is required, not imply it's done.

2. **The high-hill check is looser than "supported".** It compares each sample with the Shade's height, `|fy−y|≤2.4`. It doesn't compare neighbouring samples. A drop of up to 2.4 m in the middle of the runway, or a downhill exit ending 2.4 m lower, still passes. That's the existing tolerance as stated, but "full exit evaluated" overstates what it proves. A per-step limit (e.g. `|fy−prevFy|` under about 0.3 m per 0.1 m step) would actually rule out ledges.

3. **The live keyboard take checks a different path from the one it plays.** The W key moves relative to the camera, not to the yaw set by `teleport`. The runway is validated only along `-d`. If the third-person camera hasn't settled behind the fox after `advance(1)`, the real dash heads off-axis. Over 5.5 m, even about 4° of drift moves the fox more than 0.35 m sideways, outside the checked lanes. The same applies to any angle error in the stick path. A fix: record the actual direction of travel and the final position in the live JSON, or widen the lanes.

4. **Minor, unchanged behaviour:** the hill setup still `throw`s, and the outer catch at line 1714 records it and re-throws. So "preserve an explicit setup failure" holds, but it aborts the later live and flume diagnostics. That differs from the "persist failure but continue" pattern used for contact failures. Decide which behaviour you want.

There are no runtime or syntax errors in the diff. Real input and controller speed are untouched, and there's no teleport, brake or hold during the takes, which matches the doc.
