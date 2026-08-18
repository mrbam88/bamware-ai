# Standing Agents — product thesis & idea bank

_Session 2026-08-15, migrated from the Claude Project 2026-08-18. Status:
**thesis settled, no idea selected yet.** Next step is customer conversations,
not code._

## The starting problem

Bilal's read: significant progress on Bamware (Baat shipped, multi-tenant rails,
MCP `create_tenant`, agent fan-out, skills IP) — but wants a **"winner"** that
makes money.

Counter-read that framed the session: **this is not an app problem, it's a
customer problem.** Every app the machine has produced so far was built for a
hypothetical user. Zero paying customers to date. The missing step in the loop is
validation, not another repo.

## The thesis: standing agents

Not "AI that answers." Software that:

1. wakes on a schedule (cron),
2. goes and looks at the world (scrapes messy public sources),
3. decides what changed,
4. decides whether *this specific customer* should care,
5. interrupts them only if yes.

**The phone is the last inch.** Push notification is the product.

### Why now

- Pre-AI, scrapers broke on every layout change and couldn't read PDFs, scanned
  notices, or Instagram captions. Agents read pages like a person.
- Pre-AI, the judgment step ("is this permit a kitchen reno worth calling
  about?") required a human at $40–80/hr. That cost put a floor under the market
  and killed everything below it. The floor is gone.
- Target the jobs where a person is *currently paid for an hour that is 80%
  transcription/formatting and 20% judgment.*

## The test: what survives "I'll just prompt an AI"

Defensible only if a chat window structurally can't do it:

1. **Awake when the customer isn't.** Value arrives unrequested.
2. **Reaches data the customer can't.** 400 filings pulled nightly, deduped
   against yesterday, cross-referenced.
3. **Remembers.** What was sent, who was called, what's open, what's due.
4. **Ends in an action, not an answer.**
5. **The customer will never operate it.** They want to be told.

**Fails the test (do not build):** one-shot document tasks — lease review,
proposal generators, mock inspections, wage notices, board packages, grant
drafting. That category is priced to zero.

**Passes:** every *watcher*.

## Why the shape is a good business

- **Inverted economics.** One nightly sweep costs the same for 1 customer or
  1,000. Marginal cost per customer is a filter query + a push.
- **It's a factory, not an app.** `sources → nightly run → normalized events →
  per-customer match rules → push`. Swap sources + rules = new product on the
  same spine. Bamware multi-tenant thesis, but each tenant has an obvious payer.
- **The demo sells itself.** Run the agent 3 weeks before customer #1, then walk
  in with a printed list of last month's real events *on their block*.

### Designed-against failure modes

- Missed alert is worse than a late one → optimize recall, position as heads-up
  service, **not** a compliance guarantee.
- Notification fatigue kills these → matching rules matter more than scraping.
- Sources change shape → alarm when a feed goes quiet, don't silently return zero.
- Avoid building supply on litigious private platforms (LinkedIn, StreetEasy,
  Yelp). Government/public data has no such problem.

## Idea bank — NYC / SMB watchers

| Idea | Payer | Why it passes |
|---|---|---|
| **Permit-and-deed lead radar** (DOB NOW filings + ACRIS deeds + 311 → contractor gets morning push of jobs near him) | Contractors, $200–400/mo | All 5 criteria. Sells **revenue, not fear**. Angi charges $50–100 for a *shared* lead |
| **Violation watchdog** (DOB/HPD/ECB-OATH/DOHMH per address) | Small landlords, restaurants | 4 of 5. Owners currently learn by mail, late |
| **City contract radar** (City Record + PASSPort → matched solicitations) | MWBE small vendors | 4 of 5. Six-figure contracts = high WTP |
| **Counterfeit monitor** (Amazon/eBay/Etsy/TikTok Shop + drafted takedowns) | Small DTC brands | 4 of 5. Red Points is enterprise-priced; low end open |
| **License/renewal sentinel** (DCWP, DOH, SLA, TLC, insurance certs) | Any licensed SMB | 3 of 5. Boring, cheap, pays forever |
| **Reseller pricing intel** (comps, market moves, underpriced buys) | Vintage shops, Depop sellers | Seller-side = real payer |
| **Sell-out intelligence** (competitor SKU/size stockouts from public HTML) | Small fashion brands | Trendalytics/Heuritech sell this to enterprise only |
| **Sample sale radar** (IG stories + newsletters → structured NYC calendar) | Sponsorship/organizers | Impossible pre-AI. Very NYC. Chicmi is mediocre |
| **The hunt watcher** (cross-site resale + markdown alerts on item/size/price) | Consumers, affiliate | Sneaker-monitor model ($30–50/mo, proven) applied to womenswear |

**First pick: permit-and-deed lead radar** — the only one selling revenue rather
than fear, and its engine is ~70% of the violation watchdog. NYC Open Data
(Socrata SODA APIs) covers DOB permits, DOB filings, ECB/HPD violations and 311
with no scraping required for v1.

## The swing: one app, all merchants

Original instinct: sell mobile apps to NYC independent salons / vintage /
import-export / pop-ups.

- **Wrong part:** nobody downloads a single store's app. That killed an entire
  2011–2015 agency wave. Shopify + Square + Instagram already beat it at $29/mo.
- **Right part:** the customer-base read — dense, underserved, often
  immigrant-owned, physically walk-in-able, culturally adjacent to Bilal.
- **The flip:** build **one consumer app where they're all tenants.** NYC
  independent retail discovery. Merchants buy reach, not software.
- **The unlock:** marketplaces die of cold start; agents break it. A vintage
  store's inventory already exists as Instagram posts — agents ingest photos and
  extract item/brand/size/condition/price, standing up a searchable catalog for
  ~300 shops **with zero merchant signups.** Launch full, not empty. Then:
  *"you're already in here, 40 people saved your jacket last week — claim it?"*
- **Risks:** marketplace > watcher in difficulty; consumer retention is the gate;
  IG dependency is fragile → convert merchants to first-party uploads fast.

Related: `docs/atly-teardown.md`.

## On "the app business is dying"

Half true. **The app-as-product business is dying** — App Store discovery is
closed, paid downloads are gone, and now that AI makes the artifact cheap, the
artifact stopped being scarce.

**Mobile-as-the-surface-for-a-service is not.** What still works: apps where the
phone is the only viable surface (camera, location, background, push); B2B
verticals where distribution is a sales conversation, so App Store discovery is
irrelevant; consumer apps distributed by community or density rather than search.

Reframe: **the app is a thin client for a service that lives on the backend.**
Value = agents + accumulated data + memory + relationship. iOS depth is an edge
in *delivery*, not in *product*.

## Next actions (nothing here is code)

- [ ] Pick one watcher (recommend: permit lead radar)
- [ ] Spec it: sources, nightly agent loop, matching model, app screens, pricing,
      first-ten-customer script
- [ ] Run the agent 3 weeks with **zero** customers to accumulate a demo dataset
- [ ] Ten walk-in conversations. Three "I'd pay for that" = green light
- [ ] Only then: build on existing Bamware rails as a new tenant
