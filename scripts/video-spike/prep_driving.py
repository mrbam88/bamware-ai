#!/usr/bin/env python3
"""Prepare a multi-shot two-person trend window for per-person Kling Motion Control + composite_scaled.

For the window [START, START+DUR] of the 4K master:
  1. detect camera cuts (ffmpeg scene score)
  2. per shot, find both performers' faces (YuNet) -> the midline between them
  3. write one vertical driving clip per performer (1215x2160 crop -> 1080x1920) with the OTHER
     performer blacked out beyond the per-shot midline (Kling rejects two-person clips)
  4. write one clean plate per shot: FLUX removes people AND the mic, then the ORIGINAL mic is pasted
     back (low-saturation blob hanging from the top edge), so there is exactly one mic
Prints the plate spec for composite_scaled.py. Needs mlx-serve (FLUX.2-klein) on :11234.

Usage: prep_driving.py MASTER.mp4 START DUR OUTDIR [--left-x0 1157 --right-x0 1800]
"""
import argparse
import re
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

p = argparse.ArgumentParser()
p.add_argument("master")
p.add_argument("start", type=float)
p.add_argument("dur", type=float)
p.add_argument("out")
p.add_argument("--left-x0", type=int, default=1157)
p.add_argument("--right-x0", type=int, default=1800)
a = p.parse_args()
O = Path(a.out); O.mkdir(parents=True, exist_ok=True)
HERE = Path(__file__).parent
CW = 1215


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


# 1. cuts within the window (relative seconds)
err = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(a.start), "-t", str(a.dur), "-i", a.master, "-vf",
                      "scale=480:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score", "-an", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
cuts, t = [], None
for line in err.splitlines():
    m = re.search(r"pts_time:([0-9.]+)", line)
    if m:
        t = float(m.group(1))
    m = re.search(r"scene_score=([0-9.]+)", line)
    if m and t is not None and float(m.group(1)) > 0.15 and t > 0.3 and (not cuts or t - cuts[-1] > 0.6):
        cuts.append(round(t, 2))
shots = list(zip([0.0] + cuts, cuts + [a.dur]))
print("shots:", shots)

# 2. per-shot midline from face detection on the master frame at the shot middle
det = cv2.FaceDetectorYN.create(str(Path.home() / "tools/models/face_detection_yunet_2023mar.onnx"), "", (320, 320),
                                score_threshold=0.5)
mids = []
for k, (s, e) in enumerate(shots):
    f = O / f"shot{k}-src.png"
    ff("-ss", str(a.start + (s + e) / 2), "-i", a.master, "-vframes", "1", str(f))
    img = cv2.imread(str(f)); h, w = img.shape[:2]
    small = cv2.resize(img, (w // 2, h // 2)); det.setInputSize((w // 2, h // 2))
    _, faces = det.detect(small)
    xs = sorted(float(fc[0] + fc[2] / 2) * 2 for fc in (faces if faces is not None else []))[:2]
    mid = (xs[0] + xs[1]) / 2 if len(xs) == 2 else 1800.0
    mids.append(mid)
    print(f"shot {k} {s:.2f}-{e:.2f}s faces x={[round(x) for x in xs]} midline {mid:.0f}")

# 3. driving clips with the other performer blacked out (per shot)
def driving(x0, keep_left, out):
    boxes = []
    for (s, e), mid in zip(shots, mids):
        rel = (mid - x0) / CW  # midline as a fraction of the crop width
        rel = min(max(rel, 0.05), 0.95)
        if keep_left:
            boxes.append(f"drawbox=x=iw*{rel:.3f}:y=0:w=iw*{1 - rel:.3f}:h=ih:color=black:t=fill:enable='between(t,{s},{e})'")
        else:
            boxes.append(f"drawbox=x=0:y=0:w=iw*{rel:.3f}:h=ih:color=black:t=fill:enable='between(t,{s},{e})'")
    vf = f"crop={CW}:2160:{x0}:0,scale=1080:1920," + ",".join(boxes)
    ff("-ss", str(a.start), "-t", str(a.dur), "-i", a.master, "-vf", vf, "-c:v", "libx264", "-crf", "16", "-c:a", "aac", str(out))


driving(a.left_x0, True, O / "left-vertical.mp4")
driving(a.right_x0, False, O / "right-vertical.mp4")

# 4. plates: people + mic removed by FLUX, original mic pasted back
spec = []
for k, (s, e) in enumerate(shots):
    src = O / f"shot{k}-src.png"
    small = O / f"shot{k}-1344.png"
    ff("-i", str(src), "-vf", "scale=1344:756", str(small))
    subprocess.run(["python3", str(HERE / "flux_keyframe.py"), str(O / f"plate{k}-nomic.png"), "--width", "1344", "--height", "768",
                    "--seed", "5", "--image", str(small), "--prompt",
                    "Remove all people and the hanging microphone completely. Only the empty seamless orange studio wall remains, "
                    "with the same lighting gradient, vignette and deep orange color, same framing. Photorealistic."],
                   check=True, capture_output=True)
    srcimg = Image.open(small).convert("RGB")
    plate = Image.open(O / f"plate{k}-nomic.png").convert("RGB").resize(srcimg.size, Image.LANCZOS)
    arr = np.asarray(srcimg).astype(float)
    W, H = srcimg.size
    x0, x1, y1 = int(0.3 * W), int(0.7 * W), int(0.45 * H)
    roi = arr[:y1, x0:x1]
    low = (roi.max(2) - roi.min(2)) < 60
    lab, n = ndimage.label(low)
    top = set(lab[0][lab[0] > 0].tolist())  # blobs touching the top edge = mic + cable
    keep = np.isin(lab, list(top)) if top else np.zeros_like(low)
    m = np.zeros((H, W), np.uint8); m[:y1, x0:x1] = keep * 255
    mask = Image.fromarray(m).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
    plate.paste(srcimg, (0, 0), mask)
    plate.save(O / f"plate{k}.png")
    spec.append(f"{O / f'plate{k}.png'}@{s}")
    print(f"plate {k}: mic pixels {int(keep.sum())}")

(O / "plates.txt").write_text(",".join(spec))
print("PLATES", ",".join(spec))
