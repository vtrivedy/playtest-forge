#!/usr/bin/env bash
# Sumiro look check (DESIGN-sumiro-look.md): fixed camera spots per world, then each still beside its bible frame.
#   tools/sumiro-look-stills.sh press|ashwater [out]
# Spots never move between runs, so a look change is judged pair against pair, not by vibe.
set -euo pipefail
world=${1:-press}
out=${2:-/tmp/sumiro-look-$world}
case $world in
  press)
    chase="p1_arrival:-700,123,3.14;p4_gate:-700,106,3.14;p5_shelf:-690,85,3.14"
    cam="p0_close:-672,6,90:-650,14,85;p2_net:-686,7,128:-730,14,70;p6_wide:-680,14,135:-700,4,75;p7_horizon:-700,3,120:-700,12,40" ;;
  ashwater)
    chase="a1_arrival:700,120,3.14"
    cam="a2_horizon:700,9,128:700,3,60;a3_banks:690,5,110:710,1,80;a4_wide:672,12,52:705,0,95" ;;
esac
node tools/world-stills.mjs --out "$out" --chase "$chase" --cam "$cam" | tail -8
python3 -I tools/sumiro-pair.py "$out" "games/fox-spirit/refs/bible/bible-$world.jpg"
