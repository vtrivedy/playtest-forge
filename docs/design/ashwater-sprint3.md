# Ashwater Reach — sprint 3 identity pass

Branch: s3-reach. Original procedural scenery; no new licensed downloads or APIs.

## Intent
A drowned alder wetland held between pale aqueduct ribs. Cool slate, dark teal water and grey willow silhouettes distinguish Reach from Russetvale; copper bells and sparse reed heads retain autumn warmth. Soft animated realism, restrained painterly surfaces, no neon or photoreal noise.

## Play
Keep move, jump/hold glide and dash. Existing source → water transit → six metre buoyant ferry → water-fed bell remains the critical path. HIGH floats three timber bodies; LOW exposes the ferryman lane. No orb loop, no new ability or input. Keep warning/occupied retention/no-false-latch semantics. Add measured water surface and buoyant support telemetry so screenshots cannot substitute for play evidence.

## Build scope
- Replace W1 maple placement with original bare alder/willow trunks and drooping branches, restrained copper reed beds, wet shoreline stones and waterline stains.
- Local cool-grey masonry/cliffs rather than changing the shared Russetvale kit.
- A Reach-only water surface: deep teal body, broad soft sky reflection, low travelling ripples, shoreline breakup. Avoid a white foam ellipse or opaque salmon quad. Fine contact wakes at the floating hulls communicate displacement.
- Timber ferry gets dark pontoons and pale worn deck rims; visible fixed moorings/high-water marks make six metre motion legible.
- Frame the existing reachable bell islet through a broken aqueduct and sparse willow silhouettes for a payoff vista. Decorative meshes stay outside movement lanes.
- Preserve collisions and existing timing unless code review or GPU evidence identifies a defect. No changes to fox movement, rig, world 1 or shared water shader.

## Verification
Run npx tsc --noEmit and fox Vite production build. Push immutable branch SHA, request reachview,reach,reachsafe remote GPU shots and window.__game reports. Compare baseline and after from matching views. Inspect actual PNGs personally; solicit Opus critique, fix concrete failures, request one retest. Never merge until visual and telemetry evidence reviewed. Source setup/photo cameras are disclosed staged views; route/cycle use real controller inputs.

Missing checkout references: sprint3/briefs/_style-update-1105.md, COMMON.md, sprint2/critic/STATUS.md and external sprint2 lessons/concept path. Supplied brief and docs/design/art-direction.md govern until driver supplies them.


## Pass 1 Opus response
Code critique: avoid floating water-sheet edges, rigid elevator motion, W1 maple silhouettes and warm restored masonry. Replaced the main mist disc with small bank patches; added partial cistern banks while preserving west boarding and south LOW-lane spillways. Visual hull heave (under 2 cm steady, damped 4.5 cm landing dip) does not move collision. Added support index, actual fill derivative, water surface and freeboard to Reach state. Willow/reed tips use anchored, low-amplitude breeze; bark uses existing CC0 scan with original tint.

Existing CC0 surface sources reused: Poly Haven bark_brown_02 (https://polyhaven.com/a/bark_brown_02), ambientCG Bricks085 and Rock035 (https://ambientcg.com/view?id=Bricks085 and https://ambientcg.com/view?id=Rock035). See assets/library/CREDITS.md. All added geometry/shader code is original repository work; no external model, generated image, API key or new download.
