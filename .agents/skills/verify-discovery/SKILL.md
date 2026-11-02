---
name: verify-discovery
description: Recheck opening paper-invitation synchronization and real landing gates before changing guidance.
---

The invitation must follow the real page's three catches, and only a real support contact may advance a traversal cue. Premature advancement in flight sends a new player into the gap; stale guidance after a catch sends them back to the village.

Implementation: `games/fox-spirit/src/opening/discovery.hot.ts`; read-only views in `canopy.ts`, `popUpRuin.ts`, `page.hot.ts`. Model: `games/fox-spirit/tla/Discovery.tla` + `.cfg`.

Recheck:

```sh
tlc -workers 2 -config games/fox-spirit/tla/Discovery.cfg games/fox-spirit/tla/Discovery.tla
```

Expected:112generated/38distinct states, no error. The third catch enters `land`, not `done`; only a current ground contact may complete guidance. Negative control: outside the repo copy to DiscoveryBad.tla, rename the module, remove `/\ onOverlook` from Finish. DoneAfterLanding must fail in a five-state trace (three catches while airborne, then premature finish). Verified2026-11-02 by Hazel. The catch-synchronization negative (replace World's leg update with UNCHANGED leg) still checks MatchesWorld.

The abstraction allows an Arrive only after its implementation guard. It does NOT prove those guards match geometry, the cue is visible, or random wandering finishes the chase. Run `node tools/discovery-probe.mjs --seconds 90 --idle 1.5 --out DIR`: actual input-only cue following must report firstCatch/canopy/overlook/kept/guidanceFinished/finishOnGround/initialFollow/dashAfterBolt/noErrors true. Read trace and game state; inspect continuous rendered footage of jumps 2→3 as well as final still. Test grounded floor retries separately. Preserve separate corrected blind-wander results from tools/naive-explore.mjs; never label a cue follower as blind wander.

Sync is the current landing-proof model revision (resolve with `git log -1 --format=%H -- games/fox-spirit/tla/Discovery.tla`). Guidance receives readonly page/support views and cannot call debug progression controls. Completion consumes a private unique-symbol current-contact token; the AST safety gate rejects direct done/inactive assignments and raw-token calls. Keep hot code allocation-free and deterministic.

Teach consumer ordering: recheck `tlc -workers 2 -config games/fox-spirit/tla/TeachOrder.cfg games/fox-spirit/tla/TeachOrder.tla` (4/4). Removing the Publish cursor=2 guard must fail LatestOfferWins. `lint:feel` tests old early consumer registration and provider-after-mount negative snippets. The discovery probe also rejects competing cold-hearth/warm-air hints during the chase.
