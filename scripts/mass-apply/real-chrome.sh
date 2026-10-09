#!/usr/bin/env bash
# Launch Bilal's "real" application Chrome: a normal, non-automated Chrome
# window on a dedicated profile with a debug port, so fill.py --attach can fill
# forms inside it and Bilal submits there himself. Chrome 136+ refuses a debug
# port on the default profile, hence the dedicated one (log into LinkedIn and
# Google once; it persists). Launched with `open -g` so it does not take focus.
set -euo pipefail
PROFILE="${MASS_APPLY_REAL_PROFILE:-$HOME/.bamware/chrome-bilal}"
PORT="${MASS_APPLY_CDP_PORT:-9222}"
mkdir -p "$PROFILE"
if curl -s -m 2 "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
  echo "real Chrome already listening on $PORT"; exit 0
fi
open -gna "Google Chrome" --args --user-data-dir="$PROFILE" --remote-debugging-port="$PORT" \
  --no-first-run --no-default-browser-check --window-size=1400,1000 "about:blank"
for i in $(seq 1 20); do
  curl -s -m 2 "http://localhost:$PORT/json/version" >/dev/null 2>&1 && { echo "real Chrome up on $PORT (profile $PROFILE)"; exit 0; }
  sleep 0.5
done
echo "Chrome did not open a debug port on $PORT" >&2; exit 1
