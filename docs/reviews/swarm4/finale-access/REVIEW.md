# Independent Press Hollow access review

**77d303a passes the painted-lane entrance, return, and crag-glide exit tests.** This verifies Wren's terrain fix against a failure independently reproduced on057bd1b.

Baseline057bd1b: walk from(6,66) through(7.5,63.5) toward(12.5,53) stopped at(9.211,-.313,61.011),8.66m short of the goal. Two alternate approaches also stopped at the rim band. A path painted by `pathDist` did not cut a walkable route through the additive rim. The arrival looked like a blank bank rather than a trail; screenshot `/captures/sorrel/finale-access-057bd1b/meadow-walk-in-and-out.png`.

Wren's77d303a terrain trough fixes the authored route without changing controller step limits. Independent retest:

- Eight lane legs complete: meadow→hollow→meadow via the same authored waypoints.
- Crag glide completes with340 gliding frames; lands at(21.495,.510,46.401).
- All three subsequent walk-out legs complete.
- Finite player positions and no JavaScript errors. `window.__game`, full input-driven traces, arrival and return screenshots are in `/captures/sorrel/finale-access-fixed-77d303a/`.

I inspected the two arrival stills and the return screenshots. They support reachability, visible destination and absence of a terrain trap on these routes; they do not prove motion quality. No forced Keeping/finale state or coal is used; each case explicitly stages its initial position. This is a dev-runtime access review of Wren's named branch, not the combined production build or the ending performance/audio. Those need the integrated tree.

[Compact results](verification.json). The independent runner is `tools/finale-access-probe.mjs`; Wren's own failing-class regression is `tools/finale-lane-probe.mjs` on the finale branch.

```sh
node tools/finale-access-probe.mjs /tmp/finale-access
# On a rebuilt integrated production tree:
node tools/finale-access-probe.mjs /tmp/finale-production --production
# Optional alternate approaches are diagnostic; the authored lane and glide/exit are required:
node tools/finale-access-probe.mjs /tmp/finale-alternates --alternates
```
