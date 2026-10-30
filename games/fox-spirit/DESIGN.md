# Fox Spirit — color awakening feel prototype

See `docs/vision.md`. Owned by scaffold/feel stream.

## Core verb
Run through an ink world leaving a temporary color splash; awaken the shrine so color floods permanently.

## Controls
- WASD move (camera-relative)
- Space = jump (edge-triggered + coyote + buffer); release early = short hop (`jumpCut`)
- Hold Space while falling = glide
- Shift = dash

## Feel target (PRESET_SPRING baseline)
- Apex ≈ 2.0–2.2 units, rise ≈ 0.4 s, air ≈ 0.85–1.0 s (full hold, no glide)
- Short tap hop clearly shorter than full jump
- Dash readable burst ~0.2 s
- Landing squash / takeoff stretch juice

## Win
Activate the shrine (gems optional path juice).

## Verify
`npm run playtest:fox` → playtest-output/fox-spirit/{shot-*.png,playtest.webm,metrics.json,feel-samples.json}
