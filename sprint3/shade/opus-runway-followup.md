I found one real gap: the primary release acceptance record ignores the new runway result. Everything else you asked about checks out.

**Bug**
- **`tools/gpu-capture.mjs:577`**: `shade-acceptance.json`, the main release record, still uses `passed:!contactFailure` and has no `stagingFailures` field. If the `shade-free` runway check fails, this file still says it passed. The failure does reach `report.failures`, and both `shade-two-frees-acceptance.json` and `shade-clear-acceptance.json` pick it up. Fix: add `&&releaseStagingFailures.length===0` to `passed` and save `stagingFailures:[...releaseStagingFailures]` alongside it.

**Minor gaps (not wrong, but worth knowing)**
- **Keyboard take in the combined records:** `shade-play` runs on a fresh boot after both combined records are saved. Its runway failure lands only in `shade-live-acceptance.json` and `report.failures`, so no combined release record includes it. If the DESIGN line "combined release acceptance records" is meant to cover the keyboard take too, they need to be written after that take.
- **Corridor width:** the setup scan only checks floor out to ±0.35m from the centre line, but the take fails only past 0.5m sideways. So the fox can be up to 0.15m outside the checked floor and still pass. The per-frame floor-gap check would still catch an actual fall.

**Verified**
- **Wired to all three takes:** `validateRunout` runs on `shade-free` (line 521), `shade-clear-free` with `maxDrop=null` (line 620) and `shade-play` (line 653). Each call is awaited. The one `page.evaluate` inside it is awaited too, and `validatePair` is synchronous.
- **All three runway scans are updated:** primary, keyboard and hill each check from -5.5m to 3.1m on three lanes. The fox starts at +2.7m (+2.6m on the keyboard take), so each has 5.5m of checked floor past the Shade. Primary and keyboard keep the ±0.2m flat-floor check, and the keyboard setup now records `direction`.
- **Hill slope:** the take itself has no start-height limit (`maxDrop=null`). It passes or fails on the floor under each traced position (gap ≤0.55m), at most 0.2s airborne, and ending grounded. The setup scan keeps the existing ±2.4m slope tolerance and adds the ≤0.3m step per 0.1m on each lane. The `&&safe` in the outer loop correctly stops the scan when an inner `break` fires.
- **Acceptance fields:** deaths are compared with `take.start.deaths` from the `video()` start state. Airborne time is counted in video frames against `ceil(fps*.2)`, which is 0.2s because traces record every frame. Initial direction and final position are recorded but not gated, which matches DESIGN.
- **Teleport:** confirmed. The `teleport` hook calls `cam.snapBehind(yaw)` at `games/fox-spirit/src/main.ts:779`, so W moves the fox along the staged yaw.
