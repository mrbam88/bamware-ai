#!/usr/bin/env bash
# Run fal_replace_two.py with FAL_KEY pulled from the vault (never printed).
# Usage: fal_run.sh FULL.mp4 LEFT_REF RIGHT_REF OUT.mp4 [extra args]
set -euo pipefail
AWS="aws --profile ${BAMWARE_AWS_PROFILE:-bamware} --region ${BAMWARE_AWS_REGION:-us-east-1}"
FAL_KEY=$($AWS ssm get-parameter --name /bamware/video-spike/fal-key --with-decryption --query Parameter.Value --output text)
export FAL_KEY
PY=${FAL_PY:-$HOME/tools/falenv/bin/python}
t0=$(date +%s)
"$PY" "$(dirname "$0")/fal_replace_two.py" "$@"
echo "wall: $(( $(date +%s) - t0 ))s"
