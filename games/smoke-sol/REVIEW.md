# Amberwind smoke review

Played in Chromium / SwiftShader with real keyboard input and read window.__game. Production build passes (Vite reports a bundle-size advisory).

Feel: tested brisk jump 9/26 against spring 10/24. Brisk measured 1.563 units apex, .354 s rise, .687 s air; spring measured 2.087 units apex, .433 s rise, .883 s air on the short hold/release trial. Spring wins for readable hang time. A subsequent held-Space test confirmed gliding=true at a 2.064-unit apex and .436 s rise. Running plus Shift collected a gem; telemetry recorded one dash and one collected seed. Edge-triggered jump avoids automatic landing hops. The dash target is 3.24 units, not an independently measured distance.

Visual critique from /tmp/amberwind-review.png: coral ears, teal wings and cream tail make a readable silhouette; the scalloped mint island and ivory stepping path clearly frame the amber route. Follow camera shows the next gems comfortably. Bloom is restrained. Parasol undersides were too black; added lavender ambient fill for the retest. Ground render height was aligned to the collision surface. Widened the pickup radius to 1.25 units so the small lateral gem offsets are forgiving.

Limits: simple flat collision with a scalloped perimeter; trees are decorative. Camera has no obstacle collision. No audio. This proves a small traversal/collection loop, not a full platformer. Final harness telemetry may remain playing because its generic movement script does not deliberately visit every gem. Complete-win automation was attempted separately; do not treat generic harness completion as proof of collecting all four.

Final verification: required 20-second harness run writes screenshots, WebM and metrics into playtest-output/smoke-sol/. Work stops when those artifacts exist, per the bounded smoke instruction.
