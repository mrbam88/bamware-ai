# Release Manager Adapter: Bamware Video

Product: Bamware Video

## Repository and state

- Primary repo: `mrbam88/bamware-video`
- Default branch: `main`
- Stack: Next.js 16 + Tailwind
- Product state: **active development / pre-production**
- Current queue bootstrap: `mrbam88/bamware-video#1`
- Current business model: pay-per-video trend clips; free teaser, paid full output
- Fulfillment currently depends on the existing render tooling on the omarchy server

Bamware Video is a separate top-level Bamware product.

## Current verified state

Already implemented:
- landing page,
- free-preview request form,
- template catalog,
- order persistence abstraction,
- Stripe payment-link handoff code,
- initial render pipeline/spike.

Not yet production-ready:
- Vercel project/environment,
- production Blob store,
- live Stripe Payment Link,
- teaser/output delivery flow,
- second production-ready template,
- full paid-order proof.

## Execution source of truth

Use `mrbam88/bamware-video` GitHub Issues and source state.

The initial product queue begins with issue #1. Split the epic into smaller agent-ready tickets when implementation begins rather than treating the whole epic as one WIP item.

## Active flow

Use the shared release-manager state machine:
`Backlog → Ready → In Progress → Review → Release Ready → Shipped`

For this product, `Shipped` means a real production site plus a verified end-to-end paid order and fulfilled video output.

## Verification

Before merging web changes:
- install from the pnpm lockfile,
- run lint/type/build checks exposed by the repo,
- verify affected order/template flows,
- preserve Next.js version-specific rules from `AGENTS.md`.

For render-pipeline changes, use the canonical Bamware video-generation procedure and verify real output, not just command exit status.

## Release rail

The intended web production target is Vercel, but the project/environment is not yet established in the repo's documented current state.

Do not invent a replacement hosting/deployment path.

When Vercel is configured, record the exact established deployment mechanism here and verify production before marking web work Shipped.

Fulfillment remains a separate execution rail from the site:
- site/order intake,
- payment handoff,
- render job,
- teaser/full output delivery.

A successful web deploy alone is not a completed Bamware Video release outcome.

## Human-only / Needs You gates

Surface these without blocking independent implementation:

- Stripe account/payment-link creation or approval,
- production Vercel project/configuration if human access is required,
- Blob provisioning/configuration,
- spend approvals,
- customer-facing pricing/business decisions,
- any real payment or external-account action requiring Bilal.

## Release-ready condition

A batch is Release Ready when:
1. selected implementation tickets are merged,
2. repo verification is green,
3. required render tests are green when applicable,
4. no unresolved human-only gate prevents the intended milestone.

## Shipped condition

For the first product milestone, mark Shipped only after:
- production site is confirmed live,
- production order persistence is confirmed,
- Stripe handoff is confirmed,
- teaser/output delivery works,
- at least two templates are available,
- one full test order is completed end to end with evidence.

## Release Manager behavior

Keep WIP small. Split the bootstrap epic into concrete tickets, prefer work that moves the product toward the first paid fulfilled order, and do not expand into subscriptions or platform-scale rendering before that outcome works.
