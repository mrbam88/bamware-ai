# NYC venue intelligence — product direction

Confirmed by Bilal, 2026-09-19. Read before planning venue-engine discovery,
research, ranking, caching or database work.

## The problem and success criterion

Bilal is dissatisfied with BrewDesk's recommendations: it does not reliably
find great cafés to work from, and scores/rankings do not reflect his local
knowledge. More pins and a healthy API are not sufficient evidence of success.

He manually tests neighborhoods he knows. When he enters a neighborhood,
his known excellent work cafés should appear with strong scores and useful
placement. High score means **great place to work**, not just good coffee.
Popularity and a lively social atmosphere also matter, alongside workability.
The product framing is venue atmosphere/popularity, not evaluating patrons'
appearance or gender.

**Current geographic scope is NYC only.** Design for eventual growth, but do
not turn this effort into nationwide rollout or research. Preserve existing
non-NYC behavior during compatibility work without expanding its scope.

## What the engine is supposed to do

The existing repository/source-adapter pattern aggregates different sources.
Bilal's intent is to use AI to understand the combined evidence and identify
the best work cafés, rather than merely collect listings. Media research,
including sources such as the New York Times, is intentional: reviews should
contribute meaningful evidence to recommendations and ranking.

Expected conceptual flow:

**Discover → resolve café identity across sources → collect evidence → AI
interprets evidence → retain reusable findings → rank nearby work cafés.**

Do not reduce this to a storage migration that faithfully preserves bad
recommendations. The database is proposed to support scale, aggregation,
research history and reusable AI results. Caching is specifically intended
to avoid paying repeatedly to analyze unchanged café/source information.

## Proposed implementation principles — not yet a finalized scoring design

- Use media content, not merely a publication-name bonus. Evidence of laptop
  use, seating, outlets, noise and ability to linger can improve Work Fit;
  praise for espresso alone does not establish workability.
- Popularity/social atmosphere can help rank otherwise workable venues;
  it must not erase evidence of poor working conditions or laptop bans.
  Exact weights and whether this affects the score or only ordering remain
  undecided. Existing separation of Buzz from Work Fit is not silently revoked.
- Let AI interpret source material into attributable structured findings;
  compute rankings with inspectable rules. A scoring adjustment should not
  require repeating every AI research call.
- Reuse analysis when evidence is unchanged. Define freshness, evidence-content
  versioning, model/prompt/schema versions and invalidation before implementing
  the cache. Retain only material permitted by each source's policy.
- Turn Bilal's neighborhood examples into an evaluation set, not hardcoded
  score boosts. Diagnose absent venues, serving/filter exclusions, missing
  evidence and scoring failures separately; evaluate other cafés too.

## Effect on the database epic

Engine epic #129 and the ten migration tickets are an existing backlog, not
an approved complete solution to recommendation quality. The earlier
[database epic draft](venue-engine-database-epic-plan.md) is provisional and
must be revised around this product direction before execution. Storage,
research caching, evidence extraction and ranking need a coordinated plan.
Database durability still matters, but it is supporting infrastructure.

Open decisions: concrete neighborhood benchmark, interpretation/evidence
schema, ranking signals and weights, cache refresh policy, implementation
sequence and hosting. No new café examples or numeric scoring weights were
agreed in this discussion. No implementation, provisioning, paid research,
hosting spend or production cutover was authorized. Existing quote-and-confirm
spend rules remain in force.
