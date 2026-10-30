# Russetvale — Reedmarsh

> Layout specification, sprint 2; `world-1.md` §3.5 is canonical. Template adapted from Claude Code Game Studios (MIT © Donchitos). GPU verification remains pending.

## Quick reference and decisions

- **Type:** exploration / water-duration puzzle; 3 minutes first visit; difficulty 4/10.
- **Prerequisites:** move, jump, dash, hold-jump glide. SW1 is optional.
- **Status:** Layout.
- **Fantasy:** release water held in mid-fall, then follow its moving front through a thirsty landscape.
- **Existing tools:** water parcels/fronts, wake/stroke, HP updraft, Shade, inlet; growth lily pads only once growth integration supports them. Do not fake pad retention with disappearing stones.

Why go: the glass waterfall hangs visibly above the eastern marsh from the arrival meadow. From Windmill Rise / its river, aqueduct piers and the pale frozen ribbon stand above the low reeds. BotW's physical cause-and-effect motivates the shrine: the fox must sustain a source long enough for water to arrive, rather than touch a seal.

| Layout option | Benefit | Cost |
|---|---|---|
| **Recommended: raised waterfall → exposed flume → basin** | Water front, travel delay and near-success are observable | Camera must show front and basin without hiding fox |
| Ground-level spring by basin | Accessible | Removes traversal and duration reasoning |
| Multiple water switches | More combinations | Violates one-source clarity and adds unnecessary system scope |

## Narrative / leading elements

Marsh Mouth's small frozen spill at (57,36) is the approachable version of the tall falls. A cold ribbon ends above an ink channel; waking it washes a usable crossing. Beyond, two tall aqueduct piers bracket the main glass waterfall. The flume visibly slopes to the carved Reed basin. Water sound travels downstream with the front; reeds bend near flowing sections. The player sees where water wants to go without UI arrows.

## Layout

```text
 meadow [S] → Marsh Mouth wash crossing → boardwalk / safe hummocks
                                                   ↓
                              pads → [W] Reed basin y2
                                        ↗ stair → HP pier y6 [U]
                                                            ↑
                              lip walk y15 ← aqueduct [!] ← glide
                                  ↓ glass falls
                            exposed winding flume + Shade
                                  ↓ arrives / fills seal
                         [E] Reed Causeway → arena east stair
                                  ↘ [?] sunken ruin
```

## Critical path

1. Wake the Marsh Mouth spill and cross the washed 6 m ink channel. Stable boardwalk/hummocks give a short return if the water ends.
2. Follow pad/hummock spacing of 4–6 m toward SW2 island (95,10), y2. If pads are temporary, the occupied support chain persists until stable ground; never claim the new pad route shipped while only the old stones exist.
3. Climb the island-to-pier stair (y2→6), wake HP, glide up its column to the aqueduct top y15. Its accessible relight position remains available after every miss.
4. See the frozen falls from (100,18), y15→10, terminating above a flume at y6. The source probes are deliberately out of aura reach from the low pier. The 32 m flume takes about 4 s at 8 m/s to deliver water.
5. Keep source water arriving at SW2 for 7 s: dash through the falls for ≈9 s source output, or stand at the aqueduct lip and sustain it with aura. A plain pass supplies only ≈5.5 s; water arrives and partly fills the seal, then visibly runs out. That near-miss teaches duration.
6. Free the flume Shade or time around its drain. SW2 latches only from arriving water, washes marsh ink permanently and reveals the Reed Causeway from (70,0) toward arena east stair (18,−58).

## Rule-derived alternate solutions

Repeated short returns to the lip can sustain the same source without a dash if the player learns the hold interval. Water parcels must preserve the front/tail rather than reset the whole flume. A player may free the Shade before climbing, or dash it during a crossing while leaving the source running. These are consequences of shared source/drain rules, not separate scripted success paths.

## Optional paths / secrets

| Path | Hint / access | Reward |
|---|---|---|
| Flume-following challenge | Stay with the visible water front from source to basin using ledges and safe crossings; no timer HUD / currency | A complete view of the water chain and a shortcut back to the island |
| S3 sunken ruin at (110,40), y−6 | After SW2 the drained ink exposes a stair descending beside a broken arch; architecture, not a glint | Pressed Album page #2; inner stair returns to marsh floor y−2 |

## Restoration / safety

| Restore | Before | Permanent verb / landmark | Teach in ≤30 s? |
|---|---|---|---|
| SW2, radius 35 m | Glass falls, timed washing, interrupted flume | Permanent water/wash crossing and Reed Causeway to hill; flowing falls visible across valley | Target yes from first source activation |

The locked world spec's y15→y2 recovery exceeds its own ≤6 m hard-fall contract. Resolve in implementation with intermediate catch ledges/pier platforms at ≤6 m vertical intervals and a broad pool landing that is explicitly safe in physics; do not assume decorative water negates fall damage. Return from a missed source attempt to HP should take ≤10 s. Stair rises must clear the shipped auto-step height and collision should not catch paws. No ink is placed on mandatory retry ground. Retained pad collision never counts as water feed.

## Pacing

```text
wonder/challenge: spill discovery 3 → wash crossing 4 → marsh pause 2
                 → HP rise 5 → glass vista 3 → duration near-miss 6
                 → water arrival / latch 4 → causeway release 2
```

## Acceptance / kill tests

- [ ] Keyboard GPU playthrough from Marsh Mouth through HP, aqueduct, SW2 and causeway, with `window.__game` water/inlet state.
- [ ] Plain fly-through fails by duration; dash and sustained-lip aura each succeed; Shade interrupts downstream flow with a trailing front.
- [ ] Fox standing at Seedwell never fills it directly. Water feed only while arriving; seal drains otherwise.
- [ ] Test all aqueduct fall directions and source retry time; all temporary supports warn ≥0.8 s and retain occupied chains.
- [ ] Show far landmark before/after plus source/front/basin screenshots; inspect every image, fix named failures and retest.
- [x] No orb threshold; restoration opens a physical way to the hill.
- [ ] Fresh-player explanation of why color stayed remains unassessed until observed.
