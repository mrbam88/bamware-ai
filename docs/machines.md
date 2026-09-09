# Machines — the two physical devices

A machine is a **cache of this repo** (AGENTS.md). Nothing is authored locally;
`scripts/bootstrap.sh` rebuilds any of them. This file exists for one reason:
**capability is a property of the machine, not just the harness.** The matrix in
`docs/runtimes.md` is keyed by runtime — but Claude Code CLI on the ThinkPad
cannot touch Xcode no matter what the runtime column says. Read both.

Registered 2026-09-08. Two devices, both Bilal's.

## `mac` — MacBook Pro (M3 Pro), macOS

**The only machine that can ship.** Everything Apple lives here and nowhere else.

- Xcode, simulators, `xcodebuild`, XCUITest
- fastlane, App Store Connect upload, signing — the **free local rail** that
  replaces GitHub Actions macOS runners (Actions is BACKUP only, 2026-08-21;
  see the HARD SPEND RULE in AGENTS.md)
- The headless DEV/QA runners: `skills/standing-engineer`,
  `skills/night-supervisor`
- Android local rail: JDK 21 (Android Studio's JBR — newer system JDKs break
  AGP), `ANDROID_HOME=~/Library/Android/sdk`
- Physical iPhone 15 Pro pairs here (device smokes, App Review screen recordings)
- Usual simulators of record: iPhone 17 Pro / 17 Pro Max, iPad Pro 13-inch (M5)

Known constraint: Baat's EAS distribution certificate has **no exportable
private key on this Mac**, which is why both TestFlight builds used Xcode
cloud-managed signing and why the protected `production` GitHub environment
still cannot run (STATE.md, Blocked on Bilal).

Run one simulator-using agent at a time — sequential, not parallel
(`docs/token-diet.md`).

## `thinkpad` — ThinkPad X1 Carbon Gen 12, Ubuntu 22.04 LTS

Intel Core Ultra 7 155U · 14 threads · 30 GiB RAM · 228 GB disk · kernel 6.8

**Cannot do anything Apple.** No Xcode, no simulators, no fastlane, no signing,
no `.ipa`. A ticket that touches the iOS app is not assignable here — reassign,
never work around.

Good for:

- Backend / API work (`bamware-venue-engine`, auth, dating services)
- Docs, grooming, board ops, ticket writing
- The Flutter/Android track (Android SDK present; Android is parked as of
  2026-09-08, so this is latent capability, not queued work)
- Long research and bulk reads

Installed: `adb`, OpenJDK 17, Android SDK at `~/Android/Sdk`, node 20, docker,
aws-cli 2, `rg`, `gh`, `git`.
Not installed: `flutter`, `dart`, `vercel`, `fd`, `fzf`, `lazygit`.
`ANDROID_HOME` is unset even though the SDK directory exists.
Editor: neovim config is `mrbam88/nvim` → `~/.config/nvim`; Ubuntu's apt
neovim is 0.6.1 and **too old for LazyVim** (needs ≥0.9) — install a current
build separately.

## Rules

- **Check the machine before accepting Apple work.** "Claude Code CLI ✅ owns
  Xcode" in `docs/runtimes.md` means *on the Mac*.
- Credentials do not travel between machines to close a capability gap.
  Reassign the job. (`docs/security.md`)
- Per-machine setup that is deliberately NOT in git: `~/.aws/credentials`
  (`aws configure --profile bamware`, then `scripts/secrets-pull.sh`), SSH keys,
  vendor logins (`claude login`, `opencode auth`), `~/.oh-my-zsh`.
- Shell/editor config syncs through `mrbam88/dotfiles` (`dots-pull` /
  `dots-push`); nvim through `mrbam88/nvim`. Both are separate from this repo.
