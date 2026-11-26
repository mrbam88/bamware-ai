"""Find a phrase on a display by reading the screen, and print where to click it.
usage: find-text.py <output name> <phrase...>   -> prints "x y" in global logical pixels, exit 1 if absent"""
import json
import subprocess
import sys
import tempfile

output, phrase = sys.argv[1], [w.lower() for w in sys.argv[2:]]
monitor = next(m for m in json.loads(subprocess.run(["hyprctl", "monitors", "-j"], capture_output=True, text=True).stdout)
               if m["name"] == output)
with tempfile.NamedTemporaryFile(suffix=".png") as shot:
    subprocess.run(["grim", "-o", output, shot.name], check=True)
    tsv = subprocess.run(["tesseract", shot.name, "-", "--psm", "11", "tsv"], capture_output=True, text=True).stdout
words = []
for line in tsv.splitlines()[1:]:
    cols = line.split("\t")
    if len(cols) == 12 and cols[11].strip():
        words.append((cols[11].strip().lower(), int(cols[6]), int(cols[7]), int(cols[8]), int(cols[9])))
for i in range(len(words) - len(phrase) + 1):
    run = words[i:i + len(phrase)]
    same_line = max(w[2] for w in run) - min(w[2] for w in run) < 20
    if [w[0] for w in run] == phrase and same_line:
        left, right = run[0][1], run[-1][1] + run[-1][3]
        top, height = run[0][2], run[0][4]
        scale = monitor["scale"]
        print(round(monitor["x"] + (left + right) / 2 / scale), round(monitor["y"] + (top + height / 2) / scale))
        sys.exit(0)
sys.exit(1)
