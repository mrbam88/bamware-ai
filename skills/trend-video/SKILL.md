---
name: trend-video
description: Make a realistic AI video of real people performing a viral trend clip (e.g. "Hotel Lobby"): likeness from photos, lip sync and moves from the original footage. Use when asked to put someone in a trend or music video, make a family trend video, or iterate on one.
---

# Trend video: real people, real performance

The product is **likeness**, then **sync**. Every choice below serves one of the
two. Proven on the 2026-09 Hotel Lobby spike (#57). Every run, cost and
gotcha is in `docs/video-gen-spike.md`, and the business case is in
`docs/family-video-prd.md` plus `docs/family-video-market.md`.

## Rules

- **Spend:** quote before every paid render (AGENTS.md $20 rule). Keys:
  `bash scripts/video-spike/keys.sh` → vault `/bamware/video-spike/*`.
- **Privacy:** photos and renders stay in `~/Movies/video-spike/`. This repo is
  public: scripts and findings only, no faces, no names.
- **Preview first:** any new size, step count or framing gets a short preview
  before a long render.
- **Iterate one clip** (~10 s) until Bilal calls it done. Show each version,
  ask what's off, and change one thing at a time.
- **Consent and rights:** the family's consent for their likeness. Trend
  songs and footage are unlicensed for commercial use (market doc §4).

## Tool routing

| Need | Tool | Why |
|---|---|---|
| Lip sync and moves, per person | **Kling v3 Pro Motion Control** (`fal_kling_motion.py`, $0.168/s) with a face lock (`--face-front/--face-ref`) | copies mouth and motion frame by frame; one person per clip (rejects two) |
| Likeness, both people in one pass | **Kling O1 edit** (`fal_kling_o1_edit.py`, $0.168/s, 3–10 s) | best faces and one consistent scene, but it re-imagines the performance (sync loose, cuts shifted) and keeps the source bodies' heights. Use its frames as start images |
| Free, local | Wan 2.2 Animate on ComfyUI (`wan_animate_replace.py`) | proves the method; ~10 min of M3 time per second at 480p |
| Avoid | hosted Wan replace on fal.ai; the RunPod bootstrap | no control inputs / never ran |

## Steps

1. **Driving clip:** the official source at the highest resolution
   (`yt-dlp`, 4K), cut to the trend window (align a reference Reel's audio to
   the original to find it). Prefer stretches with subtle motion and space
   between the performers. Detect the camera cuts (ffmpeg scene score). Done
   when the window, the cut times and one vertical crop per performer exist.
2. **References:** only the curated photos Bilal provides. Face crops (a
   frontal plus 1–2 angles, glasses as worn), and one start image per person
   that is a *real* photo or an O1 frame, with FLUX edits (`flux_keyframe.py
   --image`) for outfit, bling, clear glasses or an orange background. Check
   the face is unchanged after every edit. Done when each person has a face
   lock plus a start image.
3. **Render per person:** Kling Motion Control on each vertical crop. The
   prompt states age, height and "subtle slow hip-hop moves, lips mouthing
   every word". Done when both clips exist and each face matches the photos.
4. **Stitch:** `composite_scaled.py`: cutouts (cached masks), per-shot clean
   plates (one FLUX "remove all people, no floor, same vignette" plate per
   camera shot), widescreen canvas (`--canvas-x0 0 --canvas-w 3840`), a little
   space (`--space`), height-true scale from the real heights (`--left-cm
   --right-cm`). Done when both bodies reach the frame edge, one mic shows,
   and the taller person reads taller in every shot.
5. **Finish:** a film grade (the ffmpeg `eq/colorbalance/curves/noise/vignette`
   line in `docs/video-gen-spike.md`), then `discord_upload.sh
   "caption|file"` (auto-fits 10 MB). Log the run in the spike doc's results
   table. Done when Discord returns 200 and the row is committed.

## Gotchas that cost hours

- Kling Motion Control rejects any clip with two people: "No complete upper
  body detected".
- Kling Motion Control can silently return a clip shorter than its driver
  (her 20 s run came back 11.2 s). Check both durations before stitching;
  `composite_scaled.py` now refuses mismatched lengths.
- O1's picture can run early against the kept song. Compare cut times
  (`cut_offset.py`), but a re-sync won't restore its loose lip sync.
- Per-person renders have unrelated scales: always stitch height-true, and
  clamp turned-away heads (the ±15% rule in `composite_scaled.py`).
- MPS: SAM2 must run in fp32; outputs over ~480×832×49 frames come back
  silently black; the ComfyUI and mlx-serve memory caps need
  `--max-resident-mem 27GB`.
- `mlx-serve pull` skips subfolders: use `hf_fetch.py`.
- Template references that work: the Amen and Godfather Reels (widescreen,
  film look, natural scale). The Obama Short scales one person too big. The "Power" Reel re-grades the orange set to a moody amber to fit the show: the grade can carry a theme.
