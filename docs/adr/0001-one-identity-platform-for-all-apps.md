---
status: accepted (Bilal, 2026-09-18: "Great … create some tickets … work on this tonight")
date: 2026-09-18
---
# One identity and account platform for every Bamware app

Bamware will ship many apps (Baat, BrewDesk, tenants to come). Sign-in,
sessions, account management, deletion, and push are the same problem in
each one, and Baat already solved most of it once. We decided that these
capabilities are **platform**, owned by shared repos, and that no app repo
may implement them again: identity lives in `bamware-auth-service` (one
multi-tenant API, `tenantId` per app; Google + Apple + email); the native
client side lives in `bamware-ios` as `BamwareAccounts` (session, refresh,
sign-in providers, account state machine) and `BamwareAccountUI` (themed
SwiftUI screens); push lives in a shared, tenant-aware push service plus a
`BamwarePush` client; token verification for every backend and web app comes
from one shared middleware package. App repos consume these and keep only
tenant configuration, copy, and app-specific user data (which stays in the
app's own service, keyed by the verified user id).

## Considered options

1. Keep building accounts inside each app (BrewDeskKit has a full copy
   today). Rejected: the third app would be the third rewrite, and every
   contract drift (June 2026 six-week silent breakage) repeats.
2. Adopt a hosted identity vendor (Firebase Auth, Auth0, Clerk). Rejected for
   now: the auth service already exists and works, vendors add cost at scale
   against a $20 stop rule, and the white-label business needs tenant data
   under Bamware's own keys. Revisit if the service's cold-start and refresh
   issues cannot be closed cheaply.
3. Shared platform (chosen).

## Consequences

- BrewDesk's account code is **lifted** into `bamware-ios`, not rewritten;
  BrewDesk becomes the first consumer, Baat's iOS successor the second.
- `create_tenant` must provision a native app too: auth-service tenant entry
  (providers, bundle id, Google client ids), Swift tenant config, push
  platform app. Apple and Google console steps stay Human-only (wizard).
- The auth service gains a tenant registry (today any string creates a
  partition), refresh rotation and revocation, and a cold-start fix before
  any app ships a tapped sign-in.
- Guideline 4.8: any app offering Google sign-in must offer Sign in with
  Apple with equal prominence. `BamwareAccountUI` enforces this by design.
