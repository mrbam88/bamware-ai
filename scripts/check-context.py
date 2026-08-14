#!/usr/bin/env python3
"""Structural checks on the context repo.

These exist because prose rules in AGENTS.md are suggestions and CI is a wall.
Each check corresponds to a way this repo has actually drifted or could drift
silently: a malformed skill an agent trips on, an INDEX that no longer matches
the directory it describes, or a cross-reference broken by a rename.

Run: python3 scripts/check-context.py   (exits non-zero on any failure)
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"
INDEX = SKILLS / "INDEX.md"
AGENTS = ROOT / "AGENTS.md"

fail = []
def bad(msg): fail.append(msg)

# --- discover -------------------------------------------------------------
dirs = sorted(p.name for p in SKILLS.iterdir() if p.is_dir())
if not dirs:
    bad("no skills found under skills/")

# --- 1. frontmatter -------------------------------------------------------
for d in dirs:
    f = SKILLS / d / "SKILL.md"
    if not f.exists():
        bad(f"{d}: no SKILL.md"); continue
    lines = f.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        bad(f"{d}: missing opening frontmatter delimiter"); continue
    try:
        close = lines.index("---", 1)
    except ValueError:
        bad(f"{d}: unterminated frontmatter"); continue
    fm = lines[1:close]
    name = next((l[len("name:"):].strip() for l in fm if l.startswith("name:")), None)
    desc = next((l[len("description:"):].strip() for l in fm if l.startswith("description:")), None)
    if name is None:
        bad(f"{d}: frontmatter has no name")
    elif name != d:
        bad(f"{d}: frontmatter name is '{name}', must match directory")
    if not desc:
        bad(f"{d}: frontmatter has no description")
    elif len(desc) < 40:
        bad(f"{d}: description is {len(desc)} chars, too short to route on")

# --- 2. INDEX matches the directory --------------------------------------
if not INDEX.exists():
    bad("skills/INDEX.md missing")
else:
    listed = set(re.findall(r"^\| `([a-z0-9-]+)`", INDEX.read_text(encoding="utf-8"), re.M))
    present = set(dirs)
    for m in sorted(present - listed): bad(f"INDEX.md does not list skill '{m}'")
    for x in sorted(listed - present): bad(f"INDEX.md lists '{x}', which does not exist")

# --- 3. cross-references resolve -----------------------------------------
# Repo names are legitimate backticked kebab tokens; harvest them from the
# AGENTS.md repo table so this stays correct when repos are added.
repos = set(re.findall(r"^\| `([a-z0-9-]+)`", AGENTS.read_text(encoding="utf-8"), re.M)) if AGENTS.exists() else set()
known = set(dirs) | repos
for d in dirs:
    f = SKILLS / d / "SKILL.md"
    if not f.exists(): continue
    for tok in set(re.findall(r"`([a-z]+(?:-[a-z]+)+)`", f.read_text(encoding="utf-8"))):
        if tok not in known:
            bad(f"{d}: references `{tok}`, which is neither a skill nor a repo")

# --- report ---------------------------------------------------------------
if fail:
    print(f"context checks FAILED ({len(fail)}):")
    for m in fail: print("  -", m)
    sys.exit(1)
print(f"context checks passed: {len(dirs)} skills, INDEX consistent, all cross-references resolve")
