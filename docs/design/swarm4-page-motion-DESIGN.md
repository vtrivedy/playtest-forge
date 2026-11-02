# Runaway page — stable motion and a readable release

The page should feel like one loose sheet: readable folds, a deliberate turn, a continuous catch arc, then an unhurried release. Preserve the existing three-stage pursuit and move/jump/dash controls.

## Final release

Anchor xz at the page's catch location and y at its walkable perch. Ease from the caught pose into a small float (+1.05m → +1.2m), opening from1x to1.25x. Keep the existing4.5s fade and spreading world paint. A radial alpha falloff softens the amber halo. The player can land or turn without dragging the expanding sheet.

Baseline f866379 enlarged the page5x and raised it5.4m over the moving fox, leaving the chase view before its release finished. A first smaller fox-anchored attempt still brought the sheet too close to the lens after landing. Anchor the reveal at the sheet, then keep the entire outline visible.

Production variants on1f4b805 (release+2s, page-catch anchor):

| Variant | Height above perch | Scale | Projected top (NDC) | Result |
| --- | --- | --- | --- | --- |
| Low/wide |1.0m|1.4x|.697|Fits; lower edge approaches ears|
| Middle |1.2m|1.25x|.794|Chosen: readable with space above fox|
| High/small |1.35m|1.15x|.875|Fits; less top margin|

These stills select composition; the final continuous catch/landing/release must pass projected bounds throughout, not only at the held pose.

## Runtime contract

Touched runtime lives in `page.hot.ts`. Allocate fleck matrices/quaternions/Eulers/scales and the three paint washes during build. Select the next perch with a scalar loop. Clamp expired particle scales to zero. Read a live `player.motion` scalar view, never the allocating diagnostic `state()` snapshot. Reuse one page voice view for audio.

Gameplay dodge and cosmetic fleck RNG use separate seeded streams. Cosmetic density must not change the next dodge. `?manual=1` prevents a variable startup rAF step before capture tools take control. This bounds repeatability to the page/player replay; it does not promise that every unrelated ambient system is deterministic.

`lint:feel` traverses hot frame/update/tick/process callbacks and called local helpers, including AudioWorklet methods. It rejects explicit allocations, allocating collection methods, unseeded random, diagnostic snapshots, fixed frame dt, bare atan2 heading assignments, and unclamped particle lifetime scales. Setup allocations and cold diagnostics remain allowed. Negative fixtures run with every lint invocation.

## State and packaging checks

TLC `games/fox-spirit/tla/RunawayPage` checks catch accounting, absorbing kept state, and eventual completion under fair catch/fling actions. Negative kept-after-one invariant must fail. Continuous movement, timing/reach geometry and camera composition require actual play.

Runtime models and textures use Vite `?url` imports. The old dev-only `/assets/` middleware hid absent production GLBs; the production output must contain the fox it displays. A source guard rejects new absolute `/assets/` literals in game code. Existing asset provenance remains in `assets/LICENSES.md` and `assets/library/CREDITS.md`.

## Acceptance

Named SHA; full input-driven production chase/return; continuous catch/release clip and screenshots; `window.__game`; 60Hz and50ms trigger replay; exact tape comparison; projected visible-sheet bounds; tsc/vite/lint/TLC green. Record limits: initial wake spot staged, offline fixed-step render, no real-time performance or audio verdict from these clips.
