# Atly teardown (from Bilal's onboarding screenshots, 2026-08-05)

_Migrated from the Claude Project 2026-08-18. Feeds BrewDesk positioning and its
4.3(b) defense — see `docs/app-store-rejections.md`._

Bilal ran Atly's full funnel (bought annual $49.99 — cancel trial by day 7!) and captured 13 screens. Key findings:

## Architecture (inferred from their own onboarding story)
1. Review corpora at scale ("powered by millions of opinions")
2. Aspect-based LLM extraction → per-aspect scores ("9.4 Coffee quality", "9.7 Work friendly") + trait chips (Quiet, Warm vibe, Consistency)
3. Query-contextual matching — pins re-score per intent ("9.5 match for Bar"); detail pages: "What to expect — based on what you searched for" + LLM summaries with bolded evidence phrases
4. Score-forward map UI: emoji-category pins with scores, bottom-sheet category chips, sub-filter chips, trending collections
- Two editions at launch: "Atly" vs "Atly Gluten Free" → multi-tenant/white-label single codebase (bamware thesis in production)
- Cafe sub-filters include: Wifi, Work Friendly, Digital Nomad, Cozy. Bar sub-filters include Happy Hour. → BOTH bamware venue-engine verticals exist as chips inside Atly. Loud validation.

## Funnel
Tailor → paywall → purchase → account creation (monetize before product). Paywall: 30%-off countdown timer, "183 joined today", laurels ("No.1 Discovery App 2026"), $4.17/mo framing of $49.99 annual, Monthly shown as "$120 per year" to anchor Annual. Converts; breeds distrust.

## Weaknesses (= our wedge, receipts in screenshots)
- Score inflation: every venue 8.4–9.9 → scores carry no information
- Zero provenance/freshness on any number; black-box "match" scores
- Opinion-mined only — no measured data (their "Work friendly 9.7" has never seen a speed test)
- Staleness: top Bar match (124 Old Rabbit Club, 9.5) shown CLOSED at recommendation time
- Breadth over depth: all categories/cities; any single job (work-cafe) is chip-deep

## "Better" for bamware-cafe
Measured Mbps + test counts vs vibes; visible provenance ("verified Xd ago · N tests"); honest unknowns; calibrated scores (confidence-blend already prevents score soup); open-now-aware ranking; free/cheap vs $50 hard wall. Steal the good UX: aspect chips, query-contextual match framing, chaos→clarity onboarding, collections, category bottom sheet. No copied assets/name/copy (also 4.3(b) insurance).

## Plan impact
Resurrect Phase 0 review-mining extraction spike (now market-validated as the moat). Order: SwiftUI client vs live engine (interview) → extraction spike on golden-set neighborhood → query-contextual match score as v2. Atly-style map screen (score pins + bottom-sheet chips) = next client milestone + strong SwiftUI portfolio piece.
