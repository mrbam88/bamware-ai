# Private admin migration (#82)

## Boundary and preserved sources

Bamware Web is public branding/products/contact. Bamware Assistant owns internal
tools behind its existing owner session. Migration is capability-gated: a public
tool is not retired until its private replacement has live verification.

- Stats/seed: same dating backend `/admin/stats` and `/admin/seed`, using its
  existing `x-admin-secret` capability. Tenant is fixed by server configuration.
  Generation/deletion require explicit typed confirmation; count is 1–200.
- Profiles: same `/auth/login` and `/discover?limit=50`. Existing admin/owner JWTs
  must pass HS256 signature, expiry, role and configured-tenant checks. Tokens
  remain in server memory, scoped to an owner-session nonce, and are discarded
  on logout/restart/expiry. No new user, grant or token minting was introduced.
- PR43: copied its tested spend pricing/rollup/snapshot modules from
  `2bb93b755247971e95bf55c2d5e193e27111357a`; reused the existing collector and
  snapshot in place. Cost-report adapter preserved with redacted errors and
  malformed-cost rejection. Token composition and harness/model/repo/day
  breakdowns remain available. Provider percentages remain under Agents (#81),
  never inferred from measured peak tokens or presented as an invented cap.
- PR45: copied CSV/schema/pricing/aggregate/store modules from
  `a8cdb5fc8447ab2c9f3b60c009aad56899063a10`. Same DynamoDB keys, overwrite
  semantics, retry and TTL. Store now receives an explicit capability object
  instead of reading global environment state. CSV batches with any invalid row
  reject atomically before writes. Original sources remain intact.
- The two usage datasets overlap; the UI explicitly prohibits adding them.
  Missing prices/configuration/data remain unknown, not fake zero usage.

## Runtime and configuration

Requires Node >=22.18 for the preserved TypeScript modules. Install the isolated
admin dependencies before startup: from `services/assistant-web`, run
`npm run setup:admin`. `scripts/deploy-assistant-web.sh` does this before touching
service lifecycle. Core chat/quota dependencies and collectors are unchanged.

Configuration is read **in place** from the existing server-held web env file,
never copied to a new file, machine, log, response or GitHub:
`~/code/bamware-web/.claude/worktrees/ai-spend-dashboard/.env.local`.
`ASSISTANT_ADMIN_ENV_FILE` can select an existing capability file. Inherited
configuration overrides file entries; only named admin settings are consumed.
`AI_SPEND_SNAPSHOT_PATH` can point at the existing snapshot. The default snapshot
is that same worktree's `.data/ai-spend-snapshot.json`.

**Do not prune this locked worktree.** The existing quota timer and this reader
still depend on it. Migrating collector ownership/data to another durable path
is a separate coordinated operation, not grounds to copy credentials. Reads
fail closed if the source disappears. PR43/PR45 must not later reintroduce
retired admin routes into the public site.

## Routes and security

- `/admin` and bookmarked `/admin/*`: authenticated admin page, otherwise 303
  to Assistant sign-in. Page and API responses use `no-store`.
- `/api/admin/status`, `/stats`, `/profiles`, `/ai-spend`, `/ai-usage`,
  `/metered-cost`: owner only.
- `/api/admin/login`, `/logout`, `/seed`, `/ai-usage/import`: owner only;
  require `X-Admin-Action: 1` and reject a supplied foreign Origin.
- `/api/ai-usage/ingest`: the existing machine Bearer capability is narrowly
  accepted here only; alternatively owner + CSRF header. An absent ingest
  capability is never accepted. No existing collector destination is changed.
- Upstream failures are redacted. Credentials and raw usage transcripts/cursors
  are never included in admin API output or diagnostics. Profile fields are
  restricted to the columns displayed.

No public endpoint forwards to the private service. The public site's
`lib/admin-migration.ts` controls per-capability retirement: bookmark notice for
pages, 410 for retired APIs, and removal of the footer/login only when all
capabilities have passed. `/internal-tools` is a public, data-free moved notice.
Branding/contact/product/utility routes remain unchanged.

## Verified limitations before cutover

Presence-only inspection and private read-only smoke found:

- No non-empty `ADMIN_SECRET` in the inspected existing web files. Stats/seed
  are unavailable here; the public equivalents remain available.
- Profile auth verification capability exists, but no live admin account was
  connected during automated verification. Existing account login is supported;
  no new credentials/grants are requested or provisioned. Public profiles stay.
- No `AI_USAGE_TABLE` / machine-ingest configuration in those files. PR45
  ingest/CSV implementation is preserved and synthetically tested, but actual
  store integration remains unavailable. No new database is provisioned.
- Existing PR43 snapshot is readable and fresh. Collector timer/data are not
  moved, deleted or reset. #81 meters/independent server collection are retained.
- Browser tooling failed its CDP handshake. No visual/browser pass is claimed.

The next capability steps are to route missing operations through an existing
host-held backend capability (without transferring credentials), verify an
existing admin account's profile read, then enable the corresponding public
retirement flags. This is a partial migration, not acceptance closure.

## Verification and rollback

Production evidence (2026-10-02T19:57Z):

- Assistant implementation `2fc7f26174517515d635122d1b48f9e398b4c30f` was
  fetched/fast-forwarded into the existing production checkout; isolated
  dependencies installed; existing service restarted and active. Later
  concurrent `45dcb9a` was preserved and the read-only smoke passed again.
- Owner page/AI-spend 200; unauthorized APIs 401; same-origin account-disconnect
  200 for the verification session. Fresh snapshot 19:52:44Z; seven quota
  windows and server coverage remain present; existing timer is active/success.
- Web `edc1a3e7b9c85cbafe7569621a7b8e92e830ce9b` deployed through existing
  main→Vercel rail. GitHub deployment `6816979747` reports Production success.
  Domain readback: moved notice 200; AI-spend bookmark 303 and API 410; pending
  tools retain original auth, footer and login. Seventeen route checks passed,
  including public branding/contact/products/utility pages.
- Assistant 103/103 tests; web 15/15 tests, lint and production build passed.
  Independent Claude Max review pickup/result confirmed; dependency-install and
  error-handling findings addressed. Optional browser CDP handshake failed.
- No seed/user-data/ingest writes, Gmail, account grants or paid services used.
  Issue remains open for the explicitly missing capabilities listed above.

`npm test` in Assistant includes synthetic seed mutations, owner/machine auth,
CSRF, JWT/tenant/expiry isolation, CSV idempotency, snapshot dedup, redaction and
real server wiring. No real seed or user-data mutations are performed.

`node services/assistant-web/scripts/verify-admin.mjs` uses the existing owner
capability entirely inside the process, outputs only status/presence evidence,
and makes read-only data requests. Its login/logout establish and remove only
its own verification session. It never generates seed data or imports usage.

Assistant rollback baseline is #81's `7b12452d7003c9538d158fcf051de1ec5ba5b373`.
Revert only the #82 implementation commit on the latest release (do not reset
away concurrent work), then restart `assistant-web`; check health/auth/quotas.
Public rollback baseline is `d6fd0bc7d6f686a9611bf4fc262481945e3e2b57`.
Revert the #82 public cutover commit on latest main and verify Vercel's deployed
SHA. Neither rollback touches collector timers, data or credentials.

Exact published/deployed SHAs and production readback live in issue82 and the
session result receipt; do not infer deployment from a branch push alone.
