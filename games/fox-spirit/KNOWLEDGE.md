# Fox Spirit — working knowledge

Keep durable findings here by topic. Name the tested SHA and evidence; separate source observations from played or watched results. This file records lessons, not outstanding-work approval.

## Page motion and attachment jitter

- Inspect the complete chase → catch → carried/collected → resting transition in uninterrupted motion. A stable homecoming page does not prove the runaway page is stable.
- Source suspects in the pre-fix page implementation included a near-player full fold at 11.2 Hz, yaw assigned from each frame's displacement, a winded glow at 20 rad/s, and an abrupt droop release. These were hypotheses reported in #swarm :949, not individually proven causes or a verified fix.
- Audit transform ownership before changing attachments. Tallow's Carry audit found no competing transform writer; do not change Carry blindly to solve a page animation defect.
- Feed real update dt through damping and retain a consistent turn side across the ±π rear-bearing boundary. Moss 7edfc46 resolved the fixed-1/60 idle creature head-damping source concern. An isolated 30/60/120 Hz calculation agreed after one second, but that arithmetic is not a watched rear-crossing motion test. The subsequent b24c9fe hare probe was reviewed across all 240 decoded frames: no visible side snap in either rear pass. That bounded fixed-lens result does not cover stag/heron or page motion; evidence: `/captures/rook/head-turn-b24c9fe/`.

## Motion review and sampled stills

- Sampled stills miss oscillation, one-frame snaps, transition pops, and skating. Use them for composition and readability; watch continuous footage or inspect all frames around suspected transitions for stability claims.
- On homecoming 57a0fdf, 24 timed samples supported only a bounded stability-polish verdict. The subsequent 270-frame audit found the largest change at frames 119→120: the intentional fixed-lens-to-chase cut at 4 s. Identify camera cuts before interpreting frame-difference peaks as defects.
- That audit's first four fixed-lens seconds had grayscale 320×180 difference mean 0.359 and maximum 0.530. These are clip-specific observations, not universal pass thresholds. Evidence: `/captures/rook/homecoming-frame-audit-57a0fdf/` (`metrics.json`, fixed frame sheets, highest-motion neighbors).
- Label teleports and staged starts. Real keyboard control after a staged start verifies that segment, not an uninterrupted route or unfamiliar-player discovery.

## Capture throughput and hero timeouts

- Measure actual render throughput before scheduling long captures. Flint reported roughly 58 frames/minute and a Modal 1800-second timeout for default 3300-frame hero jobs (#swarm :921). At that speed 3300 frames needs about 57 minutes; the 30-minute job cannot finish. The hero path reportedly ignored route-seconds and retained its default 110 s / 3300 frames; verify the effective frame count before submitting again. Reduce frame count/resolution or choose an appropriate runner; do not repeatedly submit the same impossible budget.
- Distinguish deterministic simulation time from wall time and playback rate. Rook's ruin motion probe used deterministic 10 fps frame capture at 640×360; identify those settings alongside the clip rather than implying real-time performance.
- Save `window.__game`, assertions, and errors before video encoding. An ffmpeg ENOENT in the ruin capture occurred after gameplay evidence was already saved; preserve that evidence and report export failure separately.
- Pin source while Vite is live. Changing a detached candidate during a curb replay triggered HMR and invalidated the run; rerun on an unchanged exact SHA.
- Share artifacts explicitly. Local `/captures` visibility and Modal volume visibility have differed between agents; provide the uploaded volume path and verify it exists before requesting review.

## Audio capture and review

- `tools/opening-audio-capture.mjs` (bec8d22) taps each AudioContext destination into one recorded review mix while preserving playback. It captures canvas VP8 + stereo Opus, a WAV export, metering, errors, and before/after `window.__game`.
- Record gameplay with real-time inputs. Freeze only outside the recorded interval for stills; an end-still wait once extended the measured audio from about 8 seconds to 17.9 seconds.
- Recorder smoke evidence: `/captures/rook/audio-recorder-final/`. Two running contexts, 304 meter samples, no silent samples, peak 0.02207, no page errors; decoded track 7.94 s stereo Opus, -41.2 LUFS, -33.0 dBFS true peak. This proves capture plumbing, not a good mix, audible spatial placement, seamless music, or event coverage.
- Metering and source audit cannot replace listening. Review a named runtime SHA with event coverage and a loop boundary before claiming music/SFX quality. Prefer a post-mix recording bus when the runtime exposes one, and use the rendered camera for the listener pose.

## Working agreement

- Vivek's #swarm :1027 replaces fixed pitch rounds, required two-vote verdicts, and single-channel coordination. Choose a useful split and focused channels; deliver fun, beautiful work proven on a named build and clip.
- Priorities from that message: page jitter first, then music and sound. Never touch main, use normal pushes, preserve others' work, and use freely licensed assets with recorded provenance.

## Local probes and captures (Moss)

- Run Playwright/SwiftShader probes one at a time: two at once starve each other and `page.screenshot` times out (30 s default, even 300 s in the smoke).
- Don't edit `src/` while a Vite-served probe is running: HMR can reload the page mid-route and the run dies or lies.
- A watcher like `until ! pgrep -f "<cmd>"` can match its own command line and never exit; wait on the output file or use `run_in_background` instead.
- Local mp4 without a system ffmpeg: `pip install imageio-ffmpeg`, then `imageio_ffmpeg.get_ffmpeg_exe()`; render jpg frames at 2 sim steps per frame for 30 fps.
- For motion proof, frame-diff a fixed-lens stretch (PIL `ImageChops.difference` mean per frame): spikes flag snaps; cuts show as one deliberate spike.
- Review lenses: park the fox ~1/3 of the way from the camera to the subject so the chase-cam occlusion fade never hides the subject.

## Scene authoring pitfalls (Moss)

- The chase-cam occlusion fade clones the materials of every root in `ctx.occluders`. Never parent decals under an occluder root (they get cloned and lose their own opacity control); push only the stone/solid meshes.
- Head or neck "look at the fox" via `clamp(atan2(...))` flips sides in one frame when the fox crosses behind. Damp the turn and hold the current side while the target is behind.
- Damping in idle code must use the real frame `dt`, not `1 / 60`, or it runs at refresh-dependent speed.
- `layout.ts` builds many consts with IIFEs; one that reads a const declared further down throws a TDZ error at module load. Declare in dependency order.
- The patch-paint toon converts unpainted surfaces to sepia whatever their emissive; things that must read in colour before the payoff (creatures, the kept page) use plain toon/basic materials.
- `field.restore` has a small shared slot budget (the Keeping and ruin use it); features shouldn't spend it.
- Collider surfaces are a max over all colliders: a creature that walks with `floorAt` will climb onto any box it passes (the deer pins its y on the crag for this reason).

## Assets (Moss)

- Kenney (CC0) zips: the page's `data-download-id` → `GET https://kenney.nl/download-link/<id>` with `Referer: https://kenney.nl/assets/<pack>` returns a signed URL; without the Referer it returns nothing. Each zip has a License.txt (CC0).
- Import sound/texture files from `src/` with `?url` so the production build bundles them; the `/assets/` middleware only serves in dev.
