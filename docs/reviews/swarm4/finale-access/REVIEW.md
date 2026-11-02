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

## Production integration retest — 6beb77b

Merged Wren1a28d58 into Sorrel branch, retaining both knowledge sections. Rebuilt actual production assets and reran the same independent input route with `--production`. All8 authored lane legs,340gliding frames and3walk-out legs pass; finite transforms and zero JS errors. `window.__game` and full traces: `/captures/sorrel/finale-access-production-6beb77b/evidence.json`. Arrival and return screenshots reviewed: fox body remains visible; sealed hollow composition is readable at the arrival, and the return reaches the meadow. These are staged-start access checks, not a full ending, audio, motion-quality or performance claim. TypeScript, Vite production build and lint:feel pass. The page caption source waits for `runaway.settled()` (kept phase >4.6s), after the catch reveal.

## Kit integration retest — 75d09eb

Rebuilt Kit's integrated production bundle after the audio and finale merges. TypeScript, Vite build and lint:feel pass. Independent production route repeats all eight authored lane legs, the crag descent (340 gliding frames), and three return legs successfully; finite positions and no JavaScript errors. Saved `window.__game`, traces and screenshots in `/captures/sorrel/finale-access-production-75d09eb/`. Arrival and return stills reviewed: visible fox and Press, no terrain trap. This staged-start access check does not establish continuous motion quality, audio quality, or Millbrook integration (not present on this SHA). [Compact evidence](production-integration-75d09eb.json).

## Wren rest integration retest — 628d1b7

Rebuilt Kit’s integration after Wren’s rest animation and lane diagnostic landed. TypeScript, production build and lint:feel pass. The same production input route passes all eight lane legs, 340 glide frames and three return legs, with finite positions and zero JS errors. All four arrival/return screenshots reviewed: fox silhouette visible, hollow destination readable, no access obstruction. Saved window.__game, traces and PNGs: `/captures/sorrel/finale-access-production-628d1b7/`. This repeats the access check after the shared controller changes; it does not exercise the ending state, rest/get-up animation, audio, or Hermitage. No runtime source changes. [Compact evidence](production-integration-628d1b7.json).

## Expanded-wash integration follow-up — f1b2400

Production TypeScript, Vite build and lint:feel pass. Independent staged-start input replay again passes all eight authored lane legs, 340 glide frames and three walk-out legs; finite transforms and zero JavaScript errors. Full window.__game state, traces and four PNGs are saved at `/captures/sorrel/finale-access-f1b2400/`. All four screenshots reviewed: fox visible, hollow destination readable, return reaches meadow. This checks access after the Keeping/finale/audio and expanded mill wash updates since 628d1b7; it does not exercise the natural Carry-to-bridge approach, pending camera release fix, completed ending, continuous motion or audio. No runtime changes. [Compact evidence](production-integration-f1b2400.json).

## Camera-envelope integration retest — d03831b

Rebuilt Kit's integration including Fern's camera envelope and clearance fixes. TypeScript, Vite production build and lint:feel (including gradual camera-release checks) pass. Independent production input replay passes all eight authored lane legs, 340 glide frames and three walk-out legs; finite transforms and zero JavaScript errors. Full window.__game state, input traces and four screenshots: `/captures/sorrel/finale-access-production-d03831b/`. Reviewed all four PNGs: whole fox visible, Press recognizable on glide arrival, and both returns reach the meadow. No access regression found; no runtime change needed. This is a staged-start access review without coal or forced Keeping/finale state, not a full ending, continuous motion or audio verdict. [Compact evidence](production-integration-d03831b.json).
