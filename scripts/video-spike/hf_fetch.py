#!/usr/bin/env python3
"""Fetch every file of a Hugging Face repo (recursively) into ~/.mlx-serve/models/<repo>.

`mlx-serve pull` only fetches top-level files, so nested diffusers-style repos
(transformer/, text_encoder/, vae/) arrive as a bare config.json. Stdlib + curl.

Usage: hf_fetch.py org/repo
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

repo = sys.argv[1]
dest = Path.home() / ".mlx-serve" / "models" / repo
with urllib.request.urlopen(f"https://huggingface.co/api/models/{repo}/tree/main?recursive=1") as r:
    files = [f for f in json.load(r) if f.get("type") == "file" and f["path"] != ".DS_Store"]
for f in files:
    out = dest / f["path"]
    if out.exists() and out.stat().st_size == f.get("size", -1):
        continue
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"fetch {f['path']} ({f.get('size', 0) / 1e9:.2f} GB)", flush=True)
    subprocess.run(["curl", "-sfL", "-o", str(out),
                    f"https://huggingface.co/{repo}/resolve/main/{f['path']}"], check=True)
print(f"done: {len(files)} files in {dest}")
