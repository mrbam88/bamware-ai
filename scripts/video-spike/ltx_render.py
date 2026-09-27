#!/usr/bin/env python3
"""Render one clip through a local mlx-serve (LTX-2.5) and mux it to mp4.

Stdlib only. Start the server first:
    mlx-serve serve --host 127.0.0.1

Usage:
    ltx_render.py OUT.mp4 --prompt "..." [--frames 97] [--width 704 --height 480]
                  [--steps 8] [--seed 42] [--pipeline one_stage|two_stage|two_stage_hq]
                  [--image first.png] [--audio clip.wav]

Every run appends a line to runs.jsonl next to OUT (wall-clock, params) for
the results log in docs/video-gen-spike.md.
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.request
import wave
from pathlib import Path

FPS = 24  # LTX via mlx-serve renders at a fixed 24 fps
MODEL = "LTX-2.5-MLX-Serve-4bit"


def b64file(path):
    return base64.b64encode(Path(path).read_bytes()).decode()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("out")
    p.add_argument("--prompt", required=True)
    p.add_argument("--frames", type=int, default=97)
    p.add_argument("--width", type=int, default=704)
    p.add_argument("--height", type=int, default=480)
    p.add_argument("--steps", type=int, default=8)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--pipeline", default="one_stage")
    p.add_argument("--image")
    p.add_argument("--audio")
    p.add_argument("--model", default=MODEL)
    p.add_argument("--port", type=int, default=11234)
    a = p.parse_args()

    body = {k: v for k, v in {
        "model": a.model, "prompt": a.prompt, "num_frames": a.frames,
        "width": a.width, "height": a.height, "steps": a.steps,
        "seed": a.seed, "pipeline": a.pipeline,
    }.items()}
    if a.image:
        body["first_frame_image"] = b64file(a.image)
    if a.audio:
        body["audio"] = b64file(a.audio)
        if a.pipeline == "one_stage":
            body["pipeline"] = "two_stage"  # audio-to-video is two-stage only

    req = urllib.request.Request(
        f"http://127.0.0.1:{a.port}/v1/video/generations",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=None) as r:
        d = json.load(r)
    wall = time.time() - t0

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    raw = out.with_suffix(".rgb")
    raw.write_bytes(base64.b64decode(d["data"]))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{d['width']}x{d['height']}", "-r", str(FPS), "-i", str(raw)]
    wav = None
    if "audio_data" in d:
        wav = out.with_suffix(".wav")
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(d["audio_channels"])
            w.setsampwidth(2)
            w.setframerate(d["audio_sample_rate"])
            w.writeframes(base64.b64decode(d["audio_data"]))
        cmd += ["-i", str(wav), "-c:a", "aac", "-shortest"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(out)]
    subprocess.run(cmd, check=True)
    raw.unlink()
    if wav:
        wav.unlink()

    rec = {
        "out": out.name, "wall_s": round(wall, 1), "frames": d["frames"],
        "seconds": round(d["frames"] / FPS, 2), "size": f"{d['width']}x{d['height']}",
        "steps": a.steps, "seed": a.seed, "pipeline": body["pipeline"],
        "image": bool(a.image), "audio_in": bool(a.audio),
        "audio_out": "audio_data" in d, "prompt": a.prompt,
        "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(out.parent / "runs.jsonl", "a") as f:
        f.write(json.dumps(rec) + "\n")
    print(json.dumps(rec, indent=2))


if __name__ == "__main__":
    sys.exit(main())
