# Fox Spirit — working knowledge

Keep durable findings here by topic. Name the tested SHA and evidence; separate source observations from played or watched results. This file records lessons, not outstanding-work approval.

## Page motion and attachment jitter

- Inspect the complete chase → catch → carried/collected → resting transition in uninterrupted motion. A stable homecoming page does not prove the runaway page is stable.
- Source suspects in the pre-fix page implementation included a near-player full fold at 11.2 Hz, yaw assigned from each frame's displacement, a winded glow at 20 rad/s, and an abrupt droop release. These were hypotheses reported in #swarm :949, not individually proven causes or a verified fix.
- Audit transform ownership before changing attachments. Tallow's Carry audit found no competing transform writer; do not change Carry blindly to solve a page animation defect.
- Feed real update dt through damping and retain a consistent turn side across the ±π rear-bearing boundary. Moss 7edfc46 resolved the fixed-1/60 idle creature head-damping source concern. An isolated 30/60/120 Hz calculation agreed after one second, but that arithmetic is not a watched rear-crossing motion test.

## Motion review and sampled stills

- Sampled stills miss oscillation, one-frame snaps, transition pops, and skating. Use them for composition and readability; watch continuous footage or inspect all frames around suspected transitions for stability claims.
- On homecoming 57a0fdf, 24 timed samples supported only a bounded stability-polish verdict. The subsequent 270-frame audit found the largest change at frames 119→120: the intentional fixed-lens-to-chase cut at 4 s. Identify camera cuts before interpreting frame-difference peaks as defects.
- That audit's first four fixed-lens seconds had grayscale 320×180 difference mean 0.359 and maximum 0.530. These are clip-specific observations, not universal pass thresholds. Evidence: `/captures/rook/homecoming-frame-audit-57a0fdf/` (`metrics.json`, fixed frame sheets, highest-motion neighbors).
- Label teleports and staged starts. Real keyboard control after a staged start verifies that segment, not an uninterrupted route or unfamiliar-player discovery.

## Capture throughput and hero timeouts

- Measure actual render throughput before scheduling long captures. Flint reported roughly 58 frames/minute and a Modal 1800-second timeout for default 3300-frame hero jobs (#swarm :921). At that speed 3300 frames needs about 57 minutes; the 30-minute job cannot finish. Reduce frame count/resolution or choose an appropriate runner; do not repeatedly submit the same impossible budget.
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
