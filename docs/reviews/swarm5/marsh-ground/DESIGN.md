# Ashwater peat and standing water

Kit's player-eye review (:702) and Reed's retained landing frame show an uninterrupted bright lawn beneath the rain. Change the ground's moss/sedge range to dark peat and subdued olive; preserve lighter dug banks for the route. Add a single stationary, terrain-clipped standing-water mesh in low dry-land depressions. Its irregular shoreline comes from the existing terrain triangles, not decorative discs. Exclude authored puzzle waters and their margins so drained channels remain legible. No collider, height, reset, ability, save or per-frame change.

Ownership: Reed owns only ground palette and static puddles. Cedar owns reeds and puzzle geometry; Maple owns mist/fog. No new state machine is introduced. The existing two-reach acceptance route remains the gameplay gate.

Validation: immutable before/after landing and channel screenshots, full fresh physical hub-to-Ashwater input replay, retained `window.__game`, zero page/console errors, all three canonical levels, both side memories and sinking-mat/flood assertions. Review the darkest ground and water/route distinction; correct the worst finding and retest once. Keep movement metrics from the route as context, with no feel tuning claim. Run TypeScript, production build and feel/world lint. Authoring geometry must be deterministic and allocate only during construction.

## First visual review and revision

`215f8e3c` T4 landing screenshot: peat replaces lawn and the saturated fox remains readable, but the nearest pool reads like a dark cutout. Retest candidate lightens the pool to grey-green sky colour and interpolates shoreline alpha from actual terrain depth. Maple's low mist is integrated separately. Add `--marsh-clip` to the existing physical hub acceptance: a six-second, 72-frame, 12 fps input-only walk after arrival; then ordinary movement returns to the landing before running the full puzzles. The clip is offline motion evidence, not a real-time performance measurement.
