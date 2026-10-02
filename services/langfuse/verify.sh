#!/usr/bin/env bash
# Real end-to-end check, no mocks: a Hermes CLI turn -> a Langfuse trace with the
# same session id, then the failure case (wrong secret -> turn still OK, no trace).
# Each turn is one model call on the existing subscription. Prints a trace URL.
set -euo pipefail
ENV_FILE="${LANGFUSE_ENV_FILE:-$HOME/.config/bamware/langfuse.env}"
REPO="${HERMES_CWD:-$HOME/code/bamware-ai}"
PK=$(grep -E '^LANGFUSE_INIT_PROJECT_PUBLIC_KEY=' "$ENV_FILE" | cut -d= -f2-)
SK=$(grep -E '^LANGFUSE_INIT_PROJECT_SECRET_KEY=' "$ENV_FILE" | cut -d= -f2-)
PROJ=$(grep -E '^LANGFUSE_INIT_PROJECT_ID=' "$ENV_FILE" | cut -d= -f2-)
BASE=http://127.0.0.1:3000
turn() { # $1 = extra env assignments (string), prints "<session_id> <reply>"
  local out err sid
  err=$(mktemp)
  out=$(cd "$REPO" && env HERMES_LANGFUSE_DEBUG=true $1 hermes chat -Q -q "Reply with exactly the word PONG and nothing else." 2>"$err") || { echo "hermes exit $? : $(tail -3 "$err")" >&2; rm -f "$err"; return 1; }
  sid=$(grep -oE 'session_id: [A-Za-z0-9_]+' "$err" | tail -1 | awk '{print $2}')
  grep -iE 'langfuse' "$err" | tail -5 >&2 || true
  rm -f "$err"; echo "$sid $out"
}
traces_for() { curl -fsS -u "$PK:$SK" "$BASE/api/public/traces?sessionId=$1&limit=5"; }

echo "== 1. good keys: CLI turn =="
read -r SID REPLY < <(turn "")
echo "session=$SID reply=$REPLY"
for i in $(seq 1 20); do
  N=$(traces_for "$SID" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("data",[])))')
  [[ "$N" != "0" ]] && break; sleep 3
done
[[ "$N" != "0" ]] || { echo "FAIL: no trace for session $SID after 60 s"; exit 1; }
TID=$(traces_for "$SID" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"][0]["id"])')
echo "PASS: trace $TID for session $SID -> $BASE/project/$PROJ/traces/$TID"

echo "== 2. wrong secret: turn must still succeed, no trace =="
read -r SID2 REPLY2 < <(turn "HERMES_LANGFUSE_SECRET_KEY=sk-lf-00000000000000000000000000000000")
echo "session=$SID2 reply=$REPLY2"
sleep 10
N2=$(traces_for "$SID2" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("data",[])))')
[[ "$N2" == "0" ]] && echo "PASS: turn OK, trace absent (fail-open)" || { echo "FAIL: $N2 trace(s) appeared with a wrong key"; exit 1; }
