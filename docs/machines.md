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
aws-cli 2, `gh`, `git`, plus a user-local toolchain in `~/.local/bin` (see below).
Not installed: `flutter`, `dart`, `vercel`.
`ANDROID_HOME` is unset even though the SDK directory exists.

**No passwordless sudo.** `apt` and `snap` both prompt for a password, so an
unattended agent cannot install system packages here. Install user-local
instead: `~/.local/bin` is already on `PATH`, and upstream release binaries
land there without sudo. Everything below was installed that way.

### Editor (set up 2026-09-08)

Config is `mrbam88/nvim` (LazyVim) at `~/.config/nvim`. Neovim **v0.12.5** in
`~/.local/opt/nvim-linux-x86_64`, symlinked to `~/.local/bin/nvim`. Ubuntu's apt
neovim is 0.6.1 — below LazyVim's 0.9 floor — which is why the tarball is used.
Also user-local for LazyVim: `rg` 15.2, `fd` 10.5, `fzf` 0.74, `lazygit` 0.65,
`tree-sitter` 0.25.10. 24 treesitter parsers built; `lua_ls` attaches.

**glibc ceiling — this will bite again.** Ubuntu 22.04 ships glibc 2.35.
tree-sitter CLI ≥0.26 is built against glibc 2.39 and dies with
``version `GLIBC_2.39' not found``. **0.25.10 is the newest that runs here.**
Expect the same class of failure from any recent Rust/Go release binary; check
`ldd --version` before assuming "latest" is installable.

**`rg` was a false positive, twice.** Claude Code's shell snapshot defines `rg`
as a *shell function*, so `command -v rg` succeeds in an agent shell while no
`rg` binary exists — nvim's `checkhealth` then reports it missing and the
picker's grep is dead. When auditing what is installed on a machine, verify
with `ls -la "$(command -v X)"` or `type X`, not `command -v X` alone.

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
- **Terminal look (set 2026-09-11):** Tokyo Night Storm, ~4% transparency,
  JetBrainsMono Nerd Font 14, matched to nvim's `tokyonight-storm`
  (transparent bg, `lua/plugins/theme.lua`). Mac: iTerm2 dynamic profile
  `dotfiles/iterm2/tokyonight-storm-glass.json` (iTerm writes GUI tweaks back
  into that file — commit them). ThinkPad: `dotfiles/linux/` scripts create the
  same GNOME Terminal profile via dconf + install the font user-local;
  `install.sh` runs both on Linux and pulls the nvim repo. Bilal is red-green
  colorblind — the nvim config also carries colorblind-safe alternates
  (`colorschemes-colorblind.lua`); prefer blue/orange over red/green in any UI.
