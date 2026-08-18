# iOS repos status (reviewed 2026-08-03)

_Migrated from the Claude Project 2026-08-18. Predates the 2026-08-04..06 native
platform baseline and BrewDesk v1 — parts are actioned, but the defect list and
GH cleanup checklist have not been verified closed._

## The three repos
- **`bamware-ios`** (private; ~/code/bamware-ios) — THE monorepo Swift package. 3 libs: BamwareCore (auth/permissions/tenants/flags/observability), BamwareUI (themes/branding), BamwareMessaging. swift-tools 6.0, iOS 17+. Work: Mar 2025 burst + Jul 22 2026 theming commits. ⚠️ Local checkout is on branch `2026-07-22-1388` with no upstream — July work may be unpushed. ⚠️ Stale `.git/index.lock` present (Bilal must `rm` it manually).
- **`BamwareDemoApp`** (public GH) — thin app shell (3 Swift files), consumes bamware-ios via LOCAL path `../bamware-ios` + Factory 2.4.3. Not buildable from a bare GH clone (depends on private sibling checkout).
- **`bamware-ios-demo`** (private GH) — dead Dec 2024 Xcode "Hello, world!" template. Archive/delete.
- Loose folders in ~/code (BamwareCore, BamwareAuth, BamwareUI, BamwareMessaging, BamwareStorage, BamwareSettings, BamwareDemo) — pre-monorepo split-package era, almost certainly superseded.

## Quality read
Good bones, genuinely: POP protocol/impl split, multi-tenant permission model (`tenant:canMessage` roles), per-tenant theming (BrandingPalette → bamSocial/bamMatch), DI-cycle broken via setter injection (documented in README), @MainActor fix for Combine/SwiftUI threading, decent AAA async unit tests.

Status: ~30% of a foundation, not an app. No networking layer at all, no persistence, hardcoded `mock-token` auth, messages hardcoded in the app shell.

## Defects found (static review)
1. **Test target almost certainly doesn't compile**: `AuthService` protocol requires `setPermissionsService(_:)`; the private mocks in AuthServiceTests + UserPermissionsServiceTests don't implement it. `swift test` to confirm.
2. **`Color(hex)` bug** in BrandingManager: that's SwiftUI's *asset-catalog name* initializer, not a hex parser — config colors silently fail. Needs a real hex extension.
3. Dead/empty files: CompositeObservabilityService.swift, TenantConfigProvider.swift, SmartTextTests.swift (all header-only), DashboardScreen (internal stub), SplashScreen (stub). Protocols with no impl: TenantService, ThemeService, ObservabilityService, FeatureFlagService (modern), MessageRepository.
4. Two config eras cohabiting: Dec-2024 `[String: Any]` managers vs Mar-2025 typed POP code.
5. swift-tools 6.0 = Swift 6 strict concurrency by default — fine now, will bite when networking/actors arrive.

## Recommendation
Revive as the interview artifact: cafe app = **tenant #3** on these packages. New app target consuming bamware-ios + new `BamwareNetworking` lib wrapping the venue-engine VenueAPI. Fix the test mocks + Color(hex), delete dead files, archive bamware-ios-demo, README for BamwareDemoApp explaining the local-package setup.

## GH cleanup checklist
- [ ] rm stale .git/index.lock in bamware-ios
- [ ] Push/merge branch 2026-07-22-1388
- [ ] Archive bamware-ios-demo on GitHub
- [ ] Delete loose package folders after confirming monorepo supersedes them
- [ ] Fix test mocks (setPermissionsService) → swift test green
- [ ] Fix/remove Color(hex) in BrandingManager
- [ ] Delete empty files (Composite/TenantConfigProvider/SmartTextTests)
