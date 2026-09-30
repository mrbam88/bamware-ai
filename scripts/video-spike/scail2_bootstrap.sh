#!/usr/bin/env bash
# SCAIL-2 (two-person video swap) on a rented GPU pod: ComfyUI + core SCAIL nodes + SAM3 + fp8 weights, ComfyUI on :8188.
# Run ON THE POD over SSH (not via dockerStartCmd). Weights go to $VOL so a network volume keeps them across pods.
# Procedure and quote: docs/self-hosted-two-person.md. Status: written 2026-09-30, not yet run.
# Env: HF_TOKEN (needed for the gated facebook/sam3 weights), VOL (default /workspace).
set -euo pipefail
VOL=${VOL:-/workspace}
cd "$VOL"
apt-get update -qq && apt-get install -y -qq git ffmpeg aria2 >/dev/null
pip install -q -U "huggingface_hub[cli]" >/dev/null

[ -d ComfyUI ] || git clone -q https://github.com/comfyanonymous/ComfyUI
cd ComfyUI && pip install -q -r requirements.txt >/dev/null
cd custom_nodes
[ -d ComfyUI-Manager ] || git clone -q https://github.com/ltdrdata/ComfyUI-Manager
[ -d ComfyUI-VideoHelperSuite ] || git clone -q https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
for d in */; do [ -f "$d/requirements.txt" ] && pip install -q -r "$d/requirements.txt" >/dev/null || true; done
cd ..

# weights (fp8 SCAIL-2 + Wan text/vision encoders + VAE); SAM3 is gated: accept the licence on HF first
M=models
mkdir -p $M/diffusion_models $M/text_encoders $M/clip_vision $M/vae $M/sam3 $M/loras
dl() { [ -f "$2" ] || hf download "$1" "$3" --local-dir "$(dirname "$2")" >/dev/null; }
dl Comfy-Org/SCAIL-2 $M/diffusion_models/scail2_14B_fp8_scaled.safetensors split_files/diffusion_models/scail2_14B_fp8_scaled.safetensors
dl Comfy-Org/Wan_2.1_ComfyUI_repackaged $M/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
dl Comfy-Org/Wan_2.1_ComfyUI_repackaged $M/clip_vision/clip_vision_h.safetensors split_files/clip_vision/clip_vision_h.safetensors
dl Comfy-Org/Wan_2.1_ComfyUI_repackaged $M/vae/wan_2.1_vae.safetensors split_files/vae/wan_2.1_vae.safetensors
dl Kijai/WanVideo_comfy $M/loras/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors
[ -n "${HF_TOKEN:-}" ] && dl facebook/sam3 $M/sam3/sam3.pt sam3.pt || echo "HF_TOKEN unset: SAM3 weights skipped (needed for automatic person masks)"
du -sh $M/* | sort -h | tail -8

nohup python main.py --listen 0.0.0.0 --port 8188 > "$VOL/comfy.log" 2>&1 &
echo "ComfyUI starting on :8188 (log: $VOL/comfy.log)"
