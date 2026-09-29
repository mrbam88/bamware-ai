#!/usr/bin/env bash
# Post video files to the Bamware Discord status channel (webhook from the vault, never printed).
# Files over 9.5 MB are re-encoded to fit Discord's 10 MB upload limit.
# Usage: discord_upload.sh "caption|/path/clip.mp4" ["caption|/path/clip2.mp4" ...]
set -euo pipefail
HOOK=$(aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" --region "${BAMWARE_AWS_REGION:-us-east-1}" \
  ssm get-parameter --name /bamware/shared/discord-webhook-status --with-decryption --query Parameter.Value --output text)
TMP=$(mktemp -d)
LIMIT=9500000
HERE=$(cd "$(dirname "$0")" && pwd)
PY=${LABEL_PY:-$HOME/tools/rembgenv/bin/python}
label_for() {  # model name burned onto the video (override with LABEL=...)
  [ -n "${LABEL:-}" ] && { echo "$LABEL"; return; }
  case "$(basename "$1")" in
    *grid*) echo "" ;;  # bake-off grids carry per-tile labels
    *o1-lipsync*) echo "Kling O1 edit + Sync Labs lipsync-2-pro" ;;
    *before-after*) echo "Kling O1 edit (re-synced) | + Sync Labs lipsync-2-pro" ;;
    *hybrid*|*shared*) echo "Kling v3 Pro Motion Control x2 + height-true composite" ;;
    *kling-o1*) echo "Kling O1 edit" ;;
    *kling*) echo "Kling v3 Pro Motion Control" ;;
    *fal-both*) echo "fal.ai Wan 2.2 Animate Replace" ;;
    *wan-replace*|*wan-both*) echo "Wan 2.2 Animate (local, M3)" ;;
    *) echo "" ;;
  esac
}
for item in "$@"; do
  caption=${item%|*}; f=${item##*|}   # split at the LAST | (captions may contain markdown tables)
  lab=$(label_for "$f")
  if [ -n "$lab" ]; then
    "$PY" "$HERE/label_video.py" "$f" "$TMP/labelled-$(basename "$f")" "$lab" >/dev/null && f="$TMP/labelled-$(basename "$f")"
  fi
  up="$f"
  if [ "$(stat -f%z "$f")" -gt $LIMIT ]; then
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    # target ~9 MB total: video bitrate = 9 MB*8/duration - 128k audio
    vb=$(python3 -c "print(int(9.0e6*8/float('$dur') - 128e3))")
    up="$TMP/$(basename "$f")"
    ffmpeg -y -loglevel error -i "$f" -vf "scale='min(1080,iw)':-2" -c:v libx264 -b:v "$vb" -maxrate "$vb" -bufsize "$((vb*2))" \
      -preset slow -c:a aac -b:a 128k -movflags +faststart "$up"
  fi
  code=$(curl -s -o "$TMP/resp.json" -w '%{http_code}' \
    --form-string "payload_json=$(jq -n --arg c "$caption" '{username: "Bamware", content: $c}')" \
    -F "files[0]=@$up" "$HOOK")
  printf '%s  %s  (%.1f MB)\n' "$code" "$(basename "$f")" "$(echo "$(stat -f%z "$up") / 1000000" | bc -l)"
  [[ "$code" == 20[04] ]] || head -c 300 "$TMP/resp.json"
done
rm -rf "$TMP"
