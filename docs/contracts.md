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
- The same discipline applies to any future client/service pair (BrewDesk ↔
  venue-engine: contract in `docs/brewdesk-mvp-contract.md`).

## Long-term fix

A shared contract package is the real answer — that decision is parked in
`bamware-dating-app` issue #6 (contract-layer ADR, needs Bilal's call).
