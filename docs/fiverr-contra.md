# Fiverr + Contra profiles (marketing campaign, 2026-09)

Owner: Bilal. Started 2026-09-22 in Cowork. Media pack: `docs/marketing-media.md`.
Positioning and copy are decided; the work left is data entry on the two sites.
Never mention Baat. Location is "New York" only.

## State (2026-09-24)

| Site | Status | Next action |
|---|---|---|
| Fiverr `fiverr.com/mrbam8` | **2026-09-24: profile + Gig A DONE and verified by reload.** Profile: title, About, skills, 6 work-experience rows (companies "Pending" Fiverr approval). Gig A: title, iOS App Development service type, metadata, tags, 3 packages, description, 5 FAQs, gallery (logo + process + mockup, hero video under Fiverr review, case-study PDF). Gig still PAUSED. | Bilal: review + unpause Gig A; make the mockup the primary image (drag, or delete the logo tile — Fiverr has no "set primary"); reply to the 3 buyer messages. Portfolio "BrewDesk" project NOT saved: Fiverr requires duration, cost and start month/year — need Bilal's numbers. Then Gig C, Gig B. |
| Contra `contra.com/bilal_malik_g87cbt2p` | 11% complete = invisible in search. Headline has a typo ("Experience mobile app developer"). | Headline, bio, rate, timezone, languages, social links, featured media, 4 work items, services. Identity/wallet verification is Bilal-only. |
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
saves; a failed save resets the form.

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

**Portfolio:** one project "BrewDesk" (name, industry Mobile App Development, description, 3 images + hero video). Blocked on required duration, cost, start month/year.

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
| Price | $200 | $2,500 | $6,000 |
| Delivery | 3 days | 21 days | 45 days |
| Scope | 45-min call, written scope, screen list, architecture and a fixed quote. Credited to a build. | Up to 5 screens, one backend hookup, a TestFlight build on your phone, and full source code. | Up to 10 screens, backend, sign-in, push, App Store submission and 2 weeks of launch fixes. |
| Revisions | 1 | 2 | 3 |
| Checkboxes | iOS app (forced), app design | + icon, splash, backend, source code | + app submission |

FAQ (live): Do I own the code? · Do you need my Apple developer account? · Can you build for Android too? · Do you use AI? · Can we talk before I order?

Gallery (live): Bamware logo (primary), process image, phone mockup; video `brewdesk-hero-16x9-fiverr.mp4` (under Fiverr review); document `brewdesk-case-study.pdf`.

### Gig B (new)

Title: `I will build a React Native app for iOS and Android with Expo`
Tags: react native, expo, cross platform app, mobile app development, typescript
Same description with SwiftUI → React Native + Expo; keep the BrewDesk paragraph. Prices $200 / $2,000 / $5,500.

### Gig C (new, the review-builder)

Title: `I will review, fix or finish your iOS or React Native app`
Tags: bug fix, code review, ios app, react native, app maintenance
Basic $100 / 3 days: code review of one repo, written report with fixes ranked.
Standard $350 / 7 days: fix up to 3 bugs or add one small feature.
Premium $900 / 14 days: take a stalled app to a working TestFlight build.

Order: reply to messages → profile → Gig A → Gig C → Gig B.

## Contra

Headline: `Lead iOS & React Native engineer · Shipped BrewDesk to the App Store`
Rate: $150/hr (Bilal to confirm). Timezone Eastern. Languages English.
Links: bamware.io, github.com/mrbam88, linkedin.com/in/bilal-malik-797abb35, App Store id 6802930990.
Featured media: `brewdesk-hero-16x9-contra-header.mp4` (or `brewdesk-mockup-1600x1200.png`).

Bio:

> Lead mobile engineer, 15+ years, based in New York. I run Bamware, a small studio that pairs senior iOS and React Native craft with AI agents, so work moves fast without cutting corners.
>
> Latest proof: BrewDesk, a SwiftUI app that helps remote workers find cafés they can work from. I designed it, built it, wrote the backend and got it through App Review. It's live on the App Store now.
>
> Before that I led mobile teams at FreedomCare and Photobucket, shipped a health records app used by over a million patients, and owned architecture across mobile, backend and cloud (AWS, Terraform, Node).
>
> How I work: scope first, fixed sprints, TestFlight builds you can try as we go, and clean documented code in your own repo. No lock-in. Message me with a short description of your app and I'll come back with a plan and a fixed price.

Four work items (Contra needs 4): (1) BrewDesk case study, (2) Venue Engine backend, (3) Bamware multi-agent studio (public bamware-ai), (4) bamware.io site.

Services: App plan $200 · iOS MVP build from $2,500 · Ship it from $6,000 · Senior mobile engineer retainer $150/hr, 10–20 hrs/week · App review & fix from $100.

After it's live: apply to Contra's expert network, reply within 24h, post weekly in the community.
