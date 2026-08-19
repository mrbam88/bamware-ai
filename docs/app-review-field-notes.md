# App Review field notes — 4.3(b) evidence base (as of 2026-08-19)

_Replaces the removed `app-store-rejections.md`, which asserted an unverified
"account is flagged" claim as fact. This file is facts + sourced community
evidence only. Baat's verbatim rejection text lives in STATE.md's 2026-08-04
log entry._

## What Apple's own guideline says (verbatim, [§4.3](https://developer.apple.com/app-store/review/guidelines/))

- 4.3(b): "Don't submit apps that are indistinguishable from what's already
  widely available… Certain kinds of apps, such as dating, flashlight, sound
  effects, wallpaper, simple timers, and fortune telling, are well established
  on the App Store and we will not accept new submissions unless they offer a
  meaningfully different or improved experience."
- "**Repeated submissions of this kind** may lead to removal from the Apple
  Developer Program." — the documented account-level consequence is about
  repeating the same saturated concept, not about having one rejection.

## Account standing after one rejection (community record, not Apple doctrine)

- A single rejection does not affect developer account standing; account-level
  action is reserved for repeated violations, fraud, or review manipulation.
  Longer review queues are reported for accounts with rejection history.
  ([ezscreenshots](https://ezscreenshots.com/blog/app-store-review-time))
- The move that demonstrably escalates: resubmitting the rejected concept from
  a **different** developer account. Apple correlates metadata across accounts.
  ([molfar.io](https://www.molfar.io/blog/apple-review))
- Conclusion for `mrbam88`: one dating rejection on record; a non-dating app
  starts from neutral. "The account is flagged" has no documented basis.

## What works against a 4.3(b) (sourced dev experiences)

1. **Reply in the Resolution Center** explaining why the app is not spam —
   multiple reports of the app flipping to In Review and approval after a
   plain reply. ([thread 112848](https://developer.apple.com/forums/thread/112848))
2. **Formal appeal to the App Review Board** — mixed record. A game was
   approved on appeal ([thread 773455](https://developer.apple.com/forums/thread/773455));
   a free dating app's appeal was denied with identical reasoning and the
   developer left iOS ([thread 811633](https://developer.apple.com/forums/thread/811633)).
   Apple holds the line hardest on the categories named in the guideline.
3. **Reposition the concept, don't polish it.** Cosmetic changes (icon,
   screenshots, name) almost never clear a 4.3. What works is making the
   differentiator the engine of the product — "a work-fit measurement database
   with a map," not "a café finder with scores." ([molfar.io](https://www.molfar.io/blog/apple-review))
4. **After winning an appeal**, add a review note on subsequent submissions
   saying the concern was already adjudicated, so a new reviewer doesn't
   repeat it. ([thread 112848 replies](https://developer.apple.com/forums/thread/112848))
5. What backfires: resubmitting unchanged (invites deeper scrutiny), and
   account-hopping (see above).

## Wider context

- 4.3 rejections arrive in waves and are widely reported as inconsistent;
  devs asking why competitors pass get no substantive answer.
  ([thread 750787](https://developer.apple.com/forums/thread/750787))
- Legal pressure is real but slow: DOJ monopolization suit survived Apple's
  motion to dismiss (2025-06-30, [NLR](https://natlawreview.com/article/judge-allows-justice-departments-iphone-monopolization-suit-proceed));
  developer class actions consolidated as *In re Apple App Developer Antitrust
  Litigation* (2025-09, [Cohen Milstein](https://www.cohenmilstein.com/case-study/apple-inc-ios-app-antitrust-litigation/));
  the EU DMA forced alternative distribution in Europe. None of this creates a
  right to approval on any near-term timescale. The practical toolbox is:
  submit → reply → appeal.

## Standing implications for Bamware submissions

- **Baat:** dating is named in the guideline; the concept-rejection is final in
  practice (see the denied dating appeal above). Do not resubmit or re-skin.
  The PWA remains the iOS path for the dating product.
- **BrewDesk (or any new app):** judged on its own "is this distinguishable"
  merits. Differentiator must be visible in the binary and lead the listing —
  that decides both the first review and any appeal.
- **If rejected:** reply in the Resolution Center first with the evidence
  story, then appeal. Prepare that story before submitting, not after.
- The `skills/store-submission` 4.3(b) pre-flight questions remain in force.
