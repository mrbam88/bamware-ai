# State of the Union — Bamware

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-07-22

## Vision (one line)

White-label mobile-first SaaS platform; first product is **Baat**, a
Pan-South Asian dating app (matches on language, faith, family).

## Now building

First supervised agent fan-out on Baat features (issues #2–#5), then
overnight autonomous runs once boot+Maestro CI gates exist.

## Shipped ✅

| Date | What |
|---|---|
| 2026-07-22 | Mobile CI/CD: merge→OTA preview, tag→TestFlight/Play (gated); first OTA publish succeeded |
| 2026-07-22 | Security: committed Apple creds scrubbed from HEAD, CI credential tripwire, Maestro creds → env |
| 2026-07-22 | Chat contract fix (matches pagination envelope) — chat UI works again |
| 2026-07-21 | Baat design language shipped via tenant config (PR #1): serif/gold, theme engine |
| 2026-06 (agents) | Backend hardening: pagination, rate limiting, Secrets Manager, GSI discover, auto-deploy |
| 2026-06 (agents) | App: sign-up, onboarding wizard, forgot-password + deep links, push notifications, Sentry |
| 2026-05 | Core loop live: auth, profiles, photos→S3, discover, swipe/match, messaging |

## In flight 🔨 (bamware-dating-app issues)

- [#2](https://github.com/mrbam88/bamware-dating-app/issues/2) Match % + commonground badges — ready for agent
- [#3](https://github.com/mrbam88/bamware-dating-app/issues/3) Onboarding cultural steps — ready, supervised
- [#4](https://github.com/mrbam88/bamware-dating-app/issues/4) Chat icebreaker banner — ready for agent
- [#5](https://github.com/mrbam88/bamware-dating-app/issues/5) Settings sub-screens — ready for agent
- [#6](https://github.com/mrbam88/bamware-dating-app/issues/6) Contract-layer ADR (client-core fate) — needs Bilal's decision

## Blocked on Bilal 🔴

- Revoke ASC key `J5U9GPZJFC` + app-specific password at Apple
- `ascAppId` in eas.json + `eas credentials -p ios` (new key)
- Play Console bootstrap (checklist: dating-app docs/RELEASING.md)

## Next up 🗺️

- First tag release `v1.0.3` (makes OTA live on devices)
- Boot + Maestro smoke gate in CI → unlocks overnight agent runs
- Real app icon (Apple auto-rejects the Expo template)
- Fix jest teardown leak (worker force-exit warning)

## Known debt 🧾

- client-core orphaned by both consumers (→ #6)
- Apple creds still in git history (revocation pending; purge optional)
- SDK-56/54 package drift fixed by pinning — run `npx expo install --fix` check on SDK upgrades
- `bamware-workspace` submodule pins stale (May-era)
