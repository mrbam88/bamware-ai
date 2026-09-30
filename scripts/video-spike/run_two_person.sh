#!/bin/bash
# Two-pass square 3 s: pass A replaces the left performer (him), pass B replaces the right (her) on top.
set -euo pipefail
pkill -f 'mlx-serve serve' || true
cd ~/tools/ComfyUI/input
ffmpeg -y -loglevel error -i ~/Movies/video-spike/refs/faces/woman-1944-bling.png -vf "crop=704:1300:0:0,scale=-2:624,pad=624:624:(ow-iw)/2:0:color=0x808080" ref-woman-bling-sq.png
S=~/code/bamware-ai/.claude/worktrees/video-gen-spike/scripts/video-spike/wan_animate_replace.py
python3 "$S" --video t3sq-full.mp4 --pose-video t3sq-left-hi.mp4 --pose-width 1248 --pose-height 1248 \
  --ref ref-man-sq.png --width 624 --height 624 --frames 49 --steps 6 \
  --prompt "An older South Asian man with short grey hair, a grey moustache and thin metal glasses, no hat, raps along to the song in a bright orange music studio, lips clearly mouthing every word, subtle head nods, realistic, natural lighting" \
  --prefix wan-t3sq-passA
A=$(ls -t ~/tools/ComfyUI/output/wan-t3sq-passA_*-audio.mp4 | head -1)
cp "$A" t3sq-passA.mp4
LUMA=$(ffmpeg -loglevel info -i t3sq-passA.mp4 -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep YAVG | awk -F= '{s+=$2; n++} END {printf "%d", s/n}')
echo "pass A mean luma $LUMA"
[ "$LUMA" -gt 25 ] || { echo "pass A is black - stopping"; exit 1; }
python3 "$S" --video t3sq-passA.mp4 --pose-video t3sq-right-hi.mp4 --pose-width 1248 --pose-height 1248 \
  --ref ref-woman-bling-sq.png --width 624 --height 624 --frames 49 --steps 6 \
  --prompt "An older South Asian woman with dark shoulder-length hair and dark glasses, wearing a green embroidered kurta, a red dupatta and lots of gold chains, bangles and big earrings, raps along to the song in a bright orange music studio, lips clearly mouthing every word, smooth subtle movements, realistic, natural lighting" \
  --prefix wan-t3sq-both
B=$(ls -t ~/tools/ComfyUI/output/wan-t3sq-both_*-audio.mp4 | head -1)
cp "$B" ~/Movies/video-spike/runs/08-wan-both-square-3s.mp4
echo "final: ~/Movies/video-spike/runs/08-wan-both-square-3s.mp4"
