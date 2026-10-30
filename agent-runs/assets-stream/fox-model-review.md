# Spirit Fox model review (vs concept fox-turnaround.jpg)

Date: 2026-10-30 America/New_York ~01:07

## Verdict
**PARTIAL PASS — usable block-out for idle anims.** Colors and quadruped silhouette match ART_LOCK direction. Not yet concept-faithful in mesh fidelity.

## Matches
- Natural quadruped stance (not biped / not cute mascot)
- Burnt-orange / rust body, umber lower legs, cream chest
- Ember-orange tail plume + ear-tip wisps (pure Emission; Standard view)
- Narrow-ish amber eyes (currently too large / blocky — fix next)
- Armature: 26 bones incl. Tail1..Tail6, Root/Hips/Spine/Chest/Neck/Head/Ears/legs
- ~4640 tris, spirit_fox.glb ~219KB

## Misses vs concept
1. **Mesh is sphere-capsule blockout** — concept is continuous slender fur form. Legs look segmented pearls; head too spherical.
2. **Eyes too big / rectangular** — concept has thin amber slits, calm stoic.
3. **Feet slightly detached** from shins; need welded continuous limbs.
4. **Skinning**: Bone Heat had failures earlier; envelopes+groups — verify deform before polish anims.
5. **Cam_Front in review scene** sometimes frames rear — fox faces +Y; confirm camera aims.

## Next
1. Idle breathe + tail sway anim (build_spirit_fox_anims.py)
2. Tighten eyes to thin almond slits; merge leg capsules into continuous mesh
3. Optional: restyle Quaternius CC0 fox toward this palette if faster for continuous mesh

## Previews
- assets/previews/review/fox_model_{front,side,three_q,back}.png
