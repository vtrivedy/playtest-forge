# The Keeping — Godot 4.7 port (opening slice)

Port of the three.js redesign opening (`games/fox-spirit/src/opening/*` on `redesign-p0-lookdev`) to
Godot 4.7, GDScript only, Compatibility renderer (same look on desktop and WebGL2).
System map: [PORT_PLAN.md](PORT_PLAN.md). Honest comparison: [FEEL.md](FEEL.md).

Wake in the sepia village of Lanternhollow, carry the paint down the hub lane through the lych-gate
into Arrival Meadow, light the cold hearth H-a by running close (or dashing past), then jump and hold
to ride its warm air onto the rock shelf.

**Controls:** WASD / arrows move (camera-relative) · Space jump, hold to glide · Shift dash · Ctrl walk.

## Run

```sh
godot --path games/fox-spirit-godot                 # play (editor: open project.godot)
godot --headless --path games/fox-spirit-godot --export-release Linux build/linux/fox-spirit-godot.x86_64
godot --headless --path games/fox-spirit-godot --export-release Web   build/web/index.html
```

## Capture (CPU box: Xvfb + llvmpipe)

```sh
tools/capture.sh OUT --poses=spawn,well,meadow,hearth          # chase stills at the three.js opening-stills poses
tools/capture.sh OUT --shots=overview,village --paint=full     # fixed review cameras, slice flooded with paint
MOVIE=1 tools/capture.sh OUT --route=hero --stills=gate@9,meadow@14
                                                               # real-input route → OUT/route.avi + stills + state.jsonl
tools/side_by_side.sh three.png godot.png out.png "caption"    # labelled comparison still
node tools/web-smoke.mjs OUT                                   # boot the web export in headless Chromium
```

`state.jsonl` is the Godot equivalent of `window.__game.state()`: fox (pos, speed, gait, playback rate,
last jump apex/air), hearth reactor + ride log, paint trail/supply/distance, occluder fades.

## Assets

- `assets/hero/hearth_fox.glb` — Emberkit hearth-fox B, authored in this repo
  (`tools/blender/scripts/hearth_fox_*.py`; repo licence MIT per `package.json`). No third-party assets; everything else is
  procedural geometry built at load (`scripts/meadow.gd`, `scripts/village.gd`, `scripts/props.gd`).
