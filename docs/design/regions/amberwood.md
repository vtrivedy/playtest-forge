# Russetvale — Amberwood

> Layout specification, sprint 2; implements `world-1.md` §3.6. Template adapted from Claude Code Game Studios (MIT © Donchitos). Document describes target behavior, not a verification claim.

## Quick reference and decisions

- **Type:** exploration / growth-duration puzzle; 3–4 minutes; difficulty 5/10.
- **Prerequisites:** move, jump, dash, hold-jump glide; climbing deferred.
- **Status:** Layout.
- **Fantasy:** enter the split heart of an ancient maple and make its roots remember the way upward.
- **Existing tools:** Creek Root growth segments, wake/stroke, Shade, hearth lift, element inlet. Extend authored growth paths; do not add a climbing controller or conduction system.

From arrival meadow, the split maple is a tall central silhouette beyond the creek. From Windmill Rise's river, its warm split reveals the interior destination below; from Reedmarsh the crown and low root bridge point west. The player comes for the living interior and earns a permanent crossing to the hill. Borrow BotW's readable local rule and Spyro's vertical return view.

| Layout option | Benefit | Cost |
|---|---|---|
| **Recommended: hollow trunk, segmented helical ramp** | Same growth rule creates both crossing and ascent; intimate visual identity | Hollow collision and camera require explicit tests |
| Exterior root ladder | Easier framing | Requires unshipped climb pose if vertical; obscures source/socket relation |
| Existing canopy route only | Reuses geometry | Does not turn the shrine into a new systemic space |

## Narrative / leading elements

The Creek Root at (6,−2) is a curled knot beside an actual 10 m gorge. Touching it makes segments unfurl toward the opposite bank, revealing that growth is a route. Root grain and fallen-leaf flow lead toward the south doorway of the hollow maple. Inside, a pale socket high in the split crown is visible between rising root turns. A quiet heartbeat / flexing bark suggests motion without a tutorial panel. The trunk stays grounded and weathered; no face, cartoon doorway or glowing pickup trail.

## Layout

```text
 meadow / marsh [S] → Creek Root [B] → Amberwood floor
                                           ↓ south doorway
                             hollow floor y0: K1 + Shade
                                      ↙             ↘
                     hearth [U] → ring y10 / K2   root helix [B]
                                      ↘             ↙
                                  socket / [W] SW3 y17.5
                                           ↓
                           permanent bridge → [E] hill base
                             ↘ [?] underside alcove
                              crown ramp → [!] valley vista
```

## SW3 as built (levels-opus 16:40): trace the dead root

The crown dish beside SW3 is dry. A dead root runs from it down the outside of the trunk to a coiled knot on the forest floor (south foot), visible both from the crown and from the creek approach. Wake the knot and keep it lit: the root grows 1.3 turns up the trunk (5 segments, about 7.5 s) and pours into the dish. Only a grown, live root feeds the seal (2 s), so walking off early lets it wither. The SW3 latch keeps the root for good, and the grown root is the critical-path way up to the crown. The canopy pad chain stays as the optional route. This replaces the HK hearth bowl that copied SW1.

## Critical path

1. Wake or dash the Creek Root knot and cross its grown segments. The gorge makes the new route physically useful before the shrine. Stable banks and the shallow recovery bed permit a retry; retained occupied collision is visible as withering wood, not an invisible bridge.
2. Enter the hollow maple at (−10,−36) through a 2.4 m south doorway. Replace the present solid trunk collider with a shell ring r3.3–3.9 and a floor y0; the exterior canopy route stays.
3. K1 grows four ramp segments along the inside wall: y0→4.5→9→13.5→17.5, 1.5 s each. Width 1.6 m; slope ≤25°. Root heat ≥0.5 advances growth. A floor Shade passes K1 every 5 s.
4. Dash K1: ≈9 s supply/hold allows 6 s growth plus 2 s socket feed. Or free the Shade and remain at K1 until the last segment reaches the socket and SW3 latches. Fox proximity at SW3 is irrelevant.
5. Optional alternate ascent: floor hearth's 12 m column reaches ring y10; K2 grows the final two segments. It must feed the same socket from actual complete growth, not a proximity shortcut.
6. SW3 restores regional roots permanently, including Creek Root, heartwood stair and the bridge from (0,−31) to (0,−44). Cross to the arena/hill base; no three-Seedwell gate.

## Rule-derived alternate solutions

A player can start K1, ride the hearth to y10, then refresh K2 and finish above the initial growth front. Support retention permits a slow player to wait safely on a withering turn, but retained geometry must **not** fill the socket: the source must again be hot and final segment truly grown. These interactions should emerge from shared heat/growth/support rules, without route-specific completion scripts. Either entrance remains valid after restoration.

## Optional paths / secrets

| Path | Hint / access | Reward |
|---|---|---|
| Crown ascent challenge, S5 | After SW3, the now-unfurled crown root curls visibly around the highest nearby maple at (22,−12), y30 | Panoramic valley view and a glide route back; no score |
| Underbridge alcove, S6 | After SW3, a split in rock is visible from the creek bed beneath the permanent bridge at (4,−38), y2; soft kit call / leaves entering split | Glide under bridge, air-dash into alcove: Lost Kit #3; root stair returns to floor |

## Restoration / safety

| Restore | Before | Permanent verb / landmark | Teach in ≤30 s? |
|---|---|---|---|
| SW3, radius 30 m | Curled roots and timed interior ascent | Persistent root ramps/bridge; canopy unfolds and hill crossing becomes solid | Target yes from K1 activation |

Each turn catches a fall within 4.5 m; no open central shaft may drop a fox from crown to floor without a safe intermediate catch. Retain the whole occupied temporary chain until stable ground. Queue collider changes between simulation steps, before visible growth reaches them. Ensure helix segments meet without lips that catch the fox; test both travel directions. Camera spherecast must fit the interior, doorway and crown; leaf cards are not solid camera walls.

The target 17.5 m ascent at slope ≤25° requires at least 37.5 m horizontal ramp length (≈41.4 m path). Fit helix radius/turn count to that constraint; do not compress the ramp to preserve a decorative silhouette. Confirm source heat remains sufficient until final 2 s feed, including ignite delay.

## Pacing

```text
wonder/challenge: creek growth 4 → forest breath 2 → hollow reveal 5
                 → Shade / K1 6 → ascending root 7 → crown release 3
                 → permanent bridge 2 → optional underside precision 7
```

## Acceptance / kill tests

- [ ] GPU keyboard playthrough: Creek Root, doorway, K1 root ascent, socket latch, permanent bridge; retain video / `window.__game` growth/inlet state.
- [ ] Test dash-K1, free-Shade/stand, and K2 alternate; direct SW3 wake cannot latch.
- [ ] Cold source plus retained occupied ramp never feeds socket; no support removal under planted paws.
- [ ] Verify 20 interrupted growth / wither / reload traversals, safe falls, no stuck segment seams or trunk camera clipping.
- [ ] Capture from meadow, river and hollow floor; review soft animated realism, repair concrete failures, retest.
- [x] No orb threshold; restoration adds a permanent traversal route.
- [ ] Fresh-player understanding of element-fed permanence remains unassessed.
