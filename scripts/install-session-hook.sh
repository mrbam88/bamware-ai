#!/usr/bin/env bash
# Install/refresh the Claude Code SessionStart hook that runs preflight.sh
# on every new session. Idempotent — safe to re-run.
#
# The hook lives in the user-level ~/.claude/settings.json so it fires
# regardless of which working directory Claude Code is launched in.
#
# Called from bootstrap.sh; also runnable standalone.

set -uo pipefail

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
PREFLIGHT="$SCRIPT_DIR/preflight.sh"
SETTINGS="$HOME/.claude/settings.json"

[ -f "$PREFLIGHT" ] || { echo "error: preflight.sh missing at $PREFLIGHT" >&2; exit 1; }
[ -x "$PREFLIGHT" ] || chmod +x "$PREFLIGHT"

command -v python3 >/dev/null 2>&1 || {
  echo "error: python3 required (used to safely edit JSON settings)." >&2
  exit 1
}

mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

python3 - "$SETTINGS" "$PREFLIGHT" <<'PY'
import json, os, sys, tempfile, time

settings_path, preflight = sys.argv[1], sys.argv[2]

try:
    with open(settings_path) as f:
        data = json.load(f)
except (json.JSONDecodeError, FileNotFoundError):
    # Corrupt or missing — back up and start fresh
    if os.path.exists(settings_path):
        os.rename(settings_path, settings_path + ".bak." + str(int(time.time())))
    data = {}

hooks = data.setdefault("hooks", {})
session_start = hooks.setdefault("SessionStart", [])

# Drop any pre-existing entry that already points at this preflight
session_start[:] = [
    e for e in session_start
    if not any(
        (h.get("command") == preflight)
        for h in e.get("hooks", [])
    )
]
session_start.append({
    "hooks": [{"type": "command", "command": preflight}]
})

# Atomic write
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(settings_path))
try:
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.replace(tmp, settings_path)
except Exception:
    os.unlink(tmp)
    raise

print(f"installed SessionStart hook -> {preflight}")
print("current SessionStart entries:")
for i, e in enumerate(session_start):
    for h in e.get("hooks", []):
        print(f"  [{i}] {h.get('command', '?')}")
PY
