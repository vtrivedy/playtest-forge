# Sprint 3: continuous Lanternhollow → Kiln route

Scope: prove one authored route with real movement and element physics from Lanternhollow through Windmill Rise to SW1. No enemy, health, controller, camera, water, restoration or character rewrites in this stream. Main now includes Lanternhollow around the existing natural spawn. Require the initial state to identify Lanternhollow; a portal-only checkout cannot pass the Kiln proof. Never pre-light elements, relocate the start, freeze physics or represent a staged segment as a continuous clear.

## Current capture behavior

`kilnroute` starts at natural spawn and resolves the named `SW1-feed` waypoint, avoiding brittle numeric indices. The bot uses real movement/jump/dash/glide input with assists disabled. SW1 must begin unlit. Independently observe its latch and a grounded arrival within 3m horizontally / 1m vertically of the feed waypoint. Save the first index crossing separately so a missed arrival fails visibly.

The 22:35 driver note explicitly requires live idle to 60s. Stop the bot and clear keys/stick immediately after independently observed grounded arrival and latch, keeping real physics/rendering live until60 encoded seconds. Record arrival/departure, idle duration and final footing. Require final grounded footing within3m XZ/1m Y of SW1-feed; a drift or hit must not silently pass. `route-seconds` is the hard cap and must be at least60s; successful runs stop at60s or at later arrival. No continued onward segment in this proof. Preserve separate full-realm and explicitly staged regional capture modes.

Acceptance requires observed grounded arrival + SW1 latch, at least 60 encoded seconds, zero deaths/assists, stable final endpoint footing, no stalled bot, no large position discontinuity and no fox focus leaving the camera frustum. A failure records whether it occurred before or after arrival. Shade hits do not fail the brief's zero-death gate, but report hits before/after arrival, minimum wisps and accumulated sampled knockback travel; do not call a hit-filled run clean.

## Framing and continuity evidence

Sample after rendering and before each encoded frame. Project the existing debug fox group's world position plus 0.6m focus height with the live camera; require finite x/y/z normalized coordinates within [-1,1]. This measures a focus point, not full-silhouette visibility or occlusion. Record total/outside samples, finite maximum displacement and first failure; retain at most 16 failing samples and preserve nonfinite values as strings with a finite flag. Keep PNG/MP4 inspection mandatory.

Independently record maximum between-frame feet displacement and its frame. Reject steps over max(3m, 90/fps metres) or nonfinite steps as a conservative large-discontinuity gate; this is not proof against every sub-threshold position edit. No simulation, fox or camera mutation. Existing fatal capture errors abort without acceptance; partial captures cannot pass.

## Evidence and rationale

Personally inspected baseline archive8bbd1b9661bb: natural portal→Kiln in45.57s,0deaths/assists, SW1 latch39.6s. Its final landing lies0.14m from the original Shade patrol. A CPU probe of the real current Shade system/GLB on an unobstructed flat y20 floor hits that stationary landing after6.87s; this is a risk finding, not whole-game proof. The earlier idle hold was a capture accommodation, not an authored safe rest. That probe predates the newly merged Shade attraction-rest fix, which stops pursuit short of contact. Keep live idle as explicitly required by the latest driver; inspect fresh GPU evidence before deciding whether any real encounter or safe-footing repair is needed. Do not change enemies or add a combat/retreat bot speculatively.

Hub is now in origin/main and preserves spawn and route coordinates, requiring no teleport or chapter splice. Inspect the integrated hub PNGs/state and Opus verdict before claiming the final route visual gate. The baseline sampled path already uses carved columns/slabs; avoid presentation churn until fresh captures identify a concrete failure. Existing CC0 Quaternius assets only if presentation changes become necessary.

## Validation

Node/Python syntax checks for capture tooling; TypeScript and fox Vite build for game integration. Push immutable SHAs, request remote GPU captures, personally inspect PNGs and window.__game, obtain cross-model critique and retest fixes. No local browser/render. Missing external sprint3 style/COMMON and sprint2 lessons are recorded as unavailable; supplied soft gentle animated realism brief and art lock govern.
