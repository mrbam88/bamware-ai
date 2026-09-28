#!/usr/bin/env bash
# Re-lay the song under a generated clip whose picture runs OFFSET seconds ahead of the source
# (Kling O1 edit shifted content 1.87 s early; detect it by comparing camera-cut times).
# Usage: resync_audio.sh IN.mp4 AUDIO_SRC.mp4 AUDIO_START_S OFFSET_S OUT.mp4
#   AUDIO_START_S = where the driving clip began in AUDIO_SRC; output keeps only the part with source cover.
set -euo pipefail
IN=$1 SRC=$2 A0=$3 OFF=$4 OUT=$5
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
KEEP=$(python3 -c "print(round(min($DUR, 10.0 - $OFF), 2))")
ffmpeg -y -loglevel error -i "$IN" -ss "$(python3 -c "print($A0 + $OFF)")" -i "$SRC" -t "$KEEP" \
  -map 0:v -map 1:a -c:v libx264 -crf 16 -preset slow -c:a aac -shortest "$OUT"
echo "wrote $OUT ($KEEP s, audio from $SRC @ $(python3 -c "print($A0 + $OFF)") s)"
