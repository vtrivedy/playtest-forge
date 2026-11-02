# Russet Vale — working knowledge

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

## Ruin camera composition and capture routes

- Separate the old static ending from a new route failure. On5e07e9e, the original110s capture held the ruin view for about61s after completion; independent late traces showed no boom/floor fault. On ca7bafe/db277f7, the new eastward return dash coasted off the overlook, then the script walked into its raised side indefinitely. The reproduced late view reached69.106° down with2937/3000 late frames blocked. It was not cleared by the older clean camera trace.
- Preserve movement physics when fixing a capture path. b6b5c82 uses the same dash on the overlook's diagonal runway and waits for the actual return latch. Full input replay:4651frames/77.517s,3 catches/0 skips, all3 folds open, return1, finalgrounded atwell, pinnedpage, no logged errors. Late lens-to-chest angle max27.596°, floorLift0;33 blocked frames at the gate. Groundjump apex0.792m/tApex0.317s/air0.667s retained;4 dashes, finaldash1.998m. Evidence: `/reviews/rook-ruin-homecoming-b6b5c82/` on keeping-swarm3-captures. Continuous6s/180-frame exit evidence is `/reviews/rook-ruin-exit-b6b5c82-motion/`; Rook and Tallow independently inspected all retained frames and accepted the bounded return correction (CLEARLY BETTER), without a real-time playback/global gait claim.
- View corridors are coupled. Moving the maple from(-22,74) to(-19.2,70.6) cleared the ruin entry but blocked the overlook vista. Moving it north toz64.8 was only MARGINALLY better: another crown remained. Shifting decorative arch remnants from the near west edge to the far east edge freed foreground room, but the horizon still has trees. Do not claim these bounded improvements make the entire place BEAUTIFUL.
- Captures need an authored end. `createSliceRoute` now exposes `complete` after4s at the homecoming; `lookdev-play-smoke` stops, saves the final still/state, and reports actual duration/frame count. The requested duration is an upper budget. The route visits the pinnedpage/well; it does not rescue every creature or claim five-lit homecoming. Its current final frame keeps the fox comfortable but leaves the pinnedpage offleft.
- A staged start is an iteration aid, not full-route evidence. `tools/ruin-return-probe.mjs` uses the same route with a named starting beat and stages only initial overlook position. Its5/5 result established safe return geometry quickly; the full village replay above supplied acceptance. Commit before launching, or explicitly distinguish the loaded runtime SHA from a git HEAD sampled later.

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

### Hearthsong: synthesized adaptive music (Ember, swarm4, 2083b89)

- Music is one AudioWorklet (`src/opening/music/hearthsong.worklet.hot.ts`) playing a text score (`score.ts`). The
  worklet owns the clock and sequencer (sample-exact, no main-thread timers); the main thread only eases ~10
  k-rate AudioParams (`music.hot.ts`). Cues are AudioParam counter bumps (+ a `kind` param), not postMessage.
- Vite: `import url from './x.worklet.hot.ts?worker&url'` then `ac.audioWorklet.addModule(url)` works in dev and
  build (emits `assets/x.worklet.hot-*.js`). Declare `sampleRate`/`registerProcessor`/`AudioWorkletProcessor`
  locally in the worklet file (not in lib.dom).
- Offline listening loop: `node tools/hearthsong-render.mjs --out DIR --seconds 300` renders a scripted walk via
  OfflineAudioContext in ~30 s (the shipped worklet; driver calls take an explicit schedule time). Iterate
  composition there, then confirm in-game with `tools/mix-capture.mjs` (`__game…audio.music` shows bar/swell/ending).
- TLA `tla/Hearthsong.tla` caught a real spec bug on first run: two `since'` assignments in one branch made Bar
  disabled → stutter counterexample to liveness. Unbounded finale ForceCue also broke `SwellRests`: bounded by
  MaxForce (and the worklet enforces the same bound).
- Qwen2-Audio as critic: ask "describe as a music critic … flaws such as harsh/thin, mechanical timing, out of
  tune, clashing, repetition". The sparse sepia opening read "eerie, dissonant, flat"; a pitch check
  (`/tmp/ember/notes.py`-style FFT peaks per bar) showed notes were in tune and in the right chords, so the cause
  was texture. Warmer floor (pad+harp), humanized onsets (≤25 ms), phrase-end rubato (+9 % on the 4th bar) and a
  0.07 Hz breathing pad → "calming, dreamy, no flaws". One answer per window is noisy: compare versions on the
  same windows, and keep a reference (Alba preview) in the batch.
- Spectral references (iTunes previews, Alba / A Short Hike): 150–500 Hz holds 70–80 % of energy in Alba's
  gentle cues, 500–2 kHz 4–16 %, centroid 260–680 Hz. Hearthsong sits at 75–80 % / 5–12 %, centroid 270–340 Hz.
- Levels on the 60 s route (455932c): mix −33.5 LUFS, music stem −33.6, sfx −40.9, TP −20 dBTP; music never below
  −60 dBFS for more than ~1.5 s (was 31 s of 54 with the phrase design).
- Key: C major. Keep every synthesized chime in C (glyphs, page, homecoming already were); the hearth hum's B1 was
  moved to C2.

- Staged in-game listening: `node tools/audio-scene.mjs --scene millbrook|finale --out DIR --seconds N` (teleport /
  dev hook, sim paced to wall clock, pre-master stems + marks of swell/ending/finale phase each second).
  Finale (local integration of all sw4 branches, 06:25): kindle → swell; coda ~44 s; digital silence ~60 s; then
  epilogue after QuietBars. SwiftShader capture boxes drop ~5–20 % of ScriptProcessor audio under render load
  (73 s recorded in 90 s wall) — a capture artefact present before Hearthsong too; don't read it as stutter.
- Critic vocabulary → cause, found by A/B on the same window: "theremin" = 30 ms legato glide + early vibrato
  (fix: 8 ms glide, tongue each note, vibrato after 0.4 s); "digital beeping" = 40 ms sine bubbles (few-ms
  chirps read as water); "whip/sword strike" = a 0.35 s noise sweep to 1.8 kHz; "harsh/distorted" = FM bells at
  ratio 3.5 / index 1.6 (ratio 4, index 0.8 = celesta); "ticking clock" = 6 ms-attack footsteps at a steady gait.
- The model hallucinates (a "male voice", "alarm") on noise beds; confirm any flaw on the spectrogram before acting.

- Place tunes: a `SONG.tunes` entry with `places: [...]` is taken at the next pass start while one of its places
  leads (weight > 0.5), never twice running, alternating with the shared rotation. Add new regions' places to
  `PLACES` and, if they deserve it, a tune. 15-minute offline render: stable level (−34…−30 dB RMS/min), no NaN.

- Model ↔ code conformance: `npm run check:music` renders the stress walk offline and checks every worklet
  bar-line report against the TLA spec's rules (render.ts `checkTrace`). Mutating the worklet (drop the gap
  check) fails it; the first run caught a checker bug instead (an armed swell legitimately waits across a breath,
  so judge the start against the state before arming). Run it after touching the conductor.

- Capture taps: ScriptProcessor stem taps run on the main thread; on a loaded SwiftShader box they drop buffers
  AND loop stale ones (a 15 s periodic "buzz" + ±25-cent ghost pitches in a grand-route capture that the offline
  render of the same walk never had). Use `tools/lib/stem-tap.mjs` (AudioWorklet tap, batched port messages):
  the same route recorded clean. Check a suspicious capture against `hearthsong-render.mjs` before blaming the synth.
- Grand tour (`millbrook-walk.mjs --route grand --audio`, village → Hermitage → Millbrook → lookout, 146 s):
  −33.1 LUFS, LRA 6.2 LU, −19.5 dBTP, never below −60 dBFS; sfx −39 LUFS; critic per 30 s window: calm,
  soothing, nothing aggressive or repetitive.

### Catch/trigger tests at real-time frame rates (Flint, 2026-11-02)

- Probes step a fixed 1/60; Kit's live capture runs rAF with dt up to 50 ms. Two page bugs only showed there: a
  timed window (the winded sag) expired mid-leap so the page bolted from under the landing fox, and a point-in-time
  reach test missed a fox that crossed the 1.35 m reach between two frames. Fix pattern: refresh timed windows on
  the player's committing action (the leap), and test proximity swept along the step's path, counting "airborne"
  at either end of the step. Replay any route with `advance(1, 0.05)` before calling a trigger robust.

### Machine listening and the full-mix capture (Flint, 2026-11-02)

- `tools/mix-capture.mjs --out DIR --seconds 60`: plays the no-teleport slice route with the sim paced to the wall
  clock and records the three **pre-master** stems (music / ambience / sfx) sample-for-sample, so it works while
  `MIX.master` is 0. Writes `stem-*.wav`, `mix.wav` (stem sum, unity master, pre-limiter), `meter-50ms.json`,
  `events.json` (every one-shot + music cue, recording-relative) and per-minute counts. Feed it straight into
  `tools/audio-understand.py mix.wav --music stem-music.wav --sfx stem-sfx.wav --events events.json`.
  Pull big PCM out of Playwright as base64 int16 per channel — JSON float arrays of a minute of 6-channel audio
  exhaust the node heap.
- `modal run tools/audio-listen.py --path a.wav[,b.wav] [--window 10]`: Qwen2-Audio-7B-Instruct on an A10G
  describes each window. **Ask neutrally.** With a checklist prompt ("birds, wind, footsteps…") it reported birds
  and footsteps in a solo harp track; with "describe only what is really present" it called the harp a harp, heard
  the old mix as "music loud, covers the spectrum… birds four times… an increasing drone" (matching Vivek and the
  hum/crackle bed Moss found), and heard the redo's paws as regular "generic impact sounds". It is poor at timing
  (says "music throughout" for a window that is half silence) and hallucinates occasionally (a "male voice").
  Use it for *what* is audible and how it reads, never for *when*/how loud — that is the meter's job.
- Field recordings hide things: the CC0 park "wind" recording carried birds and, once low-passed, read as an engine
  to the model (traffic rumble). The redo synthesises wind instead. Isolate bird calls by 2–8 kHz energy peaks
  ≥14 dB over a running median with nothing else within ±1.5 s, then denoise (ffmpeg `afftdn`) and high-pass.
- Our capture tool's wait loop once uploaded an MP4 while ffmpeg was still writing it (no moov atom): wait for the
  process to exit, not for the file to appear, and decode-check after a volume round trip.

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

## Ruin camera clearance — Fern, swarm4

- Seed `f866379` already contains `f3ddb6f`'s lens recovery; do not repeat the
  original head-penetration fix. Its remaining review request is pounce margin.
- On `f866379`, the current 30Hz 90s input route succeeds: three catches, zero
  skips, page pinned home, no errors. Late minimum chest distance 2.013m,
  maximum pitch24.66°, maximum lens speed19.00m/s. Evidence:
  `/captures/fern/baseline/evidence.json`. Final jump .750m apex/.300s to apex/
  .633s air; four dashes, last dash2.132m. This is scripted play, not human fun.
- Reproduce the failed-catch geometry intentionally with
  `tools/camera-drop-probe.mjs --miss-overlook`: it omits jump while walking
  toward the overlook, then permits genuine pounce retries. No page state is
  forced. At1.2m, the late camera gate passes (1.233m/59.10°/10.80m/s), but the
  view is tight. `/captures/fern/miss-12/drop.webm` retains64–68s at15fps, plus
  all60 source frames; inspect complete pounces, not only timed stills.
- `78ab7db` extracts the existing candidate search to `cameraEnvelope.hot.ts`.
  Its workspace and helper closures are constructed once; the hot update reuses
  them. `cameraCollider.hot.ts` removes the controller's per-sphere `.some` /
  `.map` temporary arrays, while preserving its nine footprint samples.
- `CameraEnvelope.tla` models only the discrete publication pipeline: floor
  adjustment precedes the follow-envelope check; authored shots bypass it.
  TLC checks9states. Removing the envelope call/guard violates FollowChecked
  in5states. It does not prove the geometric search finds a clear pose, nor
  silhouette, world visibility, continuity, or pitch. Recheck via
  `.claude/skills/camera-envelope-check/SKILL.md`.
- Long capture sessions can terminate before final JSON is written. Keep
  periodically replaced `checkpoint.json` marked `complete:false`; require a
  final evidence file and clean DONE for a completion claim. `--sparse-stills`
  skips unrelated early images while keeping every simulation step and trace.
- The envelope's supplied scenery callback still uses Three.js raycasts, whose
  library internals allocate hit records. The extraction removes project-side
  temporary candidate closures and collider query arrays; it is not a claim of
  a completely allocation-free renderer or camera stack.
- Final runtime `4ef7d74` chooses1.5m minimum body clearance; normal2.45m boom
  remains. Complete90s30Hz success and missed-jump replays both pass. Late failure
  range1.559m/pitch48.77°/speed10.75m/s versus1.2m's1.233m/59.10°/10.80m/s.
  All60 failure and90 success clip frames retain2% viewport margin for projected
  skinned geometry; complete source frames reviewed for flame tips and walls.
  Final success3catches/0skips/page pinned. Evidence:
  `/captures/fern/final-{success,miss}-4ef7d74/`; full scoped review and reproduce
  commands in `docs/reviews/swarm4/fern-camera-4ef7d74.md`.
- The hot AST gate must accept unknown external scalar callbacks without crashing:
  guard an absent function node before calling TypeScript's `isIdentifier`.
  Positive external-query fixture plus existing negative allocation fixtures cover
  this bug class. Cross-module callback bodies and library internals remain outside
  this local call-graph check.
## Free camera release continuity — Fern, swarm4

A clear destination is not a clear connecting segment. Full staged finale route on c330e89 exposed lens release steps1.024m leaving the crag and2.444m on return to meadow. Checking only blocked candidate motion leaves the free-pose early return unconstrained; limiting direct release but falling back to the destination when the intermediate segment is blocked is also wrong. cff7a25 keeps the escape search active until swept gradual release is safe, with12m/s release bound selected over16m/s. Full affected route and ruin success/intentional miss pass (integration2afb162); see docs/reviews/swarm4/fern-finale-cff7a25.md. Regression checks now run under lint:feel at30/60/120Hz and fail against the previous solver. The nine-state CameraEnvelope model verifies ordering only, not this continuous geometry. Emergency relocation can still exceed the release bound when no continuous safe pose is available.
## World expansion and render budget (Bramble, swarm4)

- The playable world is a union of shapes, not one ellipse: `groundH` = lerp(bowl base, `westBase`, `westK(x)`)
  + smooth-min(bowl rim, `westRim`), with Wren's `vistaCut` applied last. Add a region by adding a shape to
  `westE` (metres outside, negative inside) — rim, rim trees and grass masks follow automatically.
- There is no hard world boundary: any slope under ~4 m/m is walkable (controller step 0.22 m per frame at
  3.2 m/s). A place "reachable only by glide" needs column/cliff sides ≥ 1 m above every reachable
  neighbour, not just height above the valley floor.
- Two ground sheets that overlap z-fight (each triangulates groundH differently). Abut sheets on a shared edge
  (bowl sheet x ≥ −64, Millbrook sheet x < −64).
- Triangles, not draw calls, dominate SwiftShader time: leaf-card InstancedMeshes were ~1.1 M of the bowl's
  1.3 M spawn triangles (renderer.info). `tools/world-stills.mjs` prints calls/tris per still; `--pre` runs JS
  first (e.g. a tri breakdown by top-level group). Far scenery: `buildMaple(..., detail)` coarser lobes and
  `bakeCells(..., thin)` keeps every n-th card.
- `bake.ts` merges static props per material (toon materials carry a `userData.lk` key from patchPaint).
  ~30 meshes per maple → ~7. Never bake an occluder group together with others: the chase-cam fade works per root.
- Local SwiftShader screenshots of the west cost ~1.3 s each at 640×360; sim+render without readback is
  ~5–10 ms/frame (`tools/perf-probe.mjs`). Budget input-route clips accordingly (~16× slower than real time).
- `pkill -f <name>` from a Bash tool call matches the tool's own command line and kills it (exit 144). Use
  `pgrep -af` and kill by pid.
## Page hot-path audit and release framing (Sorrel, swarm4)

- Baseline `f866379` full input replay: three catches at 4.267/17.867/44.517s, zero skips, returned home; no JS errors. Jump .792m apex/.317s to apex/.633s air, final dash1.998m. Evidence `/captures/sorrel/page-baseline-trace/evidence.json`. Only the initial wake spot is staged.
- Continuous baseline 43–48s (150 frames, 480×270) is `/captures/sorrel/page-baseline-catch-rise/clip.mp4`. The final page grows5x and rises5.4m above the moving fox, leaving the chase view before its release fade. This is an offline fixed-step motion capture, not a real-time performance claim. Sampled sheets establish framing only; inspect adjacent frames for jitter.
- `player.state()` is an allocating diagnostic snapshot (rounded arrays, paws, camera). Gameplay frame code should read `player.motion` for live grounded/dashing scalars. Page audio voice is now one reusable live view too. Do not reinstate snapshot calls in hot paths.
- Hot lint follows named local helpers reached from registered frame callbacks and update/tick/frame functions; moving `new` into emit/caught does not evade it. Setup allocations and cold dev snapshots are permitted. `docs/reviews/swarm4/page/lint-negative.txt` records its findings on pre-fix page source; fixture negatives run on every lint invocation.
- `?manual=1` starts the opening without a first rAF simulation step; capture tools must use it for exact replay comparisons. Calling setManual only after ready leaves a variable number of startup frames.
- Page dodge RNG has a dedicated seeded stream separate from cosmetic flecks: changing particle density must not change the next gameplay dodge. This makes page pursuit repeatable, not the entire game's unrelated ambient systems.
- TLC page model passes 24 generated/9 distinct states. Broken kept-after-one invariant fails at catches3 (six-state trace). Scope excludes continuous space, timing/reach geometry, camera, and debug stage resets; formal pass is never motion acceptance.

### Final page proof and production assets — Sorrel,6f769d7

- Final release anchors at the **page's** catch xz and its walkable perch, not the fox's catch pose. The rejected fox anchor brought the sheet toward the lens after landing. Chosen from three production variants: +1.05→1.2m,1→1.25x, radial halo, existing fade timing. It stays fully visible through the release.
- Production85s input route on6f769d7:3catches/0skips/page pinned home/no JS or HTTP errors;60Hz jump .792/.317/.633 and dash1.998m unchanged.50ms route passes too. Exact tape replay matches rounded fox and page state on every frame (zero mismatches).
- Motion evidence `/captures/sorrel/page-final-production-v2/clip.mp4`:90 consecutive15fps480×270 frames; all inspected in two adjacent-frame sheets.63 visible-sheet projected bounds samples pass3% margin (maxNDCy .85033). Scope: initial wake staged; offline/noaudio; no real-time performance/global gait verdict. Review + compact evidence: `docs/reviews/swarm4/page/`.
- A successful Vite build did **not** mean production could boot: default fox/model textures used raw `/assets/` URLs served only by configureServer. Import runtime assets with `?url`; the production preview now loads the bundled GLB. The new guard rejects absolute asset literals (12 negative findings). No new assets; existing source/license records retained.
- When captures are interrupted, a final-only JSON loses the useful trace. The page runner now streams partial JSONL + atomic checkpoint files and atomically renames final results. Use a fresh output directory per named run; encode exactly `evidence.frames` to exclude stale frames. Codex plain-background nohup did not survive tool cleanup here; the accepted run used a live PTY at15fps.
- Shared hot gate must handle unknown external function callbacks without crashing; Fern supplied the guard-order fix and positive query fixture. Roots include step/process plus non-factory exported functions, so renaming a frame entry cannot silently skip the check. Cold build/create/load/make factories remain setup; called helpers are still scanned if reached from hot code.

## Press Hollow access — independent review (Sorrel)

- A painted path is not automatically walkable: Wren057bd1b's south lane drove straight into the rim at(9.211,-.313,61.011). `pathDist` flattened the small swell but did not cut the additive rim. Two alternate approaches blocked too; the original glide-only ending probe missed this entrance failure.
- Wren77d303a carves a terrain trough along the lane. Independent input-only retest passes all8 authored lane legs both ways, crag glide340frames, and3 walk-out legs. Evidence `/captures/sorrel/finale-access-fixed-77d303a/`; review+compact results `docs/reviews/swarm4/finale-access/`. No controller tuning; scene still sealed, no forced finale, no coal. Each case stages its initial position.
- Keep authored lane heights and visible lane coordinates coupled, and test entry as well as exit. `tools/finale-access-probe.mjs` provides an independent route regression; `--production` uses the actual build, `--alternates` adds diagnostic approaches. This does not replace the carrying/finale/camera route or a continuous ending clip.
## Finale / Press Hollow (Wren, swarm4)

- A painted lane is not a walkable lane: PATHS/pathDist only flattens the swell term, the rim term still raises a cliff under the paint. Sorrel's input-only probe (057bd1b) stalled the authored south lane at (9.2, 61.0) and two alternate meadow approaches too. Carve terrain from the same line that paints it (`SOUTH_LANE` → PATHS + `southLane()` trough in layout.ts, 77d303a) and prove it with an input-only walk both ways (`tools/finale-lane-probe.mjs`, Sorrel's `tools/finale-access-probe.mjs`). The finale's story gate is the Press itself (sealed until the Keeping settles; TLA `Finale.tla`), not terrain.
- Walk limits come from `moveTo`'s 0.28 m forward probe: a rise ≤ step + 0.15 = 0.37 m per 0.28 m (~53°) is walkable. Only steeper than ~1.3 rise/run blocks; a 1.85 m jump apex is the other bound.
- Glide off the far crag (top 9.46) into the hollow (floor ≈ 0.5) carries ≈ 18 m horizontally with the ember in the mouth (finale-route trace, 308958d).
- Carry places into a bowl only when the fox stands within `bowlReach` (1.6 m) on the same floor; otherwise it sets warmth at the feet. Route bots must stop ≤ ~0.9 m from a bowl.
- A second ground sheet must abut the bowl sheet on its exact vertex columns (bowl: x −64..56 in 170 segs → 0.706 m) or edges crack; overlapping sheets z-fight.
- Snow as `THREE.Points` falling in the vertex shader (mod-wrapped box round the camera) costs no CPU per frame; clamp `gl_PointSize` (1.6–7 px) or near flakes balloon into discs.
- Hot-gate gap (fixed upstream request): roots were only `update/tick/frame/process` names — a `*.hot.ts` entry named `stepX` was never scanned. Name hot entries `update*` (or make every export a root).
- This sandbox is 1 CPU: local SwiftShader continuous clips run ~0.5–1.8 fps at 640×360; run one probe at a time.
- New builders draw from their own `rng(seed)`, never `ctx.rand`: each draw from the shared stream shifts every later builder's layout and the runtime stream replays depend on. The Crown's finale river (1800 draws) did exactly that until 1a28d58; Bramble's `tools/rand-fingerprint.mjs` (next ctx.rand values after boot) proves a change is stream-neutral.

## Expanded-region camera and foreground sprites — Fern

- A distance/pitch camera gate can pass while an animated tail leaves the viewport. Millbrook's27–29s wheel turn at1.5m failed6/30 skinned-body frames (maxNDCy1.233).1.8m and2.0m pass30/30; b24abc5 historically selected1.8m; current1.9m adds ruin-landing padding (see final camera review). This supersedes the earlier ruin-only1.5m default, not its historical evidence. Project the full animated body and inspect actual pixels; shader flames, occlusion and UI are outside mesh-bounds checks.
-60e4a2c's full70s west route completes without debug restores or timeout skips: mill turning/painted,kiln lit/rode,Weir reached,bank-height bridge crossed,lookout painted.510/510 continuous body frames pass; all reviewed. Route module has precise bridge waypoints and an explicit completion beat; the runner's --expect-beat fails unfinished paths. Bramble42af413 fixes the genuine0.56m bridge-entry step that aligning the bot revealed.
- A framed body can still be veiled by particles.8292211 caps shared updraft ember/leaf billboards at12/24px and fades both near the lens. No lift/heat/collider change. The actual-shader GPU probe measures pixels at known depths and proves the old shader fails4/6cases; farther-visible checks prevent a broken blank shader passing. d0a3ee3 full route+120-frame in-game hold/rise retest passes and remains readable with bloom. Workflow: .claude/skills/updraft-sprite-visibility/SKILL.md.
- Final integrated7ea02f2 original90s success:3catches0skips,page pinnedhome,0JS/console errors; all7 staged finale legs and45 handoff frames pass. Review docs/reviews/swarm4/fern-millbrook-final.md names exact per-run scope. Body clearance/appearance proof is not a whole-game gait or unfamiliar-player discovery verdict. Source stays fixed during captures; tools now start ?manual=1 and retain console shader errors too.
## World build determinism and restore capacity

- Shared build rand: every opening builder draws from one `ctx.rand` (rng 11). A new region that consumes
  it, or a new `continue` before a rand call in an old loop, re-lays-out every later builder (and can break
  other teams' recorded tapes). New regions get their own seed (`{ ...ctx, rand: rng(N) }`); check with
  `tools/rand-fingerprint.mjs` on both trees (equal next values ⇒ identical layouts). Note `jitter()`
  consumes rand per vertex, so changing a geometry's segment count shifts the sequence too.
- Paint restores each need a shader slot (`RESTORE_SLOTS`, now 24; `uRestore` loop breaks at the count).
  With page (4) + Keeping (3) + homecoming + ruin + finale (2) + Millbrook/Hermitage (5) the old 16 was
  exactly full; slots past the budget silently never showed. scene.ts now console.errors when exceeded.
- Input-route verification of the new places: `node tools/millbrook-walk.mjs --route millbrook|hermitage|grand
  [--from lane|mill|kiln] --every N --size WxH` (stick/Shift/Space only; teleport at start). It records beats,
  stuck spans (no progress >3 s), final `__game` state and fox legibility from `__gameHooks.foxScreenPx()`
  (the one shared definition). Scripted routes steering straight into a concave corner (porch post + wall)
  pin forever — waypoint round it rather than reshaping the world. Acceptance on main 671a290: 0 stuck,
  all states true, fox ≥36 px @360p. Evidence `/captures/bramble/grand-671a290/`.
- Waypoints inside a collider's footprint look like "stuck" in the log; check the target against box/post
  colliders first (the mill box swallowed a "round the mill" waypoint; the lookout plateau rim is >1.3 m/m).
- Render clips from a pinned `git worktree` (with node_modules symlinked) so /work stays editable — editing
  src under a running Vite probe reloads it (HMR) and invalidates the run.
- Controller slide (moveTo glides round posts/corners) must only act while the player steers at walk/run pace: authored routes and puzzles rely on momentum (dash, post-dash skid, coasting) stopping dead at a blocker — the pop-up ruin folds broke when a post-dash skid slid round the fold (Fern, b24bf90 → fixed). `PLAY.slide` toggles it for A/B; `node tools/page-motion-probe.mjs --out DIR` (sim-only, ~2 min) is the full-slice regression: 3 catches, kept, home.

## Paint edges (Ember, swarm4)

- Restores were hard islands: `edgeMax` ~1.2 m on most beats gives a shader edge of ~0.2 m plus a dark tide line.
  Now each settled restore bleeds a paler feathered halo outward over ~40 s (`uRestoreBleed[i]`, set in scene.ts
  next to `uRestore`; ground only). Keep per-slot shader work to one value noise: the loop runs for up to 24 slots
  per fragment on every painted material.
- A fresh wash read as a scorch mark: painted grass cel is dark olive and the wet front/tide were dark sienna.
  Sky-facing painted surfaces (normal from dFdx/dFdy of the world position) are now lifted ~20% and warmed in
  patchPaint; pigment lighter and halved. Grey-beige props (flagstones 0x8d8471) read as unpainted paper even
  when painted: give them a warm hue.
- Things that must read in colour inside sepia (falling lane leaves) need plain MeshToonMaterial; the paint patch
  turns them to paper and they vanish (first lane-wind try).
- Controller slide (moveTo glides round round posts only — trunks, pillars — never boxes) must only act while the player steers at walk/run pace into the post. Scripted routes are chaotic: a 2 cm nudge against a fold at 951 frames flipped a later 180° turn's side and walked the fox off a page (30 Hz). Restricting the slide to posts makes the full slice trace bit-identical to slide-off (`PLAY.slide=false`) at 30 Hz. Earlier: authored routes and puzzles rely on momentum (dash, post-dash skid, coasting) stopping dead at a blocker — the pop-up ruin folds broke when a post-dash skid slid round the fold (Fern, b24bf90 → fixed). `PLAY.slide` toggles it for A/B; `node tools/page-motion-probe.mjs --out DIR` (sim-only, ~2 min) is the full-slice regression: 3 catches, kept, home.

## Camera recovery, clearance and fold visibility — Fern

A cold released-tree start missed the real approach history: Carry → steam → root
→ tree bridge stranded the old lens 16.85 m from the grounded fox while minimum
range, pitch, speed and body-in-view gates passed. Recovery `6ffe34c` validates
complete goals before bounding their next step, shares swept terrain/collider
checks and searches locally around the previous lens. The accepted natural run
on `aeaa2f1` peaks at 2.810 m grounded follow distance with a minimum 44 px hero at
640×360. Free/ledge/ridge/post fixtures pass at 30/60/120 Hz; the nine-state TLC
model proves publication order only, not arbitrary geometric recovery.

Current opening compression is **1.9 m**, selected after the regional ruin drop
revealed two 1.8 m frames with only four pixels of bottom padding. The matched
1.9 m trial retains about 27 pixels, and the full 150-frame drop passes the same
2% body margin. The normal boom is 2.45 m. Sorrel independently reproduced both
results. Historical 1.5/1.8 m evidence remains useful but is not the current default.

All route tools should use the shared game `foxScreenPx()` hook and
`tools/lib/fox-size.mjs` gate: a 0.6 m feet-to-ears projection, minimum viewport
height/15 (24 px at 360 px high), failing more than one second below that floor
outside authored shots. The camera probe also checks grounded follow range ≤ 5 m
after one second grounded. Its excessive 200 px negative fails independently.
Neither projected size nor full-body bounds proves world visibility.

Actual miss pixels caught an upright return stair fan fully hiding the fox while
all numeric gates passed. It lacked occluder registration. Sorrel's fix is
incorporated; `653492e` creates all folds through one registered constructor, and
`Fold` requires its `FoldPivot` type. A raw `THREE.Group` substitution fails
TS2322. The repaired 120-frame missed approach and 90-frame homeward descent were
reviewed throughout; the fan fades, the fox stays visible, and the walking surface
remains readable. All 6,000 compared player/camera trace samples match `aeaa2f1`.

The earlier stalled chase runs are rejected as outcome evidence. Wren's
`9e04283` confines sliding to round posts under active steering, restoring the
authored fold stops. The original input route is unchanged again: the accepted
110 s run has three catches, zero skips, kept page and pinned home. The miss guard
requires the actual overlook-jump beat, an airborne departure and a fall below
the leaf. A numeric camera pass on an unvisited test case is insufficient.

Review `docs/reviews/swarm4/fern-bridge-recovery-final.md` and its JSON acceptance
manifest for named sources and route scope. Accepted clips contain 585 reviewed
continuous frames, with 540/540 strict body-margin samples and 45 visually reviewed
finale handoff frames. Evidence includes full `window.__game`, source, traces,
checks and screenshots under `/captures/fern/`, mirrored in
`playtest-output/fox-spirit/fern-camera-recovery/` and verified on the shared
`keeping-swarm4-captures/fern/` volume. These are offline, sampled 15 fps, silent
camera reviews; they do not certify real-time performance or audio.
- Gate story hand-offs on the beat every route actually reaches, not the optional maximum: the homecoming→finale stream first waited for all five lanterns (every creature freed), which no slice route does, so the ending never appeared in Kit's clips (Fern fixed: page pin starts it). Check new gates against the shared slice route (`tools/page-motion-probe.mjs` / Kit's landing route), not a staged "everything done" state.
- Earlier software-only scans (617ad72: 2400 frames, min luma112, zero dark) did NOT establish that the GPU flashes were recorder-only. Reed swarm5 hardware comparison below supersedes that conclusion: native, staged and independent CDP output all flash, including one synchronous source sample. Reproduce on the affected GPU path before assigning the cause.

## Showcase continuation and teaching overlays — Fern050a7cc

A capture route ending in `hold(homecoming, Infinity)` intentionally spends the rest of a long clip in the plaza. Use `tools/journey-camera-route.mjs` for the160s opening→Keeping showcase:10s reveal hold, walk to hearth, then canonical Keeping inputs. The factory is self-contained for capture tools transferring `toString()`, while its maintained opening/Keeping definitions remain shared. An authored route does not prove unfamiliar-player discovery, and changing it does not explain the separate live recorder divergence.

Review timed UI overlays in motion: a bottom-center teaching card covered the fox's legs between beat screenshots. The hearth card now occupies the upper-left corner with a32vw/240px content cap. Final050a7cc165s30Hz route passes all story/endpoint/camera gates,0JS; all90 corrected94–100s motion frames and ten stills reviewed. All4950 recorded gameplay/camera rows equal the pre-HUD baseline. Full scoped report: `docs/reviews/swarm4/fern-journey-REVIEW.md`; captures `/captures/fern/journey-hud-final/`. These are offline480×270/15fps segment results, not a live GPU recorder or whole-game feel verdict.

## Capture staging experiment (Fern, Nov 2 12:52 UTC)

- Kit's e1c9e57 live GPU clip still has23isolated black frames; previous no-dark immediate in-canvas scans and buffer-flag A/B do not by themselves prove which external capture stage fails. External landing-recorder source was requested, not supplied in this checkout.
- Optional `tools/recorder-staging.mjs` copies a freshly rendered WebGL frame synchronously into a persistent2D canvas and calls requestFrame on captureStream(0). It is not enabled anywhere automatically. Call push immediately after render; an unrelated timer can still read a cleared source.
- Local simultaneous native/staged browser recordings on unchanged2189900 game source decode6/6frames at480×270 and29/30frames at160×90, all bright/no JS errors. Software throughput is low and pushes coalesce; this is helper feasibility, not reproduction or repair of the GPU blink. See `docs/reviews/swarm4/recorder-staging-REVIEW.md` and compact results. Keep the GPU issue open pending hardware A/B.

## Complete showcase route (Sorrel)

- `tools/complete-journey-route.mjs` composes the canonical wake-to-Keeping journey with the same finale factory in bridge-start mode; it stays transferable with `toString()`. Production `56d2469` completes all 13 checks at 30 Hz with one initial wake placement and no later teleports or forced progression: homecoming at 73.033 s, final placement at 180.467 s, first title sample at 209 s, title done at 222 s. Use 230 s for a full ending capture; 160 s is the shorter Keeping showcase. The original opening regression intentionally holds forever at homecoming.
- Bowl-center waypoints are not pickup positions: stop when Carry reports `canPickup`. Press placement must be within the authored 1.6 m bowl reach; the tested approach target (21.0, 40.7) with a 0.15 m stop radius snaps warmth into the cradle. A point 1.65 m out silently places on the ground and leaves the finale sealed. Review/state/evidence: `docs/reviews/swarm4/finale-journey/`. This authored offline route does not prove unaided discovery or fix the external GPU recorder.

## Words on screen must be in the canvas (Cedar, swarm5)

- DOM overlays (captions, end card, teach prompts) never reach canvas recordings (MediaRecorder / canvas
  captureStream). Kit's b4fa63a review clip had no ending title at all for that reason, while page.screenshot stills
  did show DOM text — so "it's in the screenshot" does not prove "it's in the clip". Draw words with
  `opening/lettering.ts` (camera-fixed CanvasTexture plane, redraw on change, `fitLetterPlane` per frame), or use
  `ctx.captions.say` (bottom band) / `ctx.teach.offer` (upper-left hint, offered every frame it should show).
  `lint:feel` rule `dom-text` bans `createElement('div')` / `.textContent =` / `.innerHTML =` in `src/opening`.
- Camera children only render if the camera is in the scene: `scene.ts` does `scene.add(view)`.
- Planes on the lens go through the whole post stack (bloom, grade, ACES in OutputPass); `toneMapped:false` on the
  material does not bypass the OutputPass tone map. Set `userData.forgeSkipAO` so GTAO ignores them.
- Editing source while a Vite-served probe runs reloads the page mid-run (HMR) and the run dies with
  `__gameHooks undefined`. Run long probes from a pinned worktree: `git worktree add /tmp/wt-<sha> <sha>` +
  symlink node_modules.

## Finale kits and the rest shot (Cedar, swarm5)

- The "duplicate foxes" at the end were the authored kits curling 1.0 m from the cradle while the hero stood in it.
  Kits now take the free slot (ring of 9 on the cradle's open side, r 1.35) farthest from the hero and siblings, are
  0.42× scale, and a curled kit the standing hero comes within 0.95 m of shuffles to a new slot, steering round the
  fox. Staged probe (`tools/finale-ending-probe.mjs`): closest kit during the held rest shot 0.95 m (was overlapping).
- TLA caught a real starvation: if a disturbed kit went back to `trotting`, a player weaving through the kits could
  keep one uncurled forever and the end card never shows (EndsOnce violated). A separate `shuffling` phase that
  still counts as home fixes it; WF suffices.
- The rest shot frames hero + cradle (45% toward the fox) from the approach side, ~3.5 m back, and holds with a 90 s
  slow push until the player moves (after the card's lock). Fox ≈ 140-160 px tall at 720p.

## Opening discovery — Hazel, swarm5

- The review's naive bot threshold `.08 m/frame` exceeds this controller's ordinary run displacement (`3.2 m/s / 60 = .053 m/frame`), so ~120 false unsticks per90s are predictable even in open space. Thistle owns correcting the tool. Keep old and corrected measurements separate; random wandering and public-cue following answer different questions.
- A guide that chooses the next ruin page from position alone can turn in midair before landing. The paper invitation now advances from actual support contact (`grounded`, footprint and height), with grounded floor retries. Canopy's live guide view returns no last leaf after `onRoute` clears on a floor landing; historical diagnostic `lastLeaf` remains unchanged. Readonly page/support views keep guidance unable to perform catches/unlocks.
- `Discovery.tla` passes36generated/14distinct states; removing catch synchronization fails MatchesWorld in two states. It checks guide/world synchronization and kept stability, assuming real Arrive guards. It does not prove continuous geometry, visibility or unfamiliar-player discovery. `.agents/skills/verify-discovery/SKILL.md` preserves recheck and negative control.
- `tools/discovery-probe.mjs` follows only the current drawn invitation plus ordinary movement feedback, never an authored route table or progression controls. Pre-lettering simulation on e32b927 reaches roost+overlook and keeps3catches at~33s; this is a cue-following input test, not blind-wander or human-fun proof. Named visual evidence/retest is required before landing.
- A dash follows the visible fox heading, so cue followers must turn before dashing; otherwise the second ruin tab gets a westward dash while the requested movement points north. Hold jump through the spring's0.12s load; repeated grounded jump taps can replace the intended spring with a small ordinary jump.
- Independent visual review by Maple:20tiny moving gold scraps read as exhaust. Four larger cream/ink paper fragments anchored ahead read as an invitation on7f9eb23; add a warm gold edge and lower their ground hover a little to separate them from paper props at the gate. Shared teach lettering is now legible in canvas frames, not DOM-only.
- `ctx.teach` must consume offers after the providers. Registering its updater when createTeach runs makes the early hearth/coal calls overwrite the prior frame's chase offer before consumption. Register in mount after builders instead; tools/teach-order-lint.mjs bans the old placement and late ctx builders. TeachOrder.tla4/4 passes; allowing early Publish fails LatestOfferWins in two states. The fade itself is outside that model.
- Baseline productioncf48b75 cue-following clip:40s,640×360,10fps offline screenshots, silent; all3catches+roost+overlook+kept+noErrors true. Sampled catches at1.5/12.75/32s, overlook31s. This is route-independent visible-cue following, not blind random wander. Original110s regression on43c4f90:3catches,kept,pinnedhome,finite,noErrors alltrue.
- Limitation found by injected-input retry test43c4f90: after deliberately walking off the second ruin jump, the guide resets to the first leaf and the bot eventually keeps the page (~70s), but takes11misses and catches it before visiting the overlook (strict overlook check false). Preserve that failure; do not describe this as robust recovery or a full-route retry pass. Floor-to-leaf approaches remain awkward with the old controller; Thistle's collision fix is independent and needs joint retest.
## Recorder boundary investigation — Reed, swarm5

- b4fa63a review reports 21 isolated native GPU MediaRecorder flashes. Existing
  software staging probes and synchronous canvas scans do not establish the GPU
  cause. Keep this issue open until matched hardware recordings reproduce it.
- `tools/check-black-frames.py` scans decoded frames with actual PTS, including
  VFR clips, and fails even one near-black frame. The bright / single-flash /
  blank negative controls are `python3 tools/tests/black-frame-gate.py` (ffmpeg
  required, imageio-ffmpeg optional fallback). Existing fixed-clock hub gate stays
  valid; this diagnostic handles real-time VFR recordings.
- RecorderBoundary.tla checks synchronous render→copy→publish ordering (11 states).
  RecorderBoundaryBad.cfg deliberately permits discard before copy and fails
  NoBlackPublication. It proves ordering only, not GPU/browser correctness.

Hardware reproduction on diagnostic764b338 (game source identical to b4fa63a):
T4/EGL1280×720,120s wall recording, native20/2545 black frames, synchronous
2D staging33/3400, independent CDP compositor11/1133. Stage read at simulation
tick3000 is0luma. Independent compositor frame00007 is fully black. This proves black pixels
exist before encoding and that2D staging does not repair the shared output. Artifacts
`keeping-swarm5-captures/reed/boundary-764b33881c-154213-24ad01`; source/tool hashes,
actual frame PTS, GPU attributes, screenshots and __game are preserved. Context has
preserveDrawingBufferfalse and antialiastrue. Cause still open; flag A/B underway.

Controlled follow-up on0a4862d: preserveDrawingBuffertrue still18 native/23
staged/7 CDP flashes. Canvas antialiasfalse alone:0/2643 native,0/3422 staged,
0/1141 CDP, minimum mean luma71.2/80.2/80.3; full SMAA/bloom/grade preserved.
Critically, baselineMSAAtrue with NO MediaRecorder or captureStream attached
(CDP-only8495afb) is clean0/1156. This isolates a recording-triggered GPU
canvas/MSAA interaction rather than an autonomous game fade. Paired compositor
black by itself did not distinguish recording-triggered corruption from a game
defect. The forge's fullscreen output surface does not need MSAA; SMAA already
owns scene-edge smoothing. Actual constructor antialiasfalse is the selected fix;
AST single-aa-owner lint rejects true, dynamic flags, overriding spreads/context.

Actual constructor74c7db9 (no diagnostic context override),250s recording:
native0/5604, staged0/6948, CDP0/2316 black; noJSerrors, minimum meanluma
67.948/76.674/76.774. **Scope limit:** probe omitted interact so the page completes
(3catches0skips) then the journey stalls at coal pickup; this is valid250s render
output evidence, not an ending clear. Route replay now uses a pooled immutable
jump/dash/interact encoder (including KeyE) and asserts canonical route completion
for long captures, making that mistaken clear claim fail automatically.
## Painted corridors & colour coverage (Maple, swarm5 fix 2)

- Measure colour with `node tools/corridor-colour.mjs [--state cold|story] [--views a,b]` (11 corridor views, real chase lens; `--images` scores any frames). Two numbers per frame: `colour` (strict, sat>0.45 off the sepia axis; review frames naive-mid .025 / end-160 .383 / t060 .728) and `tint` (any visible hue off sepia, pale washes included). Plain HSV saturation is useless here: sepia paper itself has sat ~0.35–0.42.
- Ochre/beige is the paper's own hue: a "painted" beige lane or an ochre wash at paper value reads as unpainted sepia in frames. Anything meant to read as colour inside the sketch needs hue *off* the sepia axis (greens, madder) and must be laid darker than paper value and pushed past its chroma (~1.8×) — pastels at paper value vanish under ACES + the haze.
- `opening/lanePaint.ts` bakes a half-float lane distance/terrain-height map (0.5 m) once from `ALL_PATHS`/`pathDist`; `patchPaint` reads it once per fragment. Uses: lane underpainting (green verges, saved-paper road), restores reaching `uLaneReach × bleed` further along lanes (story Press lane .083 → .39), and `uSketchTint` (sketch keeps 30 % of authored hue at paper value). Gate wall coverage by surface up-ness (dFdx normal), or the wash paints rainbow stripes up house walls.
- Never run a Vite-served probe from /work while editing src — HMR reloads mid-run. Pin a worktree (`git worktree add -f /tmp/wt-x HEAD`, symlink node_modules, copy src in).
## Naive wander and village stuck rate (Thistle, swarm5)

- `tools/naive-explore.mjs` is the in-repo naive bot (seeded mulberry32, policy runs in-page per chunk; `--tether 14` = the review's well-plaza wander; `--legacy-stuck` reproduces the seed test). Stuck = pushing the stick but < 15% of expected travel over a 1 s window; re-fires each further stuck second.
- The seed bot's stuck test (< 0.08 m per 1/60 s step for 45 steps) means < 4.8 m/s, faster than `PLAY.runSpeed` 3.2 m/s: it "unstuck" every 0.75 s whatever happened (106 / 90 s on b4fa63a, review said 131), and its random turns made the circling-the-well random walk. Check a bot's thresholds against the controller's real speeds before trusting a stuck count. It also sent `Shift` (no dash; the controller reads `ShiftLeft`).
- Real cause of village stops: `moveTo`'s 0.28 m nose probe points along the facing, so any diagonal push into a wall fails BOTH per-axis moves — the fox stopped dead instead of sliding. The slide used to run only for round posts; it now runs for any blocker while the player steers into it (never off a ledge) and eases the facing to the travel (`PLAY.slideTurn`).
