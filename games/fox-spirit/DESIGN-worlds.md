# Russet Vale — three worlds (swarm5 repoint, canonical)

Vivek, Nov 2: "multiple worlds, interesting levels and puzzles, different shifts in scenery and clear markers of
progress." Target 30–45 min; deadline floor: hub → 3 worlds reachable in the real build, each looking different in
frames, ≥1 real puzzle + visible progress per world, baseline five fixes not regressed.
Contributions folded in: Hazel `docs/design/swarm5-world-progress.md` (progress contract, 3×4 puzzle table),
Reed `docs/design/worlds/reed-design-pass.md` (teach / develop / combine, real geometry changes, acceptance).

## Architecture (Maple, scene integrator)
One scene, one fox / controller / camera / paint / save — no second runtime (legacy `main.ts` Realm and
`ashwaterReach.ts` are mined for ideas only). The other worlds are **islands far along x**:

| id | world | season / look | origin | file |
|---|---|---|---|---|
| `russetvale` | Russetvale | autumn, sepia → painted (today's slice) | the Great Well (−8, 85) | existing |
| `ashwater` | Ashwater Reach | rain marsh: slate sky, dense grey fog, rain, pools, reeds | (700, 85) | `ashwaterLayout` in `worlds.ts` + builder |
| `press` | the Scribe's Press | winter ink: pale sky, snowfall, snowfield, ink spires, page slabs | (−700, 85) | `pressLayout` in `worlds.ts` + builder |

- `opening/worlds.ts`: registry (`WORLDS`, `WorldId`, spawn, look) + pure terrain `ashwaterH/E`, `pressH/E`.
  `layout.groundH` dispatches on `|x| > WORLD_SPLIT (350)`; `worldBounds.inside()` includes each island
  (`E < 1`) so the controller's world mask and the `lint:feel` anchor check cover new worlds automatically.
- `opening/worldsScene.ts`: island ground + set dressing, **hub arches** north of the Great Well (Ashwater at
  (−2, 91), Press at (−10.5, 92.6)), a **return arch** behind each island spawn, per-world sky / fog / key light /
  rain|snow eased by the fox's x. Walking through an open arch (crossing its plane between the posts) teleports to
  the destination spawn and captions the world name. `state().opening.worlds = { active, travels }`.
- Islands are painted in their own colours from the first frame (patchPaint: `paint = 1` for `|x| > 350`).
- Arches open once the runaway page is home (homecoming pinned) — the existing chase stays the first hook (baseline
  discovery bar). Dev hook `__gameHooks.travel(id)` exists for captures only; players walk.

## Worlds, levels, abilities (3 levels each: teach → develop → combine)
Russetvale (autumn) — exists: (1) Runaway Page chase + canopy + ruin overlook, (2) Millbrook leaf dam / kiln,
(3) Hearthtree Keeping → bridge → Press Hollow. Ability already earned: ember dash ignites + updraft glide.

Ashwater Reach (rain) — **Reedskim** (dash across a reed bed without sinking; before it, reed beds are soft):
(1) Ferryman's Sluice — dash the sluice wheel: water LOW exposes a passage, HIGH floats the ferry raft;
(2) Drowned Orchard — choose which channel gets the water; drain one to reach the second handle;
(3) Bell Cistern — combine sluice + raft + reed footing to ring the bell → the **Reed** Seedwell fills.

The Scribe's Press (winter ink) — **Inkbreak** (air-dash cracks a frozen ink membrane into a glide draft):
(1) White Margin — thaw the first seal with carried warmth (existing Carry) — page ribs become a path;
(2) Folded Archive — dash a fold hinge to swap ramp ↔ bridge, keeping a way back;
(3) Wellspring Press — warmth + fold + Inkbreak glide to the Press; Ash Warden lets go → **Maple** Seedwell.

## Progress (Hazel)
Typed ids `russetvale|ashwater|press` × `teach|develop|combine`; monotonic `visit / restore / earn` store, versioned
save, canvas Album page-map (Tab) and the three hub Seedwells (Kiln = Russetvale, Reed = Ashwater, Maple = Press).
Completion only from physical puzzle truth, never from coordinates. The scene calls `setWorld` on travel.

## Who builds what
- **Maple** — scene integration: worlds registry, terrain dispatch, mask, arches, travel, per-world look/weather,
  island ground/dressing; then hub arch gating via Hazel's store; then Press level 1 if free.
- **Cedar** — Ashwater levels (sluice/ferry first), inside `opening/ashwater*.ts`, using `WORLDS.ashwater.origin`.
- **Thistle** — Press levels (thaw seal first), inside `opening/press*.ts`, using `WORLDS.press.origin`.
- **Hazel** — progress store / save / Album map / Seedwells; hub arch open-state from the store.
- **Reed** — independent real-input acceptance: hub → each world → back, re-entry, save, GPU frames, baselines.
Builders: register colliders/occluders through `ctx`; add new walkable shapes to the island `E` or `worldBounds`
(the lint fails otherwise); never draw `ctx.rand` (own `rng(seed)`); per-frame code in `*.hot.ts`.

## Acceptance
Real build `/`: chase → page home → walk through each hub arch → island (frames differ: rain marsh vs winter ink vs
autumn) → solve ≥1 puzzle → progress visible (Album / Seedwell) → return arch home. Baselines: cue discovery,
corridor colour (`tools/corridor-colour.mjs`), ending, `check:stuck`, 0 black frames. Honest duration measured.
