# BrewDesk go-live

**Updated:** 2026-08-18

## Locked v1

- App Store name: **BrewDesk — WFH Cafés**.
- On-device name: **BrewDesk**.
- Bundle identifier: `io.bamware.brewdesk`.
- Free, accountless, iPhone-only launch.
- Guests can browse maps/lists, search, filter, and inspect provenance.
- Accounts, cloud saves, StoreKit, speed submissions, and conversations are out.

## Verified client

- Project, target, scheme, executable, module, tests, and package use BrewDesk.
- `BrewDeskKit` contains feature UI; `VenueKit` remains UI-free and Sendable.
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
- Package tests, app tests, UI smoke, development workspace build, Release
  build, and unsigned iOS device archive pass.

## Verified submission prep

- App ID and App Store Connect record exist for `io.bamware.brewdesk`.
- Evidence-first listing copy, review notes, and five opaque 1320×2868
  screenshots are committed at `bamware-brewdesk@17abc3c`.
- The Release build passes on iPhone and in iPhone compatibility mode on an
  iPad Air simulator.
- Native fastlane TestFlight CI is committed at `bamware-brewdesk@cbbc25f`.
  Its protected `production` environment is restricted to `main`; dispatch is
  blocked until a human adds the existing ASC key and distribution certificate
  as environment secrets.

## App Store work remaining

1. Reconfirm production logs do not retain coordinate query strings before
   retaining App Privacy as Data Not Collected.
2. Test allow, deny, restricted, and previously-granted location states on a
   physical iPhone.
3. Add the existing Apple signing and ASC credentials to the protected
   `production` environment, dispatch TestFlight CI, and smoke-test that exact
   build.
4. Complete category, copyright, age-rating, and content-rights fields.
5. Submit the tested build.

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
not retain query strings. Any analytics, crash reporting, or retained location
logging requires reassessment before submission.
