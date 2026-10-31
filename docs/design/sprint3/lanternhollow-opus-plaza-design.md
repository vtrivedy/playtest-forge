# Packed plaza floor: design review (preparation only)

**Gate status:** I have not seen the paint/hearth candidate 1950cdc and I'm not approving it. Nothing here passes the gate or approves floor code. The floor stays conditional on your inspection plus my follow-up.

## What b458 shows (observed, `hub-hero-three-q`)
- In sepia, the lower ~45% of the frame is one flat low-chroma brown-grey. The shader's macro breakup and grass tint can barely be seen. The litter is sparse, small, pale flecks.
- I can't pick out the dark `hubWear` trail lines or the darkening around the well base at this camera. Value is the only thing that survives the sepia pressing. The warm hue doesn't.
- The fox's shadow side and legs sit at almost the same value as the floor. The 0640 diagnosis still holds for b458 only.

## Predictions from the source, not observed

1. **The warm bias will mostly disappear in sepia, and only the value lift will read.** In the restored state the warm bias will show, and near the well it can stack with the 2.5 practical light pool. That stack is how you get a "lamp pool / restored zone" look.
   - **Refinement:** use a flat plateau with no peak. Optionally move the plateau centre slightly away from the well lantern so that floor plus lamp never gets close to the chalky 4× look.
   - Take the warm bias from an existing palette colour (`PAL.pathEarth`, as `pathK` already does) instead of adding a new constant.

2. **An 18% linear albedo lift is about a quarter stop.** The `gMac` term in the shader multiplies by 0.6–1.18 at screen scale, so it can swamp a lift that small, and sepia compresses it further. My expectation is that it under-reads rather than over-reads.
   - Keep one config constant for the lift and judge it in capture. Don't raise it before seeing it.

3. **The darkening around the well will make a dark ring inside the bright floor.** `hubPathDistance` includes a 1.5 m disc at the well (`regionLanternhollow.ts:33`). `hubWear` (`russetvale.ts:608-610`) pulls umber in and multiplies by 0.8 out to about 3.6 m around the well and along every lane. Under a lighter floor, that becomes a dark donut at the well with dark lines crossing it. That is the "hard disc" failure, and it mixes two ground languages: worn means darker here and lighter there.
   - **Refinement:** apply the floor weight *after* `hubWear`, and fade `hubWear` inside the floor, e.g. `hubWear *= 1 - w * k`. Lanes then keep their dark value cue outside the plaza and blend into it at the edge. This is the one change to existing code I'd accept as part of this variable.

4. **Unbounded union with the lanes.** "Smoothly joined to hub lane distance" can't mean a plain `max(core, laneTerm)`. `HUB_PATHS` runs out to (57,40) and (0,12), so that would light every trail.
   - **Refinement:** gate the lane term by the core falloff, e.g. `w = max(core, lane * smooth01(outerR, innerR, coreDist))`, so it has compact support.

5. **The footprint reaches the cottages.** With an ellipse of rx 12 / rz 10 centred at (-8,88), houses (-18,92) and (-18,84.6) fall at normalised radius² of about 0.85 and 0.81. That puts them inside the floor, with lit floor running up to and past their back walls. (-9,99.6) sits at about 1.35, on the edge.
   - **Refinement:** let the falloff finish at the -18 doorsteps (about x ≤ -15.5) instead of at the radius limit. Alternatively, shape it as an ellipse with a shorter western reach plus the gated lane term to the (-12.5,89.5) junction, so thresholds are reached through the lane and not by flooding past the walls.

6. **Grid aliasing.** The terrain step is 1.5 m and colour is per vertex. Any falloff narrower than about 3–4 m (2–3 cells) will show faceted triangle edges. Use a falloff of at least 4 m.

7. **The grass patch tint may undercut "packed".** `gGrass` (`russetvale.ts:769-770`) tints olive-gold wherever the litter thins. If the floor also lowers `leafy`, olive patches appear in the plaza.
   - **Recommendation:** leave `leafy` untouched in v1 and make the floor a value-only change. If the plaza needs fewer leaves, test that as a later variable.

## Minimal clean implementation
- **Drop the roughness change.** Going from 0.95 to 0.90 is close to invisible at this roughness and under sepia. It is also the only reason for a shader change and a new attribute.
- **Why the attribute is risky:** both `M.terrain` and `M.ground` use `groundBlend`. Ground-bucket geometry, such as the bank at `russetvale.ts:1065`, already has to supply `leafy` explicitly, which suggests the bucket merge needs every geometry to carry the same attributes. A new attribute would mean touching every `bk('ground')` contributor, or relying on WebGL's default attribute value, which the design already forbids.
- **The result:** the whole floor is a CPU colour change in the terrain loop. There's one `plazaWeight(x, z)` function in the region file next to `hubPathDistance`. It is applied after `hubWear` and before bank/rim/creek and the existing per-vertex `vnoise3` multiply. It doesn't touch `groundBlend`, the ColorField hooks, the materials or `M.ground` geometry. Ledges and banks are unchanged by construction.
- **Restoration/sepia:** the floor only scales the albedo that ColorField already processes, so it inherits restored and sepia behaviour with no exemption.

## Invariants to check after implementation
- `plazaWeight` returns exactly 0, not just near 0, at pond (-18,70), the central realm, the (25,88)→(57,40) and (0,80)→(0,12) trails, behind the -18 houses, and at (12,95). Guard with `if (w > 0)` so untouched vertex colours are bit-identical; check by diffing the colour buffer against `main`.
- Weight is above 0.8 at spawn (-6,92), well (-8,85) and junction (-12.5,89.5).
- Collider, height, route, stepping-stone and house arrays are unchanged.

## Capture checks once implemented
- No dark ring at the well.
- No visible ellipse edge from the hero and arrival cameras.
- Floor plus lantern pool doesn't reach chalky values.
- The fox's shadow side separates from the floor.
- The stepping stones read darker than the floor, which is the intended and desirable result.
