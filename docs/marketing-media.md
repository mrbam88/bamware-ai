# Marketing media (BrewDesk pack, 2026-09)

Made 2026-09-22 for Bilal's Fiverr and Contra profiles. This is the
"marketing campaign" step from STATE.md. $0 spend, local Mac tooling only.
Never mention Baat in any of it.

## What exists

All files live in `bamware-web/marketing/2026-09/` (web#41, merged 2026-09-22).

| File | Spec | Use |
|---|---|---|
| `brewdesk-hero-9x16.mp4` | 1080x1920, 36.7 s, H.264, 5.7 MB | Hero video (Fiverr/Contra portfolio, social) |
| `brewdesk-hero-16x9-contra-header.mp4` | 1920x1080, 36.7 s, phone centred on graphite, side captions | Contra profile header |
| `brewdesk-hero-16x9-fiverr.mp4` | 1920x1080, 39.7 s (3 s title card + hero + 3 s end card) | Fiverr gig video (limit 75 s) |
| `brewdesk-hero-contact-sheet.png` | 1 fps tiles of the 9:16 hero | QA evidence |
| `brewdesk-mockup-1280x769.png` | three phones, headline | Fiverr gig primary image |
| `brewdesk-mockup-1600x1200.png` | 4:3 | Contra featured media |
| `brewdesk-mockup-1080x1080.png` | square | portfolio |
| `bamware-process-1280x769.png` | Scope → Build → TestFlight → App Store, build-console cards | gig gallery |
| `screenshots/{light,dark}/brewdesk-{map,detail,search,saved,launch-reveal}-*.png` | 1290x2796 | clean stills, both appearances |
| `brewdesk-case-study.pdf` | US Letter, one page, brand-styled | "BrewDesk: from idea to App Store" |
| `src/` | HTML/CSS pages, Maestro flows, `cut2.py`, `cards.py`, `render.py`, `reset.sh`, `stills.sh` | regeneration |

Storyline of the hero: cold launch reveal → map at street zoom (West
Village) → tap the top card (Carmela Coffee, 84) → detail with Workability
evidence → search "SEY" → map flies to SEY Coffee (59) → Save → Saved tab →
3 s end card ("BrewDesk · live on the App Store" / "built by Bamware ·
bamware.io"). Captions: Geist, lime `#A8E82F` on graphite `#121517`, no
emoji, no music.

Case-study figures and where they came from: 6,931 venues / 3,262 with
photos / 50 metros (engine `/v1/health`, 2026-09-22); 866 backend tests
(STATE.md 2026-09-20); 660+ iOS tests = 49 app + 105 UI + 508 package
`func test` counts on `bamware-brewdesk@9566a9f`; 30 TestFlight builds
(1.0 (1) → 1.1 (30)); App Review approved 2026-09-12, 3 business days after
the 2.1 reply.

## How to regenerate (M3 Mac only)

1. Build: `bamware-brewdesk` main, `xcodebuild -project BrewDesk.xcodeproj
   -scheme BrewDesk -configuration Release -destination
   "platform=iOS Simulator,id=<udid>" CODE_SIGN_IDENTITY="-" build`.
   Use the project, not `BrewDeskDevelopment.xcworkspace` (it wants a
   sibling `../bamware-ios` checkout).
2. Simulator: `xcrun simctl create bd-marketing
   com.apple.CoreSimulator.SimDeviceType.iPhone-16-Plus
   com.apple.CoreSimulator.SimRuntime.iOS-26-5` → native 1290x2796 stills.
   Address it by UDID; several sims are usually booted, so `booted` is
   ambiguous.
3. `src/reset.sh`: uninstall/install, grant location, set the simulated
   location (40.7291,-74.0007), and write BOTH defaults
   `brewdesk.onboarding.complete` and `brewdesk.location-intro.complete`
   (the first alone still stops on the location screen).
4. Wait for `uptime` 1-min load < 12 (other sessions push it past 100).
5. Video: `xcrun simctl io <udid> recordVideo --codec h264 --force take.mov`
   then `maestro --device <udid> test src/flows/hero_take1.yaml` (Maestro
   `launchApp` = no flags, so the launch reveal plays). Stop the recorder
   with SIGINT.
6. Edit: `python3 src/cut2.py take_cfr.mp4 out` after
   `ffmpeg -i take.mov -vf fps=30 … take_cfr.mp4`. Segment times in
   `SEGS` are read off a 2 fps contact sheet of the take.
7. Stills: `src/stills.sh light` and `src/stills.sh dark` (flag launch with
   `-brewdesk.debug.environment production
   -brewdesk.uitest-fixed-location "40.7291|-74.0007"`).
8. Images/PDF: `python3 src/render.py page.html out.png W H` (or `… pdf`)
   using the Playwright headless shell in `~/Library/Caches/ms-playwright`.
   Fonts: Geist from the vercel/geist-font release zip, JetBrains Mono NL
   Nerd Font from `~/Library/Fonts`.

## Gotchas learned

- `simctl recordVideo` is variable frame rate and writes no frames while
  the screen is static; trimming a static hold yields an empty segment.
  Normalise to 30 fps before cutting.
- Tapping a pin by its accessibility label hits the neighbouring unrated
  pin (annotation frames overlap at street zoom). Tap the shelf card
  instead; double-tap zoom must land on an empty spot (the park works).
- Maestro `extendedWaitUntil … optional: true` is the only pause; it runs
  about 2x its timeout.
- Google Chrome `--headless=new --screenshot` renders but never exits on
  this Mac; the Playwright `chrome-headless-shell` binary exits cleanly.
- Homebrew ffmpeg 9 has no `drawtext`; captions are PIL PNG overlays with
  `enable=between(t,a,b)`.
- The `-brewdesk.*` launch args do not count as UI-test flags and do not
  skip the reveal; anything starting with `-UITest` does.
