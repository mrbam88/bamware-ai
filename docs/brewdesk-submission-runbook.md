# BrewDesk submission runbook — main → Submitted (brewdesk#33, document half)

_Drafted as of 2026-08-21. This document is the runbook; **execution is
human**. Steps marked [BILAL ONLY] must not be performed by an agent. Starting
state: 1.0 (2) is VALID and IN_BETA_TESTING (built from
`bamware-brewdesk@7bb2109`, uploaded via Xcode cloud-managed signing);
approval-lane PRs #35/#38/#39 merged to main 2026-08-21._

Record evidence for every step in `docs/brewdesk-go-live.md` (results) and
STATE.md (milestones).

---

## 0. Preconditions (before cutting anything)

- [ ] All approval-lane PRs intended for 1.0 (3) are merged to
      `bamware-brewdesk` main (check board: #34 stat strip, #36 a11y, #30
      screenshots as applicable). `gh pr list -R mrbam88/bamware-brewdesk`
      shows nothing pending for the release.
- [ ] CI green on main: `gh run list -R mrbam88/bamware-brewdesk -b main -L 5`
- [ ] Final metadata/screenshots committed under `fastlane/metadata` and
      `fastlane/screenshots` (five opaque 1320×2868 screenshots; listing copy
      is evidence-first per go-live).

## 1. Go/no-go gates (submission morning)

Quoted verbatim from brewdesk#33 ("Go/no-go gates added 2026-08-21"):

> Run ALL on submission morning — any red = no submit:
>
> - [ ] **Vercel protection sane**: via API, `ssoProtection.deploymentType ==
>   "preview"` and attack mode disabled (it has self-enabled before and serves
>   challenge HTML to non-browser clients — i.e. to the app and to App
>   Review). Then one live non-browser probe: `/v1/health` returns 200 JSON
>   and `/v1/venues/curated-gregoryscoffee/photos` returns JSON, from a clean
>   IP.
> - [ ] **Console spend caps set**: Anthropic monthly limit + Google Places
>   quota (Bilal, ~2 min) — confirms a mid-review quota-empty-gallery
>   surprise can't also become a billing surprise.
> - [ ] **Signing path decided**: either the distribution `.p12` is exported
>   into the protected GitHub `production` environment (human-only, enables
>   CI uploads from any machine), OR manual Xcode upload from Bilal's Mac is
>   explicitly accepted for 1.0(3) and the single-machine debt gets a line in
>   bamware-ai STATE.

Probe commands for gate 1 (production base URL per review notes):

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://venuekit-ashen.vercel.app/v1/health
curl -sS https://venuekit-ashen.vercel.app/v1/health          # expect JSON, not challenge HTML
curl -sS https://venuekit-ashen.vercel.app/v1/venues/curated-gregoryscoffee/photos | head -c 200
```

Spend caps (gate 2): Anthropic console monthly limit + Google Places quota to
match the $10/month data cap decided 2026-08-20
(`docs/ai-data-pipeline-plan.md`). [BILAL ONLY — console access]

## 2. Cut and upload 1.0 (3)

Two paths per `bamware-brewdesk/docs/RELEASING.md`; gate 3 above decides.

**Path A — Xcode cloud-managed signing from Bilal's Mac (the path builds 1
and 2 used):**

1. `git -C ~/code/bamware-brewdesk pull` — build from current main; note the
   commit SHA for the record.
2. Open `BrewDesk.xcodeproj`, scheme **BrewDesk**, destination **Any iOS
   Device (arm64)**; set build number to 3 (marketing version stays 1.0).
3. Product → Archive; in Organizer: Distribute App → App Store Connect →
   Upload, authenticated with the Team ASC API key, cloud-managed
   distribution signing.
4. Wait for processing; App Store Connect must report **VALID** for 1.0 (3).

**Path B — fastlane CI (only if the `.p12` + secrets land in the protected
`production` environment; secrets table in RELEASING.md):**

```bash
gh workflow run testflight.yml --repo mrbam88/bamware-brewdesk
gh run watch --repo mrbam88/bamware-brewdesk
```

The `ship_testflight` lane auto-increments to the next build number (latest
TestFlight build + 1 → 3) and waits for processing.

## 3. TestFlight smoke — physical iPhone [BILAL ONLY — device]

Install 1.0 (3) from TestFlight on the physical iPhone (build 2 was never
device-tested; do not carry credit over). Checklist:

**Location permission matrix (go-live item 2 — the one item only a physical
device proves):**

- [ ] **Allow** (While Using): nearby ranking uses device location inside
      coverage; outside NYC the out-of-coverage banner shows and the map
      stays on the NYC dataset
- [ ] **Deny**: full app works; "Use Union Square instead" path; ~full NYC
      dataset anchored at Union Square
- [ ] **Restricted** (Settings → Screen Time → Content & Privacy → Location
      Services off for the app): app degrades to the anchor path, no crash
- [ ] **Previously granted, then revoked in Settings**: app notices the
      change on return, no stale state or crash

**General smoke:**

- [ ] Fresh-install first session: browse map/list, search, filter, venue
      detail, Workability provenance, methodology screen
- [ ] Save a café → relaunch → still saved (local persistence + rehydration)
- [ ] Directions and native Share from a venue
- [ ] Photo gallery loads; attribution visible in fullscreen
- [ ] English and Spanish UI; Dynamic Type at a large size; VoiceOver
      spot-check
- [ ] Airplane mode: offline states are intentional, not blank
- [ ] Google Takeout import parses on-device

Record results (pass/fail per line + device/iOS version) in
`docs/brewdesk-go-live.md`.

## 4. fastlane deliver dry-run (final metadata/screenshots)

From the `bamware-brewdesk` repo root, with ASC API-key auth:

```bash
fastlane precheck --app_identifier io.bamware.brewdesk   # metadata guideline scan
fastlane deliver --app_identifier io.bamware.brewdesk \
  --skip_binary_upload true \
  --metadata_path fastlane/metadata \
  --screenshots_path fastlane/screenshots
```

`deliver` generates an HTML preview and prompts before touching App Store
Connect — the preview **is** the dry-run artifact. Review it against the
locked v1 copy; abort to stay dry, confirm to push metadata/screenshots.
Review notes come from `fastlane/review_information/notes.txt` (no demo
credentials — the app is accountless).

## 5. App Store Connect questionnaires [BILAL ONLY — ASC]

Per brewdesk#31; record each decision in `docs/brewdesk-go-live.md`.

- [ ] **Primary/secondary category** — see `docs/brewdesk-category-memo.md`
      (recommendation: Productivity primary, Food & Drink secondary; Bilal
      decides)
- [ ] **Age rating questionnaire** — expected outcome 4+
- [ ] **Copyright line** — [BILAL: confirm exact line, e.g. "2026 Bamware"]
- [ ] **Content rights declaration** — app displays third-party licensed
      data: OpenStreetMap (attribution visible in-app) + Google Places
      (photos display-only with attribution, key server-side)
- [ ] **Export compliance** — already set in the binary (exempt, standard
      HTTPS); confirm ASC shows no pending question

## 6. Release settings

- [ ] Version release: **Manually release this version** (approval and
      release stay decoupled; the go-public moment stays with Bilal)
- [ ] Phased release: applies to automatic updates for existing users, so it
      is a no-op for a first version — nothing to enable for 1.0; note the
      decision and revisit for 1.1
- [ ] Attach build **1.0 (3)** (the exact build that passed step 3) to the
      version

## 7. Submit [BILAL ONLY]

Only when: all step-1 gates green (or explicitly waived by Bilal, in
writing), step-3 smoke recorded, metadata pushed, questionnaires complete.

1. App Store Connect → App Store tab → 1.0 → Add for Review → Submit.
2. Record submission date/ID in STATE.md; flip board tickets.
3. If rejected: same-day response per `docs/rejection-response-pack.md`
   (reply first, appeal is the 4.3 escalation) — drafts exist precisely so
   this is paste-and-verify, not improvisation.
