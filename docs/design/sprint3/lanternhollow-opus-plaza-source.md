# Source review: packed plaza floor prototype (uncommitted working tree)

I read only `regionLanternhollow.ts:20-74`, `russetvale.ts:570-649`, `tools/tests/hub-plaza.ts`, the design doc and the prior opening review. I didn't render, run or edit anything. Your measurements (2.38817, 26825/26693/132) are taken as reported. I haven't reproduced them.

## Verdict

**Keep full wear cancellation for this first prototype, but stop describing it as an 18% lift.** I don't recommend changing the code before capture.

- **Option A, full cancellation (current code), matches the design.** The design says the wear fade "is part of the same floor variable". At w=1, `russetvale.ts:609-613` applies the same `base × 1.18` to every core vertex. That removes the trail lines and the well ring by construction, which no other option does.
- **Option B, keep the umber hue and fade only the `.8` darkening, would bring the ring back.** Trail and ring vertices would stay `lerp(c, soilUmber, .65)` against meadow `c`. That removes only the `.8` part of the parent's contrast. The design requires "no dark well ring", so B fails that requirement on paper. The upside is that the change would be an exact, hue-preserving 1.475× on trails (1.18 / 0.8).
- **Partial fade, e.g. `(1 - .5w)`, gets the downsides of both.** It adds an untested tuning literal and still leaves a weaker ring. The capture couldn't attribute the result to anything clean.

## What the 2.388× means

The ratio is the change in a single vertex compared with the parent. It isn't the contrast between neighbouring vertices.

- At full weight, former trail vertices lose a pull of 65% toward umber plus a 0.8 darkening. Each channel recovers by a different amount, so **those vertices shift in hue as well as value.**
- The new hue is whatever meadow lies under the wear: `soilUmber`, `grassDry`, or `grassGold` where `n1`/`n2` noise is high. I haven't checked PAL values, so whether gold swathes appear is a prediction.
- Leafiness doesn't change (hubWear only gates `reedDrift`), so leaf litter isn't the confound.

The honest label is: **"core plateau = removal of hub-trail wear (≤2.39× per channel on worn trail vertices, with hue moving toward the meadow underneath) + 18% scalar lift on all core vertices."**

That also makes the earlier prediction that "18% under-reads" untestable with this capture, because both changes land together. If the plaza reads well, the result can't be credited to 18%. If it under-reads, raising the lift is still the next single-variable step.

## Risks to check in the capture (predictions, not yet observed)

1. **Grass or gold blotches in the plaza** where wear used to suppress them. It would read as "lighter meadow" rather than packed earth. This is the main way A could fail.
2. **Trail lines may fade out into the falloff.** At partial w the dark lines shorten. Check that they still read as arriving at the plaza rather than stopping in a blurry gradient.
3. **A possible bright patch at the junction (-12.5, 89.5) and around the well.** That's where full wear meets full weight, the likely site of the 2.388 maximum.
4. **Effects the CPU test can't see:** interpolation across the 1.5 m grid, compression by sepia/ColorField/ACES, and how the 2.5 lantern pool stacks on top.

If (1) shows up, B is the fallback for the next round, accepting a measured ring. Don't pre-empt it.

## Test harness

The approach is sound. It runs the real terrain slice from the immutable `a616a54` source against the current file, with no reimplemented logic. Bit-exact checks on position/normal/uv/leafy, index and route are what's needed. Gaps:

- **Validity hole: only `russetvale.ts` is pinned to the old commit.** The "before" module's imports, including `./regionLanternhollow` (modified, uncommitted) and PAL, load from the working tree. If `HUB_PATHS`, `hubPathDistance` or other imported helpers changed, the "before" isn't really the parent. Either pin those files from git as well, or assert the regionLanternhollow diff only adds exports.
- **The ratio is printed but never bounded.** Assert a bound, or report p50/p95 and how many vertices exceed 1.18. That way the wear-removal subset is measured rather than described.
- `changed` counts only the R channel. That's fine as a count, but label it.
- `current >= previous` passes empirically. It isn't guaranteed (removing the umber pull only brightens a channel where it's above umber), so it's a measurement, not an invariant.
- The output note already says "18% authored lift plus removal of prior dark wear". Keep that wording in the commit message too.
- Minor: temp `.ts` files are written into `src/` while the test runs, so a concurrent Vite or tsc run could pick them up.

## Status

| Item | Status |
|---|---|
| Source vs design contract | Consistent. Full cancellation is the specified behaviour |
| Change before capture | None needed. Fix the labelling and pin the imports in the harness |
| Floor on main | **No.** It stays off main until the 1950 baseline review and the floor GPU comparison |
| Visual or final gate | Not approved, no claim |
