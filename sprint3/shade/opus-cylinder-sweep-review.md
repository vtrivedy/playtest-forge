No blockers. I found no correctness regressions in the new `crossesShade` code.

**Math boundaries** (`games/fox-spirit/src/encounters/shades.ts:262-284`)
- **Strict edges match the old check.** The old code used `d<r` and `-.5<dy<3.2`, all strict. The new code builds two open intervals, clamps them to [0,1], and treats it as a hit only if `enter<exit`. So a segment that only touches the edge is still not a hit: `discriminant<=0` rejects a tangent in XZ, and a segment that only reaches y=−0.5 or y=3.2 gives an empty interval.
- **Starting exactly on the edge.** If the start point sits on the XZ circle (c=0) and moves inward, the roots are 0 and t>0, so the overlap is non-empty and it hits. That's correct, because every point after t=0 is inside.
- **Tiny or zero movement.** Very small but non-zero `a` or `dy` gives very large roots, which the [0,1] clamp absorbs. The cancellation in `-b+root` doesn't matter at metre scale. NaN inputs fail every comparison and return false, same as before.

**Stationary sweep**
- When `previousFox` is null, `previousFox??fox` makes a zero-length segment. Then `a<1e-12` with `c>=0` returns false, which is the same as `d<r`, and the `dy` slab check is the same strict test. So a frame with no previous endpoint behaves exactly as before.

**Resets and sweep state**
- Unchanged. `previousFox` is still updated once per frame at line 524, after the per-shade loop, and is still cleared by `resetSweep()` from both `main.ts` call sites (761 and 973). It still uses the dash radius for the whole segment when `dashing` is true, and the sweep is still measured against the Shade's position after it moves this frame. Both of those were already true before.

**Behaviour changes to be aware of** (both intended)
- **Body-contact hits are wider too.** The non-dash `hit` event uses the same function, so walking or jumping through the cylinder now registers in cases the old nearest-point check missed. That includes the old bug where the segment's own end point was inside but the nearest point was outside.
- **Fewer allocations.** The function no longer creates a `Line3` and a `Vector3` for each Shade every frame.

**Tests** (`tools/shade-simulation.ts:160-171`)
- **The grazing case is correct.** With the dash radius of 1.6 (1.1 + 0.5), the start point is 1.6025 from the Shade in XZ (outside) and the end point is 1.5932 (inside). The old projection clamps to t=0, so the old code missed it and the new code frees it. It is a narrow geometric margin (0.0068 m), but the inputs are exact numbers, so it isn't flaky. The first non-dash update at 1.60 > 1.1 can't trigger a hit by accident.
- **Only the grazing test catches the old bug.** The old nearest-point code also passes the "rising" test (nearest point (−1.5, 1.5, 0), d=1.5 < 1.6) and the "above" test. Those two guard the new interval code but don't show the fix. That's fine, but don't count them as reproductions of the bug.

**DESIGN.md**
- The last paragraph is accurate and says plainly that this is not claimed as the root cause of the unrelayed driver capture. One small fix: spaces are missing in "real60Hz-sized0.3m".
