# Fox Spirit — autumn feel REVIEW

Playtested Chromium/SwiftShader via `tools/playtest.ts` (`shrine` + `feel-probe`). Art refs: `assets/concept/fox-turnaround.jpg`, `world-keyart.jpg`.

## Art
- Unrestored: warm sepia grade on world mats (color-mask), parchment fog.
- Fox: burnt-orange body, cream chest, charcoal socks, ember ear tips + flame tail — bypasses mask.
- FX: additive embers from tail + falling maple leaf points (no rainbow wisps).
- Restore: shrine floods permanent autumn chroma; HUD reads AUTUMN RESTORED.
- Gaps vs keyart: fox still capsule-built (not painterly fur); island is a flat disc not misty floating peaks; lookdev/`src/render` stream owns richer ink-wash.

## Feel (PRESET_SPRING)
- Shrine run won in ~2.5s; apex landed ≈ **2.00** u, rise ≈ **0.38** s, air ≈ **0.77** s on a cut hop along the path.
- JumpCut is one-shot and only after a post-takeoff hold — short taps shorten, full holds keep height.
- Edge jump + coyote + buffer; landing squash / takeoff stretch present.
- lil-gui spring/brisk presets exposed.

## Verify artifacts
`playtest-output/fox-spirit/{shot-start,shot-mid,shot-end}.png`, `playtest.webm`, `metrics.json`, `feel-samples.json`.

## Next (this stream)
- Tune short-hop vs full-hold contrast in a dedicated feel-probe table.
- Optional: slightly longer flame-tail mesh / more leaf density once assets stream ships fox GLB.
