#!/usr/bin/env python3
"""Kling O1 video edit on fal.ai: replace several people in a clip in ONE pass (camera, cuts, background kept).

$0.168 per second of input video (3-10 s). Up to 4 references in total (elements + images).
Refer to elements as @Element1.. and images as @Image1.. in the prompt. Needs FAL_KEY.

Usage:
  fal_kling_o1_edit.py VIDEO OUT.mp4 --prompt "..." \
      --element FRONT[,REF1,REF2] --element FRONT[,REF...] [--image IMG]
"""
import argparse
import time
import urllib.request

import fal_client

p = argparse.ArgumentParser()
p.add_argument("video")
p.add_argument("out")
p.add_argument("--prompt", required=True)
p.add_argument("--element", action="append", default=[], help="FRONT[,REF,...] image paths")
p.add_argument("--image", action="append", default=[])
a = p.parse_args()
assert len(a.element) + len(a.image) <= 4, "max 4 references in total"
t0 = time.time()
up = fal_client.upload_file
els = []
for e in a.element:
    paths = e.split(",")
    els.append({"frontal_image_url": up(paths[0]), "reference_image_urls": [up(x) for x in paths[1:]]})
args = {"video_url": up(a.video), "prompt": a.prompt, "keep_audio": True}
if els:
    args["elements"] = els
if a.image:
    args["image_urls"] = [up(x) for x in a.image]
r = fal_client.subscribe("fal-ai/kling-video/o1/video-to-video/edit", arguments=args, with_logs=False)
urllib.request.urlretrieve(r["video"]["url"], a.out)
print(f"done: {a.out} in {round(time.time() - t0)} s")
