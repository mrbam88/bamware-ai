# ThinkPad Omarchy desktop setup

Desktop customizations on the `thinkpad` (X1 Carbon Gen 12) after its move to
Omarchy. Set up and verified 2026-09-23. Machine facts live in
`docs/machines.md`; this file covers how the desktop is tuned so a later session
can adjust it instead of rediscovering it.

Omarchy's Hyprland config is Lua. User overrides live in `~/.config/hypr/`;
never edit `/usr/share/omarchy/` (the package owns it). After any change run
`hyprctl reload && hyprctl configerrors`.

## How Bilal works

- **Mac muscle memory, Omarchy window management.** Bilal's primary machine is
  a Mac. A full macOS-style remap (Cmd = Super for every app shortcut, window
  management moved off Super) was tried and **rejected**: he wants Omarchy's
  Super tiling bindings kept (Super+arrows, Super+1-9, Super+F, ...). Add Mac
  shortcuts only on Super keys Omarchy leaves free.
- **Scrolling layout, never the dwindle grid.** He uses Hyprland's scrolling
  layout (Super+L toggles it per workspace; saved in
  `~/.local/state/omarchy/workspace-layouts/<ws>.lua`). He finds the grid too
  small. Never switch his workspace layout; design window tweaks for scrolling.
- Super+O "pops out" a window (float + pin); Super+arrows then skips it. Press
  Super+O again to put it back.

## Keyboard and touchpad (`~/.config/hypr/input.lua`, `bindings.lua`)

- `kb_options` adds `altwin:swap_lalt_lwin` to Omarchy's defaults, so the key
  beside the spacebar is Super (Cmd position) and the Windows key is Alt
  (Option position). Fn/Ctrl are already Mac order on the X1; don't swap in BIOS.
- Natural scrolling on. Two-finger click is Omarchy's default.
- Omarchy already ships universal Super+C/V/X. `bindings.lua` adds Super+A,
  Super+Z, Super+Shift+Z, Super+R, Super+N (sent as Ctrl+key to non-terminal
  windows) and Super+Q (close window).

## Dictation (Wispr Flow replacement)

Omarchy's Voxtype: hold **Right Ctrl**, click the bar mic, or toggle with Super+Ctrl+X.

- **Engine: Parakeet**, not Whisper. `engine = "parakeet"`, model
  `parakeet-tdt-0.6b-v3-int8` (CPU, ONNX). About 1 s to transcribe an 11 s clip.
  Whisper large-v3-turbo on this iGPU (Vulkan) took about 8 s per clip,
  whatever the clip length, which is too slow. The config backup with Whisper
  is `~/.config/voxtype/config.toml.bak.whisper`.
- `/usr/bin/voxtype` must point to the ONNX binary (`sudo voxtype setup onnx
  --enable`). This CPU has **no AVX-512**; use the `-avx2` builds.
- `models.voxtype.io` returned 403 for Parakeet. The model files came straight
  from Hugging Face `istupakov/parakeet-tdt-0.6b-v3-onnx`
  (`encoder-model.int8.onnx`, `decoder_joint-model.int8.onnx`, `vocab.txt`,
  `config.json`, `nemo128.onnx`) into
  `~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3-int8/`.
- **Cleanup: `~/.local/bin/voxtype-cleanup`**, set as `[output.post_process]`.
  Rule-based (about 15 ms): removes um/uh/hmm and word stutters, and fixes
  spacing and capitals. Local LLM cleanup was measured and rejected as the
  default: qwen2.5:3b took about 2 s and dropped real words; qwen2.5:7b was
  accurate but took 2-4.5 s. Setting `VOXTYPE_CLEANUP_MODEL=qwen2.5:7b` enables
  LLM handling of self-corrections ("no wait", "scratch that"). Open option: the
  Claude API (Haiku) for fast self-correction handling.
- **Starting dictation:** use the **mic button on the bar**, the custom
  `bilalx1.dictation` widget in `~/.config/omarchy/plugins/bilalx1.dictation/`.
  Click to start and click to stop (`voxtype record toggle`); it shows red
  while recording and an hourglass while transcribing, and right click opens
  the Voxtype settings. Verified working 2026-09-24. Holding F9 is unreliable
  on the X1: Fn+F9 arrives as rapid press/release pairs, so push-to-talk
  records sub-second fragments. **Hold-to-talk is Right Ctrl** (bound in
  `~/.config/hypr/bindings.lua` with `voxtype record start`/`stop` on
  press/release), verified 2026-09-24; Bilal calls it "a good button". Super+Ctrl+X
  also toggles.
- **Typing goes through ydotool, not wtype** (`driver_order = ["ydotool",
  "wtype"]`). With wtype, Ghostty misread modifiers from wtype's per-client
  keymap: capital B vanished and S arrived as `CSI 83;5u` (Ctrl+S).
  Reproduced with `wtype` into `ghostty -e cat`; foot was fine. ydotoold runs as
  a system service (`/etc/systemd/system/ydotoold.service`, socket
  `/run/ydotoold/socket` owned by bilalx1), and the voxtype user unit gets
  `YDOTOOL_SOCKET` from `~/.config/systemd/user/voxtype.service.d/ydotool.conf`.
- **Vocabulary:** `~/.config/voxtype/vocabulary.tsv` has "heard<TAB>written"
  pairs. They're applied whole-word and case-insensitive by
  `voxtype-cleanup`; Voxtype's built-in `replacements` are substring matches
  and would mangle "fix code" into "fiXcode". It covers opencode, BrewDesk,
  Bamware, Hyprland, Voxtype, TestFlight, Tailscale, Xcode, Kuycon
  ("KUN"/"Conan") and Claude Code ("clawed/clock/cloud/clod code"). Bilal
  doesn't care about Omarchy's pronunciation. Add a line whenever a name keeps
  coming out wrong.
- The recording popup is at `[osd] position = "top-center"`, so it doesn't
  cover the input line in terminal apps.
- Ollama is installed with `ollama-vulkan`. The iGPU is used only with
  `OLLAMA_IGPU_ENABLE=1` (in `/etc/systemd/system/ollama.service.d/override.conf`,
  along with `OLLAMA_KEEP_ALIVE=60m`). Only `qwen2.5:7b` is kept.

## Android emulator (`~/.config/hypr/emulator.lua`)

The Android SDK is at `~/Android/Sdk`; AVD `brewdesk_api36`.

- **GPU:** the emulator wrongly falls back to software rendering on this Intel
  Meteor Lake iGPU, which is slow and can leave map views blank. The AVD
  `config.ini` sets `hw.gpu.enabled=yes` and `hw.gpu.mode=host`; it then renders
  through Mesa. The "Your GPU cannot be used for hardware rendering" log line is
  harmless. New AVDs: set Graphics to Hardware.
- The emulator's bundled Qt has no Wayland plugin; it runs under XWayland
  (fine).
- **Window sizing:** `emulator.lua` (required at the end of `hyprland.lua`):
  - Scrolling: the emulator is tiled as a phone-width column (`colresize`) at
    full height, and the column to its left is widened to fill the screen, with
    room left for the emulator's floating side toolbar.
  - Other layouts: the grid can't give it a phone-shaped tile, so it floats at
    phone size on the right.
  - It is re-applied when the emulator opens, on Super+L (rebound to toggle the
    layout and then refit), and when the emulator gets focus.
  - To refit by hand: `hyprctl eval "fit_android_emulator()"`.
- Hyprland Lua gotchas found here: static `float` rules miss the emulator
  (window rules like tags still apply), so sizing runs from
  `hl.on("window.title")` plus a delay of about 1.5 s. `monitor.width/height`
  are physical pixels; divide by `monitor.scale`. `hl.config(...)` at runtime
  re-runs config and drops runtime workspace rules. Lua API stubs:
  `/usr/share/hypr/stubs/hl.meta.lua`.

## Display

The screen is 2880x1800 at scale 2 (about 1440x900 of usable space).
Super+/ and Super+Alt+/ step through scales 1, 1.25, 1.6, 2, 3 and 4. A custom
2.4 in `~/.config/hypr/monitors.lua` was offered but not applied.

## External 6K monitor (Kuycon G32P over USB-C)

Daily-driver setup: the laptop plus a Kuycon G32P at 6144x3456@60 and scale 2,
on either left USB-C port. It connects as DP alt mode (no Thunderbolt device).
6K@60 needs DSC and two joined pipes.

**Bug (fixed locally 2026-09-23):** unplugging while active left the output
stuck. i915's `intel_tc_port_link_reset_work` re-enables the pipe on the dead
link. The logs show `pipe state doesn't match` / `UHBR10 not supported for the
platform` (Meteor Lake has no UHBR on the TBT path). The stuck pipe keeps the
Type-C PHY, so **no monitor is detected on either USB-C port until a reboot**.
Tell-tale sign: `/sys/class/drm/card1-DP-N` shows `status=disconnected` with
`enabled=enabled`. The upstream analysis puts the fix in the compositor, which
must disable the output
(https://ratatoskr.run/intel-xe/2026/06/17096046/t).

**Fix:** a VT switch away and back makes Hyprland reset every CRTC, which frees
the PHY. It is automated:

- `/usr/local/bin/drm-unstick-typec` polls every 0.25 s for 12 s. When an
  output is disconnected-but-enabled for about 0.5 s, it runs `chvt` away and
  back (about a 0.5 s black flash, which Bilal likes as an "unplugged cleanly"
  signal), then keeps watching and repeats if needed (at most 3 times). It logs
  to the journal under `drm-unstick-typec`. Releasing early, before the
  driver's link reset (about 3.7 s after unplug), stops the broken re-enable
  from happening at all.
- `/etc/udev/rules.d/90-drm-unstick-typec.rules` runs it on every DRM hotplug
  via `systemd-run`.
- Verified: 2 unplug/replug cycles on each port, plus 2 more with the fast
  version. Each time it released once and the monitor came back at 6K without a
  reboot. Bilal unplugs constantly (portable daily driver), so this must stay
  reliable.
- If it is ever stuck anyway: `sudo /usr/local/bin/drm-unstick-typec`, or
  Ctrl+Alt+F2 then Ctrl+Alt+F1. A reboot always works.
- If a kernel update fixes the bug, the script sees nothing stuck and does
  nothing. Remove both files once it is no longer needed.

## TV (Samsung QBQ90 4K over a Ugreen USB-C to HDMI cable)

- The cable sometimes connects before the TV's EDID is readable. The TV then
  shows up nameless with only 640x480-1024x768 modes.
- `~/.config/hypr/monitors.lua`: a `desc:Samsung Electric Company QBQ90` rule
  sets 3840x2160@60 at scale 2. A `monitor.added` hook
  gives any display with no EDID (empty description, not eDP-1) the same 4K60
  mode instead of 640x480.
- Unplugging it can hit the same stuck-output bug as the 6K monitor; the
  `drm-unstick-typec` auto-release covers it too (seen releasing `DP-1`).

## Screen arrangement

Bilal types on the X1's own keyboard, so external screens sit physically behind
and above the laptop. `monitors.lua` places the 6K (`desc:GKT Kuycon G32P`),
the TV, and any display with no EDID at `position = "auto-center-up"`, which
centers them above eDP-1.

## Input and bar tweaks (2026-09-24)

- **Touchpad** (Sensel haptic `SNSL0028`): tap-to-click and tap-and-drag are
  off, so clicking means pressing, like a Mac. Two-finger touches while
  scrolling were becoming right-clicks, and Chrome's context menu then picked
  "Inspect". `misc.middle_click_paste = false`: a resting thumb turned presses
  into middle clicks, which pasted text at random.
- **Page Up/Down blanked on the built-in keyboard only.** `hl.device` for
  `at-translated-set-2-keyboard` uses `kb_file = ~/.config/xkb/x1-builtin.xkb`,
  which is the compiled keymap with `<PGUP>`/`<PGDN>` set to `NoSymbol`.
  Regenerate it (the command is in the file header) if `kb_options` change.
- `repeat_delay = 400` (Omarchy's default is 250).
- **fcitx5 is disabled** (`omarchy-fcitx5.service` masked, XDG autostart
  hidden). Bilal types English only. It was suspected, but not proven, of an
  opencode Ctrl+A "aaaa" key-repeat glitch in Ghostty. Status unconfirmed;
  Bilal said "might be fixed". If it recurs, compare foot and Ghostty
  (simulated keys with `wtype` never reproduced it).
- **Bar:** the clock uses 12-hour format (`dddd h:mm AP` in `shell.json`). A
  custom `bilalx1.timer` bar widget in `~/.config/omarchy/plugins/bilalx1.timer/`
  sits right of the clock: scroll sets the minutes, click starts or pauses,
  right click resets, and it sends a critical notification when done. Plugin
  icon changes may need `omarchy restart shell` to show.

## Later: iPad Pro as a second screen

Bilal wants his iPad Pro as an extra wireless screen for Omarchy (deferred,
2026-09-24; the exact model is not recorded yet). Sidecar is Mac-only. The
plan is a Hyprland headless output shared with `wayvnc`, viewed from a VNC
client on the iPad over the LAN or Tailscale.
