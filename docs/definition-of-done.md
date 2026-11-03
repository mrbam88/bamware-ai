# Definition of done (all repos)

1. `tsc --noEmit` exits 0.
2. Tests pass (`jest`). Mocked tests are not proof of integration — if you
   changed an API surface, hit the live dev endpoint or update both sides.
3. **The app BOOTS.** For mobile: build + launch in simulator/emulator. A change
   nobody ran is not done. (35 commits once shipped unbooted. Never again.)
   Both platforms boot as of 2026-07-22, Android parity verified.
   Android facts: `ios/` is committed but `android/` is gitignored (CNG — EAS
   prebuilds from app.json; regenerate locally with `npx expo run:android`).
   Gradle needs JDK 21 (Android Studio's JBR works; newer system JDKs break AGP).
4. Styling only through theme tokens (`src/theme`, tenant config). Zero hex
   literals in feature code.
5. Maestro flows updated when UI flows change (`.maestro/`, creds via
   `MAESTRO_TEST_EMAIL/PASSWORD` env).
6. Native Swift packages run `swift test` with strict concurrency; native apps
   build and launch through their documented development workspace.

7. **Nothing ships to TestFlight unseen.** Before every upload, install the
   Release build on a simulator against PRODUCTION, drive it past onboarding,
   screenshot every top-level surface (each tab, one detail screen), and the
   supervisor reads them. Fixture tests and a green backend curl are not this
   step. (Build 34, 2026-11-03: chat was on, tests were green, the app
   showed three tabs; nobody had launched the real build.) Mechanism:
   `scripts/smoke-release.sh` in bamware-brewdesk writes the screenshots;
   the live contract tests (`BREWDESK_LIVE_CONTRACT=1`) decode production
   responses with the app's own models and run nightly and before upload.

For context repos (`bamware-ai`, `interviews`), the equivalent gate is
`python3 scripts/check-context.py`.
