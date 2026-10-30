# Color Fox — procedural environment kit

Headless Blender 4.2 builds (`tools/blender/scripts/env_build_*.py` + shared `env_common.py`).
Art lock: `assets/concept/world-keyart.jpg` + `assets/concept/ART_LOCK.md`.

```bash
blender --background --factory-startup --python tools/blender/scripts/env_build_shrine.py
blender --background --factory-startup --python tools/blender/scripts/env_build_maple.py
blender --background --factory-startup --python tools/blender/scripts/env_build_arch.py
blender --background --factory-startup --python tools/blender/scripts/env_build_leaf_pile.py
blender --background --factory-startup --python tools/blender/scripts/env_build_island.py
```

Each script is deterministic (fixed seed). It exports a GLB here and renders a 512px CPU-Eevee preview to `assets/previews/env_*.png`.

## Conventions

- **Units:** meters, glTF Y-up. The origin is at ground level, at the base center (the island origin is the center of the walkable top).
- **Front:** three.js **+Z** (Blender −Y). This is where the shrine niche faces.
- **Color:** albedo is baked into vertex colors (`COLOR_0`, linear). Materials are plain PBR (roughness 0.7–0.95, no textures). There is a wide value range from dark bark through mid stone to light grass, so the shapes still read when the world grade desaturates to sepia.
- **Foliage materials** (`MapleLeaf`, `IslandFoliage`) are `doubleSided`, and leaves are real maple-silhouette geometry, so no alpha or sorting is needed. Each leaf is 18 tris.
- **`EmberGlow`** (shrine only): a dark char base with orange emissive. The game should animate `emissiveIntensity`: about 0 in faded zones, 1–3 when restored, and pulsing with bloom.

## Assets

| File | Size (W × H × D m) | Tris | Notes |
|---|---|---|---|
| `shrine.glb` | 3.9 × 3.4 × 3.5 | ~1.5k | Weathered gray stone shrine on 3 square steps (0.2 m risers, top step at 0.6 m). It has a front niche with an ember bowl and maple-leaf carvings on all 4 faces (`EmberGlow`), plus loose stones. Materials: `ShrineStone`, `EmberGlow`. |
| `maple_tree.glb` | 5.9 × 6.5 × 6.5 | ~15k | Gnarled, twisted, leaning dark trunk with root flare and an umbrella canopy of ~700 leaf cards in crimson/rust/orange clumps. Materials: `MapleBark`, `MapleLeaf`. Hero/mid-ground tree; instance or LOD it if you place a lot of them. |
| `maple_tree_bare.glb` | 4.8 × 6.0 × 5.7 | ~3.1k | **The same skeleton** as `maple_tree` (same seed), as trunk and twigs only. Use it in faded zones and swap in place on restore. Material: `MapleBark`. |
| `ruin_arch.glb` | 5.7 × 5.0 × 3.0 | ~1.2k | Broken arch: two stacked-block pillars (0.84 m square), a 2.4 m opening, a 3.4 m spring line, and a collapsed crown. Fallen voussoirs and rubble lie on the ground. The opening spans X, so you walk through along Z. Material: `RuinStone`. |
| `leaf_pile.glb` | 1.8 m mound (2.7 with strays) × 0.6 | ~4.7k | Soft mound of maple leaf cards over a rust filler dome, plus stray leaves. Use it as a dash-through or pounce prop. Materials: `LeafPileBase`, `MapleLeaf`. |
| `island_chunk.glb` | ~8.4 × 5.4 × 8.6 | ~2.6k | Modular floating island. The walkable top sits at y≈0 (±0.05) with a radius of about 4.2 m. It has golden turf with rust patches, grass tufts and fallen leaves, a dirt band, and a faceted, stratified rock underside down to y≈−4.9 with outcrops. Rotate, scale and mirror it for variety. Materials: `IslandGround`, `IslandFoliage`. |

The procedural GLBs total about 1.3 MB, under the 15 MB budget.

`ember_mote.glb` in this folder is built by `build_ember_mote.py` (FX stream), not by this kit.
