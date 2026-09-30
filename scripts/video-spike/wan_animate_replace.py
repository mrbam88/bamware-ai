#!/usr/bin/env python3
"""Replace one person in a clip with a reference character via Wan 2.2 Animate on a local ComfyUI.

Stdlib only. ComfyUI must be running (python main.py --listen 127.0.0.1 --port 8188) with
ComfyUI-GGUF, ComfyUI-WanAnimatePreprocess, ComfyUI-segment-anything-2, ComfyUI-KJNodes and
ComfyUI-VideoHelperSuite installed; model files as listed in docs/video-gen-spike.md.

Two-person clips: pass --pose-video, a copy of the clip with the other person blacked out,
so the pose detector (which takes the top detection per frame) tracks only the target.
Files are names inside ComfyUI/input.

Usage:
  wan_animate_replace.py --video t3-full.mp4 --pose-video t3-leftonly.mp4 --ref ref-man.png \
      --frames 49 --prompt "an older man rapping" --prefix wan-test
"""
import argparse
import json
import time
import urllib.parse
import urllib.request

p = argparse.ArgumentParser()
p.add_argument("--video", required=True)
p.add_argument("--pose-video")
p.add_argument("--ref", required=True)
p.add_argument("--frames", type=int, default=49, help="4k+1")
p.add_argument("--width", type=int, default=832)
p.add_argument("--height", type=int, default=480)
p.add_argument("--pose-width", type=int, help="track pose/face on a sharper copy (face crops come from it)")
p.add_argument("--pose-height", type=int)
p.add_argument("--steps", type=int, default=4)
p.add_argument("--seed", type=int, default=42)
p.add_argument("--prompt", default="a person performing a rap song in a studio")
p.add_argument("--prefix", default="wan-animate")
p.add_argument("--unet", default="Wan2.2-Animate-14B-Q4_K_M.gguf")
p.add_argument("--port", type=int, default=8188)
p.add_argument("--server", help="remote ComfyUI base URL (inputs are uploaded, output downloaded)")
p.add_argument("--sam2-device", default="mps", help="mps (Mac, fp32) or cuda (fp16)")
p.add_argument("--segments", help="chain windows for >77 frames, e.g. '77,25' (sum-overlap must cover --frames)")
p.add_argument("--download", help="where to save the output when using --server")
a = p.parse_args()

W, H, N = a.width, a.height, a.frames


PW, PH = a.pose_width or W, a.pose_height or H


def load_video(name, w=W, h=H):
    return {"class_type": "VHS_LoadVideo", "inputs": {
        "video": name, "force_rate": 16, "custom_width": w, "custom_height": h,
        "frame_load_cap": N, "skip_first_frames": 0, "select_every_nth": 1, "format": "AnimateDiff"}}


g = {
    "1": load_video(a.video),
    "2": load_video(a.pose_video or a.video, PW, PH),
    # bboxes for SAM2 must be in render-resolution pixels, so detect again at W x H
    "26": load_video(a.pose_video or a.video),
    "3": {"class_type": "LoadImage", "inputs": {"image": a.ref}},
    "4": {"class_type": "OnnxDetectionModelLoader", "inputs": {
        "vitpose_model": "vitpose-l-wholebody.onnx", "yolo_model": "yolov10m.onnx",
        "onnx_device": "CPUExecutionProvider"}},
    "5": {"class_type": "PoseAndFaceDetection", "inputs": {"model": ["4", 0], "images": ["2", 0], "width": W, "height": H}},
    "27": {"class_type": "PoseAndFaceDetection", "inputs": {"model": ["4", 0], "images": ["26", 0], "width": W, "height": H}},
    # pose keypoints are drawn in source pixels (no rescale), so draw from the W x H detection;
    # node 5 (sharper copy) only supplies the face crops that drive expression and lip sync
    "6": {"class_type": "DrawViTPose", "inputs": {"pose_data": ["27", 0], "width": W, "height": H,
                                                  "retarget_padding": 16, "body_stick_width": -1,
                                                  "hand_stick_width": -1, "draw_head": True}},
    "7": {"class_type": "DownloadAndLoadSAM2Model", "inputs": {
        "model": "sam2.1_hiera_base_plus.safetensors", "segmentor": "video", "device": a.sam2_device,
        "precision": "fp16" if a.sam2_device == "cuda" else "fp32"}},  # fp16 needs CUDA autocast
    "8": {"class_type": "Sam2Segmentation", "inputs": {"sam2_model": ["7", 0], "image": ["1", 0],
                                                       "keep_model_loaded": False, "bboxes": ["27", 3],
                                                       "individual_objects": False}},
    "9": {"class_type": "GrowMaskWithBlur", "inputs": {"mask": ["8", 0], "expand": 10, "incremental_expandrate": 0,
                                                       "tapered_corners": True, "flip_input": False, "blur_radius": 0,
                                                       "lerp_alpha": 1, "decay_factor": 1, "fill_holes": False}},
    "10": {"class_type": "BlockifyMask", "inputs": {"masks": ["9", 0], "block_size": 32}},
    "11": {"class_type": "DrawMaskOnImage", "inputs": {"image": ["1", 0], "mask": ["10", 0], "color": "0, 0, 0"}},
    "12": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": a.unet}},
    "13": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["12", 0], "strength_model": 1.0,
                                                           "lora_name": "WanAnimate_relight_lora_fp16.safetensors"}},
    "14": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["13", 0], "strength_model": 1.2,
                                                           "lora_name": "lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors"}},
    "15": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": "umt5-xxl-encoder-Q8_0.gguf", "type": "wan"}},
    "16": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["15", 0], "text": a.prompt}},
    "17": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["16", 0]}},
    "18": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "clip_vision_h.safetensors"}},
    "19": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["18", 0], "image": ["3", 0], "crop": "none"}},
    "20": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
    "21": {"class_type": "WanAnimateToVideo", "inputs": {
        "positive": ["16", 0], "negative": ["17", 0], "vae": ["20", 0], "width": W, "height": H, "length": N,
        "batch_size": 1, "continue_motion_max_frames": 5, "video_frame_offset": 0,
        "clip_vision_output": ["19", 0], "reference_image": ["3", 0], "face_video": ["5", 1],
        "pose_video": ["6", 0], "background_video": ["11", 0], "character_mask": ["10", 0]}},
    "22": {"class_type": "KSampler", "inputs": {"model": ["14", 0], "seed": a.seed, "steps": a.steps, "cfg": 1.0,
                                                "sampler_name": "lcm", "scheduler": "simple", "positive": ["21", 0],
                                                "negative": ["21", 1], "latent_image": ["21", 2], "denoise": 1.0}},
    "23": {"class_type": "TrimVideoLatent", "inputs": {"samples": ["22", 0], "trim_amount": ["21", 3]}},
    "24": {"class_type": "VAEDecode", "inputs": {"samples": ["23", 0], "vae": ["20", 0]}},
    "25": {"class_type": "VHS_VideoCombine", "inputs": {"images": ["24", 0], "audio": ["1", 2], "frame_rate": 16,
                                                        "loop_count": 0, "filename_prefix": a.prefix,
                                                        "format": "video/h264-mp4", "pingpong": False, "save_output": True}},
}

if a.segments:
    # Chain windows: each later window seeks via video_frame_offset and is primed with the last
    # continue_motion_max_frames frames of the video so far; its first trim_image frames are dropped.
    lens = [int(x) for x in a.segments.split(",")]
    g["21"]["inputs"]["length"] = lens[0]
    anim, accum = "21", ["24", 0]
    for i, L in enumerate(lens[1:], start=1):
        k = f"s{i}"
        g[f"{k}a"] = {"class_type": "WanAnimateToVideo", "inputs": {
            **g["21"]["inputs"], "length": L, "video_frame_offset": [anim, 5], "continue_motion": accum}}
        g[f"{k}k"] = {"class_type": "KSampler", "inputs": {
            **g["22"]["inputs"], "positive": [f"{k}a", 0], "negative": [f"{k}a", 1], "latent_image": [f"{k}a", 2]}}
        g[f"{k}t"] = {"class_type": "TrimVideoLatent", "inputs": {"samples": [f"{k}k", 0], "trim_amount": [f"{k}a", 3]}}
        g[f"{k}d"] = {"class_type": "VAEDecode", "inputs": {"samples": [f"{k}t", 0], "vae": ["20", 0]}}
        g[f"{k}f"] = {"class_type": "ImageFromBatch", "inputs": {"image": [f"{k}d", 0], "batch_index": [f"{k}a", 4], "length": 4096}}
        g[f"{k}c"] = {"class_type": "ImageBatch", "inputs": {"image1": accum, "image2": [f"{k}f", 0]}}
        anim, accum = f"{k}a", [f"{k}c", 0]
    g["25"]["inputs"]["images"] = accum

base = a.server.rstrip("/") if a.server else f"http://127.0.0.1:{a.port}"


def upload(path):
    """Multipart POST to ComfyUI /upload/image (works for videos too); returns the stored name."""
    import os
    import uuid
    b = uuid.uuid4().hex
    data = open(path, "rb").read()
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{os.path.basename(path)}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + data + f"\r\n--{b}--\r\n".encode()
    r = urllib.request.Request(f"{base}/upload/image", data=body,
                               headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    return json.load(urllib.request.urlopen(r))["name"]


if a.server:  # inputs are local paths; send them over and point the graph at the stored names
    names = {}
    for nid, key in (("1", "video"), ("2", "video"), ("26", "video"), ("3", "image")):
        src = g[nid]["inputs"][key]
        names.setdefault(src, upload(src))
        g[nid]["inputs"][key] = names[src]

req = urllib.request.Request(f"{base}/prompt", data=json.dumps({"prompt": g}).encode(),
                             headers={"Content-Type": "application/json"})
try:
    pid = json.load(urllib.request.urlopen(req))["prompt_id"]
except urllib.error.HTTPError as e:
    raise SystemExit(e.read().decode()[:2000])
t0 = time.time()
print("queued", pid, flush=True)
while True:
    time.sleep(15)
    h = json.load(urllib.request.urlopen(f"{base}/history/{pid}"))
    if pid in h:
        st = h[pid].get("status", {})
        outs = [f.get("fullpath") or f.get("filename") for o in h[pid].get("outputs", {}).values()
                for f in o.get("gifs", [])]
        print(json.dumps({"status": st.get("status_str"), "wall_s": round(time.time() - t0), "outputs": outs}))
        if st.get("status_str") != "success":
            print(json.dumps(st.get("messages", [])[-3:])[:2000])
        elif a.download:
            f = [f for o in h[pid]["outputs"].values() for f in o.get("gifs", []) if "audio" in f["filename"]] or \
                [f for o in h[pid]["outputs"].values() for f in o.get("gifs", [])]
            q = urllib.parse.urlencode({"filename": f[0]["filename"], "subfolder": f[0].get("subfolder", ""), "type": "output"})
            urllib.request.urlretrieve(f"{base}/view?{q}", a.download)
            print("downloaded", a.download)
        break
