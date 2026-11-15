#!/usr/bin/env bash
# Cloudflare API token for Terraform DNS on bamware.io (venuekit.bamware.io).
# Opens the token page, takes the token HIDDEN, stores it in the SSM vault at
# /bamware/shared/cloudflare-api-token, verifies it against Cloudflare.
# Never echoes the token.
set -euo pipefail
PARAM="/bamware/shared/cloudflare-api-token"
AWS="aws --profile bamware"
open_url() { if command -v open >/dev/null; then open "$1"; elif command -v xdg-open >/dev/null; then xdg-open "$1"; else echo "  open: $1"; fi; }

echo "Stage 1/2 — create the token"
echo "  A browser tab opens. Create Token → template 'Edit zone DNS' →"
echo "  Zone Resources: Include → Specific zone → bamware.io → Continue → Create Token, then copy it."
open_url "https://dash.cloudflare.com/profile/api-tokens"
read -r -s -p "  Paste the token (hidden): " TOKEN; echo
[ -n "$TOKEN" ] || { echo "  no token entered"; exit 1; }

echo "Stage 2/2 — store in the vault and verify"
$AWS ssm put-parameter --name "$PARAM" --value "$TOKEN" --type SecureString --overwrite >/dev/null
status=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "https://api.cloudflare.com/client/v4/zones?name=bamware.io")
unset TOKEN
if [ "$status" = "200" ]; then echo "  stored and verified (Cloudflare answered 200)"; else echo "  stored, but Cloudflare answered $status — check the token's zone permission"; exit 1; fi
