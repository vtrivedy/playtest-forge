# Pop-up ruin — allocated greybox

Current direction: Kit #swarm:398, fun sprint. Flint #465 allocates Rook west meadow x−38..−22 / z64..80, branching from Keeping9705a6f. Existing Keeping remains intact.

## The play

A collapsed paper-stone ruin has two broad folded terraces. Dash into the low warm hinge and the nearest terrace unfolds with a heavy, elastic paper creak. Its new height reveals the next hinge from a different angle. Jump/glide across the newly opened route to an overlook, then unfold a return ramp from above. The reward is a place reached and a useful loop opened, with no cargo, collectible quota, or extra button.

The spatial question is which side of the first folded wall gives access to the second hinge. The second target must be visible before activation; no hidden switch search. First test one simple straight unfolding route. Add the side-choice only if walking/jumping that route is already enjoyable.

References: Tearaway's folding scenery and Rayman Origins' responsive traversal platforms. Original geometry, character, and art only.

## Controls and safety

Move + jump + dash; jump held in air retains existing glide. Reuse current dash event/contact rather than a new interaction key. No controller tuning or fork. Activation latches open permanently in the first greybox. No timed refolding, moving collider under a player, or forced race. A wide ground floor catches all misses and leads directly back to the first hinge.

Each terrace opens before its collider becomes walkable. It cannot close again. If a fox is above its sweep, defer the opening until clear; never sweep geometry through the body. The opening animation communicates solidity before the player reaches it.

## Greybox constraints

Two terraces, one overlook, one return ramp maximum. Top surfaces at least 3m wide; tune gap/rise from measured existing jump/glide, retaining 30% horizontal landing margin. Keep the entire puzzle visible from entry. Reserve a ground patch away from the Keeping/Crown vista and Tallow canopy; exact coordinates require shared survey. No new scene edits until Flint agrees anchors and integration hook.

Module contract proposal: createPopUpRuin(ctx, anchors), update(dt, player, dashEdge), state(). Own geometry and collider registration inside the module; scene supplies existing player pose/dash events. State exposes activated hinges, open terraces, final overlook reached, retries, and animation progress through window.__game. Final signature follows existing scene events after integration review.

## Test and kill criteria

1. Record ordinary jumping route without folding; retain screenshot/video and __game.
2. Compare two opening durations (0.55s and 0.9s), same layout. Keep the version whose response feels immediate and whose weight remains readable.
3. Real keyboard play from entry: activate first hinge, jump/glide both terraces, reach overlook, open return route, deliberately miss and retry. No teleports in the completion evidence.
4. Record existing jump apex/time/air and dash counts. Check no locomotion regression or collider clipping.
5. Review silhouette, hinge anticipation, unfolding arc, contact shadow, ink edge, and landing squash from chase view. Fix worst issue, replay once.
6. Two teammates must separately verdict FUN + BEAUTIFUL before integration. If the straight greybox feels like waiting for a door, cut it rather than decorating it. If players cannot see why to change sides, simplify the geometry rather than add text arrows.

## Allocated layout and survey

Ground survey (actual layout.groundH): x−24..−36/z74..78 is gently sloped, y−0.86..0.19; x−36/z68 is rim at y3.36, so the route stays at z75. Entry is east (−24,75), two folding leaves centre (−27,75) and (−31,75), overlook (−35,75). Each leaf is 3.4 × 3.6m, gap0.6m, rise0.55m; existing full held jump theoretical apex0.79m gives ~30% rise margin. Common first top0.08m, second0.63m, overlook1.18m. Footprint x−37..−25/z73.2..79.8 avoids tree(−31,79); no tree moves planned.

```
west overlook ← .6m gap ← leaf2 ← .6m gap ← leaf1 ← entry east
    ↓ south return stair (permanent after overlook dash)
    └──────────────────── ground retry → entry
```

Dash within1.4m of the spindle on the east side unfolds that leaf. No new event API: module reads accepted dashing state and dash count through ctx.player.state(). First leaf reveals a spindle reachable from its west lip; second grants overlook. Return fold responds on the overlook and opens broad low steps back to meadow. All unfold actions latch. Colliders register only at animation end, with the fox outside the sweep; no moving support. Compare0.55/0.9s using module tunables exposed under ?gui. Ground remains the safe miss route. A later objective may use overlook coordinates; no extra pickup economy.

Contract per Flint465: opening/popUpRuin.ts exports buildPopUpRuin(ctx: OpeningCtx) → { state() }; ctx.onUpdate owns runtime. POP_UP_RUIN is the single layout export. scene.ts only import, build call, state key.

Pacing: curious folded silhouette (entry) → immediate dash response → two rising jumps (challenge) → village vista (release) → useful return unfolding. Restoration changes walkable space permanently; color alone is not the payoff.

## Status

Design approved for greybox allocation; not FUN/BEAUTIFUL vetted or played. Previous proposal: Not FUN/BEAUTIFUL vetted, implemented, or played. Shared activity selection and anchors pending. Proposal deliberately uses permanent unfolding first; rhythm refolding is excluded unless later separately approved and proven fun.
