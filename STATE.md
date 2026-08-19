# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-08-19 — **BrewDesk pivots to AI-researched WFH-spot finder; 12 approval tickets filed**

## Vision (one line)

White-label mobile-first software business, ALL altitudes: multi-tenant
SaaS, dedicated instances, full buyouts, + consulting (docs/business-models.md).
First product: **Baat**, Pan-South Asian dating app.

## Now building

**Native platform track:** `bamware-brewdesk` is the SwiftUI proving ground for
`bamware-ios`; `bamware-venue-engine` is the companion local Express API.
The Xcode development workspace substitutes the sibling shared-package checkout
so app and reusable modules can evolve together.

**BrewDesk product direction (decided 2026-08-19):** a WFH-spot finder, not a
café finder — cafés + parks/libraries/malls (`venueType`), 95–100% AI-researched
data via a scheduled agent pipeline (whitelisted public sources, never
Google/Yelp content), admin/community as optional layers later. Scoring
reweights to Bilal's ranking: laptop policy (incl. visible "laptops banned")
> seating > wifi > noise, outdoor as bonus; recency decay. Provenance labels
say "updated <date> · <source>" — never "verified" without a human. Community
features are post-approval only (Apple 1.2 UGC surface). Approval plan: submit
→ Resolution Center reply (pre-written) → appeal; evidence base in
`docs/app-review-field-notes.md`. Tickets: brewdesk#1–8 + venue-engine#1–4,
all boarded/fielded; brewdesk#1 is P0 (reviewer-in-California location bug
empties the map — found 2026-08-19, blocks submission).

**Baat track: 🔴 REJECTED 2026-08-04 — Guideline 4.3(b), spam / saturated
category.** Verbatim text: the 2026-08-04 log entry below.
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

- **2026-08-19 — Machine-portable harness.** Any Mac rebuilds the full dev
  setup from `gh auth login` + clone + `scripts/bootstrap.sh` (sibling repos,
  skill installs, Claude Code symlinks, opencode config from template). Every
  repo's `AGENTS.md` now leads with the bamware-ai system map and carries a
  `CLAUDE.md` import shim, so Claude Code auto-loads org context in any repo —
  parity with opencode. Principle codified: a laptop is a cache of this repo;
  nothing on a machine is authored locally (README "New machine").

| Date | What |
|---|---|
| 2026-08-19 | **BrewDesk pivot + approval sprint specced.** Product redefined as AI-researched WFH-spot finder (see Now building). 12 tickets filed and fielded on the board: brewdesk#1 out-of-coverage location fallback (P0 — reviewer in CA gets an empty map today, `CafeMapScreen`/`VenuesModel` query 2.5km around user), #2 provenance stamps ("updated <date> · source"), #3 dataset stat strip, #4 methodology screen, #5 laptop-policy chips incl. Banned + venueType, #6 Google Takeout saved-places import (on-device, Apple Maps has no export), #7 community v1 (P2, DO-NOT-BUILD pre-approval), #8 listing v2 (AI-transparency positioning); venue-engine#1 schema v2 (seating/venueType/outdoor/photos/source enum), #2 scoring v2 (reweight+decay), #3 Takeout seed import script, #4 agentic pipeline v0 (Supervised, needs source whitelist sign-off). Also: `docs/app-store-rejections.md` removed (asserted unverified "account flagged" as fact) → replaced by sourced `docs/app-review-field-notes.md`; Atly teardown updated with 2026-08-19 capture (price doubled to $69.99, still zero provenance). Bilal's Takeout export of ~top-30 saved cafés = pending input for engine#3. |
| 2026-08-19 | **BrewDesk 1.0 (2) is VALID and IN_BETA_TESTING for internal TestFlight.** The release at binary commit `bamware-brewdesk@7bb2109` adds local Saved cafés, Directions/Share actions, English/Spanish localization, iOS 26 Liquid Glass with an iOS 17 material fallback, accessibility-size layouts, VoiceOver state, Reduce Motion behavior, typed venue queries, constructor-injected capability protocols, and removes the Factory dependency. Package tests, all 16 Release app/UI tests, accessibility audits, live production screenshot flow, iPad Pro compatibility smoke, development-workspace Release build, identity/security checks, opaque 1320×2868 screenshots, and unsigned archive pass. Xcode cloud-managed distribution signing uploaded build 2; Apple reports `VALID` and internal testing active. Remaining gate for this exact build: physical iPhone install and permission/accessibility smoke. Source/docs are pushed through `bamware-brewdesk@42f3b1c`; no backend contract changed. |
| 2026-08-19 | **BrewDesk 1.0 (1) uploaded to TestFlight and Apple processing is VALID.** App Store Connect record exists for `io.bamware.brewdesk`; evidence-first metadata, review notes, 4.3 preflight, five opaque 1320×2868 screenshots, deterministic Release screenshot automation, and the native fastlane CI rail are committed at `bamware-brewdesk@cbbc25f`. The first build used Xcode's App Store Connect API-key authentication and cloud-managed distribution signing because Baat's EAS certificate had no exportable private key on this Mac; no credential values or app changes were committed. The protected GitHub `production` environment remains restricted to `main` but cannot run until it receives an exportable distribution `.p12`. Package tests, full Release app/UI tests, iPad Air iPhone-compatibility smoke, development-workspace Release build, identity check, and unsigned device archive pass. Build 1 was subsequently installed and working on a physical iPhone. Remaining App Store gates: physical location states, production logging confirmation, questionnaires, and submission. |
| 2026-08-18 | **BrewDesk identity and Swift concurrency checkpoint verified.** Canonical app/project/scheme/module identity is `BrewDesk`, package `BrewDeskKit`, bundle `io.bamware.brewdesk`, repo `bamware-brewdesk`. Dead auth/StoreKit code removed; app uses structured cancellable loading, async Core Location, strict Swift 6 approachable concurrency, export-compliance flag, and a UserDefaults privacy manifest. Package tests, app tests, UI launch, sibling-package workspace build, Release build, and unsigned device archive pass. Archive contains no legacy identity, StoreKit linkage, or dev-auth URL. |
| 2026-08-04 (recorded 08-15) | 🔴 **Baat v1.0 (6) REJECTED — Guideline 4.3(b) spam.** Submission `029740e2-f219-407d-b065-996ada511f12`, reviewed on iPad Air 11-inch (M3). "There are already enough of these apps on the App Store… reconsider the app concept and submit a new app." Concept rejection — unfixable in the binary, unappealable on feature merits; Apple pointed at a PWA. 4.3(b) pre-flight gate added to `skills/store-submission`. **BrewDesk flagged as exposed** — cafe finder with the speed test cut from v1, i.e. the differentiator is not in the binary. |
| 2026-08-05 | **BrewDesk v1 decisions locked:** guest discovery, free launch, optional accounts only with cloud saves plus in-app deletion, conversation prototype deferred, iPhone-only. Prototype preserved at tag `conversation-prototype-v0.1.0`; production plan lives in `docs/brewdesk-go-live.md`. |
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
