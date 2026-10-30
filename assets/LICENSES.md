# Asset licenses — playtest-forge / Color Fox

All third-party assets used here are CC0 / public domain unless noted.
Original procedural assets (spirit fox restyle, shrine, gems, ink enemy, NPC, audio we generate) are © project / Vivek Trivedy — shipped with the repo for the game.

## Concept art
| File | Source | License |
|------|--------|---------|
| `concept/fox-turnaround.jpg` | Internal concept (agent-generated draft) | Project |
| `concept/world-keyart.jpg` | Internal concept (agent-generated draft) | Project |

## Hero
| File | Source | License |
|------|--------|---------|
| `hero/source/fox_quaternius_raw.glb` | Quaternius Ultimate Animated Animals (Fox) via community mirror | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — https://quaternius.com/packs/ultimateanimatedanimals.html |
| `hero/source/fox_polypizza_raw.glb` | Quaternius Fox on Poly Pizza | CC0 1.0 |
| `hero/spirit_fox.glb` (when present) | Procedural / restyled for Color Fox | Project (may incorporate CC0 base mesh — see build notes) |

## Environment (World 1 kit)
| Path | Source | License |
|------|--------|---------|
| `env/kenney/*.glb` | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) (also on OpenGameArt) | CC0 1.0 — credit optional: "Kenney.nl" |
| `env/procedural/*` (when present) | bpy procedural (islands, shrine, ruins) | Project |

## Enemies / NPCs
| Path | Source | License |
|------|--------|---------|
| `enemies/*`, `npcs/*` | Procedural bpy | Project |

## Audio
| Path | Source | License |
|------|--------|---------|
| `audio/*` | Documented per-file in `audio/SOURCES.md` | CC0 or generated |

## Notes
- Kenney Nature Kit models use flat vertex colors (no textures) — ideal for our desaturate / restore-color shader.
- Quaternius fox is a CC0 starting point; final hero should match `concept/fox-turnaround.jpg`.
