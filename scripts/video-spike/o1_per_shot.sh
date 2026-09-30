#!/bin/bash
# Per-shot render, ONE model for every shot (Hotel Lobby 21 s was the first run, 2026-09-30): Kling O1 outfit-anchored per camera shot, same refs throughout.
# Six shots from clip.mp4 (COLORS 0:15 onward): cuts at 4.04 7.36 11.20 14.92 18.44 21.32. Shot 5 padded to 3.2 s (O1 minimum 3 s).
# Anchors: keys/k<i>.png (FLUX-edited first frame of the shot, both people in place) when present; else the two start photos.
set -euo pipefail
# Inputs (not in git): fal/el/{him,her}-{front,b}.jpg face refs, fal/{him,her}-start*.png outfit photos, keys/k<i>.png anchors from flux_anchors.sh.
# Env: LEFT_DESC, RIGHT_DESC (one sentence each: age, build, hair, glasses, clothes).
export PATH=$HOME/.local/bin:$PATH
V=~/Movies/video-spike; F=$V/fal; SRC=$V/higgs/hotel-lobby-37-v2/clip.mp4; W=$V/higgs/hotel-lobby-21
S=~/code/bamware-ai/scripts/video-spike
LOG=$V/o1_21.log; mkdir -p $W/keys
log() { echo "$(date +%H:%M:%S) $*" | tee -a "$LOG"; }
PEOPLE="@Element1 is ${LEFT_DESC:?set LEFT_DESC: who replaces the LEFT performer, look + clothes}. @Element2 is ${RIGHT_DESC:?set RIGHT_DESC}. Nobody from the original video remains visible. Keep the camera, the orange set, the hanging microphone and every body movement, gesture and lip movement exactly as in the video. Photorealistic."
P_KEY="Replace BOTH performers so the video matches @Image1, which shows the two replacement people standing exactly in the performers' places. The performer on the left becomes @Element1 and the performer on the right becomes @Element2. $PEOPLE"
P_PHOTO="Replace BOTH performers. The performer on the left becomes @Element1, dressed exactly as in @Image1. The performer on the right becomes @Element2, dressed exactly as in @Image2. $PEOPLE"
STARTS=(0 4.04 7.36 11.20 14.92 18.44); DURS=(4.04 3.32 3.84 3.72 3.52 3.20)
for i in 0 1 2 3 4 5; do
  [ -f $W/in-$i.mp4 ] || ffmpeg -y -loglevel error -ss ${STARTS[$i]} -i $SRC -t ${DURS[$i]} -c:v libx264 -crf 14 -c:a aac $W/in-$i.mp4
done
[ "${1:-}" = "--cut-only" ] && { log "inputs cut"; exit 0; }
for i in 0 1 2 3 4 5; do
  [ -f $W/out-$i.mp4 ] && continue
  if [ -f $W/keys/k$i.png ]; then IMG=(--image $W/keys/k$i.png); PR="$P_KEY"; else IMG=(--image $F/him-start-o1.png --image $F/her-start-v3.png); PR="$P_PHOTO"; fi
  log "shot $i start (${DURS[$i]} s, anchor: ${IMG[*]##*/})"
  bash $S/fal_env.sh $S/fal_kling_o1_edit.py $W/in-$i.mp4 $W/out-$i.mp4 --prompt "$PR" \
    --element $F/el/him-front.jpg,$F/el/him-b.jpg --element $F/el/her-front.jpg,$F/el/her-b.jpg "${IMG[@]}" 2>&1 | grep -v WARN | tee -a "$LOG"
  log "shot $i done"
done
d() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
FC=""; IN=""
for i in 0 1 2 3 4 5; do
  f=$(python3 -c "print(${DURS[$i]}/$(d $W/out-$i.mp4))"); t=${DURS[$i]}; [ $i = 5 ] && t=2.88
  IN="$IN -i $W/out-$i.mp4"
  FC="$FC[$i:v]setpts=PTS*$f,fps=30,scale=1280:720,setsar=1,trim=0:$t,setpts=PTS-STARTPTS,delogo=x=42:y=591:w=86:h=90[s$i];"
done
OUT=$V/higgs/hotel-lobby-21-v2.mp4
ffmpeg -y -loglevel error $IN -ss 0 -t 21.32 -i $V/higgs/hotel-lobby-37-v2/song.m4a -filter_complex \
  "${FC}[s0][s1][s2][s3][s4][s5]concat=n=6:v=1:a=0,eq=contrast=1.03:saturation=1.02[v]" \
  -map "[v]" -map 6:a -c:v libx264 -crf 17 -preset slow -c:a aac -shortest $OUT
log "final: $(d $OUT) s"
LABEL="21 s: Kling O1 anchored on every shot" bash $S/discord_upload.sh \
  "🎬 21 s v2: one model for all six shots (Kling O1 outfit-anchored, same refs), per-shot anchors, logo removed, one grade. Real song.|$OUT" | tee -a "$LOG"
log "done"
