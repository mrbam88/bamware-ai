# Venue Intelligence Engine — Game Plan

**Owner:** Bilal · **Date:** 2026-08-03 · **Status:** proposed
**Vertical #1:** NYC work-cafes · **Vertical #2 (later):** NYC happy hours
**Prime directive:** the data pipeline is the product; the mobile client is a window onto it.

_Migrated from the Claude Project 2026-08-18. NOTE: written before the
2026-08-04..06 native platform work. `bamware-venue-engine` and BrewDesk v1 now
exist; **the Phase 0 extraction spike below has never been run**, which is why
the measured-data differentiator is absent from the v1 binary. See
`docs/brewdesk-go-live.md`._

---

## Thesis

One engine, many verticals. A venue is a venue; what differs per vertical is
*which time-windowed attributes matter* (wifi/outlets/laptop-policy vs. deal
windows/prices). Every failed competitor died the same death: stale data.
So the engine is built around **claims with provenance, confidence, and decay**
— freshness as a first-class system, not a cron job bolted on later.

This is also a deliberate AI-engineering case study: an eval-gated LLM
extraction pipeline with CI regression tests on prompts. Portfolio-grade
regardless of app outcome.

## Architecture (one screen)

```
  INGEST                EVIDENCE               EXTRACTION            SERVE
  OSM Overpass ─┐   ┌─ review corpora ─┐   ┌─ LLM agents ──┐   ┌─ master API
  Google Places ─┼──►│  yelp / google   ├──►│  Zod-validated ├──►│  GET /venues
  (candidates)   │   │  field visits    │   │  claims + evi- │   │  GET /venues/:id
                 │   │  speed tests     │   │  dence quotes  │   │  POST /observations
                 └───┴──────────────────┘   └──────┬────────┘   └─ clients (Expo app,
                                                    ▼               web mirror)
                                          MERGE / SCORE / DECAY
                                          (claims → venue profile,
                                           per-attribute confidence,
                                           freshness clocks)
```

**Stack:** existing bamware patterns — TypeScript strict, Zod, Express-on-Lambda,
DynamoDB single-table, Terraform via `bamware-infra`, GitHub Actions CI
(tsc + vitest + gitleaks). Proposed repo: `mrbam88/bamware-venue-engine`.

## Data model — the real design work

- **Venue**: id, name, geo, neighborhood, hours, vertical tags (`cafe`, `bar` — multi-vertical from day 1; cheap now, brutal retrofit later).
- **AttributeClaim** (append-only): `attribute` (wifi_speed, outlets, laptop_policy, noise, seating, vibe, …) · `value` · `time_window` (nullable — "weekends", "16:00–19:00") · `source` (review_mining | field_visit | speed_test | user_report) · `evidence` (quoted text / measurement) · `observed_at` · `confidence` · `decay_half_life` (per attribute class: outlets decay in months, crowd-level in hours).
- **VenueProfile** (materialized): merged best-current answer per attribute + confidence + `last_verified` + source count. This is what the API serves.

The `time_window` field on claims is the key primitive: cafes need it
("laptops banned weekends", "packed 11–2") and it **is** the happy-hour schema.
Build once, get vertical #2 nearly free.

## Phase 0 — The Spike (gate everything on this) · ~3–5 focused days

Goal: prove extraction produces **true** data. Not "APIs working" — an API
serving confident garbage is a failed spike that demos well.

1. **Golden set:** ~20 cafes Bilal knows cold; hand-write ground truth (wifi tier, outlet density, laptop policy, noise).
2. **Ingest** one pilot neighborhood via OSM Overpass (free, ToS-clean) → ~100–200 candidates; enrich basics from Google Places.
3. **Evidence:** run BOTH sourcing rails on the golden 20 — (a) ToS-clean: Google official reviews (5/place) + Yelp Fusion; (b) paid pilot: Outscraper/SerpAPI full histories (~$25). Compare.
4. **Extraction agents:** reviews → Zod-validated claims with quoted evidence; batch via the proven agent fan-out pattern.
5. **Eval harness:** precision/recall per attribute vs. golden set; iterate prompts ≥3 rounds. Precision > recall — a wrong-but-confident claim kills trust; a gap renders as "unknown" and is fine.

**Gate:** ≥85% precision on laptop_policy + outlets; directionally correct on
wifi/noise. **Kill/pivot criteria:** precision plateaus <70% after prompt
iteration, or evidence exists for <50% of venues → rethink sourcing before
writing another line of engine code.

## Phase 1 — Engine v1 · ~1–2 weeks nights/weekends

- Productionize pipeline as jobs: ingest, extract, merge, decay/refresh scheduler.
- **Master API:** `GET /venues?lat&lng&radius&filters` (scored listings) · `GET /venues/:id` (full provenance) · `POST /observations` (speed tests, corrections, field visits) · admin re-run endpoints.
- **Eval suite runs in CI** — prompt/extraction regressions fail the build. (The showcase piece: prompts have tests like code has tests.)
- Weekly freshness job: re-mine recent reviews per venue; decay clocks tick confidence down until re-verified.

## Phase 2 — Seed + ground truth · 2–4 weekends, overlaps Phase 1

- Scale ingest to priority neighborhoods (start where Bilal actually works — best ground truth, honest marketing).
- **Field loop:** Bilal works from cafes anyway → structured 5-minute capture per visit (2× speed test, outlet count, policy check, photo). Agents cannot do this part; it is the moat. Target: top ~100 venues verified <30 days old.
- Launch bar: one neighborhood **done** beats all of NYC thin.

## Phase 3 — Mobile client · ~1–2 weeks

- Expo + white-label tenant config (reuse the dating-app pattern); map + list + filters + detail.
- **Trust UI is the product:** "verified 6d ago" stamps, ranges not point values ("usually 40–90 Mbps · 14 tests"), evidence quotes, explicit "unknown" states.
- One-tap in-app speed test → `POST /observations`. Ten seconds, zero typing — the only proprietary-data flywheel.
- Ship on the existing rail (EAS → TestFlight/OTA). Utility category — no dating-style App Store purgatory expected.

## Phase 4 — Launch + distribution (the actually-hard part)

- Distribution is a content grind, not engineering. The data IS the content: "5 LES cafes with measured 100+ Mbps" — posts nobody else can make because nobody else measures.
- Web mirror of listings (Next.js on Vercel, `bamware-web` pattern) to intercept the listicle SEO demand that proves this market.
- Atly's playbook (niche-map IG ads) validated the acquisition channel; our version is data-backed instead of vibes-crowdsourced.

## Phase 5 — Tenant #2: happy hour (only after the engine is proven)

- Same engine: `vertical=bar`, deal claims on `time_window`, add IG-caption evidence source.
- Entry decision made with data: run the identical spike on 50 bars, compare extraction quality per effort, and weigh the 2026 market reality (Happy Hour Map, Crawler, Cheers NYC, + ~6 more launched this year). Better monetization (bars pay for dead-hour traffic), 10× the competition.

## Open decision points

| # | Decision | Options | Lean |
|---|---|---|---|
| A | Evidence sourcing | ToS-clean free rail vs. paid scraper (~$25 pilot) | Run both in spike; let precision decide |
| B | Pilot neighborhood | Wherever Bilal works most | Bilal picks |
| C | Names | Engine repo `bamware-venue-engine`; consumer brand TBD | Post-spike (resolved: **BrewDesk**) |

## Costs (order of magnitude)

Spike <$50 · NYC-wide seed $300–600 (Places API + review corpora + LLM tokens)
· ongoing freshness ~$50–150/mo · infra ≈ free-tier scale on existing AWS.

## Risks, stated honestly

1. **Extraction accuracy plateau** → gated at Phase 0 with explicit kill criteria.
2. **Freshness economics** — data rots in months; if the re-verify loop costs >few hrs/week, shrink neighborhood scope rather than let accuracy slip.
3. **Distribution grind** — months of content work; the measured-data angle is the only cheap edge.
4. **ToS gray zone** on bulk review corpora → keep the clean rail viable as fallback.
5. **Solo nights/weekends drift** → every phase ships something usable; neighborhood-scoped milestones.

## Definition of success

- **Spike:** clears the precision gate on the golden set.
- **V1:** Bilal + ~20 real NYC remote workers reach for it over Google Maps for "where do I work today" three weeks running; 200+ venues live, top 100 verified <30 days.
