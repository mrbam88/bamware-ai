# Security ground rules (non-negotiable)

Read before committing to any Bamware repo.

## Credentials

- **No credential values in git. Ever.** CI has a tripwire; it exists because
  an agent once committed an App Store Connect key. That key had to be revoked
  and the history is still tainted (purge pending).
- **Agents get capabilities, humans keep credentials.** Never authenticate to
  an account, generate signing keys, or handle secret values. If a job needs a
  credential the runtime doesn't hold, reassign the job — never move the
  credential.

## PII

- **No PII in public repos.** `bamware-ai` is public. Home address, phone, EEO
  self-identification, and compensation live only in the private `interviews`
  repo.

## Accounts

- **`mrbam88` is the only Bamware account.** Never run Bamware EAS ops under
  the legacy `vpg-health` session. When in doubt: `eas whoami`.

## Known debt

- Old Apple credentials remain in `bamware-dating-app` git history (revoked;
  purge optional). Tracked in STATE.md.
