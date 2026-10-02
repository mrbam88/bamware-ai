# Test super-users — the pool (in force since 2026-09-26)

Set by Bilal 2026-09-24, after a session lost time asking him to log in by hand.
**Carve-out accepted by Bilal 2026-09-26** ("I'm using you as my LastPass for
these test super users"). The pool is live; the roster and rules are below.

Bamware keeps a standing pool of **super-user test accounts named after
basketball players** (Kobe Bryant and others), holding privileges across
tenants. They exist for one reason, in Bilal's words:

> "Testing is always a pain with credentials and that's why I created this
> little system."

Nothing in this repo recorded that the pool existed, so an agent with no prior
context asked him for a password instead of using it. That gap is what this
document closes.

## This amends a standing rule — read both

`docs/security.md` currently states, under non-negotiables:

> **Agents get capabilities, humans keep credentials.** Never authenticate to
> an account, generate signing keys, or handle secret values. If a job needs a
> credential the runtime doesn't hold, reassign the job — never move the
> credential.

Bilal's instruction ("you should always have the admin password ready")
**conflicts with that rule as written**. Both cannot be true at once, so this
document does not pretend the conflict away. The proposed resolution:

- **The rule stands for everything that can touch production** — Apple signing,
  App Store Connect, deploy credentials, prod service secrets. Agents get
  capabilities; Bilal keeps those.
- **The pool is the carve-out, scoped to development and testing.** Named
  super-users, non-production surfaces, values delivered through the vault.

**Accepted 2026-09-26.** The carve-out is in force for the pool below and
nothing else; every other credential still follows `docs/security.md`.

## The rule, once the carve-out is accepted

1. **Pull, never ask.** The vault is AWS SSM; `scripts/secrets-pull.sh`
   delivers to a machine. Asking Bilal to type a password by hand is the
   failure this pool was built to prevent.
2. **Values live in the vault, never in this repo.** This repo is public.
   Names and conventions are documented here; secrets are not.
3. **Dev and test only.** Cross-tenant privilege is the point — and the reason
   these never appear in a demo recording, a screenshot, a support ticket, or
   any repo.
4. **Not the seeded dating profiles.** `/api/admin/seed` in `bamware-web`
   generates fake app users at `customer` role. Those names look similar in a
   profile list; they carry no privilege and reach no admin surface.

## Before concluding a login is broken

A blank `JWT_SECRET` looks exactly like a wrong password, and is the more common
cause. `bamware-web/lib/auth.ts` **fails closed**: with no secret it rejects
every token before any password is checked, so every account in the pool fails
identically.

```bash
grep '^JWT_SECRET=' .env.local     # an empty value 401s every login
```

That file's own comment states the constraint: the value must equal
`JWT_SECRET` in `bamware-auth-service` (the signer), or all admin logins 401.
`bamware-web` admits `admin` and `owner` roles (`ADMIN_ROLES` in
`lib/auth.ts`); a valid token carrying any other role gets the same 401.

The fix is a vault pull, not a new password:

```bash
scripts/secrets-pull.sh
```

Observed 2026-09-24 on `omarchy`: `bamware-web/.env.local` carried
`JWT_SECRET=` with an empty value, and a session read it as a credential
problem for several exchanges. It was configuration.

## The roster (as of 2026-09-26)

Five accounts, `<name>@bamware.com`, registered on **both** tenants the auth
service accepts (`bamware-dating`, `bamware-brewdesk`) through
`POST /auth/register`, then promoted on both DynamoDB rows with
`emailVerified: true`. Passwords are in the vault, never here.

| name | role on both tenants | reaches |
|---|---|---|
| curry | admin | web `/admin`, apps |
| kobe | admin | web `/admin`, apps |
| lebron | owner | web `/admin`, apps |
| jordan | staff | apps only (web admin admits `admin`/`owner`) |
| magic | customer | apps only |

- **Vault path:** `/bamware/shared/test-superusers/<name>` (SSM SecureString).
  `scripts/secrets-pull.sh` writes them to `~/.config/bamware/test-superusers.env`.
- **Environments:** all of them. Today only `dev` is deployed
  (`docs/environments.md`); when `prod` exists, provision the same roster the
  same way. Bilal wants these to work everywhere, prod included.
- **Changing a role** is expected ("battle testing"): update `role` on BOTH
  rows (`TENANT#<tenant>#USER#<email>` and `USER#<userId>`), then update the
  agent memory that holds the pool. One-row edits are the bug in
  [auth-service#18](https://github.com/mrbam88/bamware-auth-service/issues/18).
- **Never hand-write rows.** The 2026-09-24 seed rows were half-written
  (mis-keyed `USER#` twins, no `schemaVersion`); they were backed up and
  removed on 2026-09-26 and re-created through the API. `pnpm seed` in
  `bamware-auth-service` now goes through `putUser` and reads passwords from
  the vault.
- **Why NBA names:** unique, and no real app user will ever carry them.

## Resolved (2026-09-26)

- Carve-out: accepted. `docs/security.md` points here.
- Vault path: as above. Tenants: both. Roles: as above. Environments: all.

Tracked in [bamware-ai#47](https://github.com/mrbam88/bamware-ai/issues/47).
