I found no new blocking defects at `ad8f08a`, and all four findings from the previous review are fixed. This was a code-only review: I didn't build, run, render or edit anything. Visual approval still waits on the GPU material retest for `90e1a4c`.

**Previous findings**

1. **Return timeout (fixed).** The timer now counts lack of progress instead of lack of movement (`shades.ts:433-438`). Its best distance is reset on both ways into return (`:392`, `:426-430`). Because the route point stays fixed during return (`:386`), the best distance can only shrink. So the Shade can no longer move sideways forever without timing out. The existing stall test (`shade-simulation.ts:106-119`) still blocks every candidate and still hits the 1.5s timeout.
2. **Preferred side (fixed).** The side loop is now outside the angle loop (`:412-418`). The Shade tries all three angles on its preferred side before switching, and the preferred side only changes when that whole side is blocked.
3. **Freeze after the timeout (fixed in code).** Detours now run in patrol too (`s.mode!=='chase'`, `:411`), with the same floor, ledge and wall checks. The new patrol test (`:157-159`) covers a post on the route itself. Whether this actually clears the stuck point at [-111.6,20,-19.28] from the GPU trace can only be confirmed on the GPU retest.
4. **Heading during stalls (fixed).** When every step fails, the Shade still turns smoothly toward its target (`:425`). When it moves, it faces its actual direction of travel (`:421`), which also handles the zero-length chase step correctly.
5. **Capture center (fixed).** `gpu-capture.mjs` now uses the average of the actual `shadeSpots[0].patrol` points (x and z). It still assumes `actors[0]` and `shadeSpots[0]` are the same Shade, which holds while spot 0 isn't an `afterLatch` Shade.

**Not blocking**

- **Slow return worst case.** A Shade gets a fresh 1.5s each time it gets 4cm closer, so a slow sideways crawl can stay in return for a long time. With a 3m gap that's up to about 110s, though it always ends eventually.
- **Patrol has no progress check.** Patrol detours have no timer, and the Shade moves at the same speed as its moving route point. If it ends up off-route, it may trail behind for a while or jitter in a concave pocket until the route point moves somewhere reachable. Check this in the GPU retest; it isn't a CPU blocker.
- **Outdated design line.** The first new paragraph in `sprint3/shade/DESIGN.md` still says "Retain timeout fallback only when every candidate is blocked", which the next two paragraphs replace. Deleting that sentence would keep the doc to one current description, as AGENTS.md requires.
- **CPU test gaps.** The CPU tests still only use posts, with no wall, corner or pocket shape, and no H2 terrain. That's acceptable as long as the GPU trace remains the check for those shapes.
