# App Store rejections — the permanent record

Binding on every future submission. Read before any `store-submission` run.
Never re-litigate a rejection from memory; the verbatim text is here.

## 2026-08-04 — Baat v1.0 (6) — Guideline 4.3(b) Design: Spam

- **Submission ID:** `029740e2-f219-407d-b065-996ada511f12`
- **Review date:** 2026-08-04
- **Review device:** iPad Air 11-inch (M3)
- **Version reviewed:** 1.0 (6)

### Verbatim

> **Guideline 4.3(b) - Design - Spam**
>
> **Issue Description**
>
> The app primarily includes dating features that duplicate the content and
> functionality of similar apps that are already widely available.
>
> These app features may be useful, informative or entertaining, and the app may
> include features or characteristics that distinguish it. However, there are
> already enough of these apps on the App Store.
>
> **Next Steps**
>
> We encourage you to reconsider the app concept and submit a new app that
> provides a unique experience not already found on the App Store.
>
> **Resources**
>
> - You may consider creating a web app, which looks and behaves like a native
>   app when the user adds it to their Home screen. See Configuring Web
>   Applications for more information.
> - To learn more about our policies for saturated app categories, see
>   guideline 4.3.

### What it means

- **Concept rejection, not a bug.** Nothing in the binary clears it. Apple
  pre-empted the differentiation argument inside the rejection text.
- **Baat is dead as a native iOS app.** No resubmission of the concept, no
  re-skin, no appeal on feature merits.
- Apple's own suggested remedy is a **web app / PWA**. That is the only
  surviving iOS path for the dating product.
- The backend, auth, infra, and the whole EAS→TestFlight→`fastlane deliver`
  rail are unaffected and remain the reusable assets.
- **`mrbam88` now carries a 4.3(b).** Assume heightened scrutiny on every
  subsequent submission from this account.

## Binding rules for future submissions

1. **Never ship into a saturated category from this account.** Non-exhaustive:
   dating, weather, to-do, flashlight, QR scanner, calculator, wallpapers,
   soundboards, prayer times, basic transit, habit trackers, generic AI chat
   wrappers.
2. **The differentiator ships in the binary.** A unique dataset or capability
   that exists only on the roadmap is not a 4.3 defense. Reviewers see the build.
3. **The differentiator is visible in the listing** — description, screenshots,
   review notes. 4.3 is judged on the store page as much as on the app.
4. **Best defense is proprietary data or function** that provably is not on the
   store. Second best: a category with no incumbents.
5. **No two Bamware apps may be near-duplicates of each other.** Same-account
   duplicates are the fastest route to a second 4.3(b).
6. **Review happens on iPad** (this one: iPad Air 11-inch M3). Verify the build
   launches and renders sanely in iPad compatibility mode even when
   `UIDeviceFamily=[1]`.

## 🔴 Open risk — BrewDesk

BrewDesk is a cafe finder. Atly and several wifi/work-cafe finders already ship.
That is adjacent-to-saturated, and per `docs/brewdesk-go-live.md` v1 **removed
the speed test from the UI** — the measured data was the entire 4.3 defense and
it is not in the v1 binary.

**Do not submit BrewDesk as a map + filters app from this account.** One of
these must be true first:

- measured or verified data is back in the binary and visible in the UI
  (provenance stamps, "verified Nd ago", test counts), **or**
- the curated NYC dataset with visible provenance is demonstrably the product,
  and the listing leads with it rather than with "find cafes"

The positioning rewrite already flagged in STATE.md (2026-08-06) is necessary
but **not sufficient** — the listing has to describe something the binary does.

## Implication for the two-app goal (1 SwiftUI + 1 RN)

The RN app is selected for 4.3 survivability first, product second: no UGC, no
accounts, no IAP in v1, and a category with no incumbents. Reuse from
`bamware-dating-app` is the **rail**, not the app — EAS→TestFlight, fastlane
deliver, OTA channels, CI/CD, tenant config + theme engine, push + deep links,
screenshot automation, privacy labels. Strip auth, onboarding, chat, profiles,
and paywall; each is review surface area.
