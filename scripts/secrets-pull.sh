#!/usr/bin/env bash
# Pull every Bamware secret from the vault (AWS SSM Parameter Store) and
# materialize it where its consumer expects it. Safe to re-run; overwrites.
# Requires: `aws configure --profile bamware` done once (secret zero).
# See docs/secrets.md. Never prints secret values.
set -euo pipefail

PROFILE="${BAMWARE_AWS_PROFILE:-bamware}"
REGION="${BAMWARE_AWS_REGION:-us-east-1}"
aws="aws --profile $PROFILE --region $REGION"

get() { $aws ssm get-parameter --name "$1" --with-decryption --query Parameter.Value --output text; }
exists() { $aws ssm get-parameter --name "$1" >/dev/null 2>&1; }

say() { printf '\033[1;36m[secrets]\033[0m %s\n' "$1"; }

# --- Apple / App Store Connect ---------------------------------------------
if exists "/bamware/shared/asc-api-key-id"; then
  KEY_ID=$(get /bamware/shared/asc-api-key-id)
  mkdir -p ~/.appstoreconnect/private_keys
  get /bamware/shared/asc-api-key-p8-b64 | base64 -d > ~/.appstoreconnect/private_keys/"AuthKey_${KEY_ID}.p8"
  chmod 600 ~/.appstoreconnect/private_keys/"AuthKey_${KEY_ID}.p8"
  say "ASC API key ${KEY_ID} -> ~/.appstoreconnect/private_keys/"
fi
if exists "/bamware/shared/asc-issuer-id"; then
  mkdir -p ~/.config/bamware
  get /bamware/shared/asc-issuer-id > ~/.config/bamware/asc-issuer-id
  say "ASC issuer id -> ~/.config/bamware/asc-issuer-id"
fi

# --- Terraform (bamware-infra) ---------------------------------------------
# Nothing to materialize: terraform reads data.aws_ssm_parameter directly
# using the same profile. Kept here as documentation.

# --- Local .env files (developer convenience, all gitignored) ---------------
if exists "/bamware/shared/anthropic-api-key" && [ -d "$HOME/code/bamware-venue-engine" ]; then
  {
    echo "GOOGLE_MAPS_API_KEY=$(get /bamware/venue-engine/google-maps-api-key 2>/dev/null || true)"
    echo "ANTHROPIC_API_KEY=$(get /bamware/shared/anthropic-api-key)"
  } > "$HOME/code/bamware-venue-engine/.env"
  say "venue-engine .env written"
fi

say "done — vault is the only source; see bamware-ai/docs/secrets.md"
