# Opening audio — shared graph, music, ambience, fox foley (swarm 3, gentle redo)

Owner: Flint (graph, music, ambience, fox foley). Moss: creatures, homecoming, lanterns, ruin, canopy, hearth/coal/page
beds in hum.ts (`DESIGN-audio-moss.md`). Research and targets: `KNOWLEDGE.md § Quiet audio redesign` (Tallow);
diagnostics: `tools/audio-understand.py` (Rook); capture: `tools/mix-capture.mjs`; listening: `tools/audio-listen.py`.

## Why the redo
Vivek (:1144) on the first mix: intrusive, wall-to-wall music, constant birds, no sound-design craft. The first
version filled every second (two looping tracks, a looping bird bed, a recorded wind bed that carried traffic rumble
and hidden birds, four-paw Kenney footsteps). The redo makes silence the default.

## Rules
- **Music only on moments.** No music at boot or while exploring. A moment (`audio.cue`) plays one finite solo-harp
  phrase (Meadow Thoughts, Écrivain, CC0; 8–20 s, whole phrases with their natural decay) and then it is quiet
  again. A cue within 30 s of the last phrase is dropped — no backlog, no stacking. Moments: first hearth lit
  (`hearth`), a page caught (`page`, alternating two phrases), the Keeping (`keeping`, its own long phrase replaces
  the old synth chord), home at the well (`home`). One instrument = one voice for the slice.
- **Wind is a breath, not a recording.** Pink noise under a low-pass that opens as a gust rises (450 Hz → 2.2 kHz);
  between gusts it falls to nothing (a steady noise band read as a fan/engine to machine listening). Faint on the
  ground, fuller with height (gliding, canopy).
- **Birds are rare and far.** Single calls (five isolated, denoised calls), only once the colour is back
  (restored > 0.3), 28–70 s apart, 18–34 m away in a random direction, never the same call twice running.
- **Foley is soft.** Forepaws only, ≥160 ms apart: each plant is a synthesized pad (a 6 ms-rise, 35–80 ms-fall
  burst of noise under a surface low-pass: grass silent, leaf 900 Hz, wood 320, stone 650) — recorded footsteps
  read as taps/clicks/a ticking clock in every listening pass (Tallow :1388). Landing = a deeper, longer pad.
- **No ducking.** Music only exists at moments, so there is nothing to duck under them.
- `MIX.master` = 1 (unmuted 2026-11-02 after Tallow :1631 judged the 5247b90 mix gentle and fitting against the Alba / A Short Hike references).

## Graph (one AudioContext, `opening/audio.ts`)
music phrases · ambience (wind, birds) · sfx (samples + synth voices, HRTF panners via `at(pos)`) → master →
limiter → out, with a post-limiter `record` tap and pre-master `buses` for stems. Listener = rendered camera.

## Measured (r3, `tools/mix-capture.mjs`, 60 s of the no-teleport slice route paced to wall clock)
−31.3 LUFS integrated, peak −17.7 dBFS (pre-limiter, master at unity); music 2 phrases/min (page catches at
~10 s and ~51 s; the 18 s catch is dropped by the 30 s rest); birds ≤ 2/min; footfalls ~110/min while moving.
