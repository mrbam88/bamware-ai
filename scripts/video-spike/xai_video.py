#!/usr/bin/env python3
"""Grok Imagine video on the xAI API: edit an existing clip, or generate from text / a first frame.

Stdlib only. Needs XAI_KEY (run through xai_env.sh). Docs: docs.x.ai/docs/guides/video-generations
  edit      POST /v1/videos/edits        model grok-imagine-video, source mp4 <= 8.7 s, output <= 720p, $0.05/s
  generate  POST /v1/videos/generations  grok-imagine-video-1.5 $0.08/s, -1.5-lite $0.02/s, grok-imagine-video $0.05/s
Moderated requests are still billed. Output URLs are temporary, so the file is downloaded at once.

Usage:
  xai_video.py edit SRC.mp4 OUT.mp4 --prompt "..." [--dry-run]
  xai_video.py generate OUT.mp4 --prompt "..." [--image FRAME.png] [--ref A.png --ref B.png]
               [--duration 8] [--resolution 720p] [--aspect 16:9] [--model grok-imagine-video-1.5] [--silent]
"""
import argparse
import base64
import json
import mimetypes
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "https://api.x.ai/v1"
PRICE = {"grok-imagine-video": 0.05, "grok-imagine-video-1.5": 0.08, "grok-imagine-video-1.5-lite": 0.02}

p = argparse.ArgumentParser()
sub = p.add_subparsers(dest="mode", required=True)
e = sub.add_parser("edit")
e.add_argument("src")
e.add_argument("out")
g = sub.add_parser("generate")
g.add_argument("out")
g.add_argument("--image", help="first frame")
g.add_argument("--ref", action="append", default=[], help="reference image, named <IMAGE_0>.. in the prompt")
g.add_argument("--duration", type=int, default=8)
g.add_argument("--resolution", default="720p", choices=["480p", "720p", "1080p"])
g.add_argument("--aspect", default="16:9")
g.add_argument("--model", default="grok-imagine-video-1.5", choices=list(PRICE))
g.add_argument("--silent", action="store_true")
for s in (e, g):
    s.add_argument("--prompt", required=True)
    s.add_argument("--dry-run", action="store_true")
a = p.parse_args()


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(open(path, 'rb').read()).decode()}"


if a.mode == "edit":
    secs = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src],
                                capture_output=True, text=True).stdout)
    assert secs <= 8.7, f"source is {secs:.2f} s; the edit endpoint takes at most 8.7 s"
    model, path = "grok-imagine-video", "/videos/edits"
    body = {"model": model, "prompt": a.prompt, "video": {"url": data_uri(a.src)}}
else:
    secs, model, path = a.duration, a.model, "/videos/generations"
    body = {"model": model, "prompt": a.prompt, "duration": a.duration, "resolution": a.resolution,
            "aspect_ratio": a.aspect, "generate_audio": not a.silent}
    if a.image:
        body["image"] = {"url": data_uri(a.image)}
    if a.ref:
        body["reference_images"] = [{"url": data_uri(r)} for r in a.ref]
print(f"{a.mode} {secs:.2f}s with {model}: ~${secs * PRICE[model]:.2f}", flush=True)
if a.dry_run:
    raise SystemExit

H = {"Authorization": f"Bearer {os.environ['XAI_KEY']}", "Content-Type": "application/json"}


def call(url, payload=None):
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload else None, headers=H)
    for attempt in range(6):  # the job keeps running server-side, so a dropped poll is retried, never resubmitted
        try:
            return json.load(urllib.request.urlopen(req, timeout=120))
        except urllib.error.HTTPError as err:
            raise SystemExit(f"http {err.code}: {err.read().decode()[:600]}")
        except (urllib.error.URLError, TimeoutError) as err:
            if payload:
                raise SystemExit(f"submit failed before a request id came back: {err}")
            time.sleep(10)
    raise SystemExit("status polling kept failing")


rid = call(API + path, body)["request_id"]
print("request", rid, flush=True)
t0 = time.time()
while True:
    time.sleep(6)
    s = call(f"{API}/videos/{rid}")
    if s.get("status") in ("done", "failed", "expired"):
        break
if s["status"] != "done":
    raise SystemExit(f"{s['status']}: {json.dumps(s.get('error', s))[:500]}")
v = s["video"]
urllib.request.urlretrieve(v["url"], a.out)
print(json.dumps({"out": a.out, "wall_s": round(time.time() - t0), "duration": v.get("duration"),
                  "respect_moderation": v.get("respect_moderation")}))
if v.get("respect_moderation") is False:
    print("NOTE: the service says moderation filtered this video", file=sys.stderr)
