# PRD: Family trend videos ("put your parents in the video")

Status: **WAIT → GO on trigger** (2026-09-28). Owner: Bilal. Spike: #57,
evidence in `docs/video-gen-spike.md`.

## One line

People send photos of the people they love (parents, grandparents, a couple
on their anniversary). We send back a realistic, lip-synced short video of
them performing a viral trend, good enough that the family replays it and
shares it.

## Why this, why now

- **Demand is visible.** Trend clips like "Hotel Lobby" (Sept 2026) flood
  TikTok. Template apps sell them, and the market research shows the
  category is growing.
- **The cheap apps get likeness wrong.** In the spike, off-the-shelf flows
  (fal.ai hosted Wan, Kling started from an AI-generated frame) produced
  people who *almost* looked like the subjects. The founder's reaction:
  "looks a little less than the actual reference picture." Likeness is the
  product.
- **We have a working pipeline that fixes that** (details in the spike doc):
  a curated photo set → a face lock (Kling `elements`) and a real-photo start
  image → Kling v3 Pro Motion Control per person → cutouts composited into
  one shared frame over per-shot plates that follow the original camera → the
  real song.
- **Fits Bamware's rapid-MVP mode.** The hard part is built. The next step is
  a demand test, not engineering.

## User and promise

- **Buyer:** an adult child or grandchild, 20–45, on TikTok and Instagram,
  buying for a birthday, anniversary, Eid, Diwali, Christmas, a wedding or a
  retirement.
- **Subjects:** their parents or grandparents, with consent.
- **Promise:** "Your parents, the real them, in this week's trend, in 24
  hours."
- **Positioning:** a premium keepsake, not an AI toy. One video, done right,
  not unlimited credits.

## MVP (concierge; no app)

1. **Landing page** (bamware-web): three example videos, a price, an upload
   form (2–10 photos per person plus a trend pick), and a checkout (Stripe
   payment link).
2. **Fulfilment by hand** with the spike scripts: pick photos, face-lock
   crops, start images, Kling runs, composite, QA, deliver the link by email.
3. **Two to three trends at launch** (Hotel Lobby, plus one or two more).
   Each trend is set up once: driving clip, crops, per-shot plates, prompts.
4. **One free re-roll** if the buyer says a face is off.

Out of scope for the MVP: a mobile app, accounts, self-serve generation,
subscriptions, more than two people, and clips over 30 s.

## Pricing and unit economics (estimates; costs measured in the spike)

| | Per video (2 people, ~15 s) |
|---|---|
| Price | **$19.99** (web, Stripe) |
| Kling v3 Pro render: 15 s × 2 people × $0.168 | $5.04 |
| One re-roll allowance (50% of orders, one person) | ~$1.26 |
| Keyframe/plate/cutouts (local or cloud GPU) | ~$0.10 |
| Stripe fees (2.9% + $0.30) | ~$0.88 |
| **Gross profit** | **~$12.70 (64%)** |

- **Cheaper tier:** Kling v2.6 Standard at $0.07/s puts the render at $2.10,
  for ~$15.70 (78%) gross profit, if the quality holds (untested).
- **Through the App Store later** (30% / 15% small business): ~$8–10 per video.
- **Founder time:** ~20–30 min of hands-on work per video at MVP, falling
  once a trend is templated. This is the real cost until fulfilment is
  automated.
- **Comparison:** the $6.99/week template apps net $4.89 after Apple's cut
  and can lose money on heavy multi-person users (spike §6).

## Go-to-market test (1 week, < $100)

- Post 3–5 of our own examples on TikTok and Instagram (founder's account,
  with consent), with a link to the page.
- Offer 10 launch orders at $14.99 to friends, family and followers.
- Paid spend: none, or ≤ $50 on one TikTok boost after organic traction.

## Trigger (WAIT → GO)

- **GO** (build self-serve fulfilment and a real storefront): **10 paid
  orders within 14 days** of the page going live, and ≥ 7 of 10 buyers
  rating the likeness 4/5 or higher.
- **WAIT:** 3–9 orders. Change the trend or price and rerun the test once.
- **NO-GO:** fewer than 3 orders, or likeness complaints on most orders.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Copyright:** the driving footage and song belong to the artist and label | Takedowns; legal exposure once paid | MVP: private delivery only, and we tell buyers to post with the platform's licensed sound. At scale: our own driving footage and licensed or original tracks |
| **Likeness and consent:** faces of real people | Misuse, platform bans | Buyer attests to consent; family use only; no public figures; delete photos after 30 days |
| **AI disclosure rules:** App Store 5.1.2(i), EU AI Act Art. 50, C2PA | Rejection or fines | Disclose third-party AI processing; label output as AI-generated |
| **Platform risk:** Kling, CapCut or Higgsfield ship "family templates" | Price pressure | Compete on likeness quality and service; stay per-video, not a commodity |
| **Model price or availability changes** (Sora 2 API was shut down with no successor) | Costs or quality shift | Pipeline is model-agnostic (Kling, Wan Animate, fal.ai); keep two providers |
| **Founder time:** manual fulfilment doesn't scale | Caps growth | Only automate after GO |

## Open questions

1. Does Kling v2.6 Standard hold likeness well enough for the 78% margin?
2. Which trends besides Hotel Lobby have still, performance-style footage
   that composites cleanly?
3. Is the per-video price right: $14.99 launch, $19.99 regular, $29.99 for
   three people?
4. Where does fulfilment run: cloud GPU cutouts (seconds) instead of Mac CPU
   (~35 min per 10 s)?
