# Ashwater Reach — world II (Cedar, swarm5)

Rain marsh, an oval island far east of the vale (origin x = +700, z = +80; `ashwaterLayout.ts`). Cool teal water,
moss and peat, slate and dark timber, warm lanterns at every gate. One south → north run, three levels, each a
physical gate the fox opens with what it has (two actions only: jump/glide, dash):

| Level (store id) | Gate | What the player does | Result |
|---|---|---|---|
| Low Sluice (`teach`) | the channel spans the marsh in two reaches split by a slate sill; the west reach's north bank is a reed thicket | dash the bank sluice's reeds → the west reach drains; go down into its bed (the drowned roof is out west), east to the sill, dash its culvert's reeds → the east reach drains; climb its bank | Reed Island → earns **Reedskim** |
| Reed Pond (`develop`) | the pond spans the marsh | Reedskim raises 9 reed mats; jump (held into a glide) mat to mat | Mill Shore |
| Weir Heart (`combine`) | the Seedwell ledge is higher than the weir and 3+ m from it; the Mill Pool is a walled cistern | mats out to the islet, dash its dam → the cistern drains → climb its steps onto the weir. Insight: the way up is the opposite — dash the weir's reed gate so the race FLOODS the cistern (4.3 m, 45 s); the Ferrykeeper's punt rises to the weir lip; walk aboard, onto the east shelf, along the wall to the ledge | Reed Seedwell fills; the Ferrykeeper unpresses and flies |

Rules
- No answer captions (Vivek 3:25 PM): the marsh never says what to do; captions name places and feelings only.
- The flood washes out after its hold and the gate re-forms; a fox caught low just walks back up the drained steps.
- Gates are physical (water level, mat colliders), never proximity. Levels complete on arrival beyond each gate;
  Hazel's store refuses out-of-order completion. Develop completes on standing on the Mill Shore by any route.
- Wading: grounded on a bed still under water → back to the last dry spot (no drowning, no softlock).
- Missing the glide drops you on low ground east of the pool; walk round, climb the steps again.
- Per-frame code in `ashwater.hot.ts` (no allocation). Model: `tla/Ashwater.tla` — Gates, Monotone, Finishes
  (a goal-directed player finishes from every reachable state, flood timer modelled as a move budget `Hold`).
  Negative controls: no Reedskim earn → Gates fails; `Hold = 0` (flood gone at once) → Finishes fails.

Integration (Maple owns): `buildAshwater(ctx, { complete(level), hasReedskim() })`, `layout.groundH` → `H` for x > 400,
`worldBounds` → `E < 2.5` there, spawn = `ashwater.spawn`. Look (rain, teal fog, cool key) is the integrator's.
Probe: `node tools/ashwater-probe.mjs OUT [--frames]` (staged landing start, then stick/keys only).
