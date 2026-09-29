#!/usr/bin/env python3
"""Higgsfield Genjutsu Motion Transfer: swap BOTH performers in the original clip in one pass (cuts, camera, audio kept).

The two-person route the trend creators use (see the retrospective in docs/video-gen-spike.md). Needs HF_KEY="ID:SECRET"
(run via higgs_env.sh, which reads the vault). Price: $0.318/s at 480p, $0.681/s at 720p; input rounded up to whole seconds.

Usage: higgs_genjutsu.py VIDEO.mp4 OUT.mp4 --image him-sheet.jpg --image her-sheet.jpg --prompt "..." [--resolution 480p] [--dry-run]
"""
import argparse
import math
import os
import subprocess
import time
import urllib.request

import httpx

PRICE = {"480p": 0.318, "720p": 0.681}
API = "https://api.higgsfield.ai"

p = argparse.ArgumentParser()
p.add_argument("video")
p.add_argument("out")
p.add_argument("--image", action="append", required=True, help="reference images, in the order the prompt names them")
p.add_argument("--prompt", required=True)
p.add_argument("--resolution", default="480p", choices=list(PRICE))
p.add_argument("--dry-run", action="store_true")
a = p.parse_args()

secs = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.video],
                            capture_output=True, text=True).stdout)
print(f"input {secs:.2f}s -> billed {math.ceil(secs)}s at {a.resolution}: ~${math.ceil(secs) * PRICE[a.resolution]:.2f}")
if a.dry_run:
    raise SystemExit

H = {"Authorization": f"Key {os.environ['HF_KEY']}", "Content-Type": "application/json"}
c = httpx.Client(timeout=120)


def upload(path):
    ctype = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "mp4": "video/mp4"}[path.rsplit(".", 1)[1].lower()]
    r = c.post(f"{API}/files/generate-upload-url", headers=H, json={"content_type": ctype})
    r.raise_for_status()
    u = r.json()
    with open(path, "rb") as f:
        c.put(u["upload_url"], headers=u["upload_headers"], content=f.read()).raise_for_status()  # no API creds here
    return u["public_url"]


body = {"video_url": upload(a.video), "image_urls": [upload(x) for x in a.image], "prompt": a.prompt,
        "resolution": a.resolution}
r = c.post(f"{API}/higgsfield/genjutsu/motion-transfer/v1.0", headers=H, json=body)
if r.status_code >= 400:
    raise SystemExit(f"submit failed {r.status_code}: {r.text[:500]}")
req = r.json()
print("request", req.get("request_id"), req.get("status"))
t0, wait = time.time(), 10
while True:
    time.sleep(wait)
    s = c.get(req["status_url"], headers=H).json()
    if s["status"] in ("completed", "failed", "nsfw", "canceled"):
        break
    wait = min(wait * 1.5, 60)
if s["status"] != "completed":
    raise SystemExit(f"{s['status']}: {str(s.get('error', ''))[:500]}")
urllib.request.urlretrieve(s["video"]["url"], a.out)
print(f"done: {a.out} in {time.time() - t0:.0f} s")
