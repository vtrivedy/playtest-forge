# Failed-catch camera recovery

Runtime candidate: `f3ddb6f6305a59f7aac05374c3ac4250f9347610`.
Design: [failed-catch-camera-DESIGN.md](../../design/swarm3/failed-catch-camera-DESIGN.md).

Kit's real-time T4 slice run and Rook's 30Hz replay both miss the overlook catch and fall west between the pages. The lens then holds on the second leaf while the fox moves underneath it. A successful 60Hz route did not exercise this case.

The lens now escapes sideways at its last free height, retains a horizontal body envelope, keeps its movement limit as the fox approaches, and prefers candidates with a clear scenery sightline. The existing analytic follow spring and character parameters stay in place.

| Late window, 60–90s | 5247b90 baseline | f3ddb6f candidate |
| --- | ---: | ---: |
| Minimum lens-to-chest distance | 0.290 m | 1.234 m |
| Maximum absolute lens pitch | 87.21° | 58.78° |
| Maximum lens speed | held / head clipping | 10.78 m/s |
| Page errors | 0 | 0 |

Evidence: `keeping-swarm3-captures/reviews/tallow-camera-f3ddb6f/` contains full per-frame trace, `window.__game`, beat/apex stills and named 60/65/72/80/89-second stills. Local copy: `/captures/tallow/ruin-lens-continuous-fix/`. Reviewed the named late stills and apices: full fox/body/tail readable, no lens through the head, no opaque slab hiding the fox. Ground framing remains relatively steep in this tight failed-catch gap. The shell returned 143 during cleanup after writing the complete trace and DONE; the capture data and computed metrics are complete, but this is not a clean command-exit claim.

The first height-only candidate improved named stills but missed transient overhead frames. The body-envelope candidate passed distance/pitch but introduced a wall-hidden pose and a 4.36m jump. Both were rejected; the final candidate retains continuity and scores sightlines.

Repeat the regression:

```sh
node tools/camera-drop-probe.mjs OUT .07 90 5194 \
  --dt 0.03333333333333333 --stills-at 60,65,72,80,89 \
  --size 640x360 --check-camera
```

The executable gate checks late chest distance ≥1.1m, pitch <70°, lens speed <24m/s, and no page errors. Screenshots still require visual review. `tsc`, Vite build and feel lint pass on the runtime candidate. Independent Rook 30Hz replay passes with CLEARLY BETTER vs 5247b90 (command exit 0, no errors, 1.234m minimum / 59.11° maximum / 9.79m/s maximum). The successful 60Hz route also passes, exit 0: three catches, zero skips, all folds open, return route used, page pinned home. Its late camera metrics are 2.212m / 24.82° / 14.45m/s; last jump apex 0.792m, time to apex 0.317s, air time 0.667s. Return-stair and homecoming stills show a readable full fox. Evidence: `reviews/rook-slice-33ms-timed-f3ddb6f/` and `reviews/tallow-camera-success-f3ddb6f/` on the same captures volume. A real-time T4 comparison is still pending.

This camera change does not repair the capture bot's repeated failed pounce. It does not establish full-slice completion at every frame rate or replace the free-play feel gate.

## Retained motion and scoped feel critique

Verdict: NEEDS REVISION

The collision recovery is independently CLEARLY BETTER and is integrated in e127507. This is not whole-game feel approval. The retained 3.8s, 15fps clip covers simulation 64–67.8s on runtime f3ddb6f: `playtest-output/fox-spirit/camera-f3ddb6f/clip.webm`. Reviewed sequential frames through the pounce: camera follows continuously, the fox remains readable and the lens never enters its head. Ear/tail tips briefly crop at the tight pounce; a wider minimum needs a fresh arch/return-route test. The foreground clip process terminated after 57 frames; those actual frames were encoded as 3.8s, not presented as the requested 6s. Full 90s state evidence comes from the separate complete same-runtime replays above.

| Change checklist | Result |
| --- | --- |
| Fox body readable during failed catch | Pass; brief tip cropping remains |
| Camera stays outside the fox | Pass |
| No held-lens overhead degeneration | Pass |
| Continuous camera escape | Pass; late maximum 10.78m/s |
| Successful return traversal and home framing | Pass, 60Hz complete route |
| Feet/gait, dash, empty-island fun | Character code unchanged; broad feel gate not reopened or claimed |
| Retained motion + stills + runtime SHA | Pass |

Next priority is pounce silhouette margin, not another spring rewrite. A 1.8m minimum experiment was stopped and reverted at shutdown; no clearance or landing claim is made for it.
