# Remote camera — scoped design

Branch: s2-remote-camera. Baseline: 2d86c9919d25a58089ce091b24a7b5ce9971f985.

## Intended feel
A gentle shoulder-follow lens for the burnt-orange fox spirit: low enough to read planted feet, a restrained three-quarter angle, a soft velocity lead, and stable vertical framing through jumps. Preserve camera-relative steering and existing restore cinematics.

## Changes
Keep traversal camera behavior in `games/fox-spirit/src/camera.ts`, with a small scene-root wiring change only. Add geometry-aware boom collision for decorative posts, pillars and columns missed by the walkable-height query. Use a padded sightline and smoothly damped pull-in / slower release; retain the existing terrain floor and material cutout fallback. Test the rendered spring position too, since a safe destination does not imply a safe interpolated camera.

Lower the ground lens modestly and increase the existing shoulder angle. Follow more of the jump's height with a faster vertical focus response, reduce landing-target attraction during ascent, and apply the framing guard after final traversal collision adjustment. Keep gentle auto-recentre and its existing steering feedback protection.

Expose collision/framing diagnostics through the existing camera debug report and retain lil-gui tunables. No level-content, locomotion, asset or control changes; no compatibility flags or alternate rigs.

## Validation and review
Run repository `tsc --noEmit` and fox Vite build. Request immutable pushed before/after refs through `/streams/remote-camera/capture-request.json` with stills and route captures. Personally inspect PNGs and window.__game reports. Compare fox NDC during jump, boom contraction, readable gait and occlusion at pillars. Critique, fix the worst issue and request one retest. Ask `claude -p --model claude-opus-5-5` for one after-capture critique. No visual-quality or completion claim without this evidence. No local rendering.

The named briefs `_style-update-1105.md` and `_studio-roles-note.md` were not available in this checkout at design time; follow the supplied autumn realism direction and stream brief.

## Query cost refinement
CPU-only stress test: a97,792-triangle merged mesh costs ~14ms/update with three direct raycasts on the stream worker. To avoid spending the frame budget on scenery queries, partition large single-material static meshes into8m local-space chunks for ray queries only. Reuse the source position attribute and build index lists; bound each chunk by its actual triangles (including triangles crossing cell edges). These proxies never enter the scene or upload GPU buffers. Source visibility still controls collision. Keep small or multi-material meshes on the direct query path; both use identical triangle hit semantics.
