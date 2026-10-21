#!/usr/bin/env bash
# CFO capacity snapshot for CoS/SM — prepaid pool headroom, no secrets.
#   scripts/cfo-capacity-snapshot.sh           # stdout only
#   scripts/cfo-capacity-snapshot.sh --json    # raw capacity.json
#   BAMWARE_POST_TO=cron scripts/cfo-capacity-snapshot.sh --post
# State: ~/.local/state/bamware/cfo/capacity.json (from burn_alert.py)
# Docs: docs/cfo-capacity-analytics.md
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CAP="${BAMWARE_CFO_CAPACITY:-$HOME/.local/state/bamware/cfo/capacity.json}"
MODE=text
POST=0
for arg in "$@"; do
  case "$arg" in
    --json) MODE=json ;;
    --post) POST=1 ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

if [[ ! -f $CAP ]]; then
  echo "cfo-capacity-snapshot: missing $CAP (run burn_alert or wait for timer)" >&2
  exit 1
fi

if [[ $MODE == json ]]; then
  cat "$CAP"
  exit 0
fi

brief=$(python3 - "$CAP" <<'PY'
import json, sys, time
from pathlib import Path
path = Path(sys.argv[1])
doc = json.loads(path.read_text())
now = time.time()
gen = doc.get("generated_at") or 0
age_m = (now - gen) / 60 if gen else None
pools = doc.get("pools") or []
# worst first: critical > warn > ok; then highest used_pct
rank = {"critical": 0, "warn": 1, "ok": 2, None: 3}
pools = sorted(pools, key=lambda p: (rank.get(p.get("level"), 9), -(p.get("used_pct") or 0)))

lines = ["**CFO capacity** (prepaid pools)"]
if age_m is not None:
    stale = " STALE" if age_m > 30 else ""
    lines.append(f"snapshot {age_m:.0f}m ago{stale}")

fill, throttle = [], []
for p in pools:
    used = p.get("used_pct")
    level = (p.get("level") or "?").upper()
    label = p.get("label") or p.get("key") or "?"
    reset_h = p.get("to_reset_h")
    reset_s = f", ~{reset_h:.0f}h to reset" if isinstance(reset_h, (int, float)) else ""
    used_s = f"{used:.0f}%" if isinstance(used, (int, float)) else "?"
    lines.append(f"· {level} {used_s} — {label}{reset_s}")
    if level == "CRITICAL" or p.get("exhaust_before_reset") or p.get("reserve_before_reset"):
        throttle.append(label)
    elif isinstance(used, (int, float)) and used < 80 and level == "OK":
        fill.append(label)

lines.append("")
if throttle:
    lines.append("**Steer: THROTTLE** " + "; ".join(throttle[:3]))
    lines.append("No new heavy pulls on critical pools; finish in-flight; prefer other headroom.")
elif fill:
    lines.append("**Steer: FILL** headroom on " + "; ".join(fill[:3]))
    lines.append("SM: pull orthogonal Agent-ready WIP up to capacity.")
else:
    lines.append("**Steer: HOLD** — watch burn; bounded work only.")

print("\n".join(lines))
PY
)

printf '%s\n' "$brief"

if [[ $POST -eq 1 ]]; then
  target="${BAMWARE_POST_TO:-cron}"
  case "$target" in
    cron)
      chan="${DISCORD_CRON_CHANNEL:-1556401268245790791}"
      python3 - "$chan" "$brief" <<'PY'
import json, sys, urllib.request
from pathlib import Path
chan, text = sys.argv[1], sys.argv[2]
token = None
for line in (Path.home() / ".hermes" / ".env").read_text().splitlines():
    if line.startswith("DISCORD_BOT_TOKEN="):
        token = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
if not token:
    raise SystemExit("cfo-capacity-snapshot: no DISCORD_BOT_TOKEN")
req = urllib.request.Request(
    f"https://discord.com/api/v10/channels/{chan}/messages",
    data=json.dumps({"content": text, "flags": 4}).encode(),
    method="POST",
    headers={
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
        "User-Agent": "BamwareCFO/1.0",
    },
)
with urllib.request.urlopen(req) as r:
    msg = json.loads(r.read().decode())
print(f"cfo-capacity-snapshot: posted id={msg.get('id')} channel={chan}")
PY
      ;;
    assistant|*)
      BAMWARE_POST_TO=assistant "$ROOT/scripts/discord-post.sh" "$brief"
      ;;
  esac
fi
