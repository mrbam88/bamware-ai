#!/usr/bin/env bash
# fsq-token.sh — one-time unlock of Foursquare OS Places (free, Apache-2.0).
# Opens the two Hugging Face pages, takes the read token HIDDEN, stores it in
# the SSM vault at /bamware/venue-engine/fsq-hf-token, verifies. Never echoes.
set -euo pipefail
AWS="aws --profile ${AWS_PROFILE:-bamware}"
PARAM=/bamware/venue-engine/fsq-hf-token
open_url() { if command -v open >/dev/null; then open "$1"; elif command -v xdg-open >/dev/null; then xdg-open "$1"; else echo "  open: $1"; fi; }

echo "Stage 1/3 — accept the dataset terms"
echo "  A browser tab opens. Click the button to agree to access the dataset (auto-approved)."
open_url "https://huggingface.co/datasets/foursquare/fsq-os-places"
read -r -p "  Press Enter when done... " _

echo "Stage 2/3 — create a read token"
echo "  Click 'Create new token' → type: Read → name: bamware-fsq → Create, then copy it."
open_url "https://huggingface.co/settings/tokens"
read -r -s -p "  Paste the token (hidden): " TOKEN; echo
[ -n "$TOKEN" ] || { echo "  no token entered"; exit 1; }

echo "Stage 3/3 — store in the vault and verify"
$AWS ssm put-parameter --name "$PARAM" --value "$TOKEN" --type SecureString --overwrite >/dev/null
unset TOKEN
LEN=$($AWS ssm get-parameter --name "$PARAM" --with-decryption --query 'length(Parameter.Value)' --output text)
echo "  ✓ stored $PARAM (${LEN} chars). Tell the agent: 'fsq token is in the vault'."
