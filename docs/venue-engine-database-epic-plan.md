# Venue engine database epic — proposed execution plan

> PROVISIONAL — subsequent discussion clarified that NYC recommendation
> quality is the objective. Read [the product direction](nyc-venue-intelligence-direction.md)
> first. This storage-focused draft must be revised to include evidence
> aggregation, AI interpretation, research caching and ranking evaluation.
> Preserving API behavior during migration is a safety gate, not acceptance
> of the current ranking quality. No execution approval has been given.

Draft, 2026-09-19. Parent: https://github.com/mrbam88/bamware-venue-engine/issues/129
Grounded in engine main `c81c518`, including viewport PR #141. This is a planning proposal; it does not authorize provisioning, spend, deployment changes or cutover.

## Outcome

Make accepted user writes durable across restarts and instances, support repeatable imports, and preserve existing venue IDs, response contracts, scoring and listing behavior. PostgreSQL/PostGIS becomes authoritative; JSON remains a generated public snapshot and read fallback. Discovery and evidence-quality work continue separately.

## Proposed architecture

- Keep Express, Zod and current clients. Introduce asynchronous repository interfaces with JSON and Postgres implementations.
- Use relational identity, geography, provider aliases and private ownership columns; JSONB can preserve existing optional claim/projection payloads. Avoid normalizing every response field in the first migration.
- Tables cover venues, provider aliases, permitted evidence/claim history, current projections, tenant/user saved sets, observations, reports, photo moderation, import runs/checkpoints, city demand and spend reservations/actuals.
- Keep current TypeScript scoring, filtering and tie-breaking. Use PostGIS for candidate selection, then existing logic for final eligibility, distance semantics, deduplication and ordering. Do not SQL-limit candidates before ranking or coverage counts. Verify radius boundaries against current Haversine behavior.
- Preserve ordered saved-set replacement and current last-write-wins semantics. Each replacement is one transaction keyed by trusted tenant and user identity; no silent merge or new client protocol.
- Commit observations and their projection updates atomically. Commit moderation decisions and public visibility changes atomically.
- Run ingestion as explicit batch jobs outside HTTP requests; resumable checkpoints and unique source/run keys prevent duplicate writes. Reserve spend atomically before external calls; reconcile actuals without claiming external requests can be exactly-once.
- Separate public read, private application write and migration privileges. Public exports use an explicit field allowlist; no user identifiers, reports, private saves or restricted source payloads.

## Delivery order

| Milestone | Existing tickets | Exit evidence |
|---|---|---|
| Design | #130 | ADR, complete storage inventory, source retention matrix, cost scenarios, rollback protocol and fixed parity corpus |
| Local foundation | #131 | Versioned migrations, bounded connections, async interfaces and real Postgres integration gate |
| Import and read parity | #132 → #133 | All current datasets/sidecars imported idempotently; JSON and DB responses agree |
| Durable user state | #134 → #135 | Concurrent writes, isolation, restart survival, moderation visibility and failure behavior verified |
| Repeatable pipeline | #136 → #137 | Interrupted jobs resume; spend accounting is concurrency-safe; public snapshots round-trip |
| Hosting and rehearsal | #138 → #139 | Approved costs and deployment wiring; restore drill, load evidence and reversible staged switch |

#138's decision packet starts during #130; actual provisioning stays gated. Serialize route/dependency-wiring changes in src/app.ts and api/index.ts. Recheck active PRs before each ticket. #131 is broad: define interfaces and core tables there, then let the owning feature tickets extend their own private/job schemas if needed to keep PRs reviewable.

## Compatibility baseline

Inventory venues.json plus all 50 baseline shards, business status/info, photo classifications and join IDs, legacy aliases, flags, research inputs, city demand/spend and mutable private stores. Record checksums and import exclusions; 8,295 is the eagerly loaded venue count, not the total including baseline shards.

Freeze clock and external-provider fixtures for comparisons. Cover dense NYC, sparse/non-NYC fallback, radius boundaries, filters, detail/deep links, permanently/temporarily closed venues, evidence partitions, photos and #141's 500 cap and all coverage metadata. Preserve omission versus null. Require exact IDs/order/counts/metadata and declared numeric tolerances only where necessary. No unexplained mismatches.

Confirm whether any recoverable private state exists before importing; do not claim ephemeral writes can be reconstructed. Inspect source permissions field by field: existing JSON presence is not evidence of permission to store indefinitely. No Apple-derived venue data is persisted by this migration.

## Cutover and rollback

1. Import a pinned dataset, compare offline and in staging, then run bounded shadow public reads without duplicating provider calls or user writes.
2. Reconcile changes since the pinned import with a final import/delta pass before switching. Establish one authoritative ingestion writer at every stage.
3. Activate durable private writes separately from public reads. Return success only after commit; database failures return errors, never a fake successful in-memory write.
4. Switch public reads only after parity and measured latency gates pass. Proposed latency gate: no more than 20% warm p95 regression against a same-environment JSON baseline; approve an absolute target after measurements. Measure cold starts and connection saturation separately.
5. Public read rollback selects a versioned last-good JSON snapshot with a declared freshness bound. Private writes stay on the database. Code rollback must use a DB-compatible release; if unavailable, pause writes while repairing. Never roll back private state to empty process memory.
6. Drill restore into a separate database and verify representative private records and public queries. Proposed starting recovery objectives: RPO <=24h, RTO <=4h; assess whether losing a day of user writes is acceptable before choosing hosting/backups.

## Hosting decision still required

Use local disposable Postgres/PostGIS for implementation. Evaluate Neon first as a database-only option; compare Supabase and a small managed alternative against measured full-import size, connections, warm/cold latency, egress, retention and restore needs. Do not promise the complete dataset fits a free tier.

Price idle, expected and bounded-growth scenarios; distinguish alerts from enforceable spending caps. Include backups and history growth. Paid use requires quote-and-confirm; anything potentially above $20 requires explicit permission under Bamware policy. No provider selected in this draft.

Official references checked 2026-09-19: https://neon.com/blog/new-usage-based-pricing ; https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/backups . Supabase Free requires user-managed exports for recoverable off-site backups; validate all selected plan terms again in #130.

## Readiness and scope

Keep tickets Supervised until their dependencies, concrete file scope, test gate and execution runtime are verified. No agent launch is implied. #127 discovery hints and #116 enrichment remain separate. Auth providers, scoring redesign, new mobile features and nationwide research are outside this epic.

Next deliverable: complete #130's ADR and hosting decision packet, then groom #131 against that approved design. This draft is not completion of #130: full source-policy review, measured sizing, concrete cost bounds and driver/migration-tool selection remain open.
