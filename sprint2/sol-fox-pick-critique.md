# Sol — fox base pick: conditional GO

Agree: Quaternius wins as the 51-bone AnimalArmature + clip scaffold. This is a production decision, not art approval.
Khronos offers fewer clips without closing the visual gap. Sunset fox is an immediate art-lock reject.
The current fox reads as a generic low-poly woodland NPC. Orange paint and bloom will not reach the Zelda / Ori / Okami bar.

Concrete failures against the turnaround:
- Blunt wedge face, tiny eyes, and weak cheek/chest ruff lose the concept’s alert, knowing expression.
- Slab torso, angular joints, and pipe legs lack lean anatomy, shoulder rhythm, and convincing grounded paws.
- Short, capped tail misses the defining long brush dissolving into wisps; the rear gameplay view loses the hero feature.
- Flat facets and hard color blocks read as stock art rather than deliberate painterly stylization.
- Tan-orange and gray markings miss burnt sienna, charcoal extremities, warm cream, and amber focal accents.
- No ember breakup or ear wisps: there is no mysterious spirit identity yet.
- Still previews prove neither foot planting nor convincing weight, blends, braking, and landing feel.

Fox stream next, in order:
1. Freeze/document bone hierarchy and names, bind pose, axes, scale, root-motion policy, and clip timing; export one canonical GLB.
2. Restyle the EXISTING mesh on AnimalArmature: sharpen muzzle/ears, shape cheek/chest ruff, refine torso/paws, extend the tail silhouette. No new quadruped from scratch.
3. Reweight changed regions; check shoulders, hips, hocks, and tail through walk, gallop, jump, and landing before detailing.
4. Build painterly burnt-orange/cream/charcoal materials with controlled roughness and normals. Pass silhouette and neutral-light face review before FX.
5. Add tapered, layered tail/ear ember wisps and restrained amber emission. Keep body shape and foot contacts readable; bloom cannot repair anatomy.
6. Author Trot, left/right Turn-in-place, and Skid on the same armature; tune planted feet, anticipation, braking weight, and blend boundaries with locomotion.
7. Compare front/side/rear to concept, then play at the actual third-person camera distance. Capture screenshots + window.__game metrics; review, fix, retest once.

Locomotion: bind to AnimalArmature NOW. Do not wait for a new mesh; swap the restyled skinned mesh into the frozen skeleton contract.
Coordinate proportion changes with stride/contact calibration. Skeleton changes require an explicit migration, not a silent replacement export.

License risk:
- Quaternius pack is [CC0](https://github.com/Quaternius/quaternius.github.io/blob/main/packs/ultimateanimatedanimals.html). Archive source URL and license evidence for the exact download; no attribution requirement under CC0.
- Khronos Fox is [CC-BY 4.0 with named contributors](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Fox/glTF/Fox.gltf). If reused, preserve credits, link the license, and identify changes; do not quietly mix its data into a CC0-only package.
- BlenderKit “free tier” is not a license: exact asset terms remain unverified. The visual rejection makes reuse unnecessary.
- Record provenance for added textures/FX. Borrow quality targets from the named games, not their designs or assets.

Verdict: approve the scaffold; reject the current appearance. Next gate: a recognizable grounded ember fox, not another candidate hunt.
