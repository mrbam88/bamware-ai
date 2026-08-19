---
name: native-app-to-testflight
description: Take a new Bamware native SwiftUI app from concept and repository bootstrap to a processed, physically installed TestFlight build. Use whenever spinning up a native iOS app, turning an API into a thin SwiftUI client, creating the first App Store Connect record, preparing a first beta, or proving a new app can ship end to end. Covers the 4.3 concept gate, package architecture, identity, privacy, tests, listing assets, signing, upload verification, and handoff. Stops at TestFlight; use store-submission afterward.
---

# Native app to TestFlight

The finish line is a build installed from TestFlight on a physical iPhone. An
archive, upload command, or processing build is not the milestone.

Read these first:

- `../../docs/app-store-rejections.md`
- `../../docs/security.md`
- `../../docs/contracts.md`
- `../../docs/definition-of-done.md`
- `../native-ios-workspace/SKILL.md`

Use `references/brewdesk-proof.md` when diagnosing signing or deciding whether
a checkpoint is truly equivalent to the proven BrewDesk run.

## Runtime routing

- Sol/opencode owns SwiftUI, client packages, simulator tests, metadata, and
  unsigned archives.
- Claude Code CLI owns Apple signing, App Store Connect, fastlane, and
  credential-bearing release commands.
- Backend agents own service and data changes. A service response-shape change
  requires a paired client change and contract verification.
- Humans retain credential values. Never paste, print, commit, or transfer them
  through chat to close a runtime capability gap.

## Inputs

Resolve these before implementation:

- Product name and one-sentence user job
- Canonical repository, target, scheme, module, and bundle identifier
- Production API and legal/support URLs
- V1 scope and explicit non-goals
- Three closest App Store products and the in-binary differentiator
- Minimum iOS version and device family
- App Store Connect team and release owner

## 1. Pass the concept gate

Run the five-question 4.3 preflight from `store-submission` before building.
Stop if the differentiator is planned rather than visible in the proposed V1.

Prefer a narrow, accountless first loop with low policy surface. Do not add
accounts, payments, public UGC, or tracking unless they create immediate user
value and their compliance work is explicitly scoped.

## 2. Establish the architecture

Use this dependency direction:

```text
thin app target -> feature package -> domain/API package
                              \----> shared bamware-ios products
```

- Keep app lifecycle, routing, platform permissions, and dependency composition
  in the app target.
- Keep reusable feature UI and observable state in the feature package.
- Keep immutable Sendable models and async networking in a UI-free package.
- Keep differentiated intelligence in the API; return typed semantic data, not
  server-controlled UI layout.
- Pin shared-package revisions for standalone builds. Use a development
  workspace for sibling-package substitution.

Verify client models against the live backend schema before declaring the
contract complete.

## 3. Lock identity

Set one canonical identity across repository, app, target, scheme, executable,
module, tests, bundle identifier, App Store record, metadata, and legal pages.
Add a CI identity tripwire that rejects legacy names and identifiers.

Do not carry compatibility aliases for an identity that never shipped.

## 4. Build the smallest differentiated binary

- Implement onboarding only when it teaches a real product concept.
- Make optional permissions genuinely optional with a deterministic fallback.
- Put the 4.3 differentiator in the primary flow and venue/detail surfaces.
- Expose provenance, confidence, freshness, or other evidence when data quality
  is the product.
- Keep Release API selection deterministic at compile time.

## 5. Complete release compliance

- Real app icon
- Live privacy, terms, and support pages
- Correct usage descriptions and export-compliance declaration
- Privacy manifest for required-reason APIs
- App Privacy answer verified against production infrastructure logging
- Attribution and content rights
- No dormant auth, StoreKit, analytics, or development URLs in the archive

## 6. Prove the client

Run all applicable gates:

1. Shared-package strict-concurrency tests
2. Feature/domain package tests on an iOS simulator
3. App unit tests
4. UI smoke and deterministic screenshot flow
5. Release simulator build and launch
6. Development-workspace build
7. iPad compatibility-mode launch, even for iPhone-only apps
8. Unsigned generic-device archive
9. Physical permission-state matrix
10. Identity and credential tripwires

Mocked tests are not integration proof. Exercise the production Release client
against the deployed API before upload.

## 7. Prepare the listing as code

Commit metadata, review notes, screenshot automation, raw captures, and final
opaque screenshots. Lead with the differentiator, not the generic category.

Validate character limits, URLs, dimensions, alpha channels, device framing,
and every factual claim against the exact binary and production API.

## 8. Create the Apple record

Create the App ID and App Store Connect app with the exact bundle identifier.
Complete only claims supported by the current binary. Do not promise roadmap
features in metadata or review notes.

## 9. Upload the first build

Credential-bearing work runs only in Claude Code CLI.

For an immediate first build, a Team App Store Connect API key can authenticate
Xcode's managed signing and upload path. Use a temporary export-options plist
with `method=app-store-connect`, `destination=upload`, automatic signing, and
managed build-number/version updates. Pass the API key path, key ID, and issuer
ID through Xcode's authentication flags. Keep all credential files outside git
and remove temporary release artifacts afterward.

For unattended GitHub CI, install an Apple Distribution certificate that
includes its private key, create/download the app-specific provisioning
profile, archive with `gym`, and upload with `pilot`. Store capabilities in a
protected environment restricted to the release branch.

Never confuse these artifacts:

- `.p8`: App Store Connect API private key
- Key ID: short identifier for that key
- Issuer ID: team UUID used to create API JWTs
- `.cer`: public signing certificate only
- `.p12`: signing certificate plus exportable private key
- `.mobileprovision`: bundle-specific provisioning profile

## 10. Verify the milestone

- Query App Store Connect until processing reports `VALID`.
- Add the build to internal testing if needed.
- Install through the TestFlight app on a physical iPhone.
- Smoke the exact build, including optional-permission allow/deny paths.
- Record version, build number, commit, test evidence, and remaining blockers.

Only then mark the first TestFlight milestone complete.

## 11. Hand off

Run `session-handoff`, update durable state, and push verified context. Then use
`store-submission` for listing completion, questionnaires, TestFlight-to-review
selection, and App Store submission.
