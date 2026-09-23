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

Omarchy's Voxtype: hold F9 (Fn+F9 unless Fn Lock) or toggle with Super+Ctrl+X.

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
