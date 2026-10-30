# Hero mesh v2 — Opus stream review

Date: 2026-10-30 ~01:45 ET · Concept: `assets/concept/fox-turnaround.jpg` · Lock: `assets/concept/ART_LOCK.md`

## Verdict
**PASS vs blockout, adopted as `assets/hero/spirit_fox.glb`. PARTIAL vs concept.**
This is a large step up from the v1 sphere/capsule blockout: one continuous, slender, grounded quadruped with natural red-fox carriage, the art-lock palette, and a real quadruped gait. It is **not yet concept-level**: the concept's shaggy painterly fur and its huge smoke-and-leaf flame plume are only approximated.

## What it is
- **Base:** CC0 Quaternius fox (`assets/hero/source/fox_quaternius_raw.glb`), restyled. I rebuilt the look and re-proportioned the rest pose in Blender 4.2 headless.
- **Build (fully reproducible, about 10 s):**
  - Run `python3 tools/blender/scripts/hero_v2_textures.py` (writes the atlas and tail textures).
  - Then run `blender -b -P tools/blender/scripts/build_hero_v2.py -- <out.glb>`.
  - `build_hero_v2.py` runs two stage scripts: `build_hero_v2_look.py` and `build_hero_v2_anims.py`.
- **Re-proportion:**
  - Neck raised about 40° with the head held level, and the head scaled up 1.1×.
  - Ears 1.38× taller and more upright.
  - Legs slimmer and 7% longer.
  - Tail chain re-posed so it droops from the rump, then sweeps back and up.
  - The pose is baked into the mesh and applied as the new rest pose, so every clip inherits the new carriage.
- **Mesh:** welded, Catmull-Clark subdivided once and smooth shaded, with no separate primitives. The neck and chest were thickened, the cheeks fluffed out, the belly tucked, and the nose shrunk.
- **Surface:**
  - Region colours are baked into a 1024² texture: burnt-orange body, darker topline, paler underside, cream bib/muzzle/belly, umber thighs, charcoal socks, dark ear backs/tips, pale ear interiors, dark eye-liner.
  - The bake multiplies in directional fur-streak noise (along the body on the torso, vertical on the legs) and Cycles AO.
  - A tangent-space fur normal map is baked alongside.
- **Eyes:** the original thin strips, now narrow amber almonds with a dark slit pupil and a slight emissive glow.
- **Tail:** a new lobed fur-clump plume, 57 rings × 28 segments, skinned to Tail1–8. Its texture ramps rust → orange → gold along the length, and emission rises over the back half.
- **Spirit cards:**
  - 20 crossed ember-tendril cards along the tail, plus a 5-card flare at the tip.
  - 10 maple-leaf cards around the tip.
  - Ember wisps on both ear tips and along the neck crest.
  - 18 cream ruff tufts, 10 cheek tufts and 12 rust crest tufts.
  - Every card is skinned so it follows the animation.
- **Materials (glTF):**
  - Opaque: `FoxFur` (colour + normal), `FoxEye` (emissive), `FoxNose`, `EmberTail` (emissive, `KHR_materials_emissive_strength`).
  - `FurTufts` uses alphaMode MASK, double-sided.
  - `EmberWisps` uses alphaMode BLEND, emissive, double-sided; GLTFLoader turns depthWrite off for these.
- **Stats:**
  - File size: 1.93 MB. No Draco is needed, and the loader has no DRACOLoader anyway.
  - Body is about 5k quads; tail about 1.6k quads; cards about 160 quads.
  - One skin with 40 joints (IK and pole helper bones removed). Textures are JPG for the fur bake and PNG for the alpha atlas.
- **Orientation:** faces glTF **+Z**, which matches `setFacing(yaw = atan2(wish.x, wish.z))`. The old blockout faced −Z, so it ran backwards in-game; this is now fixed.

## Clips (same names, game-ready)
| clip | frames @24 | source / authoring | loop |
|---|---|---|---|
| idle | 80 | Quaternius Idle + slow tail sway + ear flick | yes |
| run | 14 | Quaternius Gallop (true quadruped rotary gallop), tail lifted and streaming, ears back | yes |
| jump_up | 10 | Gallop_Jump f7.5→11 eased (gather → hind push), chest up | one-shot |
| jump_apex | 12 | Gallop_Jump f11.6↔12.6 ping-pong (tucked suspension) | yes |
| jump_fall | 12 | Gallop_Jump f13.6↔14.6 (forelegs reaching down), nose down | yes |
| glide | 24 | Gallop full-extension pose, legs spread, slow bank and bob, tail wave, ears pinned | yes |
| dash | 8 | one fast gallop stride, head low, ears flat, tail straight back | yes |
| land | 12 | Jump_ToIdle f17→32 (touch-down absorb → stance) + body dip | one-shot |
| burst | 18 | authored: crouch → rear up with chest and head lifted, tail flared → settle | one-shot |

The source tail rotation is damped 50% because those swings were authored for Quaternius's thin tail. Filmstrips were checked for every clip: the gait reads as a believable fox gallop, and the tail no longer curls over the back or drags on the ground.

## Side-by-side evidence
- `assets/previews/review/hero_v2_turnaround.png`: concept front/side/¾/back above v2 rest, with locked cameras and lights.
- `assets/previews/review/hero_v2_clips.png`: concept motion row above run f3, dash f1 and glide f12.
- `assets/previews/review/hero_v2_face.png`: face close-up (amber slit eyes, cream muzzle, ear interiors).
- `assets/previews/review/hero_v2_three_q.png`: three-quarter beauty view.
- `assets/previews/review/hero_v2_vs_sol_trellis.png`: Sol's TRELLIS candidate under the same cameras.
- `assets/previews/review/hero_v2_ingame*.png`: fox-spirit playtest frames (`npx tsx tools/playtest.ts --game fox-spirit --script shrine`). The fox loads, stands grounded, faces its direction of travel, and the ember plume reads from behind.

## vs concept: matches
- Natural lean red-fox proportions, alert raised head, tall ears. Calm, not cute or chibi.
- Burnt-orange body, cream bib and muzzle, charcoal socks, dark ear tips, narrow amber eyes.
- Ear-tip ember wisps. The tail moves from fur through hot orange into gold flame tongues and leaves.
- A continuous welded mesh. Feet are planted, with no floating parts.

## vs concept: gaps (honest)
1. **Fur silhouette is too clean.** The concept is shaggy everywhere (back, haunches, legs). v2 has shagginess only at the ruff, cheeks and crest; the body outline is smooth. Next step: shell or fin fur cards along the dorsal line, haunches and backs of the legs, or a groom baked to cards.
2. **The tail plume is about 60% of the concept's volume and drama.** The concept's tail dissolves into a wide, smoky flame-and-leaf cloud, especially in the dash panel. v2's flame tongues are cards and the leaves are sparse. A runtime particle trail from the tail-tip bone would close most of this gap and belongs in game code (`fx.ts`/`main.ts`, owned by the game stream).
3. **The fur texture is procedural noise, not painted strands.** It reads as fine felt in close-ups and is fine at gameplay distance. Sol's TRELLIS texture is more painterly; projecting a cleaned concept-painted texture onto this UV layout is a possible next pass.
4. **The muzzle is slightly long and narrow** compared with the concept's shorter, finer snout. The chest bib is a little too white and bright under strong key light.
5. **Legs are slightly stilt-like** below the elbow and hock. The concept has a bit more forearm and paw mass.
6. **Clips are retargeted, not bespoke.** There is no anticipation pose in the dash, and burst is a simple rear-up.

## Sol TRELLIS candidate (`assets/hero/candidates/sol/fox_trellis_seed42.glb`)
- Pros: a painterly texture with a good face read.
- Cons:
  - Unrigged, 4.67 MB, and oriented along +X.
  - Flames are baked as lumpy, dark, charred-looking geometry, and the ears have melted chunks.
  - The tail is a slab, so rigging it would need cleanup and retopology first.
- Not adopted. Its texture could be a projection source later (gap 3).

## Notes for the game-code stream (I did not edit `games/fox-spirit/src`)
- `fox.ts` currently loads the GLB but **never plays clips**, so the fox stays in its rest/bind pose. Needed changes:
  - Create `new THREE.AnimationMixer(root)`.
  - Map `gltf.animations` by name.
  - Crossfade (about 0.12 s) between idle and run by speed, jump_up → jump_apex → jump_fall by `vel.y`, glide while gliding, dash on dash, and land on touchdown.
  - Play land, jump_up and burst with `LoopOnce` + `clampWhenFinished`; loop the others.
  - Call `mixer.update(dt)` each frame.
  - Run speed of about 1.0–1.3× looks right at current move speed; dash at 1.5×.
- `root.rotation.z = sin(t)` in `updateTail` rolls the whole model; drop it once clips play (the tail sways in the clips).
- `normalize targetLen = 1.35` now spans nose to tail-flare tip. If the fox reads small next to the world, raise it to about 1.6–1.8 (the plume makes up about 45% of the length).
- The BLEND ember cards rely on bloom: the current post stack has `bloomThreshold: 0.96, strength: 0.1`. Around 0.85 / 0.25 would make the tail and ear embers glow as in the concept.
- No DRACOLoader is required: the file is 1.93 MB, uncompressed.
- `window.__game` is undefined in the current working copy of `main.ts`; the playtest returned `metrics: null`. The `__gameHooks` object is present.
