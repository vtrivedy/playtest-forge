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
It checks free exits, exits with an obstructing ledge, a raised terrain ridge, and a convex post at30/60/120Hz; the old
free-pose early return fails. A free destination does not imply its connecting
segment is free. Keep the escape search active when a gradual release segment
is blocked. Played runtime `cff7a25` is reviewed in
`docs/reviews/swarm4/fern-finale-cff7a25.md`; the nine-state model still covers
publication order only. After this solver changes, also play
`tools/finale-camera-probe.mjs OUT --clip` (staged crag→Press→meadow) and review
both crag release and return-bank frames.

Natural approach history matters: cold dev-release bridge starts miss the held
clearance pose after the steam/terrace climb. Play the complete authored route:

```sh
node tools/camera-drop-probe.mjs /captures/camera-keeping .07 110 5198 --route-module tools/keeping-camera-route.mjs --check-from 1 --dt 0.03333333333333333 --size 640x360 --expect-beat 'a leaf comes down' --check-camera --sparse-stills --stills-at 40,50,65,109 --clip --clip-beat 'cross the bridge' --clip-seconds 4 --check-silhouette
```

Require real steam/root/bridge/crag state checks, not just a final route label.
A tiny fox may pass full-body viewport bounds. The probe also checks grounded
follow distance≤5m after1s grounded, and projected0.6m feet-to-ears height≥H/15
(24px at360h); more than1s below the height floor fails outside authored shots.
Retain the exact minimum and longest small interval, including transient dips.
The excessive `--min-fox-pixels 200` negative run must fail independently;200px
is not the normal acceptance floor. Projection does not prove visibility.

Recovery must validate intended endgoals before clipping their bounded next
step, and test swept terrain/collider clearance. Otherwise an impossible goal
can keep winning with small local oscillations. The post fixture includes a
constant-visible proxy as well as an actual visibility ray; collision geometry
can exceed its rendered proxy. Do not remove that fixture. These finite checks
do not prove arbitrary pathfinding completeness. Current review and actual
source-pinned natural route evidence: `docs/reviews/swarm4/fern-bridge-recovery-final.md`.
