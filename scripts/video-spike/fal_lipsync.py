#!/usr/bin/env python3
"""Sync Labs lipsync-2-pro on fal.ai: re-draw mouths in VIDEO to match AUDIO (a finishing pass).
~$5/min pro ($0.083/s). Needs FAL_KEY.
Usage: fal_lipsync.py VIDEO AUDIO OUT.mp4 [--model lipsync-2-pro|lipsync-2]"""
import argparse
import time
import urllib.request

import fal_client

p = argparse.ArgumentParser()
p.add_argument("video")
p.add_argument("audio")
p.add_argument("out")
p.add_argument("--model", default="lipsync-2-pro")
a = p.parse_args()
t0 = time.time()
ep = "fal-ai/sync-lipsync/v2/pro" if a.model == "lipsync-2-pro" else "fal-ai/sync-lipsync/v2"
args = {"video_url": fal_client.upload_file(a.video), "audio_url": fal_client.upload_file(a.audio), "sync_mode": "cut_off"}
if ep.endswith("/v2"):
    args["model"] = a.model
r = fal_client.subscribe(ep, arguments=args, with_logs=False)
urllib.request.urlretrieve(r["video"]["url"], a.out)
print(f"done: {a.out} in {round(time.time() - t0)} s")
