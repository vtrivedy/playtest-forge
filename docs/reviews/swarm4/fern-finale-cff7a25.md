# Finale traversal camera — Fern

Runtime `cff7a25` includes Wren's moved-cradle finale through `057bd1b`.
Camera continuity verdict: **APPROVED for this staged route**; whole-game feel and unfamiliar-player discovery are not certified.

## Change

The free-pose early return in `cameraEnvelope.hot.ts` could release an elevated escape pose directly to the spring. Initial full-route evidence `c330e89` showed a 1.024m camera step leaving the crag and a 2.444m step on the return lane (30.73/73.31m/s at the trace's30Hz sampling). An initial direct-release limiter was insufficient: the short release segment could hit the platform edge, then still fall through to the abrupt destination. Continue the existing escape search until a swept, body/floor-safe gradual release is possible.

Compare12m/s and16m/s release candidates on the moved-cradle route. Both complete;12m/s retains1.920m minimum crag chest distance versus1.847m at16m/s, with the same39.32° maximum pitch. Retain12m/s for gentler recovery. Emergency search remains available when no safe continuous segment exists; this is not a universal speed guarantee under arbitrary teleports/collider changes.

## Played evidence

`/captures/fern/finale-final-cff7a25/` contains `trace.json`, `game.json` (`window.__game`), seven leg stills,243 source frames, all-frame sheets and four clips. Retained copy: `playtest-output/fox-spirit/fern-finale-cff7a25/`.

Staging: dev-release the Keeping, pick up the ember with E, teleport to the far crag. Controller input thereafter: glide into Hollow → approach cradle → E → complete finale/card → walk out to meadow. All seven legs complete in58.9s simulated; no JS errors. Simulation60Hz, trace30Hz. Clips are offline480×270,15fps traversal and2fps title-shot timeline, silent. They are not realtime performance or audio evidence. Metrics omit the first staged second.

| Segment | Minimum lens/chest | Max pitch | Max lens speed |
|---|---:|---:|---:|
| Crag glide |1.920m|39.32°|12.00m/s|
| Cradle approach |3.007m|15.98°|7.04m/s|
| Finale/title |2.562m|18.47°|3.16m/s|
| Card handoff/walk |2.413m|19.57°|3.86m/s|
| Return bank |1.500m|51.54°|12.00m/s|

`glide-approach.webm` retains127 consecutive15fps frames (one contiguous glide/approach segment); `handoff.webm` retains45, `return-lane.webm`46. `finale.webm` retains25 title-shot frames at2fps; this is not proof of individual page or kit animation stability throughout the whole finale.

## Visual review / feel critique

All243 retained frames were inspected via full-frame sheets. Whole fox, ears and tail remain inside the view through the glide, post approach, handoff and bank release. The platform briefly fades in front of the gliding fox; silhouette remains legible. The bank temporarily raises the view to51.5°, then releases gradually; no return teleport remains. The warm kits/cradle composition reads clearly, with the authored title composition preserved. Animal gait, body and tail change throughout the walking frames. This patch changes no controller, gait or authored finale shot.

The initial defect was fixed and the full affected route retested on the chosen candidate. A focused free/obstructed-release check passes, and the same check fails against the prior solver (`release snapped`). TypeScript, Vite build, feel lint and CameraEnvelope TLC (9distinct states) pass; model scope remains publication ordering, not continuous collision geometry or smoothness.

## Recheck

```sh
npx tsx tools/camera-envelope-release-check.ts
node tools/finale-camera-probe.mjs OUT --clip
```

Ruin success/missed-catch regression on the integration merge is recorded below before publication.

## Integration regressions

Merged `keeping-d2` at `2afb162`; retained the shared hot AST gate plus the unknown-external-callee guard and fixture. Both90s30Hz ruin replays complete without JS errors. Success:3catches/0skips/page home; late minimum chest2.115m, pitch24.65°, max speed12.00m/s. Intentional miss:2catches retained as expected, minimum chest1.559m, pitch48.77°, speed10.76m/s. All60 continuous64–68s miss-clip frames pass the skinned-body2% viewport margin; every retained frame and both success/miss stills reviewed. Last successful jump remains .750m apex/.300s to apex/.633s air. Evidence `/captures/fern/ruin-success-release/` and `/captures/fern/ruin-miss-release/` includes __game, full trace, screenshots and the failed-input clip. These are offline480×270 captures.

The release regression now runs automatically under `npm run lint:feel`, checking free and obstructed exits at30/60/120Hz, endpoints and the swept segment. Prior solver fails the negative demonstration. The existing formal model is unchanged because no discrete publication stage changes.
