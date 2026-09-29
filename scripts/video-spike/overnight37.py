#!/usr/bin/env python3
"""Unattended 37 s build of the Hotel Lobby remake, two versions, hard spend guard. Run with the rembg venv python.

  prep    prep_driving.py on the 4K master window -> per-shot cuts, driving clips, clean plates (free, local FLUX)
  O1      Kling O1 edit per camera shot, BOTH people in one pass, 4:3 mic-centred crop, retimed to the exact
          shot length so it stays on the song -> concat + song + film grade -> Discord
  MC      the stitched pipeline: reuse the 20 s Kling renders up to 18.44 s, Kling v3 Pro Motion Control per
          shot per person after that (one call per shot: Kling stops at cuts), mic-centred composite,
          wide shots taken from the O1 track (stitching breaks on full-body shots) -> Discord

Every paid call is logged to OUT/spend.json and refused once the overnight budget would be exceeded.
Usage: overnight37.py [--budget 14.5] [--dry-run]
"""
import argparse
import concurrent.futures as cf
import json
import math
import os
import subprocess
import threading
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("--budget", type=float, default=14.5, help="max overnight fal spend in $")
p.add_argument("--dry-run", action="store_true")
a = p.parse_args()

HOME = Path.home()
V = HOME / "Movies/video-spike"
S = Path(__file__).resolve().parent
PY = str(HOME / "tools/rembgenv/bin/python")
MASTER = V / "refs/colors/master-4k-12-55.mp4"  # COLORS 0:12-0:55
START, DUR = 3.0, 37.0                           # window = COLORS 0:15-0:52
O = V / "t37"
T20 = V / "t20"
O.mkdir(exist_ok=True)
RATE = 0.168
GRADE = ("eq=contrast=1.06:saturation=0.9:gamma=0.97,colorbalance=rs=0.05:gs=0.01:bs=-0.05:rm=0.03:bm=-0.03,"
         "curves=preset=medium_contrast,noise=alls=7:allf=t,vignette=PI/5")
F = V / "fal"
HIM = dict(image=F / "him-start-o1.png", front=F / "el/him-front.jpg", refs=[F / "el/him-b.jpg"],
           prompt="@Element1 is a tall six-foot 71-year-old South Asian man with short grey hair, a thin neatly trimmed "
                  "salt-and-pepper moustache and thin metal glasses. He is the lead rapper at the microphone, subtle slow "
                  "hip-hop moves, lips mouthing every word in time with the beat, realistic, bright orange music studio")
HER = dict(image=F / "her-start-v3.png", front=F / "el/her-front.jpg", refs=[F / "el/her-b.jpg", F / "el/her-mountain.jpg"],
           prompt="@Element1 is a 66-year-old South Asian woman, five foot four, with natural age lines, dark shoulder-length "
                  "hair and thin black clear-lens glasses, wearing a green embroidered kurta, red dupatta and gold jewelry. "
                  "She is the background singer: calm, natural, subtle expression, relaxed face, gentle head nods and small "
                  "hand gestures on the beat, lips softly mouthing the words, realistic, bright orange music studio")
O1_PROMPT = ("Replace the performer on the left with @Element1 and the performer on the right with @Element2. @Element1 is a "
             "tall six-foot 71-year-old South Asian man with short grey hair, a thin neatly trimmed grey moustache and thin "
             "metal glasses, wearing a white shirt, black sweater vest and grey trousers. @Element2 is a 66-year-old South "
             "Asian woman, five foot four and visibly shorter than him, with natural age lines, dark shoulder-length hair "
             "and thin black glasses, wearing a green embroidered kurta, red dupatta and gold jewelry. Keep the camera, the "
             "orange set, the hanging microphone, and every body movement, gesture and lip movement exactly as in the "
             "video. Subtle, natural facial expressions. Photorealistic.")

lock = threading.Lock()
LOG = O / "overnight.log"


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with lock, LOG.open("a") as f:
        f.write(line + "\n")


def sh(*cmd, check=True):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(f"{Path(str(cmd[0])).name} failed: {(r.stderr or r.stdout)[-600:]}")
    return r.stdout


def ff(*args):
    sh("ffmpeg", "-y", "-loglevel", "error", *args)


def dur(path):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path))


def dims(path):
    w, h = sh("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of",
              "csv=s=x:p=0", path).strip().split("x")
    return int(w), int(h)


LEDGER = O / "spend.json"
spend = json.loads(LEDGER.read_text()) if LEDGER.exists() else {"items": [], "total": 0.0}


def charge(label, cost):
    """Reserve spend for one paid call; False (and nothing spent) if it would break the budget."""
    with lock:
        if spend["total"] + cost > a.budget + 1e-9:
            log(f"BUDGET STOP: {label} ${cost:.2f} would exceed ${a.budget:.2f} (spent ${spend['total']:.2f})")
            return False
        spend["items"].append([label, round(cost, 3)])
        spend["total"] = round(spend["total"] + cost, 3)
        LEDGER.write_text(json.dumps(spend, indent=1))
    return True


def discord(caption, path, label):
    r = subprocess.run(["bash", str(S / "discord_upload.sh"), f"{caption}|{path}"], env={**os.environ, "LABEL": label},
                       capture_output=True, text=True)
    log(f"discord: {r.stdout.strip()[:120]} {r.stderr.strip()[-200:]}")


# ---------------- prep ----------------
if not (O / "plates.txt").exists():
    log("prep: cuts, driving clips, plates (local FLUX)")
    out = sh(PY, S / "prep_driving.py", MASTER, START, DUR, O)
    log(out.strip().splitlines()[0] if out.strip() else "prep: no output")
spec = [(x.split("@")[0], float(x.split("@")[1])) for x in (O / "plates.txt").read_text().strip().split(",")]
starts = [s for _, s in spec]
shots = list(zip(starts, starts[1:] + [DUR]))

yunet = cv2.FaceDetectorYN.create(str(HOME / "tools/models/face_detection_yunet_2023mar.onnx"), "", (320, 320), score_threshold=0.5)


def is_wide(k):
    img = cv2.imread(str(O / f"shot{k}-src.png"))
    h, w = img.shape[:2]
    small = cv2.resize(img, (w // 2, h // 2))
    yunet.setInputSize((w // 2, h // 2))
    _, faces = yunet.detect(small)
    if faces is None or not len(faces):
        return False
    return max(float(f[3]) for f in faces) * 2 / h < 0.07


def mic_x(path):
    im = Image.open(path).convert("RGB")
    hsv = np.asarray(im.convert("HSV")).astype(int)
    top = hsv[: im.size[1] // 3]
    cols = ((top[..., 1] < 70) & (top[..., 2] > 60)).sum(0)
    if cols.max() < im.size[1] * 0.03:
        return 1920.0
    return float(np.median(np.where(cols > cols.max() * 0.4)[0])) * 3840 / im.size[0]


wide = [is_wide(k) for k in range(len(shots))]
x0s = [min(max(mic_x(pl) - 1440, 0), 3840 - 2880) for pl, _ in spec]


def o1_chunks(s, e):
    """(c0, c1, w0, w1): the part of the shot we keep, inside the O1 input window (3-10 s)."""
    L = e - s
    if L < 3:
        w0, w1 = (s, s + 3) if s + 3 <= DUR else (e - 3, e)
        return [(s, e, w0, w1)]
    n = math.ceil(L / 10)
    b = [s + L * i / n for i in range(n + 1)]
    return [(b[i], b[i + 1], b[i], b[i + 1]) for i in range(n)]


o1_plan = [(k, c) for k, (s, e) in enumerate(shots) for c in o1_chunks(s, e)]
o1_cost = sum((c[3] - c[2]) * RATE for _, c in o1_plan)
t20_cuts = [0.0, 4.04, 7.36, 11.2, 14.92, 18.44]
reuse_until = 18.44 if all(any(abs(s - c) < 0.1 for s in starts) for c in t20_cuts) else 0.0
mc_shots = [k for k, (s, e) in enumerate(shots) if s >= reuse_until - 0.01 and not wide[k]]
mc_cost = sum(max(shots[k][1] - shots[k][0], 3) * RATE * 2 for k in mc_shots)
log(f"shots: {[(round(s, 2), round(e, 2)) for s, e in shots]}")
log(f"wide: {[k for k, w in enumerate(wide) if w]}  canvas x0: {[round(x) for x in x0s]}  reuse t20 until {reuse_until}s")
log(f"plan: O1 {len(o1_plan)} calls ~${o1_cost:.2f}; MC shots {mc_shots} ~${mc_cost:.2f}; total ~${o1_cost + mc_cost:.2f} "
    f"(budget ${a.budget:.2f}, already logged ${spend['total']:.2f})")
if a.dry_run:
    raise SystemExit


# ---------------- O1 track ----------------
def o1_segment(k, c0, c1, w0, w1):
    seg = O / f"o1-seg-{k}-{c0:.2f}.mp4"
    if seg.exists():
        return seg
    ref = O / f"o1-ref-{k}-{w0:.2f}.mp4"
    ff("-ss", START + w0, "-i", MASTER, "-t", w1 - w0, "-vf", f"crop=2880:2160:{x0s[k]:.0f}:0,scale=1440:1080",
       "-c:v", "libx264", "-crf", "14", "-c:a", "aac", ref)
    raw = O / f"o1-raw-{k}-{w0:.2f}.mp4"
    for attempt in (1, 2):
        if raw.exists():
            break
        if not charge(f"o1 shot{k} {w0:.2f}-{w1:.2f}", (w1 - w0) * RATE):
            return None
        try:
            sh("bash", S / "fal_env.sh", S / "fal_kling_o1_edit.py", ref, raw, "--prompt", O1_PROMPT,
               "--element", f"{F / 'el/him-front.jpg'},{F / 'el/him-b.jpg'}",
               "--element", f"{F / 'el/her-front.jpg'},{F / 'el/her-b.jpg'}")
        except Exception as ex:  # noqa: BLE001
            log(f"o1 shot{k} attempt {attempt} failed: {ex}")
    if not raw.exists():
        return None
    f = (w1 - w0) / dur(raw)  # O1 returns slightly short clips: stretch back so the shot stays on the song
    ff("-i", raw, "-vf", f"setpts=PTS*{f:.5f},fps=30,scale=1440:1080,setsar=1,trim=start={c0 - w0:.3f}:end={c1 - w0:.3f},"
       "setpts=PTS-STARTPTS", "-an", "-c:v", "libx264", "-crf", "15", "-pix_fmt", "yuv420p", seg)
    log(f"o1 shot{k} {c0:.2f}-{c1:.2f}: raw {dur(raw):.2f}s for {w1 - w0:.2f}s input, stretch x{f:.3f}")
    return seg


def fallback_segment(k, c0, c1):
    seg = O / f"orig-seg-{k}-{c0:.2f}.mp4"
    ff("-ss", START + c0, "-i", MASTER, "-t", c1 - c0, "-vf", f"crop=2880:2160:{x0s[k]:.0f}:0,scale=1440:1080,fps=30,setsar=1",
       "-an", "-c:v", "libx264", "-crf", "15", "-pix_fmt", "yuv420p", seg)
    return seg


def concat(segs, out):
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{s}'\n" for s in segs))
    ff("-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "15", "-pix_fmt", "yuv420p", "-r", "30", out)


SONG = O / "song37.m4a"
ff("-ss", START, "-i", MASTER, "-t", DUR, "-vn", "-c:a", "aac", "-b:a", "192k", SONG)


def finish(silent, out, caption, label):
    graded = out.with_name(out.stem + "-film.mp4")
    ff("-i", silent, "-i", SONG, "-map", "0:v", "-map", "1:a", "-vf", GRADE, "-c:v", "libx264", "-crf", "17",
       "-preset", "slow", "-c:a", "aac", "-shortest", graded)
    log(f"wrote {graded} ({dur(graded):.1f}s)")
    discord(caption, graded, label)
    return graded


o1_segs = {}


def run_o1():
    with cf.ThreadPoolExecutor(3) as ex:
        futs = {ex.submit(o1_segment, k, *c): (k, c) for k, c in o1_plan}
        for fu in cf.as_completed(futs):
            k, c = futs[fu]
            try:
                o1_segs[(k, c[0])] = fu.result()
            except Exception as e:  # noqa: BLE001
                log(f"o1 shot{k} error: {e}")
                o1_segs[(k, c[0])] = None
    segs, missing = [], []
    for k, c in o1_plan:
        sg = o1_segs.get((k, c[0]))
        if sg is None:
            missing.append(k)
            sg = fallback_segment(k, c[0], c[1])
        segs.append(sg)
    concat(segs, O / "o1-37-silent.mp4")
    note = f" Shots {sorted(set(missing))} fell back to the ORIGINAL footage (O1 failed or budget)." if missing else ""
    finish(O / "o1-37-silent.mp4", O / "o1-37",
           f"🌙 Overnight #1: full 37 s, Kling O1, both people in ONE pass per camera shot (no stitching), mic-centred 4:3, "
           f"real song, film grade.{note}", "Kling O1 edit - both people, one pass per shot")


# ---------------- MC track ----------------
def mc_render(who, k):
    """One Kling MC call for one person, one shot -> clip of exactly the shot length (or None)."""
    s, e = shots[k]
    L = e - s
    name = "him" if who is HIM else "her"
    out = O / f"mc-{name}-{k}.mp4"
    if out.exists():
        return out
    side = "left" if who is HIM else "right"
    drv = O / f"drv-{name}-{k}.mp4"
    ff("-ss", s, "-i", O / f"{side}-vertical.mp4", "-t", L, "-an", "-c:v", "libx264", "-crf", "16", drv)
    if L < 3:  # Kling minimum 3 s: ping-pong the clip (fwd, rev, fwd...) and keep the first L seconds afterwards
        n = math.ceil(3 / L)
        padded = O / f"drv-{name}-{k}-pad.mp4"
        parts = "".join(f"[s{i}]" if i % 2 == 0 else f"[r{i}]" for i in range(n))
        fc = (f"[0:v]split={n}" + "".join(f"[s{i}]" for i in range(n)) + ";"
              + "".join(f"[s{i}]reverse[r{i}];" for i in range(n) if i % 2)
              + parts + f"concat=n={n}:v=1:a=0[v]")
        ff("-i", drv, "-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-crf", "16", padded)
        drv = padded
    raw = O / f"mc-{name}-{k}-raw.mp4"
    for attempt in (1, 2):
        if raw.exists() and dur(raw) >= L - 0.15:
            break
        if not charge(f"mc {name} shot{k}", dur(drv) * RATE):
            break
        try:
            args = [S / "fal_kling_motion.py", who["image"], drv, raw, "--face-front", who["front"], "--prompt", who["prompt"]]
            for r in who["refs"]:
                args += ["--face-ref", r]
            sh("bash", S / "fal_env.sh", *args)
            log(f"mc {name} shot{k}: {dur(raw):.2f}s for {L:.2f}s")
        except Exception as ex:  # noqa: BLE001
            log(f"mc {name} shot{k} attempt {attempt} failed: {ex}")
    if not raw.exists():
        return None
    w, h = dims(T20 / ("kling-him-20s.mp4" if who is HIM else "kling-her-20s-v2.mp4"))
    ff("-i", raw, "-vf", f"fps=30,scale={w}:{h},setsar=1,tpad=stop_mode=clone:stop_duration=3,trim=0:{L:.3f},setpts=PTS-STARTPTS",
       "-an", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out)
    return out


def placeholder(who, k):
    """Driving crop for shots the MC track doesn't render (wide shots come from O1 after compositing)."""
    s, e = shots[k]
    name = "him" if who is HIM else "her"
    side = "left" if who is HIM else "right"
    w, h = dims(T20 / ("kling-him-20s.mp4" if who is HIM else "kling-her-20s-v2.mp4"))
    out = O / f"ph-{name}-{k}.mp4"
    ff("-ss", s, "-i", O / f"{side}-vertical.mp4", "-t", e - s, "-vf", f"fps=30,scale={w}:{h},setsar=1", "-an",
       "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out)
    return out


mc_res = {}


def mc_renders():
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(mc_render, who, k): (who, k) for k in mc_shots for who in (HIM, HER)}
        for fu in cf.as_completed(futs):
            who, k = futs[fu]
            try:
                mc_res[(id(who), k)] = fu.result()
            except Exception as e:  # noqa: BLE001
                log(f"mc error shot{k}: {e}")
                mc_res[(id(who), k)] = None


def run_mc():
    res = mc_res
    failed = sorted({k for (_, k), v in res.items() if v is None})
    tracks = {}
    for who, src in ((HIM, T20 / "kling-him-20s.mp4"), (HER, T20 / "kling-her-20s-v2.mp4")):
        name = "him" if who is HIM else "her"
        w, h = dims(src)
        parts = []
        if reuse_until:
            pre = O / f"pre-{name}.mp4"
            ff("-i", src, "-vf", f"fps=30,scale={w}:{h},setsar=1,trim=0:{reuse_until},setpts=PTS-STARTPTS", "-an",
               "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", pre)
            parts.append(pre)
        for k, (s, e) in enumerate(shots):
            if s < reuse_until - 0.01:
                continue
            parts.append(res.get((id(who), k)) or placeholder(who, k))
        concat(parts, O / f"{name}-37.mp4")
        log(f"{name}-37: {dur(O / f'{name}-37.mp4'):.2f}s")
    comp = O / "mc-37-composite.mp4"
    sh(PY, S / "composite_scaled.py", O / "him-37.mp4", O / "her-37.mp4", (O / "plates.txt").read_text().strip(), SONG, comp,
       "--h", "1080", "--canvas-w", "2880", "--mic-center")
    log("composite done")
    # splice: stitched shots, except wide (and failed) shots come from the O1 track
    segs, from_o1 = [], []
    for k, (s, e) in enumerate(shots):
        o1 = [o1_segs.get((kk, c[0])) for kk, c in o1_plan if kk == k]
        if (wide[k] or k in failed) and o1 and all(o1):
            segs += o1
            from_o1.append(k)
            continue
        cut = O / f"mc-cut-{k}.mp4"
        ff("-ss", s, "-i", comp, "-t", e - s, "-vf", "fps=30,scale=1440:1080,setsar=1", "-an", "-c:v", "libx264",
           "-crf", "15", "-pix_fmt", "yuv420p", cut)
        segs.append(cut)
    concat(segs, O / "mc-37-silent.mp4")
    finish(O / "mc-37-silent.mp4", O / "mc-37",
           f"🌙 Overnight #2: full 37 s, stitched (Kling v3 Pro Motion Control x2, height-true, mic-centred 4:3). "
           f"Shots {from_o1} use the O1 one-pass render (wide shots). Real song, film grade.",
           "Kling MC x2 stitched + O1 wide shots")


t0 = time.time()
log(f"start overnight build, budget ${a.budget:.2f}")

def guarded(fn):
    def run():
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            log(f"{fn.__name__} failed: {e}")
    return run


# paid renders of both tracks run side by side; the stitched splice needs the O1 wide shots, so it goes last
threads = [threading.Thread(target=guarded(run_o1)), threading.Thread(target=guarded(mc_renders))]
for t in threads:
    t.start()
for t in threads:
    t.join()
try:
    run_mc()
except Exception as e:  # noqa: BLE001
    log(f"MC track failed: {e}")
log(f"all done in {(time.time() - t0) / 60:.0f} min, spent ${spend['total']:.2f}")
