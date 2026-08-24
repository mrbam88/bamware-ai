# Cross-repo contracts — THE thing agents get wrong

The mobile app hand-declares TypeScript types for the service's API. There is
no shared contract package (client-core is orphaned — dating-app issue #6).

**Consequence: change a service response shape and the app breaks SILENTLY
while its mocked tests keep passing.**

It happened: June 2026, the matches pagination envelope changed server-side.
Chat was broken for six weeks. Nothing failed in CI on either side.

## The rules

- **Service-side shape change → you MUST open a matching PR in
  `bamware-dating-app`** (`src/api/*.ts` + affected screens + tests). The two
  PRs reference each other.
- **App-side, never trust the declared type.** Verify against the service's
  `src/schemas/*.ts` on its CURRENT main before building on it.
- The same discipline applies to BrewDesk ↔ venue-engine: the two hand-declared
  clients are SwiftUI `bamware-brewdesk` and Flutter
  `bamware-brewdesk-flutter`; contract in `docs/brewdesk-mvp-contract.md`.
  A service shape change must update and test both clients in coordinated PRs.

## Long-term fix

A shared contract package is the real answer — that decision is parked in
`bamware-dating-app` issue #6 (contract-layer ADR, needs Bilal's call).

## Recent contract changes

- **2026-08-23 (venue-engine#46, additive):** `GET /v1/venues` and
  `POST /v1/venues/search` responses gain `meta.coverage` and a `tier` field
  per venue — Tier-0 US-wide OSM baseline coverage outside NYC (epic:
  brewdesk#107). Full shape in `docs/brewdesk-mvp-contract.md`'s API contract
  section. Existing NYC fields/values are unchanged — verified with a
  byte-level regression snapshot in venue-engine
  (`tests/nyc-real-data.test.ts`). No BrewDesk app PR was required for this
  slice (client-side "real viewport + honest banner" work is a separate
  child ticket in the same epic); the app can ignore the new fields safely
  since they're additive.
