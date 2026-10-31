# Sprint 3: continuous Lanternhollow → Kiln route

Scope: prove one authored route with real movement and element physics from Lanternhollow through Windmill Rise to SW1. No enemy, health, controller, camera, water, restoration or character rewrites in this stream. The current checkout starts at the Russetvale portal; reviewed hub integration must surround this natural spawn before calling it hub proof. Never pre-light elements, relocate the start, freeze physics or represent a staged segment as a continuous clear.

## Current capture behavior

`kilnroute` starts at natural spawn and resolves the named `SW1-feed` waypoint, avoiding brittle numeric indices. The bot uses real movement/jump/dash/glide input with assists disabled. SW1 must begin unlit. Independently observe its latch and a grounded arrival within 3m horizontally / 1m vertically of the feed waypoint. Save the first index crossing separately so a missed arrival fails visibly.

Continue the existing authored onward route after that arrival, ending the successful clip at 60 live seconds or at arrival if later. `route-seconds` is the hard cap and must be at least 60s. This interprets the brief as a continuous gameplay video of at least 60s containing the first-shrine clear; it does not artificially stretch traversal to take 60s. Stop and clear actual input only after recording ends. Record arrival/departure, post-arrival duration, final position and whether final footing happens to remain near the feed; final standing there is not acceptance. Preserve separate full-realm and explicitly staged regional capture modes.

Acceptance requires observed grounded arrival + SW1 latch, at least 60 encoded seconds, zero deaths/assists, no stalled bot, no large position discontinuity and no fox focus leaving the camera frustum. A failure records whether it occurred before or after arrival. Shade hits do not fail the brief's zero-death gate, but report hits before/after arrival, minimum wisps and accumulated sampled knockback travel; do not call a hit-filled run clean.

## Framing and continuity evidence

Sample after rendering and before each encoded frame. Project the existing debug fox group's world position plus 0.6m focus height with the live camera; require finite x/y/z normalized coordinates within [-1,1]. This measures a focus point, not full-silhouette visibility or occlusion. Record total/outside samples, finite maximum displacement and first failure; retain at most 16 failing samples and preserve nonfinite values as strings with a finite flag. Keep PNG/MP4 inspection mandatory.

Independently record maximum between-frame feet displacement and its frame. Reject steps over max(3m, 90/fps metres) or nonfinite steps as a conservative large-discontinuity gate; this is not proof against every sub-threshold position edit. No simulation, fox or camera mutation. Existing fatal capture errors abort without acceptance; partial captures cannot pass.

## Evidence and rationale

Personally inspected baseline archive8bbd1b9661bb: natural portal→Kiln in45.57s,0deaths/assists, SW1 latch39.6s. Its final landing lies0.14m from the original Shade patrol. A CPU probe of the real current Shade system/GLB on an unobstructed flat y20 floor hits that stationary landing after6.87s; this is a risk finding, not whole-game proof. The earlier idle hold was a capture accommodation, not an authored safe rest. Continuing onward preserves authored gameplay without enemy edits or an added combat/retreat bot. Record actual GPU evidence before deciding whether the current encounter needs repair.

Hub remains a reviewed integration dependency. Current hub candidate preserves spawn and route coordinates, requiring no teleport or chapter splice. Inspect its latest PNGs/state and Opus verdict before merging game changes. The baseline sampled path already uses carved columns/slabs; avoid presentation churn until fresh captures identify a concrete failure. Existing CC0 Quaternius assets only if presentation changes become necessary.

## Validation

Node/Python syntax checks for capture tooling; TypeScript and fox Vite build for game integration. Push immutable SHAs, request remote GPU captures, personally inspect PNGs and window.__game, obtain cross-model critique and retest fixes. No local browser/render. Missing external sprint3 style/COMMON and sprint2 lessons are recorded as unavailable; supplied soft gentle animated realism brief and art lock govern.
