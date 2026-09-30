#!/usr/bin/env bash
# Rented-GPU test, SSH-driven: create a pod that keeps the image's own startup (/start.sh runs sshd),
# SSH in, run the bootstrap with visible logs, tunnel ComfyUI, render, download, delete the pod.
# Spend guard: local watchdog deletes the pod after MAX_MIN minutes.
# Usage: runpod_ssh_test.sh GPU_TYPE_ID OUTDIR
set -euo pipefail
GPU=${1:-"NVIDIA GeForce RTX 4090"} OUTD=${2:-$HOME/Movies/video-spike/runs/runpod}
MAX_MIN=${MAX_MIN:-60} UNET=${UNET:-Wan2.2-Animate-14B-Q6_K.gguf}
HERE=$(cd "$(dirname "$0")" && pwd)
K=$(aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" --region "${BAMWARE_AWS_REGION:-us-east-1}" \
  ssm get-parameter --name /bamware/video-spike/runpod-api-key --with-decryption --query Parameter.Value --output text)
API=https://rest.runpod.io/v1
PUB=$(cat ~/.ssh/id_ed25519.pub)
mkdir -p "$OUTD"
body=$(python3 -c "import json,sys; print(json.dumps({'name':'bamware-video-spike-ssh','imageName':'runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04','gpuTypeIds':[sys.argv[1]],'gpuCount':1,'cloudType':'SECURE','containerDiskInGb':80,'volumeInGb':0,'ports':['22/tcp','8188/http'],'supportPublicIp':True,'env':{'PUBLIC_KEY':sys.argv[2]}}))" "$GPU" "$PUB")
resp=$(curl -s -X POST "$API/pods" -H "Authorization: Bearer $K" -H "Content-Type: application/json" -d "$body")
ID=$(echo "$resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
[ -n "$ID" ] || { echo "create failed: $(echo "$resp" | head -c 400)"; exit 1; }
RATE=$(echo "$resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("costPerHr"))')
t0=$(date +%s); echo "pod $ID ($GPU) \$$RATE/hr"
( sleep $((MAX_MIN * 60)); curl -s -X DELETE "$API/pods/$ID" -H "Authorization: Bearer $K" >/dev/null ) & WD=$!
cleanup() {
  [ -n "${TUN:-}" ] && kill "$TUN" 2>/dev/null || true
  curl -s -X DELETE "$API/pods/$ID" -H "Authorization: Bearer $K" >/dev/null
  kill $WD 2>/dev/null || true
  m=$(python3 -c "print(round(($(date +%s)-$t0)/60,1))")
  echo "pod deleted after $m min, est. cost \$$(python3 -c "print(round($m/60*$RATE,2))")"
}
trap cleanup EXIT
el() { echo "$(( ($(date +%s) - t0) ))s"; }
# wait for SSH endpoint
while :; do
  info=$(curl -s "$API/pods/$ID" -H "Authorization: Bearer $K")
  IP=$(echo "$info" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("publicIp") or "")')
  PORT=$(echo "$info" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("portMappings") or {}).get("22",""))')
  [ -n "$IP" ] && [ -n "$PORT" ] && break
  sleep 10
done
SSH=(ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -p "$PORT" "root@$IP")
until "${SSH[@]}" true 2>/dev/null; do sleep 10; done
echo "ssh up at $(el) ($IP:$PORT)"
"${SSH[@]}" "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader"
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$PORT" "$HERE/runpod_bootstrap.sh" "root@$IP:/root/bootstrap.sh" >/dev/null
"${SSH[@]}" "UNET=$UNET MAX_MIN=$MAX_MIN nohup bash /root/bootstrap.sh > /root/boot.log 2>&1 &"
until "${SSH[@]}" "grep -q BOOTSTRAP_DONE /root/boot.log" 2>/dev/null; do
  sleep 30; "${SSH[@]}" "tail -c 300 /root/boot.log | tr '\r' '\n' | tail -1" 2>/dev/null || true
done
echo "bootstrap done at $(el)"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -N -L 18188:localhost:8188 -p "$PORT" "root@$IP" & TUN=$!
until curl -sf http://127.0.0.1:18188/system_stats >/dev/null; do sleep 5; done
echo "comfyui up at $(el)"; tb=$(date +%s)
cd ~/tools/ComfyUI/input
R="$HERE/wan_animate_replace.py"
python3 "$R" --server http://127.0.0.1:18188 --unet "$UNET" --sam2-device cuda --video t3v-full.mp4 \
  --pose-video t3v-leftonly-hi.mp4 --pose-width 1080 --pose-height 1920 --ref ref-man-nocap.png --width 480 --height 832 \
  --frames 49 --steps 4 --prefix rp-480 --download "$OUTD/rp-480x832-49f.mp4" \
  --prompt "An older South Asian man with short grey hair, a grey moustache and thin metal glasses, no hat, raps along to the song in a bright orange music studio, lips clearly mouthing every word, subtle head nods, realistic, natural lighting" | tail -1
t1=$(date +%s); echo "480x832 render: $((t1 - tb))s (M3 Pro took 1966s)"
python3 "$R" --server http://127.0.0.1:18188 --unet "$UNET" --sam2-device cuda --video t3v-full.mp4 \
  --pose-video t3v-leftonly-hi.mp4 --pose-width 1080 --pose-height 1920 --ref ref-man-nocap.png --width 720 --height 1248 \
  --frames 49 --steps 4 --prefix rp-720 --download "$OUTD/rp-720x1248-49f.mp4" \
  --prompt "An older South Asian man with short grey hair, a grey moustache and thin metal glasses, no hat, raps along to the song in a bright orange music studio, lips clearly mouthing every word, subtle head nods, realistic, natural lighting" | tail -1
t2=$(date +%s); echo "720x1248 render: $((t2 - t1))s"
echo "TIMING setup_s=$((tb - t0)) r480_s=$((t1 - tb)) r720_s=$((t2 - t1)) rate=$RATE"
