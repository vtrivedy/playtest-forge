# Hearthsong — synthesized adaptive music (Ember, swarm4)

Vivek (TASK.md): the first mix was "terrible / super intrusive / constant birds"; he wants **gentle warm autumn
music throughout plus subtle sfx**, judged by us with code-based listening. tibo.dog: music synthesized live from
songs-as-text, transitions between places *continuing the melody*.

## What it is

One song, written as text in `src/opening/music/score.ts`, played by a small synth inside an AudioWorklet
(`hearthsong.worklet.ts`). No audio files. The worklet owns the clock and the sequencer, so timing is
sample-exact and the main thread does nothing per note. The main thread only moves a handful of AudioParams
(`music.hot.ts`, allocation-free): layer levels blended from where the fox is, how much colour is back, and a
swell when something good happens.

- **Key / feel:** D major, 3/4 at 72 bpm (a lullaby waltz). Hearth hums already sit on G1/A1/B1 — in key.
- **Form:** 16-bar tune (A 8 + B 8), then a 2-bar *breath* (pad only). Passes vary: harp sketches the tune,
  later passes give it to the flute/ocarina voice, the B section answers.
- **Voices:** Karplus-Strong harp (broken chords + tune hints), soft additive pad (3 voices), round sine bass
  on the downbeat, breathy ocarina/flute lead, FM bells for sparkle. Synthesized plate-ish reverb (convolver
  with generated impulse) on the music bus.
- **Places continue the melody:** the bar counter never resets. A place changes orchestration, brightness and
  mode (ruin/hollow borrow minor substitutes: I→vi, IV→ii) — never the tune's position. Blends are smooth
  weights from fox distance to place centres; nothing hard-cuts.
- **Story adapts it:** sepia start = harp alone, sparse. As colour returns (`restored` 0..1) pad, bass, then
  lead join. Moments (`cue`: hearth, page, keeping, home) raise `swell` → the lead sings the tune from the
  current bar (entry only on a bar line), bells sparkle, then it recedes over ~4 bars. ≥30 s between swells.
- **Quiet by default:** target full mix −30…−26 LUFS integrated, music bed ≈ −34 LUFS, true peak ≤ −6 dBTP.
  Breaths and rests in the score leave air; no permanent drone.

## SFX changes

- Sample birds (the "constant birds") are removed. Life comes from the score and local sounds.
- Every synthesized chime (glyphs, page, homecoming) should be in D-major pentatonic so it joins the music.

## Proof

- TLA+: `tla/Hearthsong.tla` — conductor: bars advance, breath only between passes, swell enters only on a
  bar line, never overlaps, respects the 30 s gap; liveness: an accepted cue eventually sings and then rests.
- Lint: `*.hot.ts` may not allocate (`no-alloc-in-hot` in `tools/lint-feel.mjs`); worklet `process()` likewise.
- Listening: `tools/mix-capture.mjs` 60 s route → `audio-meter.py` / `audio-understand.py` / spectrogram +
  Qwen2-Audio neutral description, before/after numbers in KNOWLEDGE.md.
