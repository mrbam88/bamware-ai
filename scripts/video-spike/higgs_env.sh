#!/usr/bin/env bash
# Run a Higgsfield script with HF_KEY (ID:SECRET) pulled from the vault (never printed).
# Usage: higgs_env.sh SCRIPT.py [args...]
set -euo pipefail
HF_KEY=$(aws --profile "${BAMWARE_AWS_PROFILE:-bamware}" --region "${BAMWARE_AWS_REGION:-us-east-1}" \
  ssm get-parameter --name /bamware/video-spike/higgsfield-key --with-decryption --query Parameter.Value --output text)
export HF_KEY
exec "${FAL_PY:-$HOME/tools/falenv/bin/python}" "$@"
