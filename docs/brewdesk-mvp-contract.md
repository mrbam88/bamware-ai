# BrewDesk v1 contract

**Updated:** 2026-08-18

## Product

- Free, accountless, iPhone-only NYC work-cafe discovery.
- Flow: onboarding, optional location, map/list discovery, venue details.
- No auth, purchases, subscriptions, analytics, advertising, or user submissions.
- Canonical app identity: `BrewDesk`; bundle `io.bamware.brewdesk`.
- Client repo: `bamware-brewdesk`; feature package: `Packages/BrewDeskKit`.

## Repository boundaries

- `bamware-brewdesk`: app composition, BrewDesk UI, and VenueKit client.
- `bamware-ios`: reusable BamwareCore, BamwareUI, and BamwareMessaging products.
- `bamware-venue-engine`: Express/Zod venue API and contract source.

The app's development workspace substitutes the sibling `bamware-ios` checkout.
Shared modules never import BrewDesk.

## API contract

Base URL is `http://localhost:3000` in Debug and
`https://venuekit-ashen.vercel.app` in Release.

- `GET /v1/health` returns `{ ok, venueCount, seededAt }`.
- `GET /v1/venues` supports geo, work-fit filters, search, sorting, and limit;
  returns `{ count, venues[] }`.
- `GET /v1/venues/:id` returns `{ venue, observations[] }`.
- `GET /v1/neighborhoods` returns `{ neighborhoods[] }`.
- `POST /v1/observations` exists in the engine but has no v1 app consumer.
- `GET /v1/venues/:id/photos` (added 2026-08-20) returns
  `{ photos: [{ url, attribution?, widthPx?, heightPx? }] }` — `url` is a
  same-origin proxy path; empty array whenever unmapped or
  `GOOGLE_PLACES_API_KEY` is unset. `GET .../photos/:i/media?maxWidthPx=`
  302-redirects to a short-lived Google-hosted image. Google Places (New)
  data: display-only with attribution; key server-side only; photo bytes
  never stored (Bilal's 2026-08-20 licensed-API rule).

JSON is camelCase except `distance_m` on geo responses. Attribute claims carry
`value`, optional detail/range/window, `source`, `confidence`, and `observedAt`.
Swift models in `Packages/BrewDeskKit/Sources/VenueKit` match the service.

## Privacy

- Location is optional and used transiently to rank one request.
- The engine retains no location history or user identity.
- App Store privacy answer remains Data Not Collected while query strings are
  not retained and no analytics/crash SDK is added.
- `PrivacyInfo.xcprivacy` declares app-local UserDefaults reason `CA92.1`.

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
