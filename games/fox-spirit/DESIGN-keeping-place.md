# The first Keeping — place (Hearthtree)

Design v1 (/swarm/seed/DESIGN.md): one compact Keeping after the shelf. Carry a coal, reconnect a short route with existing steam chemistry, light the root-hearth, and the arrested Hearthtree finishes falling into a bridge.

## Layout (all in `opening/layout.ts` `KEEPING`, built by `opening/keeping.ts`)

Two storeys above the meadow, east of the H-a shelf (`SHELF_TOP` ≈ 4.96, terrace top ≈ 9.46):

1. **Coal cradle** on the shelf (15.1, 77.4): a small ash ring the ember rests in.
2. **Ledge** shelf → bend → steam pad, 3.2 m walk on moss-capped columns. Rubble curbs are one continuous low blocker per run (0.34 m: a jump leaves, a walk doesn't) on every drop side; the bend's inside has a turf shoulder. The bend is the safe place to meet dash-drop.
3. **Steam spring** basin against the terrace cliff. Placed coal → steam (Rook's chemistry on the shared updraft) lifts the fox onto the terrace.
4. **Steam stair** (the reconnected walk route): stones pressed flat into the terrace's north cliff, like a pop-up page. The steam latch unfolds them bottom → top (≈1.7 s); the fox can then walk the coal up and walk back down. Fine sub-step colliders keep every riser under `PLAY.step` and the 0.28 m forward probe under step + 0.15. A lip on the drop edge and a standing stone at the top end.
5. **Root-hearth** ash bowl on the terrace; the Hearthtree's roots spread over the terrace (static).
6. **Hearthtree** caught mid-fall at 54° over the gorge, leaves pressed in mid-air under its crown. Before the release its trunk is a post collider.
7. **Far crag** across the gorge; past it, Flint's vista notch and the Still Crown.

## Release (authored, not physics)

`release()` (chemistry root latch) → shiver 0.9 s (leaves start to drift) → fall 1.3 s on an accelerating curve → impact (bridge box + root-crown hump pushed into the colliders, trunk post removed; landing dust; leaf burst) → one small rebound → `bridge` phase, `onSettled` (Crown/hum). After impact the **crown sheds**: lobes drain into a leaf storm over ≈4 s and the bare inked limbs remain — the autumn the tree was holding finishes, the bridge sightline to the Crown opens, and the leaves carpet the trunk and crag.

Walk surface: trunk top is kept level by the settled angle (π/2 − 0.035) against the taper; bridge box top = terrace top + 0.12.

## No soft-lock

Every floor cell under the ledge, stair, terrace and crag walks back to the meadow (`tools/keeping-pocket-probe.mjs`: ground flood-fill from the meadow over `player.surfaceAt`, rise ≤ 0.3 per 0.25 m). Removing the SE ridge column and slimming the east one opened the pocket the place had sealed.

## Hooks

`state().opening.keeping` = `{ phase, t, angle, bridge, impact, impacts, bridgeTop, crownLobes, stair }`; dev `__gameHooks.keepingRelease()` / `keepingSteam()`. Local stills: `node tools/keeping-stills.mjs --out /tmp/ks [--steam 1] [--settle N] [--paint 1] [--seq cam:t1,t2]`.
