#!/usr/bin/env bash
# Run an xAI script with XAI_KEY pulled from the vault (never printed).
# Usage: xai_env.sh SCRIPT.py [args...]
set -euo pipefail
XAI_KEY=$(aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" --region "${BAMWARE_AWS_REGION:-us-east-1}" \
  ssm get-parameter --name /bamware/video-spike/xai-key --with-decryption --query Parameter.Value --output text)
export XAI_KEY
exec python3 "$@"
