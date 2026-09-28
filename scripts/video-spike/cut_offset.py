#!/usr/bin/env python3
"""Seconds by which a generated clip's picture runs AHEAD of its driving clip, from camera-cut times.
Usage: cut_offset.py SOURCE.mp4 GENERATED.mp4   -> prints offset (0.0 if cuts can't be matched)"""
import re
import subprocess
import sys


def cuts(path, thr=0.1):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vf",
                          "scale=480:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score",
                          "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    t, out = None, []
    for line in err.splitlines():
        m = re.search(r"pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
        m = re.search(r"scene_score=([0-9.]+)", line)
        if m and t is not None and float(m.group(1)) > thr and t > 0.2:
            if not out or t - out[-1] > 0.5:
                out.append(t)
    return out


src, gen = cuts(sys.argv[1]), cuts(sys.argv[2])
diffs = [s - g for s in src for g in gen if 0.3 < s - g < 3.0 or abs(s - g) <= 0.3]
if not diffs:
    print("0.0")
else:
    diffs.sort()
    best = max(diffs, key=lambda d: sum(abs(d - x) < 0.15 for x in diffs))
    print(round(best, 2) if abs(best) > 0.1 else 0.0)
print(f"source cuts {src}, generated cuts {gen}", file=sys.stderr)
