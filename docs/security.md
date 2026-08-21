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

## Apple credential inventory — the map (as of 2026-08-21)

Lesson from a wasted morning: agents keep re-discovering (and mis-testing)
Apple credentials. The actual state, so nobody hunts again:

- **GitHub `production` environment vault** (bamware-brewdesk): holds the ONLY
  working unattended-signing set — dist cert `.p12` + ASC API key + issuer ID.
  GitHub secrets are WRITE-ONLY: nothing, including CI itself, can read them
  back out. If Actions is out of minutes, this set is unusable.
- **This/any Mac**: `Apple Development` cert only (no Distribution private
  key). Loose `.p8` files in Downloads/iCloud (`KT8D6Z334F`, `897K96ABU4`,
  `G7LHU69HR8`) all returned 401 against issuer `227b0bbf-…` — either revoked
  or that issuer (scraped from an old log) is wrong. Do not retest blindly:
  the Issuer ID must be read from App Store Connect → Users and Access →
  Integrations, and active Key IDs are listed on the same page.
- **The first successful BrewDesk upload used NO `.p12`**: Xcode
  cloud-managed distribution signing + the logged-in Apple ID / Team ASC key
  (see skills/native-app-to-testflight/references/brewdesk-proof.md). That is
  the free, local, no-new-credentials rail — try it FIRST.
- A 401 from `altool` cannot distinguish "revoked key" from "wrong issuer".
