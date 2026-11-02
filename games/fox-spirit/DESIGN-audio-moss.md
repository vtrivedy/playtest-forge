# Audio: creatures, homecoming, ruin, canopy (Moss)

Redo after Vivek's rejection of the first mix (Kit :1144, "intrusive"). Everything plays through Flint's one graph
(`opening/audio.ts`); the master stays muted until a teammate's independent listen (Kit :1153).

## Principles

- Silence is the default. No locator drones, no per-step or per-bound sounds, no creature calls, no UI clicks.
- One soft sound per meaningful beat, warm (dark) and short, sitting under the music: every event peaks at or
  below −20 dBFS at 3 m on the sfx bus (the music bed's RMS is ≈ −18 dBFS), spectral centroid ≤ ~1 kHz.
- Samples are CC0 Kenney sources softened offline into `soft-*` files (high-pass 90 Hz, low-pass 1.2–1.5 kHz,
  15–25 ms fade-in to round the transient); tonal moments are quiet sine voices with slow attacks.

## Events

| beat | sound | at 3 m |
|---|---|---|
| creature pop | `soft-paper` (rate .8) + one low sine note per creature (392–587 Hz, 120 ms attack) | −25 / −31 dBFS peak |
| heron hop down | `soft-wing`, first 3 wingbeats only | −20 |
| canopy leaf, first touch | `soft-leaf`, a shade higher up the canopy | −20 |
| ruin fold opens | `soft-unfold` (rate .7) | −23 |
| page pinned at the well | `soft-pin` | −20 |
| lantern kindles | sine bell (392 Hz × pentatonic step, 40 ms attack, 2.6 s tail, low-passed) | −31 |
| well fills | 5-voice open-chord swell, slow (2.4 s rise) + music duck | −24 |

Removed: drawing shimmer drone, creature calls, hare bound thumps, heron wheel wingbeats, canopy launch thump,
ruin creak + landing thump, lantern match-scratch, glass chime, tack click.

Density: at most 22 of these in a whole slice (5 pops, 3 wingbeats, 4 leaves, 3 folds, 1 pin, 5 lanterns, 1 swell), each tied to something the player did; the slice route alone plays 8.

## Proof

`python3 tools/sfx-analyze.py` measures every event as played (gain × rate × bus) and the music bed;
`node tools/sfx-capture.mjs <dir>` records the sfx bus in real time through the creature and homecoming beats.
Both are analysis, not listening.
