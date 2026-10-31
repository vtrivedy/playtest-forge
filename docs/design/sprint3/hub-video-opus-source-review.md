I found no blocking defects, so you can commit and then request the latest-main + floor + guard capture. That verdict comes from reading the source only: I didn't run, render or edit anything. GPU retry behaviour is still unverified, and this says nothing about art or the floor.

## Verdict: the requested fix is in; two small fixes are worth folding in first

**Predicate (`hub-black-frames.mjs:5-17`): correct.**
- It computes exactly the rule from the 1950 review: max RGB ≤ 3, or at least 99% of pixels below limited-range Y 20.5. It rejects bad shapes and wrong data lengths.
- The 20.5 cutoff fits both ffmpeg filters. As I read the FFmpeg source, `blackdetect pix_th=0.02` counts Y ≤ 20 as black, and `blackframe threshold=20` counts Y < 20. So at value 5 (Y ≈ 20.29), blackframe passes the frame but blackdetect fails it, and the precheck catches it. Value 6 (Y ≈ 21.15) is correctly treated as not black.
- The `>= .99` ratio matches blackframe's whole-number `pblack`. Your 100- and 101-bright-pixel fixtures land exactly on that boundary.
- Calling it "conservative" fits the threshold but not the sampling. `drawImage` scales 1920×1080 down to 480×270 by resampling, not box-averaging, and x264 can shift dark levels. So the guard can miss a frame that the audit later flags, and then no first-attempt bytes are saved for it. The design doc already says this is a precheck, not an identical replacement, and the independent ffmpeg audit still catches the frame. That's acceptable.

**Shared module (`:52-55`, `:153-162`): correct.** The browser imports the same file that Node imports at `:3`, from the tool directory, so the two can't drift apart. Decoding uses the MIME type passed by each caller (PNG for stills, `image/jpeg` for video frames). The 480×270 canvas is a fresh OffscreenCanvas with `willReadFrequently`.

**Invariant and retry: correct.**
- The clock (`fixed`, `timeMs`) is now part of the hashed pose (`:169`), so a shift in `gpuTime` changes the digest.
- `settleHubCompositor` adds 0 to `gpuTime`.
- The hub section boots with `fixedClock=true` (`:1288`), so the new requirement (`:205`, `:231`) won't fail by itself.
- All hub videos use the default `dt` of 1/60, which matches the settle render's `dt`.
- The ordering is right in both paths: stills rename the first file before the clock check, and video saves the original JPEG and its JSON before the `try`. The `catch`/`finally` blocks record `error` and `hostElapsedMs` for barrier timeouts, context loss, persistent black frames and drift.

**Encoder cleanup (`:351-396`): correct.**
- If the capture loop throws, the code ends stdin, waits for the close (the listener was registered before the loop, so the wait can't hang), renames the file to `-incomplete.mp4`, writes the failure JSON and rethrows. `finally` doesn't end stdin twice.
- A non-zero ffmpeg exit and an invalid ffprobe result are also quarantined.
- The final report summary keeps `hubVideoAttempts` and `hubStillAttempts`.

## Worth doing before commit (small)
1. **Provenance gap.** The predicate now lives outside `gpu-capture.mjs`, but `report.captureHelperSha` (`:69-70`) doesn't hash `hub-black-frames.mjs`, so a run doesn't record which predicate it used. Add a hash of the file from `new URL('./hub-black-frames.mjs', import.meta.url)`, the file that is actually served.
2. **Save the JPEG sooner.** At `:225`, `before=await hubStillInvariant()` runs before `fs.writeFileSync(preserved)`. If the invariant evaluation throws, the first black bytes are lost. Write the file first, then compute the invariant. This is unlikely to happen but costs one line to fix.

## Gaps to state, not fix
- **The still path isn't symmetric with video.** `captureStill` has no `try`/`finally`, so a barrier timeout or context loss on a still leaves `hub-still-attempts.json` without `error` or `hostElapsedMs`. The outer catch still records the stack in `report.failures`. Also, a still whose retry stays black is kept under its normal filename, with the failure pushed to `report.failures` rather than thrown.
- **One unrecovered video frame ends the run.** It throws, so the remaining hub videos and the orbit are never captured, though `report.json` is still written. This follows the "never substitute" rule, but it means a single bad frame on GPU takes all the later hub evidence with it. An alternative is to quarantine that one video and move on to the next. It's your call; it isn't a bug.
- **The digest misses render-side state.** It covers camera, fox, bones, state and clock. It doesn't cover state the renderer itself accumulates: frame-counter dither or jitter, post-effect history, particle buffers updated during render. An extra zero-step render could change pixels without the digest noticing. This needs to be checked on the GPU.
- **Wall time.** Every hub frame now sends a base64 1080p JPEG into the page and runs a 130k-pixel loop, across about 2,700 frames in three videos. The 1950 run was cancelled externally at 203 s, so budget for the extra time.
- **The fixtures prove control flow only.** `hub-video-retry.mjs` still stubs `screenshotPixels` and `hubStillInvariant`. It doesn't exercise `captureStill`, `markIncomplete` or the encoder path. The `liveClock` case doesn't check that the original was written or that the error was saved. The predicate fixtures separately prove the maths. Neither proves the native compositor barrier.

## Next step
Once the tsc/foxbuild run that's in progress passes, commit and request a capture of latest main + floor + guard on an immutable SHA, with the full hub shot list. Treat it as complete only if it has:
- a final report
- clean `blackdetect` and blackframe results for every hub video
- either no attempt JSON, or attempt JSON with the original bytes, `recovered: true`, matching digests and the recorded elapsed time
- no `-incomplete.mp4` files

Keep the 1950 baseline as failure evidence.
