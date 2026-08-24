# BrewDesk v1 contract

**Updated:** 2026-08-24

## Product

- Free, accountless work-spot discovery: SwiftUI/iPhone and Flutter/Android.
- Flow: SwiftUI onboarding or direct Flutter Spots tab, optional location,
  map/list discovery, venue details.
- No auth, purchases, subscriptions, analytics, advertising, or user submissions.
- Canonical app identity: `BrewDesk`; Apple bundle / Android application id
  `io.bamware.brewdesk`.
- Client repos: `bamware-brewdesk` (SwiftUI; feature package
  `Packages/BrewDeskKit`) and `bamware-brewdesk-flutter` (Flutter/Android).

## Repository boundaries

- `bamware-brewdesk`: app composition, BrewDesk UI, and VenueKit client.
- `bamware-brewdesk-flutter`: Android composition, Material UI, and Dart API
  client; shares the wire contract and vocabulary, never Swift UI code.
- `bamware-ios`: reusable BamwareCore, BamwareUI, and BamwareMessaging products.
- `bamware-venue-engine`: Express/Zod venue API and contract source.

The app's development workspace substitutes the sibling `bamware-ios` checkout.
Shared modules never import BrewDesk.

## API contract

SwiftUI uses `http://localhost:3000` in Debug and production in Release. The
Flutter MVP uses `https://venuekit-ashen.vercel.app` in all configurations.

- `GET /v1/health` returns `{ ok, venueCount, seededAt }`.
- `GET /v1/venues` supports geo, work-fit filters, search, sorting, and limit;
  returns `{ count, venues[], meta }` (venue-engine#46, 2026-08-23 — additive).
  `POST /v1/venues/search` (#16 privacy channel, same query semantics via JSON
  body) returns the identical shape.
  - `meta.coverage`: `"researched" | "baseline" | "none"` — whether the
    viewport's results include any NYC-researched venue, only OSM-baseline
    venues, or nothing at all.
  - Every venue now carries `tier: "researched" | "osm-baseline"`.
    `"researched"` is the existing NYC hand-researched/curated data,
    unchanged. `"osm-baseline"` is US-wide free OSM data (any US viewport,
    imported ahead of time per-metro or fetched live from Overpass on a
    sparse viewport) — name/location/category only; workability attributes
    (wifi, outlets, laptop policy, noise, seating) are honestly `"unknown"`
    (confidence 0) rather than guessed, so `workScore` sits at the neutral
    50 baseline until someone researches or reports on the venue.
  - Existing NYC responses are unchanged apart from these two additions
    (verified with a byte-level regression snapshot in venue-engine).
- `GET /v1/venues/:id` returns `{ venue, observations[] }`.
- `GET /v1/neighborhoods` returns `{ neighborhoods[] }`.
- `POST /v1/observations` exists in the engine but has no v1 app consumer.
- `GET /v1/venues/:id/photo` (singular, engine#9) returns one resolved photo
  `{ venueId, source, photoUri, attribution[], … }`; 404 without a place id,
  503 unconfigured. `GET /v1/venues/:id/photos` (list, engine#10) is the
  BrewDesk detail-screen contract: `{ photos: [{ url, attribution?, widthPx?,
  heightPx? }] }` where `url` is a short-lived Google-hosted absolute URL;
  photo-less situations (no place id, no key, upstream failure) always yield
  `{ photos: [] }`, never an error. Key: `GOOGLE_MAPS_API_KEY`, server-side
  headers only; photo bytes never stored; attribution must be displayed
  (Bilal's 2026-08-20 licensed-API rule). Venues need `googlePlaceId`
  backfilled via `scripts/backfill-place-ids.ts`.

JSON is camelCase except `distance_m` on geo responses. Attribute claims carry
`value`, optional detail/range/window, `source`, `confidence`, and `observedAt`.
Swift models in `Packages/BrewDeskKit/Sources/VenueKit` and Dart models in
`bamware-brewdesk-flutter/lib/domain/models` match the service.

## Privacy

- Location is optional and used transiently to rank one request.
- The engine retains no location history or user identity.
- App Store privacy answer remains Data Not Collected while query strings are
  not retained and no analytics/crash SDK is added.
- `PrivacyInfo.xcprivacy` declares app-local UserDefaults reason `CA92.1`.
- Android requests coarse/fine location only for the nearby query and persists
  saved venue IDs locally with SharedPreferences; neither is sent as identity.

## Validation

```bash
cd ~/code/bamware-brewdesk/Packages/BrewDeskKit
xcodebuild -scheme BrewDeskKit-Package \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test

cd ~/code/bamware-brewdesk
xcodebuild -workspace BrewDeskDevelopment.xcworkspace -scheme BrewDesk \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Before App Store submission, build a device archive and inspect its app name,
bundle ID, privacy manifest, linked frameworks, and embedded strings.

Flutter/Android gate:

```bash
cd ~/code/bamware-brewdesk-flutter
flutter analyze
flutter test
flutter build apk --debug
```
