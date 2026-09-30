#!/usr/bin/env python3
"""Generic fal call: image + video (+ JSON extras) -> video file. For quick model tests without a bespoke client.

Usage (via fal_env.sh): fal_simple.py ENDPOINT IMAGE VIDEO OUT.mp4 [--extra '{"key": value}']
"""
import argparse
import json
import time
import urllib.request

import fal_client

p = argparse.ArgumentParser()
p.add_argument("endpoint")
p.add_argument("image")
p.add_argument("video")
p.add_argument("out")
p.add_argument("--extra", default="{}")
a = p.parse_args()
t0 = time.time()
args = {"image_url": fal_client.upload_file(a.image), "video_url": fal_client.upload_file(a.video), **json.loads(a.extra)}
r = fal_client.subscribe(a.endpoint, arguments=args, with_logs=False)
urllib.request.urlretrieve(r["video"]["url"], a.out)
print(f"done: {a.out} in {round(time.time() - t0)} s")
