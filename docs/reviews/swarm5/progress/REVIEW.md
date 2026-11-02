# World progress and Album component review

Hazel, 2026-11-02. Component fixture only: these captures deliberately inject representative progress facts over the real default opening. They do **not** prove portals, world puzzles, earned abilities or save reconstruction in a shipped integrated route.

- `npx tsx tools/world-progress-check.ts`: PASS prerequisite negatives, repeat-event idempotence, visited/solved separation, save/reload, malformed payload normalization, fresh reset, storage denial/quota and listener removal.
- `npx tsc --noEmit`, `npm run lint:feel`, `git diff --check`: PASS.
- Playwright, real default `/` boot, WebGL/SwiftShader: 0 page errors. `window.__game.state()` captured at `/tmp/hazel-map-preview/state.json` with grounded finite fox spawn; progress fixture captured separately. Real stick input moved the fox from [-5.2,0,92.5] to [-3.869,.039,92.45]; real Tab input closed and reopened the Album successfully. Reproduce with `node tools/world-map-preview.mjs` while Vite serves port 5180.
- `album-1280.png` and `album-960.png`: visually inspected. Three world illustrations/palettes and three named puzzle nodes each. Visited-only Russetvale leaves Kiln empty; two Ashwater solves fill two Reed bands; Press capstone fills Maple and shows earned ability. Existing world post processing gently mutes the panel. Text remains legible at 960×540.
- Fix/retest: resizing the viewport and immediately rendering caused one invalid black capture (post-resize event race). Wait for resize, then render again; the retained 960 frame is the successful retest. This is fixture timing, not evidence about the separate GPU landing regression bar.

The closed-map `Tab · Album` badge is visible in the upper-right without colliding with the discovery teach line or fox; `closed-badge-960.png` reviewed after the badge fix.

Scene integration still required: create the progress store once at boot; mount `createPageMap(view, progress)` and invoke its `.step()` after camera update; call `enterWorld` from real portal routing and `visit/complete` from physical mechanism transitions; expose `progress.snapshot()` in game state. Physical Seedwell placements belong to the hub/portal scene owner. Catalogue names/ability labels require agreement with world builders before claiming final content.

Physical marker follow-up: `seedwells-960.png` is an isolated lit PBR/post-processing component fixture (not their final hub placement). Empty Kiln, two-band Reed and full Maple with water/leaf read distinctly. Plaques gained wooden supports and wells cast soft shadows; optional placement yaw faces signs toward the authored approach. Default-world attempt was occluded by existing buildings, so that failed placement fixture is not retained as a successful hub review. Final hub placement must be reviewed on the integrator's build. The repeatable preview now includes this isolated well frame. Catalogue Ashwater develop name updated to Cedar's Reed Pond.

## Invitation scope integration — ee49c473

Merged Maple ffdca486 before applying the narrow world guard. `worldAt` must narrow to the literal `russetvale` before calling the autumn invitation update; its parameter type makes removing that guard a compile error. Foreign worlds hide the invitation meshes and stop offering autumn hints; they do not set `done`, alter catch count or weaken the grounded-overlook token.

- `npx tsc --noEmit`, `npm run lint:feel`: PASS (160 authored world anchors).
- TLC Discovery: 112 generated / 38 distinct, no errors. TeachOrder: 4 / 4, no errors. Temporary negative Discovery without onOverlook fails DoneAfterLanding in the expected five-state trace; temporary early-Publish TeachOrder fails LatestOfferWins.
- `node tools/world-discovery-scope.mjs`: PASS actual default boot → developer travel diagnostic autumn/Ashwater/Press/autumn-return; initial Follow visible, invitation and Follow absent in each foreign world after fade, initial Follow returns in autumn; 0 JS errors. Full game state and four inspected PNGs at `/captures/hazel/world-discovery-scope-ee49c473/`. This diagnostic deliberately uses developer travel and does **not** prove portal accessibility. Rain marsh and pale snow have clearly distinct frames; fox remains readable.
- Full 90 s input-only cue replay is running at `/captures/hazel/world-discovery-ee49c473/`; no complete-route PASS claimed here until its evidence finishes.

The Album preview fixture now sends its own synthetic Tab events through a separate EventTarget, avoiding duplicate window listeners after native integration. When a native Album exists it additionally verifies its real keyboard Tab open/close before building the component fixture.

Post-integration preview retest: `node tools/world-map-preview.mjs` completed with `errors:[]`, component close/open true, and `nativeRealKeyboard:true`. The integrated native Album passed real Tab open/close before the representative-facts fixture was mounted. This avoids testing two window-bound Album listeners accidentally.
