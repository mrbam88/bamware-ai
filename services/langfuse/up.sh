#!/usr/bin/env bash
# Start (or update) the Langfuse stack and wait until the web service is healthy.
# Needs a running Docker daemon reachable by this user (see README gate).
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE="${LANGFUSE_ENV_FILE:-$HOME/.config/bamware/langfuse.env}"
[[ -r "$ENV_FILE" ]] || { echo "missing $ENV_FILE — run ./init-secrets.sh"; exit 1; }
docker info >/dev/null 2>&1 || { echo "BLOCKED: cannot reach the Docker daemon as $(id -un). See README 'Gate'."; exit 2; }
docker compose --env-file "$ENV_FILE" up -d --pull missing
echo "waiting for http://127.0.0.1:3000/api/public/health ..."
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:3000/api/public/health >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:3000/api/public/health; echo
    docker compose --env-file "$ENV_FILE" ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'
    exit 0
  fi
  sleep 2
done
echo "not healthy after 180 s:"; docker compose --env-file "$ENV_FILE" ps; docker compose --env-file "$ENV_FILE" logs --tail 30 langfuse-web; exit 1
