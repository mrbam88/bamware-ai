# BrewDesk Client Adapter: Android / Flutter

Parent product: BrewDesk

## Repository and queue

- Client repo: `mrbam88/bamware-brewdesk-flutter`
- Default branch: `main`
- Role: Android client for BrewDesk
- Shared backend: `mrbam88/bamware-venue-engine`
- Execution queue: GitHub Issues / Bamware Project 2
- Current product state: **paused / stale**
- Distribution target: Google Play

This adapter is subordinate to the BrewDesk product release flow. Android is not a separate top-level product.

## Why paused/stale

The Android app exists and has an active historical queue, but it is behind the iOS client and has not completed Google Play approval. It must remain visible to the portfolio without being treated as current Ready work by default.

Observed open work includes:
- modern map migration,
- UI parity/polish,
- Play production assets and listing completion,
- a product decision around cold-start behavior,
- the original Android MVP/internal-testing epic.

## Activation rule

Do **not** automatically pull Android work into BrewDesk WIP while this adapter is paused.

Android becomes active only when Bilal explicitly promotes the rail, for example:
- resume Android,
- prepare for Play submission,
- bring Flutter back to parity,
- ship a new Android build.

Once activated, triage the existing queue into Ready / Deferred / Human Only / Not Planned before implementation.

## Shared contract rule

Venue Engine response-shape changes must remain compatible with both BrewDesk clients.

When an API contract changes:
1. check iOS decoding/behavior,
2. check Flutter decoding/behavior,
3. update `docs/contracts.md`,
4. coordinate fixes if the paused Android client would otherwise become incompatible.

A paused rail may still require a compatibility patch when backend changes would break it materially; do not treat "paused" as permission to knowingly rot the client contract.

## Release rail

Use the repository's existing Android / Google Play delivery procedure and runbooks when the rail is reactivated.

Do not invent new signing, Play Console, or build infrastructure. Human-only Play Console/store configuration remains `Needs You`.

## Release-ready condition

When active, Android work is Release Ready when:
- selected issues are merged,
- required Flutter analysis/tests/build checks are green,
- Play/store human gates required for that batch are resolved,
- shared Venue Engine contract compatibility is verified.

## Shipped condition

Mark Android Shipped only when the intended build is confirmed in the established Google Play track or distribution rail.

An APK/AAB build or merge alone is not proof of shipment.
