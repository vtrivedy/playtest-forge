# Independent Ashwater cistern route

Fresh default boot → rendered discovery invitation → physical page home → Ashwater arch → sluice, sinking reed
mats, islet dam, cistern, weir gate, punt and attempted wall crossing. Movement/jump/dash only after boot, no
placement, saved-unlock fixture or progress setters. Tesla T4/EGL, 640×360. Complete hook and `window.__game`
snapshots accompany screenshots. This is an authored solvability probe, not blind insight or game-length evidence.

## Retained failures

| Immutable build | Input route / source | Observed result |
|---|---|---|
| d55703bd931e4d65be62cbb9f12d3c6ac1c0fa27 | Initial cistern route; before Cedar's reset fallback and corrected punt takeoff | Fresh entry, sinking-mat and rising-flood assertions pass; only teach/develop restored, 2,396 splashes. Final position [714.95, −0.43, 106.52]. |
| 7f4a670e6ba1bcb96828b97cf484901221e638c1 | Cedar's reset fix and corrected punt takeoff integrated; wall jump held 16 frames | Flood and punt reached; wall hop fails, only teach/develop restored. Canonical ability/well assertion fails. 48 splashes total, including repeated unsuccessful walks after the hop. |

Neither run reports a page JavaScript error. The latter reports the explicit harness acceptance error. These
failures do not establish that the current puzzle is unreachable; waypoint timing and short-hop height remain
possible causes. The original failure predates the reset fallback and cannot be attributed to the latest source.

On 7f4a670e, [the flood](reed-cistern/flooded.png) raises the pool and punt. Fox reaches [the wall](reed-cistern/short-hop-wall.png)
at [714.70, 4.52, 112.02], grounded on the punt instead of its 5 m wall target. Last jump apex is 0.771 m above
takeoff; splash count rises 4→5 during the attempted crossing. The subsequent route times out below the wall;
its nominal final screenshot name does not mean the Seedwell was reached.

Evidence: `/captures/reed/cistern-d55703bd/` and `/captures/reed/cistern-7f4a670e/`;
persistent volume `keeping-swarm5-captures/reed/world-entry-d55703bd93/` and `reed/world-entry-7f4a670e6b/`.

Source review: the current Ashwater module has removed its solution hints, retaining observational event captions.
That improves the no-solution-caption gate but does not prove blind-player comprehension.

## Held-jump retest — 26280aa30a1ea54d13dc7c1e853cd89a57ad710b

Only the wall hop's held-Space duration changes from 16 to 40 frames relative to 7f4a670e. Same fresh physical
route and hardware: **PASS**, zero JavaScript errors. Sinking-mat and rising-flood assertions pass. Wall landing
is [715.42, 5, 111.99]; final [717.91, 5, 106.63]. All three physical and canonical level facts restored,
Reedskim earned, Reed fill 1. Four splashes total; no reset storm. No geometry change was needed to make this
authored input route finish. This does not establish forgiving traversal for unfamiliar players.

Last wall jump reports apex 0.792 m, air time 0.717 s, time-to-apex 0.317 s. The small difference from the failed
short hop does not isolate a universal jump-height threshold; hold duration also changes the crossing's timing.

Personally inspected [completion](reed-cistern/completed.png) and [native-Tab Album](reed-cistern/album.png).
The teal Seedwell, restored-world memory and rain-marsh scenery are visible. Foreground reeds and a pillar partly
obscure the fox, and the same revelation appears at top and bottom. Solvability and earned progress pass;
whole-world visual quality and blind puzzle comprehension remain open.

Landing-to-completion time is **153.467 simulation seconds**, including the deliberate sinking-mat test and
authored waits/timeouts. It does not support a 10–15-minute world or a 30–45-minute game. No continuous video or
zero-black-frame claim follows from this run.

Full evidence: `/captures/reed/cistern-26280aa3/`; persistent volume
`keeping-swarm5-captures/reed/world-entry-26280aa30a/`.

## New geometry acceptance plan

Cedar's 5ac3f4fc changes the punt, shelf and wall heights. Repeat fresh default boot → physical invitation and homecoming → hub arch → all three puzzles. Use the new walkable punt/shelf coordinates from Cedar's probe without placement or progress setters. Keep the explicit lingering-mat, rising-flood and canonical reward assertions. Save screenshots and full game state on a pinned merged SHA; review the crossing and Album before reporting acceptance. This updates only the diagnostic route, not production geometry.

### Pier camera follow-up design

The new route passes on d126bc50, but 07e-wall shows the tall pier masking the fox. Register that solid mesh with the existing chase-camera occlusion fade, as Press already does for its solids. Preserve its collider and all puzzle coordinates/heights. Rerun the same pinned fresh hub route and compare 07e-wall before accepting the visual correction.
