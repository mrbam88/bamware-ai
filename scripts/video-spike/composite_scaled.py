#!/usr/bin/env python3
"""Height-true shared frame: scale and place two cut-out people by their real heights.

Kling renders each person to fill their own frame, so their sizes are unrelated. This measures each
person's head (from the cached rembg masks, per camera shot), keeps the LEFT person as the anchor,
and scales/places the RIGHT person so head sizes are consistent and the height difference matches
real life (default 6'0" vs 5'4"). Frames are composited in Python over per-shot plates, then encoded
with the source audio. Free, local.

Usage:
  composite_scaled.py LEFT.mp4 RIGHT.mp4 "p1.png@0,p2.png@4.04,p3.png@7.36" AUDIO.mp4 OUT.mp4 \
      [--left-cm 183 --right-cm 163] [--h 1936]
Masks must exist at LEFT.mp4.masks/ and RIGHT.mp4.masks/ (made by composite_pair.sh).
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

p = argparse.ArgumentParser()
p.add_argument("left")
p.add_argument("right")
p.add_argument("bg")
p.add_argument("audio")
p.add_argument("out")
p.add_argument("--left-cm", type=float, default=183)   # 6'0"
p.add_argument("--right-cm", type=float, default=163)  # 5'4"
p.add_argument("--head-ratio", type=float, default=0.95, help="right head size / left head size")
p.add_argument("--h", type=int, default=1936)
p.add_argument("--fps", type=int, default=30)
p.add_argument("--canvas-x0", type=float, default=1157, help="canvas left edge in master px (0 = full widescreen)")
p.add_argument("--canvas-w", type=float, default=1858, help="canvas width in master px (3840 = full widescreen)")
p.add_argument("--space", type=float, default=0, help="extra gap: move the right person right by this many master px")
p.add_argument("--left-shift", type=float, default=0, help="move the left person left by this many master px")
p.add_argument("--max-drop", type=float, default=0.9, help="cap: right head top at most this many left-head-heights below the left head top")
a = p.parse_args()

H = a.h
s0 = H / 2160
CW = int(round(a.canvas_w * s0 / 2)) * 2
PW = int(round(1215 * s0 / 2)) * 2
LX0 = (1157 - a.canvas_x0 - a.left_shift) * s0
RX0 = int(round((1800 - a.canvas_x0 + a.space) * s0))

tmp = Path(tempfile.mkdtemp())


def frames(clip, name):
    d = tmp / name
    d.mkdir()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", clip, "-vf", f"fps={a.fps},scale={PW}:{H}",
                    str(d / "%04d.png")], check=True)
    return sorted(d.glob("*.png"))


from scipy import ndimage


def main_blob(mask_img):
    """Keep the largest connected shape (the person); drop stray bits like a floating fist."""
    m = np.asarray(mask_img)
    lab, n = ndimage.label(m > 64)
    if n <= 1:
        return mask_img
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = lab == (1 + int(np.argmax(sizes)))
    keep = ndimage.binary_dilation(keep, iterations=3)
    return Image.fromarray((m * keep).astype(np.uint8))


import cv2

_YUNET = cv2.FaceDetectorYN.create(str(Path.home() / "tools/models/face_detection_yunet_2023mar.onnx"), "", (320, 320),
                                   score_threshold=0.6)


def face_metrics(frame_path):
    """(head_top_y, head_h, head_cx) from real face detection on a PW x H frame, or None.
    YuNet's box runs ~brow to chin; head top sits ~0.3 box-heights above it, head height ~1.3 box-heights."""
    img = cv2.imread(str(frame_path))
    h, w = img.shape[:2]
    _YUNET.setInputSize((w, h))
    _, faces = _YUNET.detect(img)
    if faces is None or len(faces) == 0:
        return None
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])[:4]
    return y - 0.3 * fh, 1.3 * fh, x + fw / 2


def smooth_mask(masks, i, size):
    """Temporal smoothing (0.25/0.5/0.25 over neighbouring frames) + a slight feather: kills edge flicker."""
    def load(j):
        j = min(max(j, 0), len(masks) - 1)
        return np.asarray(Image.open(masks[j]).convert("L").resize(size)).astype(np.float32)
    m = 0.25 * load(i - 1) + 0.5 * load(i) + 0.25 * load(i + 1)
    img = Image.fromarray(np.clip(m, 0, 255).astype(np.uint8))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def head_metrics(mask):
    """(top_y, head_h, head_cx) in full-res pixels from a mask, or None."""
    m = np.asarray(mask.resize((PW, H))) > 128
    rows = np.where(m.sum(1) > 60)[0]  # ignore thin things (mic, cable, stray hands)
    if len(rows) == 0:
        return None
    top = rows[0]
    widths = m[top:top + int(0.45 * H)].sum(1)
    w0 = np.median(widths[15:45]) if len(widths) > 45 else widths.max()
    below = np.where(widths[45:] > 1.7 * max(w0, 1))[0]
    chin = (below[0] + 45) if len(below) else int(0.12 * H)
    cols = np.where(m[top:top + chin].any(0))[0]
    return top, chin, (cols.min() + cols.max()) / 2 if len(cols) else PW / 2


# shots from the bg spec
parts = [(x.split("@")[0], float(x.split("@")[1])) for x in a.bg.split(",")]
plates = [Image.open(pl).convert("RGB").resize((CW, H), Image.LANCZOS) for pl, _ in parts]
starts = [t for _, t in parts]

Lf, Rf = frames(a.left, "l"), frames(a.right, "r")
n = min(len(Lf), len(Rf))
if abs(len(Lf) - len(Rf)) > a.fps:  # Kling MC can silently return a clip shorter than its driver
    raise SystemExit(f"clip lengths differ: left {len(Lf) / a.fps:.1f}s vs right {len(Rf) / a.fps:.1f}s; re-render the short one")
def ensure_masks(clip, fr):
    d = Path(clip + ".masks")
    if d.exists() and len(list(d.glob("*.png"))) >= len(fr):
        return sorted(d.glob("*.png"))
    d.mkdir(exist_ok=True)
    half = tmp / (Path(clip).stem + "-half"); half.mkdir()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", clip, "-vf", f"fps={a.fps},scale={PW // 2}:{H // 2}",
                    str(half / "%04d.png")], check=True)
    subprocess.run([str(Path.home() / "tools/rembgenv/bin/rembg"), "p", "-om", "-m", "birefnet-general-lite",
                    str(half), str(d)], check=True, capture_output=True)
    return sorted(d.glob("*.png"))


Lm = ensure_masks(a.left, Lf)
Rm = ensure_masks(a.right, Rf)


def shot_of(i):
    t = i / a.fps
    return max(k for k, s in enumerate(starts) if t >= s)


# per-shot medians of head metrics
def shot_faces(fr, k):
    idx = [i for i in range(n) if shot_of(i) == k]
    got = [m for m in (face_metrics(fr[i]) for i in idx[::3]) if m]
    if not got:  # short shot or turned head: try every frame
        got = [m for m in (face_metrics(fr[i]) for i in idx) if m]
    return np.array(got).reshape(-1, 3)


raw = {k: (shot_faces(Lf, k), shot_faces(Rf, k)) for k in range(len(parts))}
for side in (0, 1):  # no face in a shot at all: borrow the nearest shot's framing
    for k in range(len(parts)):
        if not len(raw[k][side]):
            near = sorted((abs(j - k), j) for j in raw if len(raw[j][side]))
            if not near:
                raise SystemExit(f"no face found in any shot for side {side}")
            print(f"shot {k}: no {'left' if side == 0 else 'right'} face, borrowing shot {near[0][1]}")
            raw[k] = tuple(raw[near[0][1]][side] if s == side else raw[k][s] for s in (0, 1))

stats = {}
for k in range(len(parts)):
    L, R = raw[k]
    stats[k] = {"l_top": float(np.median(L[:, 0])), "l_hh": float(np.median(L[:, 1])),
                "r_top": float(np.median(R[:, 0])), "r_hh": float(np.median(R[:, 1])),
                "r_cx": float(np.median(R[:, 2]))}
    st = stats[k]
    # r = right/left scale so head sizes are consistent
    r = a.head_ratio * st["l_hh"] / st["r_hh"]
    # real height gap in the left person's head units (adult head ~1/7.5 of body height)
    g = min((a.left_cm - a.right_cm) / (a.left_cm / 7.5), a.max_drop) * st["l_hh"]
    T = st["l_top"]  # keep the left person's headroom
    # smallest left scale sL such that BOTH layers still reach the bottom edge (no floating bodies):
    #   left:  T - sL*l_top + sL*H >= H        right: T + g*sL - r*sL*r_top + r*sL*H >= H
    sL = max(1.0, (H - T) / (H - st["l_top"]), (H - T) / (g + r * (H - st["r_top"])))
    st["ls"], st["rs"] = sL, r * sL
    st["ly"] = T - sL * st["l_top"]
    st["ry"] = T + g * sL - st["rs"] * st["r_top"]
    st["lx"] = LX0 + PW / 2 - sL * PW / 2  # scale the left person about their own centre
    st["rx"] = RX0 + st["r_cx"] - st["rs"] * st["r_cx"]  # keep her head centre in place
    st["l_bottom_gap"] = H - (st["ly"] + sL * H)
    st["r_bottom_gap"] = H - (st["ry"] + st["rs"] * H)
# a turned head (back of the head) under-measures, which blows the scale up: clamp each shot's
# right/left scale ratio to +/-15% of the median across shots and re-solve that shot
ratios = [s["rs"] / s["ls"] for s in stats.values()]
med = float(np.median(ratios))
for k, st in stats.items():
    r = st["rs"] / st["ls"]
    if abs(r / med - 1) > 0.15:
        r = min(max(r, med * 0.85), med * 1.15)
        g = min((a.left_cm - a.right_cm) / (a.left_cm / 7.5), a.max_drop) * st["l_hh"]
        T = st["l_top"]
        sL = max(1.0, (H - T) / (g + r * (H - st["r_top"])))
        st.update(ls=sL, rs=r * sL, ly=T - sL * st["l_top"], ry=T + g * sL - r * sL * st["r_top"],
                  lx=LX0 + PW / 2 - sL * PW / 2, rx=RX0 + st["r_cx"] - r * sL * st["r_cx"], clamped=1.0)
        st["r_bottom_gap"] = H - (st["ry"] + st["rs"] * H)
print(json.dumps({k: {kk: round(v, 2) for kk, v in s.items()} for k, s in stats.items()}, indent=1))

out = tmp / "o"
out.mkdir()
for i in range(n):
    st = stats[shot_of(i)]
    canvas = plates[shot_of(i)].copy()
    lc = Image.open(Lf[i]).convert("RGB"); lm = main_blob(smooth_mask(Lm, i, (PW, H)))
    lw, lh = int(PW * st["ls"]), int(H * st["ls"])
    lc, lm = lc.resize((lw, lh), Image.LANCZOS), lm.resize((lw, lh), Image.LANCZOS)
    canvas.paste(lc, (int(st["lx"]), int(st["ly"])), lm)
    rc = Image.open(Rf[i]).convert("RGB"); rm = main_blob(smooth_mask(Rm, i, (PW, H)))
    sw, sh = int(PW * st["rs"]), int(H * st["rs"])
    rc, rm = rc.resize((sw, sh), Image.LANCZOS), rm.resize((sw, sh), Image.LANCZOS)
    canvas.paste(rc, (int(st["rx"]), int(st["ry"])), rm)
    canvas.save(out / f"{i:04d}.png")

subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(a.fps), "-i", str(out / "%04d.png"), "-i", a.audio,
                "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-shortest", a.out], check=True)
subprocess.run(["rm", "-rf", str(tmp)])
print("wrote", a.out)
