# Arrival Meadow (opening slice) — art design

Owner: ember. Code: `src/opening/meadow.ts` (+ shared builders in `lookdevKit.ts`, `lookdevGround.ts`).
Layout from `opening/layout.ts` (old Russetvale coords): village z 80–102, meadow z 64–90,
H-a hearth (5.6, 74.2), rock shelf centre (13, 75.5) 9 × 9, yaw .12, **top = ground + 5** (collider + visual agree).

## Read in one frame
- The village path spills south-east out of Lanternhollow into a shallow bowl of moss/umber meadow.
- **The shelf is the goal you can see from the well**: a chunky stratified stone outcrop
  (3 hewn strata, each lip overhanging the one below, moss cap + grass + leaf drift on top) that is the
  lowest step of a taller cliff ridge running south-east. A lone maple on the shelf top = the beacon.
- The cold hearth sits at the shelf foot on a worn earth apron; the path ends there (no ramp up).
- Groves frame both sides of the route and never sit on it; olive/moss canopies behind the fox's
  read line (lesson: fox is the brightest warm note), rust canopies only off-axis.
- Boulders: scattered pairs/trios at grove feet + ink contact lines where they meet the ground.
- Ground: moss/umber field, parchment path with worn patches, leaf-litter drifts under canopies,
  grass tufts kept off the route.

## Rules
- Arceus-chunky: few large readable forms, no small clutter on the route.
- Every cliff block gets a box collider so the fox can't clip through; the only way up is the updraft.
- Rim cliffs/ridges close the bowl beyond the play ellipse; far ridges fade into mist.
- Paint: all meshes use kit `toon()` so the trail/restore paints them; canopies climb from their base.
