# Lanternhollow — continuous arrival hub

Current implementation specification. The correction, dusk and roof design documents in this directory record the design decisions and Opus critiques. Visual acceptance is pending the integrated remote capture.

Lanternhollow occupies the existing arrival meadow within continuous Russetvale. The target is soft, gentle animated realism: weathered timber, warm plaster, muted rust roofs, a dry stone well and small amber practical lights. Arrival at (0, 90), the checkpoint, H-a approach at (4.5, 74.2), terrain heights and the route through Windmill Rise to Kiln remain intact.

## Layout and collision

| Object | Centre x,z | Size and height above ground | Collision |
| --- | --- | --- | --- |
| Bramble cottage | -18,92 | 5.2 × 4.2 m; eave 2.6 m, ridge 4 m, chimney 4.55 m | Body box, 12 roof strips, chimney |
| Archive cottage | -26,88 | 5.6 × 4.6 m; eave 2.8 m, ridge 4.9 m | Body box, 12 roof strips |
| East cottage | 12,95 | 5.2 × 4.2 m; eave 2.6 m, ridge 4 m | Body box, 12 roof strips |
| Great Well | -8,85 | Outer radius about 1.6 m; parapet 0.93 m; pulley arch about 3.6 m | 12 masonry boxes, low post cylinders; overhead rig decorative |
| Rest bench | -10,91 | 2.2 × 0.7 m; seat 0.8 m | Box; feet sunk into slope |
| Rise fingerboard | -10,67 | 2.3 × 0.42 m at height 1.65 m | Decorative; points toward (-34,56) |
| Reedmarsh fingerboard | 25,88 | Same | Decorative; points toward (57,40) |
| Amberwood fingerboard | -3,78 | Same | Decorative; points toward (0,12) |

The western cottages form a crescent around the well; the east cottage frames arrival. Their footprints stay outside the central lane. The maple at (-19,82) clears the western roof corner and sightline. The large arch remains; the purely decorative arrival stone ring is removed to clear the natural chase view.

Bramble's doorstep path bends through (-18,95), (-14,95), (-12.5,89.5) and (-8,88), clearing its wall corner and the bench. Archive connects (-26,91) through (-24,95) to (-18,95). East connects (12,98) through (8,99) to (0,94). Branches continue toward the existing realm destinations. Softly feathered terrain paint marks the trails; extra packed-earth contrast fades out between z80 and z72. There is no raised path geometry, hard color disc, scene change or new gate.

Roof meshes and collision use one gently rounded pitched profile sampled into 12 strips. It retains the original eave/ridge heights and footprint. Gables and wall plates use the same profile; slope-aware fascia sits below the roof surface. Restrained course lips rise 2.5 cm above it. Side walls have timber rails, braces and narrow framed windows.

The Great Well remains dry. A nonemissive carved stone maple identifies it without suggesting a Seedwell. The pulley is decorative above walking height. Seasonal completion is not faked; cumulative world-season progression remains future work.

Three visible winter log stores have matching small colliders behind the cottages. Low autumn fern/grass groups occupy the opposite rear corners, away from trails; coherent curled leaf drifts add ground detail. Eight faint, wind-drifting taupe smoke puffs rise from Bramble's chimney on the realm clock and opt out of raycasting. There are no invented NPCs or washing-line obstacles.

## Light and color

Architectural stone, plaster, roof and timber remain in ColorField and begin sepia. Tiny window and lamp apertures retain amber emission at 0.5 ± 0.025. Three short-range, shadowless PointLights at the well, Bramble porch and plaza create real warm pools. Four amber pendants hang from one sagging cord on two timber posts, clear of the paths and jumping fox.

The arrival basin has a continuous positional dusk blend: full by z88, gone by z68, fading beyond |x|45. Saved sky colors, horizon glow, cloud amount and key/hemi/rim values blend without compounding; fog color follows the sky while existing regional control retains fog density. Exposure is unchanged. Capture hooks and window.__game notes report dusk and actual practical intensities. Targets are available in lil-gui. One visual updater serves normal and turntable rendering. This mood adds no restoration state.

## Player verbs

Arrive, explore the well apron, jump onto the low bench, dash toward the Rise and hold-jump at H-a. Move, jump and dash retain their existing behavior. No collectible loop, currency, new button or prerequisite gate is added. Restoration uses the existing aura, trail and realm flood.

## Assets and verification

Geometry, lettering, maple relief and smoke alpha are original. Materials and low foliage reuse existing CC0 library assets listed in assets/library/CREDITS.md. No new downloads, paid assets or API keys.

Immutable GPU requests are tracked in /streams/hub-r2/capture-request.json. Evidence covers matched overview/exits, a lower arrival, well detail, live arrival/idle, natural chase and a checked context orbit. Photography and the natural Kiln route are requested separately or in combined runs. Personal PNG/state inspection and Opus visual agreement are required before self-landing. The first candidate was rejected; intermediate 1ab6d10 visibly improves warm apertures and wall detail but remains below the village bar.

CPU checks cover 16 village paths against solid props, 970 meadow-route samples, 36 roof strips aligned within 2.2e-7 m, and eight camera-free smoke raycasts. Dusk tests guard against cumulative darkening and fog-density resets. TypeScript and the fox Vite build pass. These checks supplement remote play evidence.

Run `npx tsx tools/tests/hub-geometry.ts` and `npx tsx tools/tests/hub-dusk.ts`. Neither creates a browser or renderer.
