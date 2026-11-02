---
name: updraft-sprite-visibility
description: Verify foreground ember and leaf billboards cannot fill the lens and veil the fox after updraft appearance changes.
---

A free, correctly framed fox can still be hidden by foreground billboards. Keep
near sprites faint and bounded while retaining the distant riding column.

Runtime source: `games/fox-spirit/src/chem/updraft.ts` ember/leaf vertex shader.
Actual GPU raster check (boots the real scene and clones its kiln shader):

```sh
node tools/updraft-sprite-probe.mjs /tmp/sprite-proof --baseline-sha 60e4a2c
```

This samples individual ember/leaf pixels at0.5/1.5/3m, requires near sprites to
fade, bounded intermediate footprints and visible farther particles. The old
unbounded shader fills the96×96 ember test frame at0.5m and fails four cases.
This is a render regression check, not a source-text pattern check. It excludes
bloom and overlapping clouds, so also replay the actual kiln hold/rise:

```sh
node tools/camera-drop-probe.mjs OUT .07 70 5198 \
  --route-module tools/millbrook-camera-route.mjs --check-from 1 \
  --expect-beat 'complete Millbrook' --dt 0.03333333333333333 \
  --size 480x270 --check-camera --sparse-stills \
  --clip --clip-from 29 --clip-seconds 8 --check-silhouette
```

Inspect all retained frames for face/body visibility and continued readability
of the warm-air column. Preserve __game, source SHA, clip and staged-start/offline
scope. This appearance guard must not alter lift, heat, timers or colliders.
