# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-07-23 — **SUBMITTED TO APP REVIEW** 🚀

## Vision (one line)

White-label mobile-first software business, ALL altitudes: multi-tenant
SaaS, dedicated instances, full buyouts, + consulting (docs/business-models.md).
First product: **Baat**, Pan-South Asian dating app.

## Now building

**WAITING ON APPLE** — v1.0.6 in App Review (submitted 2026-07-23,
typical turnaround 24-48h). Meanwhile: Play Console bootstrap (packs +
feature graphic ready, needs service account). **13 PRs awaiting
Bilal's review/merge** from the 2026-07-23 fan-out (see Shipped) —
merge cheat-sheet in each PR; JWT_SECRET needed in Vercel before
web#10; ENVIRONMENT=prod needed on prod dating Lambda.

## Shipped ✅

| Date | What |
|---|---|
| 2026-07-23 | **Biggest fan-out yet: 13 PRs across 5 repos, 8 of 9 backlog issues** (overnight+morning; separate session from SSO work). P0 account deletion end-to-end (app#22 + service#15 + auth#4 + web#9), admin JWT hardening (web#10), isFake prod guard (service#13), push deep links + payload contract fix (app#23 + service#14), profile prompts (app#24), onboarding cultural steps (app#25 — server strips new fields, schema follow-up open), login QoL/Face ID (app#26, needs native build), daily batch (service#16 + infra#4). All PRs tsc+tests green, PR-only. NOT done: app#6 contract layer (stopped mid-run). **Lesson: fleet stalled ~8h on permission prompts → new precondition in skills/agent-fanout** |
| 2026-07-23 | **bamware-mcp shipped** (closes #1): MCP server repo `mrbam88/bamware-mcp` — create_tenant (tenant-config PR into app repo; E2E demo `demo-glow` PR passed app CI), seed_demo_data (`POST /admin/seed`, ADMIN_SECRET stays with humans), board_ops (Projects #2 via gh), provision_dedicated (renders `environments/<customer>/`, terraform apply human-gated). tsc+29 vitest green, MCP inspector pass, gitleaks in CI. Follow-up: app-side build-time tenant selection (copy `tenants/<id>.ts` over `tenant.ts` in release pipeline) |
| 2026-07-23 | **🚀 SUBMITTED TO THE APP STORE** — v1.0.6, full listing via fastlane deliver, 6.5" screenshots, privacy labels, appreview demo account (verified live), bamware.io/baat marketing page shipped |
| 2026-07-23 | **Launch-day pack complete**: real app icon (serif B + ✦), bamware.io/terms + /privacy LIVE (also fixed month-broken Vercel deploys — dead client-core dep), ASC listing pack + privacy labels, seeded demo account, 5 App Store screenshots (6.9", automated capture) |
| 2026-07-23 | Launch-day fixes: matches showed UUIDs → server sends matchedName/matchedPhoto; commonground grammar ("You share X"); icebreaker banner copy; sim builds need ad-hoc signing (CODE_SIGNING_ALLOWED=NO strips Keychain → login breaks — also fixed in E2E workflow) |
| 2026-07-23 | **v1.0.6 → TestFlight ✅ SUBMITTED** (icon + legal); production-channel OTA live — store builds receive JS fixes (name-fix + banner shipped that way) |
| 2026-07-23 | **v1.0.5 → TestFlight**: the overnight drop — block/report end-to-end (Apple P0 ✅), profile detail view, live match scores, working discovery filters (build ✅, submit in flight) |
| 2026-07-22 | **First Android boot of Baat** — debug build via `expo run:android` (CNG prebuild from app.json), sign-in + sign-up render & navigate on Pixel emulator, zero crashes; theme/fonts/edge-to-edge correct. Local rail: JDK 21 (AS JBR) + `ANDROID_HOME=~/Library/Android/sdk` |
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

- Google Cloud service account → Play Console API access → first
  manual AAB upload (packs on ~/Desktop/baat-launch)
- Post-launch debt: auth token refresh (sessions die ~30min), rotate
  BlackMamba24!, MAESTRO_* GH secrets, rotate ADMIN_SECRET (in chat
  transcript)

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
