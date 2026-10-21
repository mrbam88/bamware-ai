#!/usr/bin/env bash
# Point the already-enabled Hermes plugin `observability/langfuse` at the local
# Langfuse. Idempotent. Refuses unless Langfuse answers on loopback, because the
# plugin blocks on flush and would slow every website/CLI turn against a dead URL.
# Writes only HERMES_LANGFUSE_* keys into ~/.hermes/.env (backup first).
# Does NOT restart hermes-gateway: Discord turns pick this up only after a restart (#64/#65).
set -euo pipefail
ENV_FILE="${LANGFUSE_ENV_FILE:-$HOME/.config/bamware/langfuse.env}"
HERMES_ENV="${HERMES_HOME:-$HOME/.hermes}/.env"
MAX_CHARS="${HERMES_LANGFUSE_MAX_CHARS:-500}"
curl -fsS http://127.0.0.1:3000/api/public/health >/dev/null || { echo "Langfuse not healthy on 127.0.0.1:3000 — run ./up.sh first"; exit 2; }
PK=$(grep -E '^LANGFUSE_INIT_PROJECT_PUBLIC_KEY=' "$ENV_FILE" | cut -d= -f2-)
SK=$(grep -E '^LANGFUSE_INIT_PROJECT_SECRET_KEY=' "$ENV_FILE" | cut -d= -f2-)
[[ "$PK" == pk-lf-* && "$SK" == sk-lf-* ]] || { echo "keys in $ENV_FILE lack pk-lf-/sk-lf- prefixes; the Hermes plugin would reject them"; exit 1; }
# the keys must actually authenticate before we hand them to Hermes
curl -fsS -u "$PK:$SK" http://127.0.0.1:3000/api/public/projects >/dev/null || { echo "Langfuse rejected the keys (headless init may not have run; check docker compose logs langfuse-web)"; exit 1; }
cp -p "$HERMES_ENV" "$HERMES_ENV.bak-langfuse-$(date +%Y%m%d%H%M%S)"
tmp=$(mktemp); grep -vE '^HERMES_LANGFUSE_' "$HERMES_ENV" > "$tmp" || true
cat >> "$tmp" <<L
HERMES_LANGFUSE_PUBLIC_KEY=$PK
HERMES_LANGFUSE_SECRET_KEY=$SK
HERMES_LANGFUSE_BASE_URL=http://127.0.0.1:3000
HERMES_LANGFUSE_MAX_CHARS=$MAX_CHARS
L
install -m 600 "$tmp" "$HERMES_ENV"; rm -f "$tmp"
echo "wrote HERMES_LANGFUSE_* to $HERMES_ENV (MAX_CHARS=$MAX_CHARS). New hermes CLI/website turns trace now; the gateway needs a restart."
