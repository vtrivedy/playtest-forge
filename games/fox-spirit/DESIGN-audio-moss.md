# Audio: creatures, homecoming, ruin, canopy (Moss)

Part of the opening audio pass (Kit :963; split Flint :987). Everything plays through Flint's one graph
(`opening/audio.ts`, docs/design/swarm3/audio-DESIGN.md): `ctx.audio.play(file, { at })` places a one-shot in 3D;
synth voices connect to `ctx.audio.sfx` or `ctx.audio.at(pos)`; `duck` dips the music. Samples are CC0 Kenney
files in `src/opening/sfx/` (assets/library/CREDITS.md); where Flint's set already has the same source sound
(page-flip = bookFlip, cloth, land = impactSoft) it is reused, not duplicated.

## Events

| event | where | sound | treatment |
|---|---|---|---|
| creature pop | the drawing | `page-flip-0` then `page-flip-2` + the two-note synth chime and the creature's voice | pitch by creature (hedgehog high, heron low) |
| hare bound | hare | `land-0/1` | every bound, rate 1.3, quiet |
| heron wings | heron | `cloth-0/1` | each wingbeat of the hop down and of the homecoming wheel |
| canopy leaf | each leaf on first touch / launch | `cloth-2` / `land-0` low | touch pitch rises up the canopy (entry → roost) |
| ruin unfold | each fold | `unfold` + `creak`, then `land-1` as it lands | slowed, low |
| page pinned | well post | `page-pin` + `tack` | |
| lantern kindle | each lantern | `kindle` then `chime` | chime a pentatonic step higher per lantern |
| well fills | the well | synth open-chord swell (5 voices, 6.5 s) at the well | music ducks to 0.4 for 4.5 s |

The drawings' breath shimmer stays a quiet synth voice (no sample).
