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

- **2026-09-19 (venue-engine#140, additive):** `GET /v1/venues` and
  `POST /v1/venues/search` support map-viewport queries (centre `lat`/`lng` +
  `radius_m`, up to 3000, per BrewDesk's "Search this area").
  - `limit` max raised **200 → 500** (default 50 unchanged).
  - `meta` gains four additive fields alongside the existing
    `meta.coverage`: `total_in_radius` (count matching the viewport before
    `limit` cut the page), `returned` (`venues.length`), `hollow_returned`
    (how many returned pins have `evidence:"none"`), and `truncated`
    (`true` when `total_in_radius > returned`) — lets the app show "showing
    500 of 1,240".
  - `sort=distance` (pure distance, hollow pins included) already existed
    alongside `sort=work_score` (evidence-backed pins first, then hollow
    pins ordered by distance) — no change, just calling it out since the
    app is about to rely on it for map pin ordering.
  - New opt-in `fields=map` or `compact=1` query param (either works,
    same effect): trims each venue to exactly `{ id, name, lat, lng,
    workScore, evidence, status, sourceCount }` for map-pin rendering.
    Measured on real NYC data: a 500-pin page is ~579KB full-shape vs.
    ~80KB compact. Neither param changes the default response — omit both
    and the shape is byte-identical to before this ticket.
  - Full detail: venue-engine PR
    https://github.com/mrbam88/bamware-venue-engine/pull/141.

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
