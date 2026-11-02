# Runaway page — stable motion and deterministic pursuit

The page should feel like a single loose sheet: readable folds, a deliberate turn, a continuous catch arc, then an unhurried release. No extra input or collection mechanic.

First preserve the three catches / staged pursuit state machine. TLC `games/fox-spirit/tla/RunawayPage` checks catch accounting, absorbing kept state, and eventual completion under fair catch/fling actions. Continuous movement and camera composition still require actual play.

Review the current chase/catch/rise continuously before tuning. Eliminate per-frame temporary allocations and nondeterministic dodge choices; migrate touched runtime to `page.hot.ts`. A syntax-tree regression gate will reject allocations in the registered frame callback and its local helpers, including nested callbacks. Constructors and vectors belong in build setup. Add failing fixtures proving the guard catches the old fleck loop and map/filter perch selection.

Catch trajectories must keep their initial momentum, damp heading, and open folds without snapping. Any changed rise target must follow a continuous smoothed path, so a landing or sharp player movement does not shake the enlarging sheet. Preserve reach, three-stage progression, and player feel parameters unless a played failure requires a change.

Acceptance: named SHA, continuous chase/catch/rise clip with frame trace and `window.__game`; 60Hz and 50ms trigger replay; screenshots reviewed for hero/page readability; retest after the largest issue is fixed. tsc, vite, lint:feel, TLC green. No claim that formal verification proves motion quality.

Baseline visual review (f866379): full input route catches all three pages with zero skips, but the final page grows to 5x and rises 5.4m over the moving fox; it leaves the chase frame before the release finishes. The revised release anchors at the catch-time fox pose, rises from +1.25m to +1.7m, and opens to 1.8x. This keeps the intimate sheet readable while the spreading paint provides the broad payoff. Recheck the full catch/landing/release sequence, rather than accepting a still of the final empty platform.

## Production verification follow-up

A production build must contain the fox it displays. Source inspection found that `loadHearthFox` hardcodes a `/assets/` URL served only by Vite's dev middleware; no GLB is present in `dist/fox-spirit`. Migrate runtime model/texture URLs to Vite `?url` imports, add a guard rejecting new dev-only loader literals, then run the page motion capture against `vite.preview` (production output). This is packaging, with no state-machine change; use the already checked page model unchanged. Keep legacy alternate game mode assets bundled too so fixing default boot does not silently leave the same failure elsewhere.
