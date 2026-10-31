I found two real problems and one weak spot in the new detour, plus a minor heading change. Nothing was run, per your code-only instruction. I did check that the existing "return stall recovery" test (`tools/shade-simulation.ts:106-119`) still blocks every candidate, so the timeout path is still tested.

**1. The timeout no longer guarantees the Shade gets unstuck (`shades.ts:423`).**
`returnStall` resets to 0 after any successful step, including a sideways one. The 1.5s fallback only fires when all seven candidate steps fail on every frame for 1.5s. In a corner, a concave pocket, or along a ledge lip, the Shade can keep making tiny moves without getting closer. One way: it slides along a wall to a corner, then flips side and slides back. Another: the 1.66 rad candidate is more than 90°, so it steps slightly away, then the next frame steps straight back. Either way it stays in `return` forever and never reaches patrol. The old code always timed out.
- Fix: count the stall timer by lack of progress, not by "didn't move." Track the closest distance to the target so far, add to `returnStall` while it isn't improving, and reset only on real improvement.

**2. The preferred side doesn't actually persist (`shades.ts:411-416`).**
The outer loop goes through angles and the inner loop through sides. So if the preferred side is blocked at 0.6, it switches to the other side at 0.6 before ever trying 1.2 on the preferred side. That doesn't match the "persistent sides" in DESIGN.md, and it's what makes the back-and-forth in #1 possible. Swapping the loops would make the side stick.

**3. The freeze seen at frame 540 is still possible (`shades.ts:410`).**
Detours only run in `return` mode. When the timeout fires, the Shade switches to `patrol` wherever it got stuck, off its route. In patrol, a blocked straight step has no detour and no stall handling, so it just stands still until the moving patrol point happens to come into a clear straight line. That's the same stationary-after-fallback behaviour in the GPU trace. So the fix covers frames 420–480 but not the post-fallback freeze, unless the cause of the stall turns out to be different.

**4. Minor: heading during stalls (`shades.ts:419-421`).**
When no step is possible, heading is no longer updated at all; before, it still turned toward the target. A stalled or blocked-chase Shade now holds its old facing instead of turning toward home. This is visual only.

**The new CPU test is valid but narrow.**
- The detour test does prove real arrival. By my rough estimate the chase moves the Shade about 1.3m off its route, so the timeout would leave it about 0.8m from the start point. That's well outside the 0.45 check, so a timeout can't pass the test by accident.
- It only uses a single 0.16m-radius post, which is easy to get around. It doesn't test a wall-plus-corner or pocket shape, which is where #1 and #3 would show up, and it isn't the terrain shape from the H2 trace.

**`gpu-capture.mjs` looks fine.**
- The capture center is now the average of the authored patrol points. It reads `shadeSpots[0]` through the same hook already used at line 253, and for an uneven loop the average is only an approximation of its center, which is fine for a camera.
- It still assumes that `actors[0]` and `shadeSpots[0]` are the same Shade. That holds as long as spot 0 isn't an `afterLatch` Shade.
