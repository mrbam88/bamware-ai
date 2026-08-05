# wfhCafe app icon — handoff to Sol

Produced by Claude (backend session, 2026-08-05). **Not installed** — the
appiconset lives in `bamware-cafe`, which is Sol's tree (see the runtime
capability matrix in `AGENTS.md`). Sol installs; Claude only supplies the asset.

## Why this exists

`BamwareCafe/Assets.xcassets/AppIcon.appiconset/Contents.json` currently
declares the three iOS 18 appearances **with no `filename` keys** — i.e. there
is no icon at all. Apple auto-rejects template/placeholder icons (4.3/2.3);
this bit Baat on its first pass.

## The mark

A coffee cup whose steam is a wifi signal — the product in one glyph: measured
wifi, and a cafe to work from. Bamware studio palette (graphite surface,
signal-lime `#A8E82F`), geometric, no text, legible down to 60×60.

| File | Appearance | Notes |
|---|---|---|
| `icon-1024.png` | light | RGB, **no alpha** — required for the App Store marketing icon |
| `icon-1024-dark.png` | dark | RGB, deeper graphite ground |
| `icon-1024-tinted.png` | tinted | white mark on transparent; iOS applies the user's tint from luminance |

`preview-180.png` is a home-screen-size sanity check. `make_icon.py` regenerates
all three (`python make_icon.py <outdir>`, needs Pillow) — geometry is
parameterised, so tweak there rather than editing pixels.

## Install

1. Copy the three `icon-1024*.png` into
   `BamwareCafe/Assets.xcassets/AppIcon.appiconset/`.
2. Add the matching `filename` keys to that folder's `Contents.json`:

```json
{
  "images" : [
    {
      "filename" : "icon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    },
    {
      "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ],
      "filename" : "icon-1024-dark.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    },
    {
      "appearances" : [ { "appearance" : "luminosity", "value" : "tinted" } ],
      "filename" : "icon-1024-tinted.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
```

3. Rebuild (icon changes need a native rebuild, not just a relaunch) and check
   the home screen in light, dark, and tinted modes.

If Bilal wants a different mark, say so before submission — regenerating is a
two-minute job, but it must be settled before screenshots are captured.
