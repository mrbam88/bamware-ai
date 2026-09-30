# Self-hosted two-person video swap: SCAIL-2 on a rented GPU

Status (2026-09-30): **procedure written, not yet run.** First run needs a
spend OK (~$3–8). Why this exists: `docs/portability.md` ("Generation
vendors: always keep an open route"). Findings and vendor comparisons:
`docs/video-model-landscape.md` §5.

## What it is

SCAIL-2 (Zhipu / zai-org, Apache-2.0, Wan 2.1-14B) replaces people in a
source video from reference images, and binds **several** references by mask
colour. Open weights, so it runs on any rented GPU with no provider content
gate. It is the only open model with verified multi-person replacement.
Quality on real faces is unproven for our clip; the hosted APIs (fal,
WaveSpeed) expose single-reference only, so two people means self-host.

## Two routes

| | ComfyUI (recommended first) | Official CLI |
|---|---|---|
| Weights | Comfy-Org/SCAIL-2 fp8 (17.7 GB) + umt5-xxl fp8 + Wan VAE + CLIP-H + SAM3.1 (~30 GB) | zai-org/SCAIL-2 (82.5 GB, needs `convert.py`) |
| Two people | core nodes `WanSCAILToVideo` + `SCAIL2ColoredMask` (`sort_by=left_to_right`) + `SAM3` (`max_objects=2`) | build masks by hand: driving mask white bg, person A blue (0,0,255), person B red (255,0,0); ref masks black bg, same colours |
| Long clips | auto-chunk nodes (`WanSCAILInfinity`, `scail-auto-extend`) | `--segment_len 81 --segment_overlap 5` |
| VRAM | ~24 GB with fp8 + lightx2v | 48–80 GB fp16 |

## Procedure (ComfyUI route)

1. **Rent.** RunPod Secure Cloud, one GPU: RTX PRO 6000 ($2.09/h) or H100
   PCIe ($2.89/h); A100 80GB ($1.59/h) works but ~1.5–2× slower (no fp8
   hardware). Template `runpod/pytorch:2.8.0-py3.11-cuda12.8.1`, container
   disk 120 GB, port 8188/http, SSH on. Key: vault
   `/bamware/video-spike/runpod-api-key`. First time: add a **100 GB network
   volume** ($7/month) so the weights download once.
2. **Bootstrap** (`scripts/video-spike/scail2_bootstrap.sh`, run on the pod
   over SSH; do not rely on `dockerStartCmd`, see `docs/self-hosted-gpu.md`):
   installs ComfyUI, the SAM3 nodes and the auto-chunk nodes, downloads the
   weights into the volume, starts ComfyUI on 8188. SAM3 weights are gated on
   Hugging Face: accept the licence at `facebook/sam3` and set `HF_TOKEN`
   (vault `/bamware/shared/hf-token`, create it with `keys.sh` if missing).
3. **Inputs.** Source clip at 24 or 30 fps, 1280×704 (H and W divisible by
   16); one reference image per person on a plain background, pose roughly
   matching the first frame; a short prompt describing both people.
4. **Workflow.** Start from the official template
   `video_wan21_scail2_character_replacement.int8.json`
   (docs.comfy.org/tutorials/video/zai/scail2) and switch to two people: SAM3
   `max_objects=2` → `SCAIL2ColoredMask sort_by=left_to_right` → two
   references in `WanSCAILToVideo`. A ready two-person graph: Civitai
   "SCAIL-2 Two-Person Reference Editing Long-Video Workflow" (model
   2710817). Save the graph as `scripts/video-spike/scail2_two_person.json`
   after the first working run.
5. **Render.** lightx2v preset first (6–8 steps, cfg 1, shift 1; ~3 min per
   81-frame window on an H100-class GPU), 40-step quality only after the
   preview passes. 15 s at 24 fps = 5 windows.
6. **Download, delete the pod.** Keep the volume. Log run, cost and verdict in
   `docs/video-gen-spike.md`.

## Quote for the first 15 s two-person render

Cold start (install + ~30 GB into the volume) 20–40 min + preview render
~20 min ≈ 1 h on the PRO 6000 ≈ **$2–3**; a 40-step quality pass adds ~2 h
≈ **$6–8**. Network volume $7/month. Re-runs after the first skip the
download.

## Gotchas (from the repo issues)

- Replacement mode is unstable; the maintainer's recipe is black-background
  refs + lightx2v + the relight LoRA, and animation mode when replacement
  fails.
- Identity can leak from the driving face: detailed prompt, extra refs.
- Brightness drifts across chunks: change the seed per chunk.
- `process_replacement.py` (CLI) masks one actor only; two people need the
  colour masks above.
- flash-attn builds are painful: use a prebuilt wheel. Linux only.

## Sources

github.com/zai-org/SCAIL-2 · github.com/zai-org/SCAIL-Pose ·
huggingface.co/Comfy-Org/SCAIL-2 · docs.comfy.org/tutorials/video/zai/scail2 ·
github.com/Comfy-Org/ComfyUI/pull/14509 · civitai.com/models/2710817 ·
runpod.io/pricing
