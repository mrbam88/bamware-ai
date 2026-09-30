#!/bin/bash
# DO NOT feed these stills to the video model as a people reference: on 2026-09-30 Kling O1 copied FLUX's
# invented faces and the real likeness was lost. Kept for layout/height planning only.
# One anchor still per camera shot: the shot's first frame with the two people painted into the performers'
# places by local FLUX (mlx-serve, free, ~200 s each on the M3). Same two reference photos for every shot, so
# clothes, jewelry, hair and height stay identical across shots. Run on the Mac; copy keys/ to the render server.
# Usage: flux_anchors.sh CLIP.mp4 OUTDIR "t0 t1 t2 ..." HIM.png HER.png   (t = shot start seconds)
set -uo pipefail
CLIP=$1; OUT=$2; STARTS=$3; HIM=$4; HER=$5
S=$(cd "$(dirname "$0")" && pwd); mkdir -p "$OUT/frames" "$OUT/keys"
P="Image 1 is a frame from a music video: two performers in an orange studio with a hanging microphone. Replace the performer on the left with the man from image 2 and the performer on the right with the woman from image 3. Keep each person's exact pose, position, size and gesture, the camera framing, the orange set, the microphone and the lighting. Remove the small white logo in the bottom-left corner. The background is a plain, evenly lit orange studio wall with nothing on it: no panels, no foam, no objects anywhere. Photorealistic, same film look."
i=0
for t in $STARTS; do
  ffmpeg -v error -y -ss "$(python3 -c "print($t+0.04)")" -i "$CLIP" -frames:v 1 "$OUT/frames/f$i.png"
  [ -f "$OUT/keys/k$i.png" ] || python3 "$S/flux_keyframe.py" "$OUT/keys/k$i.png" --prompt "$P" --image "$OUT/frames/f$i.png" --ref "$HIM" --ref "$HER" --width 1280 --height 720 --seed "${SEED:-21}" || echo "k$i failed"
  i=$((i+1))
done
ffmpeg -v error -y -i "$OUT/keys/k%d.png" -vf "scale=426:-1,tile=3x2" -frames:v 1 "$OUT/keys-sheet.jpg"
echo "check $OUT/keys-sheet.jpg before spending on renders (FLUX invents wall panels sometimes; reroll with SEED=)"
