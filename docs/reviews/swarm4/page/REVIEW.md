# Page release and production packaging

Runtime tested: **6f769d7f247e8b1fd189c677163a637f8f0f564b**. Verdict: **CLEARLY BETTER for the final page catch/release**, bounded to the evidence below.

The paper now settles at its own perch, opens to1.25x, and stays in the chase view through its fade. The previous5x/5.4m release left the frame; the first smaller fox-anchored candidate also approached the lens and was rejected. Three production variants selected the final1.2m perch-relative height. A soft radial halo replaces the rectangular backing.

## Played evidence

- `/captures/sorrel/page-final-production-v2/clip.mp4`:90 consecutive frames,6s,15fps,480×270, production Vite preview. Encoded and decode-checked. All90 retained frames inspected in `all-frame-sheet-1.jpg` and `all-frame-sheet-2.jpg`; no repeated sheet snap or attachment hitch observed across the catch, landing, unfolding and fade. Crop sheets are motion review, not whole-scene composition evidence; full frames remain in `frames/`.
- `evidence.json` alongside contains the85s input route, `window.__game`, errors and63 visible-sheet bounds samples. All samples stay inside3% viewport margin; top reaches NDC.85033 (about7.5% top clearance). Three catches at4.2667/17.8667/44.5167s, zero skips, page pinned home; no JS or failed HTTP requests. The route does not free every creature, so the well is not full.
- `/captures/sorrel/page-final-50ms/evidence.json`: same production runtime, 85s at50ms steps, three catches/zero skips/pinned home/no errors.
- `/captures/sorrel/page-final-replay/evidence.json`: recorded60Hz input tape replayed against the production runtime, exact rounded fox/page snapshots match every frame; zero mismatches. This is the determinism test; other runs do not independently prove determinism.
- 60Hz final jump .792m apex/.317s to apex/.633s air;4 dashes, last1.998m. Controller parameters unchanged. At50ms the same controller measures .713m/.300s/.600s and1.999m dash; no cross-dt equality claim.

Summary and clip hash: [verification.json](verification.json). Baseline evidence: `/captures/sorrel/page-baseline-trace/` and `/captures/sorrel/page-baseline-catch-rise/clip.mp4` on f866379.

## Regression structure

`page.hot.ts` preallocates fleck transforms and paint washes, uses a scalar perch search, clamps expired scales, reads the live player motion view and reuses its audio voice view. Dedicated seeded gameplay and cosmetic streams isolate dodges from fleck density. Manual-start URL prevents a variable pre-capture rAF step.

Shared `lint:feel` checks hot entrypoints, non-factory exports and local helpers, including AudioWorklet `process`/`this.method`. Fixtures reject the pre-fix bug classes; [lint-negative.txt](lint-negative.txt) shows 20 findings on old page source. Unknown external callbacks are skipped safely (Fern's crash regression + positive fixture). This is project syntax/local-callgraph checking, not an allocation proof for Three.js or WebAudio internals.

Production boot was genuinely broken: hardcoded model/texture `/assets/` URLs were served only by dev middleware and absent from the build. Vite `?url` imports now bundle all runtime model/texture references, including the default fox. The asset-path guard rejects that class (12 pre-fix findings in [dev-only-assets-negative.txt](dev-only-assets-negative.txt)). Existing files and licensing retained; no newly sourced assets. Provenance: `assets/LICENSES.md`, `assets/library/CREDITS.md`.

TLC RunawayPage passes 24 generated/9 distinct states; a kept-after-one negative invariant fails at the third catch (six-state trace). The discrete progression is unchanged; continuous geometry/camera are excluded. [Verification skill](../../../../.agents/skills/verify-runaway-page/SKILL.md) has the recheck command and scope.

## Reproduce

```sh
npm run lint:feel
npx tsc --noEmit
npx vite build --config games/fox-spirit/vite.config.ts
tlc -workers 2 -config games/fox-spirit/tla/RunawayPage.cfg games/fox-spirit/tla/RunawayPage.tla
node tools/page-motion-probe.mjs --out /tmp/page-proof --production 1 --seconds 85 --frames 1 --clip-from 43 --clip-to 49.2 --fps 15
node tools/page-motion-probe.mjs --out /tmp/page-50ms --production 1 --seconds 85 --dt 0.05
node tools/page-motion-probe.mjs --out /tmp/page-replay --production 1 --seconds 85 --replay /tmp/page-proof/evidence.json
```

Only the initial wake position is staged; movement thereafter uses the input hooks. Capture is offline fixed-step, without audio. It is not real-time performance evidence, a gait verdict, an audio judgement, or acceptance of the expanded map/finale. One30fps render was terminated before final trace; it is not counted. The rerun streams partial traces and writes final evidence atomically;15fps completion is the accepted clip.
