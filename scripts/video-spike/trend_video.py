#!/usr/bin/env python3
"""One command: two real people into a trend clip, first take. Higgsfield Genjutsu (both people in one pass).

  trend_video.py SOURCE START DUR OUT.mp4 \
      --left  "a 71-year-old man: short grey hair, grey moustache, metal glasses, white shirt, black sweater vest" --left-sheet him.jpg \
      --right "a 66-year-old woman: dark shoulder-length hair, black glasses, green kurta, red dupatta, gold jewelry" --right-sheet her.jpg \
      [--height-ref both.png --height "he is six feet, she is five foot four, a full head shorter"] \
      [--resolution 720p] [--label "..."] [--no-post] [--dry-run]

SOURCE is a local file or a URL (yt-dlp). START/DUR in seconds. Clips over 30 s are split at the scene cut nearest
below each 30 s boundary; part N+1 gets the last frame of part N as a continuity reference. The original song is laid
back on the joined result. Run via higgs_env.sh (needs HF_KEY). Prints the quote first; --dry-run stops there.
Sheets: make_sheet.py. Recipe and gotchas: skills/trend-video.
"""
import argparse
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

S = Path(__file__).resolve().parent
PRICE = {"480p": 0.318, "720p": 0.681, "1080p": 1.632}

p = argparse.ArgumentParser()
p.add_argument("source")
p.add_argument("start", type=float)
p.add_argument("dur", type=float)
p.add_argument("out")
p.add_argument("--left", required=True, help="who replaces the performer who begins on the LEFT (look + clothes)")
p.add_argument("--right", required=True)
p.add_argument("--left-sheet", required=True)
p.add_argument("--right-sheet", required=True)
p.add_argument("--height-ref", help="image of both side by side at true heights")
p.add_argument("--height", default="", help="sentence about their relative heights (used with --height-ref)")
p.add_argument("--orig-left", default="", help="optional: how the original left performer looks, to disambiguate")
p.add_argument("--orig-right", default="")
p.add_argument("--resolution", default="720p", choices=list(PRICE))
p.add_argument("--max-call", type=float, default=15.0, help="max seconds per Higgsfield call (15 s stayed clean; 21 s drifted)")
p.add_argument("--continuity", action="store_true", help="pass the last frame of each part into the next (did not help on Hotel Lobby)")
p.add_argument("--label", default="Higgsfield Genjutsu - both people, one pass")
p.add_argument("--no-post", action="store_true")
p.add_argument("--dry-run", action="store_true")
a = p.parse_args()

out = Path(a.out).resolve()
work = out.with_suffix("")
work.mkdir(parents=True, exist_ok=True)


def sh(*cmd, **kw):
    return subprocess.run([str(c) for c in cmd], check=True, capture_output=True, text=True, **kw).stdout


def ff(*args):
    sh("ffmpeg", "-y", "-loglevel", "error", *args)


def dur(path):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path))


# 1. source
src = a.source
if re.match(r"https?://", src):
    cache = Path.home() / "Movies/video-spike/refs/cache"
    cache.mkdir(parents=True, exist_ok=True)
    src = cache / (hashlib.sha1(a.source.encode()).hexdigest()[:10] + ".mp4")
    if not src.exists():
        sh("yt-dlp", "-q", "--no-warnings", "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b",
           "--merge-output-format", "mp4", "-o", str(src), a.source)
clip = work / "clip.mp4"
ff("-ss", a.start, "-i", src, "-t", a.dur, "-vf", "scale=-2:1080", "-c:v", "libx264", "-crf", "16", "-c:a", "aac", "-b:a", "192k", clip)
song = work / "song.m4a"
ff("-i", clip, "-vn", "-c:a", "copy", song)

# 2. parts (<= 30 s each, split at scene cuts)
cuts = []
MAXCALL = min(a.max_call, 30.0)
if a.dur > MAXCALL:
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(clip), "-vf", "scale=480:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score",
                          "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    t = None
    for line in err.splitlines():
        m = re.search(r"pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
        m = re.search(r"scene_score=([0-9.]+)", line)
        if m and t and float(m.group(1)) > 0.15:
            cuts.append(t)
parts, s0 = [], 0.0
while a.dur - s0 > MAXCALL:
    cands = [c for c in cuts if s0 + 3 <= c <= s0 + MAXCALL]
    e = max(cands) if cands else s0 + MAXCALL
    parts.append((s0, e))
    s0 = e
parts.append((s0, a.dur))
billed = sum(-(-(e - s) // 1) for s, e in parts)
quote = billed * PRICE[a.resolution]
print(f"parts: {[(round(s, 2), round(e, 2)) for s, e in parts]}  billed {int(billed)} s at {a.resolution}: ~${quote:.2f}")
if a.dry_run:
    sys.exit()

# 3. prompt
prompt = (f"Replace the performer who begins on the LEFT{(' (' + a.orig_left + ')') if a.orig_left else ''} with the person in "
          f"image 1: {a.left}; keep their face, hair, glasses and clothes exactly as in image 1. "
          f"Replace the performer who begins on the RIGHT{(' (' + a.orig_right + ')') if a.orig_right else ''} with the person in "
          f"image 2: {a.right}; keep their face, hair, glasses and clothes exactly as in image 2. "
          "Keep this assignment through every camera cut and every turn. ")
if a.height_ref:
    prompt += f"Image 3 shows their true relative heights: {a.height}; keep that height difference in every shot. "
prompt += ("Keep the original motion, lip movement, timing, camera, cuts, set and lighting exactly. "
           "Natural, subtle expressions. Photorealistic.")

# 4. calls
rendered = []
for i, (s, e) in enumerate(parts):
    src_i = work / f"in-{i}.mp4"
    ff("-ss", s, "-i", clip, "-t", e - s, "-c:v", "libx264", "-crf", "14", "-c:a", "aac", src_i)
    out_i = work / f"out-{i}.mp4"
    images = [a.left_sheet, a.right_sheet] + ([a.height_ref] if a.height_ref else [])
    pr = prompt
    if i > 0 and a.continuity:
        last = work / f"out-{i - 1}-last.png"
        ff("-sseof", "-0.1", "-i", rendered[-1], "-frames:v", "1", "-update", "1", last)
        images.append(str(last))
        pr += f" Image {len(images)} shows exactly how both of them look in the previous part of this same video: match it."
    if not out_i.exists():
        cmd = [S / "higgs_genjutsu.py", src_i, out_i, "--prompt", pr, "--resolution", a.resolution]
        for im in images:
            cmd += ["--image", im]
        subprocess.run([sys.executable] + [str(c) for c in cmd], check=True, env={**os.environ})
    rendered.append(out_i)

# 5. join, retime to the exact cut lengths, lay the song
inputs, fc = [], ""
for i, ((s, e), r) in enumerate(zip(parts, rendered)):
    f = (e - s) / dur(r)
    inputs += ["-i", str(r)]
    fc += f"[{i}:v]setpts=PTS*{f:.5f},fps=30,scale=-2:1080,setsar=1[v{i}];"
fc += "".join(f"[v{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0[v]"
ff(*inputs, "-i", song, "-filter_complex", fc, "-map", "[v]", "-map", f"{len(parts)}:a", "-c:v", "libx264", "-crf", "17",
   "-preset", "slow", "-c:a", "aac", "-shortest", out)
print(f"wrote {out} ({dur(out):.1f}s)")
if not a.no_post:
    subprocess.run(["bash", str(S / "discord_upload.sh"), f"🎬 {out.stem}: {a.dur:.0f} s, Higgsfield Genjutsu {a.resolution}, "
                    f"both people in one pass, ~${quote:.2f}|{out}"], env={**os.environ, "LABEL": a.label})
