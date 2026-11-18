#!/usr/bin/env bash
# BrewDesk production probe, run from the build server (omarchy) by a systemd
# user timer every 5 minutes. Release-strategy gates 2 and 3.
#
# Why here and not GitHub Actions: the venue-engine repo is PRIVATE, private
# repos get 2,000 Actions minutes a month, and a 10-minute schedule uses about
# 4,300. GitHub stopped running every job on that repo on 2026-11-18, so the
# probe itself went dark. A cron on a machine we own has no quota.
#
# Cost to the backend: 288 pings a day to /v1/ping (does no work) plus 24 deep
# checks. Worst case under 2% of the AWS Lambda free tier.
#
# Alerts go to Discord only on a state change (down, recovered) and again
# every 6 hours while still down, so it never spams.
set -uo pipefail
BASE="${BREWDESK_BASE:-https://venuekit.bamware.io}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/bamware/brewdesk-probe"
HOOK_FILE="${BREWDESK_PROBE_WEBHOOK_FILE:-$HOME/.config/bamware/discord-webhook-status}"
mkdir -p "$STATE_DIR"
now=$(date +%s)

notify() {
  [ -r "$HOOK_FILE" ] || { echo "no webhook file; message was: $1"; return 0; }
  curl -sS -m 20 -H 'Content-Type: application/json' \
    -d "$(printf '{"content":"%s"}' "$1")" "$(cat "$HOOK_FILE")" >/dev/null || true
}

fail=""
code=$(curl -sS -m 30 -o "$STATE_DIR/ping.json" -w '%{http_code}' "$BASE/v1/ping" 2>/dev/null || echo 000)
{ [ "$code" = "200" ] && grep -q '"ok":true' "$STATE_DIR/ping.json"; } || fail="ping returned $code"

# Deep check once an hour: health and one real venue query.
last_deep=$(cat "$STATE_DIR/last-deep" 2>/dev/null || echo 0)
if [ -z "$fail" ] && [ $((now - last_deep)) -ge 3300 ]; then
  code=$(curl -sS -m 45 -o "$STATE_DIR/health.json" -w '%{http_code}' "$BASE/v1/health" 2>/dev/null || echo 000)
  if [ "$code" != "200" ] || ! grep -q '"ok":true' "$STATE_DIR/health.json"; then fail="health returned $code"
  elif grep -q '"storage"' "$STATE_DIR/health.json" && ! grep -Eq '"storage":\{[^}]*"ok":true' "$STATE_DIR/health.json"; then fail="health says storage is not ok"
  else
    code=$(curl -sS -m 45 -o "$STATE_DIR/venues.json" -w '%{http_code}' "$BASE/v1/venues?lat=40.7359&lng=-73.9911&radius_m=800&limit=5&compact=1" 2>/dev/null || echo 000)
    { [ "$code" = "200" ] && grep -q '"name"' "$STATE_DIR/venues.json"; } || fail="venues returned $code"
  fi
  [ -z "$fail" ] && echo "$now" > "$STATE_DIR/last-deep"
fi

prev=$(cat "$STATE_DIR/status" 2>/dev/null || echo up)
last_alert=$(cat "$STATE_DIR/last-alert" 2>/dev/null || echo 0)
if [ -n "$fail" ]; then
  # One retry a minute later would need a second timer; instead require two
  # consecutive failures before alerting, so a single blip stays quiet.
  strikes=$(( $(cat "$STATE_DIR/strikes" 2>/dev/null || echo 0) + 1 )); echo "$strikes" > "$STATE_DIR/strikes"
  echo "FAIL: $fail (strike $strikes)"
  if [ "$strikes" -ge 2 ] && { [ "$prev" = "up" ] || [ $((now - last_alert)) -ge 21600 ]; }; then
    notify "BrewDesk backend is DOWN: $fail. $BASE"
    echo down > "$STATE_DIR/status"; echo "$now" > "$STATE_DIR/last-alert"
  fi
  exit 1
fi
echo 0 > "$STATE_DIR/strikes"; echo "$now" > "$STATE_DIR/last-ok"
if [ "$prev" = "down" ]; then notify "BrewDesk backend is back up. $BASE"; fi
echo up > "$STATE_DIR/status"
echo "ok"
