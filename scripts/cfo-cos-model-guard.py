#!/usr/bin/env python3
"""CFO guard: keep Hermes CoS on top (Astra) when OpenAI headroom OK;
demote primary to Grok when OpenAI weekly pool is warn/critical so we never
run the pool dry. Fallback chain always has Grok. Private state only.

Reads ~/.local/state/bamware/cfo/capacity.json
Writes ~/.hermes/config.yaml model.default/provider when needed.
Does not restart gateway (CEO/CoS external restart if live session stuck).
"""
from __future__ import annotations
import json, os, sys, time
from pathlib import Path

try:
    import yaml
except ImportError:
    print("pyyaml required", file=sys.stderr)
    sys.exit(1)

CAP = Path(os.path.expanduser("~/.local/state/bamware/cfo/capacity.json"))
CFG = Path(os.path.expanduser("~/.hermes/config.yaml"))
STATE = Path(os.path.expanduser("~/.local/state/bamware/cfo/cos-model-guard.json"))
TOP = {"provider": "openai-codex", "default": "gpt-6-astra"}
SAFE = {"provider": "xai-oauth", "default": "grok-4.5", "base_url": "https://api.x.ai/v1"}
OPENAI_KEYS = ("openai", "codex", "chatgpt")


def openai_level(cap: dict) -> str:
    worst = "ok"
    order = {"ok": 0, "warn": 1, "critical": 2}
    for p in cap.get("pools") or []:
        key = (p.get("key") or "") + " " + (p.get("label") or "")
        kl = key.lower()
        if any(s in kl for s in OPENAI_KEYS) and "copilot" not in kl:
            lv = p.get("level") or "ok"
            if order.get(lv, 0) > order.get(worst, 0):
                worst = lv
    return worst


def main() -> int:
    if not CAP.exists() or not CFG.exists():
        print("missing capacity or hermes config")
        return 0
    cap = json.loads(CAP.read_text())
    level = openai_level(cap)
    cfg = yaml.safe_load(CFG.read_text()) or {}
    model = dict(cfg.get("model") or {})
    # ensure fallback always has grok
    fbs = cfg.get("fallback_providers") or cfg.get("fallback_model") or []
    if isinstance(fbs, dict):
        fbs = [fbs]
    has_grok = any(
        isinstance(x, dict) and x.get("provider") == "xai-oauth" for x in fbs
    )
    if not has_grok:
        fbs = list(fbs) + [
            {"provider": "xai-oauth", "model": "grok-4.5", "base_url": "https://api.x.ai/v1"}
        ]
        cfg["fallback_providers"] = fbs

    want = SAFE if level in ("warn", "critical") else TOP
    cur_p, cur_m = model.get("provider"), model.get("default")
    changed = False
    if cur_p != want["provider"] or cur_m != want["default"]:
        # preserve other model keys carefully
        model["provider"] = want["provider"]
        model["default"] = want["default"]
        if want is TOP:
            model.pop("base_url", None)
        else:
            model["base_url"] = want["base_url"]
        cfg["model"] = model
        changed = True
        CFG.write_text(
            yaml.safe_dump(cfg, sort_keys=False, default_flow_style=False, allow_unicode=True)
        )
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(
        json.dumps(
            {
                "at": time.time(),
                "openai_level": level,
                "provider": want["provider"],
                "model": want["default"],
                "changed": changed,
            },
            indent=2,
        )
        + "\n"
    )
    action = "demoted" if want is SAFE else "top"
    print(f"cos-model-guard: openai={level} cos={want['provider']}/{want['default']} ({action}) changed={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
