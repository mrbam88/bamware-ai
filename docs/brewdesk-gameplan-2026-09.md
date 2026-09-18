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

## Release 1.1 — "Accounts & alerts" (DECIDED by Bilal, 2026-09-18)

Reassessment on 2026-09-18: the card polish list was "fluffy"; with zero
users, the next big thing is the account baseline we gated off for the
submission, plus push notifications and alerts. Live "right now" signals and
the speed test are parked (Bilal reads them as marketing-adjacent, not
baseline). Community contributions count as baseline boilerplate.

**Already built, gated OFF (`STORE_SURFACE_GATED`):** accounts (email +
password, sign-out, in-app deletion with E2E test, bd#139), report/block,
"Rate this visit" observation form, contributor bylines, Apple 1.2 pack
(bd#48). **Push:** local nudges (bd#93), APNs registration in the app
(bd#94), device registry + weekly nearby-updates digest on the engine
(ve#34) — all merged; only the APNs key / SNS platform app (infra#7,
Human-only) is missing.

**Scope, in order:**
1. Open the gate for good: remove the store-surface gate from the release
   flow; privacy label moves off "Data Not Collected" (email, user content,
   device token) — review notes and the 1.2 evidence updated to match.
2. Account worth having: the You tab explains sync + alerts BEFORE asking
   for a password; sign in with Apple added (4.8 requires it once any
   third-party login exists; email stays); optional fourth onboarding page
   with a real "skip".
3. Saved spots sync: new engine endpoint (`/v1/users/me/saved`, token from
   bamware-auth-service) + a server-backed `SavedVenuePersisting` adapter;
   local saves stay free and unlimited forever (bd#120 rule).
4. Alerts on top of push: (a) weekly nearby-updates digest (exists, needs
   the key), (b) "a spot you saved changed its laptop policy / hours",
   (c) "new researched spot near your saved ones"; a notifications settings
   screen with per-type toggles. Content rules: never marketing pushes.
5. Community on: photos (durable storage first — Vercel FS is read-only;
   reuse the dating-app S3 presign rail), ratings feed scoring, bylines,
   moderation queue with `ADMIN_KEY` in Vercel.
6. Lists and notes on saved spots (cheap once sync exists).
7. Auth-service hardening before any of this ships: cold starts (auth#7),
   token refresh (auth#8).

**Decided 2026-09-18 (Bilal):** focus on account creation, account
management, onboarding, and the basics first. **Both Google and Apple
sign-in.** Consequences: Sign in with Apple is mandatory alongside Google
(Guideline 4.8), Google Sign-In becomes the first third-party SDK in the
binary, bamware-auth-service must verify Google ID tokens and Apple identity
tokens (cross-repo contract, Bilal gate), and the privacy label lists email +
name. Email/password stays as the third option.

**Human-only inputs:** infra#7 APNs key + SNS platform app; Google Cloud
OAuth client IDs (iOS + server) and Apple Sign-In capability in the App ID;
privacy-label wording sign-off; `ADMIN_KEY` in Vercel.

**Parked (was "1.1 Useful every day"):** distance/open-now on cards,
verdict hero, colorblind-safe pins, one-page onboarding, business info
wiring, time windows. Fold into releases as filler, not a phase.

**Parked (was "1.2 Community on" extras):** one-tap speed test, live
"right now" layer, bathroom codes, owner-claimed listings, imported
favorites feeding the engine.

## Marketing (after 1.1 Accounts & alerts, NYC-first)

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
