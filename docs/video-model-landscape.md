# AI video model landscape — putting a real person into a trend clip

Research snapshot, not a build doc. Prices/access change fast in this space — every
number below is date-stamped; anything not confirmed against a primary source is
marked **unverified**. Compiled 2026-09-28.

## 1. The pipeline stages

| Stage | What it does |
|---|---|
| **Identity / likeness** | Capture clean reference photo(s) or a short clip of the real person — the anchor every later stage is checked against. |
| **Keyframe / image** | Generate or edit a still "hero shot" that places that identity into the target outfit/scene/lighting. |
| **Performance (motion + lip sync)** | Animate the keyframe using a driving video's motion and/or audio-driven mouth movement — the hardest, most model-dependent stage. |
| **Scene / composite** | Matte the animated subject and place it into the final background/other elements. |
| **Finishing** | Upscale, frame-interpolate, and color-grade to broadcast/social quality. |
| **Audio** | Cloned voice and/or licensed music/SFX under the final cut. |

## 2. Model categories

### Text-to-video

| Model | Maker | Open/closed | Access | $/sec (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Veo 3.1 (Fast) | Google DeepMind | Closed | fal `fal-ai/veo3.1/fast`; Gemini API | $0.10/s (no audio) – $0.15/s (audio), $0.30–0.35/s at 4K (2026-09-28) | Prompt adherence, native audio | Pricier at high res |
| Kling 3 Pro | Kuaishou | Closed | fal `fal-ai/kling-video/v3/pro/text-to-video` | $0.112–0.196/s depending on audio/voice control (2026-09-28) | Cinematic motion, multi-shot, native audio | Cost adds up on longer clips |
| Seedance 2.5 | ByteDance | Closed | fal `bytedance/seedance-2.5/*` | Not confirmed — **unverified** | Strong subject/scene consistency (vendor claim) | Pricing unconfirmed |
| MiniMax H3 (Max) | MiniMax (Hailuo) | Closed | fal `minimax/h3-max/text-to-video` | Not confirmed on fal page — **unverified** | Vendor claims strong prompt adherence | Per-generation (not per-second) pricing model |
| Runway Gen-4.5 | Runway | Closed | Runway API (credit-based) | ≈$0.10–0.20/s effective (secondary sources, **unverified** exact rate) | Director-style control | No native end-frame input; opaque credit pricing |
| Luma Ray3 (3.2) | Luma AI | Closed | Luma API / Dream Machine | ~$1.20 for 5s 1080p SDR; 2–3x for HDR/EXR (**unverified** exact rate) | Up to 16 keyframes/clip, HDR/EXR output | Cost scales fast with HDR tiers |
| Wan 3.0 | Alibaba | **Closed** (contrary to Wan's open-source reputation from 2.x) | fal `alibaba/wan-3.0/text-to-video`; DashScope | Not confirmed — **unverified** | Up to 30s video; multimodal input (text/image/audio/video/docs) | No self-host despite "Wan" branding; no 4K tier |
| LTX-2.5 | Lightricks | **Open weights** (Community License; paid tier required if org revenue ≥$10M/yr) | fal `fal-ai/ltx-2.5`; HF `Lightricks/LTX-2.5`; self-host | Fast tier $0.09–0.30/s, Pro tier $0.12–0.17/s (2026-09-28) | Genuinely open + downloadable, multi-shot continuity, fast inference | Revenue-gated commercial license |
| Gemini Omni Flash | Google DeepMind | Closed | Gemini API, AI Studio, Flow | Not confirmed — **unverified** | Conversational/iterative editing, scene extension to 40s | New (launched 2026-06-30), less battle-tested |
| Sora 2 / Sora 2 Pro | OpenAI | Closed — **discontinued** | None — app/web shut down 2026-04-26, API access ended 2026-09-24 | N/A | Historically strong physics/realism | **Not accessible via any channel today — exclude from active plans** |

### Image-to-video / first-last-frame

| Model | Maker | Open/closed | Access | $/sec (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Kling 3.0 (Omni, image-to-video) | Kuaishou | Closed | fal `fal-ai/kling-video/v3/.../image-to-video` | Same tiers as text-to-video above | First+last frame control, subject-consistency "Omni" mode, pairs with Motion Control | Likeness still degrades on long, complex clips |
| Luma Ray3.2 | Luma AI | Closed | Luma API, up to 16 keyframes/clip | Same tiers as text-to-video | Most flexible keyframe count in category | Cost scales with HDR/EXR |
| Runway Gen-4.5 | Runway | Closed | Runway API/app | Same credit rate as text-to-video | Strong stylistic control from one reference image | First-frame only — **no native end-frame input** |
| Seedance 2.5 (image-to-video) | ByteDance | Closed | fal `bytedance/seedance-2.5/image-to-video` | Not confirmed — **unverified** | Vendor-claimed scene/subject fidelity from reference | Pricing unconfirmed |
| Wan 3.0 (image-to-video) | Alibaba | Closed | fal / DashScope | Not confirmed — **unverified** | Accepts image+audio+video combined input | Closed, no self-host |
| LTX-2.5 (image-to-video) | Lightricks | Open weights | fal `fal-ai/ltx-2.5`; self-host | Same tiers as text-to-video | Only genuinely open/self-hostable option here | Revenue-gated commercial license |
| Veo 3.1 (image-to-video) | Google DeepMind | Closed | fal `fal-ai/veo3.1/fast` | Same tiers as text-to-video | Adherence to seed image + prompt, native audio | 4K tier notably pricier |

### Motion transfer / character animation from a driving video

*(the core stage for "put this real photo into that dance/performance clip's motion")*

| Model | Maker | Open/closed | Access | $/sec (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Kling Motion Control v2.6 Standard | Kuaishou | Closed | fal `fal-ai/kling-video/v2.6/standard/motion-control` | $0.07/s (2026-09-28) | Cheap, good for portraits/simple animation | Struggles on complex full-body/multi-person scenes (inferred) |
| Kling Motion Control v3 Pro | Kuaishou | Closed | fal `fal-ai/kling-video/v3/pro/motion-control` | $0.168/s (2026-09-28, confirmed on fal model page) | Reference implementation most builders cite for likeness+motion transfer | ~2x cost of v2.6 |
| Runway Act-Two | Runway | Closed | Runway API (`act_two`) | 5 credits/s (credit-based, USD conversion **unverified**) | Full-body: head/face/torso/hands from one driving video | Minimum 3s billing unit; opaque credit pricing |
| ByteDance DreamActor V2 | ByteDance | Closed | fal `fal-ai/bytedance/dreamactor/v2`; WaveSpeedAI, eachlabs | Not confirmed — **unverified** | Only model here with proven non-human/multi-character support; pixel-based motion learning is robust to noisy driving video | Capped at 720p and ~15s clips; degrades on extreme/fast motion |
| Wan 2.2 Animate — Move mode | Alibaba | **Open weights** (Apache-2.0) | fal `fal-ai/wan/v2.2-14b/animate/move`; Replicate `wan-video/wan-2.2-animate-animation`; HF `Wan-AI/Wan2.2-Animate-14B`; self-host | fal ~$0.04–0.08/s (2026-09-28, fps-normalized so real cost varies) | Free to self-host; strong expression/movement replication; only open-weights option with real production traction | Behind Kling/DreamActor on likeness polish; self-host needs A100/H100-class GPU |
| Viggle AI | Viggle | Closed (proprietary 3D model) | viggle.ai app; API | $0.01/generated second (2026-09-28) | Cheapest $/s; outputs Mixamo-compatible 3D rig | Not photoreal video-to-video — weaker likeness fidelity, best for stylized/game-asset use |
| MimicMotion (Tencent) | Tencent | Open weights | GitHub/HF `Tencent/MimicMotion`; self-host only | Free (self-host); GPU cost only | Confidence-aware pose guidance, chainable long-video | 576×1024 ceiling; older SVD backbone, visibly behind 2026 closed models |
| UniAnimate | Academic/open | Open weights | HF Space; self-host | Free (self-host) | Cited pose-guided baseline | Research-grade, not actively maintained as a product — **unverified** maintenance status |

### Video-to-video editing / character replacement

*(swap the person in existing footage while keeping scene + motion)*

| Model | Maker | Open/closed | Access | $/sec (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Kling O1 Edit | Kuaishou | Closed | fal `fal-ai/kling-video/o1/video-to-video/edit`; WaveSpeedAI | $0.168/s (2026-09-28, confirmed on fal model page) | Purpose-built character replacement + style transform preserving motion/camera/spatial relationships; pairs with Kling "Elements" | Vendor language suggests cost can vary with "computational complexity" |
| Runway Aleph | Runway | Closed | Runway API/app | Not confirmed — **unverified** | In-video editing after generation, good for iterative fixes | Same opaque credit pricing as rest of Runway |
| Luma Modify | Luma AI | Closed | Luma API | Priced per clip length tier, not confirmed — **unverified** | Re-renders footage holding motion/framing/performance | Clip-based pricing harder to compare to $/s models |
| Wan 2.2 Animate — Replace mode | Alibaba | **Open weights** (Apache-2.0) | fal `fal-ai/wan/v2.2-14b/animate/replace`; Replicate; HF; self-host | ~$0.04–0.08/s (2026-09-28) | Only open-weights character-replacement model with real adoption; preserves scene lighting/tone | Seam quality reportedly behind Kling O1 (anecdotal, unverified) |

### Reference-to-video / multi-subject consistency

| Model | Maker | Open/closed | Access | $/sec (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Seedance 2.x Reference-to-Video | ByteDance | Closed | fal `bytedance/seedance-2.0(or 2.5)/reference-to-video` | 720p $0.303/s, 1080p $0.682/s, + $0.014/1000 tokens (2026-09-28) | Up to 9 images + 3 video + 3 audio clips per request — holds character/location/voice steady across a series | Materially pricier than Kling/Wan; token add-on complicates cost prediction |
| Vidu Q3 | Shengshu AI | Closed | platform.vidu.com API | $0.07/s for 12s 1080p clips (2026-09-28) | Up to 7 reference subjects; cheapest capable reference model found | Less community benchmarking than Kling/Seedance |
| MiniMax H3 reference | MiniMax | Closed | MiniMax API, resellers | ~$0.01–0.08/s by resolution (reseller pricing, **unverified** vs. official list) | Cheap at low res | Reseller pricing may not match official rate |
| Kling "Elements" | Kuaishou | Closed | Kling API/fal (bundled with O1 / 3.0 Omni) | Bundled into Kling's per-second/credit pricing (~6–8 credits/s) | Character stays consistent across shots/angles/lighting | Not separately priced — hard to compare apples-to-apples |

### Audio-driven lip sync

| Model | Maker | Open/closed | Access | Price (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Sync Labs lipsync-2-pro | Sync Labs | Closed | fal `fal-ai/sync-lipsync/v2/pro`; sync.so API/Studio | $5/min pro, $3/min standard (fal, 2026-09-28) | Best-in-class mouth realism up to 4K; can re-edit dialogue on existing footage | Face/mouth region only — no body motion added |
| LatentSync | ByteDance (research) | **Open weights** | GitHub `bytedance/LatentSync`; HF | Free; GPU cost only | State-of-the-art open lip-sync quality | Self-host setup overhead |
| MuseTalk | Tencent | **Open weights** (MIT) | GitHub/HF `TMElyralab/MuseTalk` | Free; real-time capable (30fps+ on a V100) | Real-time speed, permissive license | Lower fidelity than Sync/LatentSync on close-ups |
| Hedra Character-3 | Hedra | Closed | Web app + Developer API (credits) | ~$15/$30/$75 monthly credit tiers (2026) | Adds blinks/gaze/micro-expression, not just mouth | Not a drop-lipsync-onto-footage tool — generates from a photo |
| Kling lip-sync | Kuaishou | Closed | Kling app; reseller APIs | Consumer 5 credits/5s clip; reseller ≈$0.084/clip (**unverified** official rate) | Cheap, integrated into an ecosystem already used for gen | Reseller pricing isn't first-party; realism less proven than Sync |
| OmniHuman-1/1.5 | ByteDance | Closed | BytePlus API; Dreamina; resellers | $0.16/s official, ~$0.12/s via resellers (2026-09-28) | Full lip-sync + gesture + expression from one image + audio — more than mouth-only | Fragmented pricing across resellers |
| HeyGen avatar lip-sync | HeyGen | Closed | Web app/API (credits) | ~$0.05/s (~$3/min) API (2026) | Turnkey, well-documented API | Cost scales with avatar tier |

### Face swap (face only)

| Tool | Maker | Open/closed | Access | Price (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| FaceFusion | OSS community | Open source (MIT) | Self-host, GitHub `facefusion/facefusion` | Free; GPU cost only | Most actively maintained OSS swapper, includes enhancers (GFPGAN/CodeFormer) | Local setup required, no hosted API |
| InsightFace / Inswapper-128 | InsightFace | Non-commercial research license (commercial on request) | Self-host (underlies most OSS tools) | Free for research; commercial terms **unverified** | De facto standard swap engine, high accuracy | Commercial license ambiguity — real risk for a shipped app |
| Deep-Live-Cam | Community forks | Open source | Self-host | Free; GPU cost only | Real-time webcam-grade swap | Built for live/streaming, not polished single-clip output |
| Pixverse Swap | Pixverse | Closed | fal `fal-ai/pixverse/swap` | $0.15–0.40/use (fal, 2026-09-28) | Hosted, zero setup | Narrower scope (element swap) |

**Caveat that applies to the whole category:** face swap replaces only the face region on top of existing footage. It does not fix body shape, hands, motion, or voice — combine with a motion/performance stage for a convincing "real person in the trend clip" result.

### Talking avatars

| Model | Maker | Open/closed | Access | Price (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Synthesia | Synthesia | Closed | Web app/API | ~$2.20–2.97/min effective depending on plan (2026) | Polished enterprise product, huge stock-avatar library | Expensive per-minute; stock avatars less suited to real-person likeness |
| HeyGen | HeyGen | Closed | Web app/API | ~$0.05/s (~$3/min) API; credit plans $29–$149/mo | Strong avatar + translation + lip-sync feature set | Credit system obscures true cost |
| Hedra | Hedra | Closed | Web app/API | Credit plans ~$15/$30/$75/mo | Handles stylized + real faces, expressive micro-motion | Credits deplete quickly |
| OmniHuman-1/1.5 | ByteDance | Closed | BytePlus API, Dreamina, resellers | $0.16/s official; ~$0.12/s resellers (2026-09-28) | Highest realism here for gesture+expression from one photo | Fragmented access/pricing |
| Tavus | Tavus | Closed | Developer-first Conversational Video API | Free 25 min; Starter $59/mo (100 min) + $0.37/min overage | Built for real-time conversational avatars | Overkill/pricier for one-off pre-rendered clips |

### Image generation/editing for keyframes

| Model | Maker | Open/closed | Access | Price (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| FLUX.2 [pro] | Black Forest Labs | Closed (Dev variant open) | fal `fal-ai/flux-2-pro` (+ Flash/Turbo tiers) | ~$0.039/image at 1024x1024 (Pro); Turbo/Flash cheaper (2026-09-28) | High fidelity, good prompt adherence | Tier naming (Flash/Turbo/Pro/Dev/Klein) is confusing |
| FLUX.2 Kontext (editing) | Black Forest Labs | Closed (some weights open) | fal (Kontext Pro/Max) | ~$0.04/image (**unverified** exact figure) | Strong instruction-based edit + identity preservation | Not independently confirmed this pass |
| Nano Banana Pro (Gemini 3 Pro Image) | Google | Closed | Gemini API/Vertex AI | $0.134/image 1K–2K, $0.24/image 4K (**unverified**, aggregator source) | Strong likeness/detail per vendor claims | Pricier at 4K; naming churn across versions |
| GPT Image 2 | OpenAI | Closed | OpenAI API | $0.006–$0.211/image by quality tier (2026-09-28) | Flexible quality/cost tiers, good text rendering | High-quality tier expensive at scale |
| Seedream 4.5 | ByteDance | Closed | fal `fal-ai/bytedance/seedream/v4.5/text-to-image` | ~$0.04/image | Unified gen+edit architecture | Marginal gain over 4.0 |
| Qwen-Image-Edit | Alibaba | **Open weights** | fal `fal-ai/qwen-image-edit`; self-host | ~$0.03/MP on fal | Self-hostable, cheap hosted option | Base model may lag closed models on real-person likeness (untested) |

### Finishing (upscale, interpolation, matting)

| Tool | Maker | Open/closed | Access | Price (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| Topaz Video AI | Topaz Labs | Closed, desktop app | Desktop app; Pro tier for batch/API | $59/mo or $299/yr Personal; $699/yr Pro (2026) | Best-known quality bar, works offline | Subscription-only now; not a lightweight per-call API |
| SeedVR2 | ByteDance Research | **Open weights** | fal `fal-ai/seedvr/upscale/video`; GitHub | ~$0.001/MP of video (~$0.25 for a 1080p/121-frame clip) | Very cheap, hosted, no subscription | Newer, less benchmarked than Topaz |
| RIFE (frame interpolation) | hzwer / open research | Open weights | fal `fal-ai/rife/video`; GitHub `hzwer/ECCV2022-RIFE` | $0.0013/compute-second (fal) | Fast, widely used for slow-mo/frame-rate boosts | Replicate community port is unmaintained — use fal or self-host |
| FILM (frame interpolation) | Google Research | Open weights | GitHub only, no hosted endpoint found | Self-host (compute cost only) | Strong large-motion interpolation quality | No convenient hosted API — gap vs. RIFE |
| SAM2 | Meta | Open weights | fal `fal-ai/sam2/video`; self-host | Not priced this pass — **unverified** | Strong general tracking+segmentation | Needs a matting head add-on for fine alpha mattes |
| BiRefNet v2 | Open research | Open weights | fal `fal-ai/birefnet/v2/video` | Not priced this pass — **unverified** | High-res dichotomous segmentation, clean matte edges | Video-mode pricing unconfirmed |
| Robust Video Matting (RVM) | Open research | Open weights | GitHub only | Self-host | Lightweight, real-time-capable | No hosted endpoint found; superseded by BiRefNet/SAM2 in convenience |

### Audio: TTS/voice cloning, music

| Tool | Maker | Open/closed | Access | Price (dated) | Strengths | Weaknesses |
|---|---|---|---|---|---|---|
| ElevenLabs | ElevenLabs | Closed | API, elevenlabs.io | ~$0.05–0.10 per 1,000 chars depending on model tier; plans $6–$990/mo; Instant Voice Cloning from Starter tier (2026) | Best-known cloning quality, low latency, instant cloning from a short sample | Cost scales with volume; verified/pro cloning tiers cost more; get consent before cloning a real relative's voice |
| Suno | Suno Inc. | Closed | App/API | No clean per-clip API rate found — consumer subscription model (**unverified**) | Fast, high quality music+lyrics | Sony Music litigation ongoing — check commercial-use terms before shipping |
| Udio | Udio (UMG-partnered) | Closed | App/API | UMG deal reports $0.002–$0.005 royalty per generation (Dec 2025 reporting, **unverified**) | UMG-backed licensed platform in progress | Same litigation risk as Suno; commercial-distribution terms unclear |

## 3. Recipes for "real people in a trend clip"

| Recipe | Steps | Cost / 10s clip (2026-09-28) | Trade-off |
|---|---|---|---|
| **A. Per-person Kling Motion Control + composite** | Keyframe (Nano Banana Pro or FLUX.2 Kontext) → Kling Motion Control v3 Pro on a driving video → manual composite/grade | ~$1.68 (motion) + ~$0.05–0.15 (keyframe) + ~$0.25 (SeedVR2 finishing) ≈ **$2.00–2.10** | Best single-model likeness+motion fidelity; but compositing multiple people onto one background is manual after-effects-style work |
| **B. One-pass Kling O1 edit + Sync Labs lip-sync** | Kling O1 video-to-video edit swaps the person into existing trend footage (keeps scene motion) → Sync Labs lipsync-2-pro pass fixes mouth to a new audio track | $1.68 (O1 edit, $0.168/s) + ~$0.83 (Sync pro, $5/min) ≈ **$2.50** | Fastest route since motion/camera/scene already exist in the source clip; quality hinges entirely on O1's replacement seam, and lip sync only fixes the mouth — O1 must already nail body performance |
| **C. Open-weights Wan 2.2 Animate on a rented GPU** | Self-host `Wan-AI/Wan2.2-Animate-14B` (Move or Replace mode) on a rented A100/H100, or use fal's hosted endpoint | fal hosted: ~$0.40–0.80 (10s @ $0.04–0.08/s); self-hosted: GPU-rental amortized, often <$0.50/clip at scale | Cheapest at volume and fully open weights (auditable, fine-tunable); quality still trails Kling/DreamActor on likeness polish; self-hosting adds DevOps overhead |
| **D. Face swap onto original footage** | FaceFusion (self-host, free) or Pixverse Swap (fal, $0.15–0.40/use) swaps only the face onto the real trend video | ~$0 (self-host) to ~$0.40 (hosted) | Cheapest and simplest, keeps 100% of the original dance/performance timing since it *is* the original footage; but body build, hands, hair, and voice all remain the original performer's — likeness is partial and breaks under scrutiny |

## 4. Top 5 to benchmark next (performance stage)

| # | Model | fal endpoint id | Expected cost, 5s test (2026-09-28) |
|---|---|---|---|
| 1 | Kling Motion Control v3 Pro | `fal-ai/kling-video/v3/pro/motion-control` | $0.168/s × 5 = **$0.84** |
| 2 | Wan 2.2 Animate — Move mode (open weights) | `fal-ai/wan/v2.2-14b/animate/move` | ~$0.04–0.08/s × 5 = **$0.20–0.40** |
| 3 | Kling O1 Edit (video-to-video character replace) | `fal-ai/kling-video/o1/video-to-video/edit` | $0.168/s × 5 = **$0.84** |
| 4 | ByteDance DreamActor V2 (non-human/multi-character capable) | `fal-ai/bytedance/dreamactor/v2` | Pricing unconfirmed — budget ~$0.75–1.00, **unverified**, confirm on fal page before running |
| 5 | Sync Labs lipsync-2-pro (finishing pass on #1–3 output) | `fal-ai/sync-lipsync/v2/pro` | $5/min → $0.083/s × 5 = **$0.42** (min. billing unit may apply — check fal page) |

## 5. Two people in one pass (survey 2026-09-30)

The job: replace BOTH performers of a 24–37 s clip in one pass, driven by
the original footage, with real private people (consented). Single-subject
motion control (Kling MC, Wan Animate, Act-Two, Luma Modify) is out; see the
retrospective in `video-gen-spike.md`. Verified = official docs; claimed =
vendor or creator posts.

| Rank | Option | Multi-person | Driven by video | Real faces | API | Price | Notes |
|---|---|---|---|---|---|---|---|
| 1 | **Higgsfield Genjutsu Motion Transfer** | claimed; **worked in our test** | yes, 4–30 s | allowed with consent (ToU) | own API | API $0.318/s 480p, $0.681/s 720p, $1.632/s 1080p; **web ~$2 / $5.20 / $7.20 per 15 s** | up to 30 refs, 1080p; two calls for 37 s |
| 2 | SCAIL-2 (Zhipu, open, Apache-2.0, Wan 2.1-14B) | verified: replacement mode + multi-reference by mask colour | yes | self-host, no platform policy | fal/WaveSpeed single-ref only; multi = self-host or RunComfy | $0.04–0.20/s hosted; ~$1–2 GPU-hour self-host | 512/704p, 81-frame windows; no Hotel Lobby example yet |
| 3 | Seedance 2.x reference-to-video | claimed (Starrd, Dreamina) | approximate: regenerates | needs each person's own liveness verification; fal/BytePlus reject otherwise | fal, BytePlus, ComfyUI partner node | $0.13–0.28/s | only after both people verify |
| 4 | ByteDance DreamActor M2.0 | claimed on fal, unproven | yes, ≤30 s | unknown | fal, Replicate, WaveSpeed | $0.05/s | background comes from the still: needs a booth still of both |
| 5 | Viggle Multi-Track | verified feature, up to 7 characters | yes | allowed with consent | web only (API is single-character) | Pro $7.99/mo | photoreal face fidelity historically weak |

Checked and out: Runway Act-Two (single), Runway Aleph (~5 s, unproven),
Luma Ray3 Modify (single), Pika Swap Anything (consumer, unverified),
Hailuo H3 V2V (multi unknown), Vidu Q2/Q3, Veo 3.1 and Sora 2 (no driving
video; Veo blocks real faces, Sora cameos need in-app verification), Kling MC
(one subject), Kling O1 (inconsistent), Wan Animate replace (single), Wan
VACE (DIY, weak on real faces), audio-driven models (OmniHuman 1.5, HuMo,
MultiTalk, InfiniteTalk, HunyuanVideo-Avatar), prompt-only multi-subject
(Phantom, SkyReels-A2, Stand-In), WeLike2Party (paper, no code).

Cheapest next tests: Genjutsu via the **web app** for a full 30 s at 720p
(~$10.40 vs $20.43 by API); DreamActor M2 on fal, 5 s = $0.25 (needs a booth
still); SCAIL-2 single-ref on WaveSpeed, 5 s = $0.20, then multi-ref self-host.

Sources: github.com/zai-org/SCAIL-2, wavespeed.ai/docs/docs-api/wavespeed-ai/scail-2,
fal.ai/models/fal-ai/bytedance/dreamactor/v2/api, viggle.ai/motion-control,
viggle.ai/developers, higgsfield.ai/blog/higgsfield-genjutsu,
imageat.com/trends/hotel-lobby-swap-ai-video, help.runwayml.com (Act-Two
multi-character), kling.ai/quickstart/motion-control-user-guide,
docs.comfy.org/tutorials/partner-nodes/bytedance/seedance-2-0-real-human.

## Sources (accessed 2026-09-28)

- https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video
- https://fal.ai/models?categories=text-to-video
- https://fal.ai/wan-3
- https://fal.ai/models/alibaba/wan-3.0/text-to-video/api
- https://fal.ai/ltx-2.5
- https://huggingface.co/Lightricks/LTX-2.5
- https://venturebeat.com/technology/ltx-2-5-can-generate-a-10-second-ai-video-from-an-image-in-just-6-8-seconds-on-nvidia-superchips-and-its-open-weights
- https://reapi.ai/blog/is-wan-3-0-open-source
- https://winbuzzer.com/2026/08/25/alibaba-launches-wan3-0-for-30-second-ai-video-from-documents-xcxwbn/
- https://ai.google.dev/gemini-api/docs/omni
- https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/
- https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation (fetch blocked HTTP 403; corroborated via community.openai.com/t/is-the-sora2-api-still-working/1379946)
- https://www.buildmvpfast.com/api-costs/ai-video
- https://lumalabs.ai/api
- https://www.atlascloud.ai/blog/guides/kling-ai-vs-runway-vs-runway-vs-luma
- https://fal.ai/kling-motion-control
- https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control
- https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control (confirmed directly, $0.168/s)
- https://fal.ai/learn/devs/kling-video-2-6-motion-control-prompt-guide
- https://aivideobootcamp.com/blog/kling-ai-complete-guide-pricing-features-prompts-tips/
- https://www.cometapi.com/models/runway/act-two/
- https://acttwo.cv/
- https://aiwiki.ai/wiki/runway_act_two
- https://fal.ai/models/fal-ai/wan/v2.2-14b/animate/replace/api
- https://huggingface.co/Wan-AI/Wan2.2-Animate-14B
- https://replicate.com/wan-video/wan-2.2-animate-animation
- https://fal.ai/models/fal-ai/wan/v2.2-14b/animate/move
- https://wan.video/blog/wan2.2-animate
- https://aireiter.com/blog/wan2-2-animate-guide
- https://www.eachlabs.ai/bytedance/dreamactor/bytedance-dreamactor-v2
- https://fal.ai/models/fal-ai/bytedance/dreamactor/v2
- https://invideo.io/blog/dreamactor-motion-control/
- https://wavespeed.ai/blog/posts/introducing-bytedance-dreamactor-v2-on-wavespeedai/
- https://viggle.ai/developers
- https://viggle.ai/motion-control
- https://github.com/tencent/MimicMotion
- https://huggingface.co/papers/2406.19680
- https://fal.ai/models/fal-ai/kling-video/o1/video-to-video/edit (confirmed directly, $0.168/s)
- https://wavespeed.ai/models/kwaivgi/kling-video-o1/video-edit
- https://www.dualview.ai/blog/ai-tools/ai-video-editing-models.html
- https://www.atlascloud.ai/blog/tips/luma-modify-video
- https://fal.ai/models/bytedance/seedance-2.0/reference-to-video
- https://fal.ai/models/bytedance/seedance-2.5/reference-to-video
- https://fal.ai/learn/tools/what-is-seedance-2-5
- https://platform.vidu.com/docs/pricing
- https://www.pixara.ai/blogs/Kling-ai-pricing-2026
- https://sync.so/pricing
- https://sync.so/lipsync-2-pro
- https://fal.ai/models/fal-ai/sync-lipsync/v2/pro
- https://wavespeed.ai/models/sync/lipsync-2-pro
- https://www.eesel.ai/blog/heygen-pricing
- https://www.arcade.software/post/heygen-pricing
- https://www.eesel.ai/blog/synthesia-pricing
- https://www.arcade.software/post/synthesia-pricing
- https://www.tavus.io/pricing
- https://www.hedra.com/models/video/hedra/character-3
- https://www.byteplus.com/en/product/OmniHuman
- https://piapi.ai/omnihuman
- https://wavespeed.ai/docs/docs-api/bytedance/bytedance-avatar-omni-human
- https://huggingface.co/TMElyralab/MuseTalk
- https://github.com/bytedance/LatentSync
- https://fal.ai/docs/documentation/model-apis/pricing
- https://fal.ai/models/fal-ai/pixverse/swap
- https://github.com/facefusion/facefusion
- https://www.insightface.ai/
- https://github.com/iperov/DeepFaceLive
- https://fairstack.ai/models/kling-lipsync-a2v
- https://kling.ai/feature/lip-sync
- https://fal.ai/models/fal-ai/flux-2-pro
- https://fal.ai/learn/devs/flux-2-flash-developer-guide
- https://fal.ai/learn/devs/flux-2-turbo-developer-guide
- https://ai.google.dev/gemini-api/docs/image-generation
- https://www.aifreeapi.com/en/posts/nano-banana-pro-price
- https://developers.openai.com/api/docs/pricing
- https://aireiter.com/blog/gpt-image-2-api-pricing
- https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image
- https://fal.ai/models/fal-ai/qwen-image-edit
- https://fal.ai/models/fal-ai/seedvr/upscale/video
- https://adam.holter.com/seedvr2-on-fal-ai-cheap-10k-image-and-4k-video-upscaling-with-a-catch/
- https://costbench.com/software/ai-video-generators/topaz-video-ai/
- https://fal.ai/models/fal-ai/rife/video
- https://github.com/hzwer/ECCV2022-RIFE
- https://fal.ai/models/fal-ai/birefnet/v2/video
- https://fal.ai/models/fal-ai/sam2/video
- https://elevenlabs.io/pricing
- https://flexprice.io/blog/elevenlabs-pricing-breakdown
- https://blog.dubspot.com/suno-udio-ai-music-lawsuits-2026
- https://variety.com/2026/music/news/sony-music-universal-music-sue-suno-label-backed-model-1236866921/
