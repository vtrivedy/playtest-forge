# Sprint 3: continuous Lanternhollow → Kiln route

Scope: prove one authored route with real movement and element physics from Lanternhollow through Windmill Rise to SW1. No enemy, health, controller, camera, water, restoration or character rewrites in this stream. Main now includes Lanternhollow around the existing natural spawn. Require the initial state to identify Lanternhollow; a portal-only checkout cannot pass the Kiln proof. Never pre-light elements, relocate the start, freeze physics or represent a staged segment as a continuous clear.

## Current capture behavior

`kilnroute` starts at natural spawn and resolves the named `SW1-feed` waypoint, avoiding brittle numeric indices. The bot uses real movement/jump/dash/glide input with assists disabled. SW1 must begin unlit. Independently observe its latch and a grounded arrival within 3m horizontally / 1m vertically of the feed waypoint. Save the first index crossing separately so a missed arrival fails visibly.

The 22:35 driver note explicitly requires live idle to 60s. Stop the bot and clear keys/stick immediately after independently observed grounded arrival and latch, keeping real physics/rendering live until 60 encoded seconds. Record arrival/departure, idle duration and final footing. Require final grounded footing within 3m XZ/1m Y of SW1-feed; a drift or hit must not silently pass. `route-seconds` is the hard cap and must be at least 60s; successful runs stop at 60s. No continued onward segment in this proof. Arrival must leave at least one idle frame before the minute ends, with bot/key clearing actually applied; a late arrival cannot pass. Reject any departure beyond the 3m endpoint area during idle, even if the fox returns by the final frame. Preserve separate full-realm and explicitly staged regional capture modes.

Acceptance requires observed grounded arrival + SW1 latch, at least 60 encoded seconds, zero deaths/assists, stable final endpoint footing, no stalled bot, no large position discontinuity and no fox focus leaving the camera frustum. A failure records whether it occurred before or after arrival. Shade hits do not fail the brief's zero-death gate, but report hits before/after arrival, minimum wisps and accumulated sampled knockback travel; do not call a hit-filled run clean.

## Framing and continuity evidence

Sample after rendering and before each encoded frame. Project the existing debug fox group's world position plus 0.6m focus height with the live camera; require finite x/y/z normalized coordinates within [-1,1]. This measures a focus point, not full-silhouette visibility or occlusion. Record total/outside samples, finite maximum displacement and first failure; retain at most 16 failing samples and preserve nonfinite values as strings with a finite flag. Keep PNG/MP4 inspection mandatory.

Independently record maximum between-frame feet displacement and its frame. Reject steps over max(3m, 90/fps metres) or nonfinite steps as a conservative large-discontinuity gate; this is not proof against every sub-threshold position edit. No simulation, fox or camera mutation. Existing fatal capture errors abort without acceptance; partial captures cannot pass.

## Evidence and rationale

Personally inspected baseline archive 8bbd1b9661bb: natural portal→Kiln in 45.57s, 0 deaths/assists, SW1 latch 39.6s. Its final landing lies 0.14m from the original Shade patrol. A CPU probe of the real current Shade system/GLB on an unobstructed flat y20 floor hits that stationary landing after 6.87s; this is a risk finding, not whole-game proof. The earlier idle hold was a capture accommodation, not an authored safe rest. That probe predates the newly merged Shade attraction-rest fix, which stops pursuit short of contact. Keep live idle as explicitly required by the latest driver; inspect fresh GPU evidence before deciding whether any real encounter or safe-footing repair is needed. Do not change enemies or add a combat/retreat bot speculatively.

Hub is now in origin/main and preserves spawn and route coordinates, requiring no teleport or chapter splice. Inspect the integrated hub PNGs/state and Opus verdict before claiming the final route visual gate. The baseline sampled path already uses carved columns/slabs; avoid presentation churn until fresh captures identify a concrete failure. Existing CC0 Quaternius assets only if presentation changes become necessary.

## Validation

Node/Python syntax checks for capture tooling; TypeScript and fox Vite build for game integration. Push immutable SHAs, request remote GPU captures, personally inspect PNGs and window.__game, obtain cross-model critique and retest fixes. No local browser/render. Missing external sprint3 style/COMMON and sprint2 lessons are recorded as unavailable; supplied soft gentle animated realism brief and art lock govern.

## R2 observed failure: R2 stair turn (23:08 ET)

GPU archive880ccfc7a24f on9641e2e/fd26877 fails at27.67s,0deaths/assists, waypoint12. Personally inspected all four route PNGs and window.__game trace: fox climbs to4.68m then drops to2m at(-54.834,41.957), against the6m terrace face, and cannot progress. Current main retains that capture's ground steering code. The R2 ramp is only2.6m wide; the bot uses full9m/s input through a near-reversal and consumes the nominal upper waypoint while still below the ramp top.

Options: (A) author moderate analog pacing and align the upper waypoint with the true ramp exit (chosen); (B) widen/add a masonry landing apron, which changes manual level geometry before proving it is necessary; (C) sharpen the controller turn/acceleration, which conflicts with the gliding movement brief and another stream's ownership.

Add optional route `pace` metadata, interpreted only by the existing bot as stick magnitude while `onGround && auto.phase === 'run'`, never as a physics override, teleport or assist. Keep full input in air and on intended dash/glide approaches. Apply 0.4 only to the R2 upper and exit waypoints. Shift upper target from terrace(s10.5,t2.6) to(s10.5,t3.0), keeping it on the ramp with room to begin turning before its end at t2.0. Leave approach at full input. No geometry, manual controls or feel tunables change.

Opus design critique rejected the first t1.8 proposal: it aims past the ramp end, so even slowed turns can rely on falling and recovering. A temporary approximate controller model swept90 starting variations: t3.0/pace0.4 upper+exit kept all90 off the end drop, with minimum t≈2.51 and crossing height≈5.76m. This is not full-game proof. The model ignores Shades/hitstop and starts from a one-second trace sample; live GPU validation remains mandatory. The source geometry also has a0.2m gap from ramp side s11.8 to upper terrace s12.0, a manual-level defect to log separately rather than disguise with a teleport or abrupt controller change. Full critique: persistent artifacts/opus-r2-stair-design.txt.

If later narrow-turn failures appear, extend measured pacing deliberately rather than applying a broad speed override. Require tsc/fox build, Opus source critique and a fresh whole-route remote GPU retest with all existing acceptance gates. Review stair trot/foot sliding in captured frames; no animation/feel improvement claim from metadata alone.

## Manual R2 seam audit (23:22 ET; no geometry edit yet)

A source-only support probe using the actual `CollisionWorld`, main grounded/snap/vertical rules, brisk gravity27/fall1.5, and constant lateral seam-crossing velocity tested36 crossings at t2.2/2.7/3.0, speeds0.5/1/3.6/9m/s and30/60/120Hz. Existing2.6m width:18/36 reached the upper terrace; slow attempts fell to y2 and blocked against the y6 wall. Proposed3.2m width:36/36 remained supported (min feet5.565m). This is a simplified unit probe, not complete controller/gameplay evidence: it omits yaw, acceleration, elements, fox geometry and world dressing. Artifact source/results in route-clear-r2/artifacts/r2-manual-gap-probe.{ts,json}.

Options: retain if real full-controller evidence disproves risk; widen visible stair+matching collision by0.6m for0.1m overlap with the terrace; or author a visible supported top apron. Avoid invisible catch floors and controller step-height changes. Pending52343c3 remote capture stays pinned to isolate the already reviewed analog-pacing fix. Opus source critique of the manual seam is pending. No geometry implementation until that critique is assessed; any implementation needs its own build/remote review. R5 has a separate apparent0.5m side gap, while R6 explicitly has a visible landing apron; audit those independently before treating the whole route as manually safe.

The52343c3 follow-up preserves full stick magnitude on queued scripted dashes; pacing applies only grounded run frames, never dash/air/wait/manual input. Opus source review approved this behavior; no GPU acceptance yet.
