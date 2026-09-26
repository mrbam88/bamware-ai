#!/usr/bin/env python3
"""Install only the Bamware skill path and context hook in the active Hermes profile.

Default is a preview. --apply uses supported `hermes config set` commands.
No credentials, permission modes, jobs, other profiles or model settings change.
"""
import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys


def settings(current, root):
    root = Path(root).resolve()
    dirs = list(current.get("skills.external_dirs") or [])
    if str(root / "skills") not in dirs:
        dirs.append(str(root / "skills"))
    command = shlex.join([sys.executable, str(root / "scripts" / "hermes-context.py")])
    hooks = list(current.get("hooks.pre_llm_call") or [])
    entry = {"command": command, "timeout": 30}
    hooks = [hook for hook in hooks if hook.get("command") != command] + [entry]
    return {"skills.external_dirs": dirs, "hooks.pre_llm_call": hooks}


def main():
    import yaml  # Ships with Hermes; no additional package installation.
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not shutil.which("hermes"):
        parser.error("Hermes must already be installed and on PATH")
    root = Path(__file__).resolve().parents[1]
    current = {}
    for section, key in (("skills", "external_dirs"), ("hooks", "pre_llm_call")):
        result = subprocess.run(["hermes", "config", "get", section],
                                check=True, capture_output=True, text=True)
        data = yaml.safe_load(result.stdout) or {}
        if not isinstance(data, dict):
            parser.error(f"Unexpected {section} config format; no changes made")
        current[f"{section}.{key}"] = data.get(key, [])
    plan = settings(current, root)
    home = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))).resolve()
    print(f"Target profile home: {home}")
    print(json.dumps(plan, indent=2))
    if not args.apply:
        print("Preview only. Re-run with --apply to configure this profile.")
        return
    backup = home / "backups" / "bamware-integration-before.json"
    backup.parent.mkdir(parents=True, exist_ok=True)
    # Preserve the original baseline on repeated installs.
    if not backup.exists():
        backup.write_text(json.dumps(current, indent=2) + "\n")
        backup.chmod(0o600)
    for key, value in plan.items():
        subprocess.run(["hermes", "config", "set", key, json.dumps(value)], check=True)
    print(f"Original settings backup: {backup}")
    print("Hook consent is separate: inspect `hermes hooks list`, then approve only this hook.")
    print("New sessions load the configuration. Existing prompt/tool caches are not reset.")


if __name__ == "__main__":
    main()
