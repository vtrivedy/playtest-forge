# Ashwater marsh scenery — independently played

Final runtime: **f90933fb3363662eb6a7a2bc61e76b63fb5995c8**, Tesla T4 / ANGLE EGL, 640×360.

The [old landing](before.png), [first ground pass](first-dark-water.png) and [final landing](final-landing.png) were personally inspected. The bright lawn is replaced by peat/olive hummocks with irregular standing water, Cedar's fanned sedge/cattails and Maple's low mist. The saturated fox stays readable. The first pool looked like a dark cutout; `c0e97406` lightens it toward reflected sky grey-green and feathers shoreline opacity from terrain depth. This revision was replayed, then the final combined reed build was replayed again.

Reed authored only the palette/static puddles and capture option. Puddles clip the existing terrain triangles at a stationary level, excluding puzzle waters with a 1.2 m margin. They introduce no collider, terrain, reset, ability, save or per-frame change. Cedar owns plants; Maple owns mist. No locomotion tuning.

Fresh default boot → rendered invitation follower → physical homecoming and hub arch → all three Ashwater puzzles: **PASS**, zero page or console errors. Bank dam opens only the west reach; the drowned roof is visited before the second culvert. The sinking-mat reset and rising-cistern assertions pass; ordinary inputs cross punt → shelf → Seedwell. Both canonical memories, Reedskim and Reed fill 1 are earned. Three splashes. Native Tab Album opens. Complete snapshots: [game evidence](game-evidence.json).

The route takes 135.017 simulated seconds in autumn and 180.183 in Ashwater; the latter includes the extra six-second walking capture, return to the landing, side detour and deliberate waits/tests. It proves authored solvability, not blind insight or the requested 10–15-minute world. Final counters: eight dashes, last dash 1.961 m; lastJump apex 0 / air .05 s / time-to-apex 0 records the final step-down, not jump tuning.

[Walking movie](marsh-walk.mp4): six simulated seconds, 72 frames at 12 fps, silent, fixed 60 Hz simulation. Starts after the physical hub entry and uses stick input; no placement/progress setters. All [72 decoded frames](all-72-frames.jpg) were inspected: the hero remains readable across the turn; nearby foliage briefly crosses its silhouette. [Decoded black-frame check](blackcheck.json): **0/72**, minimum mean luma 91.917. This is offline rendered motion evidence, not a real-time performance result or a full-route black-frame guarantee.

The [drained sluice](final-sluice.png) remains readable, with cooler grey water and peat margins. Plant clusters and pale pools distinguish the place from autumn. Remaining quality limits: scenery is still simple; large slate walls are plain, the drowned-roof trigger's composition is weak, and the shelf pier still masks the fox's muzzle on the full-route shot. This pass does not claim to fix those composition issues or finish the whole game's art.

TypeScript, production Vite build, feel/camera/world lint and whitespace checks pass. Vite retains the existing large-chunk warning. Full route PNGs, raw JPEG movie frames, log and complete `window.__game` snapshots are retained at `/captures/reed/world-entry-f90933fb33/` on `keeping-swarm5-captures`. Earlier full route `215f8e3c` and softened-water/mist retest `c0e97406` also passed, zero page/console errors.
