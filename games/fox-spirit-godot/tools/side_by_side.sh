#!/bin/sh
# Labelled side-by-side still: tools/side_by_side.sh THREE.png GODOT.png OUT.png "caption"
f=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
ffmpeg -loglevel error -y -i "$1" -i "$2" -filter_complex \
  "[0]scale=960:540,drawtext=fontfile=$f:text='three.js (redesign-p0-lookdev)':x=12:y=12:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6[a];\
   [1]scale=960:540,drawtext=fontfile=$f:text='Godot 4.7 port':x=12:y=12:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6[b];\
   [a][b]hstack=inputs=2,drawtext=fontfile=$f:text='$4':x=(w-tw)/2:y=h-34:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6" "$3"
