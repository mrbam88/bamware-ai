#!/usr/bin/env bash
# Run any fal script with FAL_KEY pulled from the vault (never printed).
# Usage: fal_env.sh SCRIPT.py [args...]
set -euo pipefail
FAL_KEY=$(aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" --region "${BAMWARE_AWS_REGION:-us-east-1}" \
  ssm get-parameter --name /bamware/video-spike/fal-key --with-decryption --query Parameter.Value --output text)
export FAL_KEY
exec "${FAL_PY:-$HOME/tools/falenv/bin/python}" "$@"
