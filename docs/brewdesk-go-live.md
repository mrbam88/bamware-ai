# BrewDesk go-live

**Updated:** 2026-09-17

## Locked v1

- App Store name: **BrewDesk — WFH Cafés**.
- On-device name: **BrewDesk**.
- Bundle identifier: `io.bamware.brewdesk`.
- Free, accountless, iPhone-only launch.
- Guests can browse maps/lists, search, filter, and inspect provenance.
- Guests can save cafés locally, open Directions, and use native Share.
- English and Spanish are supported.
- Accounts, cloud saves, StoreKit, speed submissions, and conversations are out.

## Verified client

- Project, target, scheme, executable, module, tests, and package use BrewDesk.
- `BrewDeskKit` contains feature UI; `VenueKit` remains UI-free and Sendable.
- The app composition root injects narrow listing/detail capabilities; there is
  no global dependency container or Factory package.
- Swift 6 approachable concurrency is target-scoped; UI state is main-actor
  isolated and venue loads are owned by cancellable `.task(id:)` work.
- Core Location uses the iOS 17 async update sequence.
- Release points to the production HTTPS Venue Engine.
- Dead auth/paywall/StoreKit code and development auth URL are absent.
- Legal links use `/brewdesk/privacy`, `/brewdesk/terms`, and
  `/brewdesk/support`.
- OSM attribution is visible in-app.
- Export compliance is set to exempt standard HTTPS.
- App privacy manifest declares UserDefaults reason `CA92.1` and no collection.
- Local Saved cafés persist IDs and rehydrate current details from the API.
- Dynamic Type, VoiceOver state, Reduce Motion, accessibility audits, English,
  and Spanish UI navigation are covered by Release tests.
- Package tests, all 16 Release app/UI tests, iPad Pro compatibility smoke,
  development workspace build, Release build, and unsigned archive pass.

## Verified submission prep

- App ID and App Store Connect record exist for `io.bamware.brewdesk`.
- Evidence-first listing copy, review notes, and five updated opaque 1320×2868
  screenshots are committed at `bamware-brewdesk@7bb2109`.
- The Release build passes on iPhone and in iPhone compatibility mode on an
  iPad Pro simulator.
- Native fastlane TestFlight CI is committed at `bamware-brewdesk@cbbc25f`.
  Its protected `production` environment is restricted to `main`; dispatch is
  blocked until a human adds the existing ASC key and distribution certificate
  as environment secrets.
- BrewDesk 1.0 (2), built from `bamware-brewdesk@7bb2109`, was uploaded with
  Xcode cloud-managed distribution signing. App Store Connect reports `VALID`
  and `IN_BETA_TESTING` for internal testers.

## Submission documents (drafted 2026-08-21, awaiting Bilal sign-off)

- Rejection responses (brewdesk#32): [rejection-response-pack.md](rejection-response-pack.md)
- Category recommendation (brewdesk#31): [brewdesk-category-memo.md](brewdesk-category-memo.md)
- Runbook to Submitted (brewdesk#33): [brewdesk-submission-runbook.md](brewdesk-submission-runbook.md)

## App Store work remaining

1. ~~Reconfirm production logs do not retain coordinate query strings before
   retaining App Privacy as Data Not Collected.~~ **Closed 2026-08-21
   (brewdesk#29) as a code/docs finding — captured production evidence is
   still open.** Finding: the engine itself logs nothing per request and
   stores no location history; the only retention is Vercel Runtime Logs,
   whose request rows include *Search Params* (Vercel docs, Runtime Logs →
   Log details, updated 2026-08-03) for **1 h on Hobby / 1 day on Pro /
   30 days with Observability Plus**; no log drain is configured. Team
   `bmalikee-8236s-projects` is on **Hobby** (Vercel `list_teams`, 2026-09-16).
   The client migrated via
   [brewdesk#154](https://github.com/mrbam88/bamware-brewdesk/issues/154)
   ([PR #164](https://github.com/mrbam88/bamware-brewdesk/pull/164); treat as
   landed) to `X-BrewDesk-Viewport: <lat>,<lng>` on `GET /v1/venues`. Filters
   stay on the query string. Engine header channel already shipped as
   [venue-engine#16](https://github.com/mrbam88/bamware-venue-engine/issues/16).
   Older clients may still send query-string `lat`/`lng` until they upgrade.
   After the App Store build that includes #154 ships, Search Params on listing
   GETs should no longer show `lat`/`lng` (verify on that build). Hobby 1 h
   retention still applies to whatever remains in Search Params / other fields.
   Denied location still sends the Union Square
   anchor; granted location sends the device coordinate (bd#108: no
   out-of-coverage substitution). Asserted (brewdesk PR #39) by
   `PrivacyRequestAuditTests`, `VenuesModelPrivacyTests`, and the
   Release-suite `PrivacyClaimTests`; inventory in brewdesk
   `docs/PRIVACY-AUDIT.md`.

   **Privacy evidence is not complete until the Human paste below lands.**
   Ticket: [venue-engine#19](https://github.com/mrbam88/bamware-venue-engine/issues/19)
   stays **open**. Agents must not invent a log row.

   **Human-only. Needs Bilal's Vercel login for project `venuekit`
   (team `bmalikee-8236s-projects`).** Dashboard → Logs → one production
   `/v1/venues` row → Search Params (redact IP / User-Agent). Alternative:
   `cd ~/code/bamware-venue-engine && npx vercel logs --since 1h`.

   Bilal: paste one redacted /v1/venues Vercel log row here (Search Params + plan tier Hobby/Pro + capture date).

   | Field | Value |
   |---|---|
   | Redacted `/v1/venues` Search Params | _empty — Bilal paste_ |
   | Plan tier (Hobby / Pro) | _empty — Bilal paste_ |
   | Capture date | _empty — Bilal paste_ |

   **Vercel MCP connector-access decision (2026-09-16, venue-engine#19):** Do
   **not** claim agents can observe venuekit production logs today. Dev
   observed Vercel MCP live tool discovery in **error** state (2026-09-16).
   Historically: 403 / empty project list. **Bilal must re-auth / grant
   project access** for team `bmalikee-8236s-projects` / project `venuekit`
   before agents treat `get_runtime_logs` as a verification path
   ([venue-engine#78](https://github.com/mrbam88/bamware-venue-engine/issues/78)).
   One Cloud Agent session the same day listed the Hobby team and `venuekit`
   and received runtime log *summaries* (path + status) — **not** the
   dashboard Search Params panel. Intermittent MCP success is not durable
   access. Search Params proof remains dashboard/CLI (Bilal's login) until
   MCP exposes that panel.

   **Six observability holes** from brewdesk#29, triaged 2026-09-16 on
   [venue-engine#19](https://github.com/mrbam88/bamware-venue-engine/issues/19)
   (fixes not built here):

   | # | Hole | Decision |
   |---|---|---|
   | 1 | Agents cannot observe production | Ticket [venue-engine#78](https://github.com/mrbam88/bamware-venue-engine/issues/78) |
   | 2 | Privacy position is plan-dependent with no guard | Client shipped (header channel) via [brewdesk#154](https://github.com/mrbam88/bamware-brewdesk/issues/154) ([PR #164](https://github.com/mrbam88/bamware-brewdesk/pull/164)); engine #16 already accepts the header |
   | 3 | CI/app-target tests / Release gaps | **Dropped** — brewdesk `ci.yml` already runs package tests + Release `BrewDeskTests` (PR #39). UI tests stay out of main CI on purpose (macOS-minute spend). |
   | 4 | Out-of-band egress (AsyncImage / MapKit) | Ticket [brewdesk#155](https://github.com/mrbam88/bamware-brewdesk/issues/155) |
   | 5 | Places-proxy comments vs `lh3.googleusercontent.com` | Ticket [brewdesk#156](https://github.com/mrbam88/bamware-brewdesk/issues/156) |
   | 6 | Hobby evidence is 1 h; no auto capture | Ticket [venue-engine#79](https://github.com/mrbam88/bamware-venue-engine/issues/79) (paid drain = spend STOP) |
2. Test allow, deny, restricted, and previously-granted location states on a
   physical iPhone.
3. Smoke-test the **latest** TestFlight build cut from current main (post–WFH
   spots + outside-NYC + theme + listing-metadata fixes). Add an exportable
   distribution `.p12` to the protected `production` environment later to
   enable unattended CI.
4. ~~Listing URLs + privacy/support liveness (brewdesk#70).~~ **Closed
   2026-08-24.** Live `bamware.io/brewdesk/{privacy,support}` verified; Google
   Places photo attribution on privacy (web#17); reviewer notes cite
   `/v1/health` not bare engine root (brewdesk#114); `copyright.txt` =
   `2026 Bamware` in fastlane metadata. Remaining ASC entry (brewdesk#31,
   Human-only): primary/secondary category per
   [brewdesk-category-memo.md](brewdesk-category-memo.md), age rating,
   content-rights declaration.
5. Submit the tested build (brewdesk#33 runbook; Submit click Bilal-only).

## Review positioning

The primary risk is Guidelines 4.2/4.3: an undifferentiated cafe finder. Every
listing surface and review note must describe what is in the binary now:

> BrewDesk evaluates NYC cafes specifically for remote work using transparent
> Work Fit scores across Wi-Fi, outlets, laptop policy, and noise. Every claim
> displays its source, confidence, and verification date.

Do not promise speed testing, community reports, accounts, cloud saves, or
subscriptions in v1 metadata.

## Privacy position

The Venue Engine uses coordinates transiently to rank a request and stores no
location history or user identity. This supports Data Not Collected under
Apple's real-time-processing definition only while infrastructure logging does
not retain query strings beyond a transient window (today: Vercel Runtime Logs,
1 h on Hobby — see item 1 above). **That window is still docs-derived; the
item 1 Human paste has not landed, so privacy evidence is not complete.**
Evidence stays incomplete until Bilal pastes a redacted production
`/v1/venues` Search Params row
([venue-engine#19](https://github.com/mrbam88/bamware-venue-engine/issues/19)).
After the #154 build is live in production traffic, that paste should show no
`lat`/`lng` in Search Params for listing fetches. Any analytics, crash
reporting, retained location logging, or a Vercel plan/drain change requires
reassessment before submission. Agents must not treat Vercel MCP as
production-log proof until Bilal re-auths (item 1 connector decision).

Decided 2026-08-21 (brewdesk#29): the app keeps sending the Union Square
anchor when location is denied rather than omitting `lat`/`lng`. A hardcoded
public landmark is not user Location data, and omitting coordinates would turn
the reviewer's anchor path (App Review sits outside NYC) from ~100 pins in the
Union Square viewport into ~38 citywide-top-100 pins with no distances — a
brewdesk#1-class first-impression regression for zero privacy-label gain. The
tests prove the anchor is the only value sent in that state.
