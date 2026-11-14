#!/usr/bin/env bash
# Two-person replacement on a rented GPU: Wan 2.2 Animate, pass A (left performer) then pass B (right) on top.
# SSH-driven like runpod_ssh_test.sh, plus a download-speed gate (R3 died on an 8 MB/s host) and a hard
# spend guard: a local watchdog AND the pod itself delete the pod after MAX_MIN minutes. No network volume.
#
# IN_DIR holds: full.mp4, left-hi.mp4, right-hi.mp4 (other performer blacked out), ref-left.png, ref-right.png,
#               prompt-left.txt, prompt-right.txt.  Make it with prep_pair_inputs.sh.
# Usage: runpod_wan_pair.sh IN_DIR OUT_DIR      (run on the build server; needs aws, ssh key, python3, curl)
# Env:   GPU="NVIDIA L40S"  W=1280 H=720 FRAMES=65 STEPS=6 MAX_MIN=75 MIN_MBPS=40 UNET=Wan2.2-Animate-14B-Q8_0.gguf
set -euo pipefail
IN=$1 OUTD=$2
GPU=${GPU:-"NVIDIA L40S"} W=${W:-1280} H=${H:-720} FRAMES=${FRAMES:-65} STEPS=${STEPS:-6}
MAX_MIN=${MAX_MIN:-75} MIN_MBPS=${MIN_MBPS:-40} UNET=${UNET:-Wan2.2-Animate-14B-Q8_0.gguf}
HERE=$(cd "$(dirname "$0")" && pwd)
for f in full.mp4 left-hi.mp4 right-hi.mp4 ref-left.png ref-right.png prompt-left.txt prompt-right.txt; do
  [ -f "$IN/$f" ] || { echo "missing $IN/$f"; exit 2; }
done
K=$(aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" --region "${BAMWARE_AWS_REGION:-us-east-1}" \
  ssm get-parameter --name /bamware/video-spike/runpod-api-key --with-decryption --query Parameter.Value --output text)
API=https://rest.runpod.io/v1
PUB=$(cat ~/.ssh/id_ed25519.pub)
mkdir -p "$OUTD"
body=$(python3 -c "import json,sys; print(json.dumps({'name':'bamware-video-pair','imageName':'runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04','gpuTypeIds':[sys.argv[1]],'gpuCount':1,'cloudType':'SECURE','containerDiskInGb':90,'volumeInGb':0,'ports':['22/tcp','8188/http'],'supportPublicIp':True,'env':{'PUBLIC_KEY':sys.argv[2]}}))" "$GPU" "$PUB")
resp=$(curl -s -X POST "$API/pods" -H "Authorization: Bearer $K" -H "Content-Type: application/json" -d "$body")
ID=$(echo "$resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
[ -n "$ID" ] || { echo "create failed: $(echo "$resp" | head -c 400)"; exit 1; }
RATE=$(echo "$resp" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("costPerHr"))')
t0=$(date +%s); echo "pod $ID ($GPU) \$$RATE/hr, max $MAX_MIN min = \$$(python3 -c "print(round($MAX_MIN/60*$RATE,2))")"
( sleep $((MAX_MIN * 60)); curl -s -X DELETE "$API/pods/$ID" -H "Authorization: Bearer $K" >/dev/null ) & WD=$!
cleanup() {
  [ -n "${TUN:-}" ] && kill "$TUN" 2>/dev/null || true
  curl -s -X DELETE "$API/pods/$ID" -H "Authorization: Bearer $K" >/dev/null
  kill $WD 2>/dev/null || true
  m=$(python3 -c "print(round(($(date +%s)-$t0)/60,1))")
  echo "pod deleted after $m min, est. cost \$$(python3 -c "print(round($m/60*$RATE,2))")"
}
trap cleanup EXIT
el() { echo "$(( $(date +%s) - t0 ))s"; }
while :; do
  info=$(curl -s "$API/pods/$ID" -H "Authorization: Bearer $K")
  IP=$(echo "$info" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("publicIp") or "")')
  PORT=$(echo "$info" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("portMappings") or {}).get("22",""))')
  [ -n "$IP" ] && [ -n "$PORT" ] && break
  sleep 10
done
O=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o LogLevel=ERROR)
SSH=(ssh "${O[@]}" -p "$PORT" "root@$IP")
until "${SSH[@]}" true 2>/dev/null; do sleep 10; done
echo "ssh up at $(el)"
"${SSH[@]}" "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader"
# Speed gate: 300 MB of the real model file. A slow host costs more in waiting than a fresh pod.
BPS=$("${SSH[@]}" "curl -sL -r 0-314572799 -o /dev/null -w '%{speed_download}' https://huggingface.co/QuantStack/Wan2.2-Animate-14B-GGUF/resolve/main/$UNET")
MBPS=$(python3 -c "print(int(float('$BPS')/1e6))")
echo "download speed ${MBPS} MB/s (gate $MIN_MBPS)"
[ "$MBPS" -ge "$MIN_MBPS" ] || { echo "SLOW_HOST"; exit 3; }
scp "${O[@]}" -P "$PORT" "$HERE/runpod_bootstrap.sh" "root@$IP:/root/bootstrap.sh" >/dev/null
"${SSH[@]}" "UNET=$UNET MAX_MIN=$MAX_MIN nohup bash /root/bootstrap.sh > /root/boot.log 2>&1 &"
n=0
until "${SSH[@]}" "grep -q BOOTSTRAP_DONE /root/boot.log" 2>/dev/null; do
  sleep 30; n=$((n + 1))
  [ $((n % 4)) -eq 0 ] && echo "bootstrap $(el): $("${SSH[@]}" "du -sh /workspace/ComfyUI/models 2>/dev/null | cut -f1" 2>/dev/null || true)"
done
echo "bootstrap done at $(el)"
ssh "${O[@]}" -N -L 18188:localhost:8188 -p "$PORT" "root@$IP" & TUN=$!
until curl -sf http://127.0.0.1:18188/system_stats >/dev/null; do sleep 5; done
echo "comfyui up at $(el)"; tb=$(date +%s)
R="$HERE/wan_animate_replace.py"
run() {  # video pose ref promptfile prefix out
  python3 "$R" --server http://127.0.0.1:18188 --unet "$UNET" --sam2-device cuda --video "$1" --pose-video "$2" \
    --pose-width 1920 --pose-height 1080 --ref "$3" --width "$W" --height "$H" --frames "$FRAMES" --steps "$STEPS" \
    --prefix "$5" --download "$6" --prompt "$(cat "$4")" | tail -2
}
run "$IN/full.mp4" "$IN/left-hi.mp4" "$IN/ref-left.png" "$IN/prompt-left.txt" pair-a "$OUTD/passA.mp4"
t1=$(date +%s); echo "pass A: $((t1 - tb))s"
[ -s "$OUTD/passA.mp4" ] || { echo "pass A produced nothing"; "${SSH[@]}" "tail -30 /root/boot.log"; exit 1; }
run "$OUTD/passA.mp4" "$IN/right-hi.mp4" "$IN/ref-right.png" "$IN/prompt-right.txt" pair-b "$OUTD/passB.mp4"
t2=$(date +%s); echo "pass B: $((t2 - t1))s"
[ -s "$OUTD/passB.mp4" ] || { echo "pass B produced nothing"; "${SSH[@]}" "tail -30 /root/boot.log"; exit 1; }
echo "TIMING setup_s=$((tb - t0)) passA_s=$((t1 - tb)) passB_s=$((t2 - t1)) rate=$RATE w=$W h=$H frames=$FRAMES"
