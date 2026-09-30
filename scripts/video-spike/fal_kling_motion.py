#!/usr/bin/env python3
"""Kling Motion Control on fal.ai: characters from an image perform a reference video (audio kept).

Costs money (v3 pro ~$0.168/s, v3 standard ~$0.126/s, v2.6 standard ~$0.07/s). Needs FAL_KEY.
Usage: fal_kling_motion.py IMAGE VIDEO OUT.mp4 [--tier v3/pro] [--orientation video] [--prompt ...]
"""
import argparse
import time
import urllib.request

import fal_client

p = argparse.ArgumentParser()
p.add_argument("image")
p.add_argument("video")
p.add_argument("out")
p.add_argument("--tier", default="v3/pro")
p.add_argument("--orientation", default="video", choices=["video", "image"])
p.add_argument("--prompt", default="")
p.add_argument("--face-front", help="face lock: frontal photo (refer to it as @Element1 in --prompt)")
p.add_argument("--face-ref", action="append", default=[], help="face lock: 1-3 more angles")
a = p.parse_args()
t0 = time.time()
args = {"image_url": fal_client.upload_file(a.image), "video_url": fal_client.upload_file(a.video),
        "character_orientation": a.orientation, "keep_original_sound": True}
if a.face_front:  # only 1 element, only with character_orientation=video
    args["elements"] = [{"frontal_image_url": fal_client.upload_file(a.face_front),
                         "reference_image_urls": [fal_client.upload_file(f) for f in a.face_ref[:3]]}]
if a.prompt:
    args["prompt"] = a.prompt
r = fal_client.subscribe(f"fal-ai/kling-video/{a.tier}/motion-control", arguments=args, with_logs=False)
urllib.request.urlretrieve(r["video"]["url"], a.out)
print(f"done: {a.out} in {round(time.time() - t0)} s")
