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
CPU-only stress test: a 97,792-triangle merged mesh costs ~14 ms/update with three direct raycasts on the stream worker. To avoid spending the frame budget on scenery queries, partition large single-material static meshes into 8 m local-space chunks for ray queries only. Reuse the source position attribute and build index lists; bound each chunk by its actual triangles (including triangles crossing cell edges). These proxies never enter the scene or upload GPU buffers. Source visibility still controls collision. Keep small or multi-material meshes on the direct query path; both use identical triangle hit semantics.

## Column framing refinement
A CPU reproduction using a 2.6 m lantern-column collider found the existing 3 m terrain lift still creates a ~44° downward view even after geometry compression. Cap terrain boom lift at 0.9 m: gentle grades retain clearance, while tall obstructions shorten the boom instead of climbing above the fox. Validate the near-column elevation and review on GPU before accepting the framing.

## Moving-column pop refinement
A sideways traversal past a column reproduced a 1.33 m one-frame vertical pop: floor correction was applied to the uncompressed spring before geometry collision, so a post could kick the spring above itself. Remove that premature floor impulse; retain the final rendered-lens floor guarantee after compression and the final feet/ears guard. Test the moving-column case for vertical continuity.


## Current defaults and checks

| Parameter | Value | Purpose |
| --- | --- | --- |
| Ground distance / height | 3.8 m / 1.25 m | Read the legs with a low, comfortable horizon |
| Shoulder angle | 0.34 rad (19.5°) | Separate legs and body in three-quarter view |
| Jump height share | 0.8 | Track ascent while retaining vertical lag |
| Landing attraction | 0.24, descending only | Preserve the fox on ascent; reveal the landing on descent |
| Position lag / lookahead | 0.14 s / 1.6 m | Retain the existing soft follow and forward space |
| Scenery compression / release | Damping 24 / 2.2 s⁻¹ | Pull in promptly and return gently |
| Terrain boom lift cap | 0.9 m | Avoid climbing above narrow columns |

Typecheck, fox Vite build and `npx tsx tools/checks/camera.ts` pass. Camera checks are CPU math only: they cover decorative posts, visibility, foliage exclusion, query chunk equivalence, jump/raised-floor framing, stable diagonals, frame-rate convergence and moving-column continuity. Captured gameplay, PNG inspection, window.__game review and the Opus critique remain required before visual acceptance. No GPU evidence had arrived when these notes were written.

## Captured bowl correction
Personal baseline route-end review shows the H0 bowl hiding torso and legs. A CPU reproduction using the actual `hearthBrazier` geometry at the captured fox position found that pure pull-in fixes the obstruction but crops the ear tips (NDC y2.40). Blend from compression to the existing material cutout when the available boom falls below1.8m (full fade fallback at1.1m). This preserves room for the whole fox instead of pushing the lens against it. The camera supplies a cached blocked signal to the existing fader through a small adapter; camera behavior remains in camera.ts. Trigger the cutout during compression transitions too, since a damped lens can temporarily remain behind a newly detected post. Retest the actual bowl, including feet/ears framing and fade activation.
