# BrewDesk game plan — after approval (written 2026-09-16)

Order of work is Bilal's (2026-09-12): **product polish → marketing → money.**
Marketing will focus on NYC. Everything here is $0 unless marked. Sources: open
tickets on all five repos, `bamware-brewdesk/docs/product-critique-2026-09-12.md`,
`bamware-venue-engine/docs/research/nyc-data-improvement-2026-09.md`, and a sweep
of parked ideas across the docs. Status: **proposed, awaiting Bilal's cut.** No
tickets filed from this yet.

## Where we are

- App: live on the App Store since 2026-09-12. Zero commits since approval.
- Data: NYC depth sprint landed 09-15/16 (researched laptop policy 21 → 59 of the
  top 200, seating 0 → 56, top score 72 → 85). The app does not show the benefit
  yet: every unobserved venue prints a flat 52.
- So the app is the bottleneck, not the backend.

## Time-sensitive, Human-only

1. **Google Play key registration — deadline 2026-09-30.** Register
   `io.bamware.brewdesk` + signing key in Play Console (~5 min). Unregistered
   apps are removed from Play after that date.
2. venue-engine#19: paste the Vercel log-retention evidence (slot is waiting).

## Release 1.0.1 — "Trust fix" (this week, all Agent-ready, $0)

The four bugs and the one display rule that makes the new data visible.
- Bugs from the critique: map loses every pin after clearing search; search text
  persists and appends across relaunch; search does not pan the map to the
  result; blank tiles on the "Use Union Square instead" path.
- **No score for unobserved venues.** Show "Not checked yet" instead of 52; sort
  them below observed venues, by distance.
- Refresh the bundled cold-start snapshot (`scripts/refresh-venue-snapshot.sh`).
- System review prompt after a save (0 ratings today).
- brewdesk#142 (name shown twice, ISO dates), #154 (lat/lng off the query
  string — keeps the privacy claim true), #156 (stale comments).

## Release 1.1 — "Useful every day" (next ~2 weeks, $0)

- Walking minutes + open-now on every card.
- Detail leads with a plain-English verdict built from claims; score becomes a chip.
- Colorblind-safe pins (shape/number or blue–orange) + dark-mode pass.
- Onboarding: one page plus the location choice.
- Business info wired in (website/phone) — merge-ready code already exists per
  `venue-engine/docs/business-info.md`; today 0/200 venues show a website.
- Laptop-policy time windows visible ("laptops OK weekdays before noon").
- Data, in parallel on the engine: ve#81 (free press hunt for hollow famous
  cafés), ve#82 (persist path for agent findings), OSM re-import with the
  Wi-Fi / outdoor / laptop tags, NYC open-data ingest (libraries, POPS),
  laptopfriendly.co's 92 NYC listings.

## Release 1.2 — "Community on" (the forgotten good ideas live here)

Everything below is already built or specced and gated OFF.
- Open the store gate: **Rate this visit** (highest-trust source we have),
  community photos, bylines, report/block.
- **One-tap in-app speed test** → observation. The original differentiator, cut
  from v1; the only proprietary-data flywheel we have. Endpoint exists.
- You tab says why an account is worth having before it asks for a password.
- Prerequisites: durable storage for community photos (Vercel FS is read-only
  today), `ADMIN_KEY` in Vercel, privacy label stops being "Data Not Collected".
- Rides on this: bathroom codes (brewdesk#97), imported favorites feeding the
  engine (#115), "claim your café" owner form (not filed; `owner` source exists).

## Marketing (after 1.1 ships, NYC-first)

- bamware.io still sells a dating app and a studio: web#25, #26, #28, #29, #30.
- Store subtitle rewrite ("NYC WFH cafés, with evidence" undersells libraries/parks).
- brewdesk-web as the SEO door: neighborhood pages and data-backed lists
  ("Union Square cafés where laptops are welcome all day").
- Launch posts: Product Hunt, r/nyc, r/AskNYC, r/digitalnomad, HN, LinkedIn.
- Android: decide the 12-tester route, then flutter#47/#48 polish. Not before.

## Money (last)

- BrewDesk Plus (brewdesk#120): sync, staleness alerts, speed-test history. Local
  saves free forever. Needs accounts from 1.2.
- Push epic (brewdesk#92): needs the APNs key (Human-only) and accounts.
- Seed-on-demand goes live (ve#44) once a second city matters. ~$0.05/10 venues.

## Parked on purpose

Happy-hour vertical (tenant #2), conversation prototype (tag kept), Atly-style
per-query match score, LangGraph, white-label BrewDesk, AI usage dashboard
(web#12), paid photo backfill for 30 venues, monthly photo-label drift check.

## Open decisions for Bilal

1. Approve 1.0.1 scope as written? (Then tickets get filed and work starts.)
2. Photo-cost mitigation is an OPEN decision in
   `venue-engine/docs/photo-serving-economics.md` — free tier ends near 66
   photo views a day, which marketing will blow through. Decide before launch posts.
3. First paid research batch for ve#81 if the free press hunt stalls
   (~$0.05–0.15, quote-and-confirm).

## Rules that constrain all of it

$10/month data cap; anything over $20 is a STOP; no ad spend; no paid venue
placement; Saved never paywalled; never store raw Google/Foursquare fields;
Yelp rejected twice; never fabricate a claim; release-branch flow only.
