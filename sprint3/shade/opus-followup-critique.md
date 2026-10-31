## Shade follow-up: code-only review

**This is a code-only review, not visual approval.** I read the design doc, the Opus critique, `shades.ts`, the `main.ts` release block, `tools/shade-simulation.ts` and the shade section of `tools/gpu-capture.mjs`. I didn't edit anything, run a browser or render, build, or run the simulation.

### Remaining blockers

1. **Return may never complete on sloped routes** (`encounters/shades.ts:381`, also `:379`). The arrival check measures full 3D distance to the route point (`s.pos.distanceTo(patrol) < .4`). But the shade's height is snapped to the ground (`:393`, `:403`), while the route point's height comes from the authored curve, which smooths between the authored points. Where those two heights differ by more than 0.4, the shade reaches the point horizontally, stops moving, and stays in `return` forever. The route point doesn't move outside patrol (`:374`), so nothing breaks it out. The chase leash at `:379` has the same height error, which can end a chase as soon as it starts. The simulation uses flat ground at y=0, so it can't catch this. Fix: compare horizontal distance only (`Math.hypot` on x/z), as the rest of the file does.
2. **A blocked step freezes the shade for good** (`:393-394`). This is critique #2, and it's now worse. A blocked step switches the mode to `return` without moving, and in `return` the next step is blocked again, so it stays frozen. In patrol, the same switch now also stops the route point. Any authored route that crosses a collider or a rise of more than 0.6 m parks the shade there permanently. Fix: in patrol, never change mode on a blocked step. In return, fall back after a timeout, either by resuming the route point or snapping to it.

### Checked and OK (code only)

- **Continuous smoke release:** the smoke settings are updated before `freed` is set. So on the first released frame, the release start time equals the previous frame's clock, release age is 0, and the brightness blend has no effect yet. Positions and alpha carry over with no jump. The motes finish fading at 2.4 s, the same moment the group is hidden.
- **Shader ordering:** the layers draw back shells, then body, then front shells, then motes, with the pool first. Wrap lighting now uses world space. One caveat: draw order is shared across the whole scene, so with two shades on screen, every back shell draws before either body.
- **Staged observer safety:** teleport clears the dash sweep (`main.ts:716`), so a teleport can't register as a hit. The near observer stands 2.9 m away, outside the 1.1 m hit radius, and is re-placed every 15 frames. The script fails if the observer gets hit, and the original chase distance is restored after the patrol clip.

### Not blocking

- Collision checks one point at the centre using the fox's body height, so the stag can still half-clip into props.
- The release colour is still a round disc, not a stroke: start and end are the same point (`main.ts:1364`).
- The simulation should add a sloped route and a blocked-step case.
