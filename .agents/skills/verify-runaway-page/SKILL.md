---
name: verify-runaway-page
description: Recheck the three-catch runaway page progression before changing its state machine.
---

The page can only be kept after three catches and cannot leave the kept state. A broken count can end the chase early or softlock homecoming.

Implementation: `games/fox-spirit/src/opening/page.hot.ts`.
Model: `games/fox-spirit/tla/RunawayPage.tla` and `.cfg`.

Run from repository root:

```sh
tlc -workers 2 -config games/fox-spirit/tla/RunawayPage.cfg games/fox-spirit/tla/RunawayPage.tla
```

Expected: no error, 24 generated / 9 distinct states. Liveness assumes fair successful catch actions and automatic fling landing; it does not prove that actual input geometry is reachable. Never add fairness for a transition the implementation can fail to perform.

Negative control verified 2026-11-02 by Sorrel: change `KeptOnlyAfterThree` to require one catch, keep `Inv` enabled, rerun. TLC must fail at the third Catch (six-state trace, catches=3, phase=kept). Generate the broken variant outside the repo and preserve the passing model.

Sync: the commit introducing `page.hot.ts` and this skill preserves the original discrete transition rules. Resolve its immutable SHA with `git log -1 --format=%H -- games/fox-spirit/tla/RunawayPage.tla`; subsequent changes to catch/stage/phase must update this sync note and recheck. Continuous target smoothing, heading, timing/reach, camera and debug stage reset are outside this model. Use `tools/page-motion-probe.mjs` at 60Hz and `--dt 0.05`, plus a continuous named-build catch/rise clip to check those.
