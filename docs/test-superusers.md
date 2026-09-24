# Test super-users — the pool, and why an agent still cannot use it yet

Set by Bilal 2026-09-24, after a session lost time asking him to log in by hand.

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

**Until Bilal explicitly accepts that carve-out, an agent follows
`docs/security.md` and stops.** A doc claiming an exception is not the same as
the exception being granted — say so and hand him the command, per RULE #1.

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

## Open — Bilal to confirm

An agent must not guess these, and must not invent accounts:

- **Does he accept the dev/test carve-out above**, and should
  `docs/security.md` carry a pointer to it?
- **Vault path for the pool.** Proposed:
  `/bamware/shared/test-superusers/<name>`, delivered by `secrets-pull.sh` like
  every other secret. If they are not in SSM yet, putting them there is what
  makes this policy work on every machine — today it works only where Bilal
  types them.
- **Which tenants they span, and whether the role is `admin` or `owner`.**
- **Dev/test surfaces only, or prod too?** The carve-out above assumes not
  prod.

Tracked in [bamware-ai#47](https://github.com/mrbam88/bamware-ai/issues/47).
