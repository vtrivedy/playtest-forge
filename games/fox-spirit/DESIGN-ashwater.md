# Ashwater Reach — world II (Cedar, swarm5)

Rain marsh, an oval island far east of the vale (origin x = +700, z = +80; `ashwaterLayout.ts`). Cool teal water,
moss and peat, slate and dark timber, warm lanterns at every gate. One south → north run, three levels, each a
physical gate the fox opens with what it has (two actions only: jump/glide, dash):

| Level (store id) | Gate | What the player does | Result |
|---|---|---|---|
| Low Sluice (`teach`) | the channel spans the marsh; deep water puts you back on the bank | dash through the reed dam choking the sluice | channel drains over 3 s; walk its bed to Reed Island → earns **Reedskim** |
| Reed Pond (`develop`) | the pond spans the marsh | Reedskim raises 9 reed mats; jump (held into a glide) mat to mat | Mill Shore |
| Weir Heart (`combine`) | the weir is a 3.6 m peat wall; its steps stand in the Mill Pool | mats out to the islet, dash its dam → pool drains → climb the steps → glide off the weir's east lip to the Seedwell ledge | Reed Seedwell fills (teal column) |

Rules
- Gates are physical (water level, mat colliders), never proximity. Levels complete on arrival beyond each gate;
  Hazel's store refuses out-of-order completion. Develop completes on standing on the Mill Shore by any route.
- Wading: grounded on a bed still under water → back to the last dry spot (no drowning, no softlock).
- Missing the glide drops you on low ground east of the pool; walk round, climb the steps again.
- Per-frame code in `ashwater.hot.ts` (no allocation). Model: `tla/Ashwater.tla` — Gates, Monotone, Finishes
  (a goal-directed player finishes from every reachable state). Negative control: no Reedskim earn → Gates fails.

Integration (Maple owns): `buildAshwater(ctx, { complete(level), hasReedskim() })`, `layout.groundH` → `H` for x > 400,
`worldBounds` → `E < 2.5` there, spawn = `ashwater.spawn`. Look (rain, teal fog, cool key) is the integrator's.
Probe: `node tools/ashwater-probe.mjs OUT [--frames]` (staged landing start, then stick/keys only).
