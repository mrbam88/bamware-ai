#!/bin/bash
# Identity repair pass over a finished render (first run: Hotel Lobby v4 -> v5, 2026-10-01): FaceFusion, one pass per person, lips excluded so the Higgsfield
# lip sync survives. Positional + gender selection. Then grade, 37 s + 21.3 s cuts, contact sheets, Discord.
set -uo pipefail
R=~/Movies/video-spike/repair; F=~/Movies/video-spike/faces; IN=~/Movies/video-spike/higgs/hotel-lobby-37-v4.mp4
LOG=$R/overnight.log; log(){ echo "$(date +%H:%M:%S) $*" | tee -a "$LOG"; }
cd ~/facefusion && . .venv/bin/activate
COMMON="--processors face_swapper face_enhancer --face-swapper-model hyperswap_1a_256 --face-swapper-pixel-boost 512x512 --face-swapper-weight 0.8 --face-enhancer-model gfpgan_1.4 --face-enhancer-blend 50 --face-mask-types box region --face-mask-regions skin left-eyebrow right-eyebrow left-eye right-eye nose glasses --face-detector-model yolo_face --face-selector-mode one --execution-providers coreml cpu --execution-thread-count 6 --output-video-encoder libx264 --output-video-quality 92"
log "pass A (him) start"
python facefusion.py headless-run $COMMON --face-selector-order left-right --face-selector-gender male --source-paths $F/him-front.jpg $F/him-b.jpg --target-path $IN --output-path $R/passA.mp4 2>&1 | tr '\r' '\n' | grep -E 'succeeded|rror|failed' | tail -3 | tee -a "$LOG"
[ -f $R/passA.mp4 ] || { log "pass A FAILED"; exit 1; }
log "pass B (her) start"
python facefusion.py headless-run $COMMON --face-selector-order right-left --face-selector-gender female --source-paths $F/her-front.jpg $F/her-b.jpg --target-path $R/passA.mp4 --output-path $R/passB.mp4 2>&1 | tr '\r' '\n' | grep -E 'succeeded|rror|failed' | tail -3 | tee -a "$LOG"
[ -f $R/passB.mp4 ] || { log "pass B FAILED"; exit 1; }
log "assemble"
ffmpeg -y -loglevel error -i $R/passB.mp4 -i $IN -map 0:v -map 1:a -vf "eq=contrast=1.02:saturation=1.02" -c:v libx264 -crf 17 -preset slow -c:a aac -shortest $R/hotel-lobby-37-v5.mp4
ffmpeg -y -loglevel error -i $R/hotel-lobby-37-v5.mp4 -t 21.32 -c:v libx264 -crf 17 -preset slow -c:a aac $R/hotel-lobby-21-v5.mp4
ffmpeg -y -loglevel error -i $R/hotel-lobby-37-v5.mp4 -vf "fps=1,scale=320:-1,tile=6x7" -frames:v 1 $R/sheet-v5.jpg
ffmpeg -y -loglevel error -i $IN -i $R/hotel-lobby-37-v5.mp4 -filter_complex "[0:v]fps=1,scale=320:-1,crop=200:180:300:0[a];[1:v]fps=1,scale=320:-1,crop=200:180:300:0[b];[a][b]hstack,tile=4x10" -frames:v 1 $R/faces-before-after.jpg
log "final: $(ffprobe -v error -show_entries format=duration -of csv=p=0 $R/hotel-lobby-37-v5.mp4) s"
scp -q -o ConnectTimeout=10 $R/hotel-lobby-37-v5.mp4 $R/hotel-lobby-21-v5.mp4 omarchy:~/Movies/video-spike/higgs/ && \
ssh -o ConnectTimeout=10 -o BatchMode=yes omarchy 'export PATH=$HOME/.local/bin:$PATH; S=~/code/bamware-ai/scripts/video-spike; LABEL="v5: identity repair (FaceFusion, lips kept)" bash $S/discord_upload.sh "🎬 v5 overnight: v4 hybrid + real-face identity pass on both (lips untouched), 37 s.|$HOME/Movies/video-spike/higgs/hotel-lobby-37-v5.mp4"; LABEL="v5 21 s" bash $S/discord_upload.sh "🎬 v5, 21.3 s trim.|$HOME/Movies/video-spike/higgs/hotel-lobby-21-v5.mp4"' 2>&1 | tail -2 | tee -a "$LOG"
log "done"
