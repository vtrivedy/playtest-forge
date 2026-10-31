# Lanternhollow — continuous arrival hub

Current implementation specification. The correction, dusk and roof design documents in this directory record the design decisions and Opus critiques. Visual acceptance is pending the integrated remote capture.

Lanternhollow occupies the existing arrival meadow within continuous Russetvale. The target is soft, gentle animated realism: weathered timber, warm plaster, muted rust roofs, a dry stone well and small amber practical lights. Natural arrival is now (-6,92), authored by the route stream; the old portal at (0,90), checkpoint, H-a approach at (4.5,74.2), terrain heights and continuous route through Windmill Rise to Kiln remain. The plaza prefix passes (-7.2,87) and (-4,88) before the portal.

## Layout and collision

| Object | Centre x,z | Size and height above ground | Collision |
| --- | --- | --- | --- |
| Bramble cottage | -18,92 | 5.2 × 4.2 m; eave 2.6 m, ridge 4 m, chimney 4.55 m | Body box, 12 roof strips, chimney |
| Archive cottage | -28.5,84.4 | 5.6 × 4.6 m; eave 2.8 m, ridge 4.9 m | Body box, 12 roof strips |
| East cottage | 12,95 | 5.2 × 4.2 m; eave 2.6 m, ridge 4 m | Body box, 12 roof strips |
| Pond-side cottage | -18,84.6 | 4.2 × 3.8 m; eave2.3 m, ridge3.5 m | Body box,12 roof strips |
| Arrival cottage | -9,99.6 | 4.4 × 3.6 m; eave2.3 m, ridge3.55 m | Body box,12 roof strips |
| Outer cottage | -37,86 | 5 × 4 m; eave2.5 m, ridge3.95 m | Body box,12 roof strips |
| Market stores | -23.6,85.2 / -22.4,85.1 | Low timber crate and lidded barrel | Box/cylinder |
| Communal cooking pot | -12,93 | Low stone ring0.25m; black pot/handles0.77m | Low ring cylinder +narrow pot cylinder |
| Great Well | -8,85 | Outer radius about 1.6 m; parapet 0.93 m; pulley arch about 3.6 m | 12 masonry boxes, low post cylinders; overhead rig decorative |
| Rest bench | -10,91 | 2.2 × 0.7 m; seat 0.8 m | Box; feet sunk into slope |
| Rise fingerboard | -10,67 | 2.3 × 0.42 m at height 1.65 m | Decorative; points toward (-34,56) |
| Reedmarsh fingerboard | 25,88 | Same | Decorative; points toward (57,40) |
| Amberwood fingerboard | -3,78 | Same | Decorative; points toward (0,12) |

Six cottages form a western crescent and arrival edge around the well; the east cottage frames arrival. Their footprints stay outside the central lane. The prior maple moves from(-19,82) to(-44,83), preserving all other tree seeds because the new pond-side cottage occupies its roof/canopy gap; the existing(-34,76) maple remains. The large arch remains; the purely decorative arrival stone ring is removed to clear the natural chase view.

Bramble's doorstep path bends through (-18,95), (-14,95), (-12.5,89.5) and (-8,88), clearing its wall corner and the bench. Archive connects(-29.2,87.5) through(-24,88.3),(-18.7,87.2),(-14,87.8) to(-12.5,89.5), clearing Bramble’s winter store. The outer cottage joins via(-37.7,88.7),(-34,90),(-32,88.5). Arrival cottage joins(-9.7,102.3) through(-5.7,102.3),(-5,100.5) to(0,94). East connects (12,98) through (8,99) to (0,94). Branches continue toward the existing realm destinations. Softly feathered terrain paint marks the trails; extra packed-earth contrast fades out between z80 and z72. There is no raised path geometry, hard color disc, scene change or new gate.

Roof meshes and collision use one gently rounded pitched profile sampled into 12 strips. It retains the original eave/ridge heights and footprint. Gables and wall plates use the same profile; slope-aware fascia sits below the roof surface. Restrained course lips rise 2.5 cm above it. Side walls have timber rails, braces and narrow framed windows.

The Great Well remains dry. A nonemissive carved stone maple identifies it without suggesting a Seedwell. The pulley is decorative above walking height. Seasonal completion is not faked; cumulative world-season progression remains future work.

Six visible winter log stores have matching small colliders behind the cottages. Low autumn fern/grass groups occupy the opposite rear corners, away from trails; coherent curled leaf drifts add ground detail. Eight faint, wind-drifting taupe smoke puffs rise from Bramble's chimney on the realm clock and opt out of raycasting. There are no invented NPCs or washing-line obstacles.

## Light and color

Architectural stone, plaster, roof and timber remain in ColorField and begin sepia. Tiny window and lamp apertures retain amber emission at 0.5 ± 0.025. Four short-range, shadowless PointLights at the well, Bramble porch, plaza and communal cooking pot provide practical lighting. The selected2.5 strength multiplier yields authored targets10/7.5/7.5/10 before positional dusk/flicker. Own, Sol and Opus prefer its captured well treatment over4x; whole-hub acceptance remains pending. Cottage plaster tint is d5c7ad; the Archive main-wall.92 multiplier remains, while infills/gables retain the base tint. This palette experiment remains under visual review. The low domestic cooking pot has contained3Dtongues beneath a black lidded pot/handles/trivet; no reactor registration, lift, restoration supply or rising ember cue. Solid ring/pot collision matches their visible extents; only flame VFX skips AO/raycast. Twelve amber pendants hang on three sagging cords: the original four-lamp plaza span and two short four-lamp cottage spans. The latter use connected roof/ridge hooks and the existing west post; no new ground posts. Lamp footprints clear actual ground by at least3m. Hooks/cords are camera decorations; solid house/post blockers remain.

The arrival basin has a continuous positional dusk blend: full by z88, gone by z68, fading beyond |x|45. Saved sky colors, horizon glow, cloud amount and key/hemi/rim values blend without compounding; fog color follows the sky while existing regional control retains fog density. Sun color scale.3 and size.0003 apply only in the hub, preserving shared Color identity and restoring saved originals outside. Exposure is unchanged. Capture hooks and window.__game notes report dusk and actual practical intensities. Targets are available in lil-gui. One visual updater serves normal and turntable rendering. This mood adds no restoration state.

## Player verbs

Arrive, explore the well apron, jump onto the low bench, dash toward the Rise and hold-jump at H-a. Move, jump and dash retain their existing behavior. No collectible loop, currency, new button or prerequisite gate is added. Restoration uses the existing aura, trail and realm flood.

## Assets and verification

Geometry, lettering, maple relief and smoke alpha are original. Materials and low foliage reuse existing CC0 library assets listed in assets/library/CREDITS.md. No new downloads, paid assets or API keys.

Immutable GPU requests are tracked in /streams/hub-r2/capture-request.json. Evidence includes a natural-spawn still and15s live chase before teleport/photo, matched old/new plaster proof at natural and hero cameras, a close full-body hero, well/exits/hearth-lane stills, fixed-view arrival/idle and checked context orbit. Staging and live input are labelled separately. None establishes a full hub-to-Kiln clear.

Latest personally inspected baseline b458abc includes all37 PNGs and window.__game/controller reports: grounded idle, zero deaths/assists, three lives and unchanged restoration; all540orbit poses clear. Machine green missed one completely black well still, so that package is not fully accepted. Earlier2d87 also received full37-PNG inspection. Opus06:40 agrees this is a readable lantern village and visible improvement, but final gate remains open for hearth crowding/dither, grey plaster and unorganized dark ground. Its critique is lanternhollow-opus-0640-visual.md. Current lighter plaster/hearth placement needs its own returned images before a floor pass. No extra density is approved by that critique.

The remote capture harness now checks actual hub PNG bytes, retains black first attempts, retries once with zero simulation and native paint callbacks, and compares camera/bone/state invariants. Context loss, persistent black or invariant drift fails. Remote video audits use explicit black thresholds and exact EOF frame duration. Canonical module packaging has one dependency checker. These are capture integrity checks, not art approval.

CPU geometry covers24 village paths, staged arrival diagonal and1,104 actual plaza/meadow approach samples. The plaza prefix uses its reviewed.4m actor inflation; old meadow samples retain.55m. Pond/cliff bounds,72roof strips aligned within2.2e-7m,540animated fire poses and eight camera-free smoke probes pass. Dusk tests protect against cumulative darkening, preserve shared sun identity, restore realm values exactly and retain fog density. TypeScript and fox Vite builds pass.

Run npx tsx tools/tests/hub-geometry.ts, npx tsx tools/tests/hub-dusk.ts, node tools/tests/hub-black-frames.mjs and python tools/tests/capture-module-packaging.py. These create no browser or renderer. Main integrations have followed explicit driver merge/build/landing instructions; maintenance landings do not constitute final visual acceptance.
