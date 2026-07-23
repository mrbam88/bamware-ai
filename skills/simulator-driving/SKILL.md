---
name: simulator-driving
description: Drive the iOS simulator reliably for testing and screenshots — signing/entitlement traps, text-input strategies, session/keychain behavior. Use when automating the app in a simulator, debugging "works via API but not in app," or capturing screens.
---

# Simulator driving (lessons from Baat launch week)

## Build traps

- **NEVER build sim apps with `CODE_SIGNING_ALLOWED=NO`** — it strips
  entitlements → Keychain/expo-secure-store silently fail → login
  "succeeds" at the API but the app can't store the session. Use
  ad-hoc signing: `CODE_SIGN_IDENTITY="-"`.
- Sim **keychain survives app uninstall**. "Fresh install" ≠ fresh
  session — sign out through the UI to actually clear it.
- Metro serves whichever checkout started it (port 8081). Two
  checkouts = silent wrong-code serving. One Metro, know its cwd.

## Text input strategies (in order of reliability)

1. **Metro prefill** (best for dev builds): temporarily hardcode
   values in the screen's useState, let hot-reload deliver them, tap
   the button, revert the file. Zero typing, deterministic.
2. **Clipboard paste**: `simctl pbcopy`-equivalent + long-press →
   Paste. Watch for double-paste; verify field content by screenshot.
3. **HID typing**: drops characters on longer strings — type in ≤10
   char chunks. Never trust it blind; screenshot-verify.
- **Maestro `inputText` CANNOT fill secure (password) fields** on iOS
  (XCUITest limitation) — flows must use env-injected creds into
  non-secure fields or skip login (pre-authed state).

## Screenshots

- Native resolution: `xcrun simctl io <udid> screenshot out.png` —
  iPhone 17 Pro Max = 1320×2868 (App Store 6.9" spec, upload-ready).
- The agent-view screenshot tool downscales; use simctl for deliverables.
- Old apps on the sim can steal foreground (universal links, dev
  clients) — uninstall stale apps from the device before long flows.

## Session gotchas

- Dev auth tokens expire ~30 min and there is no refresh endpoint yet —
  plan capture runs to finish inside one session, or re-login.
