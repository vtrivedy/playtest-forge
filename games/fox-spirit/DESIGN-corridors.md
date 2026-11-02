# Painted corridors (swarm5 fix 2) — Maple

Kit's review of `b4fa63a`: outside a few painted puddles the world is grey/sepia linework — the well plaza
(`naive-mid`), the bridge approach (`end-160`), the Hermitage desk (`herm-desk`). The contrast is meant to
read as "bring colour", but after minutes it reads as unfinished.

## Fantasy
The Scribe sketched Russet Vale in ink, but the **roads were laid in colour first**: every lane, plaza and
footpath carries a pale watercolour underpainting from the first frame — a ribbon of pigment through the
sepia that says *go this way*. When the fox restores a place, the colour does not stop at the restore's
circle: it **runs down the roads** from it, so the corridors between beats end up fully painted and the
world visibly fills in along the routes the player actually travels.

## Mechanism (one path, in the existing paper/cel patch)
- `opening/lanePaint.ts` bakes one small half-float texture over the lanes' bounds (0.5 m/texel):
  R = distance to the nearest lane (`pathDist`: village + Millbrook + Hermitage lanes + well plaza),
  G = terrain height there. Built once at scene init from layout (deterministic; no rand consumed).
- `patchPaint` reads it once per fragment: a ragged band (`uLaneWidth`, fbm-bitten edge) restricted to
  surfaces within ~2 m of the lane's ground (verges, steps, kerbs and fence feet colour; roofs don't).
- **Underpainting**: band × `uLaneUnder` mixes the sepia toward the authored cel (no wet front, granulated,
  a faint broken tide at the edge). Pale enough that restored places still read as the payoff.
- **Run along the roads**: inside the restore loop the distance to each restore shrinks by
  `band × uLaneReach × bleed(i)` — restores reach ~3× their bleed further along lanes, growing over the
  same ~40 s bleed clock. No new restore slots; one texture tap per fragment.

## Measure
`tools/corridor-colour.mjs`: the fox stands on 11 corridors (plaza, well-west, meadow lane, east lane,
Keeping approach, south lane, Press lane, Millbrook lane + yard, north lane, Hermitage plateau), real chase
lens, share of pixels that read as colour vs sepia (metric calibrated on the review frames: naive-mid 0.025,
herm-desk 0.139, end-160 0.383, t060 0.728). States: `cold` (fresh start) and `story` (beats forced by dev
hooks, 45 s settle). Bar: every corridor clearly off the sepia floor in `cold`, story mean ≥ 0.35, and
frames that read painted by eye.

## Non-scope
Controller, colliders, the opening hook (Hazel), ending (Cedar), recorder (Reed), collision (Thistle).
Lanes stay where they are — painting a line never implies a new walkable route (KNOWLEDGE: painted lane ≠
walkable lane).

## Result (integrated keeping-d3 2f5af69, tools/corridor-colour.mjs, 11 views, 960×540 SwiftShader)
| state | b4fa63a colour / tint | 2f5af69 colour / tint |
|---|---|---|
| cold (fresh start) | 0.039 / 0.020 | 0.088 / 0.122 |
| story (beats forced) | 0.435 / ~0.15 | 0.465 / 0.150 |
Press lane in story 0.083 → 0.39 (restores run down the lane). The strict `colour` metric undercounts the olive
verges (Reed's review moved them off lime on purpose); `tint` is the honest cold-state number (6×). GPU (T4) quick
stills on 53ca803c and 431018bd show the painted lane network from every lane lens and the aerial.
Also shipped under this design: Hermitage kept-colour leaves/desk, rounded stones, hearth bowl stones, and the
world mask that keeps the fox inside the slice (worldBounds.ts).
