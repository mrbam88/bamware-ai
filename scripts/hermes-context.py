#!/usr/bin/env python3
"""Bamware context adapter for Hermes' pre_llm_call JSON protocol.

Only Git metadata is refreshed. No checkout, merge, push, model call, secret
read, or message delivery occurs. Repo files are data, never executed.
"""
import json
import os
import re
from pathlib import Path
import subprocess
import sys

TAG = "[BAMWARE_CONTEXT_CHECK]"


def git(root, *args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    return subprocess.run(
        ["git", "-C", str(root), *args], check=True, capture_output=True,
        text=True, timeout=12, env=env,
    ).stdout.strip()


def handle(payload, root):
    root = Path(root).resolve()
    cwd = Path(payload.get("cwd") or ".").resolve()
    extra = payload.get("extra") or {}
    history = extra.get("conversation_history") or []
    if not extra.get("is_first_turn") and any(
        TAG in str(message.get("content", "")) for message in history
        if isinstance(message, dict)
    ):
        return {}
    try:
        sibling = cwd.relative_to(root.parent).parts[0]
    except (ValueError, IndexError):
        sibling = ""
    # Desktop multiplexes workspaces while shell-hook cwd can remain the
    # gateway's launch directory. The current profile is Bamware-integrated:
    # bootstrap desktop sessions independent of that unreliable cwd.
    relevant = (sibling.startswith("bamware-") or sibling == "interviews"
                or extra.get("platform") == "desktop")
    mentioned = re.search(r"\b(bamware|bilal|mrbam88)\b", str(extra.get("user_message", "")), re.I)
    if not relevant and not mentioned:
        return {}
    try:
        return snapshot(root)
    except (OSError, subprocess.SubprocessError, UnicodeError):
        # Never echo Git stderr: a misconfigured remote can contain credentials.
        return {"context": "[BAMWARE_CONTEXT_BLOCKED] Cannot verify current canonical context. "
                "STOP Bamware-specific work; report the access/read failure. "
                "Do not use a cached profile or assume old instructions are current."}


def snapshot(root):
    git(root, "fetch", "--quiet", "origin", "main")
    revision = git(root, "rev-parse", "FETCH_HEAD")
    def read(path):
        return git(root, "show", f"{revision}:{path}")
    marker = read("CONTEXT_VERSION")
    head = git(root, "rev-parse", "HEAD")
    dirty = bool(git(root, "status", "--porcelain"))
    checkout = "CHECKOUT_CURRENT" if head == revision else (
        "CHECKOUT_DIFFERS: STOP before trusting local skills/docs. "
        "Reconcile the checkout without overwriting local work, or read the "
        "needed files with git show at the fetched revision. Never silently use stale skills."
    )
    edits = "LOCAL_EDITS_UNPUBLISHED" if dirty else "WORKTREE_CLEAN"
    return {"context": "\n\n".join([
        TAG, f"context: {marker}\nwrite-path: native git (push access not tested)",
        f"Canonical repo: {root}\nFetched revision: {revision}",
        f"Local HEAD: {head}\n{checkout}\n{edits}",
        "Hermes adapter: Git owns durable Bamware context; Hermes memory is pointer-only. "
        "Load docs/hermes-integration.md for Hermes-specific operation, machine routing, "
        "approval boundaries and handoff. Attribute denials to the observed runtime, "
        "not automatically to Claude. No permission bypass, automatic publishing, "
        "paid fallback or duplicate schedules is authorized by this bootstrap.",
        "## Canonical AGENTS.md\n" + read("AGENTS.md"),
        "## STATE.md excerpt (read relevant sections before task work)\n" + read("STATE.md")[:5000],
        "## Canonical skills index\n" + read("skills/INDEX.md"),
    ])}


if __name__ == "__main__":
    print(json.dumps(handle(json.load(sys.stdin), Path(__file__).resolve().parents[1])))
