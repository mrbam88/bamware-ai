#!/usr/bin/env bash
# Generate ~/.config/bamware/langfuse.env once. Refuses to overwrite.
# No sudo, no Docker, no network. Safe to run before Docker exists.
set -euo pipefail
ENV_FILE="${LANGFUSE_ENV_FILE:-$HOME/.config/bamware/langfuse.env}"
if [[ -e "$ENV_FILE" ]]; then
  echo "exists: $ENV_FILE (delete it yourself to regenerate; that also orphans the Docker volumes' passwords)"; exit 0
fi
EMAIL="${LANGFUSE_USER_EMAIL:-$(git config --get user.email || true)}"
[[ -n "$EMAIL" ]] || { echo "set LANGFUSE_USER_EMAIL (used only for the local Langfuse login)"; exit 1; }
rnd() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-"${1:-32}"; }
MINIO_PW="$(rnd 32)"
umask 077
mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" <<ENV
# Langfuse self-host secrets for omarchy. Generated $(date -Is) by services/langfuse/init-secrets.sh.
# chmod 600, never committed. Rotating a DB password here does NOT rotate it inside an existing volume.
POSTGRES_PASSWORD=$(rnd 32)
CLICKHOUSE_PASSWORD=$(rnd 32)
MINIO_ROOT_PASSWORD=$MINIO_PW
LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY=$MINIO_PW
LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY=$MINIO_PW
LANGFUSE_S3_BATCH_EXPORT_SECRET_ACCESS_KEY=$MINIO_PW
REDIS_AUTH=$(rnd 32)
NEXTAUTH_SECRET=$(rnd 48)
SALT=$(rnd 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NEXTAUTH_URL=http://localhost:3000
TELEMETRY_ENABLED=false
LANGFUSE_INIT_ORG_ID=bamware
LANGFUSE_INIT_ORG_NAME=Bamware
LANGFUSE_INIT_PROJECT_ID=hermes
LANGFUSE_INIT_PROJECT_NAME=Hermes assistant
LANGFUSE_INIT_PROJECT_PUBLIC_KEY=pk-lf-$(openssl rand -hex 16)
LANGFUSE_INIT_PROJECT_SECRET_KEY=sk-lf-$(openssl rand -hex 16)
LANGFUSE_INIT_USER_EMAIL=$EMAIL
LANGFUSE_INIT_USER_NAME=Bilal
LANGFUSE_INIT_USER_PASSWORD=$(rnd 24)
ENV
echo "wrote $ENV_FILE ($(stat -c %a "$ENV_FILE")). UI login: $EMAIL / LANGFUSE_INIT_USER_PASSWORD in that file."
