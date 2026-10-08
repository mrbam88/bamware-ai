# Release Manager Adapter: Bamware CRM

Product: Bamware CRM

## Repository and state

- Primary repo: `mrbam88/bamware-crm`
- Current implementation branch/default branch: `feat/crm-offline-tasks`
- Stack: Expo / React Native web + iOS/Android, Express API, SQLite
- Product state: **development / pre-production**
- Current tracker: `mrbam88/bamware-ai#31`
- No live production release rail is established yet.

CRM is a separate top-level Bamware product, not part of Bamware Web.

## Current verified scope

The first architecture slice is implemented and verified (private GitHub source):

- workspace + role-scoped permissions,
- offline Tasks,
- web + iOS flows,
- durable local/server SQLite behavior,
- conflict/retry/revocation handling,
- shared auth middleware integration seam.

**Next slice in review** ([bamware-crm#1](https://github.com/mrbam88/bamware-crm/pull/1)):
`@bamware/crm-workspaces` pure membership + task mutation policy; server SQLite
is a durability adapter. Tracker remains bamware-ai#31.

The product ticket excludes live auth registration/deployment, push integration,
store release, paid runs, and production operations.

## Execution source of truth

Until CRM has its own mature repo-level issue queue, use:
- `mrbam88/bamware-ai#31` for the current first-slice outcome,
- `mrbam88/bamware-crm` source/PR state for implementation reality,
- canonical CRM docs in `bamware-ai/docs/bamware-crm*.md`.

As the product grows, move new implementation tickets into the CRM repo and keep product-level outcomes linked from Bamware context.

## Active flow

Use the shared state machine:
`Backlog → Ready → In Progress → Review → Release Ready → Shipped`

For CRM today, interpret **Release Ready** as "validated development candidate" until a production rail is explicitly established.

Do not mark CRM `Shipped` merely because the local/web/iOS proof passes.

## Required verification

Before considering a CRM development batch Release Ready:

- `npm run typecheck`
- `npm test`
- `npm run build:server`
- `npm run build:web`
- `npm run test:web`
- relevant native verification (`npm run test:ios` when iOS behavior changes)
- Android verification only when Android is in scope

Preserve the existing offline/conflict/auth isolation behavior.

## Human-only / Needs You gates

Surface these before production activation:

- CRM tenant registration in shared auth,
- production user/workspace identity decisions,
- hosting choice and production deployment rail,
- production credentials/secrets,
- store/distribution decisions,
- paid infrastructure or other spend,
- product scope decisions beyond the approved first slice.

## Deployment rule

There is currently **no authorized production deployment target** documented for CRM.

Do not invent one.

When Bilal explicitly decides to productionize CRM, define and verify the web/API/mobile release rails first, then update this adapter with:
- hosting targets,
- CI/release gates,
- store/distribution rails,
- production verification,
- Shipped semantics.

## Release Manager behavior

The Release Manager may continue Ready CRM development work independently, but must stop at validated Release Ready when production-only gates are reached.

CRM should appear in Chief of Staff reporting as a development product, not as a failing production release.
