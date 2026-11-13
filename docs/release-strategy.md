# Release strategy (all Bamware repos)

Set by Bilal, 2026-11-13: "everything should be in prod, unless it's a
breaking change. We don't want to break prod." His role is to test what is
live, not to approve merges.

## The rule

**Green and verified means merged and deployed, the same day.** Work that
sits in an open PR is not done and is not helping anyone. The only reasons to
hold a change are the three gates at the bottom.

## What counts as a breaking change

A change is breaking when a client that is already in users' hands stops
working after it ships. Released app versions cannot be recalled, so the
backend must keep serving them.

| Change | Breaking? | How to ship it |
|---|---|---|
| New optional field, new endpoint, new enum value the client tolerates | No | Merge and deploy |
| Bug fix, performance, logging, tests, docs | No | Merge and deploy |
| Removing or renaming a field, changing a type, making a field null that was a string | **Yes** | Expand, migrate, contract (below) |
| New required request field, stricter validation | **Yes** | Accept both until old app versions are gone |
| Data migration, storage switch, auth change | **Yes** | Behind a flag, with a written rollback, verified on preview first |

When unsure, decode the new response with the oldest app version still on
the App Store. If it fails, it is breaking.

## Shipping a breaking change: expand, migrate, contract

1. **Expand.** Add the new shape next to the old one. Deploy. Old clients
   keep working.
2. **Migrate.** Ship the app version that uses the new shape. Wait until the
   old versions are no longer in use.
3. **Contract.** Remove the old shape in a later deploy.

Risky behaviour goes behind a flag that defaults to off, so the deploy and
the switch-on are separate steps and the switch-off needs no deploy.

## Before the merge

- CI green on the pull request.
- The author ran it: tests are not enough (Definition of Done rules 2, 3, 7).
- Contract tests pass: the app's own models decode the live responses.
- Anything visual was watched at real speed.

## After the deploy

- Confirm the deploy that is live is the commit that was merged.
- Hit the changed feature in production with a real account.
- The 10-minute production probe stays green. If it goes red, roll back
  first and diagnose second. Rollback is `git revert` and push, or the flag.

## Mobile

- Every merge to the app's main branch that changes behaviour gets a
  TestFlight build the same day, after `scripts/smoke-release.sh` passes and
  the screenshots are read.
- App Store submission is Bilal's decision. Stage the version, state what is
  in it once, and keep working.

## The three gates that wait for Bilal

1. New spend (quote first; over $20 always stops).
2. Secrets and credentials.
3. Submitting a build to App Review.

Everything else ships.
