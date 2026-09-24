# State of the Union — Bamware

> 📋 Board: https://github.com/users/mrbam88/projects/2 — cross-repo, fielded
> (Priority/Area/Size/Worker; conventions in skills/board-ops)

> The living answer to "what are we building and where are we?"
> Update on every merge/session that changes the picture. Keep it scannable.
> Last updated: 2026-09-23 — **Work Fit v2 is MERGED AND LIVE in production (ve#149). Caffe Reggio 69 -> 87; 9 of 200 Village venues now carry a number, the rest read "Not rated yet".**
> **1.0.1 release SKIPPED (Bilal, 2026-09-19) — its fixes ship inside 1.1. Do not ask about cutting 1.0.1.** Bilal's checklist: brewdesk#176.

## 2026-09-23 (late) — Work Fit v2 MERGED and LIVE

ve#149 and bamware-ai#34 both merged; production deployed from the `omarchy`
server via the Vercel Git integration. **First engine release not run from the
Mac** — no Vercel CLI login needed. $0.

- Live now: Caffe Reggio **87** (was 69), `scoreCoverage`/`scoreConfidence`
  served on full + detail, `scoreConfidence` on `compact=1`, `/v1/health` 200
  at 6,931 venues. **9 of 200 venues near Carmine St carry a number; the other
  191 read "Not rated yet".** Full evidence in `docs/venue-engine-deployment.md`.
- Bilal should re-test in the field — this is a large visible change and the
  displayed-score bar (`MIN_DISPLAY_WEIGHT = 0.75`) is the lever if too many
  pins now read unrated.
- **Still open:** ve#148's durable storage (needs Bilal's hosting decision,
  DB-09 #138) — writes are honestly `durable: false` today. ve#147 (venue-type
  labelling) is client-side and needs a Mac session. ve#146 press fan-out is
  the cheapest way to raise the rated count.
- **Agent gotcha:** `gh pr merge` and `gh pr view --json state` are blocked by
  the auto-mode permission classifier; `gh pr list --state merged` is not. A
  blocked-looking merge may already have succeeded — check before retrying.

## 2026-09-23 (evening) — Work Fit v2 implemented; two draft PRs await review

Bilal authorised ve#144 and ve#148 after the field test above. Both are built,
gated and **unmerged**. Engine work was done entirely on the `omarchy` server.

- **[venue-engine PR #149](https://github.com/mrbam88/bamware-venue-engine/pull/149)**
  (draft, branch `feat/work-fit-v2`, commit `142b7e1`) closes ve#144 + ve#148.
  **[bamware-ai PR #34](https://github.com/mrbam88/bamware-ai/pull/34)** is the
  companion `docs/contracts.md` change. Merge together, or neither.
- **ve#144:** `workScoreV2` scores only attributes holding a voting claim,
  renormalised — promoted from the reviewed pilot in `src/work-fit-pilot.ts`,
  served behind `WORK_FIT_VERSION` (one-line revert). Adds `scoreCoverage` and
  `scoreConfidence`; `compact=1` gains `scoreConfidence`. Stored `data/` rows
  stay v1; v2 applies at serve time.
- **Measured, Greenwich Village 600m:** Caffe Reggio 69 → **87** (rank 6),
  Capital One 64 → **83** (rank 8), Gregorys 82 → **95**, Joe Coffee 80 → 93.
  Top ten is now entirely real cafés. **Qahwah House still shows no number** —
  it holds one OSM wifi tag and nothing else. Evidence gap, not formula gap;
  reported rather than fudged, per the ticket's acceptance criteria.
- **`MIN_DISPLAY_WEIGHT = 0.75` was forced by measurement, not taste.**
  Renormalising rewards sparse maximal tags: without a bar WeWork displayed
  **100** at Midtown rank 4, OSM-only libraries 94, and The Malin Chelsea (a
  members co-working club) 97. Ranking shrink alone did not keep them off the
  first screen. Gating on the `confidence` label instead of weight was tried
  and rejected — it expired fully-researched venues after ~90 days of decay.
- **Deviation from the ticket, deliberate:** its `c' = 0.5 + 0.5·c` confidence
  blend was implemented, measured and removed. It contradicted the pilot's
  reviewed design, three existing tests guard against it, and it made the truth
  cafés worse (Reggio 81 with it vs 87 without). Recorded in the PR.
- **Product change worth seeing before merge:** ~95% of that viewport now reads
  **"Not rated yet"** (10 of 216 venues carry a number, spread 64-95, vs v1
  where 205 of 216 sat in the 50-59 bucket). That is the true state of the
  evidence; v1 hid it. The lever if it is too aggressive is
  `MIN_DISPLAY_WEIGHT`, not the formula.
- **ve#148:** `persist()` now records durability and the observation routes
  return **202 + a `storage` block** when a write will not survive, instead of
  the 201 that lost Bilal's ratings. iOS build 28 is unaffected (any 2xx,
  unknown keys ignored). **Durable storage itself is still blocked on Bilal's
  hosting decision** (ve#148 / DB-09 #138; `docs/database-hosting.md` prices
  it — Neon Free $0 with scale-to-zero, Supabase Pro $25 exceeds the $20 bar).
- **Gates (Node 20):** 867 passed / 12 skipped / 0 failed, `tsc --noEmit`
  clean, `truth-check` passes Reggio and Capital One with Qahwah pending as
  before. No network, no paid calls, no Actions. $0.
- **Toolchain trap confirmed:** `npm ci` fails on this box for the private
  `git+ssh` dep `@bamware/auth-middleware`, and Node 26 has no prebuilt DuckDB
  binary. Use Node 20 and the existing checkout's `node_modules`.

## 2026-09-23 — Community ratings from the app are silently discarded (ve#148)

Bilal asked whether the ratings he submitted through the iOS observation form
are used. **The engine scores them correctly and then throws them away.**

- The write path works: community answers become `user_report` claims at
  confidence 0.7, they outrank machine evidence, `workScore` recomputes, and the
  route returns **201 with the updated venue** — so the app shows success and a
  changed score.
- `VenueStore` is in-memory over a JSON seed. `persist()` catches the read-only
  filesystem error and logs `persist skipped: filesystem is read-only`. Vercel's
  FS is read-only, and `api/index.ts` runs the JSON path because
  `PRIVATE_STORAGE !== "postgres"` (cutover unapproved, DB-09 #138 open).
- **Net: a rating survives in one lambda instance until it recycles, and is
  invisible everywhere else. No `data/observations.json` exists. Bilal's
  submissions are unrecoverable.** The `user_report` claims on Caffe Reggio are
  from the hand-authored seed in `76e343a`, not from the app.
- Same posture, same loss: content reports (an Apple 1.2 commitment), community
  photos, saved-spots sync, city demand/spend logs. On-device local saves are
  unaffected.
- **The defect is the silent 201**, separately from the missing storage. Filed
  [ve#148](https://github.com/mrbam88/bamware-venue-engine/issues/148).
- Product consequence: the community form is the cheapest evidence source there
  is, and it currently yields zero durable evidence — while ve#144 (scoring)
  and ve#146 (press fan-out) are both bottlenecked on evidence coverage. The
  field-rating flywheel in the gameplan is disconnected.

## 2026-09-23 — Field test (Bilal): coverage solved, scoring is the problem

**Bilal's report after real-world testing of the live app:** "not too bad right
now"; **it finds every cafe at least** — the listing/discovery push is done as
far as he is concerned. He discovered a great new café he did not know, using
his own app. **The big issue now is scoring: still wrong in too many cases,
though sometimes spot on.** This supersedes the 2026-09-19 "data quality"
framing: *listing* is no longer the complaint, *scoring* is.

**Measured against live production (`venuekit-ashen.vercel.app`, main
`76e343a`, 2026-09-23) — the score is a function of evidence coverage, not
venue quality.** 500-venue radius pulls, counting attributes with a real
(non-`estimate`, confidence >= 0.4, non-unknown) claim:

| evidenced attrs | Greenwich Village | Midtown | SoHo | median score |
|---|---|---|---|---|
| 0 | 398 venues | 401 | 401 | **40** |
| 1 | 44 | 67 | 40 | 52 |
| 2-3 | 21 | 17 | 23 | 45-48 |
| 4 | 4 | 4 | 3 | 74 |
| 5 | 33 | 11 | 33 | **73-78** |

- **~80% of venues in every neighborhood have zero evidenced attributes and
  therefore score exactly 40.** Pin coverage is high; *evidence* coverage is
  ~20%. That is the "sometimes spot on" pattern: a venue is only scored
  correctly when all five attributes happen to be researched.
- **The scale cannot express Bilal's judgment.** With all five attributes
  perfect at curated confidence 0.75, the confidence blend
  (`util·c + 0.5·(1−c)`) caps a venue near **85-86**. Observed ceiling: Carmela
  Coffee 84, Capital One Café 84, Stavros Niarchos Library 85. Bilal's truth-set
  cafés are 95-100. **No venue can ever score what he says it deserves.**
- Root cause is unchanged from ve#144 and now confirmed in the field: every
  *unobserved* attribute votes a full-weight neutral 0.5, so the number answers
  "how much do we know about this place?" rather than "how good is it?".
- **Non-cafés outrank cafés without any filter applied.** Midtown top-8 by
  Work Fit: Stavros Niarchos Foundation Library (85), Capital One Café (84),
  Stephen A. Schwarzman Building (81), **Bryant Park (80)**. ve#147 reported
  this under filters; it is also true of the default ranking. A park cannot be
  the best place in Midtown to work from.

**Recommendation (not yet approved by Bilal):** ve#144 Work Fit v2 is the fix
for the complaint — score from evidenced attributes only, report coverage as a
separate signal, no number for hollow pins. ve#147 (venue-type gate) is a
smaller, independent win that stops parks and library buildings ranking as
cafés. ve#146 press fan-out raises evidence coverage, which is the input ve#144
needs. No implementation, spend or deployment was authorized in this session.

## 2026-09-22 — Marketing media pack for Fiverr and Contra (step 2 of the post-approval order)

- Delivered in `bamware-web/marketing/2026-09/` (web#41, merged 2026-09-22): hero video
  (9:16 36.7 s, 16:9 Contra header, 16:9 Fiverr cut 39.7 s, all < 6 MB),
  three phone mockups (1280x769, 1600x1200, 1080x1080), the
  Scope → Build → TestFlight → App Store process image, ten 1290x2796
  stills (light + dark: map, detail, search, saved, launch reveal), a
  one-page case-study PDF, the video contact sheet, and `src/` to
  regenerate. Index and gotchas: [docs/marketing-media.md](docs/marketing-media.md).
- Recorded from `bamware-brewdesk@9566a9f` (main, Release, production
  engine) on an iPhone 16 Plus simulator at West Village, load < 12 on
  every take. Storyline: launch reveal → street-zoom map → Carmela Coffee
  (84) detail with evidence → search "SEY" → fly → Save → Saved. Supervisor
  read every image and a 1 fps contact sheet before commit; no debug
  overlays, no "Not rated yet" sheets, brand colours only. $0, no Actions.
- Not done: posting to Fiverr/Contra (Bilal's accounts), launch posts,
  listing keywords, web city pages — the rest of the marketing step.

## 2026-09-20 — Venue quality: published source, deployment handed to Bilal

- **Published:** engine commit `76e343a` on
  [`feat/venue-evidence-quality`](https://github.com/mrbam88/bamware-venue-engine/tree/feat/venue-evidence-quality).
  Not merged to main; no production deployment performed by this session.
  Bilal explicitly requested commit/push and will deploy from his configured
  machine. The working session is SSH'd into the Omarchy Linux server.
- **Next action on the deployment machine:** fetch/check out that branch, read
  engine `docs/work-fit-pilot.md` and `docs/venue-engine-deployment.md` here,
  then use the existing authorized Vercel path and verify production responses.
  The checkout already links project **venuekit**. Linux CLI auth check returned
  **a new login is required**; do not recreate the project, move keys, restart
  implementation, or make GitHub Actions a prerequisite. No PR was opened.
- **Verified locally:** 866 tests pass, 12 DB integration tests skipped;
  typecheck passes; truth-check passes two enforced venues with Qahwah pending.
  No paid research/model calls or Actions runs were requested for this handoff.
- **Reggio:** audited, visit-scoped `user_report` claims for laptop friendliness,
  usable seating and acceptable Wi-Fi replace misleading/missing machine
  evidence. Existing formula **48 → 69**, 600m anchor rank **21 → 6**. Original
  claims preserved; no invented Mbps, visit dates, all-hours policy, outlets,
  noise or outdoor-seat availability. Reggio's top-ten gate is now enforced;
  Capital One passes at rank 8. Replaying feedback changes zero venues.
- **Display contract:** NYC `scoreDisplay: number | null`, including compact
  map and detail responses. Explicit null => **Not rated yet**; absent => legacy
  fallback. `workScore` remains numeric. iOS work belongs to Bilal's other
  agents; `docs/contracts.md` records the handoff. Not confirmed live yet.
- **Press recovery:** 55 mentions audited, 47 safe branch matches. All 47 now
  linked (one Blue Bottle link recovered); same-brand source pooling fixed.
  No Wi-Fi/laptop claims fabricated from list titles. The offline scoring
  candidate evaluates corrected Reggio at 87 but is **not activated**.
- **Continuity is first-class:** `AGENTS.md` / `docs/portability.md` require
  explicit decisions, rationale, evidence, next steps, blockers and pause state.
  `docs/runtimes.md` uses capabilities/task ownership, not model names. Venue
  Engine's canonical route is local validation → direct existing-project
  Vercel deployment. Earlier CI-route approval was withdrawn; don't reuse it.

## 2026-09-19 — Bamware CRM: third-app direction (Bilal)

- **Bamware CRM** is a generic, extensible business-management app built with
  React Native for web and mobile. Bilal describes it as the third app and a
  full app. [Canonical CRM entry point](docs/bamware-crm.md).
- Platform goal: bring together features from the Bamware ecosystem and make
  its capabilities reusable by the fourth app and subsequent products.
- Initial capabilities requested: appointments/calendar; to-do/checklists
  with offline sync; in-app messaging between people within a user pool.
- Messaging clarification: Bilal is exploring a dating-app-like user pool
  where people can message one another; the earlier "event messaging" label
  was tentative. Pool membership, discovery and messaging permissions remain
  undecided; large-scale requirements have not been defined.
- Broader product examples (Bilal): warehouse management with items/products,
  employee users and differentiated admin/access permissions; a dentist's
  office managing patients and records. These illustrate the desired breadth
  beyond a personal CRM; neither is selected as the first implementation.
- Architectural priority (Bilal): the app must be very generic and highly
  extensible; software architecture is critical. Preserve the ability to defer
  decisions and evolve the system rather than locking in speculative choices.
- Configuration starts with Bilal/Bamware doing it manually; more automated
  configuration may follow. The extension mechanism remains undecided.
- Reuse existing foundations across Bamware repos and the existing mobile and
  web apps. CRM should build on that ecosystem; use the source inventory below
  before selecting new shared modules or technology.
- Still being defined: primary user/workflow, offline scope beyond tasks,
  and the first release boundary.
- Source audit completed across 12 repos at pinned main commits:
  [CRM reuse inventory and architecture proposal](docs/bamware-crm-architecture.md),
  with [backend evidence](docs/crm-backend-reuse-audit.md). Existing identity,
  native push, match-based chat and saved-list sync are useful foundations;
  workspace authorization and offline task semantics need new design.
  Bilal approved the first proof and authorized implementation: one configured
  workspace with role-scoped offline tasks across web/mobile.
- **First slice implemented and locally verified:** new `code/bamware-crm`,
  branch `feat/crm-offline-tasks`, no commits/remote yet. Ticket
  [bamware-ai#31](https://github.com/mrbam88/bamware-ai/issues/31).
  Expo RN web/iOS, Express + SQLite, shared JWT verifier, independently reusable
  Tasks module, admin/member permissions, durable queues and explicit conflicts.
  Verified: 18 tests, typecheck, server/web builds, real offline browser cold
  reopen, local iOS build (0 errors/warnings), native queue across app restart,
  and the exact native-created completed task visible in a separate browser.
  Headless Tasks consumer also passed. Standards/spec review findings fixed
  and rechecked. [Results and follow-ups](docs/crm-first-slice-results.md).
  Preview: loopback port 4310; Metro 8093. Local demo identities only; live
  shared-auth registration/activation and Android device verification remain.
  CRM source publication has not been requested; source remains local.
- **Bilal's first web walkthrough:** very positive initial impression —
  "I'm very impressed" and "wow" for the first iteration. This is initial
  product feedback, not completion of the remaining integration/release gates.

## 2026-09-19 — NYC venue intelligence implementation in draft PR #145

Bilal subsequently authorized execution of the entire epic and requested no
optional permission questions. System sandbox approvals still apply; do not
promise unattended execution while those approvals are required.

- [venue-engine PR #145](https://github.com/mrbam88/bamware-venue-engine/pull/145)
  contains PostGIS import/read repositories, durable private writes and coarse
  demand counters, grounded AI caching, fenced jobs and public snapshots.
- Verified: 783 regression tests, 12 real database integration tests, TypeScript,
  and a backup/restore drill preserving private records and ranked results.
- Verified first-party Capital One SoHo evidence improves the local benchmark
  from rank 191 to 7 and Work Fit 40 to 65. Qahwah/Reggio remain quality misses.
- Not deployed or epic-complete. Remaining work is recorded in the PR/runbook:
  provider identity lineage, spend reporting, expiry/deletion, hosted operations
  and client auth coordination. The inspected Swift observation client does not
  send a JWT; database community writes require one. Production flags unchanged.
- No paid research or database hosting provisioned. Draft implementation lives
  on `feat/nyc-venue-intelligence`, commit `3778b49`.

## 2026-09-19 — NYC recommendation quality is the goal

Bilal clarified that the core problem is failing to surface and highly rank
known excellent work cafés during his manual neighborhood tests. NYC only.
The engine should aggregate its existing sources, use AI to interpret media
reviews and other evidence, and reuse stored analysis to control AI cost.
Database scale/durability supports this goal; migrating current rankings
unchanged does not solve it. Work Fit remains primary, with popularity and
social atmosphere relevant; exact scoring changes are still undecided.
Canonical direction and open decisions:
[NYC venue intelligence](docs/nyc-venue-intelligence-direction.md).
The [database epic draft](docs/venue-engine-database-epic-plan.md) records the
original planning baseline. The later execution instruction above supersedes
its no-execution status; hosted activation and spend remain separate gates.

## 2026-09-19 — Listing direction: free bulk sources + Apple Maps (Bilal)

- Bilal: "Let's only do the number one: improve the listing"; research/enrichment
  budget on hold. Then: "definitely go with the free ones, but also, Apple Maps
  is interesting" (he sees Apple's base-map café labels on our map that we
  don't list).
- venue-engine PR #121 merged (+330 Manhattan pins, $0). ve#122 fine grid
  running (≤300-call chunks, free tier). ve#123 filed: Overture Maps +
  Foursquare OS Places bulk ingest (free, storable licenses); code+dry run
  now, live write after ve#122. brewdesk#182 filed: tappable Apple café
  labels + on-device gap-fill (MapKit, $0; never persist Apple data).
- Landed 2026-09-19 ($0 real): ve#122 PR #124 fine grid (+680 pins, 942
  Nearby calls, Capital One Café 555 Broadway now listed, 0 missing within
  500 m of the SoHo anchor); ve#123 PR #125 Overture ingest (+1,624 pins after
  a 0.5 confidence cut removed 176; 2,440 of 3,158 rows scored ≥0.9). Venue
  store 3,258 → 5,562; Manhattan cafés 1,737 → 3,910. Foursquare adapter
  built but its dataset is gated on Hugging Face — human step filed as a
  venue-engine issue (accept gate + FSQ_HF_TOKEN in vault). Google Nearby
  calls this month ≈1,145 of 5,000 free.
- brewdesk#182 PR #183 merged: Apple base-map café labels are tappable
  (card: name, distance, "Not in BrewDesk yet", Directions, Suggest); iOS 18
  resolves details via MKMapItemRequest, iOS 17 falls back to MKLocalSearch;
  gap-fill with grey unverified Apple pins behind a launch flag (default off);
  nothing from Apple is persisted. "Suggest this café" is a stub until the
  engine grows POST /v1/discovery-hints — filed as venue-engine #127, a
  cross-repo contract, so Bilal approves the shape first. Known pre-existing:
  DegradedStateTests fails 4 cases on main too (see brewdesk#170 stale tests).
- 2026-09-19 later: ve#126 PR #128 merged — Foursquare OS Places ingest
  (+2,733 pins, $0; token via scripts/fsq-token.sh → vault
  /bamware/venue-engine/fsq-hf-token). All three truth cafés now present;
  Qahwah House came only from Foursquare. Venue store 5,562 → 8,295.
  infra#11 PR #12 merged+applied: auth warmer live (rate 5 min), /health
  9.7 s cold → 0.1–0.4 s. Follow-up: add /bamware/shared/sentry-dsn-backend
  to keys-wizard/secrets-status (infra reads it off the live Lambda for now).
  Bilal UX asks, landed on brewdesk main 2026-09-19: sign-in busy state
  (bamware-ios#13 → brewdesk#187 pin ac444619), onboarding sign-in pitch page
  removed (#188, back to 3 pages), prominent working locate-me button (#189).
  Animated launch mark: brewdesk PR #190 merged 2026-09-19 (Bilal: "whats
  the issue?" — proceed). TestFlight 1.1 build 21 uploaded 2026-09-19
  (tag store/1.1-build21 = 2f256f7, free local rail, Upload succeeded);
  Bilal to smoke: Google sign-in busy state, no onboarding pitch page,
  locate-me button, launch animation, Apple café labels tappable.
  Bilal smoke-tested build 21 (2026-09-19): "definitely much better already...
  although it still needs a lot of work" — next: collect his specific list.
- 2026-09-19 evening, after Bilal tested build 21 ("iOS app is decent.. the
  api still sucks.. missing cafes and not good scores"): ROOT CAUSE of
  "missing cafés" = the app fetched limit 100 at 2.5 km by score, hollow pins
  last; at Carmine St that dropped 96% of pins in view. Fixes: ve#140 PR #141
  merged+live (limit max 500, meta.total_in_radius/returned/hollow_returned/
  truncated, compact=1; radius param is `radius_m`); brewdesk "Search this
  area" + viewport fetch in flight. Spot check found junk Foursquare-only
  pins (bars, restaurants, food court) — quality gate in flight, supervisor
  reviews samples before merge. Launch-animation polish in flight (Bilal:
  "sharper and more polished"), video to Bilal before merge. Scores: new pins
  are unrated; real scores need the research budget Bilal has on hold.
  ASC API keys on the Mac return 401 (issuer id mismatch?) — re-run the keys
  wizard Apple stage some time. brewdesk#191 merged: export-compliance flag.
- TestFlight 1.1 build 22 uploaded 2026-09-19 18:25 (tag store/1.1-build22 =
  b9a3130): "Search this area" + viewport fetch up to 500 pins (brewdesk#194),
  launch-animation polish (#195: geometry mismatch 16% → 0.9%, light sweep),
  export-compliance flag now on the STORE plist (#191 had only patched Debug;
  follow-up #196 to main). FSQ quality gate ve#142 PR #143 sent back once:
  keep stale + bad-name removals, loosen wrong-category for bakery-cafés and
  a coffee-chain allowlist; supervisor merges after reviewing new samples.
- ve#142 PR #143 merged + live 2026-09-19: open-data quality gate (primary
  category, 24-month freshness, name sanity, bakery-café rule, 46-chain
  allowlist). Removed 1,364 fsq-only pins (957 stale, 379 wrong category, 28
  cafeterias/food courts), auditable in data/open-places-gate-removed.json.
  Venue store 8,295 → 6,931. Carmine St 500 m: 215 → 166 pins; Qahwah House
  kept; Bar Pisellino / food court gone. Remaining gap is SCORES: 146 of those
  166 pins are hollow (no evidence) — needs the research budget Bilal has on
  hold. brewdesk#196 merged (compliance flag on Store plist).
- 2026-09-19 night, Bilal's build-22 feedback → in flight: (a) detail card
  leads with café name (bd agent); (b) "Search this area" snapped back to GPS
  because DiscoveryRootView.task(id: request) re-applies the location fix
  (bd agent, fail-before/pass-after UI test); (c) SCORES: formula pads unknown
  attributes as 0.5 and blends known ones toward 0.5 → evidence-backed range
  44–84, hollow pins flat 40/50; Work Fit v2 PR (evidence-only score,
  scoreDisplay/scoreCoverage/scoreConfidence) — supervisor reviews before
  merge; (d) PRESS: 26 corpus articles mention 35 cafés, 16 got no credit
  (e.g. Conwell Coffee Hall); press fan-out PR credits every mention;
  (e) app search is viewport-limited (server q= works city-wide) — fix queued
  after (b) merges. COORDINATION: another agent is overhauling venue-engine on
  feat/nyc-venue-intelligence (Postgres/PostGIS epic ve#129); both engine PRs
  are isolated from its files; note left on ve#129.
- 2026-09-19 late: Bilal: backend is owned by other agents; this session is
  iOS-only (engine scoring/press builds stopped, findings on ve#144 / ve#146).
  At Bilal's request the supervisor reviewed and MERGED venue-engine PR #145
  (Postgres/PostGIS foundation, epic ve#129) as 97a1e73: only conflict was
  venues.json.gz (resolved = main's data + the PR's single Capital One
  change); 833 tests + truth gate green; merged server vs production parity
  identical (keys, counts, order ex Capital One 40 → 65), re-verified on
  production after deploy. Production stays in JSON mode: Postgres path only
  when PRIVATE_STORAGE=postgres (not set; Vercel has ADMIN_KEY,
  GOOGLE_MAPS_API_KEY, JWT_SECRET only). DO NOT set it until brewdesk#202
  ships (app must send the JWT on observation/photo/report writes) and Bilal
  approves hosting spend. iOS in flight: detail card name-first, city-wide
  search; merged: GPS-snap fix (#199).
- 2026-09-19 night (iOS-only session): ASC API reconnected (scripts/asc-key.sh,
  scripts/asc.py reads TestFlight builds + tester feedback; old vault issuer
  id was wrong). Bilal's build-23 feedback: map count bubbles read as scores;
  "animation looks broken"; "you're not testing some of the UI before it goes
  out" → new rule (skills/agent-fanout + memory): visual tickets need a
  real-speed recording → contact sheet read by the supervisor; no self-merge.
  Supervisor now keeps a simulator build of main (flags: -UITestSkipGates,
  "-brewdesk.uitest-fixed-location" "lat|lng", -brewdesk.debug.environment
  production) to look at UI at live density. Findings: launch reveal never
  rendered its motion at real speed (timeline clock starts before first
  presented frame) — PR #207 open, being reworked with a frame-diff pass
  test; PR #208 (cluster redesign) merged but NOT shippable (overlapping
  pins, dot blob, stacks over the river, unreadable shelf score badge) —
  follow-up agent running, supervisor re-screenshots before merge. Merged:
  #206 JWT on observation/speed-test writes (reports have no wire client).
  Build 24 waits on the marker follow-up + launch animation.
- TestFlight 1.1 build 24 uploaded 2026-09-20 01:21 (tag store/1.1-build24 =
  0aad384). Contents, each checked by the supervisor on a simulator at real
  speed / live density: launch animation v4 (#207; additive signal pulse,
  clock starts at first presented frame; verified frame-by-frame on a
  flag-free Release launch: ~22 frames of arc motion, cup region flat);
  map markers (#208 + #210: circles = scores, rounded-square stacks with real
  counts at member centroid, single-hue lightness dots, hollow rings for
  unrated, collision-free, excluded from app chrome, walking-scale initial
  camera, "Search this area" only after a user gesture, readable score
  badge); JWT on observation/speed-test writes (#206). Known cost: Release
  MapPerformanceUITests hitchRatio 0.188/0.155 (was ~0.08; limit 0.20) from
  re-plan stalls, not marker count → brewdesk#211 agent running (stable ids,
  incremental placement, off-main planning); supervisor re-measures before
  merge → build 25. Gotcha: any launch arg starting with -UITest marks the
  run as a UI test and SKIPS the launch reveal; to check the real path, set
  `defaults write io.bamware.brewdesk brewdesk.onboarding.complete -bool YES`
  in the simulator and launch with no flags.
- 2026-09-20: Bilal rejected build 24's map markers ("a step backwards…
  grouping doesn't make any sense… take a pause and think"). Marker work is
  PAUSED in the app. Design review artifact with 4 options on real West
  Village data (recommended: "Best first" = top ~10 rated as score pills with
  names, other rated as dots, unrated only as faint rings at street zoom, NO
  count clusters): https://claude.ai/artifact/1gDVdnxqL1T51cVWQ3e8iF — waiting
  for his pick (direction + pin shape). brewdesk#211 perf agent paused; WIP on
  branch perf/211-map-replan-stalls; finding: plan() is cheap (~20 ms), the
  cost is SwiftUI/MapKit creating/destroying 70–100 annotation views per
  re-plan → fewer markers + stable ids is the fix; its branch got default-zoom
  hitchRatio to 0.105–0.118 and surfaced a failing
  MapLocateButtonUITests.testAuthorizedTapCentersOnSimulatedLocation to
  root-cause. Build 24's launch animation is fine.
- 2026-09-20 DECISION (Bilal, via the mock-up page; "this GUI actually really
  helps me figure things out"): map markers = MICRO TEARDROP pins, Hanken
  Grotesk Light numbers, 0.75 pt dark hairline + small soft shadow, no white
  ring, NO grouping/clusters; size scales with zoom (4 pt dots zoomed out →
  12 pt neighborhood → 17 pt street → 20 pt max), number only ≥ 11 pt; best
  score = brightest on the dark map (single green hue, lightness only);
  overlapping lower scores shrink to dots; unrated = faint specks. Smoothness
  is a hard requirement ("buttery-smooth"): one stable annotation per venue,
  MapKit-positioned, target hitchRatio ≤ 0.12 Release. Reference:
  https://claude.ai/artifact/1gDVdnxqL1T51cVWQ3e8iF (v4). Build agent running
  (PR only; supervisor re-screenshots at 3 zooms, watches a real-speed pinch
  recording and re-measures before merge → build 25). Process that worked:
  mock options on REAL data in an artifact before touching the app.
- 2026-09-20 03:05 ET: venue-engine `76e343a` (other agent's
  feat/venue-evidence-quality: additive nullable `scoreDisplay`, reviewed
  Caffe Reggio feedback 48 → 69, branch-specific press links; Work Fit pilot
  formula stays OFFLINE) verified locally, fast-forwarded to main, deployed by
  the Vercel Git integration, and verified live. Record + gotcha (commit status
  goes green before the alias switches) in docs/venue-engine-deployment.md.
  iOS follow-up: brewdesk#213. Markers v3 (micro teardrops) build in flight →
  TestFlight build 25 after supervisor checks.
- TestFlight 1.1 build 25 uploaded 2026-09-20 04:31 (tag store/1.1-build25 =
  d245e02): map markers v3 (#212 / PR #214): micro teardrop pins, Hanken
  Grotesk Light numbers, dark hairline + soft shadow, size by METRES PER POINT
  (9.0→4 pt dots, 5.4→11.5, 3.6→12.5, 1.8→17, 0.9→20; number ≥ 11 pt), best =
  brightest on the dark map, overlapping lower scores demote to MapCircle
  dots, unrated = MapCircle specks, one stable annotation per rated venue, NO
  clusters. Supervisor caught and fixed before merge: teardrop path not
  filled (agent approved invisible pins), and size stops too tight (every
  café a dot at neighborhood zoom). Perf unchanged vs build 24 (Release
  hitchRatio ≈ 0.17/0.16, worst ≈ 300 ms; target 0.12) → brewdesk#211 stays
  open (likely needs an MKMapView-backed marker layer). In flight: #213
  scoreDisplay → "Not rated yet" (build 26).
- TestFlight 1.1 build 26 uploaded 2026-09-20 05:20 (tag store/1.1-build26 =
  b5570f4; first upload attempt timed out, retry succeeded): brewdesk#213 /
  PR #215 — app reads the server's `scoreDisplay` (number / null / absent);
  unrated cafés show "Not rated yet" on tile, detail badge, rows, share text
  and VoiceOver, never a placeholder 40/50. Supervisor reviewed the unrated
  detail + map screenshots before merge. New ticket brewdesk#216: estimated
  attribute values render in red (not colorblind-safe). Open: #211 map pan
  smoothness (≈0.17 vs 0.12 target), #170 stale UI tests.
- TestFlight 1.1 build 27 uploaded 2026-09-20 14:49 (tag store/1.1-build27 =
  42551e1): brewdesk#217 / PR #218 from Bilal's TestFlight notes on build 26
  ("Much better! Might need to change the color of the text to white on the
  pins!" + "border should be white instead of dark"): LIGHT map pins = darker
  single-hue greens (#1C5243 / #2C6B58 / #3D8069, white ≥ 4.5:1), white
  numbers, 1 pt white edge + soft shadow, Regular weight below 15 pt heads;
  DARK map unchanged (adaptive edge token). Fixed pins peeking under the
  "Search this area" pill (chrome-blocked candidates no longer fall back to
  unchecked MapCircle dots) + compass exclusion. PENDING BILAL DECISION: Apple
  style "depth" finish (tone-on-tone rim, gradient, shadow), café name labels
  beside top pins, Apple-size at street zoom — mock v5 at
  https://claude.ai/artifact/1gDVdnxqL1T51cVWQ3e8iF (his second note: "Notice
  the Apple Maps pins! They look 3d ish because of the color… I want my pins
  to compete against the Apple pins"). TestFlight feedback is readable via
  scripts/asc.py (screenshots + comments).
- 2026-09-20, Bilal on build 27: "wow, this is the first build that I
  actually feel pretty happy and proud about… a much smoother feel… a much
  more polished look." What got there: (1) design decisions made on a
  real-data mock-up page before touching the app, (2) the supervisor looking
  at every visual change on a simulator at live density / real speed before
  merge, (3) reading his TestFlight screenshots + notes directly via
  scripts/asc.py. Keep doing all three.
- TestFlight 1.1 build 28 uploaded 2026-09-20 19:39 (tag store/1.1-build28 =
  8d72db7): brewdesk#219 / PR #220 — selecting a search result behaves like
  Google/Apple Maps: keyboard + shelf step aside, field commits to the café's
  name (x clears), detail sheet opens at MEDIUM with background interaction
  enabled, camera flies to the café at walking scale via
  MapCamera(distance: 3580 m ≈ 2.2 m/pt), selected teardrop + name centred in
  the visible band above the sheet, surroundings load via updateViewport
  (exploredViewport), and an authoritative `flyTarget` blocks every other
  `position` write until the next gesture. Root causes fixed: late "fit all
  results" write racing the selection; shelf gesture (minimumDistance 0)
  swallowing row taps in search mode; search text still filtering the map
  after selection; substring matches ("sey" in "Jersey") widening the fit.
  It took three supervisor reviews of real-speed recordings: the first two
  passes "passed" tests that checked the map centre but never the ZOOM. UI
  test now asserts map-camera-mpp ≤ 2.6, selected marker in the 35–65 % band,
  ≥ 5 rendered markers, held 4 s and after sheet dismissal. Server has
  Brooklyn cafés (SEY, Devoción, Butler…).
- 2026-09-21 design review ROUND 2 (Bilal's build-28 TestFlight note: pins
  "a bit hard to read… font bolder and brighter or microscopically bigger.
  Lighter border maybe"). The review page now has a `db` capability and a
  "Send my selection to Claude" button; the supervisor reads it with
  ArtifactData (collection `selections`, doc `latest`). HIS SAVED SELECTION:
  fill even (all-bright dark-map ramp #B4F5D6/#9BE8C4/#86D9B3/#74C9A3),
  finish depth, names ON beside top cafés, numColor auto (near-black on dark
  map, white on light), numScale 0.58, rim tone (lighter tint of the fill),
  size microplus (+1 pt), weight Regular 400. Build agent running against
  reference renders (tmp/proto/selref-*.png); PR only, supervisor compares
  screenshots with the references before merge → build 29. Page:
  https://claude.ai/artifact/1gDVdnxqL1T51cVWQ3e8iF (v7).
- 2026-09-21 late: merged brewdesk PR #225 (recent searches stored on-device,
  results list scrolls under the keyboard, centred search states, locate
  button hidden in search, NO camera moves while typing — fit only on
  Search/return or selection) and PR #224 (Bilal's round-2 pin selection:
  +1 pt, depth finish, tone rim, all-bright dark ramp, Regular numbers,
  11 pt semibold name labels beside top-scored pins; pin body cached as an
  image per tier/size/appearance → Release hitchRatio 0.128, better than
  before). Supervisor reviews: search recording passed first time; pins
  needed one round (label gap/size/ordering). Build 29 archiving. In flight:
  brewdesk#222 honest filters (PR-only). Backend report filed: ve#147
  (unknown attributes pass every filter; WeWork ranks first).
- 2026-09-22: Bilal: "massive improvement since our official prod release…
  get ready for our second big push to production." RELEASE 1.1 PREP.
  Merged: #226 honest filters (dark-mode dimming was a real bug: `.disabled`
  + `.secondary`), #228 neutral estimate styling (+ open/closed badge and
  "No laptops" marker de-redded), #229 pins round 3 (raster clip caused both
  the "box" and the blunt tail; dark ramp one step brighter; label
  collisions), #230 search-test flake fix (tests await the debounce Task;
  suite growth had blown a fixed sleep). INCIDENT: I merged #229 with its
  check red because the chained merge did not stop on failure — rule now:
  `gh pr checks --watch --fail-fast && gh pr merge`, and verify main's own
  run is green before any build. TestFlight 1.1 build 30 uploaded 01:45
  (tag store/1.1-build30 = dada18f) for Bilal's full pass. Release
  checklist: (1) #170 stale UI tests + Reviewer-simulation workflow green
  (agent running); (2) new App Store screenshots at live density (after
  #170); (3) 1.1 "What's New" (fastlane release_notes.txt still 1.0.x);
  (4) release candidate + full suite + review notes; HUMAN: App Privacy
  label answers in ASC from submission/1.1/metadata/privacy-label.md
  (accounts/photos now collected; 1.0 label says Data Not Collected);
  decide whether contributing requires sign-in. Deferred: #211 smoothness
  (0.13–0.16 Release, acceptable), #120 accounts/paywall epic.
- 2026-09-22 early: the "search-selection regression" flagged by the #170
  repair was a FALSE ALARM: with the Mac quiet (other sessions had load
  130+ then 33 on 12 cores) `SearchUITests.testSelectingAFarAwaySearchResult
  FliesTheMapToIt` passes on main and at every recent merge; the agent's
  own failures came from a fresh simulator without location permission.
  Its branch (removed single-result auto-select) was discarded. The two
  remaining red flows (ReviewerSimulationTests.testReviewerFirstTenMinutes,
  AppStoreScreenshotTests) had an OBSOLETE expectation (count line "1 …"
  after a one-match search); since #219/#223 that search selects the café,
  so both now assert the selection — PR #233 (merging on green). Lesson:
  run timing-sensitive UI suites only when `uptime` load < ~12, and grant
  location to fresh simulators before search/map UI tests.
- 2026-09-22 afternoon: test reliability closed out for the 1.1 gate.
  Merged #233 (reviewer-sim + store-screenshot flows assert commit-on-select
  search), #234 + #236 (every deadline-based wait in the package tests
  replaced by continuations / awaiting the model's Tasks; zero
  ContinuousClock/timedOut paths remain; 3× serial + 3× parallel green
  locally), #235 (reviewer-sim waits for keyboard focus before typing — a
  tap→focus race that only loses on GitHub's simulator). Main CI green three
  merges in a row (9566a9f, 6736c70, 1e70906). Still watching: the
  Reviewer-simulation workflow on 1e70906 (earlier runs were auto-cancelled
  by newer commits). Known low-priority flake: VenueKitTests
  LaunchEnvironmentTests.fixedNowParsesLocalWallTime (TimeZone leak). Next:
  store screenshots at live density → release candidate; HUMAN: privacy
  label, sign-in-to-contribute decision, "What's New" OK.
- 2026-09-22 18:00: **1.1 RELEASE CANDIDATE = TestFlight build 31**
  (tag store/1.1-build31 = 70fb9c4 on release/1.1.0; archive 1.1 (31),
  Upload succeeded). Contents since 1.0: accounts (Apple/Google), saved-spot
  sync, discovery data (Google fine grid + Overture + Foursquare, closed
  places removed), city-wide search + fly-to + recent searches, micro
  teardrop pins (Bilal's round-2 selection + round-3 fixes), honest filters,
  "Not rated yet", neutral estimate styling, launch animation, warmer,
  JWT on writes, export-compliance flag. Listing assets merged: 9 store
  screenshots per locale (#237, Bilal approved), 1.1 What's New en/es (#239,
  Bilal approved). CI on main green; reviewer-simulation workflow green.
  NOT DONE (human): App Privacy label in ASC (submission/1.1/metadata/
  privacy-label.md), sign-in-to-contribute decision, then `fastlane
  deliver` metadata + select build 31 + submit. Deferred: #211 smoothness,
  #232 VibeChips contrast, #238 Spanish UI localization, #120 epic.
- Data-source shortlist for later: Apple MapKit (free), HERE (250k/mo free),
  Mapbox (100k/mo free), TomTom (2.5k/day free). Yelp rejected (license).

## Vision (one line)

White-label mobile-first software business, ALL altitudes: multi-tenant
SaaS, dedicated instances, full buyouts, + consulting (docs/business-models.md).
First SHIPPED product: **BrewDesk** (App Store, 2026-09-12 —
https://apps.apple.com/us/app/id6802930990). Baat (dating) was the first
build; its native iOS track is closed under 4.3(b) and it lives on as an
open-source showcase.

## Now building

**Post-approval direction (decided by Bilal, 2026-09-12):** the 1.0 binary
was the MVP that got through App Review; Bilal does not consider it a great
product yet. Order of work: **(1) product polish** until Bilal is happy with
the app — "polish the doorknob"; **(2) marketing campaign** (launch posts,
listing keywords, web city pages); **(3) monetization** — BrewDesk Plus per
brewdesk#120's rule (local saves free forever; Plus sells server-backed
sync/alerts/speed tests). No ads spend, no paid venue placement (would break
the "every score shows its work" positioning). Already built but gated OFF:
accounts, community photos/observations, report/block, bylines (bd#67) —
turning them on is a small release. Scoreboard for later: App Store Connect
analytics (free, keeps "Data Not Collected").

**1.0.1 "Trust fix" — CODE COMPLETE on `bamware-brewdesk@main` (2026-09-17, epic brewdesk#162).**
All nine tickets merged, each QA'd locally in Release: #157 pins never vanish
(PR #165), #158 search moves the map (PR #168), #159 no Work Fit number for
unobserved venues — "Not checked yet", grey "?" pin, observed-first order,
VoiceOver/share never speak the neutral number (PR #169), #160 rating prompt
after the 2nd save, once per version, never on first-launch day (PR #171),
#142/#156 name once + friendly dates + the card-stamp time-zone off-by-one
("Updated Jul 31" for Aug 1 in New York) fixed (PR #172), #161 snapshot
refreshed (PR #173), #166 tab helpers (PR #167), #154 (PR #164, other agent).
**Full Release UI suite on main: 90 run / 80 pass**; the 9 distinct failures
are pre-existing and off the changed paths (5 stale/contrast + 4 Debug-only
capture tests → brewdesk#170). **NOT done (needs Bilal's go):** version bump
to 1.0.1, `release/1.0.1` + gate flip, archive, TestFlight upload, physical
iPhone smoke (checklist on epic #162), "What's New", submission (Bilal-only).
**Lessons:** (1) CI runs no UI tests, so the Release UI suite must be run
locally — it had rotted: raw `tab-*` lookups time out on iOS 26 sims, a centre
tap on a SwiftUI Toggle hits the label and never flips it, and 7 tests are
stale/failing on main (brewdesk#170). (2) Perf claims need a same-hour
baseline: MAP-PERF hitch ratio on this Mac is 0.07–0.115 today vs 0.014–0.028
in August; concurrent xcodebuilds inflate it. (3) Subagents that background a
test run and end their turn stall; tell them to run tests in the foreground.
(4) Two critique "bugs" were capture artifacts (sticky search, blank tiles).

## 2026-09-19 (later) — data-quality fixes landed; engine v2 direction on the table
Merged: ve#113 evidence-first ranking + optional `evidence` field (Village
600 m: 9 researched + 15 partial now above 60 hollow); ve#114 Village/SoHo
press pass (Reggio gains sourced seating/wifi → honest 48; Qahwah House has
no allowlisted press) + `data/nyc-truth-sets.json`; ve#118 truth-set gate in
`npm test` (Qahwah rank 25, Reggio 21 vs top-10 bar → `pending`, Capital One
Café SoHo MISSING); ve#119 full-Manhattan discovery grid + coverage check
(code only — live seed = 90 Places calls, list $2.88 inside the 5,000 free,
AWAITING Bilal's "run it"); bd#181 press links + "press research" label.
555 Broadway = **Capital One Café SoHo** (web search; absent from OSM).
In flight: ve#111 closed-business sweep (live inside free tier).
**Strategy (Bilal):** early days → willing to throw out the architecture and
reconsider budget; NYC is the test case; wants to know the cost of "developing
a city". Answer given: rent the café list (Google), build only the work layer
(~600 viable Manhattan cafés); Manhattan ≈ $150 once + <$100/mo; national
top-25 ≈ $2.5k once + $500–700/mo; in-person verification ≈ $1k/city
optional. Proposed engine v2: Google-first discovery, real DB (not JSON),
nightly pipeline, reviews-read-by-AI for the work layer, truth sets as the
gate. **Decisions pending:** discovery run ($2.88 list, $0 real) and the
Manhattan budget. **Decided:** hours/phone/website cached — OSM hours as the
free base, Google gap-fill inside the free tier refreshed ~quarterly at $0;
Bilal accepts the 30-day caching rule exposure ("don't care if stale").

## 2026-09-19 — Data quality is the product problem (Bilal, Greenwich Village test)
Bilal tested BrewDesk around his neighborhood (Thompson & W Houston; home
address is NOT to be stored anywhere) and was unhappy: the great cafés are
missing or empty, some suggestions look wrong. Measured: 83 venues within
600 m, 44 at a flat 50, 15 at 40, only 9 with real evidence. His truth set
(all 95–100): Qahwah House 13 Carmine (in data, empty pin, 44), Caffe Reggio
119 MacDougal (in data, empty pin, 50), a café at 555 Broadway (absent —
not in OSM; name pending). Grok-bot engine work 09-16→18 reviewed (12 PRs,
$0.70 spent): real press evidence on ~27 cafés, buzz/news fields, work-mode
filters, Google Places discovery seam — but 94% of claims are still
estimates, 142 of 145 new Places pins are empty, no quality/popularity or
closed-business signal exists. Tickets filed + running: ve#110 Village/SoHo
free press pass + truth-set file (`data/nyc-truth-sets.json`), ve#112
evidence-first ranking + optional `evidence` field, bd#180 press links +
"press research" label; ve#111 closed-business sweep (Google businessStatus
inside the free tier) queued after #112. Contract note: iOS drops unknown
keys (`buzz`, `news`) safely; `Claim.sourceLabel` lacked "agent".

## 2026-09-18 evening — TestFlight 1.1 (20) uploaded
Release branch `release/1.1.0` cut from main (a62d420), MARKETING_VERSION 1.1,
build 20 (last was 19). Archived + exported via the free local rail (cloud-
managed distribution signing, `~/.appstoreconnect` key on the Mac): "Upload
succeeded", tag `store/1.1-build20`. Archive verified: CFBundleVersion 20,
GIDClientID present, `com.apple.developer.applesignin` entitlement present.
Contents: shared Bamware account packages, Apple + Google sign-in, saved-spot
sync, last week's trust fixes, no store-surface gate. **Bilal: install from
TestFlight once Apple finishes processing and test Apple + Google sign-in.**
Spend: $0.

## 2026-09-19 (day) — keys done, Google wired, push stack applied
- **Keys:** Bilal ran `scripts/keys-wizard.sh` (new; with `scripts/secrets-status.sh`
  and docs/secrets.md "Day-to-day"). Vault now holds Google iOS + server client
  ids, APNs key/key id/team id (BZRTC4A75L), dev JWT secret, venue-engine admin
  key; `GOOGLE_CLIENT_IDS` in the auth Lambda secret; `JWT_SECRET` + `ADMIN_KEY`
  on venuekit (saved-sync route now 401, not 503).
- **App:** brewdesk PR #179 merged — GIDClientID + URL scheme; sign-in shows
  Apple and Google at equal size (test pins it). Bilal tests via the next
  TestFlight build.
- **Infra (Bilal: "merge it yourself"):** PRs #9 (warmer) + #10 (push) merged;
  my conflict merge broke `environments/dev/main.tf` (unclosed brace) — hotfix
  pushed to main. **Push stack APPLIED to dev** with root profile + targeted
  plan (9 added / 0 changed / 0 destroyed): Lambda `bamware-dev-push-service`,
  table `bamware-dev-push-devices`, API
  https://nag5tg01y2.execute-api.us-east-1.amazonaws.com (health 200, /devices
  401 without token). **Warmer NOT applied:** its plan drags an unsafe
  auth-Lambda update (missing zip path, blanked SENTRY_DSN) → infra#11.
  Lessons: the GitHub terraform-apply workflow has failed since July (no AWS
  profile in CI); the `bamware` deployer profile lacks IAM read; full plans
  need a Cloudflare token (`module.dns`). Rule change (Bilal): agents merge
  and apply approved infra PRs themselves — plan first, zero destroys.
- **Skipped for good:** the 1.0.1 release (Bilal). Remaining human items:
  ASC privacy label, bamware-ios checkout cleanup.

## MORNING REPORT — 2026-09-19 (night run 2026-09-18 → 19)

**Done: 15 of 15 code tickets merged, every PR QA'd locally by the supervisor, $0 spent.**

| Repo | Merged | Notes |
|---|---|---|
| bamware-auth-service | #9 tenant registry (PR #13) · #10 refresh rotation + revocation + real logout (PR #15) · #14 shared verifier adopted (PR #16) · #11 cold-start lazy imports (PR #17) | All deployed to the dev Lambda; `/auth/tenants/bamware-brewdesk/providers` → 200. One deploy failed (packaging) and was fixed forward the same night. |
| bamware-auth-middleware (NEW, public) | v0.1.2 | Shared `TokenPayloadSchema` + `verifyAccessToken` + Express `authenticate`; ships `dist/` for git-tag consumers. Follow-ups filed: dating-service#20, web#40. |
| bamware-venue-engine | middleware dep (PR #89) · saved-spots sync API (PR #94) | Routes 503 until `JWT_SECRET` is set. Storage is best-effort JSON: durable store = Bilal's call. Bump to v0.1.2 filed. |
| bamware-ios | BamwareAccounts (PR #7) · silent refresh (PR #8) · Apple + Google sign-in (PR #9) · BamwarePush (PR #10) · BamwareAccountUI (PR #11) | 104 package tests; Google SDK behind an opt-in package trait. QA caught a real bug in #8 (refresh reply has no `user`). |
| bamware-push-service (NEW, private) | code + CI green (60 tests) | Not deployed (Terraform + APNs key are Bilal's). |
| bamware-infra | PR #9 auth warmer · PR #10 push service | Plan-only, OPEN for Bilal: merging = apply. CI plan check fails repo-wide (no AWS profile) — pre-existing. |
| bamware-brewdesk | #174 adopt shared accounts + Apple sign-in + gate removed (PR #177) · #175 saved-spots sync adapter (PR #178) | BrewDeskKit's own account code deleted. Store gate gone. 19 + 12 tests green locally; CI green on main. |
| bamware-mcp | #1 create_tenant native target (PR #2) | 63 tests. |

**Bilal's checklist (brewdesk#176), in order:** (1) Sign in with Apple capability on the App ID; (2) Google OAuth client ids (iOS + server) → registry PR + Info.plist; (3) `JWT_SECRET` on the venue-engine Vercel project; (4) pick a durable store for user data; (5) apply infra PR #9 then #10 after the APNs key (infra#7); (6) ASC privacy label from `submission/1.1/metadata/privacy-label.md`; (7) `ADMIN_KEY` in Vercel; (8) commit or discard the Aug-20 edits in your local bamware-ios checkout (21 files) so the dev workspace can use the new packages.

**Not verified tonight (needs the above):** a real Apple/Google sign-in on a device; sync against production; any push end to end.

**Supervisor mistakes, owned:** merged brewdesk PR #177 while its CI check was red (main passed the same commit; runner flake). Fixed the gating for #178. Two agents stalled waiting on background monitors; the fix is "run tests in the foreground" in every prompt.

**Next:** the 1.0.1 release is SKIPPED (Bilal, 2026-09-19); the trust-fix work ships as part of 1.1 "Accounts" once the checklist is done and a device smoke passes. Never re-ask about 1.0.1.

**NIGHT RUN 2026-09-18 → 19 (Bilal: "work on this tonight so tomorrow morning
this is all done"). ADR 0001 ACCEPTED.** 16 tickets filed + boarded:
auth-service#9 A1 registry, #10 A2 refresh rotation, #11 A3 cold start,
#12 A4 shared middleware (new public repo `bamware-auth-middleware`);
bamware-ios#2 B5 BamwareAccounts lift, #3 B6 refresh, #4 B7 Apple+Google,
#5 B8 BamwareAccountUI, #6 D13 BamwarePush; infra#8 D12 push service
(plan-only); venue-engine#84 C10e saved sync API; brewdesk#174 C9 adopt +
gate off, #175 C10 sync adapter, #176 HUMAN-ONLY console steps; mcp#1 E15.
Waves (same-file collisions in auth-service handlers force order): 1 = #9,
#12(pkg+venue-engine only), ios#2 · 2 = #10, ios#3, ios#4, ios#6 · 3 = #11,
#12 auth-service adoption, ios#5, ve#84 · 4 = bd#174, bd#175, infra#8, mcp#1.
Sonnet DEV agents, supervisor QA + merge, PR-only in auto-deploy repos.
Known blockers (flagged, not faked): auth-service private-repo Actions may not
deploy; Terraform applies, Apple/Google console, APNs key, ASC privacy label
are Bilal's (#176). Morning report goes at the top of this file.

**Wave 1 progress — #12 A4 (pkg + venue-engine slice) DONE, 2026-09-18.**
New public repo `mrbam88/bamware-auth-middleware` live, tagged `v0.1.0`
(CI green: build+test+gitleaks on GitHub Actions). Exports
`TokenPayloadSchema` (copied verbatim from auth-service
`src/schemas/authSchemas.ts`), `verifyAccessToken`, Express `authenticate`,
`requireRole`. **Lesson worth keeping:** the first tag shipped with no
`prepare` script, so `npm install`ing the git tag pulled source with no
built `dist/` — caught immediately while adopting in venue-engine, fixed,
and the `v0.1.0` tag was moved (safe only because nothing else depended on
it yet). Any future from-source git-dependency package needs a `prepare`
script from the start.
`bamware-venue-engine` PR #89 (`chore/auth-middleware-dep`) adds the
dependency + an import smoke test only (no route wiring, per scope) —
`npm run typecheck` and `npm test` (522 tests) green, Vercel preview
deployed clean. **Not merged — PR-only, supervisor merges.**
auth-service adoption deliberately deferred (that repo's handlers are
being edited live by #9/#10 right now) — follow-up filed:
auth-service#14. Also filed per spec: dating-service#20, web#40.

**Wave 4 progress — infra#8 D12 push service DONE (plan-only), 2026-09-18.**
New private repo `mrbam88/bamware-push-service` live, main pushed directly
(new/unprotected). CI green: build+test+gitleaks, 60 tests, `pnpm build:lambda`
verified to bundle `node_modules/@bamware/auth-middleware/dist`. `POST
/devices` / `DELETE /devices/:deviceId` (any registered tenant) match
`bamware-ios`'s `BamwarePush` wire contract exactly; internal `POST /send`
behind timing-safe `X-Service-Key` (503 fail-closed when unset, venue-engine
admin-auth pattern); `PLATFORM_APP_ARNS_JSON` env map doubles as this
service's tenant registry (`bamware-dating` + `bamware-brewdesk`, matching
auth-service's `tenants/registry.ts`). **Correction to the ADR/ticket
spec:** `@bamware/auth-middleware` v0.1.2's `authenticate({ secret, tenantId
})` has `tenantId` **required**, not optional — it can't express "any
tenant." Worked around with the package's own documented
`verifyAccessToken` direct-verification path instead of `authenticate()`;
tenant allow-listing moved to `PLATFORM_APP_ARNS_JSON`. Matters for any
other consumer that needs multi-tenant (not single-hardcoded-tenant) auth.
`bamware-infra` PR #10 (`feat/push-service`, plan-only): push Lambda +
api-gateway + DynamoDB table (+GSI1 for send-by-deviceIds) + one new
per-tenant SNS platform app for `bamware-brewdesk` (`bamware-dating` reuses
the existing `module.push_notifications`); `modules/sns` gained an optional
`tenant_id` var (default `""`, no behavior change for existing callers).
`terraform validate`: Success. **Not applied — Human-only**, blocked on
infra#7 (APNs key) — commented on infra#8 with the full apply checklist.
**Not merged — PR-only, supervisor merges** (infra PRs never self-merged).

**Architecture decided-in-principle (2026-09-18) → ADR 0001
`docs/adr/0001-one-identity-platform-for-all-apps.md` + `docs/bamware-account-platform.md`:**
accounts/sign-in/sessions/deletion/push are Bamware platform, not app code —
auth-service (already multi-tenant with Google+Apple verification) + new
`bamware-ios` products BamwareAccounts / BamwareAccountUI / BamwarePush +
a shared push service + `@bamware/auth-middleware`. Lift BrewDeskKit's
account stack, don't rewrite. **Correction:** push is NOT built (bd#94/ve#34
closed not-planned; only local notifications exist). Bilal to accept the ADR.

**Phase 2 reassessed (Bilal, 2026-09-18): "Accounts & alerts" is the next big
thing.** Card polish judged fluffy; live "right now" layer and speed test
parked as marketing-adjacent; community = baseline boilerplate. Scope in
`docs/brewdesk-gameplan-2026-09.md` §1.1: open the store gate for good
(privacy label changes), account value prop + Sign in with Apple, saved-spots
sync (new engine endpoint + `SavedVenuePersisting` adapter), alerts on the
already-built push rail (digest exists; saved-spot changes + new nearby spots
new), community photos/ratings on, lists + notes, auth-service hardening
(auth#7 cold starts, auth#8 refresh). **Bilal, same day: account creation,
management, onboarding and basics FIRST, with BOTH Google and Apple sign-in**
(→ SIWA mandatory, first third-party SDK, auth-service token verification).
Human-only: infra#7 APNs key, Google OAuth client IDs, Apple Sign-In
capability, privacy wording, `ADMIN_KEY`. Tickets not yet filed.

**Game plan (2026-09-16) → `docs/brewdesk-gameplan-2026-09.md`** — proposed,
awaiting Bilal's cut, no tickets filed. Sequence: 1.0.1 "Trust fix" (4 critique
bugs, no score for unobserved venues, snapshot refresh, review prompt) → 1.1
"Useful every day" (distance/open-now, verdict hero, colorblind pins, business
info, plus free NYC data work) → 1.2 "Community on" (open the store gate,
one-tap speed test, account value prop) → NYC marketing → Plus. **Human-only
deadline: Play key registration by 2026-09-30.** Open decision: photo-cost
mitigation before any launch post. Board hygiene 09-16: 43 closed tickets → Done.

**NYC data spike (2026-09-12, Bilal: "dominate NYC, cheap, no wasted ideas") →
`bamware-venue-engine/docs/research/nyc-data-improvement-2026-09.md` (PR #62).**
No paid API has a laptop-friendly field; Google/Foursquare cheap but forbid
storing content; Yelp ~$50/mo via its 24 h cache rule (rejected again). Free
signal we don't use: OSM `internet_access` on 492 NYC cafés, `outdoor_seating`
on 876, `laptop=*` on 5 (Overpass counts verified live). NYC open data (NYPL/
BPL/QPL branches, LinkNYC, Wi-Fi hotspots, POPS) = thousands of storable pins
for $0. Cheapest LLM research: Perplexity Sonar base ~$5.40/300 venues; the
ve#4 pipeline has NO web search wired, so its quotes can't be trusted yet.
**Plan: $0 this week** — ship ve#39/#40/#41 (still open since August), OSM
re-import with the proven tags, open-data ingest, laptopfriendly.co scrape
(92 NYC venues); then a gated $0–2/mo Sonar batch. Awaiting Bilal's go.

**Approval-day critique (2026-09-12) → `bamware-brewdesk/docs/product-critique-2026-09-12.md`**
(PR #153; visual version with screenshots:
https://claude.ai/code/artifact/4d4f88d3-b670-466d-b256-9bdb3cdedcc6).
Verdict: the promise is stronger than the data. Measured live: 21 of the top
200 NYC venues have researched claims (179 estimates), seating unknown on all;
outside NYC 0 venues know laptop policy/seating/outlets and every score is
50–55, so ranking is meaningless. Four real bugs found: pins vanish after
clearing search, search text persists + appends across relaunch, search does
not pan the map, blank tiles on the "Use Union Square" path. Polish sprint
order recommended: bugs → unknown-experience rework (no score at 0%
confidence, estimates visibly "not checked yet") → distance + open-now on
cards + plain-English verdict → colorblind-safe pins + dark mode → open the
community gate → research depth (top 30 in 5 metros) before breadth.
Awaiting Bilal's cut before tickets are filed.

**Native platform track:** `bamware-brewdesk` is the SwiftUI proving ground for
`bamware-ios`; `bamware-venue-engine` is the companion local Express API.
The Xcode development workspace substitutes the sibling shared-package checkout
so app and reusable modules can evolve together.

**Flutter/Android track (decided + booted 2026-08-24):** private
`mrbam88/bamware-brewdesk-flutter` is the Android-first BrewDesk client, not a
shared-code rewrite. MVP at `623bda5`: Spots map/shelf, location with Manhattan
fallback, search/filters, claim-level provenance, photos, directions, local
accountless saves, Material 3 light/dark, production Venue Engine. Pixel 10
boot/detail/save flow passed; analyzer + 3 tests + debug APK + gitleaks green.
Epic flutter#1; Agent-ready #2–4; Human-only Play bootstrap/signing #5. Fan-out
held because private-repo Actions billing still prevents CI jobs from starting.

**BrewDesk product direction (decided 2026-08-19):** a WFH-spot finder, not a
café finder — cafés + parks/libraries/malls (`venueType`), 95–100% AI-researched
data via a scheduled agent pipeline. Source policy (Bilal, 2026-08-20,
supersedes the earlier same-day ruling): ANY publicly available internet
source may be used for workability/ranking data — Google, Yelp, forums,
blogs, review sites, all of it; scraping is allowed. Bilal owns and accepts
the ToS/legal exposure. Licensed APIs still used where they fit (e.g. Google
Places Photos for venue images, place_id server-side, display-only with
attribution).
Admin/community as optional layers later. Scoring
reweights to Bilal's ranking: laptop policy (incl. visible "laptops banned")
> seating > wifi > noise, outdoor as bonus; recency decay. Provenance labels
say "updated <date> · <source>" — never "verified" without a human. Community
features are post-approval only (Apple 1.2 UGC surface). Approval plan: submit
→ Resolution Center reply (pre-written) → appeal; evidence base in
`docs/app-review-field-notes.md`. Tickets: brewdesk#1–8 + venue-engine#1–4,
all boarded/fielded; brewdesk#1 is P0 (reviewer-in-California location bug
empties the map — found 2026-08-19, blocks submission).
**Approval lane status (2026-08-21):** brewdesk#26 → PR #35, #27 → PR #38,
#29 → PR #39 (privacy-claim verifier: request audit + Release manifest tests;
go-live item 1 closed — Vercel Runtime Logs keep Search Params 1 h on Hobby;
anchor-when-denied kept by decision; follow-up venue-engine#16 moves viewport
coords out of the query string; venue-engine#19 Human-only parks the Vercel
evidence paste + six observability holes for triage). **All three merged 2026-08-21 (~04:00Z); board #26/#27 QA Passed, #29 Ready for QA.** Next pick: brewdesk#34 (stat strip never rendered — bugs first) → PR #40, Ready for QA 2026-08-21; flags: `ProvenanceStamp` renders `seededAt` a day early (Aug 3 UTC → "Aug 2"), map strip legible only off-pin — both #30 screenshot concerns. **brewdesk#28 cold-start → PR #43 Ready for QA (2026-08-21):** bundled 50-venue snapshot (`BrewDesk/Resources/VenueSnapshot.json`, refresh via `scripts/refresh-venue-snapshot.sh`) paints first; `-UITestSeedSnapshot` + `offlineThenRecovers` scenario; auto-retry on reconnect needs a device airplane-mode check (QA). Remaining Agent-ready: #30, #36, #37; venue-engine#16.
#28/#30 unblock when #35/#38 merge.

**Baat track: 🔴 REJECTED 2026-08-04 — Guideline 4.3(b), spam / saturated
category.** Verbatim text: the 2026-08-04 log entry below.
Concept rejection, not a bug — Apple's instruction was "submit a new app," so
**the native iOS track for Baat is closed** (PWA is the only surviving path). Do
not resubmit, re-skin, or appeal on feature merits. Backend, auth, infra, and
the EAS→TestFlight→fastlane rail are unaffected and are the reusable assets.
Still open regardless: the 2026-07-23 fan-out PRs are **no longer open** (0
open PRs across all repos, verified 2026-08-19 — merged or closed; history in
each repo); JWT_SECRET needed in Vercel
before web#10; ENVIRONMENT=prod needed on prod dating Lambda. Play Console
bootstrap is moot for now (Google has no 4.3 equivalent, but Baat's iOS
concept problem is not an Android fix).

**Two-app goal (stated 2026-08-15):** ship one SwiftUI app (BrewDesk) and one RN
app, for Bamware branding + interview evidence. The RN app is now selected for
4.3 survivability first: no UGC, no accounts, no IAP in v1, category with no
incumbents. Reuse the Baat **rail**, not the Baat app.

**Open-source track (decided 2026-08-20, shipped 2026-08-31):** Baat is public
at `mrbam88/bamware-baat` (Bilal renamed it from the ticketed `baat-rn`),
MIT — a portfolio showcase for interviews, NOT a relaunch (native
iOS track stays closed under 4.3(b)). Fresh-history repo, never a visibility
flip of `bamware-dating-app` (revoked Apple creds remain in its history).
Backend + white-label engine stay private. Epic bamware-ai#9; tickets #4
(secrets audit, **P0 Human-only — gates everything**), #5 export, #6 hygiene
pack, #7 README-as-architecture-article, #8 profile visibility sweep (19
public → 5: bamware-ai, bamware-ios, DSA-Practice, baat-rn, bamware-brewdesk).
**BrewDesk too (#10 flip + #11 README):** visibility flip of `bamware-brewdesk`
once the audit confirms clean history; `4.3-preflight.md` + review notes move
out first; `bamware-venue-engine` stays private (data + scoring = the product).
Recommended flip date: App Store submission day, after brewdesk#1. All boarded.

## Shipped ✅

- **2026-08-19 — Dev-QA loop (process).** Board 2 statuses now Todo → In
  Progress → Ready for QA → QA Passed → Done. New skills:
  `definition-of-ready` (grooming gate — readiness is checked in daylight,
  never at 3am) and `qa-engineer` (verify PRs with evidence, file `bug`
  tickets back to DEV). `standing-engineer` rewritten: finish-and-flag —
  only three abort reasons (credentials, brewdesk#7, would-touch-main);
  bug tickets on own PRs are pulled first; claims require quoted evidence
  (`scripts/check-ci-gate.py` for CI claims). Terminology: tickets, never
  cards. Nightly cloud QA scheduled for backend repos. Merging stays with
  Bilal. Incident recorded in docs/incidents.md (false "no CI" claim
  reached the digest).

- **2026-08-19 — Machine-portable harness.** Any Mac rebuilds the full dev
  setup from `gh auth login` + clone + `scripts/bootstrap.sh` (sibling repos,
  skill installs, Claude Code symlinks, opencode config from template). Every
  repo's `AGENTS.md` now leads with the bamware-ai system map and carries a
  `CLAUDE.md` import shim, so Claude Code auto-loads org context in any repo —
  parity with opencode. Principle codified: a laptop is a cache of this repo;
  nothing on a machine is authored locally (README "New machine").

| Date | What |
|---|---|
| 2026-09-12 | **🎉 BrewDesk 1.0 (build 19) APPROVED and LIVE on the App Store** — Apple ID 6802930990, https://apps.apple.com/us/app/id6802930990. Cleared Guideline 2.1 Information Needed (reply sent 2026-09-09) with no 4.3(b) ruling. Release branches retired, bamware.io store links live (web PR #36), Android unparked. |
| 2026-08-31 | **Baat open-sourced → `mrbam88/bamware-baat` (public, MIT) + profile visibility sweep.** Ticket #5 executed: fresh-history export of `bamware-dating-app@main` (fa0d148), single commit, CI green on it (typecheck + 231 Jest tests + secret tripwire), gitleaks clean. Name `bamware-baat` per Bilal (ticket said `baat-rn`). Per audit #4 "not-secret" findings, `fastlane/` (certs excluded), `.maestro/`, `docs/RELEASING.md`, Gemfile were KEPT as showcase exhibits (README #7 links them) with identifiers placeholdered: bundle → `com.example.baat`, team id / apple id / EAS projectId stripped. `src/config/tenant.ts` → `app.config.ts` (`AppConfig`), tenantId `baat`, endpoints env-ified (`EXPO_PUBLIC_AUTH_URL` / `EXPO_PUBLIC_DATING_URL`). `client-core` / dating-service names survive only as prose in README + ADR 0001. Unverified criterion: simulator boot smoke. **Visibility sweep (executed per Bilal live; supersedes #8's list):** 23 public → 7: bamware-ai, kinesis, bamware-ios (kept — public bamware-brewdesk's packages), brewdesk-web, bamware-brewdesk, bamware-brewdesk-flutter, bamware-baat. Other 17 now private (incl. DSA-Practice, contra #8; PeopleCRM fork flipped fine). Every flipped-public repo history-scanned with gitleaks first. `bamware-dating-app` stays private (tainted history), unrenamed. |
| 2026-08-21 | **bd#37 shipped → PR #42 (Ready for QA):** live-data UI tests are rank-independent — new `BrewDeskUITests/UITestHelpers.swift` (`mapPins`/`venueRows`/`firstVenueRow`, match element shape not venue name); `testSaveCafeFromDetails` opens the top-ranked row and carries its name; two venue-detail a11y tests navigate the same way; screenshot rig swaps its two rank-dependent asserts only (composition left for #30). Release on iPhone 17 Pro Max against production: all BrewDeskUITests green except `testVenueDetailAccessibilityAudit`, which now navigates and fails on audit content (hero link hit-area/contrast = bd#36). Found: a cross-test interaction (an earlier save flips "Save"→"Saved" on the top venue) — fixed with `-brewdesk.saved-venue-ids ""`. Overnight supervisor session QA-merges under the Actions-billing waiver; #30 handed to it. |
| 2026-08-20 (late) | **Approval lane opened — brewdesk#27 empty/error-state audit → PR #38, Ready for QA.** Every screen (Map/List/Detail/Saved/Import/Methodology) now has an intentional state under engine 500, empty, offline, photo failures, slow, location denied; 18 fixture-driven `DegradedStateTests` green in Release on iPhone + iPad. The ticket's premise "stub listing injectable already" was false — `RootView` ignored injection under DEBUG — so a launch-arg seam was added: `-UITestScenario <fixtureOK|engineDown|offline|emptyVenues|photosEmpty|photosFail|slow>` + `-UITestLocationDenied` (`ScenarioVenueService` in VenueKit). **#26 and #28 should build on it.** Also: `VenueAPI` 15 s request timeout (was 60), Import no longer blames the file for an engine failure, Saved surfaces partial hydration failures. Full Release suite found 3 pre-existing failures, filed: brewdesk#36 (methodology link fails a11y audit: hit area + contrast) and #37 (live-data tests hardcode "Gregorys Coffee", now rank 12 after the day's rescoring → `testSaveCafeFromDetails` + screenshot rig fail; overlaps #30). Board hygiene: brewdesk#1–6, #8 were already merged (PR #17/#23/#24) but sat in Ready for QA → moved to Done. **Tooling:** 32 third-party skills installed with the `skills` CLI are now committed here (`.agents/skills/` real copies, `skills/`+`.claude/skills/` symlinks, `skills-lock.json`); `check-context.py` skips symlinked entries (see skills/INDEX.md "Third-party"). |
| 2026-08-20 | **Approval lane: reviewer simulation shipped (brewdesk#26 → PR #35, Ready for QA).** One scripted Release XCUITest replays App Review's first 10 minutes (fresh install → decline location → browse/filter/search → detail → methodology → grant location simulated at Cupertino → relaunch), asserts visible content per step, attaches 12 screenshots; passes on iPhone 17 Pro Max (69.5s) + iPad Pro 13-inch (M5) (78.0s). New `reviewer-sim.yml` uploads both xcresults + flat PNGs as `reviewer-simulation-evidence` on PR/main/manual (macOS minutes ×10 on a private repo — trim to main+manual if quota bites). **Defect found by the run → brewdesk#34:** the dataset stat strip never renders (`.task { loadHealth() }` on an empty `Group`; `/v1/health` is fine; PR #12 was verified by package tests + build only) — P1/S/Agent-ready. Offline step pending on #27's `-UITestScenario offline` seam (interface pinned in #27's body). First parallel-session run: two Claude Code sessions on #26/#27 with an explicit file fence negotiated via SendMessage — learnings in skills/agent-fanout. |
| 2026-08-20 | **AI data day — photos live, evidence rail built, economics disciplined.** Google Places photo rail shipped end-to-end (place-id backfill 2,174/2,180, proxy `/photos`, app gallery with tap-to-expand attribution). Photo classifier (workspace/food/other; measured: ~50% of Google café photos are food) filters galleries tables-first; labels keyed `placeId#index` after discovering photo NAMES rotate per session (~$10 of labels lost to that bug, owned + fixed). Venue-level vision analysis (`analyze-venues.ts` + `photo-evidence.ts`) turns photos into conservative scoring evidence — seating/laptops/outdoor claims (`source: agent`, capped confidence, human data never overwritten) + retail-counter flags for review; smoke-proven (Gregorys → seating: scarce). Cost overrun forced discipline: **spend rule (quote-and-confirm before any paid run) + `docs/ai-data-pipeline-plan.md` with decided $10/mo cap, Haiku relabel (~4.3k/10k done), post-approval evidence gate (50-venue sample must move rankings)**. Business-info ticket (ve#15, OSM-first — Google Enterprise fields would blow the budget) + community epic (bd#25, supersedes bd#7; reuses Baat upload/auth rails). **Approval lane groomed: brewdesk#26–33** (reviewer simulation, empty-state audit, cold-start, privacy-claim verifier, screenshots sans Google photos, metadata finals, rejection response pack, submission runbook → 1.0(3) → Submit). Goal restated by Bilal: Apple approval, nothing else. |
| 2026-08-19 | **BrewDesk pivot + approval sprint specced.** Product redefined as AI-researched WFH-spot finder (see Now building). 12 tickets filed and fielded on the board: brewdesk#1 out-of-coverage location fallback (P0 — reviewer in CA gets an empty map today, `CafeMapScreen`/`VenuesModel` query 2.5km around user), #2 provenance stamps ("updated <date> · source"), #3 dataset stat strip, #4 methodology screen, #5 laptop-policy chips incl. Banned + venueType, #6 Google Takeout saved-places import (on-device, Apple Maps has no export), #7 community v1 (P2, DO-NOT-BUILD pre-approval), #8 listing v2 (AI-transparency positioning); venue-engine#1 schema v2 (seating/venueType/outdoor/photos/source enum), #2 scoring v2 (reweight+decay), #3 Takeout seed import script, #4 agentic pipeline v0 (Supervised, needs source whitelist sign-off). Also: `docs/app-store-rejections.md` removed (asserted unverified "account flagged" as fact) → replaced by sourced `docs/app-review-field-notes.md`; Atly teardown updated with 2026-08-19 capture (price doubled to $69.99, still zero provenance). Bilal's Takeout export of ~top-30 saved cafés = pending input for engine#3. |
| 2026-08-19 | **BrewDesk 1.0 (2) is VALID and IN_BETA_TESTING for internal TestFlight.** The release at binary commit `bamware-brewdesk@7bb2109` adds local Saved cafés, Directions/Share actions, English/Spanish localization, iOS 26 Liquid Glass with an iOS 17 material fallback, accessibility-size layouts, VoiceOver state, Reduce Motion behavior, typed venue queries, constructor-injected capability protocols, and removes the Factory dependency. Package tests, all 16 Release app/UI tests, accessibility audits, live production screenshot flow, iPad Pro compatibility smoke, development-workspace Release build, identity/security checks, opaque 1320×2868 screenshots, and unsigned archive pass. Xcode cloud-managed distribution signing uploaded build 2; Apple reports `VALID` and internal testing active. Remaining gate for this exact build: physical iPhone install and permission/accessibility smoke. Source/docs are pushed through `bamware-brewdesk@42f3b1c`; no backend contract changed. |
| 2026-08-19 | **BrewDesk 1.0 (1) uploaded to TestFlight and Apple processing is VALID.** App Store Connect record exists for `io.bamware.brewdesk`; evidence-first metadata, review notes, 4.3 preflight, five opaque 1320×2868 screenshots, deterministic Release screenshot automation, and the native fastlane CI rail are committed at `bamware-brewdesk@cbbc25f`. The first build used Xcode's App Store Connect API-key authentication and cloud-managed distribution signing because Baat's EAS certificate had no exportable private key on this Mac; no credential values or app changes were committed. The protected GitHub `production` environment remains restricted to `main` but cannot run until it receives an exportable distribution `.p12`. Package tests, full Release app/UI tests, iPad Air iPhone-compatibility smoke, development-workspace Release build, identity check, and unsigned device archive pass. Build 1 was subsequently installed and working on a physical iPhone. Remaining App Store gates: physical location states, production logging confirmation, questionnaires, and submission. |
| 2026-08-18 | **BrewDesk identity and Swift concurrency checkpoint verified.** Canonical app/project/scheme/module identity is `BrewDesk`, package `BrewDeskKit`, bundle `io.bamware.brewdesk`, repo `bamware-brewdesk`. Dead auth/StoreKit code removed; app uses structured cancellable loading, async Core Location, strict Swift 6 approachable concurrency, export-compliance flag, and a UserDefaults privacy manifest. Package tests, app tests, UI launch, sibling-package workspace build, Release build, and unsigned device archive pass. Archive contains no legacy identity, StoreKit linkage, or dev-auth URL. |
| 2026-08-04 (recorded 08-15) | 🔴 **Baat v1.0 (6) REJECTED — Guideline 4.3(b) spam.** Submission `029740e2-f219-407d-b065-996ada511f12`, reviewed on iPad Air 11-inch (M3). "There are already enough of these apps on the App Store… reconsider the app concept and submit a new app." Concept rejection — unfixable in the binary, unappealable on feature merits; Apple pointed at a PWA. 4.3(b) pre-flight gate added to `skills/store-submission`. **BrewDesk flagged as exposed** — cafe finder with the speed test cut from v1, i.e. the differentiator is not in the binary. |
| 2026-08-05 | **BrewDesk v1 decisions locked:** guest discovery, free launch, optional accounts only with cloud saves plus in-app deletion, conversation prototype deferred, iPhone-only. Prototype preserved at tag `conversation-prototype-v0.1.0`; production plan lives in `docs/brewdesk-go-live.md`. |
| 2026-07-23 | **Biggest fan-out yet: 13 PRs across 5 repos, 8 of 9 backlog issues** (overnight+morning; separate session from SSO work). P0 account deletion end-to-end (app#22 + service#15 + auth#4 + web#9), admin JWT hardening (web#10), isFake prod guard (service#13), push deep links + payload contract fix (app#23 + service#14), profile prompts (app#24), onboarding cultural steps (app#25 — server strips new fields, schema follow-up open), login QoL/Face ID (app#26, needs native build), daily batch (service#16 + infra#4). All PRs tsc+tests green, PR-only. NOT done: app#6 contract layer (stopped mid-run). **Lesson: fleet stalled ~8h on permission prompts → new precondition in skills/agent-fanout** |
| 2026-07-23 | **bamware-mcp shipped** (closes #1): MCP server repo `mrbam88/bamware-mcp` — create_tenant (tenant-config PR into app repo; E2E demo `demo-glow` PR passed app CI), seed_demo_data (`POST /admin/seed`, ADMIN_SECRET stays with humans), board_ops (Projects #2 via gh), provision_dedicated (renders `environments/<customer>/`, terraform apply human-gated). tsc+29 vitest green, MCP inspector pass, gitleaks in CI. Follow-up: app-side build-time tenant selection (copy `tenants/<id>.ts` over `tenant.ts` in release pipeline) |
| 2026-07-23 | **🚀 SUBMITTED TO THE APP STORE** — v1.0.6, full listing via fastlane deliver, 6.5" screenshots, privacy labels, appreview demo account (verified live), bamware.io/baat marketing page shipped |
| 2026-07-23 | **Launch-day pack complete**: real app icon (serif B + ✦), bamware.io/terms + /privacy LIVE (also fixed month-broken Vercel deploys — dead client-core dep), ASC listing pack + privacy labels, seeded demo account, 5 App Store screenshots (6.9", automated capture) |
| 2026-07-23 | Launch-day fixes: matches showed UUIDs → server sends matchedName/matchedPhoto; commonground grammar ("You share X"); icebreaker banner copy; sim builds need ad-hoc signing (CODE_SIGNING_ALLOWED=NO strips Keychain → login breaks — also fixed in E2E workflow) |
| 2026-07-23 | **v1.0.6 → TestFlight ✅ SUBMITTED** (icon + legal); production-channel OTA live — store builds receive JS fixes (name-fix + banner shipped that way) |
| 2026-07-23 | **v1.0.5 → TestFlight**: the overnight drop — block/report end-to-end (Apple P0 ✅), profile detail view, live match scores, working discovery filters (build ✅, submit in flight) |
| 2026-07-22 | **First Android boot of Baat** — debug build via `expo run:android` (CNG prebuild from app.json), sign-in + sign-up render & navigate on Pixel emulator, zero crashes; theme/fonts/edge-to-edge correct. Local rail: JDK 21 (AS JBR) + `ANDROID_HOME=~/Library/Android/sdk` |
| 2026-07-22 | **v1.0.4 → TestFlight: first agent-built feature drop, fully automated rail** |
| 2026-07-22 | **First agent fan-out: 3 parallel agents → 3 PRs → all merged** (#7 icebreaker banner, #8 match % badges, #9 settings screens; ~5-11 min each, 57/57 tests, boot-verified) |
| 2026-07-22 | Apple credential rotation DONE: old ASC key + app-specific password revoked, new `baat-ci-eas` key in EAS credentials, `ascAppId` set — iOS rail fully wired |
| 2026-07-22 | **v1.0.3 shipped to TestFlight — first fully-automated release** (dispatch → EAS build → submit, zero laptop involvement; new profile w/ push + deep-link entitlements) |
| 2026-07-22 | Mobile CI/CD: merge→OTA preview, tag→TestFlight/Play (gated); first OTA publish succeeded |
| 2026-07-22 | Security: committed Apple creds scrubbed from HEAD, CI credential tripwire, Maestro creds → env |
| 2026-07-22 | Chat contract fix (matches pagination envelope) — chat UI works again |
| 2026-07-21 | Baat design language shipped via tenant config (PR #1): serif/gold, theme engine |
| 2026-06 (agents) | Backend hardening: pagination, rate limiting, Secrets Manager, GSI discover, auto-deploy |
| 2026-06 (agents) | App: sign-up, onboarding wizard, forgot-password + deep links, push notifications, Sentry |
| 2026-05 | Core loop live: auth, profiles, photos→S3, discover, swipe/match, messaging |

## In flight 🔨

**BrewDesk approval lane (#26–33)** — #26 (PR #35), #27 (PR #38), #29 (PR #39) all
**merged 2026-08-21**; #34 → PR #40 **merged**; #28 cold-start → **PR #43 Ready for QA** (2026-08-21). #30
Todo + Agent-ready (use the `-UITestScenario` seam from #27; #30 after #34/#36 land so
screenshots show the fixed UI); #31 Human-only; #32/#33 Supervised, #33 last. Follow-ups
#36 (a11y) + #37 (test drift) Todo/Agent-ready. venue-engine#16 (coords out of query
string) Agent-ready; #19 Human-only (Vercel evidence paste still empty
2026-09-16 — Search Params slot in `docs/brewdesk-go-live.md`; MCP cannot
supply that panel; six observability holes still triaged on #19).

**BrewDesk transparency set (#1–8)** — all merged; board moved to Done 2026-08-20:

- brewdesk#1 out-of-coverage location fallback — **P0, blocks submission.** A
  reviewer in California gets an empty map; `CafeMapScreen`/`VenuesModel` query
  2.5km around the user.
- brewdesk#2 provenance stamps · #3 dataset stat strip · #4 methodology screen ·
  #5 laptop-policy chips incl. Banned + venueType — together these are the
  4.3(b) differentiator, visible in the binary
- brewdesk#6 Google Takeout saved-places import (on-device; Apple Maps has no export)
- brewdesk#7 community v1 — **P2, DO-NOT-BUILD pre-approval** (Apple 1.2 UGC surface)
- brewdesk#8 listing v2 (AI-transparency positioning)
- venue-engine#1 schema v2 · #2 scoring v2 · #3 Takeout seed import —
  **merged 2026-08-19 (PRs #5/#6/#7).** brewdesk PR-level CI also merged
  (brewdesk PR #9), so brewdesk tickets now pass the readiness gate.
- Venue images (decided 2026-08-20): Google Places Photos via a
  venue-engine proxy — place_id backfill, photos display-only with
  attribution, API key server-side. Ticket to be filed.
- venue-engine#4 agentic pipeline v0 — **unblocked 2026-08-20**: source
  policy signed off, anything publicly available is fair game. Ready to
  spec/build.

**Baat (bamware-dating-app) — frozen since 2026-08-04.** The native iOS concept
is closed under 4.3(b). Listed because the code and the rail are reusable
assets, not because this work is queued.

- the 2026-07-23 fan-out PRs are closed (0 open PRs verified 2026-08-19)
- [#3](https://github.com/mrbam88/bamware-dating-app/issues/3) onboarding cultural
  steps — merged, but the server strips the new fields; schema follow-up open
- [#6](https://github.com/mrbam88/bamware-dating-app/issues/6) contract-layer ADR
  (client-core fate) — needs Bilal's decision
- ~~#2 badges~~ ✅ · ~~#4 icebreaker~~ ✅ · ~~#5 settings~~ ✅ ·
  ~~service#1 match scoring~~ ✅ · ~~service#2 discovery prefs~~ ✅ merged+deployed

## Blocked on Bilal 🔴

**BrewDesk — these gate submission:**

- Physical-iPhone smoke of build 1.0 (2): permissions + accessibility. Build 1
  was installed and working; build 2 has not been on a device.
- Google Takeout export of the ~top-30 saved cafés → input for venue-engine#3
- An exportable distribution `.p12` → unblocks the protected `production` GitHub
  environment. Both TestFlight builds used Xcode cloud-managed signing because
  Baat's EAS cert has no exportable private key on this Mac.
- Remaining App Store gates: physical location states, production logging
  confirmation, questionnaires, submission

**Google Play — deadline 2026-09-30 (Human-only, ~5 min):** Android developer
verification. Register `io.bamware.brewdesk` + its signing key in Play Console
("Register your apps and signing keys"); Play-distributed apps are pre-filled,
Bilal reviews + confirms. Unregistered apps are removed from Play globally after
2026-09-30. Final-reminder mail 2026-08-31.
**Play production gate confirmed 2026-09-08:** personal account → closed test
with ≥12 opted-in testers for ≥14 consecutive days, then "Apply for access to
production" questionnaire. Status: 0 testers opted in. Clock has NOT started.
Earliest production ≈ 14 days after the 12th tester opts in.
**Decision 2026-09-08 (Bilal): Android PARKED.** No tester hunt, no org
account, no self-made tester accounts (ToS violation, account-ban risk).
Revisit after Apple approves. Only Android to-do before then: the 2026-09-30
package/key registration above. No Play review-outcome email has
arrived since the 2026-08-31 submission (checked 2026-09-08).

**Infra / credentials — not blocking BrewDesk:**

- 🔴 **A plaintext password was committed to this public repo** and sat in this
  section until 2026-08-19. Treat it as compromised: rotate it and anything that
  reused it. Removing the line does not purge git history.
- Rotate `MAESTRO_*` GH secrets and `ADMIN_SECRET` (the latter was pasted into a
  chat transcript)
- `JWT_SECRET` in Vercel (before web#10) · `ENVIRONMENT=prod` on the prod dating Lambda
- Auth token refresh — Baat sessions die after ~30 min
- **baat-rn gate (#4):** verify Apple revocation at ASC, rotate `ADMIN_SECRET` +
  `MAESTRO_*` — nothing goes public before this
- Paste the bamware Claude Project instructions block (see docs/incidents.md
  2026-08-20) — forces `bamware-context` on every Cowork session
- Google Cloud service account → Play Console API access. Parked: Google has no
  4.3 equivalent, but Android is not a fix for a concept rejection.

## Next up 🗺️

- Land brewdesk#1, then the transparency set (#2–#5) — that is what makes the
  differentiator visible in the binary, which is what the 4.3(b) preflight demands
- venue-engine: schema v2 → scoring v2 → Takeout seed → agentic pipeline v0
- Pick the RN app concept for the two-app goal: no UGC, no accounts, no IAP in
  v1, category with no incumbents
- Boot + Maestro smoke gate in CI → unlocks overnight agent runs

## Known debt 🧾

- client-core orphaned by both consumers (→ dating-app#6)
- Apple creds in git history — revoked; purge optional. See also the plaintext
  password under Blocked.
- `bamware-workspace` submodule pins stale (May-era)
- SDK-56/54 package drift fixed by pinning — run `npx expo install --fix` check on SDK upgrades
- Baat jest teardown leak (worker force-exit warning)

## 2026-08-21 (day) — backlog cleared, vault shipped
22 coding tickets merged across 5 repos in one day fleet (community epic:
capture UX, tenant uploads, AI vet queue ticket, observations backend+form,
compliance pack #48, bylines; data epic: OSM business info live in prod
incl. email + locale hours; map perf/clustering #54+#61; UI review #55 →
paint layer #62; drift check, research-pipeline skeleton, client-core
retired, OSS hygiene+READMEs, secrets audit). TestFlight 1.0(5) and 1.0(6)
uploaded FREE via the local Xcode cloud-signing rail (skill updated).
One-key vault live: SSM Parameter Store holds all secrets (docs/secrets.md),
bamware-deployer profile on this Mac, infra PR #6 open for prod tf.
Incidents: ~40min venue-engine outage (ESM require, hotfixed, deploy-path
rule added to qa-engineer skill); one semantic merge collision (#61×#57)
caught by post-merge certification. Bilal still owes: root-key deactivation,
ASC key regen, category/#32/#33 submission path. Spend: $0.

## 2026-08-21 (night 2) — community core complete, TF 1.0(7)
Night fleet (post-22:08 limit reset): store-surface gate #67 merged
(STORE_SURFACE_GATED=YES flips accounts/report/block/observation OFF for
store submissions — the accountless-v1 strategy is one build flag away);
reports endpoint + moderation queue ve#30+#21 merged and live (ADMIN_KEY
env needed in Vercel before moderation usable, fail-closed until then);
capture→upload wiring #71 merged (QA fixed the intake seam to ve#21 as
shipped); live block filter #66 closed. TF 1.0(7) uploaded via local rail.
Pre-submission risk tickets #68-70 parked per Bilal (submission-process
work waits). Spend: $0.

## 2026-08-22 (Sat PM) — Saturday feedback batch shipped, token policy enacted
All four of Bilal's Saturday feedback tickets merged to brewdesk main after
supervisor QA (premerged worktrees, iPhone 17 Pro, Release):
- bd#76 bottom card is a real draggable sheet (peek/medium/full detents,
  session memory, tab bar stays reachable) — PR #83.
- bd#77 all-filters-zero bug: client-side inclusive filtering (unknown
  attribute values are not evidence against a venue) — PR #82.
- bd#78 search-as-you-type: debounced local matching — PR #86 (replaced
  #85, which GitHub closed when its stacked base #82 was squash-merged;
  lesson: don't stack PRs when the base will squash-merge).
- bd#79 Wi-Fi question in Rate-this-visit, both halves: ve#33 merged +
  verified live in prod (wifiQuality → wifi claim, user_report/0.7);
  app PR #84 merged (17e audit contrast failure reproduced on unmodified
  main = pre-existing #60 noise, not a regression).
Token policy (12%-weekly-by-Saturday scare): subagents default Sonnet
(docs → Haiku), frontier only for QA verdicts/design judgment, no idle
polling, supervisors short-lived — codified in AGENTS.md. UI round 2
(bd#75) cron deleted; awaiting Bilal ("run it lean" = single Sonnet
agent). Fleet-worktree litter cleaned from both repos. Spend: $0.

## 2026-08-23 (overnight + Sunday) — Outside NYC shipped, theme shipped, night shift proven
Bilal's brief: churn the backlog overnight, efficiency over speed; then "the
app will not pass Apple approval without outside-NYC" — that epic (bd#107)
went from filed to live in one day.
- **Outside NYC (P0, closed):** ve#48 any-viewport serving — 50 US metros OSM
  baseline (26,309 venues, 1.6MB gz, lazy shards), Overpass live fallback,
  additive contract fields `tier`/`coverage` (ai PR #20, Bilal-approved);
  ve#49 baseline scoring band + provenance; ve#51 estimate-claims fix.
  Live: Cupertino → 30 real venues, `coverage: baseline`; NYC byte-identical.
  App PR #110: real-viewport queries (NYC fallback removed), honest banner,
  provenance "OSM baseline · updated <date>", Cupertino reviewer-sim
  assertion. QA found a real decode bug (engine sends `meta.coverage`, app
  read top-level) and a hanging unit test.
- **Warm Utilitarian theme (bd#98 → PR #109):** Bilal's board: #2D5A4C green /
  sand / sage / #FAF9F6, Hanken Grotesk + Manrope + JetBrains Mono bundled,
  4 button styles, tab tint; 50/50 UI tests light AND dark; capture test
  caught a real Swift 6 actor-isolation crash in iOS 26 async render.
- **Also merged:** bd#95 (UI round 2, closes #75), #96 (shelf flash root
  cause: nil<->value height animation), #99 (visit reminders, Phase A local
  push), #100 (search keyboard dismiss), #103 (LaunchEnvironment — 13
  ProcessInfo greps → 1, CONTEXT.md added), #105 (dark red text tokens),
  #91 (odds audit #90 + rejection pack #32); ve#37 root route, #38/#42
  research spikes, #45 seed matcher (8 ghost duplicates removed, 2172
  venues), ai#18 token-diet policy, ai#19 night-queue skill + `night`
  labels + script; web#13 lint, #14 favicon/OG (live on bamware.io).
- **TestFlight:** three builds uploaded via the free local rail (post-#95;
  post-batch-2; post-#110 with theme + outside-NYC). Build numbers are
  Xcode-managed now (8 was already taken — use manageAppVersionAndBuildNumber
  =true, recorded).
- **Filed:** push epic bd#92 (+#93 done, #94, ve#34, infra#7), bathroom codes
  bd#97 (post-approval), theme #98 (done), architecture C2 backlog, bd#104
  AccountFlow hang (pre-existing), ve#40/#41/#44/#50(done)/ve research
  follow-ups, web#11 BrewDesk-on-web epic, web#12 AI-usage dashboard,
  ai#16 (done)/#17 (done) — board has them all; per-ticket board FIELDS not
  set (Priority/Area/Size) — grooming debt.
- **Night-shift lessons (in skills/night-supervisor):** shared DerivedData
  deadlocks parallel xcodebuild (0% CPU "hangs"); duplicate-named booted
  sims wedge destination resolution — use UDIDs; macOS has no `timeout`;
  agents idling "waiting for background gates" cost supervisor nudges —
  foreground gates; one agent hit 297k tokens and was taken over (its work
  merged after supervisor QA found 2 real bugs).
- **Needs Bilal:** GitHub Actions billing (all CI down); bd#31 metadata
  finals; bd#70 one-line vercel.json choice; APNs key (infra#7); ve#19;
  physical-device check of the new TF build (incl. a Directions-tap visit
  reminder ~2h later). Spend: $0.

## 2026-08-23 (Sunday evening) — WFH-spots slice, serving fixed for real, parallel harnesses
- **WFH-spot positioning shipped pre-submission (Bilal's call):** ve#54 — NYC
  dataset 2,172 → 2,783 (416 parks, 112 libraries, 29 coworking, broader cafe
  tags; Housing Works finally matched, 127m, sim 1.00; caught seed.ts
  re-scoring baseline venues past the band). bd#113 — 21 copy keys "work
  cafés"→"work spots" en+es, a11y fix, screenshots re-shot (café-only frames:
  score-sorted top-50 is cafés by design; optional "library filter" frame is
  Bilal's call). Closes the ve#40 tag-broadening too.
- **Outside-NYC serving actually fixed (deploy-path lesson, again):** the 50
  metro shards never served in prod — first-hit anywhere = "none" in 0.1s,
  retries worked only via the flaky live-Overpass fallback, which also CACHED
  empty results (per-instance bbox poisoning). Fixes: vercel.json
  `includeFiles: data/**` (Bilal-approved, PR #53), /v1/health now reports
  `baseline:{metros,readableShards,failedParse}` (PR #55), empty pulls no
  longer cached, shard parse failures degrade instead of 500ing. Verified
  live: health 50/50/0; Portland first-hit = 50 baseline venues instantly.
  Lesson recorded: my own post-#48 "Cupertino works" live check was actually
  the fallback, not the shards — a green curl is not proof the intended path
  served it; check the diagnostic, not the symptom.
- **Parallel-harness workflow started:** Bilal runs Cursor on bamware-web
  with a supervisor-authored prompt (fenced, evidence-required, no
  self-merge). First PR (#15 member-pages retheme) QA-merged + live-checked
  (sign-up/reset/verify 200). web#13/#14 (lint, favicon/OG) also live.
- **TestFlight:** WFH-spots build uploaded (Xcode-managed number) — includes
  theme, outside-NYC, work-spots copy, all week's fixes.
- Still Bilal: Actions billing · bd#31 · APNs key · ve#19 · ve#41 notes ·
  device smoke. Then bd#69 dry-run → bd#33 → Submit. Spend: $0.

## 2026-08-23 (late) — merge queue cleared
web#16 (legal/admin retheme, Cursor) + web#17 (BrewDesk privacy: Google
Places attribution + work-spots wording) merged and live-verified;
brewdesk#114 merged → #70 CLOSED (reviewer notes cite /v1/health,
copyright.txt added). web#11 groomed by Cursor (5 child tickets 11a–11e:
CORS+shell → map/list → detail → saved → deploy gate) — comment on web#11,
awaiting Bilal approval to file issues.

## 2026-08-23 (session handoff) — parallel harness + grill decisions
**Workflow:** Bilal runs a **Cursor web harness** (bamware-web only; quoted
lint/tsc/build; no self-merge) in parallel with a **brewdesk submission lane**
in the main Cursor session. Merging either repo deploys live — Bilal
QA-merges only.

**Grill settled (2026-08-23):**
- Merge web privacy before ASC submit (Google attribution was the gate — now
  live via web#17).
- brewdesk#70 root-500 fork: **reviewer notes → `/v1/health`**, not
  `vercel.json` (deploy-config Bilal gate).
- brewdesk#31 category: accept memo — **Productivity primary / Food & Drink
  secondary**; Bilal types into ASC (Human-only).
- Submission candidate: **recut TF from current main**, then bd#69 reviewer
  sim, then bd#33 runbook; do not submit an older TF build.
- web#12 (AI usage dashboard): **hold** — needs secrets/ingest design;
  supervised session later.

**Harness note:** background web subagent died mid-run with
`WritableIterable is closed` (Cursor harness stream closed — **not** Claude
rate/spend limit). #4/#5 landed via PR #15/#16 anyway; #17 + brewdesk#114
merged in a later pass.

**Next session picks (ordered):**
1. **bd#69** — `ReviewerSimulationTests` Release on iPhone 17 Pro Max against
   latest TF build from main; archive evidence for bd#33.
2. **bd#31** — Bilal ASC: category, age rating, copyright (2026 Bamware),
   content-rights (OSM + Google Places photos).
3. **bd#33** — cut/upload build, device smoke matrix, deliver dry-run; Submit
   click is Bilal's.
4. **web#7** — `/work/baat` case study (only open web ticket from the batch;
   #4/#5 done; #11 groom-only done).
5. File web#11a–11e as issues after Bilal approves the grooming comment.

**Still Bilal / blocked:** GitHub Actions billing (CI down; local gates +
quoted evidence in PRs). APNs key (infra#7). ve#19 Vercel log paste.
Physical-device smoke + visit-reminder check. Spend: $0.

## 2026-09-16 — NYC data depth sprint (venue-engine, Cursor agents; recorded by a later session)
Nine commits on `bamware-venue-engine@main` 09-15/16, none logged here at the
time. Epic ve#63 "NYC Work Fit is not useful enough to trust" closed with
children #64–#68, #71, plus #41 and #44. What shipped:
- **Estimates no longer drive the score** (ve#64): `estimate` claims and
  anything under 0.4 confidence count as unobserved; the seed stopped
  inventing unrestricted/plenty/quiet tiers.
- **Curated overlay 32 → 57 cafés** with named public-source laptop, seating,
  Wi-Fi, noise claims (ve#66); seating backfilled on 28/32 originals (#41/#65).
- **Libraries + parks researched** (ve#68): seven NYPL branches + Bryant Park.
- **Same-name twins collapsed** on the serve path unless addresses differ (ve#67).
- **Market-research agent** (ve#71): NYT/Infatuation/Eater discovery, 0.75
  confidence only with verbatim URLs, never overwrites curated rows.
- **Seed-on-demand** (ve#44): coarse first-seen city ids, picker under the
  $10/mo cap, weekly cron DRY-RUN only; live spend quoted (~$0.05/10 venues),
  not run. **Spend: $0.**
Measured live 2026-09-16 vs 2026-09-12 (top 200 by score, 5 km of Union Sq):
researched laptop policy 21 → 59 (54 curated + 5 agent), seating known 0 → 56,
top score 72 → 85, libraries/parks in the top 200: 0 → 8. Still true: every
unobserved venue now sits at a flat 52 and the APP still prints that number;
websites 0/200; outside NYC unchanged (0 laptop policies, scores 50–55).
**App side untouched since approval** (0 commits on bamware-brewdesk): the four
critique bugs, hiding scores for unobserved venues, distance/open-now on
cards, colorblind pins are all still open; the bundled cold-start snapshot
(`VenueSnapshot.json`) now predates the new rankings. New brewdesk tickets
from the privacy triage: #154 (move listing fetch off query-string lat/lng),
#155, #156. venue-engine PR #59 (CORS) still open since 08-31.

## 2026-09-12 — 🎉 APPROVED. BrewDesk 1.0 is live on the App Store
Apple approved version 1.0 (build 19) three business days after the 2.1
reply. Public listing verified via the iTunes lookup API: "BrewDesk — WFH
Cafés", released 2026-09-12T11:07Z, Productivity / Food & Drink, Apple ID
6802930990 → https://apps.apple.com/us/app/id6802930990. First Bamware app
to clear App Review; the 4.3(b) exposure flagged since Baat's rejection did
not materialize (AI-transparency positioning + evidence-first notes held).
**Post-approval steps executed the same day:**
- `release/1.0.3` + `release/1.0.4` deleted on origin (tips preserved by
  tags `store/1.0-build18` / `store/1.0-build19`, per docs/RELEASING.md).
- bamware-web PR #36 **merged → bamware.io + bamware.io/brewdesk verified
  live** with the App Store link (TestFlight button hidden once a store link
  exists; Google Play stays coming-soon). Lint + build + 11/11 tests green.
  Found: bamware-web CI `check` has failed on EVERY run since 2026-08-30
  (Node 20 can't load the .ts test) → web#37, boarded P2/Infra/S/Human-only.
  Bilal ran `gh auth refresh -s workflow` → PR #38 merged, CI green
  (11/11) for the first time since 08-30, web#37 closed. Lesson: agent
  tokens need the `workflow` scope to touch `.github/workflows/`.
- Board hygiene: brewdesk#31/#33/#68/#69/#70/#87/#89 were closed but not
  Done → Done. Draft PR brewdesk#147 closed (superseded by #148).
**Android UNPARKED** (the 2026-09-08 decision said "revisit after Apple
approves"). Still true: personal Play account needs 12 opted-in testers for
14 days before production; Play package/key registration deadline 2026-09-30
(Human-only). Next Android moves need Bilal's call on the tester route.
**Still open:** venue-engine PR #59 (CORS allowlist for brewdesk-web) looks
mergeable; 30 venues need the paid photo backfill (quote first).
Spend: $0.

## 2026-09-09 — ✉️ 2.1 reply SENT; waiting on Apple
Bilal sent the Resolution Center reply (3,435 chars; ASC caps replies at
4,000 — the long draft had to be cut) with take 3 attached, selected build
1.0 (19) for the version, and entered the ASC finals: Productivity / Food &
Drink, 4+, © 2026 Bamware, content rights, App Privacy "Data Not Collected",
description (fixed by brewdesk#152 — it still claimed NYC-only cafés and
"outside NY you see the full dataset") and Review Notes pasted from the repo.
Closed brewdesk#31, #136. Final text + ASC state recorded in
`bamware-brewdesk/submission/1.0.3/resolution-center/`.
**Next:** Apple usually answers in 1–3 business days. Bilal checks the ASC
App Review page (agents do NOT read his inbox — his rule, 2026-09-09). If
4.3(b): send Reply 1 from `docs/rejection-response-pack.md`. If approved:
retire release/1.0.4, flip bamware.io/brewdesk store CTA live (web), then
unpark Android. Spend: $0.

## 2026-09-08 (PM) — brewdesk#149 fixed, release/1.0.4 uploaded for the 2.1 video
Recording the 2.1 video exposed a real bug: `LocationPermissionView` was the
ONLY caller of `requestAccess()`, so after the intro ("Use Union Square
instead", or a Settings reset to "Ask Next Time") nothing in the app could
ever trigger the iOS permission alert. Fix (PR #150, QA-merged): Spots map
header shows `LocationUndeterminedBanner` ("Location is off — showing NYC." +
"Use my location") whenever status is `.notDetermined`; new
`-UITestLocationUndetermined` seam. Evidence: 3/3 location UI tests +
ReviewerSimulation 2/2 (Release, live engine) + VenueKit 24/24. Also fixed
two denied-location tests that were already red on main (stale "3 work
spots" literal → header card + fixture pin, #37).
**release/1.0.4** cut from main `6b762ca`, gate flip committed (`df6e982`),
archive plist-verified `BDStoreSurfaceGated = YES`, **uploaded to ASC via the
free local rail 14:52 local ("Upload succeeded")**. Build number is
Xcode-managed — tag `store/1.0-buildN` once processing mail names it.
Bilal's video plan: install the new TF build → Settings → Location → BrewDesk
→ "Ask Next Time" → record from Home screen → tap the map banner's "Use my
location" → iOS alert appears. iOS retains location grants across a
delete+reinstall, so deletion alone is NOT a reliable way to re-trigger the
alert (learned today, twice).
Process correction (Bilal, 2026-09-08): I wrongly asked him to merge #150.
Agents QA-merge after green + evidence (AGENTS.md, 2026-08-21); the old
"merging stays with Bilal" line in the 08-19 entry below is superseded.
Build 19 processed 14:54 local, tagged `store/1.0-build19`. Bilal recorded
take 3 on it (iPhone 15 Pro, 2:03, launch from Home screen, banner tap,
full tour). **iOS omits the system location-permission alert from screen
recordings** — that, not the app and not iOS retaining grants, is why every
take lacked the prompt (the app asked each time). Reply text finalized
(PR #148 merged): recorded on build 19, one sentence explaining the missing
alert. **Bilal next: in ASC select build 1.0 (19) for version 1.0, paste
the reply, attach take 3, send.** Real-CoreLocation UI test landed (#151).
Spend: $0.

## 2026-09-08 — ⏸️ Apple paused the review: Guideline 2.1 Information Needed (since 2026-08-31)
Apple's App Store Connect mail "There's an issue with your BrewDesk submission"
landed 2026-08-31 22:29Z, 39 s before the "In Review" status mail, and sat
unread for 8 days. The email body carries NO guideline text — only the App
Review page in ASC does. Status never went to Rejected; the review is paused
on us. Message: **Guideline 2.1 – Information Needed – New App Submission**,
seven items: (1) physical-device screen recording starting at launch, showing
the location prompt; (2) devices/OS tested; (3) function + audience; (4) setup
instructions; (5) external services; (6) regional differences; (7) regulated
industry / third-party material. Not 4.3(b), not a concept ruling, no new
binary needed.
- **Done:** reply text for all 7 items + recording shot list in
  `bamware-brewdesk/submission/1.0.3/resolution-center/2026-08-31-guideline-2.1-info-needed.md`;
  reviewer notes (`fastlane/review_information/notes.txt`) now carry items 2–7
  for future submissions (2627/4000 chars). brewdesk PR #148, docs only.
- **Bilal (Human-only):** fill the iPhone model + iOS version placeholders,
  record the 2–3 min video on the physical iPhone per the shot list, paste the
  reply + attach the video on the ASC App Review page, then merge PR #148.
- **Lesson (→ store-submission skill):** after Submit, watch the inbox daily;
  an "issue with your submission" mail means open the App Review page — the
  mail itself says nothing. Submission ID b887aaff-336d-4873-9c6a-cce862677d4e.
- Verified stale: brewdesk#135 (notification prompt) — #117 unwired every
  reminder call site; release/1.0.3 has zero references outside the package.
  Still true: en-US description says "cafés in New York City" (#136 partial).
Spend: $0.

## 2026-08-31 — 🚀 ANDROID SUBMITTED TOO (same day)
Bilal completed flutter#5 himself: Play Console registration, keystore,
signed AAB build 8 uploaded and submitted. If the account is a new personal
one, production publishing unlocks after Google's 12-tester × 14-day closed
test. Both stores now in review on the same day. flutter#5 closed.

## 2026-08-31 — 🚀 BREWDESK SUBMITTED TO THE APP STORE
**Version 1.0, build 18, submitted by Bilal 2026-08-31.** From release/1.0.3
(committed gate flip, tagged store/1.0-build18). Final pre-click fixes: ASC
review-contact fields (the + phone format), reviewer notes updated for UI3
navigation + the outside-NYC baseline reality (old notes pointed at deleted
tabs and pre-baseline behavior). bd#33 closed. Odds assessment on record:
~60-70% first pass, ~90%+ within two rounds; the only untestable risk is
4.3(b), and the Resolution Center reply (#32 pack) is pre-written.
**While waiting:** Play side is ready to start its 14-day closed-testing
clock the moment Bilal does Console registration ($25 gate) + keystore +
AAB upload (flutter#5, runbook in docs/play/). Spend: $0.

## 2026-08-31 — SUBMISSION READY: store build uploaded, everything but the click
Bilal device-smoked TF (passed), entered ASC metadata + screenshots himself.
- **bd#121 closed:** UI3 store set via new `fastlane ios store_screenshots`
  lane (light-pinned, Release, store-gated, en+es, composes + assembles
  `submission/<version>/` pack — the reusable pattern Bilal asked for).
  Caught en route: missing es count-line translation, stale "cafes" captions,
  ASC 6.5-inch slot needs 1284x2778 → lane now derives that set too.
- **bd#69 closed:** dry-run on the REAL release cut — ReviewerSimulation +
  gated-surface checks PASS on iPhone 17 Pro Max AND iPad Pro 13-inch,
  Release, live engine. Evidence in submission/1.0.3/evidence/.
- **Release-branch git flow (Bilal's call, codified in RELEASING.md +
  #33):** store archives ONLY from release/x.y.z with the
  STORE_SURFACE_GATED flip as a committed change, tagged store/x.y-buildN;
  CLI overrides + long-lived store branches forbidden. First use:
  release/1.0.3 cut, flip committed, archive plist-verified gated,
  **UPLOADED to ASC** ("Upload succeeded").
- Also: bd#104 closed (AccountFlow green ×3 — the old hang morphed into the
  #131 tab-identifier bug; live auth round-trip 201/200 proven);
  accounts-require-decision settled (gate stays; option-3 risks ticketed:
  auth#7 cold starts, auth#8 token refresh, bd#139 review readiness);
  bd#142 filed (detail name-dupe + ISO dates, non-blocking).
- **Remaining for submission: Bilal only** — read the ASC build number when
  processing finishes (I tag store/1.0-buildN), select the build, click
  Submit, then bd#32's Resolution-Center pack stands ready if needed.
  Spend: $0 (brew-installed fastlane; local rail throughout).

## 2026-08-30 — reviewer sim green, glass + polish, feedback batch: 5/5 shipped
**iOS lane:** ReviewerSimulationTests fully green in Release vs production for
the first time since UI3 — bd#131 (tab a11y identifiers attach seconds late on
the iOS 26 floating bar; ruling: label-match in tests, zero binary change) +
a #37-violating pin-count assert fixed (PR #132); #126 closed. bd#133 branded
launch screen merged (PR #134, brand green + mark, no white flash; rides the
next TF cut). Lane is now purely: Bilal device-smoke → #121 screenshots →
#69 full-matrix dry-run → #31 ASC → #33 Submit.
**Flutter:** UI polish round 1 (bd#28 → PR #29: mockup-faithful circular pins,
unified header card, search list above keyboard + Cancel, iOS-style score
tiles + provenance, anchored menu, humanized dates, parsed hours). Glass
surfaces (bd#30 → PR #31: GlassSurface BackdropFilter on header/shelf/dock/
menu/tab bar, extendBody; perf rule: standing chrome only). You-tab About
detail nav, Atly-style (bd#32 → PR #34). Branded loading state (bd#33 →
PR #35; agent correctly refused coldStart() wiring that would mask degraded
states — endorsed).
**Bilal's 2026-08-30 feedback batch — all five resolved:**
1. "Saved should require account" → pushed back (recorded accountless
   strategy, 4.3(b) + Data-Not-Collected); Bilal AGREED. Account card stays
   #120 post-approval.
2. Splash screens → shipped both apps (bd#133, flutter#33).
3. "I don't see photos" → REAL P0 find: photo rail dead in prod since the
   Aug 23 reseed orphaned the placeId join. ve#56 → PR #57: relinked
   2,144/2,174 (98.6%) via matcher, $0 spent; health now reports
   photos.venuesWithPhotos so it can't silently break again. Live-verified
   end-to-end incl. app gallery + bylines. 30 venues need a paid backfill
   (quote first).
4. Marketing site → **bamware.io/brewdesk LIVE** (web#18 → PR #19):
   Atly-countering transparency positioning, real app screenshots (re-cut at
   bd#121), store CTAs as coming-soon config. QA fixes: honest source labels
   (curated/user report), eager-load CTA frame (lazy-load artifact).
5. About-info tucked behind detail nav → Flutter shipped (#32); iOS held
   pre-approval (gated You tab needs the content or it reads half-empty).
Spend: $0. All supervisor QA'd with visual evidence; worktrees cleaned.

## 2026-08-30 (late) — web backlog approved + boarded, prod redeployed
- **Bilal approved the web#11 grooming** → children filed as bamware-web
  **#20–24** (11a CORS+shell → 11b map/list → 11c detail → 11d saved →
  11e deploy gate), all boarded + fully fielded (Todo / P2 / Backend;
  11a–11d Agent-ready, 11e Supervised — deploy-config gate). Board note:
  Area has no "Web" option (option-set mutation wipes statuses, 2026-08-19
  incident), so web tickets use **Backend**. Backfill: epic #11 + #12 →
  Todo; web#7 + #3 added to board (were never on it).
- **bamware-web prod redeployed fresh** via `npx vercel redeploy` (CLI auth
  already on this Mac; the Vercel MCP connector is scoped off this project —
  403s, empty project list — don't burn time on it). New deployment Ready in
  45s, aliased to bamware.io. Live-verified 200: `/`, `/brewdesk`,
  `/brewdesk/privacy|support|terms`, `/sign-up`, `/baat`, `/admin/login`.
- **Web queue now:** 0 open PRs; next picks web#7 (Baat case study) then
  #20 (11a). web#12 still held (secrets/ingest design). web#3 (waitlist
  keep-or-kill) needs a 1-min Bilal call. Spend: $0.

## 2026-08-28 (night) — Flutter parity wave: 12/12 merged, Play prep done
Bilal's brief: 100%% feature parity for the Flutter app tonight, consider Play
submission. Full throttle pre-reset (6 parallel Sonnet DEV agents), then
conservative sequential.
- **Merged (bamware-brewdesk-flutter #2,3,4,7,8,9,10,11,12,13,14,15 — PRs
  #16–27, supervisor QA on every one):** Work Fit filter menu (tri-state +
  tier legend + reset), detail parity (name title, claim-level provenance,
  Share), methodology + You/About (support/privacy/terms/licenses/version),
  onboarding + location intro (Union Square path never prompts), degraded
  states + BREWDESK_SCENARIO seam, cold-start snapshot (50 venues, 58KB),
  on-device Takeout import, marker planning, 27 contract-parity tests,
  launcher icon + branded launch, en+es l10n (zero literal UI strings),
  Play prep (release AAB config, data-safety/content-rating/listing docs,
  submission runbook).
- **Certified on merged main:** analyze clean, 94/94 tests, debug APK, and a
  live Pixel-emulator walkthrough: onboarding → Union Square → 100 production
  venues, tier-colored markers, filters, shelf, all tabs.
- **Play submission now = flutter#5 only (Bilal, Human-only):** Console
  registration ($25 — over the spend rule, needs his explicit OK), keystore,
  upload. Runbook: docs/play/SUBMISSION-RUNBOOK.md. His listing decisions
  parked in the docs: category, contact email, data-safety location wording,
  distribution regions.
- **iOS lane:** brewdesk#126 drift fixes merged (PR #130); found + filed
  brewdesk#131 (tab buttons expose no a11y identifier for seconds after
  launch — test-plumbing, not user-facing; the only remaining reviewer-sim
  red; gates #126 → #69). Supervised.
- **Incidents:** one DEV agent hung on real file I/O inside testWidgets'
  FakeAsync zone (fix: sync fixture reads — lesson now in every later brief);
  two agents parked on background gate monitors (nudged/taken over —
  foreground-gates rule re-proven). Stale local WIP in the flutter checkout
  stashed, not deleted. Spend: $0.

## 2026-08-28 (follow-up) — map now pixel-still under the shelf
Bilal on the #125 build: better, but the MAP resizes/flashes with the card.
Cause: shelfClearance switched on detent, so peek<->medium changed the map's
bottom safeAreaPadding ~150pt and Map re-fit its camera every hop. Fix
(bd#128 -> PR #129, merged): clearance is now CONSTANT (sized for the medium
card) — the map's layout never changes with the shelf. Quantified: map-band
pixel diff through a medium->peek settle, 17 grey-levels max before -> 0
after. Shelf suite 5/5 + units green. **Second TestFlight build uploaded from
main 9584400 — Bilal: smoke the NEWEST processing build.** Spend: $0.

## 2026-08-28 — shelf detent animation rebuilt, TF build up
Bilal's report: bottom card flashes on expand/minimize and sits under the tab
bar at peek. Frame-by-frame sim captures found three causes: offset-based drag
slid the card beneath the tab bar; peek ended square-cut at the safe-area line
over raw map; the rail/list swap laid out as VStack siblings, pushing the
outgoing view out of the clip (the flash). Fix (bd#125 -> PR #127, merged under
the Actions-billing waiver): height-driven 1:1 resize drag with rubber-banding,
glass bleeds under the floating tab bar (design-spec mockup 01 look,
hit-testing off), concrete-height settles (#88's pin generalized), ZStack
crossfade. MapShelfDetentUITests 5/5 (incl. the stale-chips peek test, fixed),
unit suites green, Release boot vs production verified. **TestFlight build
uploaded from main 1112b8d via the free local rail (Xcode-managed build
number); Bilal: device-smoke the newest processing build.** Found + filed
bd#126: ReviewerSimulationTests drifted post-UI3 (asserts removed "100 work
spots" text) — gates bd#69, part of #121 stabilization. Test-infra lesson in
MapShelfDetentUITests: the grabber's a11y frame spans the whole card, so drags
must press the shelf's top 12pt or the full-detent list eats them. Spend: $0.

## 2026-08-24 (overnight) — UI round 3 shipped end-to-end
- Bilal's Claude Design spec (BrewDeskDesignSpecv1.pdf) implemented: tabs collapsed to Spots · Saved · You (bd#117/PR122 trunk), search rebuilt + anchored WorkFitFilterMenu with tier legend (bd#118/PR124), venue detail name-as-title + card-level provenance (bd#119/PR123). All merged to main (a84fed0). #117/#118/#119 closed.
- Visit reminders CUT from v1 (Bilal-approved): zero notification permission requests in the binary; scheduling code stays in the package, unwired.
- Accounts/SSO/Plus paywall split to deferred epic bd#120 — do not build until Bilal green-lights (pre- vs post-approval undecided).
- Testing mode changed BY BILAL's instruction: UI-first, no red-green loops; one stabilization pass + screenshot re-shoot (bd#121) after he approves the look on device. Known deferred: 2 UI tests referencing removed search-done/chip-rail elements; full matrix not run on the merged stack (compile gate + boot smokes only).
- TestFlight: TWO uploads — 23:59 build is STALE (pre-merge main; gh pr merge 122 failed silently first try), 00:01 build is the real UI3. Bilal: use the newest processing build.
- Landmine found: DebugEnvironmentStore defaults to .localhost on fresh containers → "ENV: Localhost" badge + dead data in debug builds. Live UI tests now pin -brewdesk.debug.environment production. Not changed in product (historical behavior); decide later.
- Sheet lesson: .presentationContentInteraction(.scrolls) makes swipe-dismiss unreliable → detail sheet has an explicit Close button (detail-close); tests dismiss via it.

## 2026-08-24 — Flutter/Android MVP booted
- Bilal chose Flutter for BrewDesk on Android. New private repo
  `mrbam88/bamware-brewdesk-flutter` published at `623bda5`; canonical design
  PDF is committed in-repo, app id `io.bamware.brewdesk`.
- Live vertical slice: Spots map + draggable shelf, privacy-safe POST search,
  filters, detail/provenance/photos/directions, Saved, You, location fallback.
  Strict MVVM/service/repository layers; OSM tiles avoid API-key spend.
- Evidence: production search decoded; `flutter analyze` clean; 3/3 tests;
  debug APK built; Pixel 10 permission-denied → 100 venues → detail → save →
  Saved passed; gitleaks no findings. Spend: $0.
- GitHub setup: PR-only Flutter CI + secrets tripwire, engineering-skill docs,
  default triage labels, epic #1 with fielded children #2–5. No fan-out launched:
  Actions billing means PR gates cannot start; do not trigger paid minutes
  without quote-and-confirm. Next: restore CI, fan out #2/#3/#4, then Human-only
  Play Console/signing/internal-test #5.
