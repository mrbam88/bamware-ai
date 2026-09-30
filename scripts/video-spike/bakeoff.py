#!/usr/bin/env python3
"""Performance-stage bake-off: one standard test through many motion-transfer models, scored automatically.

Every candidate gets the SAME character image + driving clip (+ face refs where supported). Outputs:
  - per-model clips in OUT/
  - OUT/grid.mp4: driving clip + every output side by side (with a label strip), driving audio
  - OUT/scorecard.md: cost, wall time, resolution/fps, likeness and timing scores

Scores (free, local, OpenCV YuNet + SFace):
  likeness = median cosine similarity between the output's face and the real frontal photo (higher = more like them;
             SFace treats >0.36 as the same person)
  timing   = Pearson r of the face-centre track (x and y, averaged) between driving clip and output
             (1.0 = head moves exactly in time with the performer; a proxy for sync)

Run with FAL_KEY set (scripts/video-spike/fal_env.sh bakeoff.py ...). --dry-run prints the cost quote only.

Usage:
  bakeoff.py --image START.png --video DRIVE_5s.mp4 --face-front FRONT.jpg [--face-ref R.jpg ...]
             --prompt "..." --out DIR [--only name1,name2] [--dry-run]
"""
import argparse
import concurrent.futures as cf
import json
import subprocess
import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

MODELS = Path.home() / "tools/models"

# name, endpoint, $/s, extra args, supports face lock (elements)
CANDIDATES = [
    ("kling-v3-pro", "fal-ai/kling-video/v3/pro/motion-control", 0.168,
     {"character_orientation": "video", "keep_original_sound": True}, True),
    ("kling-v2.6-std", "fal-ai/kling-video/v2.6/standard/motion-control", 0.07,
     {"character_orientation": "video", "keep_original_sound": True}, False),
    ("dreamactor-v2", "fal-ai/bytedance/dreamactor/v2", 0.05, {"trim_first_second": False}, False),
    ("wan-animate-move-720", "fal-ai/wan/v2.2-14b/animate/move", 0.08,
     {"resolution": "720p", "video_quality": "high"}, False),
    ("wan-motion", "fal-ai/wan-motion", 0.06, {"enhance_identity": False}, False),
    ("wan-motion-id", "fal-ai/wan-motion", 0.06, {"enhance_identity": True, "_flat": 0.08}, False),
]

p = argparse.ArgumentParser()
p.add_argument("--image", required=True)
p.add_argument("--video", required=True)
p.add_argument("--face-front", required=True)
p.add_argument("--face-ref", action="append", default=[])
p.add_argument("--prompt", default="")
p.add_argument("--out", required=True)
p.add_argument("--only", default="")
p.add_argument("--dry-run", action="store_true")
a = p.parse_args()
OUT = Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
cands = [c for c in CANDIDATES if not a.only or c[0] in a.only.split(",")]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.video],
                           capture_output=True, text=True).stdout)
quote = {c[0]: round(c[2] * dur + c[3].get("_flat", 0), 2) for c in cands}
print(f"driving clip {dur:.1f}s; quote: {quote}; total ${sum(quote.values()):.2f}")
if a.dry_run:
    raise SystemExit(0)

need = [c for c in cands if not (OUT / f"{c[0]}.mp4").exists()]
up, elements = {}, []
if need:
    import fal_client  # noqa: E402  (only needed for paid runs)
    up = {"image": fal_client.upload_file(a.image), "video": fal_client.upload_file(a.video)}
    elements = [{"frontal_image_url": fal_client.upload_file(a.face_front),
                 "reference_image_urls": [fal_client.upload_file(r) for r in a.face_ref]}]


def run(c):
    name, ep, price, extra, face_lock = c
    if (OUT / f"{name}.mp4").exists():  # reuse: re-score without paying again
        return name, str(OUT / f"{name}.mp4"), 0, None
    args = {"image_url": up["image"], "video_url": up["video"], **{k: v for k, v in extra.items() if not k.startswith("_")}}
    if "prompt" in ep or name.startswith(("kling", "wan-motion")):
        args["prompt"] = ("@Element1 " if face_lock else "") + a.prompt
    if face_lock:
        args["elements"] = elements
    t0 = time.time()
    try:
        r = fal_client.subscribe(ep, arguments=args, with_logs=False)
        url = (r.get("video") or {}).get("url")
        dst = OUT / f"{name}.mp4"
        urllib.request.urlretrieve(url, dst)
        return name, str(dst), round(time.time() - t0), None
    except Exception as e:
        return name, None, round(time.time() - t0), str(e)[:200]


results = {}
with cf.ThreadPoolExecutor(max_workers=len(cands)) as ex:
    for name, path, secs, err in ex.map(run, cands):
        results[name] = {"path": path, "wall_s": secs, "error": err}
        print(name, "ok" if path else f"FAILED: {err}", f"{secs}s", flush=True)

# ---- scoring ----
det = cv2.FaceDetectorYN.create(str(MODELS / "face_detection_yunet_2023mar.onnx"), "", (320, 320), score_threshold=0.6)
rec = cv2.FaceRecognizerSF.create(str(MODELS / "face_recognition_sface_2021dec.onnx"), "")


def faces(img):
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, f = det.detect(img)
    return [] if f is None else sorted(f, key=lambda x: -x[2] * x[3])


def embed(img):
    f = faces(img)
    if not f:
        return None, None
    return rec.feature(rec.alignCrop(img, f[0])), f[0]


ref_emb, _ = embed(cv2.imread(a.face_front))


def frames(path, fps=8):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-vf", f"fps={fps},scale=540:-2", "-f", "image2pipe",
                          "-vcodec", "png", "-"], capture_output=True).stdout
    out, i = [], 0
    while True:
        j = raw.find(b"\x89PNG", i + 1)
        chunk = raw[i:j] if j != -1 else raw[i:]
        if chunk:
            img = cv2.imdecode(np.frombuffer(chunk, np.uint8), cv2.IMREAD_COLOR)
            if img is not None:
                out.append(img)
        if j == -1:
            break
        i = j
    return out


def track(imgs):
    pts = []
    for im in imgs:
        f = faces(im)
        h, w = im.shape[:2]
        pts.append(((f[0][0] + f[0][2] / 2) / w, (f[0][1] + f[0][3] / 2) / h) if f else (np.nan, np.nan))
    return np.array(pts)


import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

LMK = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=str(MODELS / "face_landmarker.task"), delegate=BaseOptions.Delegate.CPU), num_faces=1))
MFPS = 12


def mouth_series(path):
    """Inner-lip gap / face height per frame at MFPS (NaN where no face)."""
    out = []
    for im in frames(path, fps=MFPS):
        res = LMK.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
        if not res.face_landmarks:
            out.append(np.nan); continue
        L = res.face_landmarks[0]
        gap = abs(L[14].y - L[13].y); face = abs(L[152].y - L[10].y) or 1
        out.append(gap / face)
    return np.array(out)


def audio_env(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000",
                          "-af", "highpass=f=300,lowpass=f=3000", "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32)
    hop = 16000 // MFPS
    return np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])


def lagcorr(x, y, max_lag=3):
    """Best Pearson r within +/-max_lag frames (lip timing tolerance ~0.25 s)."""
    best = None
    for L in range(-max_lag, max_lag + 1):
        a_, b_ = (x[L:], y[:len(y) - L]) if L >= 0 else (x[:L], y[-L:])
        n = min(len(a_), len(b_)); a_, b_ = a_[:n], b_[:n]
        ok = ~(np.isnan(a_) | np.isnan(b_))
        if ok.sum() > 8 and np.std(a_[ok]) > 1e-6 and np.std(b_[ok]) > 1e-6:
            r = float(np.corrcoef(a_[ok], b_[ok])[0, 1])
            best = r if best is None else max(best, r)
    return best


drv_mouth, song = mouth_series(a.video), audio_env(a.video)
print("driver mouth-vs-song r (ceiling):", lagcorr(drv_mouth, song))
drv = track(frames(a.video))
for name, r in results.items():
    if not r["path"]:
        continue
    imgs = frames(r["path"])
    sims = []
    for im in imgs[::2]:
        e, _ = embed(im)
        if e is not None and ref_emb is not None:
            sims.append(float(rec.match(ref_emb, e, cv2.FaceRecognizerSF_FR_COSINE)))
    out_tr = track(imgs)
    n = min(len(drv), len(out_tr))
    rs = []
    for k in (0, 1):
        x, y = drv[:n, k], out_tr[:n, k]
        ok = ~(np.isnan(x) | np.isnan(y))
        if ok.sum() > 5 and np.std(x[ok]) > 1e-4 and np.std(y[ok]) > 1e-4:
            rs.append(float(np.corrcoef(x[ok], y[ok])[0, 1]))
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height,r_frame_rate:format=duration", "-of", "json", r["path"]],
                           capture_output=True, text=True).stdout
    pj = json.loads(probe)
    st = pj["streams"][0]
    om = mouth_series(r["path"])
    mm, ma = lagcorr(om, drv_mouth), lagcorr(om, song)
    r.update(mouth=round(mm, 3) if mm is not None else None, mouth_audio=round(ma, 3) if ma is not None else None)
    r.update(likeness=round(float(np.median(sims)), 3) if sims else None, timing=round(float(np.mean(rs)), 3) if rs else None,
             res=f"{st['width']}x{st['height']}", fps=st["r_frame_rate"], out_s=round(float(pj["format"]["duration"]), 2),
             cost=quote[name])

# ---- grid ----
ok = [n for n, r in results.items() if r["path"]]
tiles, labels = [a.video] + [results[n]["path"] for n in ok], ["driving"] + ok
TW, TH = 270, 480
header = Image.new("RGB", (TW * len(tiles), 40), (20, 20, 20))
d = ImageDraw.Draw(header)
from PIL import ImageFont
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
except OSError:
    FONT = None
for i, lab in enumerate(labels):
    sc = results.get(lab, {})
    extra = f" L{sc.get('likeness')} T{sc.get('timing')} M{sc.get('mouth')}" if lab != "driving" else ""
    d.text((i * TW + 6, 11), (lab + extra)[:34], fill=(255, 255, 255), font=FONT)
header.save(OUT / "header.png")
inputs = sum([["-i", t] for t in tiles], [])
fc = "".join(f"[{i}:v]fps=25,scale={TW}:{TH}:force_original_aspect_ratio=decrease,pad={TW}:{TH}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}];"
             for i in range(len(tiles)))
fc += "".join(f"[v{i}]" for i in range(len(tiles))) + f"hstack=inputs={len(tiles)}[row];[{len(tiles)}:v]scale={TW * len(tiles)}:40[h];[h][row]vstack[out]"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-loop", "1", "-i", str(OUT / "header.png"), "-filter_complex", fc,
                "-map", "[out]", "-map", "0:a?", "-shortest", "-c:v", "libx264", "-crf", "20", "-c:a", "aac", str(OUT / "grid.mp4")],
               check=True)

# ---- scorecard ----
rows = ["| model | $/s | cost | wall | output | likeness ↑ | timing ↑ | mouth match ↑ | mouth vs song ↑ | note |",
        "|---|---|---|---|---|---|---|---|---|---|"]
for name, ep, price, _, fl in cands:
    r = results[name]
    if r["path"]:
        rows.append(f"| {name} | {price} | ${r['cost']} | {r['wall_s']} s | {r['res']} @ {r['fps']} | {r['likeness']} | {r['timing']} | {r.get('mouth')} | {r.get('mouth_audio')} | {'face lock' if fl else ''} |")
    else:
        rows.append(f"| {name} | {price} | – | {r['wall_s']} s | FAILED | – | – | – | – | {r['error']} |")
(OUT / "scorecard.md").write_text("\n".join(rows) + "\n")
print("\n".join(rows))
print("grid:", OUT / "grid.mp4")
