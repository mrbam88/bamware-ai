#!/usr/bin/env bash
# Video spike keys: fal.ai + RunPod -> the vault (SSM /bamware/video-spike/*). Never echoes values.
# Run in a real terminal:  bash scripts/video-spike/keys.sh
# Consumers read them at run time:  aws --profile bamware ssm get-parameter --with-decryption ...
set -euo pipefail
AWS="aws --profile ${BAMWARE_AWS_PROFILE:-bamware} --region ${BAMWARE_AWS_REGION:-us-east-1}"

put() {  # put PATH "Service" URL "where to click"
  local path="$1" name="$2" url="$3" hint="$4" val
  if $AWS ssm get-parameter --name "$path" --query Parameter.Name --output text >/dev/null 2>&1; then
    printf '✓ %s key already in the vault (%s). Enter to keep, or paste a new one: ' "$name" "$path"
  else
    printf '\n%s: opening %s\n  %s\n' "$name" "$url" "$hint"
    open "$url" 2>/dev/null || true
    printf 'Paste the %s key (hidden): ' "$name"
  fi
  read -rs val || true; printf '\n'
  if [[ -n "$val" ]]; then
    $AWS ssm put-parameter --name "$path" --value "$val" --type SecureString --overwrite >/dev/null
    printf '✓ stored %s\n' "$path"
  fi
  unset val
}

put /bamware/video-spike/fal-key "fal.ai" "https://fal.ai/dashboard/keys" \
  "Sign in, add a card under Billing (pay as you go), then Keys -> Add key (scope: API). Copy it."
put /bamware/video-spike/runpod-api-key "RunPod" "https://www.runpod.io/console/user/settings" \
  "Sign in, add ~\$10 credit under Billing, then Settings -> API Keys -> Create (read/write). Copy it."
put /bamware/video-spike/higgsfield-key "Higgsfield (paste as KEY_ID:KEY_SECRET)" "https://console.higgsfield.ai" \
  "Sign in, add ~\$5 credit, then API keys -> Create. Paste the key ID, a colon, then the secret."
echo "Done. Tell Claude 'keys are in'."
