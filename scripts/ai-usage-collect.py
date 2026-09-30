#!/usr/bin/env python3
"""Collect Claude Code token usage from local transcripts and post it to the
AI usage dashboard (bamware.io/admin/ai-usage, bamware-web#12).

Reads ~/.claude/projects/**/*.jsonl, sums each assistant message's `usage`
into hourly rollups per (session, stream, model), and POSTs them to
$AI_USAGE_URL/api/ai-usage/ingest. Rollups are recomputed whole from the
transcript and overwrite what the server has, so re-running is always safe.
Only transcripts that changed since the last run are re-read.

  scripts/ai-usage-collect.py            # post changed transcripts
  scripts/ai-usage-collect.py --dry-run  # print a summary, post nothing
  scripts/ai-usage-collect.py --all      # ignore state, re-post everything

Config: ~/.config/bamware/ai-usage.env (AI_USAGE_URL, AI_USAGE_INGEST_TOKEN,
AI_USAGE_HOST). Setup: docs/ai-usage.md. Stdlib only. Never prints the token.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import socket
import sys
import urllib.error
import urllib.request

CONFIG = pathlib.Path.home() / ".config" / "bamware" / "ai-usage.env"
STATE = pathlib.Path(os.environ.get("XDG_STATE_HOME", pathlib.Path.home() / ".local" / "state")) / "bamware" / "ai-usage-collect.json"
PROJECTS = pathlib.Path(os.environ.get("CLAUDE_CONFIG_DIR", pathlib.Path.home() / ".claude")) / "projects"
BATCH = 500  # server accepts up to 2,000 rollups per request

# feat/12-foo, fix/bd-97-bar, issue-41, web#12 -> the number, if the branch names one.
TICKET = re.compile(r"(?:^|/)(?:[a-z]+[-#])?(?!20\d\d-)(\d{1,5})(?=[-_/]|$)")


def load_config():
    cfg = {}
    if CONFIG.exists():
        for line in CONFIG.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("AI_USAGE_URL", "AI_USAGE_INGEST_TOKEN", "AI_USAGE_HOST"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    cfg.setdefault("AI_USAGE_URL", "https://bamware.io")
    cfg.setdefault("AI_USAGE_HOST", socket.gethostname())
    return cfg


def repo_of(cwd):
    """Repo name from a working directory; worktrees report their parent repo."""
    if not cwd:
        return ""
    path = cwd.split("/.claude/worktrees/")[0]
    return pathlib.PurePosixPath(path).name


def ticket_of(repo, branch):
    if not branch or branch in ("main", "master", "HEAD"):
        return ""
    m = TICKET.search(branch)
    if not m:
        return ""
    short = repo.removeprefix("bamware-") if repo else ""
    return f"{short}#{m.group(1)}" if short else f"#{m.group(1)}"


def hour_of(ts):
    t = dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    return t.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:00:00.000Z")


def read_messages(path):
    """Assistant messages in one transcript, deduplicated.

    Claude Code writes one line per content block, each repeating the same
    message id and usage, so keep the last line per (message id, request id).
    """
    seen = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if '"assistant"' not in line or '"usage"' not in line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue  # a line still being written
            msg = d.get("message") or {}
            usage = msg.get("usage")
            model = msg.get("model") or ""
            if d.get("type") != "assistant" or not usage or not d.get("timestamp") or model.startswith("<"):
                continue
            seen[(msg.get("id"), d.get("requestId"))] = (d, msg, usage)
    return seen.values()


def rollups_for(path, host):
    buckets = {}
    stream = path.stem
    for d, msg, u in read_messages(path):
        session = d.get("sessionId") or stream
        ts = d["timestamp"]
        key = (hour_of(ts), session, msg["model"])
        b = buckets.get(key)
        if b is None:
            repo = repo_of(d.get("cwd", ""))
            branch = d.get("gitBranch") or ""
            b = buckets[key] = {
                "hourStart": key[0], "host": host, "source": "claude-code", "sessionId": session,
                "stream": stream, "model": msg["model"], "repo": repo, "branch": branch,
                "ticket": ticket_of(repo, branch), "input": 0, "output": 0, "cacheWrite5m": 0,
                "cacheWrite1h": 0, "cacheRead": 0, "messages": 0, "firstTs": ts, "lastTs": ts,
            }
        cc = u.get("cache_creation") or {}
        write_1h = cc.get("ephemeral_1h_input_tokens", 0) or 0
        write_5m = cc.get("ephemeral_5m_input_tokens")
        if write_5m is None:  # older transcripts carry only the total
            write_5m = max((u.get("cache_creation_input_tokens") or 0) - write_1h, 0)
        b["input"] += u.get("input_tokens") or 0
        b["output"] += u.get("output_tokens") or 0
        b["cacheWrite5m"] += write_5m
        b["cacheWrite1h"] += write_1h
        b["cacheRead"] += u.get("cache_read_input_tokens") or 0
        b["messages"] += 1
        b["firstTs"] = min(b["firstTs"], ts)
        b["lastTs"] = max(b["lastTs"], ts)
    return list(buckets.values())


def transcripts():
    # Top-level sessions and their subagents (<session>/subagents/agent-*.jsonl).
    return sorted(p for p in PROJECTS.glob("**/*.jsonl") if p.is_file())


def post(cfg, rollups):
    url = cfg["AI_USAGE_URL"].rstrip("/") + "/api/ai-usage/ingest"
    body = json.dumps({"rollups": rollups}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg['AI_USAGE_INGEST_TOKEN']}",
        "User-Agent": "bamware-ai-usage-collect/1",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r).get("written", 0)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        raise SystemExit(f"ingest failed: HTTP {e.code} {detail}")
    except urllib.error.URLError as e:
        raise SystemExit(f"ingest failed: {e.reason}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="summarize, don't post or save state")
    ap.add_argument("--all", action="store_true", help="re-read every transcript, ignoring state")
    args = ap.parse_args()

    cfg = load_config()
    if not args.dry_run and not cfg.get("AI_USAGE_INGEST_TOKEN"):
        raise SystemExit(f"AI_USAGE_INGEST_TOKEN is not set (expected in {CONFIG}); see docs/ai-usage.md")

    state = {} if args.all or not STATE.exists() else json.loads(STATE.read_text())
    changed, fresh_state, rollups = [], {}, []
    for p in transcripts():
        st = p.stat()
        sig = [st.st_size, int(st.st_mtime)]
        fresh_state[str(p)] = sig
        if state.get(str(p)) != sig:
            changed.append(p)
            rollups.extend(rollups_for(p, cfg["AI_USAGE_HOST"]))

    if args.dry_run:
        by_model = {}
        for r in rollups:
            m = by_model.setdefault(r["model"], [0, 0, 0])
            m[0] += r["input"] + r["output"] + r["cacheWrite5m"] + r["cacheWrite1h"]
            m[1] += r["cacheRead"]
            m[2] += r["messages"]
        print(f"host={cfg['AI_USAGE_HOST']} transcripts={len(changed)} rollups={len(rollups)}")
        for model, (w, cr, n) in sorted(by_model.items(), key=lambda x: -x[1][0]):
            print(f"  {model:28} window_tokens={w:>12,} cache_read={cr:>14,} messages={n:>6,}")
        return

    written = 0
    for i in range(0, len(rollups), BATCH):
        written += post(cfg, rollups[i:i + BATCH])
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(fresh_state))
    if rollups:
        print(f"posted {written} rollups from {len(changed)} transcript(s)")


if __name__ == "__main__":
    sys.exit(main())
