#!/bin/sh
# Scripted capture on a CPU box: software GL (Xvfb + llvmpipe), Compatibility renderer.
#   tools/capture.sh OUT_DIR [godot user args…]      e.g. tools/capture.sh /tmp/c --poses=spawn,well
#   MOVIE=1 tools/capture.sh OUT_DIR --route=hero     also writes OUT_DIR/route.avi (movie maker, 30 fps)
cd "$(dirname "$0")/.." || exit 1
out="$1"; shift
mkdir -p "$out"
godot --headless --path . --import >/dev/null 2>&1
movie=""
[ -n "$MOVIE" ] && movie="--write-movie $out/route.avi --fixed-fps 30"
xvfb-run -a -s "-screen 0 1280x720x24" godot --path . --rendering-driver opengl3 $movie -- --out="$out" "$@" 2>&1 \
  | grep -vE "ALSA|^\s*$|audio|init_output_device|V-Sync|set_use_vsync|ERR_CANT_OPEN"
