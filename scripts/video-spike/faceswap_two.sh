#!/bin/bash
# Swap two people onto a two-person clip with FaceFusion, one pass each.
# Usage: faceswap_two.sh LEFT_FACE.jpg RIGHT_FACE.jpg TARGET.mp4 OUT.mp4
# Needs FaceFusion 3.9.0 at ~/tools/facefusion-3.9.0 with its .venv (see docs/video-gen-spike.md).
set -euo pipefail
FF=~/tools/facefusion-3.9.0
LEFT=$1 RIGHT=$2 TARGET=$3 OUT=$4
MID="${OUT%.mp4}-pass1.mp4"
common=(--processors face_swapper face_enhancer --face-swapper-model hyperswap_1b_256
  --face-swapper-pixel-boost 512x512 --face-enhancer-model gfpgan_1.4 --face-enhancer-blend 60
  --face-selector-mode reference --face-selector-order left-right
  --execution-providers coreml cpu --output-video-quality 90)
cd "$FF"
t0=$(date +%s)
.venv/bin/python facefusion.py headless-run -s "$LEFT" -t "$TARGET" -o "$MID" "${common[@]}" --reference-face-position 0
.venv/bin/python facefusion.py headless-run -s "$RIGHT" -t "$MID" -o "$OUT" "${common[@]}" --reference-face-position 1
echo "done in $(( $(date +%s) - t0 ))s -> $OUT"
