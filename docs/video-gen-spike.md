# Spike: AI video generation — cost, quality, market

Started 2026-09-27. Bilal's framing: video generation is booming; understand it
hands-on through two lenses, **cost** (token / $ per second) and **quality**
(as realistic and current as possible), plus the **basic economics** of the
apps and startups doing it. Spike, not a product commitment.

Status: research done, free local run in progress. Verdict at the bottom is
**WAIT** until the hands-on runs are measured.

Spend so far: **$0.** Budget approved for the paid round: **$20** (Bilal,
2026-09-27). Free-first: open weights on the Mac before any paid API.

## 1. What matters in one screen

- **Price per second fell ~5–10x in 18 months.** Mid-tier generation went
  from ~$0.20–0.50/s (early 2025) to ~$0.02–0.07/s. Frontier with native
  audio is still $0.10–0.60/s.
- **Budget 3–6x the sticker price.** Field reports land one usable clip per
  3–6 generations. Real $/finished-second = list $/s × re-roll factor.
- **"Tokens" mostly don't apply.** Almost everything is billed per second or in
  credits with a fixed $ rate. Veo is token-metered inside (5,792 tokens per
  second of 720p) but priced per second, so budget from the $/s table.
  Seedance 2.5 is the one model priced per token with no published
  tokens-per-second constant.
- **Sora 2 is gone.** OpenAI's deprecations page: shutdown 2026-09-24, no
  replacement. The Sora consumer app closed 2026-04-26.
- **Open weights are close to the frontier, but not the #2 model.** Wan
  3.0 / 2.5 / 2.7 are API-only (Hugging Face `Wan-AI` stops at 2.2). The best
  open models today are **LTX-2.5 22B** (Lightricks, joint audio + video) and
  **Wan 2.2**. mlx-serve also lists a **MiniMax-H3 (Hailuo 3.0)** MLX pack; H3
  is top-4 on Artificial Analysis. Verify its weights and licence before
  relying on it.
- **Market verdict (research):** do not build another generic consumer "AI
  video generator". The defensible solo shape is a narrow B2B workflow tool
  where the model is raw material.

## 2. Cost: $/generated second (2026-09-27)

List/on-demand API prices. Primary = vendor page. Secondary = cross-checked
trackers; Kling's own pricing page did not render a table.

| Model | Tier | $/s | Audio | Source |
|---|---|---|---|---|
| Google Veo 3.1 Lite | 720p / 1080p | 0.05 / 0.08 | yes | primary |
| Google Veo 3.1 Fast | 720p / 1080p / 4K | 0.10 / 0.12 / 0.30 | yes | primary |
| Google Veo 3.1 | 720p–1080p / 4K | 0.40 / 0.60 | yes | primary |
| Runway Gen-4 Turbo / Gen-4.5 | std | 0.05 / 0.12 | no | primary |
| Runway Aleph 2.0 (video-to-video) | std | 0.28 | no | primary |
| Luma Ray3.2 | 540p / 720p / 1080p | 0.03 / 0.06 / 0.24 | unclear | primary |
| Kling 2.5 Turbo (fal) | std / pro | 0.084 / 0.112 | no | secondary |
| MiniMax H3 | — | from 0.13 | yes | secondary |
| Seedance 2.0 | 480p no audio → 4K audio | 0.067 → 0.778 | tier | secondary |
| Vidu Q3 | 540p | 0.035 | no | secondary |
| Wan 2.5 (fal) | — | 0.05 | unclear | primary |
| **Local LTX-2.5 on the M3 Pro** | 4-bit MLX | **$0 cash**, render time only | yes | measured below |

$/finished minute = $/s × 60 × re-roll factor. Example: Veo 3.1 Fast 720p =
$6/min raw, ~$18–36/min after re-rolls.

Supporting pieces: keyframe images $0.04–0.24 each (Nano Banana class) or free
locally (FLUX.2-klein via mlx-serve); TTS ~$0.05–0.09/min (ElevenLabs);
self-hosted H100 $2–3.50/hr (RunPod).

## 3. Quality: leaderboards (2026-09-27)

Artificial Analysis Video Arena, text-to-video with audio: 1 Gemini Omni Flash
(1233) · 2 Wan 3.0 (1229) · 3 MiniMax H3 Max (1227) · 4 MiniMax H3 (1220) ·
5 Seedance 2.0 (1210) · … · 12 Kling 3.0 Pro (1095). Image-to-video: MiniMax
H3 Max / H3 top two; Veo 3.1 is #11. Arena.ai text-to-video: #1 Kling v3.
Different arenas use different rating pools; compare ranks, not scores.

Consistent top-5 across boards: **Kling 3.0 and MiniMax H3.** VBench's top
entries could not be identified; ignore it.

## 4. Open weights on the M3 Pro (36 GB unified, measured sizes)

| Model | Disk | RAM | Audio | Licence | Runtime |
|---|---|---|---|---|---|
| **LTX-2.5 22B, MLX 4-bit** (`ddalcu/LTX-2.5-MLX-Serve-4bit`) | 36 GB (text encoder bundled) | ~24 GB | joint audio + video | LTX-2.x Community: free under $10M revenue; must disclose AI content | `mlx-serve` (Homebrew, native, no Python) |
| Wan 2.2 TI2V-5B GGUF Q8 | ~10 GB with encoder + VAE | lower | no | Apache 2.0 | ComfyUI on Metal |
| Wan 2.2 Animate-2-14B | ~20–25 GB quantised | high | no | Apache 2.0 | ComfyUI; character replacement from a driving video |

The full LTX-2.5 release is 201 GB (bf16 transformer 42 GB, bf16 Gemma-4 12B
text encoder 26 GB). Its bf16 MLX port peaks at 40–62 GB of RAM, so on this
Mac only the 4-bit pack is viable. Reference speed: 704×480, 97 frames (4 s),
8 steps = 2m17s on an M4 Max 128 GB. M3 Pro numbers below.

LTX via mlx-serve does text-to-video, first- and last-frame conditioning, and
**audio-to-video** (`audio` = base64 WAV on `/v1/video/generations`), which
lip-syncs a clip to supplied audio.

Setup gotchas:
- The Mac had 23 GB free; cleared DerivedData, npm, Gradle caches and
  unavailable simulators to reach 55 GB.
- Homebrew refuses untrusted taps: `brew trust --formula
  ddalcu/mlx-serve/mlx-serve` before `brew install mlx-serve`.
- `mlx-serve` binds 0.0.0.0 by default; pass `--host 127.0.0.1`.

## 5. The hands-on test: "Hotel Lobby" AI trend

Trend (Sept 2026): people swap new faces into Quavo and Takeoff's 2022 COLORS
performance of "Hotel Lobby (Unc & Phew)". It started with a clip of two cats
and went fully viral after Quavo reposted the original on 2026-09-23. Template
apps (Starrd, Summrs, hotellobbyai.app) sell it as a photo-upload face swap.
Those apps are a live example of the §6 wrapper business.

What it takes technically: this is **video-to-video**, not text-to-video. The
closest free paths:
1. **LTX-2.5 audio-to-video:** a keyframe (two subjects, orange studio) plus a
   ~10 s audio clip → a lip-synced performance. Free, on the Mac.
2. **Wan 2.2 Animate:** transfers the motion of a driving video onto a
   character. The most faithful to the trend, and the heaviest.
3. Paid round: the same brief on Kling 3.0 / MiniMax H3 / Veo 3.1 within the
   $20 cap.

Rules for the test: no real people's likeness without consent (LTX acceptable
use policy plus deepfake risk); the song audio stays local and is never
committed to this public repo; if posted, use the platform's licensed sound.

Results log (fill in per run: model, resolution, seconds, wall-clock, $,
usable yes/no, notes):

| Run | Model | Output | Wall-clock | $ | Usable | Notes |
|---|---|---|---|---|---|---|
| K1 | FLUX.2-klein 4B 4-bit (text-to-image) | cats keyframe 1056×736 | 32 s | 0 | yes | trend look nailed on the first try |
| K2 | FLUX.2-klein 4B, edit mode, 2 face refs + cat scene ref | couple keyframe | 120 s | 0 | no | strong likeness, but the scene ref leaked the cat's paws onto one person |
| K3 | FLUX.2-klein 4B, edit mode, 2 face refs, scene in text | couple keyframe | 75 s | 0 | yes | human hands fixed; one likeness drifted. Identity holds but varies per re-roll |
| V1 | LTX-2.5 4-bit, text-to-video, one-stage, 8 steps | 4.0 s 704×480 + generated audio | 332 s | 0 | meme-grade | "cats" came out as people in cat masks; soft; composition jumps. Text-only prompting is the weak path |
| V2 | LTX-2.5 4-bit, image-to-video from K3, one-stage, 8 steps | 4.0 s 704×480 + generated audio | 344 s | 0 | **yes (proof of concept)** | one coherent shot; both likenesses hold from the keyframe; mouths and gestures read as rapping. Soft, second half blurs |

| S1 | FaceFusion 3.9.0 face swap (hyperswap_1b_256 + GFPGAN), 2 passes onto the real COLORS clip (10 s, 1080p) | 10 s + real song | 335 s + 301 s | 0 | no | real song and real motion fixed; likeness poor because only the inner face changes (hair, sunglasses, clothes, skin stay the performers') |

| W1 | Wan 2.2 Animate 14B Q4_K_M GGUF, Replace mode, ComfyUI on MPS, lightx2v 4-step + relight LoRAs; 4K official COLORS master (0:12–0:36) downscaled to 832×480 | 3.06 s (49 f @ 16 fps) + real song, left performer only | 1801 s (~6.5 min per step) | 0 | **yes, big step up** | whole person replaced (cap, sunglasses, moustache, shirt), lighting matched, no face/hair blend; other performer untouched |

| W2 | same, per Bilal's W1 notes: no-cap reference, vertical 480×832 crop (face ~2x larger), face crops tracked from a 1080×1920 copy | 3.06 s + real song | 1966 s | 0 | **yes: "really amazing, lip syncing is really good"** | face and glasses clearly visible; mouth shapes change with the performer's |
| W3 | W2 recipe on the right performer, her kitchen photo as reference | 3.06 s + real song | 1921 s | 0 | pending Bilal | glasses, tied-back hair, outfit from her photo; gestures follow the performer |

Bilal on W1: "really good, I'm impressed." Asked for: no cap (see the face),
and better lip sync, which is the selling point because the performers barely
move. Vertical 9:16 can't hold both performers in the medium shots; square
1:1 is the proposed final framing.

| W4 | both together, square 640×640, 6 steps, two passes | 3.06 s | 3167 s + 2702 s | 0 | **no: all black** | 17-frame diagnostics at 640² with 4 and 6 steps were fine, so the full 49 × 640² job is over an MPS size limit that silently returns zeros. Keep pixels × frames ≤ the 480×832×49 that works: use 624² for square |

Bilal on W3: her face "very accurate", but glitchier than his and the moves
need to be smoother; she needs an older, more traditional outfit and "way
more bling". Fix: a deck photo of her in a green kurta and red dupatta, with
FLUX.2-klein edit adding gold chains, a pendant, bangles and earrings (face
unchanged, 59 s, $0); 6 sampling steps instead of 4.

| W5 | both together, square 624×624, 6 steps, two passes (pass-1 black check) | 3.06 s + real song | 2582 s + 2537 s (~85 min) | 0 | pending Bilal | both recognizable in one frame; her green kurta, red dupatta and gold bling carry through; mouths move with the lyrics |

| F1 | fal.ai `fal-ai/wan/v2.2-14b/animate/replace`, 720p, 20 steps, two passes via split-and-composite (half blacked out) | 6.0 s, 1440² out + real song | 1362 s | ~0.72 | **no: Bilal "not good at all… kind of worse" than the M3** | fal picks the person itself and exposes no pose/face/mask inputs; the blacked half bled a dark seam and his likeness took the rapper's hair shape. Lesson: a hosted endpoint without control inputs loses to our own pipeline even at higher res |

| K1 | Kling v3 Pro Motion Control on fal (`fal-ai/kling-video/v3/pro/motion-control`), image = his half of the W5 frame, video = 6 s vertical 1080×1920 25 fps crop of the left performer | 6.0 s, **1072×1936 @ 30 fps** + real song | **167 s** | ~1.01 | pending Bilal | clear quality jump: sharp face, glasses, moustache, natural lip shapes. Rejects any clip with two people ("No complete upper body detected"), so it is one person per run |

| K2 | Kling v3 Pro Motion Control, one run per person, **face lock** (`elements`: frontal + 2 angles, cropped from the curated album originals), start image = W2/W5 frames, "tall six-foot" in the prompt | two 6 s vertical clips → `hstack` split screen 2162×1920 @ 30 fps + real song | 293 s + 219 s (parallel) | ~2.02 | pending Bilal | both faces now anchored to real photos; one blurred frame at the source's camera cut; split screen shows two mics/backgrounds |
| K3 | **Shared frame, 10 s:** Kling v3 Pro per person (face lock; her start = her REAL bling photo moved onto orange by FLUX edit; her face lock = kitchen, deck, mountain selfie), then `composite_pair.sh`: rembg BiRefNet-lite cutouts per frame over a FLUX-cleaned plate (one mic) at each performer's original position | 10 s, 1666×1936 @ 30 fps + real song | Kling 426 s (parallel) + matting 2061 s = 42 min | ~3.36 | pending Bilal | one background and one mic; her likeness much closer. Matting on CPU is the slow step (~1.7 s/frame) |
| K4 | v3 per Bilal's K3 notes: **per-shot plates** (scene cuts detected at 4.04 s and 7.36 s; one FLUX-cleaned plate per shot, prompted "no floor, same vignette"); her start image FLUX-edited to clear-lens glasses; her Kling re-run with an expressive prompt; his masks reused from cache | 10 s shared frame + real song | Kling 375 s + masks 1030 s | ~1.68 | pending Bilal | background now cuts with the original camera; deeper orange with vignette; her eyes visible |
| K5 | v4 height-true composite (`composite_scaled.py`): per-shot head metrics from cached masks; her scale ~0.87–0.91× and set ~0.8 head-heights lower (6'0" vs 5'4"); solver keeps both bodies touching the bottom edge; ±15% clamp for turned heads | 10 s + real song | ~3 min | 0 | pending Bilal | he now reads clearly taller; no floating bodies |
| O1 | **Kling O1 video edit, ONE pass, two people** (`fal_kling_o1_edit.py`): 4:3 crop of the original 3–13 s, two face-lock elements plus her outfit image, prompt states the heights | 10 s, 1660×1244 @ 24 fps + real song | 354 s | ~1.68 | pending Bilal | one consistent scene (lighting, mic, camera kept, no seams) at half the per-person cost; **height prompt ignored** (keeps the source bodies' proportions); his outfit drifted to a face-lock photo's sweater vest. A film-grade variant (eq/colorbalance/grain/vignette) was also posted |

**Bilal on O1:** likeness a "huge difference", with him "identical… almost
shocking" and her almost there but too young (she is 66, he is 71). But the lip
sync and beat got worse than with Motion Control. The O1 picture's cuts landed
1.87 s early (2.17/5.50 s vs 4.04/7.36 s); re-laying the song
(`resync_audio.sh`, `cut_offset.py`) did not fix it ("he is way out of sync
with the mic"). **Conclusion:** O1 re-imagines the performance; Motion Control
copies the mouth and motion frame by frame. Use O1 for likeness, Motion Control
for sync. The height-true O1 iteration was stopped before spending
(`height_true_driver.py` kept for later).

Reference Reels studied (2026-09-28): the Obama Short (keeps the full widescreen
original, wide shots included; flaw: she is scaled too big), a Lakers Reel
(4:3, one-pass look, clean), a Godfather Reel (film grade, themed wardrobe, own
shot sequence, 29 s = chained segments). Bilal: widescreen helps; the motion is
subtle slow hip-hop; space between the two people helps.
Added 2026-09-29: a Scarface Reel by the zeis.ai account (Tony and Manny,
29 s, 1448×1080 ≈ 4:3). It keeps the original orange set, mic and the COLORS
shot list including the wide shots. Both wear matching cream suits (themed
wardrobe), the pair looks rendered together in one pass (shared lighting, no
seam), and the natural gap sits between the two performers.

| R3 | RunPod RTX 4090 secure ($0.74/h), SSH-driven (`runpod_ssh_test.sh`, keeps `/start.sh`) | nothing | ~70 min | ~0.85 | **no render, but the method works** | SSH and live logs worked (the R1/R2 bug is fixed). This host downloaded at ~8 MB/s, so ~35 GB of setup (venv + models) never finished before the safety delete. **Cold start dominates renting:** pre-load the models on a network volume (~$3.50/mo) or pick a fast host before paying for GPU time |
| R1/R2 | RunPod self-host (A100 community, then H100 secure) via `scripts/video-spike/runpod_run.sh` | nothing | 25 + 21 min | ~1.47 | **no: never rendered** | community pod never started its container; the secure pod ran but sat at 0% CPU, so the start-command bootstrap most likely never executed (REST `dockerStartCmd` apparently ignored). Both pods were deleted. Next attempt: a RunPod ComfyUI template or an SSH-driven setup, with logs visible |

How the trend apps do it (2026-09-28): a strong image of the people in the
scene, plus **Kling Motion Control** (image + trend clip, audio kept) at
$0.07–0.17/s, templated per trend, then upscaled and converted to 24–30 fps.
COGS is ~$0.50–1 per clip against $5–10/week subscriptions.

**Hybrid (2026-09-28):** his start image from an O1 frame plus Kling Motion
Control for both (Bilal: "the main performer… looks actually pretty good, the
syncing is actually pretty good"). Stitching fixes in `composite_scaled.py`:
(1) scale and height from **YuNet face detection**, not silhouettes. The
silhouette method mis-read heads at 1080p and scaled her UP 1.2–1.6×.
(2) `main_blob`: keep the largest matte blob, which drops stray fists from the
start image. (3) `--left-shift/--space` for a real gap on the widescreen
canvas. (4) FLUX can invent a second mic in a plate: paste the original mic
back (`paste_mic.py` pattern: low-saturation pixels from the source frame).

**Bake-off #1 (2026-09-29, `bakeoff.py`, same 5 s single-person test; the
Kling v3 Pro row reuses the earlier render):**

| Model | $/s | Likeness (SFace cos ↑) | Timing (head-track r ↑) | Mouth match ↑ | Render | Output |
|---|---|---|---|---|---|---|
| kling-v3-pro (face lock) | 0.168 | 0.441 | 0.927 | 0.586 | ~5 min | 1088×1904 @ 30 |
| **kling-v2.6-std** | **0.07** | **0.489** | 0.930 | 0.631 | 3.4 min | 720×1248 @ 30 |
| dreamactor-v2 | 0.05 | 0.434 | −0.317 | 0.254 | 6.8 min | 694×1198 @ 25 |
| wan-animate-move-720 | 0.08 | 0.382 | **0.979** | 0.713 | 14 min | 720×1248 @ 25 |
| wan-motion | 0.06 | 0.358 | 0.673 | **0.731** | 14 min | 720×1248 @ 25 |

Read: the cheap Kling tier matches v3 Pro on both proxies at 42% of the price
(it answers the PRD margin question, pending Bilal's eye). DreamActor tracks
against the performer; the Wan models time well but lose likeness.
Bilal's eye picked **wan-motion** for lip detail. The mouth metric added
afterwards agrees: it ranks wan-motion first.

**Mouth match** (added 2026-09-29) is MediaPipe FaceLandmarker inner-lip gap
(landmarks 13/14 ÷ face height) at 12 fps. It is the best Pearson r against the
driving performer's own mouth, within ±0.25 s of lag. The harness also logs
mouth vs song loudness, but it stays low for every model (0.08–0.29) because
rap lip shapes track the song's loudness poorly. Use mouth match.
Gotcha: MediaPipe 1.0.1 aborts on macOS ("graph_service … Service is
unavailable"); pin `mediapipe<1` (0.10.35 works).

**Bake-off #2 (2026-09-29, her, 5 s, $1.68; Kling v3 row = first 5 s of
`t20/kling-her-20s.mp4`, same driver):**

| Model | $/s | Likeness ↑ | Timing ↑ | Mouth match ↑ | Render |
|---|---|---|---|---|---|
| **kling-v3-pro (face lock)** | 0.168 | **0.626** | **0.981** | 0.665 | ~5 min |
| kling-v2.6-std | 0.07 | 0.396 | 0.974 | 0.607 | 4.5 min |
| dreamactor-v2 | 0.05 | 0.504 | 0.622 | 0.364 | 2.2 min |
| wan-animate-move-720 | 0.08 | 0.445 | 0.746 | 0.423 | 13 min |
| wan-motion | 0.06 | 0.394 | 0.666 | 0.484 | 6 min |
| **wan-motion-id** (enhance_identity) | 0.06 +$0.08 | 0.454 | 0.638 | **0.803** | 7 min |

Read: on her (the harder likeness), Kling's face lock matters. v3 Pro is far
ahead on likeness, and v2.6 Std (no face lock) drops to 0.40; the cheap tier
held up on him, not on her. `enhance_identity` is worth its $0.08: Wan Motion
likeness went 0.39 → 0.45 and mouth match 0.48 → 0.80 (best of all). The
driver's own mouth-vs-song r is 0.30, which confirms that metric's low ceiling.
Re-run (from `~/Movies/video-spike`):
`bash <repo>/scripts/video-spike/fal_env.sh <repo>/scripts/video-spike/bakeoff.py --image fal/her-start-v3.png --video t20/bake-drive-her-5s.mp4 --face-front fal/el/her-front.jpg --face-ref fal/el/her-b.jpg --face-ref fal/el/her-mountain.jpg --prompt "<older, modest dress, gold bling, glasses, subtle expression, slow sway>" --out bakeoff-2`
**Recipe B** (the O1 clip + Sync Labs lipsync-2-pro, ~$0.70, 109 s) was posted
as a before/after for Bilal to judge.

**Cheaper motion-transfer candidates** (image + driving video, 2026-09-28,
fal.ai unless noted; not yet tested; Kling is the only one with a face-lock slot):

| Endpoint | $/s | Notes |
|---|---|---|
| `fal-ai/bytedance/dreamactor/v2` | 0.05 | motion, expressions and lip movement; ≤30 s driving clip |
| Runway Act-Two (Runway API) | 0.05 | extra vendor; limits unverified |
| `fal-ai/kling-video/v2.6/standard/motion-control` | 0.07 | same API as v3 Pro, has `elements` |
| `fal-ai/wan/v2.2-14b/animate/move` | 0.04–0.08 | 480p/580p/720p |
| `fal-ai/wan-motion` | 0.06 | +$0.08 with `enhance_identity` |
| `bytedance/seedance-2.5/reference-to-video` | 0.13–0.28 | multimodal refs; may re-synthesize audio |
| `minimax/h3/reference-to-video` | 0.05–0.16 | enterprise-gated |

A 5 s single-person bake-off of the first four costs ~$1.20.

**Hugging Face Spaces test (2026-09-28): not usable anonymously.** The only
Space found running the official Wan Animate 2 weights
(`brnawy2/Wan_Animate_2_motion_transfer_V2V`, ZeroGPU, loads
`Comfy-Org/Wan-Animate-2`) always requests 225 s of GPU. That is over the
anonymous ZeroGPU cap even for a 1.5 s 360p clip, and its upload endpoint
returned 502s. The popular `alexnasa/Wan2.2-Animate-ZEROGPU` runs Animate 1.
Next path, if wanted: a logged-in HF Pro account ($9/month) or the same
weights on the rented GPU. Test subjects were public-domain official
portraits of two public figures, a private parody test, never published.

Film grade (Bilal: keep it on):

```
ffmpeg -i IN.mp4 -vf "eq=contrast=1.06:saturation=0.9:gamma=0.97,colorbalance=rs=0.05:gs=0.01:bs=-0.05:rm=0.03:bm=-0.03,curves=preset=medium_contrast,noise=alls=7:allf=t,vignette=PI/5" -c:v libx264 -crf 17 -preset slow -c:a copy OUT.mp4
```

**Rule: preview before any long render.** Any new size, step count or
framing gets a 17-frame preview (~5–10 min) before the full 49-frame run
(~30–50 min per pass). The W4 black output cost 1.5 hours that a preview
would have caught in 5 minutes.

Wan Animate on the M3 Pro, gotchas: SAM2 must run `fp32` on MPS (fp16 needs
CUDA autocast); ONNX pose runs on CPU; the pose node takes the top detection
per frame, so for two-person clips feed it a copy with the other person
blacked out (`--pose-video`). Script: `scripts/video-spike/wan_animate_replace.py`.
~10 min of M3 Pro time per second of 480p video.

**Bilal's verdict on V2 (2026-09-27):** visuals and audio "pretty decent";
the failure is instruction-following: the faces don't match the references and
the song was invented. Root causes: the song was never given to the model
(LTX makes its own audio from the prompt), and identity drifted twice
(keyframe re-draw, then video drift).

**Lesson: the trend is character replacement, not generation.** Trend apps
keep the real footage (motion, lighting, song) and replace the whole person.
Face swap is too narrow (face only); text/image-to-video invents too much.
The tool that matches is Wan 2.2 Animate "Replace" (open weights, 14B; fal.ai
hosted $0.06/s at 720p ≈ $1.20 for 10 s with two passes).

**Free-tier verdict so far:** ~83 s of M3 Pro time per second of video at
480p, $0. Keyframe-first (image-to-video) is the path that works; the quality
ceiling is "fun share", not "realistic". Both renders logged Metal
out-of-memory warnings at 36 GB even after a reboot (preflight skipped), and
the blur may partly come from that.

Local runtime findings (M3 Pro, 36 GB):
- `mlx-serve pull` fetches only top-level files. Nested repos (FLUX
  diffusers layout, the LTX pack's `gemma4-12b-ltx-v1/` text encoder) arrive
  incomplete and fail with `FileNotFound`. Use
  `scripts/video-spike/hf_fetch.py <repo>` to fill the gaps, then restart the
  server (it indexes models at startup).
- LTX-2.5 4-bit needs **25.6 GB resident, ~29.7 GB free to load**. The server
  auto-caps at 80% of the GPU wired limit (22.5 GB here): pass
  `--max-resident-mem 27GB` (a unit is required; a bare `27` parses as 0).
  With everyday apps open (Chrome 6.7 GB, 9.8 GB already compressed) only
  ~9 GB is free, so a 36 GB Mac must run LTX with most apps closed. A 48 GB+
  Mac or a rented GPU removes this constraint.
- What worked: reboot, keep only light apps open (~20 GB reported free), then
  `mlx-serve serve --host 127.0.0.1 --max-resident-mem 27GB --skip-mem-preflight`.
  The preflight counts file cache as used; the load succeeded anyway.
  Changing display resolution does not help meaningfully (framebuffers are a
  few hundred MB).

## 6. Market and economics (2026-09-27)

| Segment | Who | Signal |
|---|---|---|
| Model labs | Runway ($5.3B val), Luma ($4B), Kling (Q2'26 rev ~RMB 850M, +200% YoY), MiniMax (HK IPO Jan'26), Google, OpenAI | API is the product; price war |
| Avatar / enterprise | Synthesia (~$150M ARR, $4B), HeyGen ($205M ARR on $74.6M raised), Hedra, Tavus | Capital-efficient SaaS works here |
| Consumer / wrapper | Higgsfield ($5.4B, $700M "annualised" — self-reported), PixVerse (150M users, ~$40M ARR), InVideo (~$70M ARR), CapCut (free Seedance inside 300M+ MAU) | Crowded; free alternatives from platforms |
| UGC ads | Arcads ($15M ARR, $25M raised), Creatify ($9M ARR), MakeUGC (bootstrapped) | B2B buyer with ROI; most solo-shaped |

Unit economics, worked (estimates, not reported P&Ls):
- **$6.99/week consumer app, 30 clips × 5 s on Kling at $0.112/s:** COGS
  $16.80/week if fully used, against $4.89 net after Apple's 30% cut.
  Profitable only on unused credits, cheap-model routing and trial churn.
  Trial burn: at 25% trial→paid, payers fund the other 75%'s generations.
- **Arcads-style UGC ad, $11/video:** ~35 s at $0.10/s + ~$2 voice ≈ $5.50
  COGS → ~50% gross margin, ~30–40% after re-rolls.
- **Model owners:** true compute cost per second is undisclosed everywhere;
  rumoured $0.01–0.03/s for turbo models.

Mobile: hard paywalls convert ~5x freemium by day 35 (RevenueCat 2026: 10.7%
vs 2.1%). Captions made ~$9 of IAP revenue per download (Appfigures). Weekly
subs ($4.99–6.99) are the norm. No credible AI-video-specific CAC/LTV found.

Compliance: App Store 5.1.2(i) requires disclosure and consent before sending
personal data (a user's photo) to third-party AI. EU AI Act Article 50
labelling applies from 2026-08-02. C2PA is the working standard (TikTok,
YouTube, Meta read it; X strips it).

Risks: the model layer is a commodity; platforms ship the feature free (Sora
app: ~7 months launch to shutdown; CapCut bundles Seedance); IP and likeness
enforcement is active (Disney vs Google); moderation cost is real for
real-person content.

Solo-builder shape: a narrow B2B vertical tool (real-estate listing video,
restaurant/menu video, local-business ads, e-commerce product video), priced
$49–199/mo as SaaS, where the moat is the integration and distribution.
Expect a profitable niche, not venture scale.

### Pause 2026-09-29: gap to the polished reels

Bilal, after the Scarface and Godfather reels by the zeis.ai account: both
performers sync, the cinematography is polished and seamless, expressions are
subtle. Ours is "halfway there": he is decent, she is out of sync, too zoomed
out, or "not quite there".

Diagnosis:
- **Stitching two solo renders is the root cause.** Kling MC takes one person
  per call, so she comes from a separate render, and her timing drifts against
  him. The height-true scaler shrinks her, which reads as "zoomed out".
- **The reels swap people in place, per shot, in one pass.** Their pairs match
  the originals' build, so nothing needs rescaling. Both bodies stay driven by
  the source shot, so sync and camera come for free. Consumer apps (Summrs,
  LightX) run the same flow: 2 photos → both staged in one frame → animated.
- **Subtle expressions:** our prompts ask for singing and mouthing, which
  exaggerates. The references look driven by the source faces at low strength.

- **The mic is the anchor** (Bilal's catch). In the Scarface reel the mic
  hangs centred at the top, the lead's mouth sits right under it, and the
  second performer's gestures cross the centre towards it. The frame is 4:3
  and tight around the mic, with both bodies cropped at the thigh. Ours: the
  mic floats in empty space above-right of his mouth; the widescreen canvas
  plus our `--space`/`--left-shift` spread them apart, so her reach points at
  nothing. Fix (free, re-stitch only): position both from their original
  offsets to the mic (his mouth under it) and crop 4:3 around the mic.
  Note: this reverses the earlier "widescreen + space helps" feedback.

**Direction (Bilal, 2026-09-29):** the avatar problem (a person from photos)
is mostly solved; every model run was "pretty decent". The remaining work is
making a good hip-hop video: a faithful remake of the original Migos COLORS
video, nothing outside the box. Keep the original shot list, the wide shot
where it falls in the song, both on one stage, and the mic as the anchor.
Resumed the same day with the free mic-centred re-stitch (`--mic-center`) and
her last 2 shots rendered one Kling call per shot (~$1.10).

**How the apps do it (Starrd's published recipe, 2026-09-29):** one image
model still with BOTH people in the booth (full body, clear gap, no overlap),
then **Seedance 2.0** with that still as the image reference plus the booth clip
as the video reference, rendering both people in one pass. It's one continuous
shot, 15 s, 9:16, rendered silent with the real song laid on top; ~$5 in
credits per video. Their stated reason: "motion-control tools are built to
puppeteer one subject". That is exactly our Kling MC wall. Seedance
reference-to-video is on fal (`bytedance/seedance-2.5/reference-to-video`,
$0.13–0.28/s) and was listed in our candidates but never tested.
**Tested 2026-09-29: blocked.** fal/ByteDance partner validation rejects real
people's photos: `content_policy_violation`, "may contain likenesses of real
people or other private information that cannot be processed"
(`partner_validation_failed`). The request was rejected at submission, before
rendering. This is a policy on real faces, not a bug; don't route around it.
Kling (O1 edit, v3 MC) accepts these photos. Apps selling this template must
use another model or a consent/verification flow with ByteDance; unverified.

**Overnight 37 s build (2026-09-29, `overnight37.py`, COLORS 0:15–0:52,
9 shots, $12.72 incl. one retry; total spend ≈ $42.60 of the $45 cap):**
- **O1 one pass per shot: failed as a product.** It swapped both people
  correctly in only 3 of 9 shots. The rest kept Quavo on the right, or
  re-dressed the man in a blue shirt. The O1 wide-shot test that worked was
  luck. The same prompt on the same shot failed overnight.
- **Stitched (Kling MC ×2 per shot, mic-centred 4:3): consistent** in all 7
  medium shots. Its wide shots came from O1 and were bad, so they were
  replaced by the verified O1 wide test (shot 4) and one O1 retry (shot 6,
  $0.73). The retry used a stronger prompt: "dressed exactly as in @Image1/2",
  plus the two start photos as extra refs, and it worked. She reads about as
  tall as him in that wide shot.
- Final: `~/Movies/video-spike/t37/mc-37-v2-film.mp4` (posted). Rejects:
  `o1-37-film.mp4`, `mc-37-film.mp4`.
- Lessons: verify identity per shot before splicing (a face check is too
  noisy on wide shots; review contact sheets). O1 needs outfit anchoring via
  start photos. Kling MC stops at camera cuts: one call per shot. O1 returns
  3–9% short: stretch each shot back to its length to stay on the song.

**Bilal on v2 (2026-09-29):** "very entertaining… decent but still needs
work": the performers aren't in sync with each other, they don't feel next to
each other, and she's way too big. Measured:
- Timing is fine: each render lags its driver by 1–3 frames, both the same way.
- Size: her face was 0.87–1.0 of his and she was drawn in front of him.

**v3** (free re-stitch, `--head-ratio 0.82 --right-behind`,
`t37/mc-37-v3-film.mp4`, posted). The remaining "not together" is interaction:
separate renders face the camera instead of each other, and a fix needs paid
re-renders.

**Decision (Bilal, 2026-09-29, on v3):** "overall this is pretty bad…
the actors are doing a good job individually… the entire video looks glitchy
and not synced… I want to reproduce what others have done." **The per-person
stitching route is retired.** The goal is now app-quality one-pass
two-person generation (the Starrd recipe: one two-person still + a video
reference), using models that accept real faces.

### Retrospective 2026-09-29: what we did wrong (no more paid experiments until a path is chosen)

1. **Wrong tool class.** Kling Motion Control, Wan Animate and Runway
   Act-Two are single-subject by design. Kling's guide: only "the person with
   the largest on-screen presence" is used, even if the start frame has two
   people. We then tried to fix a two-person job in compositing, which is the
   source of the glitches and bad sync.
2. **Copied the original's edit, not the trend.** Nine camera cuts forced
   per-shot calls, plates and truncation.
3. **Bottom-up.** Local models, RunPod, HF and bake-offs came before copying a
   known-working recipe or buying one app result as the benchmark.
4. **Over-optimised details** (face lock, exact height, mic anchor) while the
   core was broken.

**How it's actually done** (research with sources, 2026-09-29):
- **Route A, Higgsfield Genjutsu Motion Transfer.** Upload the original clip
  (4–30 s) plus a character sheet per person (front portrait, full body front
  and back, face close-up). Tag each image and assign sides in the prompt
  ("replace the performer who begins on the left with @A… keep the assignment
  through every cut"). Both people are swapped in one pass; cuts and audio are
  kept. API ~$0.32/s at 480p, ~$0.68/s at 720p; the model is not disclosed.
  Real-face policy: unverified.
- **Route B, Seedance 2.x with a two-person still + booth clip** (Starrd,
  Dreamina). For real people the legitimate route is ByteDance real-person
  verification: each person passes a liveness check themselves (ComfyUI
  "Seedance 2.0 Real Human" nodes; BytePlus ModelArk for vetted clients; fal
  by sales approval). Relying on a generated still to get past the face
  check is off-limits.
- Pitfalls creators report: side-swaps (label left/right in uploads AND the
  prompt), face blending on head turns, outfit drift across joined parts.

Sources: kling.ai/quickstart/motion-control-user-guide,
higgsfield.ai/blog/higgsfield-genjutsu,
videoaihub.substack.com/p/how-to-make-the-viral-hotel-lobby,
kavel.ai/blog/hotel-lobby-ai-trend,
docs.comfy.org/tutorials/partner-nodes/bytedance/seedance-2-0-real-human,
getstarrd.app/blog/how-to-make-hotel-lobby-colors-ai-video.

**Higgsfield Genjutsu test (2026-09-30, $3.18, `higgs_genjutsu.py`):** 10 s
of the original (COLORS 0:15–0:25, 3 cuts) + one reference sheet per person
(face, full body front, full body back, second face; back views made with
local FLUX). Result at 480p in 437 s: **both swapped in one pass, consistent
through every cut, original camera, set, mic and timing kept**. First output
that looks like the apps'. Notes: output 9.7 s for 10 s in; she got dark
sunglasses from the original performer instead of her clear glasses; his
outfit held. Max input 30 s, so the 37 s needs two calls split at a cut
(creators feed a still from part 1 into part 2 to stop outfit drift).
Full 37 s: ~$11.80 at 480p, ~$25.20 at 720p.

**Overnight #2 (2026-09-30, same 15 s = COLORS 0:15–0:30, three two-person
one-pass models, $13.47, 20 min total; all three posted to Discord):**

| Model | Input | Output | Cost | Time | Contact-sheet check |
|---|---|---|---|---|---|
| Higgsfield Genjutsu 720p | original clip + 2 reference sheets | 1280×720 | $10.21 | 7.3 min | both consistent in all 10 frames |
| DreamActor M2 (`fal-ai/bytedance/dreamactor/v2`) | one FLUX booth still of both + original clip | 1214×694 | $0.75 | 5 min | both consistent; background = the still's |
| Kling O1 edit, outfit-anchored (2 calls at the 7.36 s cut) | original clip + elements + start photos | 1920×1080 | $2.51 | 7 min | both consistent; anchoring holds (3/3 now) |

Read: once the job is framed as "both people in one pass", three different
models deliver a coherent pair through the cuts. DreamActor at $0.05/s is the
cost story (a 37 s video ≈ $1.85) if its faces and lip sync hold up to
Bilal's eye; Genjutsu is the safe premium; O1 is the 1080p option but needs
the outfit anchoring and ≤10 s calls. **Bilal's verdict (2026-09-30):** Higgsfield Genjutsu is the best. The two
things that matter are the sync of both performers together and each
person's lip sync, and "this model does both really well". All three are an
improvement over the stitched route.

**Full 37 s on Higgsfield (2026-09-30):**
- First attempt (2 calls, 21.3 + 15.7 s, height-reference image, continuity
  frame): part A clean and the height difference held; part B drifted, her
  badly (the original performer's dreads), him a little. Bilal: glitchy from
  the start, redo.
- Redo through `trend_video.py` (3 calls ≤15 s, no height image, no
  continuity frame): parts 1–2 clean. **Part 3 (25.6–37 s) rejected by
  Higgsfield moderation three times (`nsfw`, no reason)**, with two prompt
  wordings; the same footage passed yesterday from a 21.3 s boundary. Black
  box; the vendor-lock argument in miniature.
- Finish: last 11.4 s on Kling O1 outfit-anchored (~$2). Bilal: O1 is
  actually better for her. The Mac dropped network twice mid-run, which is
  why the pipeline now lives on `omarchy` (`docs/machines.md`).
- Learned: 15 s calls stay clean, 21 s drift; the generated height image and
  continuity frame did not help; hosted moderation can refuse harmless
  footage without appeal.

Next test when resumed (not started; needs a budget): per camera shot,
(1) edit the shot's first frame to put both of them in the performers' places
(FLUX edit), then (2) run a two-person, one-pass video-to-video model on that
shot (Kling O1 edit was closest: best faces), with neutral prompts, then
(3) cut the shots together on the original audio. Trade-off: exact height
truth has to be set in the first frame; no compositing afterwards.
**Per-shot fix (2026-09-30 evening, $1.18):** frame review of the assembled
37 s showed Higgsfield drifting inside two medium shots (7.36–11.20 s her,
18.44–21.32 s him: the original performers' dreads come back when a head
drops or turns). Both shots redone on Kling O1 outfit-anchored with the
tail's prompt and refs (`o1finish.sh` → `o1fix.sh`); both held. O1 keeps the
COLORS logo the source carries, Higgsfield does not: `delogo` on the O1
ranges. Final `higgs/hotel-lobby-37-v4.mp4`. Camera cuts (scene 0.15): 4.04,
7.36, 11.20, 14.92, 18.44, 21.32, 25.64, 30.12. Rule of thumb: Higgsfield for
the pair through cuts, O1 per shot where a face turns away.

**Single-model per-shot run (2026-09-30 night, $3.64): FAILED.** All six shots
of a 21 s cut on Kling O1 anchored, each with a FLUX-edited first frame as
the @Image reference. Consistency across shots was perfect, but Bilal's
verdict: "they look like different people", graphics worse, lip sync gone.
Cause: the FLUX anchor still carries FLUX's invented faces, and O1 copied the
still over the real reference crops; O1 also does not hold lip movement the
way Higgsfield does. Lesson: never hand a generated still of the people to
the video model as a reference; the only likeness inputs are real photos.
Consistency and sync still live in different models. Best output for this
template remains the hybrid `higgs/hotel-lobby-37-v4.mp4` (and its 21.3 s
trim `hotel-lobby-21-from-v4.mp4`). Stopped here on the hold.

Open: a free 15 s stitch (`runs/23-hybrid-15s-film.mp4`, auto-posts to Discord); her last
5.1 s (2 shots, ~$0.85) is not rendered. Spend ≈ $28.20 of $30.

## 7. Open questions

1. Measured M3 Pro render time and quality for LTX-2.5 at 480p and 720p.
2. Does LTX audio-to-video lip-sync hold up on two performers in one frame?
3. Does the MiniMax-H3 MLX pack exist as open weights, under what licence,
   and does it fit 36 GB?
4. Paid round: the same brief on Kling 3.0 vs Veo 3.1 Fast. Is the quality
   gap worth the $/s?
5. Which vertical, if any, is worth a `Spike:` of its own?

## 8. Verdict

**Tech: GO.** Kling v3 Pro Motion Control with face lock, plus our
shared-frame composite, gives a realistic, lip-synced two-person trend clip at
~$0.34 per second of two-person video. Free local (Wan Animate on the M3) proves
the method but is too slow and low-res to sell. Hosted Wan on fal.ai lacked the
control inputs.

**Business: WAIT → GO on trigger**, as personalized family trend videos sold
per video: `docs/family-video-prd.md`. GO = 10 paid orders within 14 days of
a landing page. **NO-GO** on a generic consumer generator app regardless.

## Sources

Research notes (full tables and ~90 links) were compiled 2026-09-27 from
primary pages where available: ai.google.dev/gemini-api/docs/pricing,
docs.dev.runwayml.com/guides/pricing, lumalabs.ai/api,
developers.openai.com/api/docs/deprecations,
artificialanalysis.ai/video/leaderboard, huggingface.co (Wan-AI, Lightricks,
ddalcu, mlx-community model cards and file listings),
github.com/ddalcu/mlx-serve. Market: TechCrunch (Runway 2026-02-10, Higgsfield
2026-08-17, PixVerse 2026-07-13, Mirage 2026-03-24), CNBC (Synthesia
2026-01-26), HeyGen blog ($200M ARR), SCMP (Kling), Variety (Sora shutdown),
Sensor Tower State of Mobile 2026, RevenueCat State of Subscription Apps 2026,
artificialintelligenceact.eu (Article 50). Trend: XXL, The Tab (2026-09-25),
103.1 WEUP (2026-09-24).
