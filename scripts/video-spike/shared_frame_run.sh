#!/usr/bin/env bash
# End to end: Kling v3 Pro Motion Control per person (parallel, face-locked) -> shared-frame composite -> Discord.
# Costs ~$0.168/s per person. Inputs are prepared under ~/Movies/video-spike/fal (see docs/video-gen-spike.md).
# Usage: shared_frame_run.sh TAG SECONDS
set -euo pipefail
TAG=${1:-t10} SEC=${2:-10}
F=~/Movies/video-spike/fal
R=~/Movies/video-spike/runs
S=$(cd "$(dirname "$0")" && pwd)
t0=$(date +%s)
bash "$S/fal_env.sh" "$S/fal_kling_motion.py" "$F/kling-start-him-v2.png" "$F/$TAG-him-vertical.mp4" "$R/$TAG-kling-him.mp4" \
  --face-front "$F/el/him-front.jpg" --face-ref "$F/el/him-b.jpg" --face-ref "$F/el/him-c.jpg" \
  --prompt "@Element1 is a tall six-foot older South Asian man with short grey hair, a grey moustache and thin metal glasses, rapping in a bright orange music studio, lips mouthing every word, realistic" &
P1=$!
bash "$S/fal_env.sh" "$S/fal_kling_motion.py" "$F/her-start-real.png" "$F/$TAG-her-vertical.mp4" "$R/$TAG-kling-her.mp4" \
  --face-front "$F/el/her-front.jpg" --face-ref "$F/el/her-b.jpg" --face-ref "$F/el/her-mountain.jpg" \
  --prompt "@Element1 is an older South Asian woman with dark shoulder-length hair and dark glasses, wearing a green embroidered kurta, a red dupatta and heavy gold jewelry, rapping in a bright orange music studio, lips mouthing every word, smooth movements, realistic" &
P2=$!
wait $P1; wait $P2
echo "kling done in $(( $(date +%s) - t0 ))s"
bash "$S/composite_pair.sh" "$R/$TAG-kling-him.mp4" "$R/$TAG-kling-her.mp4" "$F/plate-clean.png" "$R/$TAG-kling-him.mp4" "$R/$TAG-shared-frame.mp4"
bash "$S/discord_upload.sh" "🎬 Hotel Lobby: ${SEC} s, both in ONE shared frame (Kling v3 Pro, face-locked to album photos; her new real-photo start). ~\$$(python3 -c "print(round($SEC*0.168*2,2))"), $(( ($(date +%s) - t0) / 60 )) min|$R/$TAG-shared-frame.mp4"
echo "all done in $(( $(date +%s) - t0 ))s"
