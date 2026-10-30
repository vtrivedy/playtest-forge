# World 1 — Russetvale (realm) + Lanternhollow (hub)

> **Locked design, sprint 2 (30 Oct 2026).** Opus proposal A × Sol proposal B, two debate rounds (`playtest-forge-artifacts/sprint2/design/`: `debate-r1-*`, `debate-r2-*`). Replaces the ember-collection loop.
> Units are **meters**. `(x, z)`: **+x = east**, **−z = north**. `y` = height above the realm base. Terrace coordinates use the terrace frame `sp(s, t)` in `russetvale.ts`.
> Movement numbers are the shipped `brisk` preset (`games/fox-spirit/DESIGN.md`): full jump 1.85 m / 7.2 m running, jump + air-dash 11 m, dash 4 m, glide 2.95 : 1. Every number below is a tunable. Captures check it against the real fox, not this page.

---

## 0. The rule

**Sepia is the world holding its breath. Color lets it breathe: where color touches, things burn, blow, flow and grow.** The fox's color is borrowed for seconds. A Seedwell makes it last.

No orbs, no counters, no currency. The player's reward is that the valley starts *working*: fires lift, sails turn, water runs, roots reach. Each change opens a route the player can feel under their paws.

```
 see a held-breath thing (cold hearth, still sails, glass waterfall, curled root)
   → touch it with color: run past (brief) or DASH through it (strong)
   → it acts for a few seconds: updraft, wind current, flowing water, growing root
   → use that to move: glide up, ride the wind, cross, climb
   → feed a Seedwell from an element (not from the fox) → it latches
   → that zone's elements act forever → a permanent route + a moving landmark
   → the Keeping answers: a Shade drifts in to snuff temporary color
```

---

## 1. Color chemistry

### 1.1 Sources of color

| Source | Strength | Lasts | Notes |
|---|---|---|---|
| **Restored** (latched Seedwell radius, Wellspring flood) | 1 | Forever (saved) | Never switched off by anything |
| **Dash stroke** | 1.5, fading to 0 over its last 1.5 s | **6 s** | Each dash stamps a stroke along its 4 m path (ground or air). Reactors struck by a dash flare visibly harder (ignite burst + sound) |
| **Aura + trail** | ≤ 1 | aura 2.6 m around the fox; trail ≈ 2.5 s | The fox's ambient color |
| **Shade drain** | — | while within 3 m of a Shade | Removes aura, trail, and dash strokes whose current strength is ≤ 1 |

### 1.2 Reactors (evaluation order, every simulation tick)

Every reactive object is a **Reactor**: one or more probe points, a `heat` 0..1, and a `restored` flag.

1. **Restored?** `restored` is set once, at the moment a Seedwell latches with the reactor inside its radius (saved). A restored reactor has heat 1. Stop.
2. **Supply.** `aura/trail = max over sources at the probes`; `dash = max dash-stroke strength at the probes`. If a probe is inside a Shade's drain: `aura/trail = 0` and `dash = 0` unless `dash > 1` (fresh strokes punch through). `supplied = max(aura/trail, dash) ≥ threshold` (default 0.3; hearths probe their bowl centre and a 0.9 m ring of 4 points at fox height, so brushing past within ≈ 1.5 m of the rim lights them).
3. **Heat.** Supplied → heat rises to 1 over `igniteTime`, and the hold timer refreshes. Not supplied → hold for `holdTime`, then **gutter** over `gutterTime` (visible warning; output ramps down), then cold. **Drain bypasses hold:** a reactor whose probe sits in a Shade's drain and is not supplied goes straight to gutter.
4. **Output** (lift, push, flow, growth) scales with heat.

The ColorField (`src/render/colorField.ts`) supplies the temporary sources, so what the player sees tinted is what reactors read. The reactor's *state* (hot, holding, guttering) is shown on its body, because a holding hearth keeps burning after the tint under it has faded.

Reactors do **not** power each other. No carriers, no conduction graphs, no feedback loops. Elements connect only through **Seedwell inlets** (§1.4) and through the fox's movement.

### 1.3 The four elements

| Element | Held breath (sepia) | Breathing (colored) | Lag defaults | Traversal |
|---|---|---|---|---|
| **Heat**: hearth (cold ash brazier, Ø1.4 m) | Grey ash, a smoke curl frozen in mid-air | **Ember updraft**: Ø4.4 m column, 9 m tall by default (per hearth). A gliding fox rises ≥ 7 m | ignite 0.25 s, hold 3 s, gutter 0.8 s | Vertical: glide up ledges |
| **Wind**: windmill / wind-bell | Pressed sails, still | Sails turn. A **wind current** (spline, 4 m wide, leaves streaming) adds `push` 5 m/s along the spline to a gliding fox and cuts its sink by `hold` 80 % (2.7 → 0.54 m/s) | spin-up 1 s, hold 3 s, spin-down 3 s | Horizontal: long, flat glides |
| **Water**: glass waterfall / flume | Water frozen mid-fall as amber glass, hanging in the air | Flows. A visible water front runs stone flumes at 8 m/s, fills basins, washes ink. When the source stops, the tail runs out at the same speed | melt 0.6 s, hold 3 s, refreeze 2 s (refreezing water does not flow) | Washes hazards, feeds Seedwells. Lifts later |
| **Growth**: root knot / lily pad | Root curled into the ground; lily pads sunk and pressed | A root grows segment by segment (1.5 s each) along an authored spline into a **bridge or ramp** while its knot has heat ≥ 0.5 (climb wall once loco ships a climb pose). Pads unfurl and float, solid | grow 1.5 s/segment, hold 3 s, wither warning 1.0 s, withers from the knot end | Cross, ascend |

### 1.4 Seedwells latch from elements

**Direct fox color cannot fill a seal. A named element output can, regardless of what lit that element.** Each Seedwell (and the Wellspring) has one inlet, a seal that fills, and a `latchTime`:

| Inlet | Fed while | latchTime |
|---|---|---|
| SW1 Kiln bowl | the H2 updraft has heat ≥ 0.5 and its column contains the bowl | 2 s |
| SW2 Reed basin | water is *arriving* in the basin (flume flowing end to end) | 7 s |
| SW3 Heartwood socket | the root's last segment is fully grown and touching the socket, with root heat ≥ 0.5 | 2 s |
| Wellspring basin | the summit hearth's updraft has heat ≥ 0.5 and its column contains the basin | 2 s |

The seal (a carved two-ring disc on the Seedwell) fills at `1/latchTime` per second while fed and drains at `1/latchTime` per second while not. Guttering output below heat 0.5 does not feed. Cosmetic embers, retained (occupied) collision and the fox's own color never feed.

On latch: permanent color radius with the painterly wavefront, every reactor inside becomes `restored`, checkpoint, full heal, and a 2 s camera beat that frames the permanent route (not an orbit). Latches are saved and survive reload.

### 1.5 Safety contract (non-negotiable)

1. Any temporary support (root, lily pad) shows a **≥ 0.8 s warning** before it goes. Once the fox stands on a temporary support, **the whole chain of temporary supports it is using is retained** until the fox lands on stable, non-temporary ground. Retained collision is not feed (it never fills a seal).
2. Colliders are enabled **before** the visual reaches them (collision-before-load) and disabled only after the visual has withered past them. Collider changes are queued and applied between simulation steps.
3. An updraft dying under a gliding fox returns it to normal glide sink, never to free-fall.
4. Every temporary-route miss lands on recovery ground **≤ 6 m below**, and the walk back to the element takes ≤ 10 s.
5. Restoration never removes access. Every secret is valid before **and** after its zone is restored, or is marked "after".
6. No soft locks: every element can be re-lit from reachable ground, and every element-made route also has a way back down.

---

## 2. Verbs (move + 2 actions, unchanged)

| Verb | Input | Systemic role |
|---|---|---|
| Run / jump | Stick, JUMP | Aura and trail wake elements as you pass |
| **Dash = the brush** | DASH (ground or air, 1 air-dash per airtime) | Lays the 6 s strong stroke. The dash is how the player *aims* color: through a hearth, into a waterfall, along a root knot, through a Shade |
| Glide | Hold JUMP while falling | Rides updrafts and wind currents. Glide stays active while rising in an updraft |
| Climb | Run into a grown root wall | **Deferred** until the loco stream ships a climb pose. Roots form ramps and bridges until then, with the same puzzle function |

Deleted: Ember Burst, Pounce Slam, the JUMP + DASH chord, Spark, Kindle as a post-W1 ability (hearths are W1's base element).

---

## 3. REALM — Russetvale (260 × 200 m, geography unchanged)

The sprint-1 island stays: the floating bowl, Arrival Meadow (S), Windmill Rise terraces (W), Reedmarsh (E), Amberwood (center-N) and Wellspring Hill (far N). The level bends to the systems by **adding reactors** and trimming dead travel. It is not re-blocked.

### 3.1 Map

```
  z=-100 ┌──────────────────────────────────────────┐  N ▲
         │           ◎ WELLSPRING (0,-85) y38        │  summit hearth feeds the basin
         │         ╭─switchbacks─╮                   │
  z=-60  │   ≋≋≋>  │ ARENA (0,-60) y12  <≋ water   │  three ways up the hill base:
         │  wind   ╰──────┬──────╯      lift (later)│   ≋ wind river (SW1) · ═ root bridge (SW3)
  z=-30  │ ⇡SW1 kiln       ═ root bridge             │
         │ (-112,-24) y20  ♣ AMBERWOOD ♣  ✿SW3 hollow │  ✿SW3 (-10,-36) y17.5
  z=  0  │ ╫╫ ⚙            ♣ ♣ ♣             ✿SW2   │  ✿SW2 (95,10) y2
         │ ╫╫ WINDMILL RISE      ≈≈ REEDMARSH ≈≈≈≈  │  ⫶ glass waterfall (100,18) y6→15
         │ ╫╫ H0 hearth step     ≈≈ lily pads  ≈≈⫶  │
  z= 40  │ ╫╫  ⚙ ⚙ ⚙             ≈≈ stilt huts     │
         │        ╲               ╱                  │
  z= 70  │ H-a meadow step  ARRIVAL MEADOW  pond    │
  z=100  │              ● PORTAL (0,92)              │
         └──────────────────────────────────────────┘
       x=-130                 x=0                x=130
```

### 3.2 Landmarks that pull

| Landmark | Where | Pull | Element |
|---|---|---|---|
| Lone maple over the Wellspring | (0, −85) y38 | Visible from every checkpoint, faint russet. The compass | Finale |
| Three windmills on the west skyline | (−70, 40), (−88, 22), (−100, 2) | Still sails. The moment one turns, the player wants to go there | Wind |
| **Glass waterfall** | spills from a broken aqueduct ruin at (100, 18) y15 into a flume on stilts | A frozen amber waterfall hanging in the sky, visible on frame 1 | Water |
| Hollow maple with a warm split | (−10, −36) | Heartbeat glow through a crack in the trunk | Growth |
| Kiln spire | (−112, −24) y20 → bowl y28 | A cold stone brazier-tower on the western cliff, ash curl frozen above it | Heat |
| Satellite islets with old fox shrines | S, E, NW off the rim | Reachable only on the wind river or an updraft chain | Secrets |

### 3.3 Critical path (≈ 10 min first time, ≈ 6 min repeat)

Recommended order: **Meadow → Windmill Rise (SW1) → Reedmarsh (SW2) or Amberwood (SW3) → Hill.** Restoring **any one** Seedwell opens a permanent route up the hill base (wind river, Reed Causeway or root bridge, §3.4–3.6). The other two make the valley more alive and the hill easier. There is no three-Seedwell gate.

| # | Zone | Beat | Element taught |
|---|---|---|---|
| 1 | Arrival Meadow | Leaves hang pressed in the air and fall where the wake touches them (time resumes). Zero stakes | The rule |
| 2 | Meadow step **H-a** (≈ (−14, 66)) | A 5 m rock shelf, no ramp, a cold hearth at its foot on the path. Running past lights it; jump, hold, rise ≥ 7 m, drift onto the shelf. The shelf is a shortcut toward the terraces | Heat (first playable) |
| 3 | Terrace foot **H0** (terrace frame `sp(4, 12)`, sunken 3 m below the path in a dry pond) | The path passes H0's rim and lights it, but its column is only useful from a launch rock reached by a stair that takes ≥ 7 s to climb (more than trail 2.5 s + hold 3 s). Arrive on the rock and the column has guttered. **Dash** past H0 on the rim: 6 s stroke + 3 s hold ≥ 7 s. Waiting ground is safe; the dry pond floor is a 3 m drop with a stair out | The brush |
| 4 | Windmill Rise | Terrace hops. On terrace 3 (y10), a **20 m flat gap** at y10. Measured max without wind ≈ 16 m (jump + air-dash + glide). Mill 1's sails turn as you pass; its current carries a glide across | Wind (outside a shrine) |
| 5 | **SW1 Kiln** | §3.4 | Heat → latch |
| 6 | Wind river | SW1 restored: the mills' current becomes a permanent wind river from the Kiln jut east over Amberwood's north edge to the arena's west rim (−20, −60) y12 | Permanent route 1 |
| 7 | Reedmarsh or Amberwood | §3.5 / §3.6. Each element appears once outside its shrine first: the **Marsh Mouth spill** (a small glass spill over a 6 m ink channel at the boardwalk (57, 36): while it flows, the ink washes clear and the channel is walkable) and the **Creek Root** (a knot on the Amberwood floor (6, −2) grows a 10 m root bridge over the creek gorge) | Water, growth (outside shrines) |
| 8 | Hill | Arena via any permanent route. Switchbacks to the summit (2 Shades) | |
| 9 | **Wellspring** | §3.7 summit repair → flood (restore cinematic in `restore.ts`) | Heat + growth → latch, at realm scale |

### 3.4 SW1 Kiln (Windmill Rise): "carry the fire up"

- **Space.** The existing SW1 platform (−112, −24) y20, Ø12.4 m, is the **kiln ledge**. A stone kiln spire rises from its north edge with a **jut at y26** (6 m above the ledge, inside the safe-drop limit) holding the **Seedwell bowl**. Hearth **H2** sits on the ledge directly under the bowl; its column (9 m, to y29) contains the bowl.
- **Arrival (unchanged, measured).** The existing glide from the terrace launch `sp(80.8, 4.6)` ≈ (−100, −10) y22 to the ledge: edge-to-edge ≈ 12.4 m with 2 m of drop. Jump (apex +1.85) then glide at 2.95 : 1 covers ≈ 15 m. Margin ≈ 2.5 m. The launch rock is the only arrival; there is no H1 (cut as redundant).
- **Puzzle.** A **Shade** drifts on a loop around the ledge, passing H2 every 5 s and snuffing it (drain bypasses hold). Running past H2 lights it, but the next pass guts it before the 2 s seal fills unless the timing is lucky. Two solutions from the rules:
  1. Dash through the Shade (frees it), then light H2 at leisure.
  2. Dash through H2: the fresh stroke (strength > 1) survives the Shade's pass for ≈ 5 s, enough for the 2 s seal.
- **Riding.** Glide into H2's column and ride it to the jut (y26) to watch the latch. The jut is the wind river's launch once restored.
- **Recovery.** Two **catch shelves** at y15 on the spire's south and east faces (4 m deep, ≤ 5 m below the ledge rim). Each holds a small hearth whose column (9 m) lifts a glider back over the ledge rim (≤ 10 s round trip). A glide off the west or north edge always reaches a catch shelf or the terrace shoulder (y14) to the east.
- **Restored (radius 40 m).** H0, H2, the catch-shelf hearths and every Windmill Rise hearth burn forever. The three mills turn. Their combined current becomes the wind river.

### 3.5 SW2 Reed (Reedmarsh): "give the water somewhere to go"

- **Space.** The SW2 island (95, 10) y2. North of it, an aqueduct ruin on two piers, top y15. Its broken end holds the **glass waterfall**: water frozen mid-fall from the lip (100, 18) y15 down to y10, stopped 4 m above the high end of a stone **flume** on stilts (y6). The flume runs 32 m, winding south into the Seedwell basin on the island (4 s at 8 m/s).
- **Access.** A stone stair climbs from the island (y2) to the near pier's platform (y6). Hearth **HP** on that platform lifts a glider to the aqueduct top (y15).
- **Crossing.** The ink-pool field is crossed on **lily pads** (growth; they replace ghost-ink stones at the same 4–6 m spacing). An occupied pad never sinks (§1.5).
- **Puzzle.** The falls only flows while colored, and its probes are on the frozen water (y10–15), out of aura reach from the flume (y6) and from the pier platform. SW2's seal needs **7 s** of water arriving.
  1. **Dash** through the falls (air-dash after gliding off the aqueduct, or along the top): 6 s stroke + 3 s hold ≈ 9 s of flow ≥ 7 s. Latch.
  2. **Stay**: walk the aqueduct top to the lip and stand there. The aura keeps the falls flowing as long as the fox stays. Latch.
  - A plain glide *through* the falls gives trail 2.5 s + hold 3 s ≈ 5.5 s of flow: the water visibly reaches the basin, the seal fills most of the way, and drains. That near miss is the lesson.
- **Shade.** One Shade patrols the flume. Water passing through its drain stops flowing downstream of it (the tail runs out). Free it or time around it.
- **Recovery.** Falls from the aqueduct (y15) land in the basin pool or on the island (y2), both reachable; the pier stair returns in ≤ 10 s. A fall into ink → last safe ground.
- **Restored (radius 35 m).** The falls flows forever. The marsh's ink washes into walkable leaf litter. The **Reed Causeway** (stone path, previously under ink) runs from the marsh's north shore (70, 0) north-west to the arena's east stair (18, −58): permanent route 2. The sunken ruin (S3) opens.

### 3.6 SW3 Maple (Amberwood): "the heartwood stair"

- **Local rebuild.** The hollow maple (−10, −36) is currently a **solid** collider (r 3.6, to y17.5, `russetvale.ts`). Replace it with a hollow shell: wall ring r 3.3–3.9, a 2.4 m doorway on the south side at the floor (y0), interior floor at y0. The Seedwell sits in the split crown above the **socket** on the inside wall at y17.5. The existing outside canopy route stays.
- **Root.** Knot **K1** on the interior floor grows a helical **root ramp** up the inside wall: width 1.6 m (r 1.7–3.3), slope ≤ 25°, about 2.4 turns, ≈ 40 m of path, in **4 segments** (floor → y4.5 → y9 → y13.5 → y17.5), each grown in 1.5 s. Growth runs while K1's heat ≥ 0.5 (heat, not raw color). The fox can run behind the growth front (6 s to grow, ≈ 5 s to run).
- **Puzzle.** A **Shade** patrols the hollow floor past K1 every 5 s. Standing at K1 keeps the root growing, but the Shade comes through. Two solutions:
  1. **Dash** K1: stroke 6 s + hold 3 s ≈ 9 s of heat. The root completes at 6 s and touches the socket while heat ≥ 0.5 for ≥ 2 s. Latch.
  2. Free the Shade (dash through it), then stand at K1 until the seal fills.
- **Alternate route up.** A small floor hearth with a **12 m column** lifts a glider to the ring ledge at y10. Knot **K2** on that ledge grows the last two segments (y10 → y17.5).
- **Recovery.** Falling off the ramp lands on the floor or a lower turn (each turn ≤ 4.5 m above the next). Withering keeps the occupied chain (§1.5).
- **Restored (radius 30 m).** Every root knot in Amberwood grows for good (the heartwood stair, the Creek Root, the crown ramp of S5). The **root bridge** (0, −31) → (0, −44) grows: permanent route 3.

### 3.7 Wellspring summit repair

The Wellspring basin (0, −85) y38 has one inlet: the **summit hearth** in an alcove under the basin. Its column is blocked by a fallen stone lintel. A root knot **KS** beside the alcove grows a root that lifts the lintel while KS has heat ≥ 0.5; when the root withers, the lintel settles back. Both elements are needed together: grow the root (dash KS: 9 s), then light the hearth (dash or run past) so its column rises through the basin for 2 s. Latch → **flood**. The flood restores everything, so the summit then breathes forever. (The Ash Warden, later, guards this alcove.)

### 3.8 Encounters

**Shade** (W1's only enemy this sprint). A tall wavering ink silhouette of an animal caught mid-motion when the Keeping struck. Sad, not evil.

| Property | Default |
|---|---|
| Patrol | Authored closed spline, 2.2 m/s, bob 0.3 m |
| Drain | 3 m radius (§1.1). Unsupplied, unrestored elements in it gutter at once (warning still shows) |
| Contact | −1 wisp, 1.0 s invulnerability, 3 m knockback |
| Free it | Dash through it. It falls apart into leaves that colorize as they fall. It does not respawn |
| Placement | SW1 ledge loop, SW2 flume, SW3 hollow floor, hill switchbacks (2). After each latch, one new Shade appears at the restored edge |

Later (not this sprint): spreading blight from blight hearts at restored edges, broken by an element. The **Ash Warden** guards the summit alcove and is beaten by using each restored element in the arena (updraft over its pounce ring, root-snare, flood its ink), then dashing it.

### 3.9 Secrets (knowledge, not glints)

| ID | Where | How | Valid | Reward |
|---|---|---|---|---|
| S1 | Behind the pond waterfall (−30, 62) | The pond falls is glass and blocks the grotto. Dash through it: it flows for ≈ 9 s and you pass behind. After the flood it flows forever and you walk through | before + after | Lost Kit #1 |
| S2 | North-west islet (−70, −98) y16 | The wind river has a narrow 2 m fork at its high point over (−60, −40) y24 ending at the islet. Steer into the fork; the current carries the glide 60 m with ≈ 2.5 m of drop. Return: an islet hearth (12 m column) lifts the fox to y28, then a plain glide (2.95 : 1, ≈ 80 m) to the Amberwood floor | after SW1 | Old fox shrine: gold wake tint |
| S3 | Marsh sunken ruin (110, 40) y−6 | Drop in once the ink washes clear. Exit by the ruin's inner stair to the marsh floor (y−2) | after SW2 | Pressed page #2 |
| S4 | Top of mill 3 (−100, 2) y34 | Three hearths stand within 3.5 m on mill 3's terrace lip, columns 6 / 9 / 12 m. One dash along the lip lights all three; chain the columns to the cap | before + after | Lost Kit #2 |
| S5 | Highest maple crown (22, −12) y30 | A root ramp spirals the crown trunk; it grows only once restored | after SW3 | Vista over the valley |
| S6 | Under the root bridge (4, −38) y2 | Glide under the bridge, air-dash into an alcove; exit by a root stair to the floor | after SW3 | Lost Kit #3 |
| S7 | Wellspring back cliff (−24, −96) y20 | Two summit hearths chain; reachable once the hill is restored | after flood | Sunset seat: the camera holds on the valley |

No floating pickups mark any of these. Draw the player with sound, silhouettes, moving leaves, and glimpses through arches.

### 3.10 Fail and safety

As game-design §8: −1 wisp per hit or hard landing, fall to the cloud sea → last safe ground, 0 wisps → last checkpoint. Restorations and latches are saved. Checkpoints: portal, terrace foot, SW1 ledge, marsh boardwalk, Amberwood floor, arena.

---

## 4. HUB — Lanternhollow (unchanged layout, new tutorial)

The hub layout, landmarks and coordinates from the previous draft stay (village around the dry Great Well, realm gate at (0, −46) y6). Not built in code yet. When it is built, its tutorial teaches the same rules:

1. Wake and run: hanging leaves fall in the wake (0:00–0:40).
2. Jump: cart and house steps (0:40–1:00).
3. Old Bramble wakes as the wake washes over her (1:00–1:30).
4. **The gate hearth:** the 6 m gate stair is broken. A cold hearth below it. Run past it and glide up; it gutters before a slow player arrives. **Dash** through it: the brush (1:30–2:30).
5. The gate's own hearth feeds the gate bowl for 2 s and the gate opens (latch, taught small) (2:30–3:00).

Hub secrets H1–H3 stay as places. The H3 maple seal becomes a Lost Kit.

---

## 5. First playable mechanic: the hearth updraft

The single best systemic toy. It uses a verb that already ships (glide), the ColorField that already ships, needs no new fox animation, and is the most joyful motion in the design: rising on embers.

### 5.1 Behavior

1. **Cold:** ash bowl, a frozen smoke curl, faint ember cracks. Probe at bowl center + 0.6 m.
2. **Ignite / hold / gutter:** the reactor rules (§1.2). A dash stroke ignites with a flare (ember burst, audio).
3. **Burning:** a column of rising embers + lifted leaves + heat shimmer, warm light on the surroundings. Column = vertical cylinder, radius `radius`, from the hearth top to `height` above it.
4. **Lift** (below). **Restored:** never gutters. **Seedwell feed:** §1.4.

### 5.2 Movement integration contract (`main.ts` surgical hook, movement code stays loco's)

- **Glide in a column.** Today glide requires `vel.y < 0` every frame (`main.ts` "glide: hold jump while falling"), so lift would cancel it. New rule: glide **starts** as today (airborne, JUMP held, falling, after `glideDelay`) **or immediately** on entering a burning column while airborne with JUMP held. Once gliding, glide **persists while JUMP is held even when rising**. It ends on JUMP release, landing, or dash (a dash suspends it; if JUMP is still held after the dash and the fox is in a column or falling, glide resumes). Updrafts never refresh the air-dash.
- **Lift factor** `k = heat × radialK × topK`: `radialK = 1` inside `0.6·radius`, smoothstep to 0 at `radius + 0.5`; `topK = 1` below `height − topFalloff`, smoothstep to 0 at `height` (`topFalloff ≤ height`).
- **Vertical (gliding).** Replaces the glide branch's vertical term while `k > 0`: `vTarget = mix(−glideSink, maxRise, k)`, `vel.y = damp(vel.y, vTarget, liftResponse, dt)`. Ease-in comes from the damp; no snap at the edge. When `k → 0` (top, gutter, exit) the target returns to normal glide sink.
- **Vertical (falling, not gliding).** Gravity × `(1 − fallLift·k)`.
- **Horizontal (gliding in a column).** Desired glide speed × `(1 − columnSteer·radialK)` so stick input steers inside the column instead of flinging the fox through it, plus a centering velocity `centerPull·radialK` toward the axis. At glide speed 8.4 m/s the fox brakes to ≈ 2.9 m/s within ≈ 0.15 s of entry, which keeps it in a Ø4.4 m column from either side.
- **Expected rise** (k = 1, entry vy = −2.7, liftResponse 4): vy = 6.5 − 9.2·e^(−4t); ≈ 8.1 m in 1.6 s, before top falloff. Verified in capture, not assumed.

### 5.3 Tunables (lil-gui `Chem › Updraft`, mirrored in `window.__game.chem.updraft`; per-hearth `height`)

| Tunable | Default | Range |
|---|---|---|
| `threshold` | 0.3 | 0.05–0.9 |
| `igniteTime` | 0.25 s | 0–1 |
| `holdTime` | 3.0 s | 0–8 |
| `gutterTime` | 0.8 s | 0.2–2 |
| `radius` | 2.2 m | 1–3.5 |
| `height` | 9 m | 4–20 |
| `topFalloff` | 2.0 m | 0.5–height |
| `maxRise` | 6.5 m/s | 2–12 |
| `liftResponse` | 4 /s | 1–12 |
| `columnSteer` | 0.65 | 0–0.9 |
| `centerPull` | 1.5 m/s | 0–4 |
| `fallLift` | 0.35 | 0–1 |
| `dashStrokeLife` | 6 s | 2–10 |

Debug (off by default, on with the existing debug toggle): column wireframe colored by heat, probe spheres, hold/gutter timer label, Seedwell feed line and seal fill.

### 5.4 Acceptance

**Machine-checked** (GPU capture + state logs from `window.__game.chem`):
1. Ride log `lastRide = { entryFeetY, entryVy, timeInColumn, tPlus7 (first time feet ≥ hearth top + 7 m), peakFeetY, landFeetY, landedOn }`. From standing 6 m from a cold hearth: run past, turn, jump, glide in → `tPlus7 ≤ 1.6 s` and `landedOn` = the 5 m H-a shelf. Repeat entering from the opposite side.
2. Hold: hearth heat stays 1 for **3.0 ± 0.1 s** after supply ends, then reaches 0 after the 0.8 s gutter (heat timeline logged).
3. A column guttering under a gliding fox: `vel.y ≥ −glideSink − 0.2` at all times (no free-fall).
4. A dash through a cold hearth keeps it supplied ≥ 6 s (6 s stroke) and lit ≥ 9 s.
5. Input release: releasing JUMP in a column ends glide that frame; re-pressing while falling re-enters glide after `glideDelay`.
6. Resets: 20 scripted runs (rides, mid-gutter entries, dash spam, Shade overlap once Shades exist, reload) end with the fox on ground, no stuck states.
7. `__game.embers` no longer exists; no ember motes in the realm.

**Reviewed** (matched before/after frames + gameplay video; judged by Opus + Sol critique, not claimed as player comprehension):
8. A lit column reads at 20 m in motion (rising embers, shimmer, lifted leaves); a cold hearth reads as "wants fire" at 15 m. Matched grayscale frames show the difference.
9. Feel: lift eases in, the camera rises with the fox, FOV breathes +3° on entry.

Comprehension by fresh players is a hypothesis until real playtests; nothing here claims it.

### 5.5 Build order (playable after each)

1. `chem/reactor.ts` + `chem/updraft.ts`: Reactor base, hearth actor, glide-lift hook, tunables, debug viz. Delete ember motes, `emberSpots`, the ember HUD and the summit ember gather. Place **H-a** in the meadow; a **second arrangement** (H0) proves the toy transfers.
2. Dash stroke (ColorField: per-stamp life and strength).
3. Seedwell inlet + seal + latch from element feed. Remove the shipped proximity Seedwell and Wellspring wins and the three-Seedwell bridge gate. SW1 Kiln (H2, jut y26, catch shelves). Save latches.
4. Shade (spline patrol, drain, dash frees it).
5. Wind current + mill sails (terrace 3 gap, wind river).
6. Growth: lily pads, Creek Root, heartwood stair (trunk rebuild), root bridge as a permanent route.
7. Water: Marsh Mouth spill, glass falls, flume front, SW2, Reed Causeway.
8. Wellspring summit repair feeding the flood. Later: blight, Warden, climb.

## 6. Trailer shot list (revised)

| # | Shot | Where | Camera |
|---|---|---|---|
| 1 | Leaves hang pressed in mid-air; the fox runs through and they start to fall in its wake | Meadow | Side-on dolly, 35 mm |
| 2 | Run past a cold hearth: it catches; the fox turns, leaps, and rises on the embers | H-a | Low 3/4, tilt up with the rise |
| 3 | Dash through a Shade: it comes apart into leaves that warm as they fall | SW1 ledge | Tracking, 80 ms hit-stop |
| 4 | The Kiln's column rises through the bowl; the seal fills; the Rise starts to turn | SW1 | Pull-back from the bowl to the three mills |
| 5 | Ride the wind river east over the amber canopy | Wind river | Chase cam, roll 5°, FOV 75 |
| 6 | Air-dash through the glass waterfall; it breaks into flowing water behind the fox | Aqueduct | Side-on, slow-mo 0.5× |
| 7 | A root spirals up inside the hollow maple under the fox's paws | SW3 | Top-down inside the trunk |
| 8 | Wellspring flood | Summit | Existing restore money shot |
