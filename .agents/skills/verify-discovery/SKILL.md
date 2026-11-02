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

Expected: 36 generated, 14 distinct states, no error. Negative control: outside the repo copy Discovery.tla to DiscoveryBad.tla, rename the module, replace `leg' = First[catches' + 1]` with `UNCHANGED leg`, rerun using Discovery.cfg. MatchesWorld must fail at the first world catch (two-state trace). Verified 2026-11-02 by Hazel.

The abstraction allows an Arrive only after its implementation guard. It does NOT prove those guards match geometry, the cue is visible, or random wandering finishes the chase. Run `node tools/discovery-probe.mjs --seconds 90 --out DIR`: actual input-only cue following must report firstCatch/canopy/overlook/kept/noErrors true. Read trace and game state; inspect continuous rendered footage of jumps 2→3 as well as final still. Test grounded floor retries separately. Preserve separate corrected blind-wander results from tools/naive-explore.mjs; never label a cue follower as blind wander.

Sync baseline is the commit introducing this skill (resolve with `git log -1 --format=%H -- .agents/skills/verify-discovery/SKILL.md`). Guidance receives readonly page/support views and cannot call debug progression controls. Keep hot code allocation-free and deterministic.

Teach consumer ordering: recheck `tlc -workers 2 -config games/fox-spirit/tla/TeachOrder.cfg games/fox-spirit/tla/TeachOrder.tla` (4/4). Removing the Publish cursor=2 guard must fail LatestOfferWins. `lint:feel` tests old early consumer registration and provider-after-mount negative snippets. The discovery probe also rejects competing cold-hearth/warm-air hints during the chase.
