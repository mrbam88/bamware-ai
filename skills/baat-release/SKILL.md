---
name: baat-release
description: Ship Baat app changes — decide between OTA update, store release, or local fastlane build, and execute the right rail. Use when asked to release, ship, deploy, or publish the mobile app.
---

# Releasing Baat

> ⚠️ **Baat cannot ship to the App Store** — rejected 2026-08-04 under 4.3(b),
> concept rejection, account flagged. See `docs/app-store-rejections.md`.
> This rail (OTA / EAS / TestFlight mechanics) remains valid for TestFlight
> builds, Android, and is the template for the next RN app's release rail.

Full reference: `bamware-dating-app/docs/RELEASING.md`. This is the
decision procedure.

## Decide the rail

1. **JS/TS/styles/assets only?** → merge to `main`. `ota-update.yml`
   publishes an EAS Update to the `preview` channel automatically
   (~1 min). Done.
2. **Native change** (new native module, SDK bump, `app.json` native
   config, permission)? → bump `version` in `app.json`, then
   `git tag v<version> && git push --tags`. `release.yml` builds via EAS
   and submits to TestFlight + Play internal (gated by the GitHub
   `production` Environment).
3. **EAS unavailable/quota** → Rail B: `bundle exec fastlane
   ios_native_ship` (needs `ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_P8_B64` in
   env — never ask for or handle the values; if missing, stop and tell
   the human).

## Hard rules

- OTA reaches only builds whose `app.json` `version` matches
  (`runtimeVersion.policy = appVersion`). Native change without a
  version bump = OTA silently targets the wrong runtime. Bump first.
- Never run `fastlane version_bump` for EAS-rail releases — EAS
  auto-increments remotely; the fastlane bumps are for Rail B only.
- OTA must not change what the app fundamentally is (store policy).
  Features → tagged release. Fixes/copy/tweaks → OTA.
- Verify after OTA: the update appears in the EAS dashboard
  (expo.dev/accounts/mrbam88/projects/baat). Silence ≠ success — check
  the `ota-update.yml` run conclusion.

## Preview / manual builds

`gh workflow run release.yml -f platform=ios -f profile=preview -f submit=false`

## Gotchas learned in production (2026-07-22, first release)

- **Added a native capability?** (push, associated domains, etc.) The
  stored App Store provisioning profile does NOT auto-update — builds
  fail with "profile doesn't support X capability." Fix: Bilal runs
  `npx eas-cli credentials -p ios` → production → Build Credentials →
  delete provisioning profile → set up all — EAS re-mints it with
  current entitlements from app.json.
- **CI can't answer interactive EAS prompts.** If a build fails with
  "stdin is not readable / Failed to display prompt", the fix is a
  local interactive `eas credentials` run, never a workflow change.
- **`eas credentials` asks "Generate a new API key?"** → answer **n**
  when a key was already created in App Store Connect; y creates a
  second key.
- **Android's two Google JSONs are different things:**
  `google-services.json` = Firebase (unused — we push via AWS SNS).
  Play submission needs a *service-account* JSON (`"type":
  "service_account"`, from Google Cloud IAM, granted Release Manager in
  Play Console). Android state: Play app ✓, EAS keystore ✓, service
  account still pending.
