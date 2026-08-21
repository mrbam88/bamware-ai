# BrewDesk rejection response pack (brewdesk#32)

_Drafted as of 2026-08-21. Status: **awaiting Bilal's tone sign-off — nothing here
is sent anywhere automatically.** Companion to `app-review-field-notes.md`
(what works and why) and `brewdesk-go-live.md` (the verified facts these drafts
cite). Strategy per the field notes: submit → Resolution Center reply → App
Review Board appeal. Reply first; the appeal is the 4.3 escalation only._

Usage: pick the reply matching the rejection class, replace the
`[QUOTE THE REJECTION TEXT]` slot with Apple's actual message, verify no fact
has drifted since 2026-08-21, and paste into the Resolution Center. Each reply
is under 300 words.

---

## Reply 1 — Guideline 4.3(b) (design spam / saturated category)

> Thank you for reviewing BrewDesk. We believe the app offers a meaningfully
> different experience from existing café or map apps, and everything below is
> verifiable inside the submitted binary.
>
> BrewDesk is a work-fit measurement database for New York City with a map on
> top — not a café-review app. It evaluates 2,180 NYC venues specifically for
> laptop work, and every individual claim (Wi-Fi, outlets, laptop policy,
> noise) displays its source, its confidence, and the date it was last
> updated, directly in the UI. To see this: search "Housing Works", open
> Housing Works Bookstore Cafe, and view the Workability section.
>
> The complete scoring methodology is published inside the app ("How Work Fit
> is scored," reachable from the info button on Nearby): weights, confidence
> blending, and a 90-day freshness decay. Laptop policy is shown openly even
> when unflattering — venues that limit or discourage laptops are labeled, not
> hidden. Unknown values say "unknown"; estimates are labeled as estimates.
>
> No widely available app does this. The most visible app in this space, Atly,
> places opinion-mined scores behind a $69.99/year subscription with no
> source, date, or methodology on any number. BrewDesk is free, accountless,
> and contains no purchases, subscriptions, advertising, analytics, or
> user-generated content.
>
> [QUOTE THE REJECTION TEXT and address its specific claim in one sentence.]
>
> We'd welcome guidance on anything specific the reviewer found
> indistinguishable — each differentiator above is a screen we can point to.
> Thank you for your time.

[BILAL: review tone]

---

## Reply 2 — Guideline 2.1 (App Completeness)

> Thank you for the review. We'd like to address the completeness concern
> directly: [QUOTE THE REJECTION TEXT, then state the observed vs. expected
> behavior in one sentence.]
>
> Context that may resolve it quickly:
>
> The app is fully reviewable from outside New York. The dataset is
> NYC-focused by design; wherever the reviewer is located, the app shows the
> full 2,180-venue NYC dataset, anchored at Union Square, with or without
> location access. A banner explains out-of-coverage state when location is
> granted outside NYC. Location is optional — "Use Union Square instead"
> exercises the entire app without the permission.
>
> No credentials are needed: BrewDesk is free and accountless, with no
> purchases, subscriptions, advertising, analytics, or user-generated content.
>
> Before submission we ran a scripted Release-build reviewer simulation
> replaying a first session — fresh install, declining location, browse,
> filter, search, venue detail, the methodology screen, then granting
> location simulated outside NYC — asserting visible content at every step.
> Release tests also cover degraded states on every screen (backend error,
> empty results, offline, photo failures, slow responses, location denied),
> plus accessibility audits and English/Spanish navigation. The production
> service (https://venuekit-ashen.vercel.app) is live and returns JSON to
> non-browser clients; we re-verified it on our submission checklist.
>
> If the issue reproduces for the reviewer, we would be grateful for the
> device model, iOS version, and the screen involved, and we will turn a fix
> around immediately.

[BILAL: review tone]

---

## Reply 3 — Guideline 5.1 (Privacy)

> Thank you for the review. On the privacy concern: [QUOTE THE REJECTION TEXT
> and state which label/practice is questioned.]
>
> BrewDesk's App Privacy label is Data Not Collected, and the app is built so
> that this is structurally true:
>
> Location is used transiently to rank a single request and is never stored.
> The service keeps no location history and has no concept of user identity —
> there are no accounts. When the user declines location (or is outside NYC),
> the app sends only a hardcoded public landmark (Union Square) as the map
> anchor; the device coordinate is sent only when the user grants location
> inside coverage. Release-suite privacy tests assert the anchor is the only
> value sent in the declined state and audit every outgoing request against
> the label.
>
> Saved cafés are stored on-device only. The Google Takeout import is parsed
> on-device and never uploaded. The privacy manifest declares the UserDefaults
> required-reason API (CA92.1) and no data collection. There is no analytics,
> crash reporting, advertising, or third-party SDK collecting data, and no
> user-generated content.
>
> The privacy policy is linked in-app and on the App Store listing
> (bamware.io/brewdesk/privacy), and OpenStreetMap attribution is visible
> in-app.
>
> If a specific screen or request prompted the concern, we're happy to walk
> through exactly what leaves the device and why — the app's network surface
> is small and fully test-asserted.

[BILAL: review tone]

---

## App Review Board appeal letter — 4.3(b) path

_Send only after a Resolution Center reply has failed (field notes: replies
alone have flipped 4.3 rejections; appeals are the escalation, with a mixed
record). Keep the evidence list intact — it is the argument._

> To the App Review Board,
>
> We are appealing the rejection of BrewDesk — WFH Cafés (bundle ID
> io.bamware.brewdesk) under Guideline 4.3(b).
>
> Guideline 4.3(b) asks developers not to submit apps "indistinguishable from
> what's already widely available," and states that saturated categories will
> not accept new submissions "unless they offer a meaningfully different or
> improved experience." We believe BrewDesk meets that standard, on evidence
> visible in the submitted binary:
>
> 1. **Purpose.** BrewDesk answers one question — can I work from this café —
>    for 2,180 New York City venues. It is a work-fit measurement database
>    with a map, not another restaurant-discovery app.
> 2. **Per-claim provenance.** Every Wi-Fi, outlet, laptop-policy, and noise
>    claim displays its source, confidence, and last-updated date in the UI.
>    Estimates are labeled; unknowns say "unknown."
> 3. **Published methodology.** "How Work Fit is scored" is a screen in the
>    app: the weights (laptop policy > seating > Wi-Fi = outlets > noise),
>    confidence blending, and 90-day freshness decay. No black-box scores.
> 4. **Transparency against interest.** Venues that limit or discourage
>    laptops are shown openly rather than omitted.
> 5. **Business-model contrast.** Widely available apps in this space sell
>    opinion-derived scores behind subscription paywalls — the category
>    leader charges $69.99/year and shows no source, date, or methodology on
>    any number. BrewDesk is free and accountless, with no purchases,
>    subscriptions, advertising, analytics, or user-generated content.
>
> Each point can be confirmed in under a minute using the steps in our review
> notes (Housing Works Bookstore Cafe → Workability; info button → scoring
> methodology). We respectfully ask the Board to evaluate BrewDesk against the
> guideline's own test: a meaningfully different and improved experience,
> demonstrated in the binary rather than claimed in marketing.
>
> Thank you for your consideration.
>
> Bilal Malik
> Bamware

[BILAL: review tone]

---

## Fact sources (all as of 2026-08-21)

- 2,180-venue NYC dataset — `docs/ai-data-pipeline-plan.md` (place-id backfill
  2,174/2,180).
- Per-claim source/confidence/date, methodology screen, laptop-policy
  openness, Union Square anchor, Data Not Collected reasoning, privacy tests —
  `docs/brewdesk-go-live.md`; reviewer steps mirror
  `bamware-brewdesk/fastlane/review_information/notes.txt`.
- Atly $69.99/year, zero provenance — `docs/atly-teardown.md` (2026-08-19
  capture; re-verify the price before sending, it doubled once already).
- Guideline 4.3(b) verbatim text and reply/appeal strategy —
  `docs/app-review-field-notes.md`.
- Reviewer simulation and degraded-state test coverage — STATE.md entries
  2026-08-20/21 (brewdesk#26 → PR #35, #27 → PR #38, #29 → PR #39).
