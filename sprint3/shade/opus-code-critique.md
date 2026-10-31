**Code-only critique, not visual approval.** I read `sprint3/shade/DESIGN.md` and the HEAD diff, plus the surrounding code in `shades.ts` and `colorField.ts`. I didn't run a browser, render, build or capture, and I edited nothing.

## Correctness risks

1. **The shade may never get back onto its route** (`shades.ts:377,384,392`). The route point `s.u` keeps moving during chase and return. In return mode the shade moves at 1.0× the route speed, the same as the point it's chasing. On straight stretches the gap never shrinks below 0.4, so it can stay in `return` and trail its own route point indefinitely. Return speed needs to be faster than patrol, or `u` should pause while it's off-route.
2. **It can get stuck for good** (`:395-396`). If the next step's floor is invalid or more than 0.6 away, the shade switches to `return` and doesn't move. If the blocked step is on the way back to the route (a ledge or gap), it stays frozen every frame after that. Patrol mode can hit this too.
3. **Turning is slow and steps follow the current heading** (`:391-393`). Movement goes along the current heading, not toward the target, and turns smooth at a rate of 2.4/s. When the target is behind it, the shade walks away while turning, then circles back. Near the route point it can orbit or wobble at corners, which reads as drifting off-route rather than a slow drift along it.
4. **The pursuit isn't gentle in practice.** The chase target is the fox's exact position with no standoff distance, so the shade pushes into contact and sends `hit` events every frame while overlapping. `drains()` also uses `s.pos`, so the 3 m drain zone now follows the fox. That's a gameplay change the design doesn't mention.
5. **Leash measured from a moving point** (`:382`). The 4 m limit is checked against a route point that keeps moving, so a chase can end after a fraction of a second, or be cut short in uneven ways. Expect jittery patrol → chase → return cycles.
6. **There's no wall or prop collision.** Only `groundAt` is checked, so a chase can push the stag through rocks or scenery.
7. **Report accuracy.** `smokeParticles: 144` is hard-coded and `leaves: 48` is a constant, so `window.__game` doesn't report live counts. `uFringe` and `s.fringe` are now dead code, which goes against the "one clean state" rule.

## Visual risks

1. **Layer draw order breaks depth.** All five passes (body + 4 shells) are transparent with `depthWrite:false` and no `renderOrder`. Three.js sorts objects at the same position by id, so the body draws first and the BackSide shells blend **over** it. The far side of the smoke gets painted over the near body, which flattens exactly the side/chase depth the design asks about. Suggested order: back shells, then body, then front shells.
2. **No depth write at all.** The stag's own legs, head and body overlap in arbitrary order. Other transparent effects (pool at `renderOrder 1`, water, embers, dash trails) can pop in front of or behind it as the camera moves. The pool now draws over the legs.
3. **The shells may lose the stag outline.** Layer 4 is pushed 0.22 m out along the normals, which will swell the antlers and legs and can split at hard-normal seams. The design requires keeping the stag silhouette.
4. **The smoke shading turns with the camera.** The `wrap` term uses a fixed view-space light, so the bright side follows the camera instead of the scene's sun.
5. **The smoke pops at release** (`inkWisps`, `uReleased` branch). At `releaseAge=0`, every mote snaps back to its base position, and `life=sin(0)=0`, so all visible smoke disappears in one frame. After that, all 144 motes rise in sync on one shared age, which will look mechanical next to drifting smoke. They need per-mote age offsets and a blend from their current state.
6. **Motes cluster where the mesh is dense.** Sampling by vertex index puts motes mostly on the head and antlers rather than through the body. Points can reach 180 px up close, which is a lot of overdraw on top of five full-mesh passes per shade.
7. **The drain range no longer shows.** The ring was removed and the pool edge is noise-softened between 0.55 and 1.0, so players can't see the real 3 m drain reach.
8. **The release colour is a disc, not a stroke** (`main.ts:1363`). The stroke has the same start and end point, so it's a 3 m round blob with no direction. Also unchecked: whether the GPU colour mask caps or culls strokes.
9. **Eyes and leaves vs. the design.** The amber eye sprites are still there (dim, but the design says no glowing eyes; confirm). There are 48 leaves where the design asks for "a few".

## Before claiming visual quality
The design asks for a remote capture against baseline `2e0e614`, a check of the PNGs and `__game` reports, and a fix plus retest. Fix #1–2 first, since they can leave a shade stuck or off its route for good. Then fix the render order, then the release pop.
