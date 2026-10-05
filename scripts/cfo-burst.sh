#!/usr/bin/env bash
# CFO burst control — steady vs temporary top-tier lanes
# Usage: cfo-burst.sh status|off|marketing|eng|cos [minutes]
set -euo pipefail
STATE="${BAMWARE_BURST_STATE:-$HOME/.local/state/bamware/cfo/bursts.json}"
mkdir -p "$(dirname "$STATE")"
MINUTES="${2:-60}"
NOW=$(date +%s)
python3 - "$STATE" "$1" "$MINUTES" "$NOW" <<'PY'
import json,sys,time
from pathlib import Path
path, cmd, minutes, now = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
if path.exists():
  doc=json.loads(path.read_text())
else:
  doc={"version":1,"lanes":{},"day":time.strftime("%Y-%m-%d"),"burst_seconds_today":0}
# roll day
day=time.strftime("%Y-%m-%d")
if doc.get("day")!=day:
  doc["day"]=day; doc["burst_seconds_today"]=0
lanes=doc.setdefault("lanes",{})
# expire
for k,v in list(lanes.items()):
  if v.get("until",0) <= now:
    del lanes[k]
cmd=cmd.lower()
if cmd=="status":
  print(json.dumps(doc, indent=2))
  sys.exit(0)
if cmd in ("off","steady"):
  doc["lanes"]={}
  path.write_text(json.dumps(doc, indent=2)+"\n")
  print("burst off — all steady")
  sys.exit(0)
lane={"marketing":"marketing","eng":"eng","engineering":"eng","cos":"cos","chief":"cos"}.get(cmd)
if not lane:
  print("usage: burst status|off|marketing|eng|cos [minutes]"); sys.exit(2)
active=sum(1 for v in lanes.values() if v.get("until",0)>now)
if active>=2 and lane not in lanes:
  print("refused: max 2 concurrent bursts"); sys.exit(1)
# 3h/day soft cap
if doc.get("burst_seconds_today",0) >= 3*3600 and lane not in lanes:
  print("refused: daily burst hours cap (3h) — CEO override needed"); sys.exit(1)
until=now+minutes*60
lanes[lane]={"until":until,"minutes":minutes,"started":now,"tier":"top",
  "prefer":["claude-fable","opus","grok-4.5"],"avoid":["codex-astra-until-reset"]}
doc["burst_seconds_today"]=doc.get("burst_seconds_today",0)+minutes*60
path.write_text(json.dumps(doc, indent=2)+"\n")
print(f"BURST ON · {lane} · top tier · {minutes}m · until {time.strftime('%H:%M', time.localtime(until))}")
print("Prefer: Claude Fable/Opus, Grok 4.5 · Avoid: Codex/Astra until weekly reset")
PY
