# Jogs: independent Tallow review

Candidate `207cc86fe1116a30b784c1d8370074f06c2f95b6`, compared with Moss's matched
`7d2eb97` chase stills. Verdict: **FUN MARGINALLY; BEAUTIFUL MARGINALLY**.

The cairn and warm leaf shoulder make the westward bend more legible than the
empty ground before. The hare's bound, upright waiting pose and face-washing
at the ruin add a welcome living response. The fox remains clearly separated.

The pressed page cannot be identified from the retained roost/drop view
`2a-hare-stone.png`. At normal chase distance the hare is a small brown mark
against brown ground (`h6-leg.png`); its attractive close-up does not establish
route readability. Improve the page's facing/find signal and the hare's distant
tail contrast before calling this clearly better. Cairn size variation would
also soften the regular pancake stack.

Independent verification on the exact candidate, isolated detached worktree:

- `npx tsc --noEmit` and Vite production build passed.
- Played `tools/jogs-stills.mjs --hare 1`: real Shift dash from staged approach,
  then world-stick following; manual simulation clock and authored destinations.
- State confirms popping → performing → alive. Hare waits near
  `[-12.44,-0.38,79.93]` when fox lags, and settles at
  `[-21.73,-0.53,77.48]`. No page errors.
- State was read through `__gameHooks.state`, the same function exported as
  `window.__game.state` in opening scene. This probe logs hare/fox state rather
  than retaining the complete game snapshot.
- Independently rendered and inspected roost discovery, close bound, waiting
  and chase views. Evidence: `/captures/tallow/jogs-207cc86/`, including
  `probe.log`. Matched downloaded before/after: `/tmp/tallow-jogs-review/`.

This is a bounded candidate review, not a blind discovery test, full Keeping
route replay, continuous motion critique, or approval to land. Moss owns the
revision; no runtime source was changed by this review.

## Polish candidate 2ae30c0

Reviewed actual downloaded `2-off-canopy.png`, `h6b-waits.png`, and matched
`4-turn-west.png` from `moss-jogs-2ae30c0`. Verdict versus `207cc86`:
**BEAUTIFUL CLEARLY BETTER; FUN MARGINALLY** (stills only).

The hare page is immediately identifiable to the right of the fox in the
landing chase view. The pale scut separates the waiting hare from sepia ground.
The bend cairn has more varied sizes and offsets. These resolve the visual
readability objections above. Roost-top body occlusion remains disclosed by
Moss; the landing view establishes visibility after the drop, not before it.

Downloaded evidence: `/tmp/tallow-jogs-polish/`. Swarm verdict message `883`.
No fresh runtime, build, motion or blind discovery claim for this candidate;
Moss retains ownership of the pending full-route verification.
