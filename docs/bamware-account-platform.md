# Bamware account platform — architecture (proposed 2026-09-18)

Decision: [ADR 0001](adr/0001-one-identity-platform-for-all-apps.md).
Inventory that grounds this: bamware-ai session 2026-09-18 (auth-service,
Baat, bamware-ios, BrewDesk, venue-engine, web, mcp, infra).

## What exists today (reuse, do not rebuild)

| Capability | Where | State |
|---|---|---|
| Multi-tenant users, register/login, forgot/reset, verify email, delete | `bamware-auth-service` (Lambda + DynamoDB) | Live (dev). `tenantId` per request. |
| Google + Apple ID-token verification, account linking | `auth-service/src/services/socialAuthService.ts` | Live; audiences from env (`GOOGLE_CLIENT_IDS`, `APPLE_BUNDLE_ID`). |
| Access (15 m) + refresh (7 d) JWTs, HS256 shared secret | `auth-service/src/services/tokenService.ts` | Live; no rotation, no revocation, no client uses refresh (auth#8). |
| Ordered account deletion (content → auth → local) | Baat (TS) and BrewDeskKit (Swift), identical | Built twice. |
| Swift session + account state machine | `BrewDeskKit`: `AccountSessionStore`, `KeychainSessionStore`, `AccountModel`, `AuthAPI`, screens | Built, gated off in the store build; email only. |
| Apple + Google sign-in on a client | Baat (RN) only | No Swift implementation anywhere. |
| Tenant config + generator | `bamware-dating-app/src/config/tenant.ts`, `bamware-mcp create_tenant` | RN-shaped only. |
| Push: APNs/FCM platform apps (Terraform), device registry + publish | `bamware-infra/modules/sns`, `bamware-dating-service` `/devices` | Dating-only. **Nothing in BrewDesk or venue-engine** (bd#94, ve#34 closed not planned). |
| Theming contract | `bamware-ios` `BamwareUI.Theme` | Proven portable (BrewDeskTheme). |
| Web token verify + sign-up/reset/verify pages | `bamware-web/lib/auth.ts`, `app/sign-up`, … | Live; payload type hand-copied. |

## Target shape

```
apps        BrewDesk (SwiftUI)   Baat-next (SwiftUI)   tenant apps…   bamware-web
              │ tenant config       │                     │              │
shared iOS  BamwareAccountUI ── BamwareAccounts ── BamwarePush ── BamwareCore/UI
              (screens, 4.8)     (session, refresh,   (APNs reg,
                                  Apple/Google, model) device client)
              │                       │                   │
services    bamware-auth-service   bamware-push-service   app services
            (identity, tenants)    (devices, send, digest) (venue-engine, dating-service:
                                                            user data keyed by userId)
              └────────── @bamware/auth-middleware (verify JWT, tenant match) ──────────┘
infra       bamware-infra: auth Lambda, push Lambda, SNS platform apps per tenant, secrets
provision   bamware-mcp create_tenant → auth tenant entry + Swift tenant config + push app + web config
```

Rules:
- **Dependencies point inward:** app → BamwareAccountUI → BamwareAccounts → BamwareCore. Shared packages never import an app.
- **Identity is the only owner of users.** App services never store passwords or providers; they store app data keyed by `userId` from a verified token whose `tenantId` matches the service's tenant.
- **One verifier.** Every Express service and bamware-web import `@bamware/auth-middleware`; the token payload schema lives there and nowhere else (closes the contracts.md gap for auth).
- **Push is tenant-aware and shared**, mirroring the auth service: platform app per tenant, device rows keyed by `tenantId + userId`, app services call it to send; they never talk to SNS directly.
- **Local saves stay free and unlimited** (bd#120 rule). Sync is an additive server copy.

## Work packages (each one ticket-sized, orthogonal)

**A. auth-service hardening (blocks everything)**
1. Tenant registry: a config table/file of tenants → allowed providers, bundle id, Google client ids, Apple audience; unknown `tenantId` = 400. Register `bamware-brewdesk`.
2. Refresh rotation + revocation (`jti` denylist with TTL); `/auth/logout` revokes.
3. Cold start (auth#7): scheduled warm ping via the existing `scheduler` module first ($0); provisioned concurrency only with a quote (costs money).
4. `@bamware/auth-middleware` package (npm, this repo or bamware-client-core revived): `verifyAccessToken`, `TokenPayload` schema, `requireTenant`. Adopt in dating-service, venue-engine, web.

**B. bamware-ios: `BamwareAccounts` + `BamwareAccountUI`**
5. Lift `AuthContract`, `AuthAPI`, `AccountSessionStore`, `KeychainSessionStore`, `AccountModel`, ordered deletion out of BrewDeskKit into `BamwareAccounts`; base URL, tenant id, keychain service come from a `TenantConfig` value, not constants.
6. Silent refresh: exchange the stored refresh token before expiry; sign-out on revoke.
7. Sign in with Apple (`ASAuthorizationController`) and Google (`GoogleSignIn-iOS` SPM, optional product so apps without Google do not link it) → `/auth/social`.
8. `BamwareAccountUI`: sign-in/create (Apple and Google buttons at equal prominence, email behind "Continue with email"), manage (name, sign out), delete (ordered, with outcome states), optional onboarding step with a real skip. Themed via `BamwareUI.Theme`. Snapshot + UI tests live in the package.

**C. BrewDesk consumes**
9. Replace BrewDeskKit account code with the packages; remove the store-surface gate from the release flow; privacy label + review notes updated.
10. Saved-spots sync: `venue-engine` `/v1/users/me/saved` behind the middleware + a server-backed `SavedVenuePersisting` adapter; local stays free.
11. Lists + notes on saved spots (after 10).

**D. Push platform**
12. `bamware-push-service` (small Lambda, same infra modules): `/devices`, `/send`, weekly digest; lift dating-service's device registry + publish repository into it.
13. `BamwarePush` (iOS): APNs registration, token → `/devices`, settings toggles.
14. BrewDesk alerts: saved-spot policy/hours change, new researched spot near saved ones, weekly digest. Needs infra#7 (APNs key, Human-only).

**E. Provisioning**
15. `create_tenant` gains a native target: auth tenant entry, Swift `TenantConfig`, push platform app var, web config; a wizard for the Apple/Google console steps.

## Human-only inputs
Apple: Sign in with Apple capability on the App ID; APNs key (infra#7).
Google: OAuth client ids (iOS + server) in Google Cloud. Privacy label wording.
Spend decisions: provisioned concurrency (A3) if the warm ping is not enough.

## Order
A1–A4 and B5–B8 in parallel (different repos) → C9–C10 → D12–D14 → E15.
BrewDesk 1.1 "Accounts" ships after C10; alerts follow as 1.2 once D lands.
