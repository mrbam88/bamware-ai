# Baat OSS audit — bamware-dating-app secrets + history (issue #4)

**Audited:** 2026-08-21 · full clone, all branches (97 commits reachable from `--all`, 15 branches incl. `tenant/demo-glow`)
**Tools:** gitleaks 8.x (`gitleaks detect --source . --log-opts="--all"`) + targeted grep sweep of the complete `git log --all -p` dump (patterns from issue #4 plus AWS keys, private-key blocks, Google/Firebase/GitHub/Slack/OpenAI token shapes, JWTs, credential-embedded URLs, emails, phone numbers).
**Rule:** no secret values appear in this document — locations and kinds only (`docs/security.md`).

## Verdict

**HEAD is clean. History is tainted — needs-scrub.**

Two revoked Apple credentials remain in git history. Direct publication of
`bamware-dating-app` is **blocked**; the fresh-history export (issue #5) is
**mandatory**, and it fully resolves both history findings because no secret
exists in HEAD. Nothing found in HEAD blocks the export.

Findings by severity: **2 high** (history only, both revoked per STATE.md
2026-07-22 — Apple-side verification still owed by Bilal), **2 low**
(identifiers/URLs, not secrets), **5 informational** (all not-secret).

## Findings

| # | Severity | Commit(s) | File | What | Triage |
|---|----------|-----------|------|------|--------|
| 1 | **High** | `a5ee33b` (2026-05-17); removed from HEAD in `c4a3c8e` (2026-07-21) | `fastlane/certs/AuthKey_J5U9GPZJFC.p8` | Complete App Store Connect API private key (PKCS#8). Grants upload/TestFlight/provisioning on team `99812804`. Only gitleaks hit. | **must-strip-in-export** (fresh history). Rotated: STATE.md 2026-07-22 says revoked; replacement `baat-ci-eas` lives in EAS credentials. **Bilal: verify revocation at ASC → Users and Access → Integrations.** |
| 2 | **High** | `66404ce` (introduced); scrubbed from HEAD in `8375ae4` (2026-07-21) | `fastlane/Appfile` | Apple app-specific password as a literal `ENV[...]` assignment (bypasses 2FA for the Apple ID on the old fastlane auth path). | **must-strip-in-export** (fresh history). Rotated: STATE.md 2026-07-22 says revoked; auth path retired for ASC API key envs. **Bilal: verify at appleid.apple.com → App-Specific Passwords.** |
| 3 | Low | HEAD + history | `fastlane/Appfile`, `SECURITY.md` | Apple team id `99812804`, bundle id, and owner Apple ID email (`bmalik.ee@gmail.com`). | **not-secret** — team/bundle ids ship in every binary; the email is the repo's published security contact. May carry into export as-is. |
| 4 | Low | HEAD + history | `src/api/client.ts`, `src/config/tenant.ts`, `src/config/tenants/demo-glow.ts`, `AGENTS.md` | Two hardcoded AWS API Gateway base URLs (`*.execute-api.us-east-1.amazonaws.com`). No embedded credentials or keys. | **not-secret** — endpoints are extractable from the shipped app anyway. Decision for #5: keep, or env-ify for hygiene (recommended, cosmetic only). |
| 5 | Info | history + HEAD | `.env.example` | Sentry DSN line is a `YOUR_KEY@oYOUR_ORG` placeholder — this is what the issue's `@oYOUR_ORG` grep matches. No real DSN ever committed. | **not-secret** |
| 6 | Info | history + HEAD | `.maestro/*.yaml`, `.github/workflows/e2e-ios.yml`, `.env.example`, `docs/RELEASING.md` | `MAESTRO_TEST_EMAIL/PASSWORD` appear only as `${...}` env references, `$VAR` shell refs, and commented examples. No literal values ever committed in this repo. | **not-secret** in this repo. Rotation of the GH secret values is still open per STATE.md ("Blocked on Bilal") — non-blocking for the export. |
| 7 | Info | history + HEAD | `fastlane/lanes/*.rb`, `fastlane/Appfile`, `docs/RELEASING.md`, `SECURITY.md` | `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_KEY_P8_B64` / `ASC_DEMO_PASSWORD` — env references and docs only; `demo_password:` is an `ENV[...]` read with a `SET_ME` fallback in both commits that touched it. | **not-secret** |
| 8 | Info | history + HEAD | test files (`__tests__`, auth tests) | Mock credentials (`a@b.com` / a joke password) and fake tokens (`access-tok`, `apple.id.tok`, …). | **not-secret** |
| 9 | Info | history + HEAD | `fastlane/lanes/*` (review notes) | App-review demo account emails `demo.review@bamware.io` / `appreview@bamware.io`; passwords are env-read, never literal. | **not-secret** — emails are given to Apple review anyway. |

Negative results (clean across all branches and history): AWS access keys
(`AKIA…`), Google API keys / OAuth client ids, Firebase URLs, GitHub/Slack/
OpenAI token shapes, JWT blobs, credential-embedded URLs (`https://user:pass@`),
phone numbers, third-party PII emails (only owner, dummy test, npm-lockfile
author, and bamware demo addresses appear), certificates/keystores other than
finding #1 (`.p12`/`.pem`/`.jks`/keystore/mobileprovision never committed),
`ADMIN_SECRET` (**zero occurrences in this repo's history** — its exposure was a
chat transcript, tracked separately in STATE.md, out of scope for this export).

HEAD hygiene already in place: `*.p8`/`*.p12`/`.env*` gitignored, CI credential
tripwire, Appfile reads everything from env.

## Remediation plan

**Force the fresh-history export (issue #5):** findings **1 and 2**. The
credentials are revoked but the bytes are in every clone of this history;
`bamware-dating-app` must never be flipped public with its current history.
Fresh history is sufficient — no HEAD file needs content changes to remove a
secret.

**Benign — no action required for export:** findings 3–9. Optional cosmetics:
env-ify the two API Gateway URLs (finding 4) and write a fresh `SECURITY.md`
for `baat-rn` that doesn't narrate this repo's incident.

**Human steps (Bilal, per docs/security.md — agents don't touch credentials):**

1. Verify at App Store Connect that key `J5U9GPZJFC` shows revoked (do not
   trust the 2026-07-22 log entry).
2. Verify at appleid.apple.com that the fastlane app-specific password is gone.
3. Rotate `MAESTRO_*` GH secrets and `ADMIN_SECRET` (open in STATE.md;
   neither blocks #5 — no values exist in this repo's history).
4. Optional, defense-in-depth after #5 ships: `git filter-repo` purge of the
   two paths in the private repo per its `SECURITY.md` step 6.

## Scrub checklist for issue #5 (the export ticket)

- [ ] Export from a clean HEAD checkout of `main` — `git init` fresh; **never**
      copy or push this repo's `.git`, and never `git filter-branch` in place
      as the export mechanism.
- [ ] Exclude from the export tree: `fastlane/certs/` (entire dir), any
      `*.p8`/`*.p12` anywhere (belt-and-braces; none exist in HEAD).
- [ ] Carry over `.gitignore` rules: `*.p8`, `*.p12`, `.env`, `.env.*`
      (keep `!.env.example`).
- [ ] Confirm exported `fastlane/Appfile` matches current HEAD (env-only; no
      literal password line).
- [ ] Keep `.env.example` (placeholders only — verified).
- [ ] Decide API Gateway URLs: keep as-is or move to env/config (finding 4;
      either is safe).
- [ ] Replace `SECURITY.md` with a fresh one for `baat-rn` (no incident
      narrative, keep the reporting contact).
- [ ] Carry over the CI credential tripwire; add `gitleaks` to `baat-rn` CI.
- [ ] Before first push: run `gitleaks detect --source . --log-opts="--all"`
      on the new repo — must be zero findings.
- [ ] Gate the public flip on human steps 1–2 above (Apple-side verification).

## Reproduction

```bash
cd bamware-dating-app
gitleaks detect --source . --log-opts="--all"   # 1 finding: the .p8 (finding 1)
git log --all -p > /private/history.txt          # keep OUT of any repo
grep -E 'execute-api|sentry\.io|ADMIN_SECRET|MAESTRO_|ASC_|99812804|AKIA[0-9A-Z]{16}|BEGIN.*PRIVATE KEY' /private/history.txt
```

The raw gitleaks JSON contains the key bytes — it was written to an ephemeral
local scratch directory and is not committed anywhere. Its single finding is
fully characterized as finding 1 above.
