# Keeping camera — integrated verification

Runtime `41ea3ec` merges `671a290` with Fern's complete camera envelope and release
fixtures, Wren's `9e04283` post-only steering slide, and the jointly verified
**1.9m** opening body clearance. The normal boom remains **2.45m**. The earlier
independent Sorrel solver is superseded; there is one current camera path.

The probe calls the game's `__gameHooks.foxScreenPx()` and the shared
`tools/lib/fox-size.mjs` gate. Default floor: 24px at 360p, scaled to 18px at 270p;
more than one second below it fails. No separate 0.8m projection remains.

## Played results

| Case | Source / effective clearance | Progression or coverage | Full-body frames | Minimum fox px at 270p |
| --- | --- | --- | ---: | ---: |
| Keeping, 90s | `41ea3ec`, default 1.9m | Steam, root, bridge, crag and final leaf beat pass | 30/30 | 33.00 |
| Regional ledge drop, 14s | `22d4b4c`, 1.9m override | Seven actual-state checks and expected final beat pass | 90/90 | 50.18 |
| Original missed overlook, 90s | `ebbdc98` incl. Wren 9e, 1.9m override | Requested jump, airborne departure and below-leaf fall observed | 60/60 | 39.86 |

All cases have zero JS errors and pass the 2% full-body screen-margin gate.
Keeping's maximum sustained grounded follow range is **2.792m** against the
unchanged 5m cap (the reported broken camera reached about 16.9m). The missed
route intentionally retains two catches and retries below the overlook; this is
failure-camera coverage, not a claimed page clear.

Keeping and the original page route have one initial placement, then ordinary
controller inputs. The regional test discloses two setup placements and real
dashes to open both folds, followed by one placement on the second leaf. It
records an actual fall and jump retries; no fold flags, catches, restoration or
physics are forced. Evidence includes `window.__game`, all route states, stills,
clips, source frames and body bounds. Offline 30Hz simulation, 480×270 at 15fps,
without audio; these runs do not measure real-time rendering performance.

## Review, correction and retest

Reviewed every recorded accepted frame on contact sheets and the full-sized
stills. The fox stays readable through the bridge, with the Crown ahead. During
ledge drops and retries the lens stays outside the animal and the world-face
cutout keeps it visible. Tail room remains comfortable in the accepted clips.

The integrated 1.8m drop passed distance/size/progression checks but failed the
strict body margin at frames 136 and 138 (bottom NDC −0.976). The matched 1.9m
trial passes all 90 frames; its worst bottom NDC is −0.892. All fox positions and
velocities match between those trials. The margin gate was not weakened. The
selected default then passed the final 90s Keeping replay without an override.

The earlier inherited full-page probe stalled before the requested miss while
its camera-only checks passed. The new `MISS_COVERAGE` gate requires the jump
beat, airborne departure and a subsequent fall. That old run is rejected. After
Wren's controller correction, the original route passes the stronger checks.
`verifySlice` also receives the full trace, enabling the regional test to require
a real leaf start, airborne fall and jump retry rather than a stationary end pose.

TypeScript and `npm run lint:feel` pass on the final source; the merged release
fixtures cover free/ledge/ridge/post recovery at 30/60/120Hz. The shared size gate
also passes the actual Keeping samples and correctly rejects those same samples
with a deliberately impossible 270px floor (55s below it).

## Evidence

- `/captures/sorrel/camera-final-41ea3ec/acceptance.json` — structured acceptance.
- `keeping/` — final default's 90s states, 46–48s bridge clip and five stills.
- `regionalDrop/` — matched 1.9m trial, seven state checks, 2–8s drop/retry clip.
- `originalMiss/` — corrected natural route, actual 42.4–46.4s miss/retry clip.
- `shared-gate-negative.json` — positive and negative gate evaluation.

The same pack is copied to
`playtest-output/fox-spirit/sorrel-camera-final-41ea3ec/`. Shared archive:
`keeping-swarm4-captures/sorrel/camera-final-41ea3ec.tgz`.
Original raw runs remain under their named `/captures/sorrel/` directories,
including the rejected 1.8m trial and interrupted captures; they are not mixed
with accepted reports. Proxy size and animated-body bounds measure framing;
world occlusion was reviewed in the actual images.
