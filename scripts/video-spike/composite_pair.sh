#!/usr/bin/env bash
# Put two single-person clips (Kling outputs) into ONE shared frame over a clean background.
# Each clip is cut out per frame with rembg and laid back where its source crop sat in the original.
#
# Geometry (source = 3840x2160 master): left crop x0=1157, right crop x0=1800, both 1215x2160.
# Canvas = x 1157..3015 of the master, scaled to height H. Free, local.
#
# BG is either one plate image, or a per-shot list "plate1.png@0,plate2.png@4.04,plate3.png@7.36"
# so the background cuts exactly where the original camera cuts.
# Masks are cached next to each clip (<clip>.masks/) and computed at half resolution (4x faster).
#
# Usage: composite_pair.sh LEFT.mp4 RIGHT.mp4 BG AUDIO_SRC.mp4 OUT.mp4 [H=1936] [MODEL=birefnet-general-lite]
set -euo pipefail
L=$1 R=$2 BG=$3 AUD=$4 OUT=$5 H=${6:-1936} MODEL=${7:-birefnet-general-lite}
REMBG=${REMBG:-$HOME/tools/rembgenv/bin/rembg}
s=$(python3 -c "print($H/2160)")
CW=$(python3 -c "print(int(round(1858*$s/2))*2)")
PW=$(python3 -c "print(int(round(1215*$s/2))*2)")
RX=$(python3 -c "print(int(round((1800-1157)*$s)))")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$L")
W=$(mktemp -d)

masks() {  # clip -> cached half-res masks dir
  local clip=$1 dir="$1.masks"
  local n; n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$clip")
  if [ -d "$dir" ] && [ "$(ls "$dir" | wc -l | tr -d ' ')" -ge "$n" ]; then echo "$dir"; return; fi
  rm -rf "$dir" "$W/half"; mkdir -p "$dir" "$W/half"
  ffmpeg -y -loglevel error -i "$clip" -vf "fps=30,scale=$((PW/2)):$((H/2))" "$W/half/%04d.png"
  "$REMBG" p -om -m "$MODEL" "$W/half" "$dir" >/dev/null 2>&1
  echo "$dir"
}

t0=$(date +%s)
ML=$(masks "$L"); MR=$(masks "$R")
echo "masks ready in $(( $(date +%s) - t0 ))s ($ML, $MR)"

# background: single image, or per-shot plates concatenated at the cut times
if [[ "$BG" == *@* ]]; then
  IFS=',' read -ra parts <<< "$BG"; : > "$W/bg.txt"
  for i in "${!parts[@]}"; do
    img=${parts[$i]%@*}; start=${parts[$i]#*@}
    if [ $((i+1)) -lt ${#parts[@]} ]; then end=${parts[$((i+1))]#*@}; else end=$DUR; fi
    ffmpeg -y -loglevel error -loop 1 -framerate 30 -t "$(python3 -c "print($end-$start)")" -i "$img" \
      -vf "scale=$CW:$H,setsar=1,format=yuv420p" -c:v libx264 -crf 12 "$W/bg$i.mp4"
    echo "file '$W/bg$i.mp4'" >> "$W/bg.txt"
  done
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$W/bg.txt" -c copy "$W/bg.mp4"
  BGIN=(-i "$W/bg.mp4")
else
  BGIN=(-loop 1 -framerate 30 -i "$BG")
fi

ffmpeg -y -loglevel error "${BGIN[@]}" -i "$L" -framerate 30 -i "$ML/%04d.png" -i "$R" -framerate 30 -i "$MR/%04d.png" -i "$AUD" \
  -filter_complex "[0:v]scale=$CW:$H,setsar=1,fps=30[bg];\
[1:v]fps=30,scale=$PW:$H[lc];[2:v]scale=$PW:$H,format=gray[lm];[lc][lm]alphamerge[l];\
[3:v]fps=30,scale=$PW:$H[rc];[4:v]scale=$PW:$H,format=gray[rm];[rc][rm]alphamerge[r];\
[bg][l]overlay=0:0:shortest=1[t];[t][r]overlay=$RX:0:shortest=1,format=yuv420p[v]" \
  -map "[v]" -map 5:a -c:v libx264 -crf 16 -preset slow -c:a aac -shortest "$OUT"
rm -rf "$W"
echo "wrote $OUT (${CW}x${H}, right person at x=$RX) in $(( $(date +%s) - t0 ))s"
