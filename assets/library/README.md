# Asset library (sprint 2)

Pull-first library for World 1 (Russetvale) and the hero fox. **Orchestrate, don't model from scratch** (@sorenxet / Vivek pt36u).

## Layout
- `fox/` — candidate rigged fox bases (pick: `quaternius_fox.glb`)
- `hdris/` — Poly Haven 2k autumn/dusk skies (CC0)
- `textures/` — Poly Haven + ambientCG PBR (Color+Normal, ~1k)
- `models/nature/` — Poly Haven nature models packed to optimized GLB
- `models/kenney/` — pointer to existing `assets/env/kenney/` (CC0)

## Fox pick
See `../../sprint2/assets-handoff.md`. **Recommended base: Quaternius Ultimate Animated Animals — Fox (CC0).**

## BlenderKit
Addon installed at `~/.config/blender/4.2/scripts/addons/blenderkit`. Free assets download via `scene_uuid` without login. Paid / higher-quality animal models need an API key — **do not create accounts; ask Vivek**. Free BlenderKit foxes tested (`fox/blenderkit-free-refs/`) are cute/chibi — art-lock reject.

## Fetch heavier assets
Oversized Poly Haven trees (fir_tree_01, tree_small_02, coastal cliffs) were dropped from the repo. Re-fetch with:

```bash
# Poly Haven model (example)
curl -sL "https://api.polyhaven.com/files/boulder_01" | jq .
# ambientCG 1K zip
curl -sL -o /tmp/x.zip "https://ambientcg.com/get?file=Rock023_1K-JPG.zip"
```

## Credits
See `CREDITS.md` (this folder) and `../LICENSES.md`.
