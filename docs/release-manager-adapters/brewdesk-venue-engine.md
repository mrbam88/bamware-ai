# BrewDesk Service Adapter: Venue Engine

Parent product: BrewDesk

## Repository

- Service repo: `mrbam88/bamware-venue-engine`
- Default branch: `main`
- Role: backend API and venue-intelligence service for BrewDesk
- Production: existing Vercel project `venuekit`
- Canonical deployment procedure: `docs/venue-engine-deployment.md`

This adapter is subordinate to the BrewDesk product release flow. Venue Engine is not a separate top-level product queue.

## When the BrewDesk Release Manager should invoke this adapter

Use this service adapter when a BrewDesk work item:

- changes Venue Engine code or data,
- changes an API response shape or request contract,
- depends on backend behavior that must be live before the client ships,
- fixes a production API/data defect,
- or otherwise explicitly targets `mrbam88/bamware-venue-engine`.

Do not touch Venue Engine for app-only work.

## Execution source of truth

Use the Venue Engine repo's GitHub issues/project state plus the parent BrewDesk release context.

For cross-repo work, preserve one product-level outcome and track the repo-specific implementation tasks beneath it.

## Required verification

Follow the service's canonical deployment contract.

Before deploy:

- `npm run typecheck`
- `npx vitest run --maxWorkers=2 --minWorkers=1`
- `npm run truth-check`

Report actual failures/skips honestly.

GitHub CI also runs typecheck and tests on PRs and pushes to `main`, but GitHub Actions is not a prerequisite for the release route.

## Release rail

Canonical route:

`local validation → existing Vercel project → live API verification`

The existing Vercel Git integration can deploy production from `main`; do not invent a new project, CI dependency, paid tier, or alternate deployment mechanism.

## Cross-repo contract rule

API shape changes are load-bearing.

Before changing request/response contracts:

1. read `docs/contracts.md`,
2. identify affected BrewDesk client decoding/behavior,
3. coordinate backend and iOS changes as one BrewDesk product outcome,
4. deploy/verify the backend in the order required by backward compatibility,
5. only ship the client once the live contract it expects is confirmed.

Prefer additive/backward-compatible backend changes so deployment order stays safe.

## Release-ready condition

Venue Engine work is Release Ready when:

1. selected backend changes are reviewed/merged or otherwise on the exact tested release candidate,
2. required local verification is green,
3. contract coordination is complete when applicable,
4. no human-only spend/config/credential gate remains unresolved.

## Shipped condition

Mark the Venue Engine portion Shipped only after production is verified against the live service.

At minimum, verify:

- `/v1/health`,
- the affected endpoint/response,
- compact/full search or detail behavior where relevant,
- and any contract field the client depends on.

A successful merge or provider build alone is not proof of shipment.

## Human-only / Needs You gates

Surface these without blocking unrelated BrewDesk work:

- spend approvals under Bamware policy,
- secrets/credentials or deploy access that is not already authorized,
- durable infrastructure purchases/provisioning,
- product decisions,
- incompatible cross-repo contract decisions.

## Release Manager behavior

The BrewDesk Release Manager owns orchestration.

Examples:

- App-only ticket → iOS rail only.
- Backend-only defect → Venue Engine rail only.
- Contract change → coordinate Venue Engine + iOS as one BrewDesk release outcome.
- Backend must go first → deploy and verify Venue Engine, then allow the client batch to proceed.
