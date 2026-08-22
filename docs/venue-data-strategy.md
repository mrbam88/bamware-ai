# Venue data strategy — sources, pipeline, nationwide cost (ve#32)

**Date:** 2026-08-22 · **Status:** decision memo (research spike, $0 spent)
**Feeds:** implementation epic in bamware-venue-engine · **Closes:** mrbam88/bamware-venue-engine#32

## TL;DR

- **Storable-forever sources are free; store-nothing sources are expensive.** Overture Places, FSQ OS Places, OSM, and municipal open data can all be stored and served ($0). Google/Yelp forbid storing exactly the fields we need (hours/phone/website) — they are per-refresh costs forever, and Yelp's 24h cache limit kills it outright.
- **Nobody free has opening hours except OSM.** Overture and FSQ both confirmed: no hours field. OSM stays the backbone; Overture+FSQ become gap-fillers for phone/website and a dedupe/closure cross-check.
- **Pipeline: keep the ve#4 staleness-batch skeleton (plain TS). Skip LangGraph for now** — it's stable and free (1.0 GA, MIT), but its payoff (checkpointed resume, HITL, branching) doesn't match a linear batch job with a working cost ledger. Adopt-if triggers below.
- **Nationwide under $10/mo is structurally impossible with per-venue LLM research** (~$750/pass on Haiku alone = 75 months at cap). Nationwide must be: free bulk backbone (Overture/FSQ/OSM) + demand-driven LLM enrichment in active markets only.

## Baseline (measured, NYC)

From the committed Overpass snapshot 2026-07-02, 2,195 elements ([docs/business-info.md](https://github.com/mrbam88/bamware-venue-engine/blob/main/docs/business-info.md)):

| field | coverage |
|---|---|
| opening_hours | 57.0% |
| website | 51.5% |
| phone | 44.4% |
| any of three | 72.4% |
| venue matching | 99.6% (2,171/2,180) |

Gap: ~28% of venues (~610) have none of the three. Laptop-relevant attributes (wifi, outlets, laptop policy, noise) come from the ve#4 research pipeline, not any bulk source — no bulk dataset carries them.

## Source comparison

| Source | Coverage | Freshness | Fields we care about | Can we STORE it? | Cost / 10k venues | Integration effort |
|---|---|---|---|---|---|---|
| **OSM / Overpass** (current) | NYC measured above; nationwide cafes present but fill varies by city | Community-edited; we snapshot | hours **57%**, website 51%, phone 44%, outdoor seating | ✅ ODbL (share-alike; attribution shown in app) | $0 | Done (in prod) |
| **Overture Places** | 73.6M places global (2026-08-19.0 release) | Monthly releases | website, phone, email, socials, categories, `confidence`, `operating_status`. **No hours** | ✅ CDLA-P-2.0 / Apache-2.0 / CC0 — store + derive freely, attribution page | $0 | Low-med: DuckDB bbox pull over S3 (MBs for NYC), no account |
| **FSQ OS Places** | 109.3M POIs (2026-08-12) | Monthly | tel, website, email, socials, categories, `date_closed`, `unresolved_flags`. **No hours** | ✅ Apache 2.0 — store + derive freely | $0 | Low-med: fresh feed needs free portal account; frozen 2024-11 S3 drop (104.5M, 10.6 GB) is public; 4.6M-row subset ships inside Overture |
| **Municipal open data** (NYC DOHMH etc.) | Every permitted food establishment; "Coffee/Tea" ≈ 5.6% of NYC records. Big metros only | **Daily** (NYC) | name, address, phone, cuisine, lat/lng, active-status (closure by diffing) | ✅ NYC Local Law 11: no license/usage restrictions | $0 | Low per city (Socrata SODA API); ~50 cities = 1 adapter + per-city field maps; no rural coverage |
| **Google Places (New)** | Best-in-class | Live | website/phone/**hours**/rating = Enterprise SKU | ❌ Only place IDs (indefinite) + lat/lng (30 days). Hours/phone/website may NOT be stored | **~$200** ($20/1k Place Details Enterprise; 1k free/mo) — recurring, non-storable | Med + ToS-compliant use means live per-view calls |
| **Yelp Fusion** | Good US | Live | phone, hours (Base); website needs Enhanced $299/mo | ❌ 24-hour cache limit on everything except business IDs | $229/mo floor (Base, ~30k calls/mo) | Rejected — cannot seed a persistent DB |
| **ve#4 LLM research** (own pipeline) | Any venue with a website/web presence | Staleness-driven | The differentiator: wifi/outlets/laptop policy/noise + hours from venue's own site | ✅ Our data, our claims, provenance built in | **$50** Haiku / $150 Sonnet (ve#4 estimate: 1,500 in + 700 out tok/venue) | Skeleton merged (ve#4) |

Notes:

- **Overture provenance:** Meta ~58M, Microsoft 6.3M, FSQ 4.6M + AllThePlaces/BrightQuery. No OSM inside the places theme, so OSM↔Overture matching is DIY (proximity + name similarity — we already have exactly this matcher at 99.6% in `src/business-info.ts`; reuse it). Filter `confidence >= 0.6` per community QA; `categories` is deprecated Sept 2026 — build against `basic_category`/taxonomy.
- **FSQ↔Overture join** is free via `sources[].record_id` / GERS bridge files.
- **ODbL hygiene:** keep OSM-derived fields in the existing sidecar pattern (separate, attributed) rather than blending into one opaque table — keeps share-alike scope contained when mixing with CDLA/Apache data.
- **Google Enterprise math at our scale:** NYC full refresh ≈ 2,180 venues ≈ $24–44/refresh (list) *and* storing the result violates ToS; nationwide 150k ≈ **$3,000/refresh, recurring**. Confirms the ve#15 "last resort, design only" verdict.

## Pipeline architecture

| Option | What it gives | What it costs | Verdict |
|---|---|---|---|
| **Current tsx scripts** | Zero deps, already shipped (enrich-business-info etc.) | Each script hand-rolls selection/retry | Keep for one-off joins (Overture/FSQ/DOHMH ingests are batch joins, not agents) |
| **ve#4 staleness-batch skeleton** (merged) | Staleness selection, quote-and-confirm, $10 hard cap in code, per-call ledger gating, Zod parse/merge | Already written (~715 LOC, tested) | **Recommended.** This *is* the agentic pipeline — it just isn't a framework |
| **LangGraph.js** | 1.0 GA (Oct 2025), MIT, free w/o any LangSmith account, Zod-native. Buys checkpointed resume, retries, HITL interrupts, `Send` fan-out | New abstraction layer; community consensus: pays back only for HITL / multi-day resume / heavy branching; founder-case estimate ~3–4 weeks first deployment | **Not now.** Our graph is a straight line: select → research → parse → merge. p-limit + a retry helper + a JSON resume file ≈ the 20% we'd use, in ~100 lines |

**Adopt-LangGraph-if** (revisit triggers, honest ones): (a) we add a human-approval gate mid-run (e.g., Bilal reviews low-confidence claims before merge), (b) runs become multi-day/resumable across processes, (c) the pipeline grows real branching (per-source sub-agents with cross-talk). None exist today.

## Cost model (hard numbers)

ve#4 estimates: Haiku 4.5 **$0.005/venue**, Sonnet 5 **$0.015**, Opus 5 **$0.025** (1,500 in + 700 out tokens; `src/research-pipeline/cost.ts`).

| Scenario | Venues | Haiku | Sonnet | Under $10/mo cap? |
|---|---|---|---|---|
| NYC gap-fill (no-info venues only) | ~610 | **$3.05** | $9.15 | ✅ one month |
| NYC full research pass | 2,180 | $10.90 | $32.70 | Haiku: 2 monthly batches ✅ |
| One new city (NYC-sized) | ~2,000 | $10.00 | $30.00 | Haiku: 1–2 months ✅ |
| **Nationwide, one pass** | 150,000 | **$750** | $2,250 | ❌ 75 months at cap |
| Nationwide, quarterly refresh | 150,000/qtr | **$250/mo** | $750/mo | ❌ 25× the cap |
| (contrast) Google Details, nationwide | 150,000 | — | — | ❌ ~$3,000/refresh, and can't store it |

What nationwide would *really* take: either **~$250/mo** (Haiku, quarterly refresh, blanket) or a **demand-driven model** — free bulk backbone for all 150k, LLM research only on venues users actually view/search in active markets. At 2,000 researched venues/mo (Haiku, $10), demand-driven covers ~10–20 active neighborhoods' worth of fresh venues monthly — that's the cap-compatible shape.

## Recommendation — phased

**Phase 1 — NYC quality (now, $0 bulk + ≤$10/mo LLM)**
1. Overture NYC bbox pull (DuckDB, $0, no account) + frozen FSQ S3 parquet → join to existing venues via the ve#15 matcher → fill phone/website for the ~28% gap; cross-check closures via `operating_status` / `date_closed`.
2. DOHMH daily diff as closure signal (storable forever, daily cadence beats every other source).
3. ve#4 live on Haiku: staleness-batch the laptop-relevant attributes, ~$3 gap-fill first, then ~2,000 venues/mo steady state. Every run quote-and-confirmed.
   **Gate:** any-of-three coverage 72% → ≥90%; closure lag < 1 week.
**Phase 2 — 2nd city pilot (one Socrata metro: Chicago or SF)**
4. Prove the ingest replicates: Overpass bbox + Overture/FSQ join + one Socrata adapter with a per-city field map. Target: hit Phase-1 coverage numbers without new code beyond the field map.
5. LLM budget shares the same $10 cap → alternate NYC/pilot months, or this is the moment the cap decision gets revisited with data.
   **Gate:** pilot city reaches NYC-level coverage in ≤1 month of batches; ingest cost stays $0.
**Phase 3 — nationwide (only after Phase 2 gate)**
6. Backbone: Overture + FSQ nationwide cafes (storable, $0, monthly refresh) + OSM hours where present. No blanket LLM pass.
7. Demand-driven enrichment: research venues on first-view/first-search in newly active markets, hard-capped by the ledger. Blanket quarterly refresh only if/when revenue supports ~$250/mo — a pricing decision, not an engineering one.

## Sources

- Measured baseline: bamware-venue-engine `docs/business-info.md`; cost estimates `src/research-pipeline/cost.ts`; cap decision `docs/ai-data-pipeline-plan.md` (2026-08-20)
- Overture: <https://docs.overturemaps.org/release-calendar/> · <https://docs.overturemaps.org/blog/2026/08/19/release-notes/> · schema <https://docs.overturemaps.org/schema/reference/places/place/> · sources <https://docs.overturemaps.org/guides/places/> · licensing/attribution <https://docs.overturemaps.org/attribution/> · DuckDB access <https://docs.overturemaps.org/getting-data/duckdb/> · bridge files <https://docs.overturemaps.org/gers/bridge-files/> · quality sampling <https://latlong.blog/2023/08/a-look-at-overtures-data-quality.html>
- FSQ OS Places: release notes <https://docs.foursquare.com/data-products/docs/fsq-os-places-release-notes> · access <https://docs.foursquare.com/data-products/docs/access-fsq-os-places> · schema <https://docs.foursquare.com/data-products/docs/places-os-data-schema> · license <https://opensource.foursquare.com/os-places/> · public 2024-11 S3 drop <https://simonwillison.net/2024/Nov/20/foursquare-open-source-places/> · closed model <https://foursquare.com/article/fsq-places-introducing-our-improved-closed-model/>
- NYC open data: DOHMH inspections <https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j> · Local Law 11 §23-502(d) <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-130572> · Dining Out NYC <https://catalog.data.gov/dataset/dining-out-nyc-locations> · multi-city: Chicago <https://catalog.data.gov/dataset/food-inspections>, LA <https://data.lacity.org/Community-Economic-Development/Restaurant-and-Market-Health-Inspections/29fd-3paw>, King County <https://data.kingcounty.gov/Health-Wellness/Food-Establishment-Inspection-Data/f29f-zza5>
- Google Places (New): pricing <https://developers.google.com/maps/billing-and-pricing/pricing> · SKU/field mapping <https://developers.google.com/maps/documentation/places/web-service/usage-and-billing> · March 2025 change <https://developers.google.com/maps/billing-and-pricing/march-2025> · storage policy <https://developers.google.com/maps/documentation/places/web-service/policies>
- Yelp: pricing <https://business.yelp.com/data/resources/pricing/> · plans <https://docs.developer.yelp.com/docs/plans> · API terms (24h cache) <https://terms.yelp.com/developers/api_terms/20250113_en_us/>
- LangGraph.js: 1.0 announcement <https://www.langchain.com/blog/langchain-langgraph-1dot0> · pricing (OSS free) <https://www.langchain.com/pricing> · graph API <https://docs.langchain.com/oss/javascript/langgraph/graph-api> · practitioner counterpoints <https://dev.to/deadlocker/why-i-stopped-using-langgraph-4jo2> · <https://news.ycombinator.com/item?id=40739982>
