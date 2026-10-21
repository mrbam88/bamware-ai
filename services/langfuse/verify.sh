#!/usr/bin/env bash
# Real end-to-end check, no mocks: a Hermes CLI turn -> a Langfuse trace with the
# same session id, then the failure case (wrong secret -> turn still OK, no trace).
# Each turn is one model call on the existing subscription. Prints a trace URL.
# Langfuse v4 runs in events_only mode: the public /api/public/traces,
# /sessions and /observations read endpoints return 404, so stored events are
# read straight from the stack's own ClickHouse on 127.0.0.1:8123 (loopback,
# password from langfuse.env). Table: events_full (one row per span).
set -euo pipefail
ENV_FILE="${LANGFUSE_ENV_FILE:-$HOME/.config/bamware/langfuse.env}"
REPO="${HERMES_CWD:-$HOME/code/bamware-ai}"
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
CH_PW=$(grep -E '^CLICKHOUSE_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
ch() { curl -fsS -u "clickhouse:$CH_PW" 'http://127.0.0.1:8123/' --data-binary "$1"; }
trace_count_for() { ch "SELECT count() FROM events_full WHERE session_id='$1' AND type='CHAIN'"; }
trace_id_for()    { ch "SELECT trace_id FROM events_full WHERE session_id='$1' AND type='CHAIN' ORDER BY start_time DESC LIMIT 1"; }

echo "== 1. good keys: CLI turn =="
read -r SID REPLY < <(turn "")
echo "session=$SID reply=$REPLY"
for i in $(seq 1 20); do
  N=$(trace_count_for "$SID"); [[ "$N" != "0" ]] && break; sleep 3
done
[[ "$N" != "0" ]] || { echo "FAIL: no trace for session $SID after 60 s"; exit 1; }
TID=$(trace_id_for "$SID")
echo "PASS: trace $TID for session $SID -> $BASE/project/$PROJ/traces/$TID"

echo "== 2. wrong secret: turn must still succeed, no trace =="
# Hermes loads ~/.hermes/.env with override=True, so an exported env var is
# ignored; swap the key inside the file for one turn and restore it (trap).
HERMES_ENV="${HERMES_HOME:-$HOME/.hermes}/.env"
cp -p "$HERMES_ENV" "$HERMES_ENV.verify-bak"
trap 'cp -p "$HERMES_ENV.verify-bak" "$HERMES_ENV"; rm -f "$HERMES_ENV.verify-bak"' EXIT
sed -i -E 's/^HERMES_LANGFUSE_SECRET_KEY=.*/HERMES_LANGFUSE_SECRET_KEY=sk-lf-00000000000000000000000000000000/' "$HERMES_ENV"
read -r SID2 REPLY2 < <(turn "")
cp -p "$HERMES_ENV.verify-bak" "$HERMES_ENV"
echo "session=$SID2 reply=$REPLY2"
sleep 10
N2=$(trace_count_for "$SID2")
[[ "$N2" == "0" ]] && echo "PASS: turn OK, trace absent (fail-open)" || { echo "FAIL: $N2 trace(s) appeared with a wrong key"; exit 1; }
