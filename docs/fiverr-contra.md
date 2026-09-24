# Fiverr + Contra profiles (marketing campaign, 2026-09)

Owner: Bilal. Started 2026-09-22 in Cowork. Media pack: `docs/marketing-media.md`.
Positioning and copy are decided; the work left is data entry on the two sites.
Never mention Baat. Location is "New York" only.

## State (2026-09-24, evening)

Pricing decision (Bilal, 2026-09-24): he is new to freelancing and wants
prices that are very competitive to grow the brand, not to maximise income
at first. Same prices on both sites.

| Site | Status | Next action |
|---|---|---|
| Fiverr `fiverr.com/mrbam8` | Profile + Gig A DONE, verified by reload. Gig A repriced to $100 / $750 / $1,800 and still PAUSED. Portfolio "BrewDesk" project published (1–3 months, Aug 2026, cost field $6,000 with a note). Gig C and Gig B created as DRAFTS (all steps filled, stopped before Publish). An older draft "build full stack mobile apps" also exists, untouched. | Bilal: review and publish Gigs C and B; unpause Gig A; make the mockup the primary image; reply to the 3 buyer messages. |
| Contra `contra.com/bilal_malik_g87cbt2p` | DONE except Bilal-only steps. Headline, bio, rate $50–75/hr, featured hero video, 4 work items, 3 services live. | Bilal: verify identity and set up wallet (last item on the completion checklist). Later: apply to the expert network. |
| Upwork | Not started. Recommended as the main platform (fee 0–15%, clients post real projects). | Same copy, one profile, bid 3–5 posts/week. |
| Toptal | Not started. Apply once. | — |

Fiverr blocks automation with a "Press & Hold" check on every edit page;
Bilal clears it, the agent continues. Decisions by Bilal 2026-09-22: do
Profile + Gig A first; leave Gig A paused after the rewrite.

Fiverr gotchas (2026-09-24): profile title allows letters, numbers, spaces and
basic punctuation only (no "·" or "&") — live title is "iOS and React Native
engineer who shipped BrewDesk to the App Store". Skills come from a fixed list
(no SwiftUI/Expo/Terraform/Claude; used "iOS development", "Apple App Store",
"ai development"). Work-experience dates: pick the 15th (the 1st shifts a month
back by timezone); new companies need a website. Gig description is a Quill
editor — set it with `.ql-container.__quill.setText()`, typing "•" scrambles it.
Gig titles are lowercased by Fiverr. Press & Hold bot checks appear every few
saves; a failed save resets the form. Gallery has no "set primary"; the first
tile is primary, drag does not work by automation, and delete is permanent.

Contra gotchas (2026-09-24): work items go through "Create case study" (the
"Add work" button makes a social post). The first keystrokes after an image
upload are dropped, so check the editor text. The Details modal allows at most
3 tools. Service tag search only works after clicking outside the field between
picks, and a tag can silently drop, so check "n/9" before publishing. Work items
reorder by keyboard: focus the "Re-order project" handle, Space, arrows, Space.

Data nit seen in the pack: search results show "Jersey City Free Public
Library" twice (duplicate venue) — file on venue-engine.

## Guardrails for this copy

- "Award-winning apps" (old Fiverr About) is not in the resume — dropped.
- App Store URL goes in portfolio items only; gig text says "search BrewDesk on the App Store" (Fiverr flags outside links in gig text).
- Numbers come from `docs/marketing-media.md` and the case-study PDF; do not invent others.
- Fiverr takes 20%; Contra 0%. Same prices on both.

## Fiverr

**Profile title (live):** `iOS and React Native engineer who shipped BrewDesk to the App Store`

**About (574/600):**

> Lead mobile engineer, 15+ years, based in New York. I run Bamware, a small studio that pairs senior iOS and React Native craft with AI agents, so work moves fast without cutting corners. Latest proof: BrewDesk, a SwiftUI app I designed, built and got through App Review. It is live on the App Store now. Before that I led mobile teams at FreedomCare and Photobucket and shipped health apps used by over a million patients. I scope first, build in fixed sprints, and hand over clean, documented code you own. Message me before you order and we will agree the scope together.

**Skills (live):** removed Kafka, C++, Kubernetes, Django, CircleCI, MongoDB. Added iOS development, Apple App Store, ai development (all Pro).

**Work experience (live):** the six roles in `skills/bilal-resume` with dates and resume bullets.

**Portfolio (live):** one project "BrewDesk" (industry Mobile App Development, description, 3 images + hero video, 1–3 months, Aug 2026). The older Bamware project still says "award-winning"; offered to edit it, not yet approved.

**Intro video:** `brewdesk-hero-9x16.mp4` until Bilal records a talking one.

### Gig A (live, paused)

Title: `I will build your iOS app in SwiftUI and ship it to the App Store`
Category: Programming & Tech > Mobile App Development > iOS App Development. App type: Native. Languages Swift, Objective-C. Frameworks SwiftUI, UIKit, Node.js. Tools Xcode, Firebase, Supabase.
Tags: swiftui, ios app development, iphone app, app store, ios developer

Description (1082/1200):

> I build native iOS apps in SwiftUI and take them all the way to the App Store. My own app, BrewDesk, is live there now. I designed it, built it, wrote the backend and got it through App Review. Search "BrewDesk" on the App Store to see the quality you will get.
>
> WHAT YOU GET
> • A written scope and plan before any code, so there are no surprises
> • Clean SwiftUI code with tests, documented, in your own GitHub repo
> • TestFlight builds on your phone as we go
> • App Store submission help, including the review notes that get apps approved
> • Proof, not promises: BrewDesk went through 30 TestFlight builds and App Review with no rejection
>
> HOW I WORK
> I run Bamware, a small studio: 15+ years of senior mobile work plus AI agents that speed up the slow parts. You get one accountable engineer, fixed-scope sprints, and code you fully own. No lock-in.
>
> GOOD FIT FOR
> Founders with a clear idea, teams that need a senior iOS hand, and apps with maps, accounts, payments, chat or health data.
>
> Message me first with a short description of your app and I will reply with a scope and a fixed price.

Packages (live):

| | Basic — App plan & fixed quote | Standard — MVP build | Premium — Ship to the App Store |
|---|---|---|---|
| Price | $100 | $750 | $1,800 |
| Delivery | 3 days | 21 days | 45 days |
| Scope | 45-min call, written scope, screen list, architecture and a fixed quote. Credited to a build. | Up to 5 screens, one backend hookup, a TestFlight build on your phone, and full source code. | Up to 10 screens, backend, sign-in, push, App Store submission and 2 weeks of launch fixes. |
| Revisions | 1 | 2 | 3 |
| Checkboxes | iOS app (forced), app design | + icon, splash, backend, source code | + app submission |

FAQ (live): Do I own the code? · Do you need my Apple developer account? · Can you build for Android too? · Do you use AI? · Can we talk before I order?

Gallery (live): Bamware logo (primary; Bilal to swap for the mockup), process image, phone mockup; video `brewdesk-hero-16x9-fiverr.mp4` (under Fiverr review); document `brewdesk-case-study.pdf`.

### Gig C (draft, the review-builder)

Title: `I will review, fix or finish your iOS or React Native app`
Tags: bug fix, code review, ios app, react native, app maintenance
Basic $50 / 3 days: code review of one repo, written report with fixes ranked.
Standard $150 / 7 days: fix up to 3 bugs or add one small feature, with tests.
Premium $400 / 14 days: take a stalled app to a working TestFlight build.
Category: Mobile App Maintenance > Mobile App Bug Fixes. Hours 1/6/20, revisions 1/2/2, source code on Standard and Premium. 4 FAQs, 1 requirement question. Gallery: `svc-fix-1280x769.png` (primary), mockup, process; hero video; case-study PDF.
Copy: same as the Contra service "Review, fix or finish your iOS or React Native app".

### Gig B (draft, the social app starter)

Replaces the earlier plain React Native gig. Title (live): `I will launch your social app with chat, profiles and matching in React Native`. Category: Mobile App Development > Cross-platform. Tags: react native, social app, chat app, app template, dating app. Fiverr needs at least $100 per package in this category.
Rebrand $150 / 5 days: name, colors, logo and fonts, full source, running on the client's phone.
Launch-ready $500 / 14 days: plus backend deployed to the client's AWS account, iOS and Android test builds.
Custom $1,200 / 30 days: plus up to 2 custom features and App Store submission prep.
Gallery: `starter-1280x769.png` (primary; matches + chat screens only, no faces), then the BrewDesk mockup. Revisions 1/2/3. 4 FAQs (incl. "Is this app already on the App Store?" → No; "Will Apple approve my app?" → no one can promise). Copy: same as the Contra service.
Guardrails: never say it is on the App Store or open source; keep the honest App Review note (Apple rejects plain copies in crowded categories; shape it around a niche; the client publishes from their own developer account); the app is not named.

Order: Gig C → Gig B.

## Contra

Headline (live): `Lead iOS & React Native engineer · shipped BrewDesk`
Rate (live): $50–75/hr. Timezone Eastern. Languages English.
Links: bamware.io, github.com/mrbam88, linkedin.com/in/bilal-malik-797abb35, App Store id 6802930990.
Featured media (live): the BrewDesk hero video.

Bio:

> Lead mobile engineer, 15+ years, based in New York. I run Bamware, a small studio that pairs senior iOS and React Native craft with AI agents, so work moves fast without cutting corners.
>
> Latest proof: BrewDesk, a SwiftUI app that helps remote workers find cafés they can work from. I designed it, built it, wrote the backend and got it through App Review. It's live on the App Store now.
>
> Before that I led mobile teams at FreedomCare and Photobucket, shipped a health records app used by over a million patients, and owned architecture across mobile, backend and cloud (AWS, Terraform, Node).
>
> How I work: scope first, fixed sprints, TestFlight builds you can try as we go, and clean documented code in your own repo. No lock-in. Message me with a short description of your app and I'll come back with a plan and a fixed price.

Work items (live, in this order): (1) BrewDesk: native iOS app, live on the App Store; (2) Social app starter: matching, chat, profiles; (3) Bamware AI studio: agents that build, test and ship (links the public bamware-ai repo); (4) bamware.io: launch site and web backbone for BrewDesk. Covers were generated in the brand (graphite + lime); the site cover is a screenshot of bamware.io.

Services (live):
- iOS app in SwiftUI, built and shipped to the App Store: from $750, 3 weeks. Description lists Plan $100 / MVP $750 / Ship it $1,800.
- Review, fix or finish your iOS or React Native app: from $50, 3 days. Lists $50 / $150 / $400.
- Social app starter: your own matching and chat app: from $150, 5 days. Lists $150 / $500 / $1,200 and the honest App Review note.

After it's live: apply to Contra's expert network, reply within 24h, post weekly in the community.
