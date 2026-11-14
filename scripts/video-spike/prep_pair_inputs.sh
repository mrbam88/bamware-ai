#!/usr/bin/env bash
# Inputs for runpod_wan_pair.sh from one shot of a two-person clip (performers left and right of SPLIT_X).
# Usage: prep_pair_inputs.sh SRC.mp4 START DUR SPLIT_X REF_LEFT REF_RIGHT "prompt left" "prompt right" OUT_DIR
# SPLIT_X is in source pixels. Refs are padded to the render aspect on grey. ffmpeg only.
set -euo pipefail
SRC=$1 START=$2 DUR=$3 X=$4 RL=$5 RR=$6 PL=$7 PR=$8 OUT=$9
W=${W:-1280} H=${H:-720}
mkdir -p "$OUT"
ffmpeg -y -loglevel error -ss "$START" -t "$DUR" -i "$SRC" -c:v libx264 -crf 14 -c:a aac "$OUT/full.mp4"
ffmpeg -y -loglevel error -i "$OUT/full.mp4" -vf "drawbox=x=$X:y=0:w=iw-$X:h=ih:color=black:t=fill" -c:v libx264 -crf 14 -an "$OUT/left-hi.mp4"
ffmpeg -y -loglevel error -i "$OUT/full.mp4" -vf "drawbox=x=0:y=0:w=$X:h=ih:color=black:t=fill" -c:v libx264 -crf 14 -an "$OUT/right-hi.mp4"
for s in left:"$RL" right:"$RR"; do
  ffmpeg -y -loglevel error -i "${s#*:}" -vf "scale=-2:$H,pad=$W:$H:(ow-iw)/2:0:color=0x808080" -frames:v 1 "$OUT/ref-${s%%:*}.png"
done
printf '%s' "$PL" > "$OUT/prompt-left.txt"; printf '%s' "$PR" > "$OUT/prompt-right.txt"
ffmpeg -y -loglevel error -i "$OUT/left-hi.mp4" -i "$OUT/right-hi.mp4" -filter_complex "[0:v]select=eq(n\,0),scale=640:-1[a];[1:v]select=eq(n\,0),scale=640:-1[b];[a][b]hstack" -frames:v 1 "$OUT/split-check.jpg"
ls "$OUT"
