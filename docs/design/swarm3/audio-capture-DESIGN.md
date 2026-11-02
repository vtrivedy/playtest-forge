# Live opening audio review capture

Record actual Web Audio output alongside the rendered game canvas, after first-input
unlock. Install a test-only AudioNode connection tap before game boot; bridge every
context output into a shared recording mix so separate creature/game contexts are
included. Preserve the original destination connections for normal playback. The
capture graph never ships in the game.

Use real-time keyboard input, retain screenshots and window.__game state, report
peak/RMS and silence intervals from the captured mix. Save WebM with an audio track,
then use ffmpeg loudness analysis and listening for the human/teammate verdict.
Metrics detect clipping and gaps, but do not substitute for listening or prove
seamless music by themselves. Short scripted keyboard segments are disclosed;
no staged Keeping completion or full route claim.

## Rejected-mix redo measurement (2026-11-02)

The browser analyser snapshots overlap and leave gaps. For the redo, decode the
saved delivery audio to stereo float PCM at 48 kHz and measure every sample in
consecutive 50 ms windows, including the final partial window. Export JSON and CSV
with channel peak/RMS, stereo peak/RMS and crest factor. Silence is null dBFS,
never a finite loudness reading. Keep FFmpeg's EBU R128 integrated loudness, LRA
and oversampled true peak separately; 50 ms RMS is not LUFS or true peak.

`python3 tools/audio-meter.py live.webm --out /captures/rook/meter` writes this
report, the exact command/version and input SHA256. Optional `--evidence` consumes
the capture's before/after audio counters and reports per-minute deltas, explicitly
excluding uninstrumented synth/loop events. Reject decreasing counters instead of
mistaking a scene reset for negative events. No automatic artistic pass/fail.
Program/active-window crest are separate so long silence cannot inflate a claim
of healthy transient dynamics. The report labels the decoded codec delivery;
capture a lossless post-mix WAV too when evaluating the graph before encoding.

Run with Vite already serving default opening:

```sh
OUT=/captures/rook/audio-live SECONDS=60 node tools/opening-audio-capture.mjs
```

`URL` overrides the local server. Outputs: start/end screenshots, live.webm,
evidence.json with before/after game snapshots and timed key segments. Stills
briefly freeze the simulation clock to avoid software-render screenshot starvation;
the keyboard segment runs on the live clock. Resolution is 640×360 for local
software-render smoke, not a hero visual-quality capture. Use a GPU environment
for smooth deliverables. Audio peak samples are diagnostic, not a true-peak meter.

Extract and check the actual encoded track with ffmpeg:

```sh
ffmpeg -i live.webm -vn -acodec pcm_s16le live.wav
ffmpeg -i live.webm -vn -af ebur128=peak=true -f null -
```

Keep the WAV available for teammate listening. Do not label a capture reviewed
until the audio track is decoded successfully and an actual listening verdict is
recorded. The recorder adds no copyrighted audio and needs no asset credits.
