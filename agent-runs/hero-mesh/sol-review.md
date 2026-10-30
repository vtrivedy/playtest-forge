# Sol hero mesh review

## Scope and source

Separate, unrigged image-to-3D candidates only. No edits to `assets/hero/spirit_fox.glb` or `games/`. The source is the locked autumn fox in `assets/concept/fox-turnaround.jpg`, following `ART_LOCK.md`: natural quadruped, rust fur, cream bib, dark slender legs, narrow amber eyes and ember wisps. Crop rectangle: `(678, 28, 1005, 394)` in the 1280×720 original; top-row standing three-quarter view. The unchanged crop and actual background-removed conditioning image are delivered with the candidate.

## TRELLIS — reject for adoption

`assets/hero/candidates/sol/fox_trellis_seed42.glb`: 25,522 triangles, 20,031 exported vertices including UV splits, 4,668,300 bytes, one embedded 2048×2048 base-color atlas. Decimated from 195,820 triangles before visibility cleanup. No skeleton or animations. Rough PBR material; no generated normal map. Blender import and four-view render succeeded. See `hero_sol_trellis_{front,side,3q,back}.png` in `assets/previews/review/` for source-adjacent comparisons. Front is +X in Blender coordinates; generated origin/scale are unchanged and are not game ready.

The torso, tapered muzzle, cream chest and dark legs are more continuous and fox-like than the separated ellipsoids in `assets/previews/review/fox_anim_run.png`. However, the result is **not a high-quality hero**. Ear wisps became large solid horns; the tail is a torn opaque sheet with black cavities; neck fur is lumpy plates; eyes have essentially disappeared; front and back views expose a very narrow form and overlapping feet. The concept has fine fur, a calm amber gaze and translucent dissipating wisps. TRELLIS captures the palette and rough outline but misses those defining qualities. The baseline blockout has less organic detail but more predictable clean shapes and an existing animation setup. Do not replace it with this raw candidate.

Initial inspection caught incorrect camera labels (the generated fox faces +X, not −Y). Corrected the views and rerendered once. The final sheets confirm the defects above; changing lighting did not repair geometry. Keep this candidate as failure evidence or a source for limited sculpt reference, not as a rigging recommendation.

## Hunyuan3D-2 fallback

Generated and textured successfully on A100 using 40 shape steps at octree resolution 384, then the official turbo paint pipeline. Triggered because TRELLIS failed the visual-quality bar. Hunyuan generated 537,224 triangles, reduced to 28,000 before painting. `fox_hunyuan_seed42.glb`: 4,578,820 bytes, 21,833 exported vertices, one embedded 2048×2048 base-color atlas. Full GPU function took 211.0 seconds, including model loading/downloads but excluding container startup. Both model revisions and hashes are recorded in `generation_hunyuan_seed42.json`.

Hunyuan is substantially better than TRELLIS: readable dark eyes, cream muzzle and bib, rust fur texture, dark legs, continuous torso, and four visible feet in three-quarter view. Compared with the supplied blockout run render, the fox has a much stronger organic silhouette and believable surface. However, the raw tail is an enormous solid balloon/lobe, and the ear wisps become antlers. It also has a softer, rounder face and stockier body than the slender, mysterious concept. The generated neck fur forms hard clumps, especially from behind. Raw export is not recommended for adoption.

### Best candidate: cleaned Hunyuan, conditional handoff

`fox_hunyuan_clean_seed42.glb`: **27,056 triangles, 20,998 exported vertices, 4,640,532 bytes, one 2048×2048 color atlas**. Created locally with `tools/modal/cleanup_candidate.py`, preserving the generated UVs and texture. Trimmed high ear-wisp geometry, capped the cuts, tapered the ears to points, and reduced the large tail using continuous cross-section deformation. No rigging. Front is −Y in Blender coordinates (−Z in the exported Y-up GLB); Blender Z bounds are approximately −0.691 to +0.535, so the mesh still needs an intentional game-scale/origin adjustment when adopted.

Reviewed all four directions after cleanup. The first cleanup had flat ear cuts and a flattened tail; corrected the ear tips and tail cross-section, then rerendered. Final sheets are `hero_sol_hunyuan_clean_{front,side,3q,back}.png`. They pair the exact source crop with the Blender render. This is the strongest **body/face starting point** in this stream and a visible improvement over the supplied primitive blockout. It is still **not a finished hero**: the tail remains sculptural and fin-like around its root, not dissolving smoke; the rear neck has rough clay-like fur; eye color is too dark and the expression softer than the lock. The cleanup also stretches the tail texture. Recommend Opus evaluate this candidate for a sculpt/retopology pass, replace or rebuild the tail/wisps, clean rear neck fur and sharpen amber eyes before rigging/adoption. Retopology/deformation behavior has not been verified. Do not interpret the file as approved for automatic adoption.

## Reproduction and operational notes

- Script: `tools/modal/image_to_3d.py`; temporary `modal run`, no deployment. TRELLIS seed 42 on A100. Exact source/GLB SHA-256 and upstream revision are in `generation_seed42.json`.
- Upstream references: [TRELLIS](https://github.com/microsoft/TRELLIS), [Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2). Generation used their published open model pipelines.
- First build needed GCC, libusb and the matching Kaolin wheel. Fixed a pipeline `.cuda()` return-value mistake. One successful TRELLIS export stalled while transferring the large return value; reran with durable volume output and 512 KiB CPU-only chunk transfer. Successful export compute times were 161.4 and 115.6 seconds, excluding earlier failed startup/import attempts and container startup. No claim of exact billed cost.
- Fetch saved files without GPU work: `modal run tools/modal/image_to_3d.py --fetch-only`; fallback uses `--model hunyuan`. Native build layers and model weights persist in `hero-sol-model-cache`; GPUs scale down after work and apps stop when entrypoints complete. Confirmed all Sol apps stopped and zero active Sol GPU tasks at handoff.
- Render: `blender -b --python tools/modal/render_candidate.py -- assets/hero/candidates/sol/fox_trellis_seed42.glb`, then `python3 tools/modal/compose_review.py trellis`.

## Baseline play verification

Ran `npm run playtest -- --game fox-spirit --port 5187 --seconds 8 --script feel-probe --out agent-runs/hero-mesh/sol-playtest`. Captured a screenshot and `window.__game`; status `playing`, backend `webgl2`, no deaths, recorded jump apex 0.701, time to apex 0.187 s and airtime 0.387 s. This short software-rendered smoke test recorded only one jump and zero dashes; it is not a valid tuning comparison or a test of either new unrigged candidate. No movement parameters were changed. The game screenshot shows an overbright tail and heavy sepia grain in the concurrently developed baseline; these are outside this mesh stream. Retained metrics, samples and final screenshot; excluded the 22 MB video from Git.

## Delivered artifact validation

All three GLBs imported in Blender 4.2.5 and rendered in four directions with soft area lights, a ground plane and AgX. Verified GLB v2 headers, embedded texture dimensions, triangle counts below 30k, no skins/animations, and file sizes below 10 MB. Raw and cleaned comparisons remain available so the changes are reviewable. All final review sheets were regenerated with corrected anatomical camera directions. No candidate was wired into gameplay.
