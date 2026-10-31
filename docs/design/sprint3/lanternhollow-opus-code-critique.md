I found 6 real defects in the source, plus some smaller ones. The most important: all three signposts face away from the player, and one new path runs through a cottage corner. Everything below comes from reading the code and working the numbers by hand. I made no edits and didn't run a browser. My attempt to run a small check script was denied, so the terrain-dependent numbers are estimates.

## Source defects (from the code), in priority order

**1. All three fingerposts face the wrong way** (`regionLanternhollow.ts:141-155`). With `trs`/`rotation.y = yaw`, the readable face points along `(sin yaw, cos yaw)` and the "→" points along `(cos yaw, −sin yaw)`. With the yaws as written, each sign's readable face points at its destination:

| Sign | Face vs destination | Arrow vs destination |
|---|---|---|
| Windmill Rise (−10,67), yaw −1.9 | ≈6° | ≈96° |
| Reedmarsh (25,88), yaw 2.3 | ≈11° | ≈79° |
| Amberwood (−3,78), yaw π | 0° | 90° (points west) |

A player walking out from the village sees the blank back of the board. Seen from the far side, the arrow points sideways. The fix is to use `yaw − π/2` (or derive yaw from the path direction with `atan2`), then check that the readable face is visible from the approach.

**2. A path runs through the Bramble cottage.** The segment `[-31,87 → -24,92]` (`:13`) crosses Bramble's collider (x −26.7…−21.3, z 86.8…91.2) from about t=0.61 to t=0.84. That's roughly 1.6 m of painted path, up to about 0.6 m inside the cottage's south-west corner. The Archive → Bramble path leads straight into a wall. It needs a midpoint around (−28, 92.5).

**3. The Bramble and Archive cottages are jammed together.** Their roofs overlap in plan by 0.9 × 0.32 m (x −27.95…−27.05, z 86.44…86.76). At that spot Archive's roof top is about 3.09 m and Bramble's eave tip about 2.6–2.87 m (local). That means the roofs nearly touch or clip, depending on ground differences. The walls are only 1.4 m apart in x and 0.4 m apart in z. This is a pinch point with roofs overhead and a likely camera-squeeze spot. Move Archive about 1.5 m west or 1.5 m north.

**4. The pulley posts can be landed on, which the design forbids.** The `cylCollider` top is `wy+3.2` (`:127`). The coping is at `wy+.93` and the brisk jump apex is 1.85 m. From the coping the fox reaches 2.78 m, which clears the 2.6 m landing threshold (top minus 0.6 m step-up), and the post is only about 0.33 m from the coping edge. From the post top, a glide toward the Bramble roof and then the chimney looks possible (not measured). Fix: cap the collider at about `wy+1.2` so it only blocks walking.

**5. The new paths lose their clearing south of z = 72.** `hubClearance` returns false for z<72 (`:30`), but the Amberwood path (0,80→0,12) and most of the Reedmarsh path (25,88→57,40) are south of that line. Those trails get painted earth but no exclusion for boulders, bracken or grass. Boulders have no colliders, so a walk-through rock could sit on a painted trail. Also outside any clearing: the bench (−10,91) at 2.5 m from the path and 6.3 m from the well, the Amberwood post (2.8 m off its path), and the Rise post.

**6. The east–west crossing paths touch the portal stones and spawn.** `[-8,88→0,88]` and `[0,88→25,88]` pass 0.87 m from the portal stones at (−2.34,87.13) and (2.35,87.14), cross the spawn lane 2 m in front of spawn, and run through the ring. At 0.87 m the paint is fully worn earth. That puts packed earth around the key-art portal, which is exactly what point 4 of the earlier critique protected.

**7. There's an open slot under the eaves.** At the front and back walls, the roof's underside is at eave +0.24 m (Archive +0.26 m), but the front beam only reaches eave +0.04 m. That leaves a 0.20–0.22 m open gap along both long walls. The gables close only the side ends (`:83-104`).

**8. The west gable sticks out 12 cm.** It is extruded outward: with `sx=-1` it spans x ∈ [−w/2−.12, −w/2], while the east gable is extruded inward. The result is a step in front of the west wall plane.

**9. The sill rail is invisible and the door looks sunk.** The rail at `y+.43`, z d/2−.035…+.085 (`:69`) sits entirely inside the footing (front face d/2+.1, top y+.52). The bottom 0.5 m of the door also sits behind or in the footing with no step.

**10. Small attachment errors:**
- The lamp hanger height is fixed at y+2.55, but Archive's eave underside there is about 2.80 m. Its lamp floats 25 cm below the eave with no bracket (Bramble and East are about 4 cm, which is fine).
- The well lamp at (wx+1.7, wz+.22) intersects the leaning post, which is at about x wx+1.8 at that height.
- The pulley arch ends at ±2.0 m but the post tops are at ±1.75 m, leaving 25 cm stubs past the posts.

**11. Zone name and nits:**
- `zoneAt` now reports `Lanternhollow` instead of `A · Arrival Meadow` at spawn and the first checkpoint, which breaks the lettered naming. The capture labels in `tools/` still say "Arrival Meadow".
- The well's collider `top0/top1` is changed after `col.add` (`:122`); passing `top: wy+.93` directly would be cleaner.
- The `hubLamp` ±0.01 flicker is too small to see.
- All hub buckets are keyed to cell (−1,1), so the east cottage's bounding box grows the culling bounds. Harmless.

## Checked and correct

- **Roof mesh:** the profile/extrusion maps correctly to world z and x (`x' = −z`, `z' = x`), and x spans h.x ± halfW.
- **Roof collision:** `top0`/`top1` sit at local −hz/+hz and use the same samples as the mesh, so collision matches the mesh exactly.
- **Gables:** they follow the same arc as the roof.
- **Well:** its yaw convention matches `colliderTopAt`.
- **Chimney:** it sits inside the roof.
- **Bench:** 0.8 m, above the 0.6 m step-up, and more than 7 m from any roof.
- **East cottage:** about 11 m edge-to-edge from the H-a shelf, and a glide from its ridge can't reach the shelf.
- **Materials:** the new hub materials are in `patchable`, and ColorField's sepia does apply to emissive (`outgoingLight`), so lamps start sepia.

## Visual hypotheses (need GPU captures)

1. **Roofs reachable by jumping:** this needs 2.0 m against a 1.85 m apex. A 0.15 m terrain rise under an eave tip removes the margin, and I didn't measure the terrain.
2. **Spawn framing:** with a 54° vertical FOV at 16:9 (about 84° horizontal), the well lands near the left screen edge, Bramble is out of frame, and the East cottage is beside or behind the camera. The opening shot may show almost none of the village.
3. **Wayfinding:** the straight Amberwood trail leaving the checkpoint at (0,80) may read as the main route and pull players away from H-a.
4. **Trees:** crowns may hit the pulley arch (tree at −14,86, 4 m away at y 3–3.5) and Archive's back roof edge (tree at −34,76, about 5.2 m). `kitTree`'s avoidance list doesn't include hub geometry.
5. **Under-eave slot:** may read as a dark line, or leak light from low or close cameras.
6. **Roof shading:** 12 flat strips with per-strip tint may show visible banding instead of a smooth bowed roof.
7. **Windows:** they use the lamp emissive, so lit windows by day may suggest enterable interiors.
8. **Camera:** the occlusion check (`sightBlocked`) uses `highestAt` and ignores colliders' undersides. Sight lines passing under an eave will count as blocked and stipple the overhang (`occlusion.ts:103`). Expect boom compression in the Bramble/Archive pinch and inside the well ring (about 1.03 m inner radius).
9. **Ground contact:** the well stones, bench legs and pulley post bases sit exactly at ground height without being sunk in, so they may float slightly on slopes. The 1.5 m terrain grid will make the doorstep paths look blobby.

Fix 1–4 before the GPU capture pass; 5 and 6 are quick changes to the clearance and path lists.
