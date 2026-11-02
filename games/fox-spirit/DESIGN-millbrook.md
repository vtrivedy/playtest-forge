# Millbrook — the west expansion (Bramble, swarm4)

Vivek (Nov 2): "a much expanded, beautifully crafted game". TASK: expand well beyond the small oval, fill
the beige runs, new places worth arriving at. Wren owns the SE vista finale; this is the west.

## Shape: the bowl becomes a union of areas

`BOUNDS` (one ellipse) is replaced by `AREAS`: ellipses and capsule corridors. `rimK(x,z)` = min over areas
of the normalised distance, so the cliffed rim, rim trees, grass and paint all wrap whatever shape the
world takes. One rule, no per-region special cases. `vistaCut` stays applied last (Wren).

```
            N (+z)
   lookout ◆        mill ▣═wheel
   (-101,73)   ~brook~   │      sunken lane      village   meadow
   orchard  ≈≈ ford ≈≈ bridge ══════════════════ (-38,88) ── well
   terraces     │  hay field                     cottage (-37,86)
                ~           W ← → E
```

## Places (in walking order from the village, fox runs 3.2 m/s: keep runs ≤ 6 s between beats)

1. **The sunken lane** (x −38 → −56). Banks rise either side (the rim), dry-stone walls along the
   crest, maples leaning over, leaf drifts. Threshold: you leave the village, the view closes, then
   opens onto the valley.
2. **Millbrook** valley floor (centre ≈ (−78, 84)). A brook runs N→S across it in a carved channel.
   - **Mill** on the east bank north of the lane: stone footing, timber walls, thatch-ish roof, a
     waterwheel standing in a **dry** race. Arrested moment: a leaf dam chokes the race's mouth.
   - **Footbridge** where the lane crosses the brook.
   - **Stepping stones** further south (a jump line; fall = shallow water, wade out).
   - **Hay field** south-east bank: stooks, a hay wain, split-rail fence. Fills the beige run.
3. **Orchard terraces** on the west bank, climbing to the **Lookout** hilltop (−101, 73), a lone great
   maple and a stone seat looking back east over the whole world (village, Hearthtree, Crown in the SE).

## The thing to do: unstick the mill (systemic, uses dash)

Dash through the leaf dam → it bursts (leaf-pile toy physics) → water runs down the race → the wheel
turns, spray + sound → the valley paints (one restore) → the wheel's gearing drives a **hoist** basket on
the mill's gable that lifts the fox to the orchard's upper terrace path (a traversal verb the restore
unlocks; the long way up the switchback stays open). No counters, no orbs.

State machine (TLA+ `tla/Millrace.tla`): `dammed → flowing → turning`, hoist `down ↔ up` only while
`turning`; burst is idempotent; nothing un-turns.

## Budget

Spawn view today ≈ 1570 draw calls / 1.28 M tris (SwiftShader). New region must be built from merged
geometry (one mesh per material per prop class) so a west view stays ≤ spawn's calls. `tools/world-stills.mjs`
prints calls/tris per still.

## Verify

`node tools/world-stills.mjs` stills along the route (chase cam), aerial; walk route probe from the village
to the lookout with real input; dam burst → hoist ride; capture clip on a named SHA.
