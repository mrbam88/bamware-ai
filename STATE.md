# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-08-28 — **Shelf animation rebuilt + TF build up; Flutter/Android BrewDesk MVP booted and
> published; SwiftUI submission lane remains #69 → #33 (Bilal Submit)**

## Vision (one line)

White-label mobile-first software business, ALL altitudes: multi-tenant
SaaS, dedicated instances, full buyouts, + consulting (docs/business-models.md).
First product: **Baat**, Pan-South Asian dating app.

## Now building

**Native platform track:** `bamware-brewdesk` is the SwiftUI proving ground for
`bamware-ios`; `bamware-venue-engine` is the companion local Express API.
The Xcode development workspace substitutes the sibling shared-package checkout
so app and reusable modules can evolve together.

**Flutter/Android track (decided + booted 2026-08-24):** private
`mrbam88/bamware-brewdesk-flutter` is the Android-first BrewDesk client, not a
shared-code rewrite. MVP at `623bda5`: Spots map/shelf, location with Manhattan
fallback, search/filters, claim-level provenance, photos, directions, local
accountless saves, Material 3 light/dark, production Venue Engine. Pixel 10
boot/detail/save flow passed; analyzer + 3 tests + debug APK + gitleaks green.
Epic flutter#1; Agent-ready #2–4; Human-only Play bootstrap/signing #5. Fan-out
held because private-repo Actions billing still prevents CI jobs from starting.

**BrewDesk product direction (decided 2026-08-19):** a WFH-spot finder, not a
café finder — cafés + parks/libraries/malls (`venueType`), 95–100% AI-researched
data via a scheduled agent pipeline. Source policy (Bilal, 2026-08-20,
supersedes the earlier same-day ruling): ANY publicly available internet
source may be used for workability/ranking data — Google, Yelp, forums,
blogs, review sites, all of it; scraping is allowed. Bilal owns and accepts
the ToS/legal exposure. Licensed APIs still used where they fit (e.g. Google
Places Photos for venue images, place_id server-side, display-only with
attribution).
Admin/community as optional layers later. Scoring
reweights to Bilal's ranking: laptop policy (incl. visible "laptops banned")
> seating > wifi > noise, outdoor as bonus; recency decay. Provenance labels
say "updated <date> · <source>" — never "verified" without a human. Community
features are post-approval only (Apple 1.2 UGC surface). Approval plan: submit
→ Resolution Center reply (pre-written) → appeal; evidence base in
`docs/app-review-field-notes.md`. Tickets: brewdesk#1–8 + venue-engine#1–4,
all boarded/fielded; brewdesk#1 is P0 (reviewer-in-California location bug
empties the map — found 2026-08-19, blocks submission).
**Approval lane status (2026-08-21):** brewdesk#26 → PR #35, #27 → PR #38,
#29 → PR #39 (privacy-claim verifier: request audit + Release manifest tests;
go-live item 1 closed — Vercel Runtime Logs keep Search Params 1 h on Hobby;
anchor-when-denied kept by decision; follow-up venue-engine#16 moves viewport
coords out of the query string; venue-engine#19 Human-only parks the Vercel
evidence paste + six observability holes for triage). **All three merged 2026-08-21 (~04:00Z); board #26/#27 QA Passed, #29 Ready for QA.** Next pick: brewdesk#34 (stat strip never rendered — bugs first) → PR #40, Ready for QA 2026-08-21; flags: `ProvenanceStamp` renders `seededAt` a day early (Aug 3 UTC → "Aug 2"), map strip legible only off-pin — both #30 screenshot concerns. **brewdesk#28 cold-start → PR #43 Ready for QA (2026-08-21):** bundled 50-venue snapshot (`BrewDesk/Resources/VenueSnapshot.json`, refresh via `scripts/refresh-venue-snapshot.sh`) paints first; `-UITestSeedSnapshot` + `offlineThenRecovers` scenario; auto-retry on reconnect needs a device airplane-mode check (QA). Remaining Agent-ready: #30, #36, #37; venue-engine#16.
#28/#30 unblock when #35/#38 merge.

**Baat track: 🔴 REJECTED 2026-08-04 — Guideline 4.3(b), spam / saturated
category.** Verbatim text: the 2026-08-04 log entry below.
Concept rejection, not a bug — Apple's instruction was "submit a new app," so
**the native iOS track for Baat is closed** (PWA is the only surviving path). Do
not resubmit, re-skin, or appeal on feature merits. Backend, auth, infra, and
the EAS→TestFlight→fastlane rail are unaffected and are the reusable assets.
Still open regardless: the 2026-07-23 fan-out PRs are **no longer open** (0
open PRs across all repos, verified 2026-08-19 — merged or closed; history in
each repo); JWT_SECRET needed in Vercel
before web#10; ENVIRONMENT=prod needed on prod dating Lambda. Play Console
bootstrap is moot for now (Google has no 4.3 equivalent, but Baat's iOS
concept problem is not an Android fix).

**Two-app goal (stated 2026-08-15):** ship one SwiftUI app (BrewDesk) and one RN
app, for Bamware branding + interview evidence. The RN app is now selected for
4.3 survivability first: no UGC, no accounts, no IAP in v1, category with no
incumbents. Reuse the Baat **rail**, not the Baat app.

**Open-source track (decided 2026-08-20):** Baat becomes `mrbam88/baat-rn`,
public, MIT — a portfolio showcase for interviews, NOT a relaunch (native
iOS track stays closed under 4.3(b)). Fresh-history repo, never a visibility
flip of `bamware-dating-app` (revoked Apple creds remain in its history).
Backend + white-label engine stay private. Epic bamware-ai#9; tickets #4
(secrets audit, **P0 Human-only — gates everything**), #5 export, #6 hygiene
pack, #7 README-as-architecture-article, #8 profile visibility sweep (19
public → 5: bamware-ai, bamware-ios, DSA-Practice, baat-rn, bamware-brewdesk).
**BrewDesk too (#10 flip + #11 README):** visibility flip of `bamware-brewdesk`
once the audit confirms clean history; `4.3-preflight.md` + review notes move
out first; `bamware-venue-engine` stays private (data + scoring = the product).
Recommended flip date: App Store submission day, after brewdesk#1. All boarded.

## Shipped ✅

- **2026-08-19 — Dev-QA loop (process).** Board 2 statuses now Todo → In
  Progress → Ready for QA → QA Passed → Done. New skills:
  `definition-of-ready` (grooming gate — readiness is checked in daylight,
  never at 3am) and `qa-engineer` (verify PRs with evidence, file `bug`
  tickets back to DEV). `standing-engineer` rewritten: finish-and-flag —
  only three abort reasons (credentials, brewdesk#7, would-touch-main);
  bug tickets on own PRs are pulled first; claims require quoted evidence
  (`scripts/check-ci-gate.py` for CI claims). Terminology: tickets, never
  cards. Nightly cloud QA scheduled for backend repos. Merging stays with
  Bilal. Incident recorded in docs/incidents.md (false "no CI" claim
  reached the digest).

- **2026-08-19 — Machine-portable harness.** Any Mac rebuilds the full dev
  setup from `gh auth login` + clone + `scripts/bootstrap.sh` (sibling repos,
  skill installs, Claude Code symlinks, opencode config from template). Every
  repo's `AGENTS.md` now leads with the bamware-ai system map and carries a
  `CLAUDE.md` import shim, so Claude Code auto-loads org context in any repo —
  parity with opencode. Principle codified: a laptop is a cache of this repo;
  nothing on a machine is authored locally (README "New machine").

| Date | What |
|---|---|
| 2026-08-21 | **bd#37 shipped → PR #42 (Ready for QA):** live-data UI tests are rank-independent — new `BrewDeskUITests/UITestHelpers.swift` (`mapPins`/`venueRows`/`firstVenueRow`, match element shape not venue name); `testSaveCafeFromDetails` opens the top-ranked row and carries its name; two venue-detail a11y tests navigate the same way; screenshot rig swaps its two rank-dependent asserts only (composition left for #30). Release on iPhone 17 Pro Max against production: all BrewDeskUITests green except `testVenueDetailAccessibilityAudit`, which now navigates and fails on audit content (hero link hit-area/contrast = bd#36). Found: a cross-test interaction (an earlier save flips "Save"→"Saved" on the top venue) — fixed with `-brewdesk.saved-venue-ids ""`. Overnight supervisor session QA-merges under the Actions-billing waiver; #30 handed to it. |
| 2026-08-20 (late) | **Approval lane opened — brewdesk#27 empty/error-state audit → PR #38, Ready for QA.** Every screen (Map/List/Detail/Saved/Import/Methodology) now has an intentional state under engine 500, empty, offline, photo failures, slow, location denied; 18 fixture-driven `DegradedStateTests` green in Release on iPhone + iPad. The ticket's premise "stub listing injectable already" was false — `RootView` ignored injection under DEBUG — so a launch-arg seam was added: `-UITestScenario <fixtureOK|engineDown|offline|emptyVenues|photosEmpty|photosFail|slow>` + `-UITestLocationDenied` (`ScenarioVenueService` in VenueKit). **#26 and #28 should build on it.** Also: `VenueAPI` 15 s request timeout (was 60), Import no longer blames the file for an engine failure, Saved surfaces partial hydration failures. Full Release suite found 3 pre-existing failures, filed: brewdesk#36 (methodology link fails a11y audit: hit area + contrast) and #37 (live-data tests hardcode "Gregorys Coffee", now rank 12 after the day's rescoring → `testSaveCafeFromDetails` + screenshot rig fail; overlaps #30). Board hygiene: brewdesk#1–6, #8 were already merged (PR #17/#23/#24) but sat in Ready for QA → moved to Done. **Tooling:** 32 third-party skills installed with the `skills` CLI are now committed here (`.agents/skills/` real copies, `skills/`+`.claude/skills/` symlinks, `skills-lock.json`); `check-context.py` skips symlinked entries (see skills/INDEX.md "Third-party"). |
| 2026-08-20 | **Approval lane: reviewer simulation shipped (brewdesk#26 → PR #35, Ready for QA).** One scripted Release XCUITest replays App Review's first 10 minutes (fresh install → decline location → browse/filter/search → detail → methodology → grant location simulated at Cupertino → relaunch), asserts visible content per step, attaches 12 screenshots; passes on iPhone 17 Pro Max (69.5s) + iPad Pro 13-inch (M5) (78.0s). New `reviewer-sim.yml` uploads both xcresults + flat PNGs as `reviewer-simulation-evidence` on PR/main/manual (macOS minutes ×10 on a private repo — trim to main+manual if quota bites). **Defect found by the run → brewdesk#34:** the dataset stat strip never renders (`.task { loadHealth() }` on an empty `Group`; `/v1/health` is fine; PR #12 was verified by package tests + build only) — P1/S/Agent-ready. Offline step pending on #27's `-UITestScenario offline` seam (interface pinned in #27's body). First parallel-session run: two Claude Code sessions on #26/#27 with an explicit file fence negotiated via SendMessage — learnings in skills/agent-fanout. |
| 2026-08-20 | **AI data day — photos live, evidence rail built, economics disciplined.** Google Places photo rail shipped end-to-end (place-id backfill 2,174/2,180, proxy `/photos`, app gallery with tap-to-expand attribution). Photo classifier (workspace/food/other; measured: ~50% of Google café photos are food) filters galleries tables-first; labels keyed `placeId#index` after discovering photo NAMES rotate per session (~\$10 of labels lost to that bug, owned + fixed). Venue-level vision analysis (`analyze-venues.ts` + `photo-evidence.ts`) turns photos into conservative scoring evidence — seating/laptops/outdoor claims (`source: agent`, capped confidence, human data never overwritten) + retail-counter flags for review; smoke-proven (Gregorys → seating: scarce). Cost overrun forced discipline: **spend rule (quote-and-confirm before any paid run) + `docs/ai-data-pipeline-plan.md` with decided \$10/mo cap, Haiku relabel (~4.3k/10k done), post-approval evidence gate (50-venue sample must move rankings)**. Business-info ticket (ve#15, OSM-first — Google Enterprise fields would blow the budget) + community epic (bd#25, supersedes bd#7; reuses Baat upload/auth rails). **Approval lane groomed: brewdesk#26–33** (reviewer simulation, empty-state audit, cold-start, privacy-claim verifier, screenshots sans Google photos, metadata finals, rejection response pack, submission runbook → 1.0(3) → Submit). Goal restated by Bilal: Apple approval, nothing else. |
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

## In flight 🔨

**BrewDesk approval lane (#26–33)** — #26 (PR #35), #27 (PR #38), #29 (PR #39) all
**merged 2026-08-21**; #34 → PR #40 **merged**; #28 cold-start → **PR #43 Ready for QA** (2026-08-21). #30
Todo + Agent-ready (use the `-UITestScenario` seam from #27; #30 after #34/#36 land so
screenshots show the fixed UI); #31 Human-only; #32/#33 Supervised, #33 last. Follow-ups
#36 (a11y) + #37 (test drift) Todo/Agent-ready. venue-engine#16 (coords out of query
string) Agent-ready; #19 Human-only (Vercel evidence + holes triage).

**BrewDesk transparency set (#1–8)** — all merged; board moved to Done 2026-08-20:

- brewdesk#1 out-of-coverage location fallback — **P0, blocks submission.** A
  reviewer in California gets an empty map; `CafeMapScreen`/`VenuesModel` query
  2.5km around the user.
- brewdesk#2 provenance stamps · #3 dataset stat strip · #4 methodology screen ·
  #5 laptop-policy chips incl. Banned + venueType — together these are the
  4.3(b) differentiator, visible in the binary
- brewdesk#6 Google Takeout saved-places import (on-device; Apple Maps has no export)
- brewdesk#7 community v1 — **P2, DO-NOT-BUILD pre-approval** (Apple 1.2 UGC surface)
- brewdesk#8 listing v2 (AI-transparency positioning)
- venue-engine#1 schema v2 · #2 scoring v2 · #3 Takeout seed import —
  **merged 2026-08-19 (PRs #5/#6/#7).** brewdesk PR-level CI also merged
  (brewdesk PR #9), so brewdesk tickets now pass the readiness gate.
- Venue images (decided 2026-08-20): Google Places Photos via a
  venue-engine proxy — place_id backfill, photos display-only with
  attribution, API key server-side. Ticket to be filed.
- venue-engine#4 agentic pipeline v0 — **unblocked 2026-08-20**: source
  policy signed off, anything publicly available is fair game. Ready to
  spec/build.

**Baat (bamware-dating-app) — frozen since 2026-08-04.** The native iOS concept
is closed under 4.3(b). Listed because the code and the rail are reusable
assets, not because this work is queued.

- the 2026-07-23 fan-out PRs are closed (0 open PRs verified 2026-08-19)
- [#3](https://github.com/mrbam88/bamware-dating-app/issues/3) onboarding cultural
  steps — merged, but the server strips the new fields; schema follow-up open
- [#6](https://github.com/mrbam88/bamware-dating-app/issues/6) contract-layer ADR
  (client-core fate) — needs Bilal's decision
- ~~#2 badges~~ ✅ · ~~#4 icebreaker~~ ✅ · ~~#5 settings~~ ✅ ·
  ~~service#1 match scoring~~ ✅ · ~~service#2 discovery prefs~~ ✅ merged+deployed

## Blocked on Bilal 🔴

**BrewDesk — these gate submission:**

- Physical-iPhone smoke of build 1.0 (2): permissions + accessibility. Build 1
  was installed and working; build 2 has not been on a device.
- Google Takeout export of the ~top-30 saved cafés → input for venue-engine#3
- An exportable distribution `.p12` → unblocks the protected `production` GitHub
  environment. Both TestFlight builds used Xcode cloud-managed signing because
  Baat's EAS cert has no exportable private key on this Mac.
- Remaining App Store gates: physical location states, production logging
  confirmation, questionnaires, submission

**Infra / credentials — not blocking BrewDesk:**

- 🔴 **A plaintext password was committed to this public repo** and sat in this
  section until 2026-08-19. Treat it as compromised: rotate it and anything that
  reused it. Removing the line does not purge git history.
- Rotate `MAESTRO_*` GH secrets and `ADMIN_SECRET` (the latter was pasted into a
  chat transcript)
- `JWT_SECRET` in Vercel (before web#10) · `ENVIRONMENT=prod` on the prod dating Lambda
- Auth token refresh — Baat sessions die after ~30 min
- **baat-rn gate (#4):** verify Apple revocation at ASC, rotate `ADMIN_SECRET` +
  `MAESTRO_*` — nothing goes public before this
- Paste the bamware Claude Project instructions block (see docs/incidents.md
  2026-08-20) — forces `bamware-context` on every Cowork session
- Google Cloud service account → Play Console API access. Parked: Google has no
  4.3 equivalent, but Android is not a fix for a concept rejection.

## Next up 🗺️

- Land brewdesk#1, then the transparency set (#2–#5) — that is what makes the
  differentiator visible in the binary, which is what the 4.3(b) preflight demands
- venue-engine: schema v2 → scoring v2 → Takeout seed → agentic pipeline v0
- Pick the RN app concept for the two-app goal: no UGC, no accounts, no IAP in
  v1, category with no incumbents
- Boot + Maestro smoke gate in CI → unlocks overnight agent runs

## Known debt 🧾

- client-core orphaned by both consumers (→ dating-app#6)
- Apple creds in git history — revoked; purge optional. See also the plaintext
  password under Blocked.
- `bamware-workspace` submodule pins stale (May-era)
- SDK-56/54 package drift fixed by pinning — run `npx expo install --fix` check on SDK upgrades
- Baat jest teardown leak (worker force-exit warning)

## 2026-08-21 (day) — backlog cleared, vault shipped
22 coding tickets merged across 5 repos in one day fleet (community epic:
capture UX, tenant uploads, AI vet queue ticket, observations backend+form,
compliance pack #48, bylines; data epic: OSM business info live in prod
incl. email + locale hours; map perf/clustering #54+#61; UI review #55 →
paint layer #62; drift check, research-pipeline skeleton, client-core
retired, OSS hygiene+READMEs, secrets audit). TestFlight 1.0(5) and 1.0(6)
uploaded FREE via the local Xcode cloud-signing rail (skill updated).
One-key vault live: SSM Parameter Store holds all secrets (docs/secrets.md),
bamware-deployer profile on this Mac, infra PR #6 open for prod tf.
Incidents: ~40min venue-engine outage (ESM require, hotfixed, deploy-path
rule added to qa-engineer skill); one semantic merge collision (#61×#57)
caught by post-merge certification. Bilal still owes: root-key deactivation,
ASC key regen, category/#32/#33 submission path. Spend: $0.

## 2026-08-21 (night 2) — community core complete, TF 1.0(7)
Night fleet (post-22:08 limit reset): store-surface gate #67 merged
(STORE_SURFACE_GATED=YES flips accounts/report/block/observation OFF for
store submissions — the accountless-v1 strategy is one build flag away);
reports endpoint + moderation queue ve#30+#21 merged and live (ADMIN_KEY
env needed in Vercel before moderation usable, fail-closed until then);
capture→upload wiring #71 merged (QA fixed the intake seam to ve#21 as
shipped); live block filter #66 closed. TF 1.0(7) uploaded via local rail.
Pre-submission risk tickets #68-70 parked per Bilal (submission-process
work waits). Spend: $0.

## 2026-08-22 (Sat PM) — Saturday feedback batch shipped, token policy enacted
All four of Bilal's Saturday feedback tickets merged to brewdesk main after
supervisor QA (premerged worktrees, iPhone 17 Pro, Release):
- bd#76 bottom card is a real draggable sheet (peek/medium/full detents,
  session memory, tab bar stays reachable) — PR #83.
- bd#77 all-filters-zero bug: client-side inclusive filtering (unknown
  attribute values are not evidence against a venue) — PR #82.
- bd#78 search-as-you-type: debounced local matching — PR #86 (replaced
  #85, which GitHub closed when its stacked base #82 was squash-merged;
  lesson: don't stack PRs when the base will squash-merge).
- bd#79 Wi-Fi question in Rate-this-visit, both halves: ve#33 merged +
  verified live in prod (wifiQuality → wifi claim, user_report/0.7);
  app PR #84 merged (17e audit contrast failure reproduced on unmodified
  main = pre-existing #60 noise, not a regression).
Token policy (12%-weekly-by-Saturday scare): subagents default Sonnet
(docs → Haiku), frontier only for QA verdicts/design judgment, no idle
polling, supervisors short-lived — codified in AGENTS.md. UI round 2
(bd#75) cron deleted; awaiting Bilal ("run it lean" = single Sonnet
agent). Fleet-worktree litter cleaned from both repos. Spend: $0.

## 2026-08-23 (overnight + Sunday) — Outside NYC shipped, theme shipped, night shift proven
Bilal's brief: churn the backlog overnight, efficiency over speed; then "the
app will not pass Apple approval without outside-NYC" — that epic (bd#107)
went from filed to live in one day.
- **Outside NYC (P0, closed):** ve#48 any-viewport serving — 50 US metros OSM
  baseline (26,309 venues, 1.6MB gz, lazy shards), Overpass live fallback,
  additive contract fields `tier`/`coverage` (ai PR #20, Bilal-approved);
  ve#49 baseline scoring band + provenance; ve#51 estimate-claims fix.
  Live: Cupertino → 30 real venues, `coverage: baseline`; NYC byte-identical.
  App PR #110: real-viewport queries (NYC fallback removed), honest banner,
  provenance "OSM baseline · updated <date>", Cupertino reviewer-sim
  assertion. QA found a real decode bug (engine sends `meta.coverage`, app
  read top-level) and a hanging unit test.
- **Warm Utilitarian theme (bd#98 → PR #109):** Bilal's board: #2D5A4C green /
  sand / sage / #FAF9F6, Hanken Grotesk + Manrope + JetBrains Mono bundled,
  4 button styles, tab tint; 50/50 UI tests light AND dark; capture test
  caught a real Swift 6 actor-isolation crash in iOS 26 async render.
- **Also merged:** bd#95 (UI round 2, closes #75), #96 (shelf flash root
  cause: nil<->value height animation), #99 (visit reminders, Phase A local
  push), #100 (search keyboard dismiss), #103 (LaunchEnvironment — 13
  ProcessInfo greps → 1, CONTEXT.md added), #105 (dark red text tokens),
  #91 (odds audit #90 + rejection pack #32); ve#37 root route, #38/#42
  research spikes, #45 seed matcher (8 ghost duplicates removed, 2172
  venues), ai#18 token-diet policy, ai#19 night-queue skill + `night`
  labels + script; web#13 lint, #14 favicon/OG (live on bamware.io).
- **TestFlight:** three builds uploaded via the free local rail (post-#95;
  post-batch-2; post-#110 with theme + outside-NYC). Build numbers are
  Xcode-managed now (8 was already taken — use manageAppVersionAndBuildNumber
  =true, recorded).
- **Filed:** push epic bd#92 (+#93 done, #94, ve#34, infra#7), bathroom codes
  bd#97 (post-approval), theme #98 (done), architecture C2 backlog, bd#104
  AccountFlow hang (pre-existing), ve#40/#41/#44/#50(done)/ve research
  follow-ups, web#11 BrewDesk-on-web epic, web#12 AI-usage dashboard,
  ai#16 (done)/#17 (done) — board has them all; per-ticket board FIELDS not
  set (Priority/Area/Size) — grooming debt.
- **Night-shift lessons (in skills/night-supervisor):** shared DerivedData
  deadlocks parallel xcodebuild (0% CPU "hangs"); duplicate-named booted
  sims wedge destination resolution — use UDIDs; macOS has no `timeout`;
  agents idling "waiting for background gates" cost supervisor nudges —
  foreground gates; one agent hit 297k tokens and was taken over (its work
  merged after supervisor QA found 2 real bugs).
- **Needs Bilal:** GitHub Actions billing (all CI down); bd#31 metadata
  finals; bd#70 one-line vercel.json choice; APNs key (infra#7); ve#19;
  physical-device check of the new TF build (incl. a Directions-tap visit
  reminder ~2h later). Spend: $0.

## 2026-08-23 (Sunday evening) — WFH-spots slice, serving fixed for real, parallel harnesses
- **WFH-spot positioning shipped pre-submission (Bilal's call):** ve#54 — NYC
  dataset 2,172 → 2,783 (416 parks, 112 libraries, 29 coworking, broader cafe
  tags; Housing Works finally matched, 127m, sim 1.00; caught seed.ts
  re-scoring baseline venues past the band). bd#113 — 21 copy keys "work
  cafés"→"work spots" en+es, a11y fix, screenshots re-shot (café-only frames:
  score-sorted top-50 is cafés by design; optional "library filter" frame is
  Bilal's call). Closes the ve#40 tag-broadening too.
- **Outside-NYC serving actually fixed (deploy-path lesson, again):** the 50
  metro shards never served in prod — first-hit anywhere = "none" in 0.1s,
  retries worked only via the flaky live-Overpass fallback, which also CACHED
  empty results (per-instance bbox poisoning). Fixes: vercel.json
  `includeFiles: data/**` (Bilal-approved, PR #53), /v1/health now reports
  `baseline:{metros,readableShards,failedParse}` (PR #55), empty pulls no
  longer cached, shard parse failures degrade instead of 500ing. Verified
  live: health 50/50/0; Portland first-hit = 50 baseline venues instantly.
  Lesson recorded: my own post-#48 "Cupertino works" live check was actually
  the fallback, not the shards — a green curl is not proof the intended path
  served it; check the diagnostic, not the symptom.
- **Parallel-harness workflow started:** Bilal runs Cursor on bamware-web
  with a supervisor-authored prompt (fenced, evidence-required, no
  self-merge). First PR (#15 member-pages retheme) QA-merged + live-checked
  (sign-up/reset/verify 200). web#13/#14 (lint, favicon/OG) also live.
- **TestFlight:** WFH-spots build uploaded (Xcode-managed number) — includes
  theme, outside-NYC, work-spots copy, all week's fixes.
- Still Bilal: Actions billing · bd#31 · APNs key · ve#19 · ve#41 notes ·
  device smoke. Then bd#69 dry-run → bd#33 → Submit. Spend: $0.

## 2026-08-23 (late) — merge queue cleared
web#16 (legal/admin retheme, Cursor) + web#17 (BrewDesk privacy: Google
Places attribution + work-spots wording) merged and live-verified;
brewdesk#114 merged → #70 CLOSED (reviewer notes cite /v1/health,
copyright.txt added). web#11 groomed by Cursor (5 child tickets 11a–11e:
CORS+shell → map/list → detail → saved → deploy gate) — comment on web#11,
awaiting Bilal approval to file issues.

## 2026-08-23 (session handoff) — parallel harness + grill decisions
**Workflow:** Bilal runs a **Cursor web harness** (bamware-web only; quoted
lint/tsc/build; no self-merge) in parallel with a **brewdesk submission lane**
in the main Cursor session. Merging either repo deploys live — Bilal
QA-merges only.

**Grill settled (2026-08-23):**
- Merge web privacy before ASC submit (Google attribution was the gate — now
  live via web#17).
- brewdesk#70 root-500 fork: **reviewer notes → `/v1/health`**, not
  `vercel.json` (deploy-config Bilal gate).
- brewdesk#31 category: accept memo — **Productivity primary / Food & Drink
  secondary**; Bilal types into ASC (Human-only).
- Submission candidate: **recut TF from current main**, then bd#69 reviewer
  sim, then bd#33 runbook; do not submit an older TF build.
- web#12 (AI usage dashboard): **hold** — needs secrets/ingest design;
  supervised session later.

**Harness note:** background web subagent died mid-run with
`WritableIterable is closed` (Cursor harness stream closed — **not** Claude
rate/spend limit). #4/#5 landed via PR #15/#16 anyway; #17 + brewdesk#114
merged in a later pass.

**Next session picks (ordered):**
1. **bd#69** — `ReviewerSimulationTests` Release on iPhone 17 Pro Max against
   latest TF build from main; archive evidence for bd#33.
2. **bd#31** — Bilal ASC: category, age rating, copyright (2026 Bamware),
   content-rights (OSM + Google Places photos).
3. **bd#33** — cut/upload build, device smoke matrix, deliver dry-run; Submit
   click is Bilal's.
4. **web#7** — `/work/baat` case study (only open web ticket from the batch;
   #4/#5 done; #11 groom-only done).
5. File web#11a–11e as issues after Bilal approves the grooming comment.

**Still Bilal / blocked:** GitHub Actions billing (CI down; local gates +
quoted evidence in PRs). APNs key (infra#7). ve#19 Vercel log paste.
Physical-device smoke + visit-reminder check. Spend: $0.

## 2026-08-28 — shelf detent animation rebuilt, TF build up
Bilal's report: bottom card flashes on expand/minimize and sits under the tab
bar at peek. Frame-by-frame sim captures found three causes: offset-based drag
slid the card beneath the tab bar; peek ended square-cut at the safe-area line
over raw map; the rail/list swap laid out as VStack siblings, pushing the
outgoing view out of the clip (the flash). Fix (bd#125 -> PR #127, merged under
the Actions-billing waiver): height-driven 1:1 resize drag with rubber-banding,
glass bleeds under the floating tab bar (design-spec mockup 01 look,
hit-testing off), concrete-height settles (#88's pin generalized), ZStack
crossfade. MapShelfDetentUITests 5/5 (incl. the stale-chips peek test, fixed),
unit suites green, Release boot vs production verified. **TestFlight build
uploaded from main 1112b8d via the free local rail (Xcode-managed build
number); Bilal: device-smoke the newest processing build.** Found + filed
bd#126: ReviewerSimulationTests drifted post-UI3 (asserts removed "100 work
spots" text) — gates bd#69, part of #121 stabilization. Test-infra lesson in
MapShelfDetentUITests: the grabber's a11y frame spans the whole card, so drags
must press the shelf's top 12pt or the full-detent list eats them. Spend: $0.

## 2026-08-24 (overnight) — UI round 3 shipped end-to-end
- Bilal's Claude Design spec (BrewDeskDesignSpecv1.pdf) implemented: tabs collapsed to Spots · Saved · You (bd#117/PR122 trunk), search rebuilt + anchored WorkFitFilterMenu with tier legend (bd#118/PR124), venue detail name-as-title + card-level provenance (bd#119/PR123). All merged to main (a84fed0). #117/#118/#119 closed.
- Visit reminders CUT from v1 (Bilal-approved): zero notification permission requests in the binary; scheduling code stays in the package, unwired.
- Accounts/SSO/Plus paywall split to deferred epic bd#120 — do not build until Bilal green-lights (pre- vs post-approval undecided).
- Testing mode changed BY BILAL's instruction: UI-first, no red-green loops; one stabilization pass + screenshot re-shoot (bd#121) after he approves the look on device. Known deferred: 2 UI tests referencing removed search-done/chip-rail elements; full matrix not run on the merged stack (compile gate + boot smokes only).
- TestFlight: TWO uploads — 23:59 build is STALE (pre-merge main; gh pr merge 122 failed silently first try), 00:01 build is the real UI3. Bilal: use the newest processing build.
- Landmine found: DebugEnvironmentStore defaults to .localhost on fresh containers → "ENV: Localhost" badge + dead data in debug builds. Live UI tests now pin -brewdesk.debug.environment production. Not changed in product (historical behavior); decide later.
- Sheet lesson: .presentationContentInteraction(.scrolls) makes swipe-dismiss unreliable → detail sheet has an explicit Close button (detail-close); tests dismiss via it.

## 2026-08-24 — Flutter/Android MVP booted
- Bilal chose Flutter for BrewDesk on Android. New private repo
  `mrbam88/bamware-brewdesk-flutter` published at `623bda5`; canonical design
  PDF is committed in-repo, app id `io.bamware.brewdesk`.
- Live vertical slice: Spots map + draggable shelf, privacy-safe POST search,
  filters, detail/provenance/photos/directions, Saved, You, location fallback.
  Strict MVVM/service/repository layers; OSM tiles avoid API-key spend.
- Evidence: production search decoded; `flutter analyze` clean; 3/3 tests;
  debug APK built; Pixel 10 permission-denied → 100 venues → detail → save →
  Saved passed; gitleaks no findings. Spend: $0.
- GitHub setup: PR-only Flutter CI + secrets tripwire, engineering-skill docs,
  default triage labels, epic #1 with fielded children #2–5. No fan-out launched:
  Actions billing means PR gates cannot start; do not trigger paid minutes
  without quote-and-confirm. Next: restore CI, fan out #2/#3/#4, then Human-only
  Play Console/signing/internal-test #5.
