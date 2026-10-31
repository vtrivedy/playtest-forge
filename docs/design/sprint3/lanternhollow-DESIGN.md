# Lanternhollow — continuous arrival hub

Current implementation specification. Revision decisions and pre-code proposals are recorded in [the GPU correction design](lanternhollow-r2-DESIGN.md); earlier commit versions preserve the initial blocking. Visual acceptance remains pending the integrated remote capture.

Lanternhollow occupies the existing arrival meadow within the continuous Russetvale scene. Soft gentle animated realism: weathered timber, warm plaster, muted rust roofs, stone well and small amber practical lights. The existing arrival at (0,90), checkpoint, H-a approach (4.5,74.2), terrain height and route through Windmill Rise to Kiln remain intact.

## Layout and collision

| Object | Centre x,z | Size / height | Collision |
| --- | --- | --- | --- |
| Bramble cottage | -18,92 | 5.2 × 4.2m; eave2.6/ridge4.0/chimney5.65 above ground | body box,12 sampled roof strips,chimney |
| Archive cottage | -26,88 | 5.6 × 4.6m; eave2.8/ridge4.4 | body box,12 sampled roof strips |
| East cottage | 12,95 | 5.2 × 4.2m; eave2.6/ridge4.0 | body box,12 sampled roof strips |
| Great Well | -8,85 | ring outer radius about1.6m; parapet.93m; timber pulley arch about3.6m | 12 masonry boxes; low post cylinders; overhead rig decorative |
| Rest bench | -10,91 | 2.2 × .7m; seat.8m | box,feet sunk into slope |
| Rise fingerboard | -10,67 | 2.3 × .42m at1.65m | decorative; points toward(-34,56) |
| Reedmarsh fingerboard | 25,88 | same | decorative; points toward(57,40) |
| Amberwood fingerboard | -3,78 | same | decorative; points toward(0,12) |

The two western cottages form a crescent around the well; the east cottage frames arrival. Their footprints remain outside the central lane. Maple(-19,82) clears the western roof corner and sightline. The existing arch and portal stones stay in place.

Bramble's doorstep bends(-18,95)→(-14,95)→(-12.5,89.5)→(-8,88), clearing its corner and the bench. Archive connects(-26,91)→(-24,95)→(-18,95). East connects(12,98)→(8,99)→(0,94). Other branches continue toward the existing realm destinations. Side trails use softly feathered terrain paint; extra packed-earth value contrast fades out from z80 to z72. No raised path geometry, hard color discs, scene changes or new gates.

Roof meshes and top collision share the same12-strip bowed profile. Fascia grows downwards; course lips rise only2.5cm above the top. Gables and wall plates close the roof volume. Side walls have timber rails and narrow framed windows. Window and lamp apertures retain their authored amber light outside ColorField at emissive.5±.025 with slow breathing; no new PointLights. All architectural stone/plaster/roof/timber remains in ColorField and begins sepia.

The Great Well remains dry. Its nonemissive carved stone maple relief identifies the village landmark without suggesting a Seedwell or interactable restore. The pulley is decorative above walking height. No seasonal completion is faked. Cumulative world-season progression remains future work.

Bramble's chimney emits eight restrained umber smoke puffs with soft radial alpha, a4.5s rise and gentle drift. They use the realm clock and explicitly opt out of raycasting so they cannot interfere with the camera-free photoBlocker probe. No NPCs or washing-line obstacles are invented.

## Player verbs

Arrive, explore the well apron, jump onto the low bench, dash out toward the Rise, and hold-jump at H-a. Move + jump + dash retain their existing behavior. No collectible loop, currency, new buttons or prerequisite gates. Restoration uses the existing ColorField aura/trail and realm flood; no new hub-only restoration mechanic.

## Assets and validation

Original procedural geometry, lettering, maple relief and smoke alpha. Reuse existing CC0 Bricks085/Rock035 masonry and bark_brown_02 timber surfaces (assets/library/CREDITS.md). No new downloads, paid assets or API keys.

Remote immutable capture requested for b791be5: matched overview, lower close arrival, well, three exits,15s live diagonal arrival/idle and natural chase, plus fox photography and the continuous Kiln route. Personal PNG/state inspection and Opus visual agreement are required before landing. First GPU candidate ee9459d was rejected for sparse grouping, blank walls, faint trails and unlit-looking lamps; the current pass addresses those specific defects but has no visual acceptance yet.

CPU verification:16 path segments clear at.4m of cottage/bench/well/post footprints;970 meadow-route sweep samples clear at.55m of new colliders;36 roof strips align within1.66e-7m;8 decorative sprite camera-free raycasts return no hits/errors. TypeScript and fox Vite build pass. These checks supplement remote play evidence.

Reproduce CPU checks with `npx tsx tools/tests/hub-geometry.ts`. The canvas stub only constructs CPU geometry and procedural materials; it never opens a browser or renderer. The raycast check specifically guards the smoke/photoBlocker integration defect found by Opus.
