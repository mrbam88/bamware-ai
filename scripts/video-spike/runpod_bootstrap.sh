#!/usr/bin/env bash
# Runs INSIDE a RunPod GPU pod (CUDA base image). Installs ComfyUI + the Wan Animate nodes and
# models used on the Mac (docs/video-gen-spike.md), then serves ComfyUI on :8188.
# No secrets here: this file is fetched from the public repo by the pod's start command.
set -uxo pipefail
LOG=/workspace/bootstrap.log; mkdir -p /workspace; exec > >(tee -a "$LOG") 2>&1
# Belt and braces: the pod removes itself after MAX_MIN minutes even if the laptop disappears.
MAX_MIN=${MAX_MIN:-100}
( sleep $((MAX_MIN * 60)); command -v runpodctl >/dev/null && runpodctl remove pod "${RUNPOD_POD_ID:-}" ) &

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq git curl ffmpeg ca-certificates >/dev/null
curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"
C=/workspace/ComfyUI
git clone -q --depth 1 https://github.com/comfyanonymous/ComfyUI "$C"
for r in city96/ComfyUI-GGUF kijai/ComfyUI-WanAnimatePreprocess Kosinkadink/ComfyUI-VideoHelperSuite \
         kijai/ComfyUI-KJNodes kijai/ComfyUI-segment-anything-2; do
  git clone -q --depth 1 "https://github.com/$r" "$C/custom_nodes/${r#*/}"
done
cd "$C" && uv venv -q -p 3.12 .venv && export VIRTUAL_ENV="$C/.venv"
uv pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install -q -r requirements.txt
for n in custom_nodes/*/; do [ -f "$n/requirements.txt" ] && uv pip install -q -r "$n/requirements.txt"; done
uv pip install -q onnxruntime

get() {  # repo path subdir
  mkdir -p "$C/models/$3"; curl -sfL -o "$C/models/$3/$(basename "$2")" "https://huggingface.co/$1/resolve/main/$2"
}
get QuantStack/Wan2.2-Animate-14B-GGUF Wan2.2-Animate-14B-Q8_0.gguf unet &
get city96/umt5-xxl-encoder-gguf umt5-xxl-encoder-Q8_0.gguf text_encoders &
get Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/clip_vision/clip_vision_h.safetensors clip_vision &
get Comfy-Org/Wan_2.1_ComfyUI_repackaged split_files/vae/wan_2.1_vae.safetensors vae &
get Kijai/WanVideo_comfy Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors loras &
get Kijai/WanVideo_comfy LoRAs/Wan22_relight/WanAnimate_relight_lora_fp16.safetensors loras &
get Wan-AI/Wan2.2-Animate-14B process_checkpoint/det/yolov10m.onnx detection &
get JunkyByte/easy_ViTPose onnx/wholebody/vitpose-l-wholebody.onnx detection &
wait
ls -la "$C"/models/*/ | grep -E 'gguf|safetensors|onnx'
nvidia-smi --query-gpu=name,memory.total --format=csv
echo BOOTSTRAP_DONE
exec .venv/bin/python main.py --listen 0.0.0.0 --port 8188
