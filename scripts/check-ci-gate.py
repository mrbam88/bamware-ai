#!/usr/bin/env python3
"""Does a repo have a REAL PR-level test gate? Deterministic answer.

A "gate" means: at least one workflow in .github/workflows that
  (a) triggers on pull_request, AND
  (b) actually runs tests or a build (not just a lint).

Why this exists (docs/incidents.md, 2026-08-19): one agent asserted a repo
had no CI without looking, another repeated it, and the daily digest told
Bilal a false fact. Agents do not get to have opinions about CI gates —
they run this script and quote its output.

Verdicts:
  GATE       pull_request-triggered workflow that runs real tests
  LINT_ONLY  workflows exist, none is a real PR test gate
  NONE       confirmed: no workflows directory (HTTP 404)
  UNKNOWN    could not read the repo — this is NOT evidence of anything.
             Never report UNKNOWN as "no CI". Fix auth and re-run.

Usage:
  python3 scripts/check-ci-gate.py <repo> [<repo> ...]
  python3 scripts/check-ci-gate.py --all        # every repo in docs/repos.md

Auth: uses `gh` if available (Mac runner), else GITHUB_TOKEN, else anonymous
(public repos only, rate-limited). Exit 0 = all GATE; 1 = some repo lacks a
gate; 2 = usage error or any UNKNOWN (no verdict possible).
"""
import base64
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

OWNER = "mrbam88"
ROOT = pathlib.Path(__file__).resolve().parent.parent

TEST_RE = re.compile(
    r"(npm (run )?(test|typecheck)|vitest|jest|pytest|swift test|xcodebuild"
    r"|go test|cargo test|flutter (test|build)|fastlane .*test)", re.I)


def api(path: str):
    """GET a GitHub API path. Returns (status, data).

    status: 200 on success, 404 for confirmed-missing, 0 for
    can't-tell (auth/network/rate-limit) — 0 must never be read as absence.
    """
    if shutil.which("gh"):
        r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
        if r.returncode == 0:
            return 200, json.loads(r.stdout)
        return (404, None) if "HTTP 404" in (r.stderr or "") else (0, None)
    req = urllib.request.Request(f"https://api.github.com/{path}")
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req) as resp:
            return 200, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return (404, None) if e.code == 404 else (0, None)
    except Exception:
        return 0, None


def check(repo: str):
    """Return (verdict, detail_lines)."""
    status, listing = api(f"repos/{OWNER}/{repo}/contents/.github/workflows")
    if status == 0:
        return "UNKNOWN", ["could not read repo — NOT evidence of missing CI; fix auth and re-run"]
    if status == 404:
        return "NONE", ["confirmed 404: no .github/workflows"]
    if not isinstance(listing, list):
        return "UNKNOWN", ["unexpected API response"]
    details, gate = [], False
    for entry in listing:
        if not entry["name"].endswith((".yml", ".yaml")):
            continue
        bstatus, blob = api(f"repos/{OWNER}/{repo}/contents/{entry['path']}")
        if bstatus != 200 or not blob:
            return "UNKNOWN", [f"could not read {entry['name']} — no verdict"]
        text = base64.b64decode(blob.get("content", "") or "").decode("utf-8", "replace")
        on_pr = "pull_request" in text.split("jobs:")[0]
        runs_tests = bool(TEST_RE.search(text))
        details.append(f"{entry['name']}: on_pr={on_pr} runs_tests={runs_tests}")
        if on_pr and runs_tests:
            gate = True
    if not details:
        return "NONE", ["workflows dir exists but holds no workflow files"]
    return ("GATE" if gate else "LINT_ONLY"), details


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    if argv[1] == "--all":
        repos_doc = (ROOT / "docs" / "repos.md").read_text(encoding="utf-8")
        repos = re.findall(r"^\| `([a-z0-9-]+)`", repos_doc, re.M)
    else:
        repos = argv[1:]
    rc = 0
    for repo in repos:
        verdict, details = check(repo)
        print(f"{repo}: {verdict}")
        for d in details:
            print(f"  - {d}")
        if verdict == "UNKNOWN":
            rc = 2
        elif verdict != "GATE" and rc == 0:
            rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv))
