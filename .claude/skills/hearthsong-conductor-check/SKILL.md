---
name: hearthsong-conductor-check
description: Recheck the Hearthsong music conductor (swells, gap, finale force, coda, epilogue) after changing the score, the worklet's barLine/cue handling, or the music driver.
---

The song must never stack moments: a swell (the recorder singing the tune) starts only on a bar line inside the
tune, only after the music has rested `SWELL.gap` bars (unless one of the finale's two forced moments spends a
force), always fades and rests; the end cue plays the tune's last line home, goes silent, then returns once as
a soft epilogue and never ends again. If this breaks, the player hears cues piling up or a song that stops dead
(Vivek: "super intrusive").

Source: `games/fox-spirit/src/opening/music/hearthsong.worklet.hot.ts` (`barLine`, `pickTune`, cue handling in
`process`), `music.hot.ts` (params), `score.ts` (`SWELL`, tunes, places).
Model: `games/fox-spirit/tla/Hearthsong.tla` + `.cfg`; broken variant `HearthsongBad.tla` (gap check removed).

From the repository root:

```sh
tlc -workers 2 -config games/fox-spirit/tla/Hearthsong.cfg games/fox-spirit/tla/Hearthsong.tla      # green
tlc -workers 2 -config games/fox-spirit/tla/HearthsongBad.cfg games/fox-spirit/tla/HearthsongBad.tla # must fail Safe
npm run check:music   # offline render of a cue-stress walk; every worklet bar report checked against the model
```

`check:music` (render.ts `checkTrace`) is the code↔model link: it failed at reports 18/38/74 when the worklet's
gap check was deleted. Model and code last matched at sw4-ember 17271b5 (QuietBars 4 in the model, 18 in code).

The model leaves out timing inside a bar, the place blend, tune choice and every sound. For those, listen:
`node tools/hearthsong-render.mjs --walk main|mill|hermitage|cues`, `node tools/millbrook-walk.mjs --route grand
--audio`, then `tools/audio-meter.py`, `tools/spectrogram.py`, and `modal run tools/audio-listen.py` (ask
neutrally; confirm any flaw on the spectrogram). Capture stems with `tools/lib/stem-tap.mjs`, never a
ScriptProcessor.
