# Independent Ashwater cistern route

Fresh default boot → rendered discovery invitation → physical page home → Ashwater arch → sluice, sinking reed
mats, islet dam, cistern, weir gate, punt and attempted wall crossing. Movement/jump/dash only after boot, no
placement, saved-unlock fixture or progress setters. Tesla T4/EGL, 640×360. Complete hook and `window.__game`+snapshots accompany screenshots. This is an authored solvability probe, not blind insight or game-length evidence.

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
