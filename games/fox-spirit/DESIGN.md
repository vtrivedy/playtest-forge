# Fox Spirit — autumn feel prototype

See `docs/vision.md`. Refs: `assets/concept/fox-turnaround.jpg`, `world-keyart.jpg`.

## Core verb
Stalk through a sepia world leaving temporary autumn color; awaken the shrine so fall floods permanently.

## Hero look
Burnt-orange fox, cream chest, dark socks, ember-flame tail. Grounded / mysterious — not cute. Particles: embers + falling leaves.

## Controls
- WASD move (camera-relative)
- Space = jump (edge-triggered + coyote + buffer); release early = short hop (`jumpCut`)
- Hold Space while falling = glide
- Shift = dash

## Feel target (PRESET_SPRING)
- Full hold apex ≈ 2.0–2.3 units, rise ≈ 0.4–0.46 s
- Short tap hop clearly shorter (cut once after hold)
- Landing squash / takeoff stretch

## Win
Activate the shrine. Gems optional path juice.

## Verify
`npm run playtest:fox` → playtest-output/fox-spirit/
