#!/usr/bin/env bash
# Self-hosted run: rent one GPU pod on RunPod, bootstrap ComfyUI, render both passes, download, delete the pod.
# Spend guard: a local watchdog deletes the pod after MAX_MIN minutes; the pod also removes itself.
# Usage: runpod_run.sh INPUT_DIR OUT.mp4     (INPUT_DIR from prep_t6_cloud.sh)
set -euo pipefail
IN=$1 OUT=$2
MAX_MIN=${MAX_MIN:-100}
HERE=$(cd "$(dirname "$0")" && pwd)
AWS="aws --profile ${BAMWARE_AWS_PROFILE:-bamware} --region ${BAMWARE_AWS_REGION:-us-east-1}"
K=$($AWS ssm get-parameter --name /bamware/video-spike/runpod-api-key --with-decryption --query Parameter.Value --output text)
API=https://rest.runpod.io/v1
BOOT=https://raw.githubusercontent.com/mrbam88/bamware-ai/spike/video-gen/scripts/video-spike/runpod_bootstrap.sh
body=$(python3 - "$BOOT" "$MAX_MIN" <<'PY'
import json, sys
print(json.dumps({
  "name": "bamware-video-spike", "imageName": "nvidia/cuda:12.8.1-cudnn-runtime-ubuntu22.04",
  "gpuTypeIds": ["NVIDIA H100 80GB HBM3", "NVIDIA H100 NVL", "NVIDIA H100 PCIe", "NVIDIA A100-SXM4-80GB", "NVIDIA A100 80GB PCIe"],
  "gpuCount": 1, "cloudType": "COMMUNITY", "containerDiskInGb": 120, "volumeInGb": 0, "ports": ["8188/http"],
  "env": {"MAX_MIN": sys.argv[2]},
  "dockerStartCmd": ["bash", "-c", f"apt-get update -qq && apt-get install -y -qq curl >/dev/null; curl -sL {sys.argv[1]} | bash"]}))
PY
)
resp=$(curl -s -X POST "$API/pods" -H "Authorization: Bearer $K" -H "Content-Type: application/json" -d "$body")
ID=$(echo "$resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
[ -n "$ID" ] || { echo "pod create failed: $resp" | head -c 600; exit 1; }
t0=$(date +%s)
echo "pod $ID created; GPU $(echo "$resp" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("machine",{}).get("gpuTypeId") or d.get("gpu",{}).get("displayName") or "?", "| $/hr", d.get("costPerHr"))')"
delete_pod() { curl -s -X DELETE "$API/pods/$ID" -H "Authorization: Bearer $K" >/dev/null && echo "pod $ID deleted after $(( ($(date +%s) - t0) / 60 )) min"; }
( sleep $((MAX_MIN * 60)); curl -s -X DELETE "$API/pods/$ID" -H "Authorization: Bearer $K" >/dev/null ) &
WATCHDOG=$!
trap 'delete_pod; kill $WATCHDOG 2>/dev/null || true' EXIT

URL="https://$ID-8188.proxy.runpod.net"
echo "waiting for ComfyUI at $URL (bootstrap installs + ~30 GB of models)..."
until curl -sf "$URL/system_stats" >/dev/null 2>&1; do sleep 20; done
echo "ComfyUI up after $(( ($(date +%s) - t0) / 60 )) min"; tb=$(date +%s)

R="$HERE/wan_animate_replace.py"
common=(--server "$URL" --unet Wan2.2-Animate-14B-Q8_0.gguf --sam2-device cuda --width 720 --height 720
        --pose-width 1440 --pose-height 1440 --frames 97 --segments 77,25 --steps 6)
python3 "$R" "${common[@]}" --video "$IN/full.mp4" --pose-video "$IN/left-hi.mp4" --ref "$IN/ref-left.png" \
  --prompt "An older South Asian man with short grey hair, a grey moustache and thin metal glasses, no hat, raps along to the song in a bright orange music studio, lips clearly mouthing every word, subtle head nods, realistic, natural lighting" \
  --prefix cloud-passA --download "$IN/passA.mp4"
ta=$(date +%s)
python3 "$R" "${common[@]}" --video "$IN/passA.mp4" --pose-video "$IN/right-hi.mp4" --ref "$IN/ref-right.png" \
  --prompt "An older South Asian woman with dark shoulder-length hair and dark glasses, wearing a green embroidered kurta, a red dupatta and lots of gold chains, bangles and big earrings, raps along to the song in a bright orange music studio, lips clearly mouthing every word, smooth subtle movements, realistic, natural lighting" \
  --prefix cloud-passB --download "$OUT"
tz=$(date +%s)
echo "timing: setup $(( (tb - t0) / 60 )) min | pass A $(( (ta - tb) / 60 )) min | pass B $(( (tz - ta) / 60 )) min | total $(( (tz - t0) / 60 )) min"
