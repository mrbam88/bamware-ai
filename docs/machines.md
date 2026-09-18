# Machines — the three physical devices

A machine is a **cache of this repo** (AGENTS.md). Nothing is authored locally;
`scripts/bootstrap.sh` rebuilds any of them. This file exists for one reason:
**capability is a property of the machine, not just the harness.** The matrix in
`docs/runtimes.md` is keyed by runtime — but Claude Code CLI on the ThinkPad
cannot touch Xcode no matter what the runtime column says. Read both.

Registered 2026-09-08; `omarchy` added 2026-09-17. Three devices, all Bilal's.

## `mac` — MacBook Pro (M3 Pro), macOS

**The only machine that can ship.** Everything Apple lives here and nowhere else.

- `gh` token on this Mac carries the `workflow` scope (refreshed by Bilal
  2026-09-12 via `gh auth refresh -h github.com -s workflow`). Without it
  GitHub rejects any push touching `.github/workflows/` ("refusing to allow
  an OAuth App to create or update workflow"). If a push fails that way on
  another machine, that one-liner is the fix — not a code change.

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

## `omarchy` — MacBook Pro 16" 2019 (Intel, T2), Omarchy (Arch Linux)

Intel i9-9980HK · 16 threads · 62 GiB RAM · 1.9 TB disk · kernel 7.2 (T2 patches)

Apple hardware, **Linux OS: cannot do anything Apple.** Same rule as the
ThinkPad — iOS tickets get reassigned to `mac`. Bilal (2026-09-17): "dont worry
about ios this is a linux machine." The ASC `.p8` not being in the vault is
not a gap here.

Good for the same work as the ThinkPad, with more headroom (RAM, disk, no
glibc ceiling — rolling release, glibc 2.44).

Set up 2026-09-17 with `scripts/bootstrap.sh`, which runs unchanged on Linux
despite its "any Mac" header; only `install-agent-runner.sh` is Mac-only
(`launchd`), so the headless runners are not installed here.

- Toolchain via `mise` (Omarchy default): node 26, `gh`, aws-cli 2 (`mise use -g
  aws-cli` — no sudo needed). docker, python 3.14, nvim 0.12.5, `rg`, `fd`,
  `fzf`, `lazygit` preinstalled by Omarchy.
- Not installed: `flutter`, `vercel`. `sudo` prompts for a password.
- **Android / React Native local rail (set up 2026-09-18, all user-local, no
  sudo).** Baat (`bamware-dating-app`) debug build boots to sign-in on the
  emulator via `expo run:android`. Pieces:
  - SDK at `~/Android/Sdk`; `ANDROID_HOME`, `ANDROID_AVD_HOME` and `PATH` are
    exported in `~/.bashrc` *above* the interactive guard, so agents see them.
  - Toolchain pinned per repo with an untracked `mise.local.toml` (listed in
    `.git/info/exclude`): node 20, `java = "temurin-17"`, `"npm:yarn" = "1"`.
    Global mise stays node 26 / JDK 27 — JDK 27 is too new for AGP/Gradle.
  - AVD `Pixel_8_API_36` (API 36 google_apis x86_64). `/dev/kvm` is 0666.
    Launch with `QT_QPA_PLATFORM=xcb emulator -avd Pixel_8_API_36` (Hyprland);
    GPU falls back to software rendering — works, just slower.
  - **Do not use cmdline-tools ≥ 16111833.** Its `sdkmanager` delegates to a
    native `android-cli` that downloaded at ~250 KB/s on a 3 MB/s line. The
    Java-based 19.0 (`commandlinetools-linux-13114758`) ran at ~7 MB/s.
  - **`avdmanager` writes AVDs under `$XDG_CONFIG_HOME/.android/avd`; the
    emulator reads `~/.android/avd`.** Omarchy sets `XDG_CONFIG_HOME`, hence
    `ANDROID_AVD_HOME=~/.config/.android/avd`.
- nvim is Omarchy's stock LazyVim config, not `mrbam88/nvim`; no
  `mrbam88/dotfiles`; shell is bash (no oh-my-zsh).
- `gh auth setup-git` pins the credential helper to a versioned mise install
  path that breaks on the next `gh` upgrade. Point it at the shim:
  `~/.local/share/mise/shims/gh auth git-credential`.
- Dictation: Omarchy's Voxtype (F9 push-to-talk, Super+Ctrl+X toggle). Wispr
  Flow has no Linux build.

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
