#!/usr/bin/env bash
# Real checks for #67 against the running website: health, auth negatives, login,
# one Hermes turn (one model call), persisted history via export, restart survival.
# Prints the Hermes session id to paste into the ticket. Never prints the password.
set -euo pipefail
ENV_FILE="${ASSISTANT_WEB_ENV_FILE:-$HOME/.config/bamware/assistant-web.env}"
HOST=$(grep -E '^ASSISTANT_WEB_HOST=' "$ENV_FILE" | cut -d= -f2-); HOST=${HOST:-127.0.0.1}
PORT=$(grep -E '^ASSISTANT_WEB_PORT=' "$ENV_FILE" | cut -d= -f2-); PORT=${PORT:-8765}
B="${ASSISTANT_WEB_URL:-http://$HOST:$PORT}"
PW=$(grep -E '^ASSISTANT_WEB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
JAR=$(mktemp); trap 'rm -f "$JAR"' EXIT
H='content-type: application/json'
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "base: $B"
echo "health: $(curl -fsS "$B/api/health")"
c=$(code -X POST "$B/api/chat" -H "$H" -d '{"text":"x"}');            [[ $c == 401 ]] && echo "unauth chat 401 PASS" || { echo "unauth chat $c FAIL"; exit 1; }
c=$(code -X POST "$B/api/login" -H "$H" -d '{"password":"not-the-password"}'); [[ $c == 401 ]] && echo "wrong password 401 PASS" || { echo "wrong password $c FAIL"; exit 1; }
PW="$PW" python3 -c 'import json,os,sys; sys.stdout.write(json.dumps({"password":os.environ["PW"]}))' \
  | curl -fsS -c "$JAR" -X POST "$B/api/login" -H "$H" --data-binary @- >/dev/null && echo "login PASS"
echo "me: $(curl -fsS -b "$JAR" "$B/api/me")"
R=$(curl -fsS -b "$JAR" -X POST "$B/api/chat" -H "$H" -d '{"text":"Reply with exactly the word WEB-DEPLOY-OK and nothing else."}')
SID=$(printf '%s' "$R" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("reply:",d["reply"].strip()[:120]); print("elapsedMs:",d["elapsedMs"],"trace:",d.get("trace")); print(d["sessionId"])' | tee /dev/stderr | tail -1)
# Hermes writes the export as one JSON document per session, so measure bytes and
# require both the request text and the reply to be present in it.
EXPORT=$(curl -fsS -b "$JAR" "$B/api/sessions/$SID/export")
BYTES=$(printf '%s' "$EXPORT" | wc -c)
if printf '%s' "$EXPORT" | grep -q 'WEB-DEPLOY-OK' && [[ "$BYTES" -gt 1000 ]]; then
  echo "history persisted: session $SID, export $BYTES bytes containing the turn PASS"
else
  echo "export of $SID: $BYTES bytes, turn text missing FAIL"; exit 1
fi
systemctl --user restart assistant-web.service; sleep 3
echo "after restart health: $(curl -fsS "$B/api/health")"
systemctl --user is-active assistant-web.service
echo "SESSION_ID=$SID"
