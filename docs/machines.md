# Machines — the three physical devices

A machine is a **cache of this repo** (AGENTS.md). Nothing is authored locally;
`scripts/bootstrap.sh` rebuilds any of them. This file exists for one reason:
**capability is a property of the machine, not just the harness.** The matrix in
`docs/runtimes.md` is keyed by runtime — but Claude Code CLI on the ThinkPad
cannot touch Xcode no matter what the runtime column says. Read both.

Registered 2026-09-08; `omarchy` added 2026-09-17; `thinkpad` moved to Omarchy
by 2026-09-23. Three devices, all Bilal's.

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

## `thinkpad` — ThinkPad X1 Carbon Gen 12, Omarchy (Arch Linux)

Intel Core Ultra 7 155U (Meteor Lake, no AVX-512) · 14 threads · 30 GiB RAM ·
237 GB disk · Omarchy, kernel 7.2

Reinstalled from Ubuntu 22.04 to Omarchy (observed 2026-09-23). The Ubuntu-era
notes (glibc 2.35 ceiling, apt neovim, GNOME Terminal profile) no longer apply.

**Name clash:** the hostname is also `omarchy`, same as the MacBook below. On
the tailnet this machine is `omarchy-1`; use full MagicDNS names, never a bare
`omarchy`.

**Cannot do anything Apple.** No Xcode, no simulators, no fastlane, no signing,
no `.ipa`. A ticket that touches the iOS app is not assignable here. Reassign
it; never work around it.

Good for:

- Backend / API work (`bamware-venue-engine`, auth, dating services)
- Docs, grooming, board ops, ticket writing
- The Android track: Android SDK at `~/Android/Sdk` (adb, emulator, AVD
  `brewdesk_api36`), Java 17 via mise. `ANDROID_HOME` is unset.
- Long research and bulk reads

`sudo` prompts for a password. An agent without a terminal can use `pkexec`
(Bilal approves a GUI prompt).

Desktop setup (Mac-style keys, dictation, emulator window sizing, and how Bilal
uses Hyprland): `docs/omarchy-thinkpad-desktop.md`.

**`rg` was a false positive, twice.** Claude Code's shell snapshot defines `rg`
as a *shell function*, so `command -v rg` succeeds in an agent shell even when
no `rg` binary exists. When auditing what is installed on a machine, verify with
`ls -la "$(command -v X)"` or `type X`, not `command -v X` alone.

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
- Not installed: `adb`, JDK, `flutter`, `vercel`. `sudo` prompts for a password.
- nvim is Omarchy's stock LazyVim config, not `mrbam88/nvim`; no
  `mrbam88/dotfiles`; shell is bash (no oh-my-zsh).
- `gh auth setup-git` pins the credential helper to a versioned mise install
  path that breaks on the next `gh` upgrade. Point it at the shim:
  `~/.local/share/mise/shims/gh auth git-credential`.
- **Always-on agent server (2026-09-18).** Reach it from anywhere via
  Tailscale SSH: `ssh bilal@omarchy.tailb7fa1e.ts.net` (no keys; auth is the
  tailnet login). Use the full MagicDNS name — bare `omarchy` resolves to the
  home-LAN IP on the X1, where ufw drops it. ufw allows `in on tailscale0`
  only. Lid close is ignored (`/etc/systemd/logind.conf.d/30-server-lid.conf`).
  Run agents inside `tmux` so they survive disconnects.
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
