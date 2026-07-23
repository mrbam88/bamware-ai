---
name: store-submission
description: Take a Bamware app from TestFlight to App Store submission — icon, legal pages, listing-as-code via fastlane deliver, screenshots from seeded personas, review notes. Use when preparing a store submission or launching a new tenant's app.
---

# Store submission playbook (proven on Baat, 2026-07-23)

## The checklist (order matters)

1. **App icon** — Apple auto-rejects template icons. Generate from the
   brand font (the app's own @expo-google-fonts TTF in node_modules +
   PIL): 1024 icon, adaptive foreground, splash, favicon. Native
   rebuild required.
2. **Legal pages live** — ASC demands a privacy-policy URL; the app's
   Safety screen links must resolve. Pages live in bamware-web
   (`/terms`, `/privacy`), URLs in the tenant config `legal` block.
3. **Listing-as-code** — `fastlane/metadata/en-US/*.txt` +
   `fastlane/screenshots/en-US/` in the app repo; push with
   `bundle exec fastlane ios_metadata` (needs ASC_KEY_ID/ISSUER/P8_B64
   + ASC_DEMO_PASSWORD envs). New tenant = new metadata folder.
4. **Screenshots** — 6.9" (iPhone Pro Max sim, native 1320×2868 via
   `xcrun simctl io <udid> screenshot`). One size is enough; ASC
   downscales. Stage the world first (see below).
5. **Demo account for review** — a real, pre-registered account with
   matches + chats, creds in review notes. Never a personal account.
6. **UI-only rump (human, one-time):** privacy nutrition labels, age
   rating questionnaire (dating → 17+), build selection, Submit.

## Staging the screenshot world

- Use the persona cast (dating-service `pnpm seed:personas`) — never
  ad-hoc accounts. Upload real (AI-generated fictional) photos via the
  photo API to the personas who appear on camera.
- Control feed order with API pass-swipes: pass everything above the
  card you want on top. Swipes are one-way — plan the shot list first.
- Seed conversations via the messages API — write copy that shows the
  product's soul (culturally specific, warm, screenshot-length).
- Dismiss the verify-email banner (or verify the account) before
  capturing.

## Compliance notes

- UGC/dating requires block + report in-app before approval.
- Fakes/scenery must never be presented as real users in prod (FTC
  history: Match.com). See environments.md account tiers.
- OTA (EAS Update) may fix JS between submission and review — the
  production channel reaches the submitted binary.
