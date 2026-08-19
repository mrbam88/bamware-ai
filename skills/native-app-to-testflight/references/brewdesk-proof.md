# BrewDesk proof checkpoint

Verified on 2026-08-19.

## Why it matters

BrewDesk proved Bamware can take a distinct product from concept through a
backend-backed native SwiftUI client, Apple infrastructure, and a physically
installed TestFlight build. This is the first complete proof of the repeatable
native-app process engine and a strategic founder milestone.

## Proven result

- App: BrewDesk 1.0 (1)
- Bundle: `io.bamware.brewdesk`
- Client commit: `cbbc25f`
- App Store Connect processing state: `VALID`
- Physical result: installed and working from TestFlight on Bilal's iPhone
- Durable state: `STATE.md` and `docs/brewdesk-go-live.md`

## Architecture that shipped

```text
BrewDesk app shell
  -> BrewDeskKit feature UI and observable state
    -> VenueKit Sendable models and async API client
    -> pinned bamware-ios shared products
  -> production Venue Engine
```

The client remains intentionally light. The API owns venue data, scoring, and
provenance; SwiftUI owns native interaction and presentation.

## Gates that passed

- Canonical identity and legacy-name tripwire
- Swift strict-concurrency package tests
- Full Release app and UI tests
- Deterministic App Store screenshot automation
- Release build and development-workspace build
- iPad Air compatibility-mode smoke
- Unsigned device archive
- Evidence-first 4.3 preflight and listing assets
- App Store Connect upload and processing verification
- Physical TestFlight installation

## Signing lesson

Baat's Apple Distribution certificate lived inside EAS. Downloading Baat's
`.mobileprovision` did not make it reusable for BrewDesk, and the downloaded
`.cer` had no matching private key on the Mac.

The successful first BrewDesk upload used a Team App Store Connect API key and
Xcode cloud-managed distribution signing. This avoided creating or exposing an
exportable `.p12`. The committed GitHub fastlane rail still requires a `.p12`
for unattended signing.

## Durable pitfalls

- A Key ID is not an Issuer ID.
- A `.cer` cannot sign without its private key.
- A provisioning profile is tied to a bundle identifier.
- EAS-held credentials do not automatically transfer to a native Swift app.
- A successful upload is not done until processing is `VALID`.
- A processed build is not the milestone until it installs through TestFlight.
- Credentials stay out of git, chat, build logs, and durable context.
