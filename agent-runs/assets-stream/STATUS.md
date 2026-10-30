# Assets stream status — 2026-10-30 ~01:11 America/New_York

## Art lock (t24u) applied
- Concept replaced: `assets/concept/{fox-turnaround,world-keyart,ART_LOCK}.md` (old cute → `old/`)
- Review scene rebuilt with ember turnaround refs
- Theme: mysterious slender fox + sepia→autumn restore

## Shipped on main (latest `e294bdc`, also `90797c4` `180d61d`)

### Hero — `assets/hero/spirit_fox.glb` (~408KB)
- Slender quadruped blockout, rust / umber / cream, pure-Emission ember-orange tail + ear tips
- 26 bones (Tail1–6), ~4.6k tris
- Actions: idle, run, jump_up, jump_apex, jump_fall, glide, dash, land, burst
- Previews: `assets/previews/review/fox_model_*.png` + `fox_anim_*.png`
- Verdict: **partial pass** — colors/silhouette match; mesh still sphere-capsule (not continuous fur). Eyes narrowed; still refine.

### Env kit — `assets/env/procedural/` (~1.3MB)
| Asset | Notes |
|---|---|
| shrine.glb | Stone + ember star glow — good |
| maple_tree.glb / maple_tree_bare.glb | Leaf cards rust/crimson — good |
| ruin_arch.glb | Broken arch — good |
| leaf_pile.glb | Maple mound — good |
| island_chunk.glb | Modular float island — shipped |
| ember_mote.glb | Saturated orange (Standard view) — readable |

Kenney Nature Kit CC0 also under `assets/env/kenney/`.

### Enemy — `assets/enemies/ink_ashling.glb`
Tall ink blob + spike legs + ember eyes. Preview camera still a bit high; silhouette OK.

### Audio — `assets/audio/` (prior commit)
jump, glide_whoosh, ember_pickup, shrine_restore, footstep, dash + autumn_ambient_loop

### Scripts
`tools/blender/scripts/build_spirit_fox_{model,anims}.py`, `build_ember_mote.py`, `build_ink_enemy.py`, `build_review_scene.py`, `env_build_*.py`, `env_common.py`

## Still open
1. Continuous fox mesh (or Quaternius restyle) — blockout not final
2. Skin weights polish (heat weighting had failures; envelopes on)
3. NPC spirit ally
4. Sol visual critique pass
5. Ink ashling front-facing preview + stronger silhouette
6. Keep total <150MB (currently ~15MB assets/)

## Approach
Parallel Opus env kit + hand-built fox after fox-Opus stalled. Filmic→Standard view transform fixed ember wash-to-tan in Eevee previews. Emission-only mats for wisps.
