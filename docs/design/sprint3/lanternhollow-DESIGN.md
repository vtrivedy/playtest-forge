# Lanternhollow — continuous arrival hub

Sprint 3 scope: a village within the existing arrival meadow, never a separate chapter. Soft, gentle animated realism; worn timber, warm plaster, muted rust roofs and small amber lamps. No new asset downloads or API keys.

Layout: arrival at (0,90) stays fixed. A dry Great Well at (-7,82) anchors a crescent of three modest dwellings west/east of the clear northbound lane. One taller chimney and a curved well canopy establish the silhouette; roofs stay below the distant mills. The opening lane (x=-3..3) and H-a approach (4.5,74.2) stay open. Village objects remain outside the existing continuous route, including the western turn toward Windmill Rise. Amberwood reads north; Reedmarsh east; Windmill Rise west. Three low timber fingerposts point to those actual destinations, with modest lanterns at the forks.

Verbs: arrive, wander the well apron, jump onto low benches, dash out to the Rise, or hold-jump at the existing H-a hearth. No pickups, currency, new buttons, gates or invented restoration mechanic. Dwelling bodies and the well receive matching collision; roofs are solid. Low furniture uses normal step-up collision. Preserve existing terrain, route and physics.

Color: all architectural materials join the existing ColorField patch list. Warm plaster and weathered stone dominate; restored rust timber and roof accents remain restrained. Lamps glow softly, never wash the plaza orange. The well remains visibly dry; no false world-completion state. Cumulative seasonal progression is deferred rather than faked.

Assets: reuse existing world stone/timber textures (ambientCG Rock035/Bricks085, Poly Haven bark_brown_02, CC0; assets/library/CREDITS.md). Architecture is original procedural geometry with rounded roof profiles and broad, quiet surfaces. Existing kit trees frame the settlement; no dense mesh dump.

Review gate: request Opus critique before implementation. GPU captures at immutable pushed SHA: wide arrival, well/roof silhouette, three exits, 15-second real arrival/idle clip plus window.__game. Personally inspect returned PNGs and state reports, fix concrete defects, recapture once. Until then build-clean candidate only; no main merge or visual-quality claim.
