# Lanternhollow: blocking critique before meshing

I read `docs/design/sprint3/lanternhollow-DESIGN.md` against the arrival section of `russetvale.ts`: the route at L427–434, the H-a step at L889–900, the checkpoint lanterns at L1935, the portal and arch at L1954–1970, and the pond and dock at L1972–1990. **Verdict: not ready for meshing.** The design gives no coordinates for anything except the well, and several of its implied placements collide with things already in the scene.

## Layout

1. **The well apron runs into the pond bank.** The pond ellipse (−18,70, 15×9) starts lowering the terrain at about z≈78.8 when x=−7, and Wen's dock runs from (−6,72) to (−13,71). A well at (−7,82) with an apron of about 4 m reaches down the bank slope. Either move the well to roughly (−8,84) or later, or keep the apron radius at 3 m or less. Check `groundRaw` across the whole footprint. "Preserve terrain" rules out flattening it.
2. **The west dwelling site is taken.** There is a meadow tree at (−14,86) with height 9 (`MEADOW_TREES[0]`). The design says both "preserve" and "existing trees frame the settlement," so pick one: move the tree, which is a terrain/kit change and needs saying, or move the dwelling.
3. **The east side is already crowded and has a sequencing job.** Already there: the checkpoint lantern at (2.6,80) with respawn at (1.0,80), the H-a hearth at (5.6,74.2), the 5 m shelf at (13,75.5) whose code comment says "no ramp… the hearth is the way up," and a tree at (16,82). A solid-roofed east dwelling plus step-up benches becomes a staircase onto the shelf and skips the H-a teaching beat. **Blocking:** the east dwelling must be at least 8 m from the shelf. Its eave must sit below jump apex from any bench, or there must be no bench nearby. Also keep it out of the H-a glide arc toward (21,64).
4. **The portal ring and arch frame need clearance.** The standing stones sit on r=5.4 around (0,92), and the pointed arch at (0,85) is the key-art frame onto the Wellspring. The well canopy and chimney at x≈−7 will sit in the spawn camera's left foreground, right next to the arch. Prove the arch-to-Wellspring view stays clear from the spawn camera before anything gets built.
5. **There is no camera clearance rule.** "The lane stays open (x=−3..3)" isn't enough. With a third-person boom, wall faces within about one boom length of the lane will cut between camera and fox on the first turn. Specify at least 6 m from lane centre to any wall, or a camera-occluder fade, and say which.
6. **"Below the distant mills" is measured in the wrong space.** Mills at y22+ about 100 m away are tiny next to an 8 m chimney 10 m from spawn. Write caps: eave ≤3 m, ridge ≤5 m, chimney ≤6.5 m. Pass condition: the mill skyline stays unbroken in the wide arrival capture.

## Wayfinding and gameplay

7. **The fingerposts don't match the route.** The real path is H-a → shelf → glide south-east to (21,64) → west (−10,64) → (−34,56). A west-pointing "Windmill Rise" sign at the well sends players along the pond's north shore, past the whole H-a/shelf beat. Either put the Rise post after the H-a beat, at around (−10,64), or accept skipping it and say so. "Reedmarsh east" is really north-east (78,22), about 100 m away with no authored path. Don't point at a destination with no path, or else draw the trail.
8. **Fork lanterns borrow the checkpoint signal.** Checkpoints are `lanternPost` plus `lanternColumn` plus a PointLight. More lanterns in that style weaken what checkpoints mean, and more PointLights produce exactly the orange wash the design bans. **Blocking:** fork lamps need a different shape (small hanging or bracket lamps), emissive only with no PointLight, and they must stay clearly below the checkpoint lamp's emissive 0.28.
9. **The dry Great Well looks like something to fix.** Seedwells in this world are stone basins that light up. A large dry stone well with a canopy, eight metres from spawn, invites players to try to fill it, and the design forbids a mechanic. That's a dead end. **Blocking:** keep it out of the Seedwell look (no `lanternColumn`, no `glowMat`, no trough or inlet shape), or let it carry an existing sight line toward SW1–3 and say so.
10. **Bench heights aren't specified.** "Jump onto low benches" plus "normal step-up collision" contradict each other: if you can step onto a bench, you never have to jump. Give a height band above step-up height and well below a single-jump apex. Lay benches out so they never chain to an eave.
11. **The curved canopy collider isn't specified.** A curved, solid roof on a box or cylinder collider will make the fox float or clip. Either match the collider to the curve (low-poly hull) or make the canopy non-solid above head height. Same question for the rounded dwelling roofs: say whether they can be landed on.
12. **"Dash out to the Rise" isn't a real verb.** Nothing in the route or geometry asks for a dash there. Cut the line, or add an actual dash moment.

## Art and colour

13. **"Restored rust timber" at spawn could fake completion.** If ColorField treats arrival as unrestored, saying "restored" anything at t=0 contradicts "no false completion." State the starting ColorField tint for each village material, and what changes, if anything, after SW1.
14. **There's no ground treatment.** Path paint only follows route segments (`pathDist`, L533). The well apron and dwelling thresholds will float on grass unless they get their own worn-earth or flagstone ground. Spec this as part of the existing ground pass, not as new decals.
15. **Material budget.** Put every new mesh in the existing `bk()` material×cell buckets so they merge. The village sits in the arrival 64 m cell and shouldn't add draw calls per house.

## Missing before meshing

The doc needs a blocking table: x, z, footprint, eave/ridge/chimney height, collider type and solid-or-not for the three dwellings, the well and canopy, every bench, and the three fingerposts. Then a top-down overlay against route segments, the pond ellipse, the portal ring, the H-a shelf and arc, the existing trees, and the checkpoint respawn. Do points 1, 3, 7, 8 and 9 first. Mesh work shouldn't start until those are fixed.
