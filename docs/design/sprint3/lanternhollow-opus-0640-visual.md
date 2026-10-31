# Lanternhollow hub (b458abc): visual critique

## Verdict

**It reads as a lantern village and it is clearly better than cd3. It does not pass the final hub quality gate.** The images I reviewed support landing it as maintenance, not as approved art. The candidates for the 2.5 default, the lighter plaster and the hearth at (-12,93) have no returned images, so I'm not judging them.

## What visibly improved vs cd3 `hub-arrival-close`

- **cd3** was an empty dusk field. The fox was a speck in the middle of a large dark plaza, a big bloomed sun and the ruin arch took over the right half, and the cottages sat far off at the left edge as background. It did not read as a village.
- **b458 `hub-spawn-chase` / `hub-hero-three-q`:** the cottage row, the string of hanging lamps, warm lit windows, the well arch with its lantern, and the bench/table now form one cluster that frames the fox. The sun is smaller, and the windmill/ruin sits back as a quiet hazy shape. The fox is large and readable, warm orange against the cool-grey sepia, with a soft tail glow. This is a real gain in composition and in reading as a village.
- **Practical 2.5 vs 4:** I agree with you and Sol that **2.5 is better.** At 4 the top of the well rim goes chalky and the light pool on the ground spreads and flattens the stone. At 2.5 the lantern still reads as the source and the rim stays stone. The difference is small, so the choice is low risk.

## Worst failure (in the images I reviewed)

**The cooking hearth sits in the foreground of the natural spawn view (`hub-spawn-chase`, contact sheet frame 0).** The pot and stone ring fill the bottom-right third of the frame, overlap the fox's rear legs and tail area, and the pot shows a visible **checkerboard camera dither.** It is the first thing a player sees, and it reads as clutter with a rendering artifact on top. The proposed move to (-12,93) targets exactly this, but I have no image of it, so it stays open.

**Second, and the structural problem: the ground plane is unorganized.** In every frame, roughly the bottom 40–50% is one flat dark brown-grey value with sparse leaves. It is close in value to the roofs, the shadowed sides of the well stones and the fox's shadow side. Nothing defines a plaza, a lane or a threshold. The only ground-level structure is a few stepping stones at the left of the practical shots. In `hub-hero-three-q` the lower half of the frame is dead space. The plaster also reads a cool neutral grey, not cream (the lighter-plaster candidate addresses that, but it's unseen).

Smaller notes:
- **Contact sheet frames 120–420:** the fox stops tangent to the well post and lantern, so its head and ears merge with the post silhouette and the rear well stone.
- **`hub-spawn-chase` ≈(625,400):** a small dark hanging object with two glowing dots reads like eyes or a creature. Check it in the next capture.

## One bounded next fix: **ground organization**

Do this only after the plaster and hearth candidates have been reviewed. Don't stack it on top of them unseen.

- **Density is rejected.** The cluster is already enough, and more props would break the quiet restraint.
- **Material separation** is already being tested by the plaster candidate. Judge that first, alone.
- **The next single variable:** one worn, packed plaza floor around the well. Make it a slightly lighter, warmer value than the surrounding ground with soft painterly falloff edges, made from the existing ground material by changing value and roughness only. It should loosely connect the spawn, well and cottage-lane thresholds, and extend the stepping-stone language already present.
- **Do not add:** new props, scatter, emissives, texture noise, cobble grids or shader exemptions.
- **Target:** the lower frame gains a readable "this is the square" shape, and the dark fox shadow side separates from the floor.

## Status

| Item | Status |
|---|---|
| b458 visible improvement vs cd3 | **Yes**, accepted as an improvement |
| b458 as landable maintenance | Fine, on the build-clean basis only |
| 2.5 over 4 | **Agree** (b458 same-camera pair) |
| Lighter plaster (f803f5d) | **Unseen**, not approved |
| Hearth to (-12,93) (1df) | **Unseen**, not approved |
| Final hub quality gate | **Not passed:** hearth crowding/dither visible, ground unorganized, plaster still grey |
| Route clear / movement | No claim made |

## Updated shots needed to settle the verdict

All from one immutable SHA that contains f803f5d (2.5 default + lighter plaster) and the 1df hearth move:

1. **`hub-spawn-chase`**, natural lens (-3.3126,2.3636,94.6866), FOV 54: hearth out of the fox silhouette, no dither anywhere in frame.
2. **`hub-natural-arrive-chase-contact-sheet`** (frames 0/60/120/210/300/420): check the hearth across the whole approach and the fox/well-post tangency at the end.
3. **`hub-hero-three-q`**, same camera as b458: plaster vs timber vs ground value separation.
4. **Re-captured `hub-well.png`**, confirmed non-black by a pixel check, at the 2.5 default.
5. **A hearth-in-new-lane still** showing the western lane, bench and hearth together: it should read as domestic, not hidden or crowded, and the lane should be clear.
6. **Plaster before/after pair**, same spawn and hero cameras, b458 (old tint) vs new SHA (d5c7ad): only the walls should change.
7. **Same camera as cd3 `hub-arrival-close`**, so the wide-arrival comparison is like for like.
8. **Orbit sample stills** (e.g. 4 cardinal poses near the hearth): no camera dither triggering on the relocated hearth.
