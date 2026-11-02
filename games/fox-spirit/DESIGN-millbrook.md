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
3. **Orchard** rows on the flat west of the brook; dry-stone terrace walls climb to the **Lookout** hilltop (−100.5, 71), a lone great
   maple and a stone seat looking back east over the whole world (village, Hearthtree, Crown in the SE).

## The thing to do: unstick the mill (systemic chain on shipped verbs)

1. **Dash** through the leaf dam (teach line when you linger beside it) → it bursts; leaves fly and float off.
2. The water front runs down the dry bed (3.2 m/s); flecks ride the current; Ember's brook babble starts.
3. Water reaches the **wheel** → it spins up, the valley paints (one restore, r 26 at the mill), music cue.
4. The turning wheel works the **bellows** (lay shaft from the mill wall) → the cold **malting kiln** (the
   shipped updraft `Hearth`, spot id `kiln`, column 12 m) takes and stays lit. Teach line: ride its warm air.
5. **Jump + hold** in the column → rise → **glide** NW onto the **Weir Stones** (column shelf, top 6.6, cliff
   sides ≥ 1.8 m above every walkable neighbour so it is glide-only). First landing paints the north edge.
   The brook's spring pool sits on top and falls off the west lip into the brook head.

State machine (TLA+ `tla/Millrace.tla`): `dam held → burst`, front monotone D..N, `turning ⇔ painted`,
`kiln lit ⇒ turning`, `reached ⇒ kiln lit`; liveness: burst ~> front = N ∧ turning ∧ kiln lit. Bad variants
(turn without water; kindle without the wheel) fail `Inv`. Code: `millrace.hot.ts`, `millWeir.hot.ts`.
Not built: the hoist basket (cut — an elevator with nothing up top; the kiln → Weir glide replaced it).

## Budget

Spawn view today ≈ 1570 draw calls / 1.28 M tris (SwiftShader). New region must be built from merged
geometry (one mesh per material per prop class) so a west view stays ≤ spawn's calls. `tools/world-stills.mjs`
prints calls/tris per still.

## Verify

`node tools/world-stills.mjs` stills along the route (chase cam), aerial; walk route probe from the village
to the lookout with real input; dam burst → hoist ride; capture clip on a named SHA.
