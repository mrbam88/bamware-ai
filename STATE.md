# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-07-22 (late night)

## Vision (one line)

White-label mobile-first SaaS platform; first product is **Baat**, a
Pan-South Asian dating app (matches on language, faith, family).

## Now building

**OVERNIGHT RUN (Bilal asleep):** Round 2 done — service PRs #6 (discovery
prefs) + #7 (match scoring) merged & deployed to dev; matchScore/commonground
now live server-side (182 tests). Cross-file conflict between the two agents
resolved by supervisor. Service repo gained PR-level CI. Round 3 in flight:
service#3 (block/report backend) + service#5 (prompts schema). Round 4 queued:
mobile #11 (block/report UI) + #12 (profile detail). Morning: Bilal tests
v1.0.4 on TestFlight; #3 onboarding + #6 ADR remain supervised.

## Shipped ✅

| Date | What |
|---|---|
| 2026-07-22 | **v1.0.4 → TestFlight: first agent-built feature drop, fully automated rail** |
| 2026-07-22 | **First agent fan-out: 3 parallel agents → 3 PRs → all merged** (#7 icebreaker banner, #8 match % badges, #9 settings screens; ~5-11 min each, 57/57 tests, boot-verified) |
| 2026-07-22 | Apple credential rotation DONE: old ASC key + app-specific password revoked, new `baat-ci-eas` key in EAS credentials, `ascAppId` set — iOS rail fully wired |
| 2026-07-22 | **v1.0.3 shipped to TestFlight — first fully-automated release** (dispatch → EAS build → submit, zero laptop involvement; new profile w/ push + deep-link entitlements) |
| 2026-07-22 | Mobile CI/CD: merge→OTA preview, tag→TestFlight/Play (gated); first OTA publish succeeded |
| 2026-07-22 | Security: committed Apple creds scrubbed from HEAD, CI credential tripwire, Maestro creds → env |
| 2026-07-22 | Chat contract fix (matches pagination envelope) — chat UI works again |
| 2026-07-21 | Baat design language shipped via tenant config (PR #1): serif/gold, theme engine |
| 2026-06 (agents) | Backend hardening: pagination, rate limiting, Secrets Manager, GSI discover, auto-deploy |
| 2026-06 (agents) | App: sign-up, onboarding wizard, forgot-password + deep links, push notifications, Sentry |
| 2026-05 | Core loop live: auth, profiles, photos→S3, discover, swipe/match, messaging |

## In flight 🔨 (bamware-dating-app issues)

- ~~#2 Match badges~~ ✅ merged (PR #8) · ~~#4 Icebreaker~~ ✅ merged (PR #7) · ~~#5 Settings~~ ✅ merged (PR #9)
- [#3](https://github.com/mrbam88/bamware-dating-app/issues/3) Onboarding cultural steps — next, supervised
- [#6](https://github.com/mrbam88/bamware-dating-app/issues/6) Contract-layer ADR (client-core fate) — needs Bilal's decision
- ~~service#1 match scoring~~ ✅ merged+deployed · ~~service#2 discovery prefs~~ ✅ merged+deployed
- Board grew to 12 cards: P0 block/report pair (#11 app / #3 service), profile detail #12, prompts #13/service#5, deep links #14, curated batch service#4, legal URLs #10

## Blocked on Bilal 🔴

- Android: Google Cloud service-account JSON + Play Console API access
  (Play app exists ✓, EAS keystore exists ✓ — deferred by choice;
  note: his google-services.json is Firebase, NOT this, and its package
  says com.bamware.baat vs actual bamware.baat)

## Next up 🗺️

- Backend issues for the agent-surfaced gaps (match scoring fields, discovery pref fields, tenant legal URLs)
- Boot + Maestro smoke gate in CI → unlocks overnight agent runs
- Real app icon (Apple auto-rejects the Expo template)
- Fix jest teardown leak (worker force-exit warning)

## Known debt 🧾

- client-core orphaned by both consumers (→ #6)
- Apple creds still in git history (revocation pending; purge optional)
- SDK-56/54 package drift fixed by pinning — run `npx expo install --fix` check on SDK upgrades
- `bamware-workspace` submodule pins stale (May-era)
