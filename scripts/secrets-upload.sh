#!/usr/bin/env bash
# ONE-TIME migration: upload Bamware secrets into the vault (SSM SecureString).
# Prompts for each value (silent input, never echoed, never written to disk).
# Re-runnable: skip any prompt with Enter to leave the parameter unchanged.
# Requires an AWS profile that can ssm:PutParameter (root works for the
# one-time run; the deployer user thereafter). See docs/secrets.md.
set -euo pipefail

PROFILE="${BAMWARE_AWS_PROFILE:-bamware}"
REGION="${BAMWARE_AWS_REGION:-us-east-1}"
aws="aws --profile $PROFILE --region $REGION"

put() { # put <path> <value>
  $aws ssm put-parameter --name "$1" --value "$2" --type SecureString --overwrite >/dev/null
  printf '\033[1;32m[ok]\033[0m %s\n' "$1"
}

ask() { # ask <path> <prompt>
  local v
  read -r -s -p "$2 (Enter to skip): " v; echo
  [ -n "$v" ] && put "$1" "$v"
}

askfile() { # askfile <path> <prompt for a FILE PATH, stored base64>
  local f
  read -r -p "$2 (Enter to skip): " f
  [ -n "$f" ] && put "$1" "$(base64 < "$f" | tr -d '\n')"
}

echo "Bamware vault upload — values go straight to SSM, nothing stays local."
ask   /bamware/shared/asc-api-key-id        "App Store Connect API Key ID (e.g. D383SF739)"
askfile /bamware/shared/asc-api-key-p8-b64  "Path to the ASC .p8 file"
ask   /bamware/shared/asc-issuer-id         "ASC Issuer ID (UUID from the Integrations page)"
ask   /bamware/shared/anthropic-api-key     "Anthropic API key"
ask   /bamware/venue-engine/google-maps-api-key "Google Maps/Places API key"
ask   /bamware/dating/prod/jwt-secret       "Baat prod JWT secret (MUST match current prod)"
ask   /bamware/dating/prod/admin-secret     "Baat prod admin secret"
echo "Done. Verify with: scripts/secrets-pull.sh"
