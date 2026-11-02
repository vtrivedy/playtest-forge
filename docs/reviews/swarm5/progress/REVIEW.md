# World progress and Album component review

Hazel, 2026-11-02. Component fixture only: these captures deliberately inject representative progress facts over the real default opening. They do **not** prove portals, world puzzles, earned abilities or save reconstruction in a shipped integrated route.

- `npx tsx tools/world-progress-check.ts`: PASS prerequisite negatives, repeat-event idempotence, visited/solved separation, save/reload, malformed payload normalization, fresh reset, storage denial/quota and listener removal.
- `npx tsc --noEmit`, `npm run lint:feel`, `git diff --check`: PASS.
- Playwright, real default `/` boot, WebGL/SwiftShader: 0 page errors. `window.__game.state()` captured at `/tmp/hazel-map-preview/state.json` with grounded finite fox spawn; progress fixture captured separately. Real stick input moved the fox from [-5.2,0,92.5] to [-3.869,.039,92.45]; real Tab input closed and reopened the Album successfully. Reproduce with `node tools/world-map-preview.mjs` while Vite serves port 5180.
- `album-1280.png` and `album-960.png`: visually inspected. Three world illustrations/palettes and three named puzzle nodes each. Visited-only Russetvale leaves Kiln empty; two Ashwater solves fill two Reed bands; Press capstone fills Maple and shows earned ability. Existing world post processing gently mutes the panel. Text remains legible at 960×540.
- Fix/retest: resizing the viewport and immediately rendering caused one invalid black capture (post-resize event race). Wait for resize, then render again; the retained 960 frame is the successful retest. This is fixture timing, not evidence about the separate GPU landing regression bar.

The closed-map `Tab · Album` badge is visible in the upper-right without colliding with the discovery teach line or fox; `closed-badge-960.png` reviewed after the badge fix.

Scene integration still required: create the progress store once at boot; mount `createPageMap(view, progress)` and invoke its `.step()` after camera update; call `enterWorld` from real portal routing and `visit/complete` from physical mechanism transitions; expose `progress.snapshot()` in game state. Physical Seedwell placements belong to the hub/portal scene owner. Catalogue names/ability labels require agreement with world builders before claiming final content.
