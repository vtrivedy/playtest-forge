# Independent physical portal circuit

Fresh default boot, rendered paper-invitation follower, physical homeward fold, walking through all arches.
No teleport, saved-unlock fixture or progress setter counts as circuit proof. Complete hook and `window.__game`
states accompany each screenshot. Script: `tools/world-ashwater-acceptance.mjs OUT --entry-tour`.

## Negative visual evidence — 053e9e0c7dab36b0313a9633c0ec8b17c2f02df9

Tesla T4/EGL, 640×360. Fresh discovery → page home → Ashwater → home → Press → home → Ashwater re-entry
passes all five world/travel-count assertions with zero JavaScript errors. Both foreign-world arrival frames show
a clear fox silhouette and visibly different weather/palette. Both home-return frames are almost wholly blocked
by timber despite camera state `blocked:false`: fox at `[-5.2,0,92.5]`, lens around `[-4.807,1.35,94.918]`.
This is a **visual failure**, not a satisfactory route pass. Maple fixes return arrivals in `f0648a42`: land inside
the arch the player left, facing the well. A later boot investigation identifies the Maple Seedwell at `[-5,95.2]`
behind the old wake position, almost exactly at this failed camera position. The clear retest below establishes the
return fix independently of the initial arch-lintel hypothesis.

Original full evidence: `/captures/reed/world-tour-053e9e0c/`; Modal volume
`keeping-swarm5-captures/reed/world-tour-053e9e0c7d/`.
[Marsh entry](reed-world-tour/ashwater.png), [winter entry](reed-world-tour/press.png),
[occluded home return](reed-world-tour/home.png).

## Breadth measurement

`npx tsx tools/world-area-audit.ts` samples the exact baked controller mask at one-metre cell centres.
On 053e9e0c, permitted footprint is Russetvale 9,076 m² (160×120 m bounds), Ashwater 13,272 m²
(134×126 m), Press 6,993 m² (103×99 m). Water, obstacles and potentially disconnected cells remain included;
this is **not** collision-free reachable area or authored session duration. Route harness timing instrumentation
separates simulated gameplay time from capture wall time. Neither measure establishes 10–15 minutes per world.

## Limits

This circuit does not solve either foreign world's puzzles, measure blind-player comprehension or prove continuous
video/black-frame stability. The slab-wall winter scene and flat marsh shading still need richer landmarks and
exploration. Existing waypoint puzzle probes establish solvability, not insight or the new breadth/story bar.

## Physical retest — acc040474a775abd2aec5c2fa187d7cb754d5695

This integrates Maple's `f0648a42`. Same fresh physical circuit on Tesla T4/EGL: **PASS**, all five transitions,
zero JavaScript errors. Ashwater return lands `[-3.84,0,89.16]`; Press return lands `[-9.69,0,90.13]`.
Both retained frames now clearly show fox and village instead of timber. Reviewed both at full capture resolution.
[Home from Ashwater](reed-world-tour/home-fixed-ashwater.png), [home from Press](reed-world-tour/home-fixed-press.png).
Full screenshots and hook/`window.__game` evidence: `/captures/reed/world-tour-acc04047/`; persistent Modal volume
`keeping-swarm5-captures/reed/world-tour-acc040474a/`.

The harness now records simulated time, distinct from render/capture wall time. Circuit total 157.317 s;
146.967 s in Russetvale (including the 90 s discovery policy), 6.167 s in Ashwater, 4.183 s in Press.
No foreign puzzle was solved in this circuit; these numbers do not establish game length.
TypeScript, production build, `lint:feel` and whitespace checks pass on the integrated tree.
