# Brewdesk — go-live blockers (backend/infra audit)

**Owner:** Claude (backend/infra) · **Audited:** 2026-08-05 evening, against live prod
**App:** "Brewdesk — WFH Cafés" (renamed from wfhCafe, 2026-08-05)

Everything below was verified against running systems or current code, not assumed.
Severity: 🔴 blocks submission or breaks paying users · 🟠 fix before charging money ·
🟡 fix soon after launch.

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
