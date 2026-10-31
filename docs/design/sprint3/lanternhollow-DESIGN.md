# Lanternhollow — continuous arrival hub

Sprint 3 scope: a village within the existing arrival meadow, never a separate chapter. Soft, gentle animated realism; worn timber, warm plaster, muted rust roofs and small amber lamps. No new asset downloads or API keys.

Layout: arrival at (0,90) stays fixed. A dry Great Well at (-7,82) anchors a crescent of three modest dwellings west/east of the clear northbound lane. One taller chimney and a curved well canopy establish the silhouette; roofs stay below the distant mills. The opening lane (x=-3..3) and H-a approach (4.5,74.2) stay open. Village objects remain outside the existing continuous route, including the western turn toward Windmill Rise. Amberwood reads north; Reedmarsh east; Windmill Rise west. Three low timber fingerposts point to those actual destinations, with modest lanterns at the forks.

Verbs: arrive, wander the well apron, jump onto low benches, dash out to the Rise, or hold-jump at the existing H-a hearth. No pickups, currency, new buttons, gates or invented restoration mechanic. Dwelling bodies and the well receive matching collision; roofs are solid. Low furniture uses normal step-up collision. Preserve existing terrain, route and physics.

Color: all architectural materials join the existing ColorField patch list. Warm plaster and weathered stone dominate; restored rust timber and roof accents remain restrained. Lamps glow softly, never wash the plaza orange. The well remains visibly dry; no false world-completion state. Cumulative seasonal progression is deferred rather than faked.

Assets: reuse existing world stone/timber textures (ambientCG Rock035/Bricks085, Poly Haven bark_brown_02, CC0; assets/library/CREDITS.md). Architecture is original procedural geometry with rounded roof profiles and broad, quiet surfaces. Existing kit trees frame the settlement; no dense mesh dump.

Review gate: request Opus critique before implementation. GPU captures at immutable pushed SHA: wide arrival, well/roof silhouette, three exits, 15-second real arrival/idle clip plus window.__game. Personally inspect returned PNGs and state reports, fix concrete defects, recapture once. Until then build-clean candidate only; no main merge or visual-quality claim.

## Opus revision — exact blocking before meshes

Opus critique saved in persistent artifacts (`opus-design-critique.md`). Supersedes the provisional placement/solid-roof/bench language above.

| Object | Centre x,z | Footprint m | Eave/ridge/chimney m above local ground | Collision |
|---|---|---|---|---|
| Bramble cottage | -24,89 | 5.2 × 4.2 | 2.6 / 4.0 / 5.6 | box body, roof strips matching sampled slope |
| Archive cottage | -34,84 | 5.6 × 4.6 | 2.8 / 4.4 / none | box body, matching roof strips |
| East cottage | 17,93 | 5.2 × 4.2 | 2.6 / 4.0 / none | box body, matching roof strips; >15m from H-a shelf |
| Great Well | -8,85 | ring outer r1.55; apron r2.6 | parapet .85; pulley arch 3.5 | 12 stone wall boxes; ground at bottom; pulley decorative above head |
| Rest bench | -10,91 | 2.2 × .7 | seat .8 | box; >7m from any roof, cannot chain |
| Rise fingerpost | -10,64 | .22 × .22 | 1.9 | decorative narrow post off path at x-10,z67 |
| Reedmarsh fingerpost | 25,88 | .22 × .22 | 1.9 | decorative; points NE along authored worn-earth branch |
| Amberwood fingerpost | -3,78 | .22 × .22 | 1.9 | decorative; points north along clear meadow lane |

All wall faces ≥6m from the arrival lane. No new checkpoint-looking columns or PointLights: small hanging amber lights use emissive intensity .16 and no bloom flare. The well is a low dry domestic stone ring with timber pulley and rope, without crest glow, glyphs or inlet; it is a village landmark, not a Seedwell. Ground remains unchanged; threshold paths and well apron participate in terrain path-distance paint. All village surfaces begin sepia under ColorField; aura/trail temporarily warm them. SW1 is too far away to affect hub; only the existing flood can restore it. No seasonal completion is faked. The Rise sign is beyond H-a; player can explore side branches freely. Northern/eastern paths aim at Amberwood/Reedmarsh without a portal or scene load. Decorative overhead pulley is explicitly non-landable; dwelling roof collision follows the same piecewise linear profile as its geometry.

Blocking overlay: `lanternhollow-layout.svg` shows existing pond, trees, portal, arch, respawn, H-a shelf and route alongside the proposed footprints. Camera/skyline clearance remains a GPU review gate, not a claim from coordinates.

## Implementation critique revision
Archive moves west to (-34,84) to separate roofs. Its doorstep path bends via (-28,93) before Bramble's porch, avoiding the wall corner. Well-to-checkpoint access bends around the portal ring; east fork begins at the checkpoint rather than crossing the portal's standing stones. Side trails are narrower than the critical route and remain clear for their full length. Fingerboards align their long axis/arrow with actual destinations and carry correctly reversed lettering on both faces. Pulley posts block only at walking height (1.2m), so the decorative overhead rig cannot be a jump perch. Well masonry and bench feet sink .15–.2m into the slope. Front/back wall plates close the roof gap; gables extrude inward on both sides. Lamp hangers connect to wall brackets. These source corrections precede the first GPU review.
