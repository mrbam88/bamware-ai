#!/usr/bin/env python3
"""Generate a keyframe PNG through a local mlx-serve (FLUX.2-klein). Stdlib only.

Usage: flux_keyframe.py OUT.png --prompt "..." [--width 1056 --height 720] [--seed 7]
"""
import argparse
import base64
import json
import time
import urllib.request
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("out")
p.add_argument("--prompt", required=True)
p.add_argument("--width", type=int, default=1056)
p.add_argument("--height", type=int, default=720)
p.add_argument("--seed", type=int, default=7)
p.add_argument("--model", default="Runpod/FLUX.2-klein-4B-mflux-4bit")
p.add_argument("--port", type=int, default=11234)
a = p.parse_args()

body = {"model": a.model, "prompt": a.prompt, "size": f"{a.width}x{a.height}",
        "width": a.width, "height": a.height, "seed": a.seed}
req = urllib.request.Request(f"http://127.0.0.1:{a.port}/v1/images/generations",
                             data=json.dumps(body).encode(),
                             headers={"Content-Type": "application/json"})
t0 = time.time()
with urllib.request.urlopen(req, timeout=None) as r:
    d = json.load(r)
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(base64.b64decode(d["data"][0]["b64_json"]))
print(json.dumps({"out": str(out), "wall_s": round(time.time() - t0, 1), "seed": a.seed}))
