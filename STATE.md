# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-07-23 (LAUNCH DAY)

## Vision (one line)

White-label mobile-first SaaS platform; first product is **Baat**, a
Pan-South Asian dating app (matches on language, faith, family).

## Now building

**OVERNIGHT RUN COMPLETE — 4 rounds, 9 agent PRs, all merged.** ☀️

Morning report for Bilal:
1. **Server (deployed to dev):** match scoring live (matchScore/commonground
   on discover+matches) · discovery prefs accepted+filtering by age ·
   **block/report API live (P0)** with mutual exclusion everywhere ·
   prompts schema round-tripping. 228 backend tests.
2. **Mobile (merged to main):** block/report UI in chat (P0 done end-to-end)
   · profile detail view (photo pager, badge, prompts, like/pass from
   detail). 85 app tests, boot-verified in simulator.
3. **Supervisor interventions:** 1 real merge conflict (both backend agents
   restructured discoverService) — resolved + re-verified; 1 premature
   deploy-probe false alarm — re-checked properly.
4. **Infra added overnight:** PR-level CI on the service repo.
5. **Your morning list:** test v1.0.4 on TestFlight (note: it predates
   tonight's mobile features — cut v1.0.5 whenever) · rotate BlackMamba24!
   + set MAESTRO_* GH secrets · then #3 onboarding (supervised) + #6 ADR.

## Shipped ✅

| Date | What |
|---|---|
| 2026-07-23 | **Launch-day pack complete**: real app icon (serif B + ✦), bamware.io/terms + /privacy LIVE (also fixed month-broken Vercel deploys — dead client-core dep), ASC listing pack + privacy labels, seeded demo account, 5 App Store screenshots (6.9", automated capture) |
| 2026-07-23 | Launch-day fixes: matches showed UUIDs → server sends matchedName/matchedPhoto; commonground grammar ("You share X"); icebreaker banner copy; sim builds need ad-hoc signing (CODE_SIGNING_ALLOWED=NO strips Keychain → login breaks — also fixed in E2E workflow) |
| 2026-07-23 | **v1.0.6 → TestFlight ✅ SUBMITTED** (icon + legal); production-channel OTA live — store builds receive JS fixes (name-fix + banner shipped that way) |
| 2026-07-23 | **v1.0.5 → TestFlight**: the overnight drop — block/report end-to-end (Apple P0 ✅), profile detail view, live match scores, working discovery filters (build ✅, submit in flight) |
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

- **THE launch step:** ASC → listing pack (delivered) → attach v1.0.6 →
  Submit for Review. Demo account for review notes:
  demo.review@bamware.io (password in the listing pack).
- Android: Google Cloud service-account JSON + Play Console API access
  (Play app ✓, keystore ✓; google-services.json is Firebase — not this)
- Post-launch: auth token refresh endpoint (sessions die in ~30min —
  users will be logged out constantly), rotate BlackMamba24!, MAESTRO_*
  GH secrets

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
