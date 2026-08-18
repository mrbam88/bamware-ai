# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-08-15 — **Baat REJECTED 4.3(b)** 🔴

## Vision (one line)

White-label mobile-first software business, ALL altitudes: multi-tenant
SaaS, dedicated instances, full buyouts, + consulting (docs/business-models.md).
First product: **Baat**, Pan-South Asian dating app.

## Now building

**Native platform track:** `bamware-cafe` is the SwiftUI proving ground for
`bamware-ios`; `bamware-venue-engine` is the companion local Express API.
The Xcode development workspace substitutes the sibling shared-package checkout
so app and reusable modules can evolve together.

**Baat track: 🔴 REJECTED 2026-08-04 — Guideline 4.3(b), spam / saturated
category.** Verbatim text + binding rules: `docs/app-store-rejections.md`.
Concept rejection, not a bug — Apple's instruction was "submit a new app," so
**the native iOS track for Baat is closed** (PWA is the only surviving path). Do
not resubmit, re-skin, or appeal on feature merits. Backend, auth, infra, and
the EAS→TestFlight→fastlane rail are unaffected and are the reusable assets.
Still open regardless: **13 PRs awaiting Bilal's review/merge** from the
2026-07-23 fan-out (merge cheat-sheet in each PR); JWT_SECRET needed in Vercel
before web#10; ENVIRONMENT=prod needed on prod dating Lambda. Play Console
bootstrap is moot for now (Google has no 4.3 equivalent, but Baat's iOS
concept problem is not an Android fix).

**Two-app goal (stated 2026-08-15):** ship one SwiftUI app (BrewDesk) and one RN
app, for Bamware branding + interview evidence. The RN app is now selected for
4.3 survivability first: no UGC, no accounts, no IAP in v1, category with no
incumbents. Reuse the Baat **rail**, not the Baat app.

## Shipped ✅

| Date | What |
|---|---|
| 2026-08-04 (recorded 08-15) | 🔴 **Baat v1.0 (6) REJECTED — Guideline 4.3(b) spam.** Submission `029740e2-f219-407d-b065-996ada511f12`, reviewed on iPad Air 11-inch (M3). "There are already enough of these apps on the App Store… reconsider the app concept and submit a new app." Concept rejection — unfixable in the binary, unappealable on feature merits; Apple pointed at a PWA. Recorded verbatim in `docs/app-store-rejections.md`, with binding rules for all future submissions; 4.3(b) pre-flight gate added to `skills/store-submission`. **BrewDesk flagged as exposed** — cafe finder with the speed test cut from v1, i.e. the differentiator is not in the binary. |
| 2026-08-05 (release plan) | **BrewDesk v1 decisions locked:** guest discovery, free launch, optional accounts only with cloud saves + in-app deletion, Ask prototype deferred, iPhone-only. Conversation work preserved at `bamware-cafe` tag `conversation-prototype-v0.1.0`; production plan lives in `docs/brewdesk-go-live.md`. |
| 2026-08-06 | **BrewDesk v1 client checkpoint reviewed + build-verified (Claude, backend/infra).** Reviewed `bamware-cafe@b42eeec` by building it: Release config, `-validate-for-store` → BUILD SUCCEEDED, TEST SUCCEEDED (9 tests, 0 failures). Confirmed in the shipped binary: icon installed (3 appearances), `CFBundleDisplayName=BrewDesk`, `UIDeviceFamily=[1]`, guest flow with no auth/paywall gates, legal URLs repointed to `/brewdesk/*`, OSM attribution + map empty/error states. Issues raised: `ITSAppUsesNonExemptEncryption` absent (export-compliance prompt on every upload); the deleted paywall/auth **still compile in** via the file-system-synchronized group, so StoreKit is linked and the dev auth URL is embedded; the speed test was removed from the UI, so the 4.3(b) positioning must be rewritten away from "measured wifi speeds". Free-v1 decision resolves go-live blockers #3 and #5; #1/#2 are no longer user-facing. "Data Not Collected" confirmed defensible (engine retains nothing; Vercel logs record path without query string). Details in `docs/brewdesk-go-live.md`. |
| 2026-08-05 (late) | **Brewdesk go-live audit (Claude CLI, backend/infra).** App renamed wfhCafe → **Brewdesk**. Audited prod for submission readiness — findings in `docs/brewdesk-go-live.md`. Three 🔴: (1) speed-test observations **do not persist in prod** (confirmed in Vercel runtime logs — read-only FS, per-instance memory), so the paid differentiator loses data; (2) the app ships against the **dev** auth Lambda with no Debug/Release split, and prod infra was never applied; (3) it links **Baat's dating terms/privacy** as its own legal documents. Shipped bamware-web `f108cd4`: `/brewdesk/privacy`, `/brewdesk/support`, new `/brewdesk/terms` with the 3.1.2 subscription disclosures, and 308 redirects from `/wfhcafe/*`. Recommended collapsing blockers by shipping **v1 free without accounts**; awaiting Bilal's call. |
| 2026-08-05 (pm) | **wfhCafe App Store prep, backend/infra session (Claude CLI, native).** Cleared the cloud session's bridge cruft from `bamware-ai/.git` and pushed the constitution. Added the **Runtime capability matrix** to AGENTS.md (which agent runtime may push / touch Xcode / hold credentials) so Cowork is never handed a job it structurally can't do. Shipped **bamware.io/wfhcafe/privacy + /wfhcafe/support** (bamware-web 7328162) — the existing `/privacy` is Baat-specific and unusable for wfhCafe, and `/support` was a 404. Verified prod engine green. Read-verified Sol's P0s: baseURL→prod ✅ (compile-time Debug/Release split), login screen still present ❌ but superseded by Bilal's acquisition-shell decision — **5.1.1 gating is now the one open submission blocker**. Found the speed-test flywheel is disabled in Debug builds (needs https host) — matters for screenshots. Details + privacy-label table in `docs/wfhcafe-mvp-contract.md`. |
| 2026-08-05 | Work-cafe SwiftUI MVP shell verified: full onboarding/StoreKit/separate-tenant auth/location flow, Keychain session restoration, and map-first discovery against 2,180 local venues. Venue Engine production URL is live; Release client points to it while Debug stays local. Shared client/backend contract lives in `docs/wfhcafe-mvp-contract.md`. |
| 2026-08-04 | Native platform baseline: cafe app + local package workspace build, Swift 6/iOS 17 alignment, strict shared-package tests, fail-closed auth, tenant-scoped messaging, latest-request-wins venue loading, and local Venue Engine contract reviewed. OpenCode migration registered this repo as shared context. |
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
