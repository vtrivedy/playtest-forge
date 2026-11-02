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

### Quiet audio redesign — research, 2026-11-02 (Tallow)

Vivek rejected the 34c7054 soundtrack as intrusive and constant (#swarm :1144).
Kit's correction in :1153 delegates listening to the team: main remains muted
until a teammate independently listens and agrees the redo is gentle and fitting.
Lowering master gain alone does
not address repetition, bright attacks, competing voices, or misplaced music.
These are source findings and proposed design criteria, not a listening verdict.

**What the references actually teach**

- **Alba:** Dan Pugsley, its sound designer/music mixer, describes removing birds
  embedded in ambience recordings, separate environmental biomes, and different
  attenuation for nearby shoreline and distant ocean. Most music was tied to
  quest events so environmental ambience had room; the team played the whole
  story to identify places to add emotion or strip music back. Application:
  clean wind without hidden bird calls, authored place-dependent levels, distant
  isolated wildlife, music for meaningful events rather than an endless playlist.
  [Creator case study](https://www.cassinisound.com/casestudy-alba).
- **A Short Hike:** Adam Robinson-Yu describes Mark Sparling's map-based score:
  instruments fade by location, strings join flying, brass responds to boat
  speed. Application: sound follows player experience and place; selecting two
  pleasant files and crossfading them forever is not equivalent. This source
  does not establish a numeric loudness or bird-density target.
  [Developer write-up](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/).
- **Ori:** Gareth Coker says gameplay informs momentum, visuals inform timbre,
  and a recurring theme/common instruments connect different places. His wooden
  Ginso Tree sounds belong to that environment. Application: a small warm paper,
  wood, breath palette matching our fox and painted autumn world; repeated
  bell/chime rewards should not become a second score competing with music.
  [Composer interview](https://vgmonline.net/garethcokerinterview/).
- **Spiritfarer:** creative director Nicolas Guerin distinguishes the score's
  subtle supporting role during relaxing action from leading at major moments.
  Composer Max LL describes developing variations from one early theme.
  Application: keep traversal understated and reserve the melodic statement for
  care/restoration; reuse a modest motif instead of unrelated tracks.
  [Director interview](https://www.gamedeveloper.com/design/inside-the-thoughtful-design-of-thunder-lotus-i-spiritfarer-i-),
  [Composer interview](https://www.kittyonfirerecords.com/blogs/cybercenter/spiritfarer-ost-interview-with-max-ll).
- **Silence:** LucasArts composer Jesse Harlin distinguishes player-caused and
  independent sounds; their balance gives player actions weight. Application:
  when idle, the world must leave space; do not fill gaps with more random sounds.
  [The Weight of Silence, Game Developer Dec 2010, printed p41](https://media.gdcvault.com/GD_Mag_Archives/GDM_December_2010.pdf).
- **Adaptive music:** Clint Bajakian's GDC 2010 slides distinguish states,
  finite segments, and junctures. A juncture need not cause a musical change;
  density, instrumentation, rhythm and intensity all affect transitions. A longer
  stereo crossfade alone cannot guarantee musical coherence. Application: one
  finite phrase per selected beat, with an authored ending and quiet afterward;
  suppress competing triggers rather than stacking cues.
  [Primary slides, pp13–22, 28–29, 54–55](https://media.gdcvault.com/gdc10/slides/Bajakian_Clint_Adaptive%20Music.pdf).
- **Journey/Ghibli references:** mood references are not measured specifications.
  The Journey-vs-Monaco GDC talk URL redirected to maintenance during this pass;
  do not claim to have watched it. No Journey or Ghibli loudness, crest factor or
  event frequency was measured here, and no reference recording is licensed for
  inclusion in our game by virtue of being a reference.

**Metering basis and proposed first listening candidate**

Garry Taylor's **2013** GDC slides describe BS.1770 loudness, distinguish true
peak from sample peak, give the historical Sony console reference of -23 LUFS
and maximum -1 dBTP, and call for at least 30 minutes of representative gameplay.
These are program-level engineering references, not proof of gentleness, current
platform certification, or per-effect targets. A 60-second clip is a mix sample.
[Primary slides, pp3–6, 10–12](https://media.gdcvault.com/gdc2013/slides/824764Garry_Taylor_Loudness_and_how.pdf);
[ASWG maintained standard repository](https://github.com/Sony-ASWG/Loudness).

The following are **authored starting targets**, to revise with Vivek's ear:

| Measure | First-candidate target | Why / limitation |
|---|---|---|
| 60 s full-mix integrated loudness | approximately -30 to -26 LUFS; never normalize automatically upward | Deliberately quieter than the historic program reference; gated loudness can omit quiet space |
| True peak | <= -6 dBTP design ceiling; always < -1 dBTP | More headroom for this gentle slice; peak ceiling alone says nothing about sharpness |
| Idle ambience | roughly -44 to -36 dBFS RMS over 50 ms blocks, with local variation | An engineering starting point, not calibrated perceived loudness |
| Wildlife | 0–2 calls/minute, >=20 s gap, one voice, distant | Count actual plays, including birds hidden inside assets; randomization cannot cure a busy recording |
| Music | zero at boot/idle; one 8–16 s phrase at a selected event, >=30 s between starts | At least half a typical minute without music; no cue backlog or permanent loop |
| Routine effects under music | event-window SFX RMS initially 6–12 dB below concurrent music RMS | Compare isolated bus stems over identical windows, not knob values; care cues may briefly lead |
| Crest factor | report whole-clip and active 50 ms peak-minus-RMS; investigate routine SFX >18 dB | Diagnostic flag, not a pass/fail standard; sparse silence inflates whole-clip crest |

Use decoded PCM for exact contiguous 50 ms windows: stereo sample peak, combined
RMS, dBFS, crest, and timestamps. Browser setInterval analyser snapshots can skip
transients and are not contiguous metering. Measure encoded delivery true peak
and LUFS separately; retain the unnormalized listening file. Report music starts,
wildlife calls, movement Foley and care cues separately per minute (footsteps are
expected to track movement). Save event timestamps and bus stems where possible;
one full-mix number cannot identify which sound masks another. Compare an idle
minute and an active minute, including trigger collisions and fades.

Before requesting approval: pin SHA and review-only unmute method, keep main
muted, decode the final 60 s clip successfully, attach meter/events, stills and
`window.__game`, and disclose staging/performance limits. Do not claim a musical,
warm, unobtrusive result from arithmetic. Use real audio understanding, compare
against gentle-game reference listening, and report heard intrusion, repetition
and music/effect balance. Per :1153, independent teammate listening agreement
permits branch unmute; Vivek then hears the landed result on main.

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

## Reading audio by eye (Moss)

- `python3 tools/spectrogram.py <audio> <out.png> [--marks evidence.json] [--from s] [--to s]` draws a log-frequency
  spectrogram (50 Hz–16 kHz, 10 ms columns) with a 50 ms peak/RMS lane and event marks. Look for: horizontal
  lines = sustained tones (drones, bells); vertical streaks = transients (clicks, flaps); a broadband haze that never
  goes dark = a constant bed; regular vertical striping inside the haze = an amplitude-modulated loop (e.g. a
  flutter). Gentle reads as mostly dark with short, low, isolated marks.
- `python3 tools/sfx-analyze.py` measures each SFX event as played (sample × gain × rate × bus): peak, active RMS,
  crest, spectral centroid. Brightness (centroid) is the quickest proxy for 'pokes out': raw Kenney bookFlip is
  6–8 kHz; low-passing to ~1.5 kHz and a 20 ms fade-in brings it to ~1 kHz.
- Capture the sfx bus directly (`window.__opening.ctx.audio.sfx.connect(dest)`) to get a stem while the master
  is muted (tools/sfx-capture.mjs).

## Feel lint (Moss)

- `npm run lint:feel` (tools/lint-feel.mjs) turns fixed bugs into rules over `src/opening`: no `1/60` in per-frame
  code (use dt), no `clamp(Math.atan2(...))` yaw (flips behind; use a damped side-holding turn), no heading from a raw
  per-frame displacement. Opt a line out with `// lint-feel: ok <reason>`. Add a rule whenever a bug is fixed.

## Coordination (Moss)

- Before building shared infrastructure someone else claimed, run `git ls-remote origin` and check for new branches (e.g. `sw3-flint-audio`): a teammate's work can be pushed to a side branch without a channel post. I built a duplicate audio graph for ~20 min before finding Flint's.

## Assets (Moss)

- Kenney (CC0) zips: the page's `data-download-id` → `GET https://kenney.nl/download-link/<id>` with `Referer: https://kenney.nl/assets/<pack>` returns a signed URL; without the Referer it returns nothing. Each zip has a License.txt (CC0).
- Import sound/texture files from `src/` with `?url` so the production build bundles them; the `/assets/` middleware only serves in dev.

### Computational audio review tool (Rook, 2026-11-02)

`tools/audio-understand.py INPUT --out DIRECTORY --provenance 'named SHA / reference'`
requires NumPy, SciPy, Matplotlib and FFmpeg (or imageio-ffmpeg). It produces
`diagnostics.png` and `analysis.json`: fixed-scale absolute spectrogram, contiguous
50ms mono RMS, spectral-flux attacks, frequency-band energy, active centroid,
2s chroma recurrence and RMS-envelope autocorrelation. Run `audio-meter.py` too:
mono spectral downmix values differ from stereo delivery peaks/RMS/LUFS.
Optional `--events events.json` accepts recording-relative `{time_s,kind}` rows,
reports per-kind counts/rates/gaps, and rejects timestamps outside the recording.
Optional `--music music.wav --sfx sfx.wav` compares aligned 50ms stem RMS. Stems
must share the same start; matching length alone cannot establish alignment.

First diagnostic: Moss64d5207 staged SFX-only capture, input SHA256
`6428d0cd11312656300a80e6b20349f997da78c025c838579eb63be9727e53fc`,
51.18s; `/captures/rook/audio-understand-64d5207/`. Stereo delivery meter previously
found -39.3LUFS, -10.1dBTP, -43.256dBFS RMS. Spectral analysis finds 37.5 generic
attacks/minute and median active centroid2556Hz; energy fractions: <150Hz36.7%,
150–500Hz32.4%, 500–2000Hz6.0%, 2–6kHz23.3%, >6kHz1.7%. These describe the
whole probe, including page sounds outside Moss's marked cues. They do not
isolate his effects. The diagnostic image shows repeated broadband pulses in
the quiet ~8–31s interval and a sustained low-frequency swell ~38–42s. These are
specific review candidates despite low integrated loudness; causal attribution
requires isolated stems or exact event trace. This is computational/visual audio
review, not a claim to have heard the clip or recognized bird calls.

Chroma similarity can be high for constant noise/rumble as well as repeated
harmony: do not label it loop detection. Generic attacks cannot establish bird
counts; use exact instrumented wildlife events and check embedded ambience
separately. Spectral centroid depends on active threshold, frequency range and
mix; no universal 2kHz ceiling follows from these numbers. Same settings and
source provenance are required for reference comparisons (Tallow owns those).
Validation: synthetic1kHz sine centroid within10Hz and >99% energy in500–2000Hz;
digital silence produces zero onsets, no active centroid or recurrence pairs.
No game runtime or mute policy changed; no new game-play or listening signoff.

### Matched reference recordings — Tallow, 2026-11-02 02:52 UTC

Actual audio comparison now uses `tools/audio-understand.py` (Rook fdd0123),
not verbal descriptions of reference games. Reproduce acquisition + analysis:

```sh
python3 tools/audio-reference-compare.py --out /tmp/audio-reference
```

Six public Apple/iTunes soundtrack previews, plus our two existing unscaled music
assets; first **29.9 s of each**, no normalization, same 24 kHz mono downmix,
FFT2048/hop512, fixed −90..−15 dB spectrogram scale. Preview positions within the
full songs are chosen by the store, not assumed to be song starts. These are
published OST masters, not recordings of gameplay. Sources are
[Alba OST](https://music.apple.com/us/album/alba-a-wildlife-adventure-original-game-soundtrack/1568790780)
and [A Short Hike OST](https://music.apple.com/us/album/a-short-hike/1473635430);
composer attribution Lorena Álvarez and Mark Sparling respectively.
Exact preview URLs, source hashes, decoded excerpt hashes and measurements:
`docs/reviews/swarm3/audio-reference/{manifest,comparison}.json`. Reference audio
stays outside the repo/game. Diagnostic images on captures volume:
`/reviews/tallow-audio-reference/` (one directory per title).

| Recording, excerpt | Mono RMS dBFS | Crest dB | Generic attacks/min | Median centroid Hz | 50ms RMS p90−p10 dB | Windows <−40dBFS |
|---|---:|---:|---:|---:|---:|---:|
| Alba — Along the Path | −16.7 | 12.6 | 182.6 | 377 | 3.6 | 0% |
| Alba — The Pine Grove | −15.5 | 14.2 | 208.7 | 261 | 6.8 | 0% |
| Alba — A Summer Night | −31.9 | 23.8 | 108.4 | 618 | 22.2 | 55.4% |
| Short Hike — Beach Buds (Short Hike) | −13.8 | 15.3 | 234.9 | 403 | 9.0 | 0% |
| Short Hike — Somewhere in the Woods (Short Hike) | −14.0 | 15.7 | 150.6 | 472 | 7.3 | 0% |
| Short Hike — Hello? | −23.6 | 22.0 | 86.3 | 603 | 18.7 | 3.5% |
| Our Hush Hamlet source | −16.8 | 17.1 | 138.5 | 456 | 19.6 | 0.3% |
| Our Apple Cider source | −16.0 | 17.2 | 184.6 | 877 | 31.1 | 12.9% |

Measured/visually inspected findings:

- **Reference choice matters more than a generic attack ceiling.** Pine Grove
  and Beach Buds have dense continuous arrangements and 209–235 detected attacks
  per minute. These include musical notes. A low wildlife budget must use exact
  call starts/gaps or isolated wildlife stems; do not compare it to spectral flux.
- **A Summer Night is the useful sparse reference for this redo.** Two broad
  low-frequency harmonic swells near 2 s and 19 s decay substantially, with long
  passages near −45..−50 dBFS between them. Over half of its 50ms windows sit below
  −40 dBFS. In Hello?, separate note attacks decay visibly and the upper spectrum
  is mostly dark. This suggests finite phrases with room after their decay,
  rather than reducing the master on an uninterrupted bed.
- **Our sources need arrangement decisions, not a blanket claim that they are
  too loud or bright.** Hush's first29.9s centroid456Hz lies among the references;
  full96s plot then develops a busy sustained texture after ~20s. Apple Cider's
  first29.9s actually has a larger p90−p10 range than all six references, but
  centroid877Hz is highest in this sample. These observations support selecting
  and spacing phrases, not rejecting tracks from one number. Gain reduction
  changes absolute levels but retains rhythmic repetition and relative decays.
- **Chroma recurrence is harmonic similarity, not repeated audio identity.**
  Pine Grove has a broad bright recurrence matrix too. Do not label it an obvious
  loop based on that. Envelope recurrence can flag a regular rhythm for closer
  inspection; exact loop schedules still come from runtime/source data.
- **No invented gameplay balance or bird cadence.** The OSTs contain no isolated
  gameplay stems/marks; their titles do not identify birds in the audio. Rook's
  aligned-stem option and exact `{time_s,kind}` event logs are the correct tools
  for those comparisons. A YouTube attempt was stopped by its bot/login check;
  official public preview acquisition succeeded without that route.

Verification: all eight matched analyses exited0; duration29.9s; diagnostic PNGs
reviewed for Summer Night, Hello?, Pine Grove, Beach Buds and full Hush. Python
compile passed. This is a programmatic/visual audio critique, not a real-time
listening claim or whole-game playtest. No runtime/mute changes in this slice.
