# Journey beyond homecoming — 050a7cc

The showcase now continues from the returned page into the existing hearth, ember, steam and Keeping bridge sequence. `tools/journey-camera-route.mjs` exports the usual `SLICE_START` and `createSliceRoute`; select this module for a **160-second** landing clip. The opening regression route remains unchanged. The new module embeds the canonical factories when transferred with `toString()`, so there are no separately maintained copies of the opening or Keeping input scripts.

One initial wake placement is staged. All subsequent travel, three page catches, return-fold dash, ember pickups/placement, updrafts and bridge crossing use controller inputs. There are no mid-route teleports, forced progression or camera overrides. This is an authored showcase route, not an unfamiliar-player discovery verdict or a full Press finale run.

## Played results

The initial60Hz journey passes9/9 checks and finishes at157s. Reviewed all73 beat screenshots: the page reveal returns to ordinary follow framing, then the fox leaves the plaza instead of holding there for the remaining clip. The hearth ride, ember recovery, steam ride and fallen-tree crossing read as distinct tasks and payoffs.

The final **050a7cc18e03a3e7c60f423710502653ad011061** replay runs165s at30Hz,480×270. Five story checks pass (page home, steam latched, roots complete, bridge ready, fox on crag); the final beat is `a leaf comes down`; camera checks pass; zero JavaScript errors. The kept page has3catches/0skips and the ember has3pickups. Final state retains `window.__game`.

| Beat | Final30Hz time |
| --- | ---: |
| Homecoming pause | 73.000s |
| Steam rising |123.100s |
| Set warmth at roots |130.667s |
| Roots complete / tree fall wait |131.867s |
| Cross bridge |141.233s |
| Crown answers |145.900s |
| Leaf comes down |149.900s |

Camera measurements after94s: minimum lens/chest2.199m, maximum absolute pitch28.08°, maximum grounded follow distance3.160m, minimum projected fox31.93px at270px viewport height. Full telemetry retains last steam-assisted ascent apex9.061m/time-to-apex1.833s/air5.567s and last dash distance2.085m; these are route telemetry, not a new jump calibration. No controller or camera tuning occurred.

## Visual review and correction

The b5196ff integrated run passes progression and camera checks, but its native motion frame020 shows the bottom-center hearth teaching card covering the fox's legs. Commit050a7cc moves only that instruction card into a bounded upper-left corner, retaining its text/font. The final replay retains90 consecutive15fps frames covering94–100s, a6s WebM, ten timed stills and full state/trace. Reviewed every frame on three contact sheets, the native matched before/after and all ten final stills. The fox's body/legs remain clear during approach and ascent; the hint remains readable and fades as the fox leaves the hearth. The warm beam briefly brightens the fox, without the instruction card covering it.

All4950 gameplay/camera trace rows are exactly equal before/after the HUD correction. This verifies that this visual correction did not alter the recorded route or camera. The corrected segment is the authoritative visual result; the earlier centered-card footage is retained as the failure baseline.

**Feel critic verdict: APPROVED for this authored journey and scoped HUD correction.** The original gait/controller are unchanged; this is not a new whole-game feel certification. The scene reads warmly, the fox stays readable, and the route demonstrates existing verbs rather than spending70s in the plaza.

## Evidence and reproduction

- `/captures/fern/journey-fast/`:60Hz full journey state and73 beat stills, initial source49ac127 plus candidate route later committed3daaee3.
- `/captures/fern/journey-final/`: b5196ff integrated165s state,150-frame10s motion baseline, WebM, timed stills, story/camera gates.
- `/captures/fern/journey-hud-final/`: authoritative050a7cc165s state,90-frame6s corrected motion clip `drop.webm`, all-frame sheets, ten stills, `hint-before-after.jpg`, `journey-timing.json` and gates.
- Mirrored under `playtest-output/fox-spirit/fern-journey/`; shared archive `keeping-swarm4-captures/fern/journey-050a7cc.tgz`.

```sh
node tools/camera-drop-probe.mjs /captures/fern/journey-hud-final 0 165 5198 \
  --route-module tools/journey-camera-route.mjs --dt 0.03333333333333333 \
  --size 480x270 --sparse-stills \
  --stills-at 75,82,85,104,121,127,133,142,150,164 \
  --clip --clip-from 94 --clip-seconds 6 --check-from 94 --check-camera \
  --expect-beat 'a leaf comes down'
```

TypeScript, feel lint/camera release checks and production build pass. This is offline SwiftShader simulation with a sampled15fps motion segment and silent footage. Ember separately reports ordered audio cues and no audio blocker on b5196ff (#swarm:715); that is not A/V-sync approval. Kit's external live GPU dark-frame/frozen-plaza report remains open until a landing clip actually uses the new module and demonstrates its progression. This route does not establish that the old recorder divergence was repaired.

Shared archive independently downloaded and SHA-256 matched: `3d94c620e210b8872c2d377747040acf36af973997b3fe4d1ef825b0dda8f071`. Compact acceptance: `fern-journey-acceptance.json`.
