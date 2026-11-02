---
name: camera-envelope-check
description: Recheck the Keeping follow-camera ordering and ruin failed-catch framing after changing camera collision, floor correction, or body clearance.
---

A follow camera must apply its body-envelope constraint after floor correction;
otherwise a free lens can still enter the fox or become an overhead view.

Source: `games/fox-spirit/src/camera.ts` (`clearLensVolume`, final output ordering).
Model: `games/fox-spirit/tla/CameraEnvelope.tla` and `.cfg`.

From repository root:

```sh
tlc -workers 2 -config games/fox-spirit/tla/CameraEnvelope.cfg games/fox-spirit/tla/CameraEnvelope.tla
```

The model abstracts geometry to whether the envelope query ran and verifies ordering plus eventual
publication, not collision-search completeness, pitch, silhouette, or smoothness.
Its deliberate broken variant (Envelope leaves checked FALSE; Publish omits guard)
violates FollowChecked in five states. Recheck that the model still matches the
code when changing stage order. Runtime-sync evidence is recorded in KNOWLEDGE.md.

Play both successful and failed-input routes with `tools/camera-drop-probe.mjs`.
Use `--miss-overlook` to omit jump on the overlook approach (no phase forcing),
`--min-distance N` to compare tuning, and `--clip --clip-from S --clip-seconds N`
for continuous motion. Keep named SHA, __game, late distance/pitch/speed metrics,
and at least two actual rendered stills. A numeric pass does not establish a
readable fox: inspect all clip frames for ear/tail cropping and wall occlusion.

For release continuity, run `npx tsx tools/camera-envelope-release-check.ts`.
It checks free exits and exits with an obstructing ledge at30/60/120Hz; the old
free-pose early return fails. A free destination does not imply its connecting
segment is free. Keep the escape search active when a gradual release segment
is blocked. Played runtime `cff7a25` is reviewed in
`docs/reviews/swarm4/fern-finale-cff7a25.md`; the nine-state model still covers
publication order only. After this solver changes, also play
`tools/finale-camera-probe.mjs OUT --clip` (staged crag→Press→meadow) and review
both crag release and return-bank frames.
