# Independent Hearthsong dynamics audit — Reed

Candidate `bdb7ee93e037f9f5cb76d3467043f848a94f3c11`, baseline `b4fa63a`.
Maple supplied stereo 48 kHz offline renders of the same 220-second main walk,
seed 1, plus 20–80-second excerpts. This is an offline music comparison, not
evidence of music/SFX balance during live play.

## Independent measurements

FFmpeg `loudnorm=print_format=json`, reading only its **input** measurements:

| Measurement | Baseline | Candidate |
|---|---:|---:|
| Integrated loudness | −33.19 LUFS | −32.49 LUFS |
| Loudness range | 8.50 LU | 12.70 LU |
| True peak | −19.40 dBTP | −17.29 dBTP |
| Stereo sample RMS | −35.50 dBFS | −34.90 dBFS |

Independent one-second RMS traces show the candidate bed sitting lower between
events, while the events around 30–38, 78–86, 153–177, and 211–220 seconds
stand higher. The average increase is modest; the range increase comes from
contrast. This independently confirms Maple's dynamics claim using a different
meter. The seed review clip's 4.8 LU range is a different recording; do not use
that as the baseline for these two offline files.

The spectral analysis gives nearly identical median centroids (~325 Hz) and
attack counts (~100/min). These support a dynamics change to the same musical
material, not a claim of a new composition. Mono downmix analysis has different
peak/RMS values from the stereo table above; use the stereo values for levels.

## Listening check and verdict

Qwen2-Audio-7B-Instruct independently described four 30-second windows using
the neutral prompt: “Describe the instruments, mood, and how the loudness
changes over time in this audio.” It described harp/synth strings, a calm and
dreamy mood, and a slight build/fade in both versions. Its descriptions were
almost identical, so this pass does **not** independently demonstrate a
perceptual preference or a stronger emotional payoff. This is model listening,
not human hearing; no teammate should present it as a human listening verdict.

Verdict: **pass for measured dynamics improvement**; no clipping concern in
these supplied music-only renders. The independent model check supports
continuity of instrumentation/mood but is inconclusive about whether the new
swell feels better. Maple/Kit should retain that distinction when deciding
whether this fulfills the requested listening gate. A live mix review is still
needed to judge masking of steps, cues, and dialogue-like lettering moments.

## Evidence

Durable source files: volume `keeping-swarm5-captures`, `maple/music/`.
Independent output: `reed/music-review/`: `envelope.png`, input loudnorm JSONs,
`independent-levels.json`, `listen.jsonl`, and `base-analysis/` / `new-analysis/` spectrograms
and diagnostic JSONs. Source audio SHA256:

- Baseline: `e2da40437cb4fd0f961b5083390198c93b789b3833a2f7627946b0e92374d3d7`
- Candidate: `5d1dba8da8ed0d4419f3dfbec12f7d70b20699de4c109dacb9408d2d10947ebc`

No runtime code changed in this review.
