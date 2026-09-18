#!/usr/bin/env bash
# Show which Bamware keys exist in the vault (SSM /bamware/...) and who consumes
# them. Never prints values. Add a row here when an app gains a key.
set -euo pipefail
PROFILE="${BAMWARE_AWS_PROFILE:-bamware}"; REGION="${BAMWARE_AWS_REGION:-us-east-1}"
AWS="aws --profile $PROFILE --region $REGION"
# path | consumer(s) | how it gets there
MANIFEST='
/bamware/shared/anthropic-api-key            | venue-engine research, auth emails? no | Secrets Manager bamware/<env>/app (Terraform)
/bamware/shared/asc-issuer-id                | fastlane / TestFlight uploads          | GitHub production vault (manual)
/bamware/shared/asc-api-key-id               | fastlane / TestFlight uploads          | GitHub production vault (manual)
/bamware/shared/asc-api-key-p8-b64           | fastlane / TestFlight uploads          | GitHub production vault (manual)
/bamware/shared/apns-key-p8-b64              | push-service (SNS platform app)        | Terraform apply (infra PR #10)
/bamware/shared/apns-key-id                  | push-service                           | Terraform apply
/bamware/shared/apple-team-id                | push-service, provisioning             | Terraform apply
/bamware/brewdesk/google-ios-client-id       | BrewDesk Info.plist GIDClientID, auth  | agent PR + Secrets Manager GOOGLE_CLIENT_IDS
/bamware/brewdesk/google-server-client-id    | auth-service audience                  | Secrets Manager GOOGLE_CLIENT_IDS
/bamware/auth/dev/jwt-secret                 | auth-service dev, venue-engine          | Secrets Manager + Vercel JWT_SECRET
/bamware/dating/prod/jwt-secret              | auth-service prod, dating-service, web | Terraform (infra PR #6)
/bamware/dating/prod/admin-secret            | dating-service prod                    | Terraform (infra PR #6)
/bamware/venue-engine/google-maps-api-key    | venue-engine photos                    | Vercel GOOGLE_MAPS_API_KEY (manual)
/bamware/venue-engine/admin-key              | venue-engine moderation                | Vercel ADMIN_KEY
'
printf '%-46s %-8s %s\n' "KEY (vault path)" "STATUS" "CONSUMER → DELIVERY"
echo "$MANIFEST" | sed '/^\s*$/d' | while IFS='|' read -r path consumer delivery; do
  path=$(echo "$path" | xargs); consumer=$(echo "$consumer" | xargs); delivery=$(echo "$delivery" | xargs)
  if $AWS ssm get-parameter --name "$path" --query Parameter.Name --output text >/dev/null 2>&1; then st="present"; else st="MISSING"; fi
  printf '%-46s %-8s %s → %s\n' "$path" "$st" "$consumer" "$delivery"
done
echo; echo "Missing something? Run scripts/keys-wizard.sh — it fills the vault and delivers each key."
