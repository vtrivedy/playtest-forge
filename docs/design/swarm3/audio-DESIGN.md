# Opening audio — shared graph, music, ambience, fox & page SFX (swarm 3)

Owner: Flint (graph, music, ambience, fox, page, coal, hearth, steam). Moss: creatures, homecoming, lanterns,
ruin, canopy leaves — on this bus (`DESIGN-audio-moss.md`). Capture/verify tooling: Rook (`audio-capture-DESIGN.md`).

## Point
Warm, quiet, autumnal. The slice should sound like a late-afternoon village in October: a soft acoustic
town theme under distant wind and birds, the fox's paws on grass/wood/stone, paper that flutters and snaps,
hearths that hum and crackle. Sound tells you where things are (hearths by ear, the page by its flutter).

## Graph (one AudioContext, `opening/audio.ts`)
```
music (playlist, crossfades) ─ duck ─┐
ambience (wind + birds loops) ───────┼─ master ─ limiter ─ destination
sfx (samples + synth voices; 3D) ────┘                   └─ record tap (MediaStream, post-limiter)
```
- Created at scene build, suspended; resumes on the first key/pointer (browser autoplay rule). Music fades in over 4 s.
- Listener = the rendered camera (position + forward/up) each frame. World sounds go through an HRTF
  `PannerNode` (inverse distance, ref 3 m, max 60 m); the fox's own paws/jumps are near-centre.
- `duck(depth, hold)`: the music dips (attack 0.25 s, release 1.5 s) under catches, ignitions, homecoming.
- Limiter (DynamicsCompressor −6 dB threshold, ratio 20, 3 ms attack) after a −3 dB master: no clipping.
- Every module that makes sound (hum, glyphs, unpressed, homecoming) builds its voices on this context and
  connects to `audio.sfx` (or a panner from `audio.at(pos)`). No module creates its own AudioContext.

## Music
CC0 recordings, alternated with 5 s crossfades: *Hush Hamlet* (loop edit, 96 s) then *Apple Cider* (3:20),
both Zane Little Music. Bed level ~ −22 LUFS so effects sit on top.

## Ambience
Wind across the open field and birds in a copse (Thimras park ambiences, CC0), cut into 40 s seamless loops
(3 s equal-power crossfade, one fixed gain). Wind swells with height (gliding, canopy); birds come up as the
colour returns (restored fraction).

## Events (mine)
| event | source | treatment |
|---|---|---|
| footfall | Kenney footstep grass/wood/concrete ×5 | per paw plant (IK stance), alternating samples, pitch ±6%, hind paws softer; surface: terrain = grass, canopy leaf = grass bright, ruin flaps = wood, village/shelf/crag props = stone |
| jump / land | cloth flick / impactSoft + footstep pair | land scales with impact |
| glide | synth wind (band noise) | gain + brightness by air speed while gliding |
| page | Kenney bookFlip ×3 / bookClose | flips on skips/dodges/hops (3D at the page); catch = flip + close + chime, music ducks; existing synth flutter stays as its findable-by-ear voice |
| hearth | hum chord (existing synth) + crackle loop (AntumDeluge, CC0) | crackle 3D at each lit hearth; ignite = swell + duck |
| coal carry | crackle loop at the coal | follows the coal |
| steam | bart steam hisses ×3 (CC0) | on the steam latch, 3D at the vent |

## Verification
- `__game.state().opening.audio`: context state, bus gains, music track/time, last events.
- Rook's recorder (`tools/opening-audio-capture.mjs`) on a named SHA: integrated LUFS, true peak < −1 dBFS,
  no silent gaps in music across a crossfade/loop seam, event list vs trace. Two teammate verdicts on sound/feel.
