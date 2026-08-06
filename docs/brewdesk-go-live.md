# BrewDesk — go-live blockers (backend/infra audit)

**Owner:** Claude (backend/infra) · **Audited:** 2026-08-05 evening, against live prod
**App:** "BrewDesk — WFH Cafés" (renamed from wfhCafe, 2026-08-05)

## Final v1 decisions — Bilal, 2026-08-05

- On-device brand: **BrewDesk**. App Store name: **BrewDesk — WFH Cafés**.
- Guest users can browse the map, search, filters, and venue details without an account.
- v1 is free. StoreKit subscriptions and the paywall move to v1.1.
- Optional accounts remain only with real account value (planned: cloud-synced saved cafes) and require production auth plus in-app account deletion.
- The Ask conversation prototype is excluded from v1. It is preserved in `bamware-cafe` on branch `feature/conversation-prototype`, tag `conversation-prototype-v0.1.0`, commit `7d6bf8f`.
- v1 is iPhone-only. iPad support can return after dedicated layout and screenshot validation.

These decisions supersede the older paid/hard-gate alternatives below. Keep the audit details for implementation context.

Everything below was verified against running systems or current code, not assumed.
Severity: 🔴 blocks submission or breaks paying users · 🟠 fix before charging money ·
🟡 fix soon after launch.

---

# Client checkpoint review — `bamware-cafe` @ `b42eeec` (2026-08-05, Claude)

Reviewed the "cut BrewDesk v1 guest release" commit by reading the tree **and by building
it**: Release configuration, iPhone 17 Pro simulator, `-validate-for-store` → **BUILD
SUCCEEDED, 0 errors**. Test suites: **TEST SUCCEEDED, 5 + 4 tests, 0 failures** (includes the
UI smoke test asserting the OpenStreetMap attribution renders). Findings below come from the
built binary, not just the source.

## Verified good ✅

| Item | Evidence |
|---|---|
| App icon installed | All three appearances wired in `Contents.json`; build emplaced `AppIcon60x60@2x.png` + `Assets.car` |
| Name | `CFBundleDisplayName = BrewDesk` in the built `Info.plist` |
| iPhone-only | `UIDeviceFamily = [1]` (was `1,2`) |
| Guest browsing | `RootView` gates are gone — Onboarding → Location → Discovery. No auth, no paywall in the flow |
| Legal URLs repointed | Binary contains only `bamware.io/brewdesk/{privacy,terms,support}`; Baat URLs gone |
| About screen | Support / Privacy / Terms links + **OpenStreetMap contributors** attribution (`DiscoveryRootView.swift:48-56`), with a UI test asserting it |
| Empty/error states (2.1) | `CafeMapScreen.loadStatus` — loading state and a `ContentUnavailableView` with Retry on failure |
| Location purpose string | Present and specific |

## Issues found 🔎

**1. 🟠 `ITSAppUsesNonExemptEncryption` is absent from Info.plist.**
Confirmed absent in the built app. Every single build upload will stop and ask the export
compliance question in App Store Connect. BrewDesk uses only standard HTTPS, so it is exempt —
add `ITSAppUsesNonExemptEncryption = false` and the prompt disappears forever. Small, but it
is pure friction on exactly the step we want to repeat quickly. **Sol.**

**2. 🟠 The removed paywall and auth still compile into the shipping binary.**
`BamwareCafe.xcodeproj` uses `PBXFileSystemSynchronizedRootGroup` with **no membership
exceptions**, so every file under `BamwareCafe/` is a target member regardless of whether
anything references it. Verified in the Release binary:

- `otool -L` → **StoreKit.framework is linked** (from `SubscriptionStore.swift` / `PaywallView.swift`)
- `strings` → **`https://cje3ppxv47.execute-api.us-east-1.amazonaws.com`** — the dev auth
  Lambda — is still embedded

Neither is reachable at runtime, so this is not a correctness bug today. It is worth cleaning
before submission because: StoreKit linked with zero IAPs configured invites a reviewer
question; a dev backend URL inside a shipping binary is one re-enabled code path away from
being a real incident; and it is dead weight in a v1 whose whole pitch is "free, no account".
**Recommend deleting `Auth/`, `Subscription/`, `PaywallView.swift`, `AuthenticationView.swift`
for v1** — git history keeps them, and the conversation prototype already set the
branch-and-tag precedent. **Sol.**

**3. 🟠 The speed test was removed from the UI — our 4.3(b) story has to change.**
`VenueDetailScreen` lost the "Run speed test here" section (-54 lines) and no longer takes a
`VenuesModel`. The `VenueAPI` capability still exists in VenueKit but nothing calls it.

Our planned App Review positioning was *"measured wifi speeds + provenance for NYC work
sessions"*. **Half of that is no longer true**, and 4.3(b) (spam / "yet another cafe finder")
is the guideline this app is most exposed to. The remaining honest differentiation is:
per-attribute **provenance** (every claim shows source + date + confidence), a **work-fit
score** over wifi/outlets/laptop-policy/noise, and a **curated NYC-specific** dataset. That is
a real answer, but it must be written that way in the review notes and the store description —
and the description must **not** promise speed testing. I'll draft the notes; flagging so
nobody ships the old copy.

**4. 🟡 `POST /v1/observations` now has no consumer at all.**
With the speed test gone from the client, the only writer to our dataset is the public
internet. **Recommend disabling the route for v1** (one line, reversible, zero client impact)
and bringing it back with the flywheel in v1.1 alongside durable storage.

Note this also **downgrades my earlier severity on blockers #1 and #2**: because observations
never persist, a poisoning attempt is equally ephemeral and scoped to one warm lambda
instance. It is untidy, not a launch risk. Still contract-frozen, so it needs an ack.

**5. 🟡 Bundle id is `bamware.BamwareCafe`.**
Invisible to users and fine to keep. But no App Store Connect record exists yet, so this is
the **last moment** it could become something like `io.bamware.brewdesk` for free. After the
ASC record is created it is permanent. Bilal's call — I'd only bother if he cares.

## Blockers resolved by the free-v1 decision

- 🔴 **#3 (ships against dev auth)** — resolved *in flow*: no auth path executes. The URL is
  still in the binary (issue 2 above), so close it properly by deleting the dead code.
- 🟠 **#5 (subscription requirements)** — moot for v1. Returns with the v1.1 paywall.
- 🔴 **#1 / #2 (persistence, open write endpoint)** — no longer user-facing, since nothing in
  the app reads or writes observations. Must be solved before the flywheel ships in v1.1.

## Privacy label — "Data Not Collected" is defensible for v1 as built

The engine holds venue data only; it retains nothing per-user, and the Vercel runtime log
surface records the request path **without** the query string (verified on a live geo probe:
`GET /v1/venues 200`, no coordinates). Coordinates are used transiently to rank and are never
stored, which is exactly Apple's carve-out for transient processing.

Two conditions, and this stays true: **do not add an analytics or crash SDK** without redoing
the label, and **do not start logging query strings** on the engine. If either changes, the
label becomes Location → App Functionality → not linked to identity → not used for tracking.

---

## 🔴 1. Speed-test observations do not survive in production

**The flywheel — our 4.3(b) differentiation and the thing the subscription sells — silently
loses data in prod.**

Verified: POSTed a real speed test to prod, then read Vercel's runtime log for that request:

```
00:38:14 POST /v1/observations 201 [warn/serverless]
    persist skipped: filesystem is read-only
```

`store.ts:166-175` catches the read-only-filesystem write and keeps observations in a
module-level array. That array belongs to **one lambda instance**. Six immediate readbacks
all showed the observation only because Vercel kept routing to the same warm instance — on a
cold start or a scale-out, it is gone. Contributions vanish, and a second user never sees
the first user's measurement.

This is fine for a demo and **not fine for a paid app**: users pay for community wifi data
that quietly evaporates, and the App Store description would be describing a feature that
does not durably work.

**Fix:** move observations to shared storage. Same decision solves blocker #2.
**Needs from Bilal:** pick a datastore and provision it (credentials are yours, not mine).
Fastest path is Upstash Redis or Vercel Postgres from the Vercel marketplace — both are
~15 min to provision and I can have the adapter written the same session. DynamoDB is the
"consistent with the rest of Bamware" answer but is slower to wire from Vercel.

## 🔴 2. `POST /v1/observations` is unauthenticated, unthrottled, and directly rewrites ratings

Anyone with curl can set any cafe's wifi claim to `source=speed_test, confidence=0.9` —
the highest-trust tier — as many times as they like. There is no rate limit, no auth, no
device attestation, and no outlier rejection (`schema.ts:69` accepts up to 10,000 Mbps).
Our differentiator is data quality; this endpoint is the one place it can be poisoned.

**Note:** an in-memory rate limiter would be theatre on serverless — it is per-instance and
bypassed by scale-out, exactly like #1. Real throttling needs the same shared store, which
is why these are one work item, not two.

**Deliberately not fixed yet:** adding `429` and tightening the `mbpsDown` bound are v1 API
contract changes, and the protocol is contract-doc-before-code. Proposed addendum is at the
bottom of this file — Bilal/Sol ack, then I implement.

## 🔴 3. The app ships against the DEV auth backend

`bamware-cafe/BamwareCafe/AppConfiguration.swift:17`:

```swift
authBaseURL: URL(string: "https://cje3ppxv47.execute-api.us-east-1.amazonaws.com")!
```

That is `bamware-dev-auth-service`. Unlike `VenueAPI` (which correctly splits Debug/Release),
this is hardcoded with **no environment split**, so a Release build sends real customers'
emails and passwords to the dev Lambda — dev DynamoDB table, dev JWT secret, dev email
sender.

`bamware-infra/environments/prod/` exists in Terraform but has **never been initialised**
locally (`terraform state list` → "Backend initialization required"), so there is no prod
auth environment to point at yet.

**Fix (mine, needs Bilal's AWS credentials):** apply `environments/prod`, set a fresh prod
`JWT_SECRET`, verify a sending domain for transactional email, then hand Sol the prod URL for
a Release-only `authBaseURL`.
**Decision needed:** if you want to submit this week, the alternative is to **cut accounts
from v1** — which also removes the 5.1.1 risk and the account-related privacy labels. See
"Fastest path to submission" below.

## 🔴 4. The app links Baat's dating documents as its own legal terms

`AppConfiguration.swift:18-19` points `termsURL`/`privacyURL` at `bamware.io/terms` and
`bamware.io/privacy`. Both are Baat's: "Baat is a dating app", 18+, matches, safety when
meeting strangers. Wrong for users, and a straightforward rejection.

**Fixed on my side — Sol just needs to repoint:**
- `https://bamware.io/brewdesk/privacy`
- `https://bamware.io/brewdesk/terms` ← **new**, carries the auto-renewing-subscription
  disclosures Apple requires under 3.1.2 (what you get, length, price, renewal, cancellation,
  refunds)
- `https://bamware.io/brewdesk/support` (App Store support URL)

`/wfhcafe/*` now 308-redirects to `/brewdesk/*`. Shipped: bamware-web `f108cd4`.

## 🟠 5. Auto-renewing subscription requirements (3.1.2) beyond the EULA

The EULA is done; these are not:
- StoreKit products `bamware.BamwareCafe.pro.monthly` / `.annual` must exist **in App Store
  Connect** with prices and be attached to the build. The local `.storekit` catalog is a dev
  fixture and does not carry into review.
- **Paid Applications Agreement** must be signed, with banking and tax details complete. This
  is usually the longest pole for a first paid app — Apple can take days on tax forms. Start
  it now even if everything else slips.
- The paywall must display title, length, and price, with functional Terms and Privacy links
  (Sol).
- The App Store description must restate the subscription terms.

## 🟠 6. Vercel deployment protection is enabled on the venuekit project

`ssoProtection: { enabled: true, deploymentType: "all_except_custom_domains" }`.

The production alias is currently reachable unauthenticated — I verified `HTTP/2 200` with no
SSO redirect, so **App Review can reach it today**. But the app hardcodes a
`*.vercel.app` alias, which is *not* a custom domain, so this setting is one dashboard toggle
away from making the app dead on arrival in review.

**Recommendation:** put the API on a custom domain (`api.brewdesk.app`) before submission —
it takes the protection setting out of the blast radius, survives project renames, and looks
right if anyone inspects traffic. Needs the domain Bilal is registering anyway.

## 🟡 7. Auth service accepts any `tenantId` string

`authSchemas.ts` validates `tenantId: z.string().min(1)` with no allowlist, so anyone can
register under any tenant, including `bamware-dating`. Not a launch blocker, but worth a
guard before there is real money and real accounts behind it.

## 🟡 8. No monitoring on the venue engine

No alerting on 5xx or availability. If prod dies mid-review we find out from the rejection.
A Vercel log drain or a 5-minute uptime check on `/v1/health` is enough for v1.

---

## Contradiction to resolve in the contract doc

`docs/wfhcafe-mvp-contract.md` currently says both things in different sections:

- "STORE-CLEARANCE VERIFICATION" (added by a cloud session, 00:31 UTC): *"login screen MUST
  go"*, *"'Data Not Collected' label"*, Play Data Safety *"no data collected"*.
- "P0 verification" + the privacy-label table (mine, earlier): accounts and a StoreKit paywall
  ship, so **"Data Not Collected" is false** and would be a misrepresentation on the App
  Store.

Both cannot be true. Which is correct depends entirely on Bilal's answer to the accounts
question below. The cloud session was working from the older free/no-login assumption and did
not have the acquisition-shell decision in context.

## Fastest path to submission — recommendation

The single decision that collapses the most blockers is **whether v1 has accounts**.

**Option A — free v1, no accounts (fastest, ~days).** Kills blockers #3 and #5 entirely,
removes the 5.1.1 risk, restores "Data Not Collected", and drops the Paid Applications
Agreement from the critical path. Still needs #1 (persistence) to be honest about the
flywheel. Monetise in v1.1 once the directory has users.

**Option B — paid v1 as currently built (~1-2 weeks realistically).** Needs prod auth stood
up, ASC products, the paid agreement cleared, accurate privacy labels, and a 5.1.1 answer.
Nothing here is hard; it is mostly waiting on Apple's paperwork, which is not something we
can compress.

I recommend **A**, and I'd note the goal was "wfhCafe v1 (free)" two days ago — the paywall
arrived with the acquisition-shell decision, not from a monetisation plan. Shipping free
gets the NYC dataset in front of users this week and defers every Apple-paperwork blocker.
That is Bilal's call, not mine; say the word and I'll execute either.

---

## Proposed v1 API addendum (needs ack before I code it)

Contract is frozen, so recording first:

1. `POST /v1/observations` gains `429 { error: "rate_limited", retryAfter: <seconds> }`.
   Proposed limit: 5 observations per IP per hour, 1 per venue per IP per hour.
2. `mbpsDown` upper bound tightened from 10,000 to 2,000. Values above are `400 bad_body`.
   Nothing in a NYC cafe measures above 2 Gbps on wifi; the current bound only helps
   poisoners.
3. Observations become durable (no shape change — same request, same `201 { venue }`).
   Removes the "treat POST response as truth for the session" caveat.

Client impact: Sol should handle `429` on the speed-test path with a friendly message rather
than a generic error. No model or field changes.
