I found two likely problems and nothing that would crash. Callback signatures and option wiring are correct, and the ray and projection math checks out. One limit up front: this was a code read only. I didn't build, run or render anything, so none of this has been seen on a GPU.

## Checked and correct
- **Callback signatures:** `camera(actorId=actors[0].id)` is never passed straight to `video()`, which would have handed it the frame index as an actor id. The patrol call wraps it (`()=>camera()`) and the other calls pass no arguments.
- **Option wiring:** `sample(i,state)` writes to `state.capture`, which is what `validatePair` filters on and what `label(frame, trace.state)` reads. Frames that aren't keyframes leave `capture` undefined, so they drop out of the rows.
- **Camera angle:** `side=atan2(ux,-uz)` points at right angles to the Shade→fox line. Both `side-.65` and `side+π+.65` turn toward the fox, so both candidates are three-quarter shots from behind the fox. That matches the intent.
- **Frame-height fraction:** `(maxY-minY)/2` in screen coordinates (which run −1 to 1) is the correct share of frame height.
- **Skinned vertices:** `getVertexPosition` followed by `matrixWorld` is correct for skinned meshes in three.js's default attached mode. It reads the bones' world matrices, which `updateWorldMatrix(true,true)` keeps current.
- **Measurement timing:** `measurePair` runs after the render, on the camera that actually drew the frame (the photo override is applied in `draw()`). So it measures what was shown, even though `camera()` picks its shot from positions one frame old.
- **Shade bounds:** the core's height is exactly 3.1 m (rescaled at `shades.ts:95-98`). The density core is a single mesh, and the 4 layer clones are separate meshes, so `getObjectByName('shade-density-core')` returns just the body. The name `shade-hill-high` is used only as a data id in the level file (`russetvale.ts:1918`), so the scene search can't hit some other object first.

## Likely bugs
1. **The patrol observer is now placed as close to the Shade as allowed** (`gpu-capture.mjs` `safePosition`). It used to be the first valid spot in scan order. Now it's the spot nearest the Shade's start, which puts it right at the 2.1 m limit from the patrol points. That limit is checked only at the points, not along the curve between them. Turning attraction off (`chaseDistance=0`) stops a chase but not contact (hit radius 1.1 m). If the points are spaced more than about 3.8 m apart, the curve between them could reach the fox, trigger `Patrol observer was hit`, and abort the run. This is a risk I can't confirm without the actual point spacing.
2. **`shadeLensBlockedFrames` now mixes two different failures.** `clear:false` is set when nothing passes the size check and also when a shot fits but the line of sight is blocked. It also adds up across both Shades, now that the hill release uses `camera()`. So the counter no longer means "line of sight blocked". Splitting it into separate `noFit` and `blocked` counters would fix this.

## Gaps in what's measured
3. **The line-of-sight check ignores the fox and the Shade.** It only tests world scenery, and neither character is part of it. The chosen shots put the camera on the fox's side, so the fox can cover the Shade's core. Both size checks would still pass and "both readable" wouldn't hold. Nothing measures one character covering the other.
4. **The fox's measured size may include its flame effects.** The wisp and ear-smoulder meshes come from the fox's model file and get shown or hidden as a group (`fox.ts:55-68,163`). If they're skinned and visible, the visibility filter keeps them, and the "visible fox" height could be partly flame.
5. **The camera's size check runs close to its limit.** A 1.25 m fox about 6 m away at FOV 48 fills roughly 23% of the frame height, against a 21% cutoff. FOV 52 and 56 will usually fail it, so wide-angle shots or the fallback will be common. The fallback, a fixed candidate at FOV 56, still clears the 15% bar but is reported as blocked (see item 2).
6. **One camera candidate is wrong for the hill Shade.** The `radial` angle uses `reviewCenter`, the centre of the first Shade's patrol route, which means nothing on the hill. That candidate is effectively random there.

## Minor
- The fixed `H('photo',[x+5.5,…])` before the `shade-clear-free` video is now overwritten on frame 0, so it's dead code.
- When a shot fits but is blocked, the next FOV redoes the same two line-of-sight tests for the same camera position. Clearance doesn't depend on FOV, so that's up to three times the work for nothing.
- The CPU simulation always offsets the observer by +x and doesn't check the floor. The GPU run uses the first angle with a level, unblocked floor. The CPU pass therefore doesn't fully cover the GPU staging, especially the same-floor check at 4.8 m.
- The Shade's bob (up to about +0.24 m) is in the rendered mesh but not in `actor.pos`. Measurement uses the mesh, so this only nudges the camera's size estimate.
- The 4.8 m far ring is inside the Shade's 6 m `noticeDistance`, so the Shade will now notice the fox (turn toward it) during the far phases. "No forced modes" still holds, but the far-phase behaviour is different from the old 8 m ring.
