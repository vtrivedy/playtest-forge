# Russetvale — Windmill Rise

> Layout specification, sprint 2. Implements `world-1.md` §3.3–3.4; measurements remain hypotheses until GPU playthrough. Template adapted from Claude Code Game Studios (MIT © Donchitos).

## Quick reference and decisions

- **Type:** traversal / restoration puzzle; 3–4 minutes first visit; difficulty 4/10.
- **Prerequisites:** move, jump, dash, hold-jump glide; no new input or climb animation.
- **Status:** Layout; acceptance below is deliberately unclaimed.
- **Fantasy:** carry a brief breath of fire up a ruined hillside, then send the whole valley moving.
- **Existing tools:** ColorField wake/stroke, hearth updraft, Shade drain/freeing, element inlet, wind spline. No conducting elements or inventory keys.

The documents answer the design questions: the player comes for the still mills and the cold kiln on the west skyline; the reward is a permanent aerial way to Wellspring Hill. Use BotW's visible destination and rule reuse, with Spyro's forgiving glide approaches. The existing island geography stays.

| Layout option | Benefit | Cost |
|---|---|---|
| **Recommended: terraces → wind gap → kiln ledge** | Reuses shipped geometry; teaches heat, duration and wind before their shrine combination | Needs precise recovery shelves and clear launch silhouette |
| Separate kiln interior | Strong enclosure | New collision and camera risk; hides the landmark consequence |
| Direct ground stair to kiln | Easy navigation | Removes the reason to learn glide and wind |

## Narrative / leading elements

From the hub realm gate / arrival meadow, three still sails sit left of the distant summit maple; the kiln ash curl is a distinct vertical mark beyond them. From H0's launch rock the next mill frames the terrace route. At the final launch, the kiln bowl interrupts the sky and the east-facing jut points toward the hill. Warm rock edges and leaf drift identify landings; no pickup line or instruction text is required. Quiet stone, pressed sails, then the sound and motion of working air establish the change.

## Layout

```text
 meadow [S] → H0 dry pond [U] → stepped terraces
                                ↓
                  mill current → 20 m gap → launch rock y22
                                                ↓ glide
    south/east catch [U] y15 ← kiln ledge y20 [H2 + Shade]
                                                ↓ heat feeds
                                         [W] bowl / jut y26
                                                ↓ permanent wind
                 [?] NW fork ← wind river → [E] arena west rim
```

### Critical path

1. At H0, the approach wakes a hearth; the ≥7 s route to its launch outlasts a plain wake. A dash past the rim leaves a strong stroke long enough to return and ride. The dry pond is safe recovery ground.
2. Ascend the terraces. Mill 1 wakes as the fox passes; its leaf stream spans the 20 m gap beyond an unassisted glide's measured range. Jump, glide with the stream, land on a broad opposing terrace.
3. From `sp(80.8, 4.6)`, jump/glide to the kiln ledge at (−112, −24), y20. Target edge-to-edge gap ≈12.4 m with 2 m drop; verify with the shipped preset.
4. **Fire below the rim (SW1 aha, levels-opus 15:45).** The bowl hangs from a carved mast out over the ledge's east rim. The obvious fire, H2 beside the Seedwell, is circled by the Kiln Shade, whose drain reaches 4 m of its own height, so H2 always gutters (that failure is the lesson). The dish sits inside the column of HE on the y15 catch shelf below. Drop down, wake HE and ride its heat back up past the dish while the Shade circles a dead hearth above. The heat feeds the dish, and the dish feeds SW1 for 2 s. Latching restores H2 for the ride to the jut. Fox proximity never fills the seal. Rule-derived extras: a dash that frees the Shade still leaves H2 outside the dish's column, and HS (south shelf) lands a missed drop with a ride back up.
5. Ride H2 to the y26 jut. Latching restores heat and mill motion; the permanent wind river carries a glide east over Amberwood to the arena west rim (−20, −60), y12. Any one Seedwell grants hill access.

### Rule-derived alternate solutions

The shrine checks H2 output, not a quest order: a player can time an aura ignition just after the Shade passes and finish the 2 s feed before its return. This opportunistic solution must remain valid if timing permits. A player who frees the Shade first can return later; no reset should recreate it. Do not add a bespoke solution trigger.

### Optional paths and secrets

| Path | Access / hint | Reward |
|---|---|---|
| Three-hearth mill cap challenge (S4) | Mill 3 lip has three different-height ash curls within one dash line; dash lights the chain, glide from 6/9/12 m columns | Lost Kit #2 on cap y34; valid before/after restore |
| The curl under the gap (S5) | Gliding the 20 m wind gap, a cold ash curl shows on the y10 floor at the foot of the far cliff, with a warm-lit broken arch on a balcony above | Ride HG (12.5 m) to the y22 balcony: a side view of the Kiln spire and the gap just crossed |
| NW wind fork (S2) | After SW1, a narrow moving-leaf branch peels away at the wind river's high point; islet arch silhouette visible through it | Old fox shrine / gold wake tint; return hearth lifts to a safe glide toward Amberwood |

## Restoration / safety

| Restore | Before | Permanent verb / landmark | Teach in ≤30 s? |
|---|---|---|---|
| SW1, radius 40 m | Temporary H2, drain interrupts weak supply, still sails | Restored regional hearths plus wind-river traversal; three mills turn | Target: yes, measured from ledge arrival |

Missed kiln landings reach south/east shelves at y15, with hearths lifting back to y20 in ≤10 s. Check all four ledge edges, including west/north; no miss may require a damaging drop. Broad catch tops and rounded art meshes must agree with collision. The 6 m jut-to-ledge fall is the maximum unglided drop. Columns never refresh air-dash; a dying column returns to glide sink.

## Pacing

```text
wonder/challenge: meadow 2 → H0 5 → terrace recovery 3 → wind gap 6
                 → kiln vista 4 → Shade/heat aha 7 → wind river release 2
```

## Acceptance / kill tests

- [ ] GPU keyboard playthrough: H0, wind gap, kiln latch, river exit; retain video, stills, `window.__game`.
- [ ] Observe direct fox color cannot fill SW1; H2 heat ≥0.5 fills for 2 s; test both dash solutions and timing solution.
- [ ] Player can infer why color stayed: element feeds carved seal, then fire/sails persist after fox departs. Fresh-player comprehension remains unassessed.
- [ ] Test missed approach and every ledge edge: ≤6 m recovery fall, return ≤10 s, camera clears geometry.
- [ ] Record jump/air/dash metrics; no skating verdict without locomotion review.
- [x] Design contains no orb threshold; permanent restore adds a traversal verb.
- [ ] Review actual GPU images against soft animated realism, fix named failures, capture again.

## R6 transition repair (driver flow review13:36)
R6 reaches y22 at constant s66, while the y22 terrace begins s68. A fox running toward the next waypoint falls into that two-metre seam and meets a four-metre wall. Add a y22 stone apron covering s65..69, t−1.4..1.6, with matching collider and cap. Its lower edge meets the ramp only after ramp height≥21.48, within0.6m auto-step. Preserve all movement tunables. Verify from cp-mills through R6 and the kiln launch via live input, zero assists.

## Critical-path order repair (driver14:10)
The realm route must follow its authored recommendation: opening H-a → Windmill Rise → SW1 → Creek Root / heartwood → summit. Reedmarsh is an optional branch tested independently, not a prerequisite detour that blocks the first minute. H0 becomes the direct heat transfer on the way up: dash beside the brazier at t9.7, then hold-jump in its column and exit to y10. Old stump geometry remains an optional route. The seven-second H0 duration pocket remains unimplemented. Rendered route paving follows this new order.

R4 live route repair: regional5b0e647 reaches upper14m landing then targets s35.7, outside the shortened terrace (s≥36), and drops. Keep the turn at s36.4,t−4, inside the slab and clear of the relocated mill. This fixes route data rather than widening the gap geometry again.
