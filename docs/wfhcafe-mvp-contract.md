# Brewdesk (was wfhCafe) MVP — shared contract & session state

**Updated:** 2026-08-05 (Claude backend + OpenCode client sessions) · **Read this first, both agents.**

> 🔴 **GO-LIVE BLOCKERS LIVE IN [`brewdesk-go-live.md`](brewdesk-go-live.md)** — backend/infra
> audit against running prod, 2026-08-05 evening. Read it before planning submission work.
> Headline: speed-test observations **do not persist in prod** (verified in Vercel logs), the
> app ships against the **dev** auth Lambda, and it links **Baat's dating terms** as its EULA.
>
> ⚠️ **Two sections of THIS file now contradict each other** on accounts. "STORE-CLEARANCE
> VERIFICATION" (cloud session, 00:31 UTC) says the login screen must go and the privacy label
> is "Data Not Collected"; the "P0 verification" section and the privacy-label table say
> accounts + StoreKit ship, which makes that label false. The cloud session did not have the
> acquisition-shell decision in context. **Resolution depends on Bilal's accounts call** —
> see "Fastest path to submission" in the go-live doc. Do not act on either until it is settled.
>
> File name kept as-is despite the rename so both agents' in-flight paths keep working.

## Division of labor
- **Claude (this session):** venue-engine backend, deployment, data, App Store readiness docs. Reads mobile code, never writes it.
- **Sol 5.6 (opencode):** SwiftUI client in `~/code/bamware-cafe` (app shell + `Packages/BamwareCafeKit`). Reads backend code, never writes it.
- **Bilal:** orchestrator; owns git pushes, Vercel account, App Store Connect.
- Contract changes land in THIS file before either side codes against them.

## Backend status
- Engine repo (`bamware-venue-engine`): Express + Zod + in-memory store over seed JSON. 2,180 real NYC cafes (OSM) + ~30 curated work-cafes. 11/11 tests green.
- **Deploy-ready for Vercel**: `api/index.ts` serverless entry, `vercel.json`, gzipped seed (100KB) with read-only-FS guard. Zip delivered to Bilal 2026-08-05; awaiting `vercel --prod` (see below).
- **PROD_URL: https://venuekit-ashen.vercel.app** ✅ LIVE (verified 2026-08-05: health=2180 venues, geo query, POST observation, neighborhoods all green). Sol: swap `VenueAPI.baseURL` to this now; localhost stays fine for local dev.

## API contract (v1 — stable, do not drift)
Base: `{PROD_URL|http://localhost:3000}`
- `GET /v1/health` → `{ ok, venueCount, seededAt }`
- `GET /v1/venues?lat&lng&radius_m&wifi_min(slow|ok|fast)&outlets_min(scarce|some|plenty)&laptops=friendly&neighborhood&q&sort(work_score|distance)&limit` → `{ count, venues[] }`
- `GET /v1/venues/:id` → `{ venue, observations[] }`
- `POST /v1/observations` `{ venueId, kind:"speed_test", mbpsDown }` → `201 { venue }` (updates wifi claim → source=speed_test, conf 0.9, rescores)
- `GET /v1/neighborhoods` → `{ neighborhoods: [{ name, borough, count }] }`

JSON: camelCase except `distance_m` (only on geo queries). Attribute = claim: `{ value, detail?, mbpsRange?, timeWindow?, source, confidence, observedAt }`. Sources: curated | osm | estimate | speed_test | user_report | field_visit. Swift models in `Packages/BamwareCafeKit/Sources/VenueKit/` match 1:1 — regenerate nothing, they're current.
- Serverless note: observations apply in-memory per instance; durable persistence arrives with the DynamoDB store (post-MVP). Client should treat POST response as truth for the session.

## ACTION ITEMS
**Sol:**
1. **Client direction (Bilal decision, 2026-08-05): build the full acquisition shell now.** The current prototype is onboarding → StoreKit paywall → separate `bamware-cafe` tenant auth → location → discovery. This supersedes the earlier free/no-login assumption for development; App Review gating remains a release decision because 5.1.1 may require useful guest access.
2. Release builds use `https://venuekit-ashen.vercel.app`; Debug builds retain `http://localhost:3000` for local integration. User-facing errors no longer mention localhost.
3. App Review polish still needed: real app icon (Apple rejects template icons — Baat lesson), OSM attribution line ("© OpenStreetMap contributors") in About/Settings, and final guest/account policy.

## P0 verification — read by Claude from `bamware-cafe` @ e3c86ec (2026-08-05 evening)
Backend session verified these by reading Sol's tree. **No Swift was modified.**

| P0 | Status | Evidence |
|---|---|---|
| Login screen removed | ❌ **Not done — and correctly so** | `BamwareCafe/Flow/AuthenticationView.swift` present; flow is Onboarding → Paywall → Auth → Location → Discovery. Superseded by Bilal's 2026-08-05 acquisition-shell decision (ACTION ITEMS #1). Not a Sol miss. **Still needs a final 5.1.1 call before submission.** |
| `VenueAPI.baseURL` → prod | ✅ **Done** | `Packages/BamwareCafeKit/Sources/VenueKit/VenueAPI.swift:53-59` — `#if DEBUG` localhost:3000 `#else` `https://venuekit-ashen.vercel.app`. Release builds hit prod. Compile-time, no runtime toggle to misconfigure. |

**⚠️ New finding — speed-test flywheel is OFF in Debug builds.**
`VenueAPI.supportsSpeedTest` (VenueAPI.swift:69-71) requires `https` and a non-localhost
host, `submitSpeedTest` throws `.unsupportedSpeedTest` (:133), and `VenueDetailScreen`
disables the button (:65). So a plain Debug simulator build against localhost has the
flywheel **disabled** — it only lights up in Release, or in Debug pointed at PROD_URL.
This matters twice: (1) the flywheel is our 4.3(b) differentiation, so **screenshots must
be captured from a build where it is enabled**; (2) any "verified working in simulator"
claim should name which configuration it was verified in. Sol's call how to handle
(a Debug-only allowance for the prod host would do it) — flagged, not fixed.

## Client status (verified 2026-08-05)
- SwiftUI acquisition flow, local monthly/annual StoreKit catalog, Keychain token storage, startup JWT validation/refresh, and separate `bamware-cafe` tenant configuration are implemented in `bamware-cafe`.
- Map-first discovery uses live Venue Engine data with Work Fit markers, search, laptop/Wi-Fi/outlet filters, location fallback, synchronized cards, and provenance details.
- Simulator boot verified against the local 2,180-venue engine. CafeKit tests, app unit tests, and UI smoke tests pass.
- Auth backend handoff: seed a `bamware-cafe` test user; confirm tenant provisioning policy. Current login/register/refresh/recovery routes are sufficient for email auth. Do not expose social sign-in or claim complete account deletion until `/auth/social` and `DELETE /auth/account` exist on current auth-service main.
- Conversation prototype added to the authenticated client: participant metadata supports humans and agents, the thread has optimistic send/failure states, and `ConversationTransport` is the backend seam. Current replies are local through `DemoAgentTransport`. Backend transport, persistence, streaming, and payload shape remain intentionally undecided; record that contract here before implementation.

**Bilal — open decisions (the deploy bootstrap below is DONE, kept for history):**
1. **Guest browsing vs hard signup wall (5.1.1).** Blocks submission. See the 5.1.1 read below. Claude recommends guest browse + gate the speed test.
2. **App Store Connect app record** for wfhCafe — bundle id, name, SKU, 4+ age rating. Agents can't create it; everything downstream (metadata push, screenshots, build upload) waits on it.
3. **Privacy nutrition labels** — ASC UI only, human-gated. Recommended answers are tabulated below; the old "Data Not Collected" plan is dead once accounts ship.
4. Unrelated but now urgent: **web#10 (admin JWT hardening) is merged to bamware-web main** — `JWT_SECRET` must exist in Vercel env or the admin portal breaks in prod.

<details><summary>Done 2026-08-05 — venue engine bootstrap</summary>

```bash
# repo created, pushed, linked to Vercel project "venuekit"; push to main = auto-deploy
# live: https://venuekit-ashen.vercel.app
```
</details>

## App Store readiness (wfhCafe v1) — owner in brackets
- [x] **PROD_URL live + app pointed at it** [Claude+Sol] — engine re-verified green 2026-08-05 evening (health 2180, geo, neighborhoods); Release build targets it.
- [x] **Privacy policy URL** [Claude] — **https://bamware.io/brewdesk/privacy** (bamware-web `f108cd4`). ⚠️ `bamware.io/privacy` is Baat-specific (dating profiles, matches, 18+) — **do NOT submit Brewdesk against it.**
- [x] **Support URL** [Claude] — **https://bamware.io/brewdesk/support** (bamware.io/support was a 404). Carries FAQ + OSM/ODbL attribution.
- [x] **Terms of Use / EULA** [Claude] — **https://bamware.io/brewdesk/terms** (new). Carries the 3.1.2 auto-renewing-subscription disclosures. `bamware.io/terms` is Baat's dating terms — **do NOT submit against it.**
- [ ] **Sol: repoint `AppConfiguration.swift:18-19`** — `termsURL`/`privacyURL` still point at Baat's dating documents. Also `appName` is still `"Work Cafe"` (→ Brewdesk). `/wfhcafe/*` 308-redirects to `/brewdesk/*`, so old links resolve, but ship the canonical URLs.
- [ ] **Guest/account gating decision vs 5.1.1** [Bilal] — the one open blocker with real rejection risk. See "5.1.1 read" below.
- [~] **Real icon (4.3/2.3)** [Claude ✅ produced → **Sol to install**] — asset + install steps in `assets/wfhcafe-icon/` (INSTALL.md). Cup-with-wifi-steam mark, studio graphite/signal-lime, all 3 iOS 18 appearances, marketing icon alpha-free. The appiconset in `bamware-cafe` currently declares **no filenames at all** — there is no icon today.
- [ ] **OSM attribution in-app (ODbL)** [Sol] — "© OpenStreetMap contributors" in About/Settings. Web pages already carry it; the app still needs its own.
- [ ] **Privacy nutrition labels** [Bilal, ASC UI] — **"Data Not Collected" is no longer truthful** once accounts ship. See recommended answers below.
- [ ] **Empty/error states** [Sol] — no dead screens if the API hiccups (2.1); prod copy, no "localhost" wording.
- [ ] **Screenshots 6.9" + 6.5"** [Claude] — needs a build with the flywheel enabled (see P0 finding). Reuse Baat automation: capture native on Pro Max sim, resize to 1284×2778.
- Positioning vs 4.3(b): "measured wifi speeds + provenance for NYC work sessions" — name the differentiation in App Review notes.

### 5.1.1 read (Claude's recommendation, Bilal decides)
Guideline 5.1.1(v): an app may not require an account for features that don't depend on
one. wfhCafe's core — browsing a public cafe directory — demonstrably does not. A hard
signup+paywall wall in front of a public directory is the single most likely rejection.
**Recommendation: let guests browse, search, and view cafes; gate the speed-test
contribution and any saved/favourites behind account+subscription.** That keeps the
acquisition funnel (the paywall still sits on the valuable action), removes the 5.1.1
exposure, and gives App Review something useful to see without credentials. If Bilal
prefers to keep the hard wall, we must ship a review demo account in the notes and
should expect a 5.1.1 round-trip. Either way this is a release decision, not a rebuild —
the shell Sol built stays.

### Privacy nutrition labels — recommended answers (from what the code actually does)
| Data type | Collected? | Linked to user? | Tracking? | Purpose |
|---|---|---|---|---|
| Contact Info → Email | Yes (if accounts ship) | Linked | No | App Functionality |
| Identifiers → User ID | Yes (if accounts ship) | Linked | No | App Functionality |
| Location → Precise | Yes | **Not linked** | No | App Functionality (sent per-request to rank nearby venues; not stored, no history) |
| Purchases | Apple-processed; we hold only active/inactive | Linked | No | App Functionality |
| Usage/Diagnostics | No — no analytics or crash SDK in the cafe app today | — | — | — |
Speed observations carry no account/device id (`POST /v1/observations` = `{venueId, kind, mbpsDown}`), so they are not declarable user data. If Sentry or any analytics SDK is added, this table changes — update it here first.

## Rate-limit protocol (both agents)
- State lives HERE, not in chat context. Check in on session start; write deltas, not essays.
- Big batched turns; artifacts over narration; never re-read what's unchanged.
- Claude context is the expensive resource for backend bytes — data moves via file transfer/git, never through chat.

## NAMING DECISION (final, 2026-08-05)
**App name: "Brewdesk — WFH Cafés"** (App Store name field, 20 chars).
- Clearance: no active app/company found; only a defunct eHeuristics brewery-automation tool (dead brand, different niche). USPTO spot-check before paid brand assets.
- Sol: change display name (CFBundleDisplayName / PRODUCT_NAME as needed) from "wfhCafe" → "Brewdesk". Bundle ID stays.
- ASO: keep "nyc, new york, coffee shop, wifi, laptop" in the hidden App Store keyword field + NYC prominent in description, since it left the name/subtitle.
- Bilal: register brewdesk.app + brewdesk.com + IG/TikTok handles tonight.

## STORE-CLEARANCE VERIFICATION (2026-08-05, Claude)
- Name "Brewdesk": NO app on App Store or Google Play; NO USPTO filing surfaced (Justia index); only defunct eHeuristics brewery tool historically. Bilal: 10-min official TESS check before paid brand assets.
- Apple residual risks = open to-dos only: (1) login screen MUST go (5.1.1, top risk), (2) real icon, (3) privacy URL + accurate screenshots + "Data Not Collected" label — NO analytics/crash SDKs without updating the label.
- Google: 12-testers/14-days closed-testing rule CONFIRMED current for personal accounts created after Nov 2023 — Bilal: check Play account age; if affected, iOS-first + start Android closed test clock in parallel. Privacy policy URL mandatory; Data Safety form = "no data collected".
