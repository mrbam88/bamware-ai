#!/usr/bin/env python3
"""Seedance 2.5 reference-to-video on fal: both performers in ONE pass (no per-person compositing).

Recipe (Starrd's published flow): a still with both people in the booth (@Image1) + the original
performance clip (@Video1) as the motion reference. Render silent; lay the real song on afterwards.
Billing counts input AND output seconds: tokens = h*w*(in_s+out_s)*24/1024, $0.0214/1k, x0.6 with video refs.

Usage (via fal_env.sh):
  fal_seedance.py STILL.png REF.mp4 OUT.mp4 --prompt "..." [--duration 4] [--resolution 720p] [--aspect 4:3]
      [--task reference|editing] [--image extra.png ...] [--dry-run]
"""
import argparse
import json
import subprocess
import time
import urllib.request

p = argparse.ArgumentParser()
p.add_argument("still")
p.add_argument("ref")
p.add_argument("out")
p.add_argument("--prompt", required=True)
p.add_argument("--duration", default="4")
p.add_argument("--resolution", default="720p", choices=["480p", "720p", "1080p"])
p.add_argument("--aspect", default="4:3")
p.add_argument("--task", default="reference", choices=["reference", "editing"])
p.add_argument("--image", action="append", default=[], help="extra reference images (@Image2, ...)")
p.add_argument("--dry-run", action="store_true")
a = p.parse_args()

DIMS = {"480p": 480, "720p": 720, "1080p": 1080}
num, den = (int(x) for x in a.aspect.split(":"))
h = DIMS[a.resolution]
w = h * num / den
in_s = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.ref],
                            capture_output=True, text=True).stdout)
out_s = float(a.duration)
quote = h * w * (in_s + out_s) * 24 / 1024 * 0.0214 / 1000 * 0.6
print(f"ref {in_s:.2f}s + out {out_s:.0f}s at {int(w)}x{h}: ~${quote:.2f}")
if a.dry_run:
    raise SystemExit

import fal_client  # noqa: E402

args = {
    "prompt": a.prompt,
    "task": a.task,
    "image_urls": [fal_client.upload_file(x) for x in [a.still, *a.image]],
    "video_urls": [fal_client.upload_file(a.ref)],
    "duration": a.duration,
    "resolution": a.resolution,
    "aspect_ratio": a.aspect,
    "generate_audio": False,
    "bitrate_mode": "high",
}
t0 = time.time()
res = fal_client.subscribe("bytedance/seedance-2.5/reference-to-video", arguments=args, with_logs=False)
url = res["video"]["url"]
urllib.request.urlretrieve(url, a.out)
print(json.dumps({k: v for k, v in res.items() if k != "video"})[:300])
print(f"done: {a.out} in {time.time() - t0:.0f} s")
