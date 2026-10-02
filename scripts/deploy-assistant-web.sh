#!/usr/bin/env bash
# Install and start the assistant website as a systemd user service on omarchy (#67).
# Bilal (or a session allowed to manage user services) runs it from the deploy clone:
#   ~/srv/bamware-ai/scripts/deploy-assistant-web.sh
# No sudo. Linger is already on. Discord/hermes-gateway/digest timers are not touched.
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)                 # repo root of the clone this script lives in
HERMES_CWD="${HERMES_CWD:-$HOME/code/bamware-ai}"      # canonical checkout, so hermes-context.py activates
ENV_FILE="${ASSISTANT_WEB_ENV_FILE:-$HOME/.config/bamware/assistant-web.env}"
U="$HOME/.config/systemd/user"
[[ -r "$ENV_FILE" ]] || { echo "missing $ENV_FILE (chmod 600, see services/assistant-web/README.md)"; exit 1; }
[[ -d "$HERMES_CWD/.git" ]] || { echo "HERMES_CWD $HERMES_CWD is not a checkout"; exit 1; }
mkdir -p "$U/assistant-web.service.d"
cp "$HERE/scripts/systemd/assistant-web.service" "$U/assistant-web.service"
cat > "$U/assistant-web.service.d/override.conf" <<CONF
# Written by scripts/deploy-assistant-web.sh on $(date -Is).
# Runs from this clone because ~/code/bamware-ai may sit on another branch;
# Hermes keeps cwd in the canonical checkout so scripts/hermes-context.py
# recognises a Bamware directory and injects context.
[Service]
WorkingDirectory=
WorkingDirectory=$HERE/services/assistant-web
Environment=HERMES_CWD=$HERMES_CWD
CONF
systemctl --user daemon-reload
systemctl --user enable --now assistant-web.service
HOST=$(grep -E '^ASSISTANT_WEB_HOST=' "$ENV_FILE" | cut -d= -f2-); HOST=${HOST:-127.0.0.1}
PORT=$(grep -E '^ASSISTANT_WEB_PORT=' "$ENV_FILE" | cut -d= -f2-); PORT=${PORT:-8765}
for _ in $(seq 1 30); do curl -fsS "http://$HOST:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://$HOST:$PORT/api/health"; echo
systemctl --user --no-pager --lines=0 status assistant-web.service | sed -n 1,4p
echo "URL: http://$HOST:$PORT  (tailnet-only when HOST is the Tailscale IP; add http://omarchy.<tailnet>.ts.net:$PORT via MagicDNS)"
echo "next: $HERE/scripts/verify-assistant-web.sh"
