#!/usr/bin/env python3
"""Edit a two-person DRIVING clip so the performers' heights match the real people, before Kling O1 sees it.

One-pass models (Kling O1 edit) keep the driving bodies' proportions and ignore height in the prompt,
so we change the bodies instead: cut both performers out (rembg masks), shrink the RIGHT one about their
feet so their head lands where a shorter person's would, shift them a little right for space, and lay both
back over per-shot clean plates. Free, local.

Usage:
  height_true_driver.py SRC.mp4 "p1.png@0,p2.png@4.04,p3.png@7.36" OUT.mp4 \
      [--split 0.40] [--left-cm 183 --right-cm 163] [--shift 0.03]
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("src")
p.add_argument("bg")
p.add_argument("out")
p.add_argument("--split", type=float, default=0.40, help="x fraction separating left and right performer")
p.add_argument("--left-cm", type=float, default=183)
p.add_argument("--right-cm", type=float, default=163)
p.add_argument("--shift", type=float, default=0.03, help="move the right person right by this fraction of width")
p.add_argument("--model", default="birefnet-general-lite")
a = p.parse_args()

REMBG = str(Path.home() / "tools/rembgenv/bin/rembg")
tmp = Path(tempfile.mkdtemp())
fps = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                      "-of", "csv=p=0", a.src], capture_output=True, text=True).stdout.strip()
fr = (tmp / "f"); fr.mkdir()
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.src, str(fr / "%04d.png")], check=True)
frames = sorted(fr.glob("*.png"))
W, H = Image.open(frames[0]).size
masks_dir = Path(a.src + ".masks")
if not masks_dir.exists() or len(list(masks_dir.glob("*.png"))) < len(frames):
    masks_dir.mkdir(exist_ok=True)
    subprocess.run([REMBG, "p", "-om", "-m", a.model, str(fr), str(masks_dir)], check=True, capture_output=True)
masks = sorted(masks_dir.glob("*.png"))
num, den = (int(x) for x in fps.split("/")) if "/" in fps else (int(float(fps)), 1)
FPS = num / den
parts = [(x.split("@")[0], float(x.split("@")[1])) for x in a.bg.split(",")]
plates = [Image.open(pl).convert("RGB").resize((W, H), Image.LANCZOS) for pl, _ in parts]
starts = [t for _, t in parts]
SX = int(a.split * W)


def shot_of(i):
    t = i / FPS
    return max(k for k, s in enumerate(starts) if t >= s)


def head(m):
    rows = np.where(m.sum(1) > 40)[0]
    if len(rows) == 0:
        return None
    top = rows[0]
    widths = m[top:top + int(0.45 * H)].sum(1)
    w0 = np.median(widths[10:30]) if len(widths) > 30 else widths.max()
    below = np.where(widths[30:] > 1.7 * max(w0, 1))[0]
    return top, (below[0] + 30) if len(below) else int(0.12 * H)


def split_masks(i):
    m = np.asarray(Image.open(masks[i]).convert("L").resize((W, H))) > 128
    l, r = m.copy(), m.copy()
    l[:, SX:] = False
    r[:, :SX] = False
    return l, r


# per-shot scale for the right performer, about their feet (bottom edge)
scale = {}
gap_heads = (a.left_cm - a.right_cm) / (a.left_cm / 7.5)
for k in range(len(parts)):
    idx = [i for i in range(len(frames)) if shot_of(i) == k][::3]
    L, R = [], []
    for i in idx:
        l, r = split_masks(i)
        hl, hr = head(l), head(r)
        if hl and hr:
            L.append(hl); R.append(hr)
    L, R = np.array(L), np.array(R)
    l_top, l_hh = np.median(L[:, 0]), np.median(L[:, 1])
    r_top = np.median(R[:, 0])
    target_top = l_top + gap_heads * l_hh
    s = (H - target_top) / (H - r_top)
    scale[k] = float(min(max(s, 0.75), 1.0))
    print(f"shot {k}: left top {l_top:.0f}, right top {r_top:.0f}, head {l_hh:.0f}px -> right scale {scale[k]:.3f}")

out = tmp / "o"; out.mkdir()
for i, f in enumerate(frames):
    k = shot_of(i)
    img = Image.open(f).convert("RGB")
    l, r = split_masks(i)
    canvas = plates[k].copy()
    canvas.paste(img, (0, 0), Image.fromarray((l * 255).astype(np.uint8)))
    s = scale[k]
    rimg = img.resize((int(W * s), int(H * s)), Image.LANCZOS)
    rm = Image.fromarray((r * 255).astype(np.uint8)).resize(rimg.size, Image.LANCZOS)
    # scale about the right person's feet: keep the bottom edge, pull toward their centre, then shift right
    cols = np.where(r.any(0))[0]
    cx = (cols.min() + cols.max()) / 2 if len(cols) else 0.7 * W
    x0 = int(cx - s * cx + a.shift * W)
    y0 = int(H - s * H)
    canvas.paste(rimg, (x0, y0), rm)
    canvas.save(out / f"{i:04d}.png")

subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", fps, "-i", str(out / "%04d.png"), "-i", a.src,
                "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy",
                "-shortest", a.out], check=True)
subprocess.run(["rm", "-rf", str(tmp)])
print("wrote", a.out)
