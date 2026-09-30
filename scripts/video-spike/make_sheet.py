#!/usr/bin/env python3
"""Reference sheet for one person: face | full body front | full body back | second face. The back view is generated
locally (mlx-serve FLUX.2-klein) from the full-body photo when --back is not given. Free.

Usage: make_sheet.py OUT.jpg --face FACE.jpg --body BODY.png [--face2 FACE2.jpg] [--back BACK.png]
                     [--describe "short grey hair, white shirt, black sweater vest, grey trousers"]
"""
import argparse
import subprocess
from pathlib import Path

from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("out")
p.add_argument("--face", required=True)
p.add_argument("--body", required=True, help="full-body (or waist-up) photo in the outfit to keep")
p.add_argument("--face2")
p.add_argument("--back", help="back view; generated from --body if omitted")
p.add_argument("--describe", default="", help="hair and clothes, used only when generating the back view")
a = p.parse_args()

back = a.back
if not back:
    back = str(Path(a.out).with_name(Path(a.out).stem + "-back.png"))
    w, h = Image.open(a.body).size
    subprocess.run(["python3", str(Path(__file__).with_name("flux_keyframe.py")), back, "--width", str(min(w, 704) // 16 * 16),
                    "--height", str(min(h, 1312) // 16 * 16), "--seed", "11", "--image", a.body, "--prompt",
                    f"The same person from image 1 seen from directly behind, full body from head to shoes, standing upright, "
                    f"{a.describe + ', ' if a.describe else ''}same clothes, plain light grey studio background. Photorealistic."],
                   check=True, capture_output=True)

HT = 1024
tiles = [a.face, a.body, back] + ([a.face2] if a.face2 else [])
ims = [Image.open(t).convert("RGB") for t in tiles]
ims = [im.resize((round(im.width * HT / im.height), HT), Image.LANCZOS) for im in ims]
gap = 24
sheet = Image.new("RGB", (sum(im.width for im in ims) + gap * (len(ims) + 1), HT + 2 * gap), (200, 200, 200))
x = gap
for im in ims:
    sheet.paste(im, (x, gap))
    x += im.width + gap
sheet.save(a.out, quality=92)
print("sheet:", a.out, sheet.size)
