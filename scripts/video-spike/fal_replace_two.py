#!/usr/bin/env python3
"""Two-person Wan 2.2 Animate Replace on fal.ai, via split-and-composite.

fal's endpoint picks the person to replace itself, so each pass gets a copy of the clip with the
other half blacked out; the replaced half is then blended back over the untouched half.

Needs FAL_KEY and `pip install fal-client`. Costs money: ~$0.06 per output second at 720p per pass
(quote before running; see the spend rule in AGENTS.md).

Usage: fal_replace_two.py FULL.mp4 LEFT_REF.jpg RIGHT_REF.jpg OUT.mp4 [--resolution 720p]
"""
import argparse
import subprocess
import urllib.request
from pathlib import Path

import fal_client

ENDPOINT = "fal-ai/wan/v2.2-14b/animate/replace"
p = argparse.ArgumentParser()
p.add_argument("full")
p.add_argument("left_ref")
p.add_argument("right_ref")
p.add_argument("out")
p.add_argument("--resolution", default="720p")
p.add_argument("--steps", type=int, default=20)
a = p.parse_args()
work = Path(a.out).with_suffix("")
work.mkdir(parents=True, exist_ok=True)


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def black_half(src, side, dst):
    x = "iw*0.5" if side == "right" else "0"
    ff("-i", src, "-vf", f"drawbox=x={x}:y=0:w=iw*0.5:h=ih:color=black:t=fill", "-c:v", "libx264", "-crf", "14",
       "-c:a", "copy", dst)


def replace(video, image, dst):
    vurl, iurl = fal_client.upload_file(video), fal_client.upload_file(image)
    r = fal_client.subscribe(ENDPOINT, arguments={
        "video_url": vurl, "image_url": iurl, "resolution": a.resolution,
        "num_inference_steps": a.steps, "video_quality": "maximum"}, with_logs=False)
    urllib.request.urlretrieve(r["video"]["url"], dst)
    print("pass done:", dst, "seed", r.get("seed"), flush=True)


def blend(base, generated, keep, dst):
    """Keep `keep` half of `generated` over `base`, with a 48 px soft seam; audio from base."""
    w, h = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                           "-of", "csv=p=0", base], capture_output=True, text=True).stdout.strip().split(",")
    ramp = "if(lt(X,W/2-24),255,if(gt(X,W/2+24),0,255*(W/2+24-X)/48))" if keep == "left" else \
           "if(gt(X,W/2+24),255,if(lt(X,W/2-24),0,255*(X-(W/2-24))/48))"
    ff("-i", base, "-i", generated, "-filter_complex",
       f"[1:v]scale={w}:{h},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='{ramp}'[g];"
       f"[0:v]format=rgba[b];[b][g]overlay=shortest=1,format=yuv420p[v]",
       "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "14", "-c:a", "copy", dst)


full = a.full
black_half(full, "right", str(work / "a-in.mp4"))
replace(str(work / "a-in.mp4"), a.left_ref, str(work / "a-out.mp4"))
blend(full, str(work / "a-out.mp4"), "left", str(work / "a-comp.mp4"))
black_half(str(work / "a-comp.mp4"), "left", str(work / "b-in.mp4"))
replace(str(work / "b-in.mp4"), a.right_ref, str(work / "b-out.mp4"))
blend(str(work / "a-comp.mp4"), str(work / "b-out.mp4"), "right", a.out)
print("final:", a.out)
