# Source credit — Game Dev Cheat Sheet

Prompt vocabulary adapted from [Game Dev Cheat Sheet](https://gamedev-cheatsheet.com/) by [Nicolas Zullo](https://x.com/NicolasZu) (free web reference; **no content license stated** on [privacy](https://gamedev-cheatsheet.com/privacy/) / [about](https://gamedev-cheatsheet.com/about/) as of 2026-10-31 — cite URLs, do not republish wholesale).

Announcement: [X 2026-10-31](https://x.com/NicolasZu/status/2116601766410326177) (thesis: vocabulary + concepts are the biggest leverage when prompting AI for game dev). Local text mirror: `/workspace/siyu/playtest-forge-artifacts/refs/gamedev-cheatsheet/`. Brain page: `vtrivedy/research-brain` `knowledge/gamedev-cheatsheet.md`. Opus 5.5 triage: mirror `opus-triage.md`.

## What we took (named vocabulary + prompt bits for fox briefs)

| Concept | Site | Where we use it | Why |
|---------|------|-----------------|-----|
| Raycasting | [/concepts/raycasting/](https://gamedev-cheatsheet.com/concepts/raycasting/) | sprint5 loco: per-paw ground probe | Hovering paws need a hit point + normal, not clip height |
| Normals | [/concepts/normals/](https://gamedev-cheatsheet.com/concepts/normals/) | loco paw align; paint climb mask | Plant on slopes; paint climbs props by normal+height |
| Squash and stretch | [/concepts/squash-and-stretch/](https://gamedev-cheatsheet.com/concepts/squash-and-stretch/) | spine gather/extension | Camera-only squash left the body stiff; pivot at contact paws |
| Easing | [/concepts/easing/](https://gamedev-cheatsheet.com/concepts/easing/) | anticipation crouch, land recovery, bounded tail | Tail flip = unbounded overshoot; use easeOutCubic / damped springs |
| Fragment shader | [/concepts/fragment-shader/](https://gamedev-cheatsheet.com/concepts/fragment-shader/) | paint watercolor uniforms | Flat green carpet is a composite-shader problem |
| Seeded noise | [/concepts/seeded-noise/](https://gamedev-cheatsheet.com/concepts/seeded-noise/) | world-XZ fBm pigment | Deterministic granulation that does not swim with the camera |
| Z-fighting | [/concepts/z-fighting/](https://gamedev-cheatsheet.com/concepts/z-fighting/) | speck diagnosis + contact-shadow offset | Rule out depth fight before blaming the pigment shader |

**Outside the 34 (required feel words):** anticipation → action → follow-through (Disney animation principles). Pair with easing.

Folded into `docs/process/game-feel-checklist.md` § Prompt vocabulary. Sprint briefs: `playtest-forge-artifacts/sprint5/briefs/loco.md`, `paint.md`.

## Vocab-only (already in fox DESIGN.md — keep the name in prompts)

coyote time · input buffering · acceleration and friction · screen shake (trauma²·noise) · quaternions/slerp · finite state machine · delta time (`1-exp(-k·dt)`) · fixed timestep · particle system

## What we deliberately did **not** take

hit-stop / i-frames / hitbox-hurtbox (no combat) · camera deadzone (park; grows sprint) · LOD / frustum / draw-calls / atlas (no open failure) · A* / steering / chunk streaming (wrong domain) · billboarding (fights surface paint) · object pooling / tunneling / spatial partitioning / time slicing (no open failure) · frame-budget / overdraw as feel concepts (one paint-pass ms guard line only)
