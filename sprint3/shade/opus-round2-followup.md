I reviewed the code only. I didn't run, render or edit anything, and didn't open a browser. I found no new blocking defects. Line numbers refer to HEAD `8560779`. That merge commit already resolved the conflicts listed in the session-start git status: there are no conflict markers, the working tree is clean, and the merge didn't touch any Shade logic.

## `shades.ts`: stopping distance and leaf retirement
- **The stopping distance is correct (`:393`).** The shade now travels at most `remaining − hitRadius − 0.65`, so it stops 1.75 m from the fox. A normal hit needs less than 1.1 m, so a fox standing still can't be hit repeatedly by a chasing shade. Patrol and return still move the full distance, so direct patrol contact still works. Both distances are measured on the ground plane, consistently.
- **One side effect:** a fox standing still inside the leash now keeps the shade in `chase` indefinitely. Its route is paused during chase, and the fox stays inside the 3 m drain. That matches "draws near", but the design should say outright that the stand-off lasts until the player dashes or walks away.
- **The chase/return loop from round 2 (#5) is still open.** A fox just outside the leash still triggers chase → leash → return → patrol → chase, with no cooldown. Issues #6–#8 from round 2 are also unchanged.
- **The 0.65 m margin is hard-coded.** If `hitRadius` is raised toward its GUI maximum of 2.5, it can stop farther away than `chaseDistance` (GUI minimum 2). Not a problem at the defaults.
- **Leaf retirement is correct (`:349`, `:369`).** After 10 s the loop and the upload flags are skipped. The per-frame `clone()` and `new` allocations also stop, since they sit inside the skipped loop.

## `shade-simulation.ts`: stationary-observer test
- **It doesn't check that the shade stays close or keeps chasing.** It checks for no hits and at least 1.7 m clearance, but not `mode==='chase'` or a maximum distance (say ≤ 2.0 m). If the shade dropped to return or patrol right away, the test would still pass. The next step's `return` assertion would also pass whether the shade left chase then or earlier. DESIGN says the test "confirms no hit while the animal remains close". As written, it only confirms the first half.
- **The leaf-upload check is valid but fragile.** It picks the first `InstancedMesh` in the scene, which is the leaves only because of the order things are added (`:297/302/307`). The matrix `version` check itself is sound. It doesn't check the `instanceColor` version.

## `gpu-capture.mjs`: shade section
- **The transition check proves less than it claims.** `patrol` is the shade's starting mode at frame 0, inherited from the previous clip. So the check proves chase and return happened, but not that the shade got back to patrol. Working through the timing, the return probably isn't finished before frame 600. The check also tests whether each mode appears, not their order. Modes are sampled every 15 frames, so a very short chase would make the capture fail loudly rather than pass falsely. That's acceptable.
- **Hits are safe at the near observer spot.** The fox is placed 2.9 m away and the shade moves at most about 0.4 m between placements, staying well outside 1.1 m. `hits===0` is a valid check.
- **The release wash check is sound.** I confirmed four points:
  - It matches the release stroke in `main.ts:1409` (strength 1.2, radius = `drainRadius`).
  - The dash stroke (1.5 strength, 1.6 m radius) can't be mistaken for it.
  - The centre tolerance of 0.05 m easily covers the `toFixed(2)` rounding.
  - At least 3.8 s of life will always remain 120 frames after the dash, and the strength is still 1.2 at that point.
  
  The check only runs when `typeof chaseDistance==='number'`. That's the wrong flag: it has nothing to do with the colour field. It's harmless on the current build, but a build without that tunable would skip the wash check without saying so.
- **The rename is clean.** Nothing else in the repo references `shade-chase`.

**Suggested follow-ups, all small:** in the CPU test, assert `mode==='chase'` and distance ≤ about 2 m after the 6 s approach. In the capture, either record a return→patrol transition (lengthen the clip, or move the fox far earlier) or relabel `patrol` as the starting state. Gate the wash check on `h.debug?.colorField` instead. GPU visual approval is still pending.
