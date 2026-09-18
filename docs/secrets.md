# Secrets: one vault, one rule (as of 2026-08-21)

**The vault is AWS SSM Parameter Store.** Every Bamware secret lives there and
nowhere else. If you are an agent looking for a credential, it is in the vault
or it does not exist. Never ask Bilal "where is the key" — run the pull.

## The rule

- **Source of truth:** SSM Parameter Store (SecureString), region `us-east-1`,
  free standard tier. Path convention:
  `/bamware/<app>/<env>/<key>` — e.g. `/bamware/brewdesk/prod/asc-api-key-p8`,
  `/bamware/dating/prod/jwt-secret`, `/bamware/shared/anthropic-api-key`.
- **Secret zero:** each machine/CI gets exactly ONE credential by hand — the
  `bamware-deployer` IAM user key (`aws configure --profile bamware`). It never
  changes when vault contents change. This is the only secret allowed outside
  the vault.
- **GitHub Actions vault is a CACHE holding only secret zero** (AWS key), used
  to pull the rest at runtime. Nothing else goes in it, ever again.
- **Rotation:** change the value in the vault once; every consumer picks it up
  on next pull/run. Revoked keys get DELETED from the vault, not hoarded.
- **File-shaped secrets** (Apple `.p8`, `.p12`, APNs certs) are stored
  base64-encoded as SecureStrings; the pull script materializes them to their
  canonical paths (`~/.appstoreconnect/private_keys/`, etc.).

## Machine bootstrap

`scripts/bootstrap.sh` runs `scripts/secrets-pull.sh` at the end:
`aws configure --profile bamware` once, then every secret lands where its
consumer expects it. New laptop = one key + one script.

## Consumers

| Consumer | How it reads |
|---|---|
| Terraform (bamware-infra) | `data "aws_ssm_parameter"` — no tfvars needed |
| Lambdas | native SSM read at cold start (or baked env via terraform) |
| GitHub Actions | one AWS key in its vault → `aws ssm get-parameter` step |
| Any laptop / AI harness | `scripts/secrets-pull.sh` |
| fastlane / xcodebuild | files materialized by the pull script |

## One-time migration (Bilal)

1. Create the `bamware-deployer` IAM user (also retires the root-key problem).
2. Run `scripts/secrets-upload.sh` and paste each value when prompted — it
   writes SecureStrings and never echoes or stores them locally.
3. Replace every GitHub repo secret with the single AWS key pair.

Incident history that forced this: 2026-08-21 — TestFlight keys unreachable
(only copy in write-only GitHub vault, CI billing-dead) and terraform apply
blocked (secrets nowhere on the machine). See issue bamware-ai#13.

## Day-to-day (added 2026-09-19 — "I hate dealing with keys every time")

- **See what exists:** `scripts/secrets-status.sh` — every key the fleet
  needs, present/MISSING, who consumes it, how it gets delivered. Never
  prints values.
- **Fill and deliver:** `scripts/keys-wizard.sh` — walks the console steps
  Bilal must click (Google OAuth ids, Sign in with Apple, APNs key), stores
  each value in the vault, and pushes it to the consumer (Secrets Manager
  for the auth Lambda, Vercel env for the venue engine). Re-runnable; each
  stage skips when the vault already has the value.
- **Agents read the vault, never ask Bilal:** an agent that needs a non-secret
  value (a Google client id, a team id) runs `aws ssm get-parameter` with the
  local `bamware` profile. Secrets still never go into code, logs, or chat.
- **New app or new key:** add a row to the manifest in `secrets-status.sh`
  and a stage to the wizard in the same PR that introduces the consumer.

Vault paths in use: `/bamware/shared/*` (Apple, Anthropic), `/bamware/<app>/*`
(per app), `/bamware/<app>/<env>/*` (per environment).

