#!/usr/bin/env python3
"""Burn a model-name banner onto the top of a video (PIL text -> ffmpeg overlay; this ffmpeg has no drawtext).
Usage: label_video.py IN.mp4 OUT.mp4 "Kling v3 Pro Motion Control"   (use " | " to split left/right labels)"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

src, dst, text = sys.argv[1], sys.argv[2], sys.argv[3]
st = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                "-of", "json", src], capture_output=True, text=True).stdout)["streams"][0]
W, H = st["width"], st["height"]
size = max(18, int(min(W, H) * 0.035))
font = None
for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
          "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/liberation/LiberationSans-Bold.ttf"):
    if Path(f).exists():
        font = ImageFont.truetype(f, size)
        break
font = font or ImageFont.load_default(size)  # PIL >= 10.1 scales the built-in font
bar = int(size * 1.8)
img = Image.new("RGBA", (W, bar), (0, 0, 0, 150))
d = ImageDraw.Draw(img)
parts = [t.strip() for t in text.split(" | ")]
for i, t in enumerate(parts):  # one label per equal-width column (for side-by-side videos)
    col = W // len(parts)
    d.text((i * col + size // 2, int(size * 0.35)), t, fill=(255, 255, 255, 255), font=font)
png = Path(tempfile.mkdtemp()) / "label.png"
img.save(png)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-i", str(png), "-filter_complex", "[0:v][1:v]overlay=0:0[v]",
                "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "copy", dst], check=True)
print("labelled", dst)
