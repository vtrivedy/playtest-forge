# Library credits — sources and licenses

Every file under `assets/library/` is CC0 or CC-BY as listed. Prefer CC0 for the shipped game; CC-BY requires attribution in-game or credits screen.

## HDRIs — Poly Haven (CC0)
| File | Source URL | License |
|------|------------|---------|
| `hdris/autumn_field_puresky_2k.hdr` | https://polyhaven.com/a/autumn_field_puresky | CC0 |
| `hdris/kiara_1_dawn_2k.hdr` | https://polyhaven.com/a/kiara_1_dawn | CC0 |
| `hdris/spruit_sunrise_2k.hdr` | https://polyhaven.com/a/spruit_sunrise | CC0 |
| `hdris/the_sky_is_on_fire_2k.hdr` | https://polyhaven.com/a/the_sky_is_on_fire | CC0 |

API: `https://api.polyhaven.com/files/<id>` → `hdri/2k/hdr.url`

## Textures — Poly Haven (CC0)
| Folder | Source | License |
|--------|--------|---------|
| `textures/bark_brown_02` | https://polyhaven.com/a/bark_brown_02 | CC0 |
| `textures/bark_willow` | https://polyhaven.com/a/bark_willow | CC0 |
| `textures/brown_mud_leaves_01` | https://polyhaven.com/a/brown_mud_leaves_01 | CC0 |
| `textures/cobblestone_floor_13` | https://polyhaven.com/a/cobblestone_floor_13 | CC0 |
| `textures/forest_ground_04` | https://polyhaven.com/a/forest_ground_04 | CC0 |
| `textures/forest_leaves_03` | https://polyhaven.com/a/forest_leaves_03 | CC0 |
| `textures/forrest_ground_01` | https://polyhaven.com/a/forrest_ground_01 | CC0 |
| `textures/grass_path_2` | https://polyhaven.com/a/grass_path_2 | CC0 |

## Textures — ambientCG (CC0)
Color + NormalGL JPGs at 1K (AO/Rough/Displacement/sidecar formats stripped for repo size). Source pattern: `https://ambientcg.com/view?id=<ID>` / zip `https://ambientcg.com/get?file=<ID>_1K-JPG.zip`

| ID | Use |
|----|-----|
| Bark012, Bark014 | Tree bark |
| Grass001 | Grass |
| Ground037, Ground077 | Dirt / path |
| Leaf001, ScatteredLeaves001, ScatteredLeaves008 | Fallen autumn leaves |
| Rock023, Rock035 | Rocks / cliffs |
| PavingStones070, Bricks085 | Shrine / ruins stone |

## Nature models — Poly Haven (CC0)
Optimized GLB (decimated + JPEG textures ≤1k). Original glTF via Poly Haven API `gltf/include`.

| File | Source | Notes |
|------|--------|-------|
| `models/nature/boulder_01.glb` | https://polyhaven.com/a/boulder_01 | |
| `models/nature/dead_tree_trunk.glb` | https://polyhaven.com/a/dead_tree_trunk | |
| `models/nature/dry_branches_medium_01.glb` | https://polyhaven.com/a/dry_branches_medium_01 | |
| `models/nature/fern_02.glb` | https://polyhaven.com/a/fern_02 | |
| `models/nature/grass_medium_01.glb` | https://polyhaven.com/a/grass_medium_01 | |
| `models/nature/rock_moss_set_01.glb` | https://polyhaven.com/a/rock_moss_set_01 | |

Dropped from repo (too large; re-fetch if needed): fir_tree_01, tree_small_02, coast_rocks_01, coastal_cliff_01.

## Kenney (CC0)
Already in `assets/env/kenney/` — https://kenney.nl/assets/nature-kit — CC0. See `models/kenney/README.md`.

## Fox candidates
| File | Source | License | Verdict |
|------|--------|---------|---------|
| `fox/quaternius_fox.glb` | Quaternius Ultimate Animated Animals — Fox (https://quaternius.com/packs/ultimateanimatedanimals.html); also Poly Pizza | **CC0 1.0** | **PICK** — 51-bone AnimalArmature, Walk/Gallop/Idle/Jump/Attack/Death… |
| `fox/khronos_fox.glb` | [Khronos glTF Sample Models — Fox](https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Fox) | **CC-BY 4.0** (must credit) | Fallback only — low poly, Survey/Walk/Run |
| `fox/blenderkit-free-refs/bk_*.glb` | BlenderKit free search (no login) | BlenderKit free tier | **REJECT** art lock — cute/chibi |

Same Quaternius file already mirrored at `assets/hero/source/fox_quaternius_raw.glb`.

## BlenderKit note
Free downloads work headless with `scene_uuid` and no API key. Realistic / paid animal rigs require `preferences.addons['blenderkit'].preferences.api_key` — **needs Vivek login; do not create accounts**.
