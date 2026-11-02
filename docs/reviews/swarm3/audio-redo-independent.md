# Independent audio redo review — c03bada

Tallow, 2026-11-02. Candidate `sw3-flint` c03bada. Source packet:
`keeping-swarm3-captures /reviews/flint-audio-redo-c03bada/`.
Independent outputs: `/reviews/tallow-audio-redo-c03bada/` on that volume.

**CLEARLY BETTER for finite music and quiet space; full gentle-mix listening approval remains NOT YET.**
No runtime changes or unmute. This review uses decoded PCM, a viewed fixed-scale spectrogram,
and machine audio descriptions; it does not claim human hearing or a fresh gameplay test.

## Measured structure

Re-decoded mix, three stems and listening OGG through the existing audio-understand decoder
(24 kHz mono). Music exceeds −60 dBFS only at 4.10–14.00 and 43.55–51.20 seconds:
29.4% occupancy and 29.55 seconds between audible phrases. This fixes wall-to-wall music.
The 59.722-second mix has 71.05% of 50 ms RMS windows below −40 dBFS and 46.28% below
−60 dBFS. Supplied old 2001dd5 recording has 0.10% and 0%, respectively. Before/after
routes and durations differ; these are recording observations, not a matched causal experiment.

Stem sum residual is 3.8e−8 in decoded mono. Listening OGG and audition WAV differ by
0.033 dB overall RMS and have the same threshold occupancy. They are a **pre-limiter stem-sum
unity-master audition**, not an independently recorded post-limiter gameplay delivery.
Mono decoder peaks include its channel summation; use Rook's stereo meter for delivery peaks.

The fixed-scale spectrogram shows two finite harmonic passages and substantial upper-spectrum
space. Regular narrow transients remain during walking, especially 20–31 seconds. There are
127 instrumented footfalls (100 grass, 19 wood, 8 stone) and one bird at 22.42 seconds; generic
spectral attacks are not bird counts. Reference packet d45d839 supports finite decays and gaps;
OST previews are not gameplay mixes and their absolute gains are not target levels.

## Independent machine descriptions

Ran Flint's Qwen2-Audio-7B tool independently with 30-second windows on the encoded audition
and the retained official Alba / A Short Hike previews. Prompt: “Describe the audible sounds
and how they change over this recording. What is the texture and mood? Do not estimate numeric
sound levels or timestamps.” Raw output is retained with the packet; Modal run
`ap-tyeUyNrkeaQKw1wc7xqzhg` completed successfully.

Candidate 0–30 seconds was described as static, writing and door taps; 30–59.7 seconds as
consistent drum beat and percussive rhythm. In the same run, Alba Summer Night was described
as soft, shimmering, mellow, warm and soothing; Short Hike Hello as soft flowing piano with
dynamic emotion. This reinforces the residual pulse/tap concern. It does **not** establish actual
source identity: the model misses the candidate harp and mislabels reference instruments.
This is the same model family Flint used, so it is an independent run, not an independent
model or human panel. Do not use its timing, implied looping, or imagined instrument labels
as measurements.

Keep the phrase scheduler. Next bounded review should isolate the remaining page flutter
and paws, addressing the known 9 Hz page modulation before judging a revised full audition.
Do not treat the measured quiet-space improvement as full listening approval.
