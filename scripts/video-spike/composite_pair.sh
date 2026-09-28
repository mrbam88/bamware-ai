#!/usr/bin/env bash
# Put two single-person clips (Kling outputs) into ONE shared frame over a clean plate.
# Each clip is cut out per frame with rembg, then laid back where its source crop sat in the original.
#
# Geometry (source = 3840x2160 master): left crop x0=1157, right crop x0=1800, both 1215x2160.
# Canvas = x 1157..3015 of the master, scaled to height H. Free, local.
#
# Usage: composite_pair.sh LEFT.mp4 RIGHT.mp4 PLATE.png AUDIO_SRC.mp4 OUT.mp4 [H=1936] [MODEL=birefnet-general-lite]
set -euo pipefail
L=$1 R=$2 PLATE=$3 AUD=$4 OUT=$5 H=${6:-1936} MODEL=${7:-birefnet-general-lite}
REMBG=${REMBG:-$HOME/tools/rembgenv/bin/rembg}
s=$(python3 -c "print($H/2160)")
CW=$(python3 -c "print(int(round(1858*$s/2))*2)")
PW=$(python3 -c "print(int(round(1215*$s/2))*2)")
RX=$(python3 -c "print(int(round((1800-1157)*$s)))")
W=$(mktemp -d)
mkdir -p "$W/l" "$W/r" "$W/la" "$W/ra"
ffmpeg -y -loglevel error -i "$L" -vf "fps=30,scale=$PW:$H" "$W/l/%04d.png"
ffmpeg -y -loglevel error -i "$R" -vf "fps=30,scale=$PW:$H" "$W/r/%04d.png"
t0=$(date +%s)
"$REMBG" p -m "$MODEL" "$W/l" "$W/la" >/dev/null 2>&1
"$REMBG" p -m "$MODEL" "$W/r" "$W/ra" >/dev/null 2>&1
echo "matting: $(( $(date +%s) - t0 ))s for $(ls "$W/la" | wc -l | tr -d ' ') + $(ls "$W/ra" | wc -l | tr -d ' ') frames"
ffmpeg -y -loglevel error -loop 1 -framerate 30 -i "$PLATE" -framerate 30 -i "$W/la/%04d.png" -framerate 30 -i "$W/ra/%04d.png" -i "$AUD" \
  -filter_complex "[0:v]scale=$CW:$H,setsar=1[bg];[bg][1:v]overlay=0:0:shortest=1[t];[t][2:v]overlay=$RX:0:shortest=1,format=yuv420p[v]" \
  -map "[v]" -map 3:a -c:v libx264 -crf 16 -preset slow -c:a aac -shortest "$OUT"
rm -rf "$W"
echo "wrote $OUT (${CW}x${H}, right person at x=$RX)"
