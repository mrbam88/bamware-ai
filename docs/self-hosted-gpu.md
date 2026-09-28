# Self-hosted GPU economics for AI video generation

Research spike, 2026-09-28. Context: Kling v3 Pro Motion Control on fal.ai gives the
best quality at **$0.168/output-second/person** (closed, API-only). The free local
route, Wan 2.2 Animate 14B (open weights, Apache-2.0) in ComfyUI on an M3 Pro Mac,
works but is slow (~10 min compute per 1 s of 480p output). Two RunPod self-host
attempts failed before any generation happened. This doc lays out the rental-GPU
option and its economics before spending anything.

**Scope note:** buying a GPU box (4090/5090 desktop) is out of scope per the
founder — this only covers renting (hourly pods and per-second serverless).

All prices are spot-checked 2026-09-28 and move often — re-quote before committing
spend. Marketplace prices (Vast.ai, TensorDock) are quoted as ranges because hosts
set their own rates.

---

## 1. What "self-hosting" means (plain-language)

Think of it like EC2 vs Lambda, but for GPUs instead of CPUs:

| Model | Mobile/Node analogy | What it is |
|---|---|---|
| **Hourly pod** (RunPod, Vast.ai, Lambda, TensorDock) | An EC2 instance you `ssh` into | You rent a whole GPU box by the hour (billed per-second on top). It stays running — and billing — until you stop it, whether or not it's doing work. |
| **Serverless GPU, per-second billing** (RunPod Serverless, Modal, Replicate custom deployments, Beam) | Lambda / Cloud Functions | You deploy a container; a request wakes a worker, it runs, and it scales back to zero. You pay only for active seconds, plus a "cold start" tax when a worker has to boot from cold. |
| ~~Owning hardware~~ | ~~buying your own server~~ | **Out of scope** — founder is not buying a GPU box. |

Trade-offs:

| | Idle cost | Cold starts | Setup effort |
|---|---|---|---|
| Hourly pod | You pay for every idle minute you forget to stop | None once running — but first boot + model load can take 2-5 min | Medium: pick image, attach storage, SSH in, install/configure |
| Serverless | $0 while idle | 20s-2min per cold worker (loading a 14B video model onto a GPU is *not* instant) | Higher upfront (containerize, handle model caching) but no babysitting after |

For a solo founder doing occasional test batches, a **stop-when-done hourly pod**
is the simplest mental model (closest to "spin up an EC2 box, SSH in, run a script,
shut it down"). Serverless pays off once request volume is regular enough to
justify the extra packaging work, or when you want a hosted API for the app itself.

---

## 2. Prices (2026-09-28)

### GPU rental, $/hour

| GPU | RunPod Community* | RunPod Secure (on-demand) | RunPod Serverless | Vast.ai (marketplace, wide range) | Lambda Labs (on-demand) | TensorDock (marketplace) |
|---|---|---|---|---|---|---|
| RTX 4090 (24GB) | $0.34 | $0.74 | $1.10 | ~$0.14–$0.50 | — (not offered) | — |
| RTX 5090 (32GB) | $0.69 | $0.99 | $1.58 | not verified | — | — |
| L40S (48GB) | $0.79 | $1.09 | $1.75 | not verified | not verified | not verified |
| A100 80GB (SXM) | $1.39 | $1.59 | $2.72 | ~$0.67+ (dynamic) | $2.79/GPU** | $1.42 (reserved)–$1.63 (on-demand) |
| H100 (PCIe/SXM) | $1.99 / $2.69 | $2.89 / $3.49 | $4.79 | ~$0.90–$5.98 (very wide) | $3.29 (PCIe) / $3.99 (SXM) | $2.01 (PCIe) / $3.92 (SXM); spot $2.91 |
| H200 | $3.59 | $4.59 | $5.93 | not verified | not verified (offered, no confirmed rate) | not verified |

\* RunPod "Community Cloud" = uninsured/interruptible capacity on community hosts, cheapest tier but no uptime guarantee — closest analog to spot.
\*\* Lambda's headline A100 SXM 80GB rate is per-GPU **inside an 8-GPU instance** ($22.32/instance-hr) — not a single-GPU rental. Treat Lambda as cluster-oriented, not a fit for single-GPU test runs.

RunPod raised Secure Cloud rates broadly on 2026-09-13 (H100 SXM +17%, A100 PCIe +14%) — prices are actively moving; re-check before budgeting. Vast.ai and TensorDock are peer marketplaces, so quoted rates are host-set and vary by reliability tier/region; treat single numbers as anecdotal.

### Serverless per-second platforms, $/hour equivalent

| Platform | H100 | H200 | A100 80GB | L40S | Notes |
|---|---|---|---|---|---|
| Modal | $3.95 ($0.001097/s) | $4.54 ($0.001261/s) | $2.50 ($0.000694/s) | $1.95 ($0.000542/s) | True per-second, no minimum. $30/mo free credits on Starter (~7.5 H100-hrs); up to $10k for startups/academics on application. |
| RunPod Serverless | $4.79 | $5.93 | $2.72 | $1.75 | Billed per-second including cold-start init time (20-60s typical cold start ≈ $0.03-$0.08 tax per cold call on H100). |
| Replicate (public models) | $5.49 ($0.001525/s) | not offered | $5.04 ($0.0014/s) | not offered | Custom **deployments** bill the whole lifecycle (boot→shutdown), not just active seconds — idle time costs full rate. |
| Beam | $1.74 | not verified | $1.30 | not verified | Billed per-millisecond; cheapest serverless H100/A100 quotes found, but least-established provider of this set — verify reliability before relying on it. |

### Storage (network volumes that keep model weights between runs)

RunPod: **$0.07/GB/month** under 1TB, $0.05/GB/mo over 1TB (standard); $0.14/GB/mo for high-performance volumes. A Wan 2.2 14B checkpoint set (~30-60GB with VAE/text-encoder/LoRAs) costs roughly **$2-4/month** to keep warm on a standard volume — trivial next to compute cost, but worth attaching so you don't re-download 30-60GB every pod boot.

### Free credits

- **Modal**: $30/month free on the Starter plan (auto-renews monthly, no card required to start); $100/month on Team plan; up to $10k for qualifying startups/academic researchers (application-gated).
- No RunPod-wide recurring free tier was found as of 2026-09-28 (occasional promo credits only) — do not assume this fills real capacity.

---

## 3. Throughput for open video models → $/output-second

**The core arithmetic:** `$/output-second = ($/GPU-hour ÷ 3600) × (compute-seconds needed per 1 output-second)`. Everything below plugs into that formula. Compute-seconds-per-output-second ("x") is the number that actually matters and it is *very* sensitive to resolution, step count, precision, and attention backend — treat every x below as a directional estimate from a community report, not a spec, and re-benchmark your own workflow before trusting it for a budget.

### Reported x (compute-seconds per output-second), unoptimized

| Model | GPU | Resolution | x (compute-s / output-s) | Source basis |
|---|---|---|---|---|
| Wan 2.1/2.2 14B I2V/T2V | H100 | 480p | ~17× (85s / 5s clip) | community H100 benchmark |
| Wan 2.1/2.2 14B I2V/T2V | H100 | 720p | ~57× (284s / 5s clip) | same |
| Wan 2.1/2.2 14B I2V/T2V | A100 80GB | 480p | ~70× (350s / 5s clip) | same |
| Wan 2.1/2.2 14B I2V/T2V | A100 80GB | 720p | ~217× (1083s / 5s clip) | same |
| Wan 2.2 **Animate** 14B | RTX 3090 | 480p | ~112-120× (~7s/frame × 16fps) | community benchmark, closest match to founder's own Mac number (~600× on Apple M3 Pro, for reference — CPU/unified-memory, not a GPU rental) |
| Wan 2.2 14B (fp8) | RTX 4090 | 720p, 50 steps | ~15-30× (60-120s / 4s clip) | community |
| Wan 2.2 14B + SageAttention + TeaCache | RTX 4090 | ~480p, 20 steps, 33 frames@16fps (~2.06s) | ~120× optimized vs ~263× baseline (542s→248s) | community, SageAttention+TeaCache combo |

### Speed-ups worth knowing about

- **lightx2v Wan2.2-Lightning 4-step distilled LoRA**: cuts diffusion steps from ~40-50 to 4. Reported combined with fp8 + distillation: **up to ~42×** speedup on suitable hardware, **>50×** on a single RTX 5090, but only **~1.4×** on a single H100 (H100 is already fast per-step, so distillation buys less there). Net effect: on a 4090-class card, a clip that took ~115× real-time can plausibly drop to **single-digit-to-low-teens ×** — at some cost to motion quality/fidelity (it's a distilled model, not the full model).
- **fp8 quantization**: roughly halves VRAM and gives a modest (not dramatic on its own) speed boost; mainly what makes 14B fit on a 24GB card at all.
- **SageAttention**: ~2-2.9× faster attention than FlashAttention2/xformers on RTX 4090 in isolation.
- **TeaCache**: skips redundant diffusion steps; combined with SageAttention gave ~54% wall-clock reduction in one reported case (542s→248s).

### Converting to $/output-second

Using the formula above, for **Wan 2.2 Animate at 480p, unoptimized** (x≈115, midpoint of the RTX 3090 range):

| GPU (rental) | $/hr | $/compute-s | × x=115 | **$/output-second** |
|---|---|---|---|---|
| RTX 4090, RunPod Community | $0.34 | $0.0000944 | ×115 | **≈$0.011** |
| RTX 4090, RunPod Serverless | $1.10 | $0.000306 | ×115 | **≈$0.035** |
| H100 SXM, RunPod Secure (x≈57 @720p from the H100 row, better GPU/worse resolution — not directly comparable) | $3.49 | $0.000969 | ×57 | **≈$0.055** (720p) |
| A100 80GB, RunPod Community (x≈70 @480p) | $1.39 | $0.000386 | ×70 | **≈$0.027** |

With the **lightx2v 4-step LoRA** knocking x down to roughly 5-12× on a 4090-class card, the same RunPod Community 4090 math gives **≈$0.0005-$0.001/output-second** — two orders of magnitude below Kling. That gap is the entire reason to investigate self-hosting; it is also the number most likely to be optimistic (distilled-model quality is a real trade-off — see §5).

**Headline comparison:** Kling = **$0.168/output-second/person** (closed). Self-hosted Wan 2.2 Animate, unoptimized, on a cheap rented 4090 ≈ **$0.011/output-second** (≈15× cheaper before even applying speed-ups); with lightx2v-style acceleration, potentially ≈**$0.0005-0.001/output-second** (100-300× cheaper) — at reduced fidelity.

### LTX-2 (newer open contender, mixed picture)

On an H100, per diffusion *step*, LTX-2 (19B, audio+video) was benchmarked at **1.22s/step vs Wan 2.2-14B's 22.30s/step (~18× faster per step)** — but LTX-2 and Wan2.2 don't use the same step counts or settings, so this isn't a direct $/output-second comparison. LTX's own flagship demo (LTX-2.5, a newer checkpoint, not confirmed Apache-licensed at parity with base LTX-2) generated a 10s 720p clip in 6.8s **self-hosted on 2× NVIDIA GB200** — hardware not yet available on RunPod/Vast/Lambda/TensorDock as of this check. Treat LTX-2 as promising but **not yet benchmarked end-to-end on rentable GPUs** for this use case; worth a follow-up test.

---

## 4. Break-even vs Kling ($0.168/s)

Assumptions: a "finished 10s two-person video" = 20 output-person-seconds (2 people × 10s), matching Kling's per-person billing unit. Wan-Animate-style models animate one character per pass, so a two-person video needs two generation passes — this doc treats compute needed per video as 20 output-seconds either way, for comparability. Re-rolls (bad takes, artifacts, lip-sync misses) are real; this model assumes **2× compute** to land one usable finished video, which is a guess, not a benchmark — track your own re-roll rate once testing starts.

**Kling cost per video:** 20 × $0.168 = **$3.36/video** (no compute-ops, no re-roll math needed — Kling's price already reflects successful generations you choose to keep, though you still pay for rejected takes).

Self-hosted, using unoptimized Wan 2.2 Animate at 480p (x≈115) on a RunPod RTX 4090:

| Volume/month | Kling (pay-per-clip) | Self-hosted, RunPod **Serverless** 4090 ($1.10/hr, per-second, scale-to-zero) | Self-hosted, RunPod Community 4090, **always-on pod** ($0.34/hr flat) |
|---|---|---|---|
| 10 videos | $33.60 | 10 × 20×115×2 (reroll) s × $0.000306/s ≈ **$14.10** | $0.34 × 730 hr/mo = **$248** fixed — *worse than Kling at this volume*; the pod sits idle almost all month |
| 100 videos | $336 | ≈**$141** | Compute needed: 100×20×115×2s = 460,000s ≈ 128 GPU-hrs; a $0.34/hr pod run **only while working** ≈ **$43.5**, *if* you remember to start/stop it precisely — realistically add model-load/idle buffer, call it **$60-90** |
| 1,000 videos | $3,360 | ≈**$1,410** | Compute needed ≈ 1,280 GPU-hours/month — **exceeds one GPU's ~730 hrs/month**. A single rented 4090 physically cannot keep up; you'd need 2+ GPUs, a faster GPU (H100), or the lightx2v speed-up to fit in one card. Rough always-running-pod-equivalent cost (2 GPUs, $0.34/hr each, ~90% utilized) ≈ **$450-500** |

**Reading this:**
- At **10/month**, self-hosting is only clearly cheaper via **serverless** (pay-per-use); an always-on pod is a bad idea at this volume — you're paying full-month rent for a few hours of actual work.
- At **100/month**, both serverless and a carefully start/stopped pod beat Kling by roughly 3-7×, but the pod number assumes disciplined manual stop/start (no idle waste) — realistic slippage narrows the gap.
- At **1,000/month**, a single consumer GPU is throughput-constrained regardless of price — this is a capacity problem, not just a cost problem, and pushes you toward either multiple GPUs, an H100-class card, or the lightx2v/distilled-model path.
- **None of this accounts for**: your own engineering time standing up and babysitting the pipeline, occasional failed jobs/wasted GPU-time, or the quality gap in §5. Kling's price already includes "someone else's reliability engineering."

---

## 5. The quality catch

Kling is closed — there is no way to rent your way to Kling's exact model. Self-hosting means accepting an **open-weights substitute**, and the honest comparisons found say the substitutes are not at parity for this specific use case (likeness + lip sync of real people):

- **Kling-MotionControl vs Wan-Animate**: a direct comparison found Kling-MotionControl **superior at fine-grained facial expressions and hand gestures**. Kling is generally described as the stronger tool for *motion mimicry* (an image subject copying a performer's motion); Wan-Animate is positioned as stronger for *character replacement in an existing scene* (swapping a person in while preserving camera/background) — a different task emphasis than pure likeness/motion fidelity.
- **Lip sync**: Kling's newer line (3.0) does native lip-synced speech generation from a text prompt; **Wan's Motion Control / Animate branch is motion-and-expression focused and is not described as a native lip-sync solution** — you'd likely need a separate lip-sync pass (e.g. a dedicated sync model) on top of Wan output.
- **Newest open option**: **Wan2.2-Animate-2-14B (a.k.a. "Wan-Animate-2") shipped 2026-08-07 under Apache-2.0** — a genuine upgrade path over the 2025 Wan 2.2 Animate 14B the founder already tested, taking a reference image + driving video directly (imitation or replacement mode). As of the most recent check (2026-08-08), it **had no independent benchmark yet** — it's new enough that likeness/lip-sync quality claims are unverified. Worth testing before assuming the older Wan 2.2 Animate numbers in this doc are the current ceiling for open models.
- **Wan 3.0**: Alibaba's next flagship is **API-only, not open weights** (public beta since 2026-08-06) — the open-weights line stops at Wan 2.2 / Wan-Animate-2. Do not plan around a hypothetical open Wan 3.0.
- **Other open contenders** (HunyuanVideo-Avatar, SkyReels, MAGI-1): all real projects with open weights, but none found in a credible head-to-head against Kling Motion Control for likeness/lip-sync specifically. HunyuanVideo-Avatar is audio-driven talking-avatar focused (single portrait + audio → talking video, runs on ~10GB VRAM with TeaCache) — a different pipeline shape than motion-transfer, potentially a better fit if the product ever wants "photo + voice clip" rather than "photo + driving video." SkyReels is positioned for cinematic/filmmaking quality rather than this use case. Treat all three as **untested for this specific job** — a same-input comparison against Kling would need to be run directly, not inferred from marketing pages.
- **Leaderboards** (Artificial Analysis) move roughly weekly and currently spotlight closed models (Seedance 2.0, HappyHorse-1.0, Veo 3.1) for character consistency/lip-sync/audio — no open model appears at the top of those specific categories as of this check.

**Bottom line on quality:** self-hosting today means trading Kling's likeness/lip-sync edge for cost — not matching it. Wan-Animate-2 (Aug 2026) is the one lead worth a real side-by-side test before concluding the gap is permanent.

---

## 6. Doing it reliably on RunPod

### Likely causes of the two failed attempts

1. **Community pod that never started its container.** Community Cloud is uninsured/best-effort capacity — a container that never starts is a known, reported failure mode on that tier (vs Secure Cloud, which runs in verified datacenters). This is a capacity/host-reliability issue, not (necessarily) a configuration bug.
2. **Secure H100 pod stuck at 0% CPU with a REST `dockerStartCmd` running a GitHub bootstrap script.** The most likely root cause, per RunPod's own docs and community reports:
   - `dockerStartCmd` **replaces** the image's own `CMD` (which for `runpod/pytorch`-family images is normally `/start.sh` — the script that launches SSH/Jupyter and, critically, keeps the container's main process alive). If your custom command doesn't also background `/start.sh` (or otherwise keep a foreground process alive), the effective entrypoint can be silently wrong.
   - The `dockerStartCmd` field (via the REST/GraphQL API) expects **flat argv-style strings, not a shell one-liner with `&&` or `|`**. A command like `curl ... | bash && python run.py` passed as a single string (rather than via `dockerEntrypoint: ["/bin/sh","-c"]` + one joined string) can be misparsed or only partially executed — consistent with "started, but nothing happened" (0% CPU = no process actually doing work, even though the container itself is up).
   - A bootstrap script fetched from GitHub at boot also introduces a silent-failure surface: network hiccup, GitHub rate limit, wrong branch/path, or a script that assumes a working directory that doesn't exist in that image — any of which fails quietly with no obvious error unless you're tailing logs.

### Robust patterns

- **Start from an official template**, not a bare custom image + custom start command. RunPod's official ComfyUI template already handles the model-directory layout (`/workspace/ComfyUI/models/{checkpoints,diffusion_models,loras,vae,clip,controlnet,...}`) and keeps SSH/Jupyter working.
- **Attach a Network Volume** and point ComfyUI's model paths at it. Models (Wan 2.2 checkpoint + VAE + text encoder + LoRAs, ~30-60GB) persist across pod restarts instead of re-downloading every boot — worth the ~$2-4/month.
- **Prefer Secure Cloud over Community Cloud** for anything you need to actually finish a test on a deadline; Community is fine for pure cost-optimization once the pipeline is proven.
- **Don't fight `dockerStartCmd` with shell logic.** If you need multiple steps (clone repo → install deps → keep base services alive → run script), either: (a) build a custom Docker image that does all of that in its own entrypoint script, or (b) set `dockerEntrypoint: ["/bin/sh","-c"]` and pass **one single joined string** as `dockerStartCmd`, explicitly backgrounding the base `/start.sh` (e.g. `/start.sh & <your setup and run commands>`), never plain `&&`-chained argv array elements.
- **Always tail logs before assuming success.** `runpodctl pod logs <id> --follow` (or the console log viewer) is the fastest way to see whether your bootstrap script even started, versus guessing from CPU%.
- **Use `runpodctl`** for the boring reliability wins: `runpodctl send`/`receive` for moving files without setting up your own S3, `runpodctl ssh` for a stable connection instead of copy-pasting a rotating pod IP.
- **For repeatable/production use, `worker-comfyui` (runpod-workers/worker-comfyui on GitHub)** is RunPod's maintained serverless ComfyUI worker: submit a ComfyUI workflow JSON via HTTP, get back base64 or S3 URLs, `/health` endpoint included. This sidesteps the whole `dockerStartCmd` problem because the container's own entrypoint is already correct — you supply a workflow, not a boot script.

### Concrete minimal recipe (next test)

1. RunPod console → **Secure Cloud** → RTX 4090 or A100 → **official ComfyUI template**.
2. Attach a **Network Volume** (50GB, standard tier ≈ $3.50/mo) for models.
3. SSH in (via `runpodctl ssh` or console), download Wan 2.2 Animate 14B (+ VAE/text encoder/LoRAs) once into the volume's model directories.
4. Run one Wan 2.2 Animate generation through ComfyUI's web UI (not a custom start-command script) to prove the environment works end to end.
5. Only after that succeeds, consider `worker-comfyui` for a serverless/repeatable version.
6. Stop the pod the moment you're done — Secure Cloud on-demand still bills per-second while running.

---

## 7. Recommendation

**At 10-100 videos/month (the founder's stated starting range), self-hosting is not yet worth the switch.** The compute math looks great on paper (potentially 15-300× cheaper per output-second than Kling), but:

- The quality comparison in §5 says the open substitute is a real downgrade on exactly the two things that matter most for a "real people" keepsake product — likeness fidelity and lip sync — and Kling's price already buys reliability engineering you'd otherwise own yourself.
- At 10-100 videos/month, the *absolute* dollar savings vs Kling (roughly $20-$250/month, per §4) are small relative to the founder's own time cost of standing up and babysitting a GPU pipeline that has already failed twice in two attempts.
- The two RunPod failures indicate the team is not yet past the "reliably get a container to run at all" stage — that has to be solved *before* any cost comparison is meaningful, and it's solvable without spending anything (official template + no custom bootstrap script, per §6).

**When self-hosting would start to make sense:** once volume is consistently in the many-hundreds-to-thousands/month range where Kling's linear per-second cost becomes the dominant expense (§4's 1,000/video row), or once Wan-Animate-2 (or another new open model) closes the quality gap enough that the substitute isn't a downgrade — whichever comes first.

**Cheapest meaningful next test (recommended):** rent a single **RunPod Secure Cloud RTX 4090** (~$0.74/hr on-demand), attach a network volume, load the *stock ComfyUI web UI* (no custom start command), run **Wan-Animate-2** (the Aug 2026 Apache-2.0 model, not the older Wan 2.2 Animate already tested) once end-to-end on one real 10s two-person-equivalent clip, and eyeball it against a Kling sample side by side.

- **Expected cost:** model load + one generation + iteration ≈ 1-2 hours of pod time ≈ **$0.75-$1.50**, plus the $3.50/month network volume (cancel/detach after the test if not continuing).
- **This directly answers two open questions at once:** (1) does the RunPod reliability problem actually go away with the official-template + no-custom-bootstrap approach, and (2) is Wan-Animate-2's quality close enough to Kling to justify the cost math in §4 at all. Both are prerequisites to any further spend, and both are answerable for under $2.

---

## Sources

- [Runpod GPU Cloud Pricing](https://www.runpod.io/pricing) — accessed 2026-09-28
- [RunPod price change tracker — Secure Cloud rate hike, 2026-09-13](https://www.usagepricing.com/blueprint/activity/runpod-2026-09-20-secure-cloud-price-hike) — accessed 2026-09-28
- [Runpod Pricing 2026 breakdown — Spheron](https://www.spheron.network/blog/runpod-h100-pricing-2026/) — accessed 2026-09-28
- [RunPod GPU Pricing & Availability (Sep 2026) — GPUPerHour](https://gpuperhour.com/providers/runpod) — accessed 2026-09-28
- [Vast.ai GPU Cloud Hosting](https://vast.ai/products/gpu-cloud) — accessed 2026-09-28
- [Vast.ai vs Thunder Compute pricing](https://www.thundercompute.com/blog/vast-ai-vs-thunder-compute) — accessed 2026-09-28
- [Lambda Labs vs Thunder Compute pricing](https://www.thundercompute.com/blog/lambda-labs-vs-thunder-compute) — accessed 2026-09-28
- [Lambda Cloud H100 Pricing 2026 — Spheron](https://www.spheron.network/blog/lambda-cloud-h100-pricing-2026/) — accessed 2026-09-28
- [TensorDock H100 pricing](https://www.tensordock.com/gpu-h100.html) and [A100 pricing](https://www.tensordock.com/gpu-a100.html) — accessed 2026-09-28
- [Modal Pricing](https://modal.com/pricing) — accessed 2026-09-28 (WebFetch)
- [Modal Pricing Explained — Beam](https://www.beam.cloud/blog/modal-pricing-explained) — accessed 2026-09-28
- [RunPod Serverless Pricing Explained — Aliteq](https://aliteq.com/runpod-serverless-pricing-explained-2026) — accessed 2026-09-28
- [Replicate API Guide pricing — Apiframe](https://apiframe.ai/guides/replicate-api-guide) — accessed 2026-09-28
- [Replicate Pricing 2026 — Spheron](https://www.spheron.network/blog/replicate-pricing-2026-per-second-cost/) — accessed 2026-09-28
- [Beam.cloud pricing comparison — ComputePrices](https://computeprices.com/compare/beam-vs-google) — accessed 2026-09-28
- [Runpod: Wan 2.2 in ComfyUI guide](https://www.runpod.io/articles/guides/comfyui-wan-2-2) — accessed 2026-09-28 (WebFetch)
- [Wan 2.1 GPU Benchmarks: Speed & Cost Compared — InstaSD](https://www.instasd.com/post/wan2-1-performance-testing-across-gpus) — accessed 2026-09-28
- [Benchmarking WAN2.2 — SaladCloud blog](https://blog.salad.com/benchmarking-wan2-2/) — accessed 2026-09-28
- [Wan 2.1/2.2 VRAM Requirements — WillItRunAI](https://willitrunai.com/blog/wan-2-2-vram-requirements) — accessed 2026-09-28
- [GitHub: Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2) — accessed 2026-09-28
- [Wan-AI/Wan2.2-Animate-14B — Hugging Face](https://huggingface.co/Wan-AI/Wan2.2-Animate-14B) — accessed 2026-09-28
- [Wan-AI/Wan2.2-Animate-2-14B — Hugging Face](https://huggingface.co/Wan-AI/Wan2.2-Animate-2-14B) — accessed 2026-09-28
- [GitHub: ModelTC/Wan2.2-Lightning (lightx2v)](https://github.com/ModelTC/Wan2.2-Lightning) — accessed 2026-09-28
- [lightx2v/Wan2.2-Lightning — Hugging Face](https://huggingface.co/lightx2v/Wan2.2-Lightning) — accessed 2026-09-28
- [SageAttention: Accurate 8-Bit Attention — arXiv 2410.02367](https://arxiv.org/pdf/2410.02367) — accessed 2026-09-28
- [LTX-2: Efficient Joint Audio-Visual Foundation Model — arXiv 2601.03233](https://arxiv.org/pdf/2601.03233) — accessed 2026-09-28
- [LTX-2.5 open-weights world model — VentureBeat](https://venturebeat.com/technology/ltx-2-5-can-generate-a-10-second-ai-video-from-an-image-in-just-6.8-seconds-on-nvidia-superchips-and-its-open-weights) — accessed 2026-09-28
- [Kling 2.6 Motion Control vs Wan 2.2 Animate comparison](https://wanvideogenerator.com/blog/ai-motion-control-kling26-vs-wan22-animate) — accessed 2026-09-28
- [Kling Motion Control vs Wan Animate — fylia.ai](https://fylia.ai/blog/detail/Motion-Transfer-Showdown-Kling-vs-Wan-Which-One-Nails-Your-Character-Animation-1403c7f44bf5/) — accessed 2026-09-28
- [Kling-MotionControl Technical Report — arXiv 2603.03160](https://arxiv.org/html/2603.03160v1) — accessed 2026-09-28
- [Is Wan 3.0 Open Source? — AtlasCloud](https://www.atlascloud.ai/blog/tips/is-wan-3.0-open-source) — accessed 2026-09-28
- [Wan 3.0 Release Date — orcarouter.ai](https://www.orcarouter.ai/blog/wan-3-0-release-date) — accessed 2026-09-28
- [GitHub: Tencent-Hunyuan/HunyuanVideo-Avatar](https://github.com/tencent-hunyuan/hunyuanvideo-avatar) — accessed 2026-09-28
- [Best Open Source Video Generation Models in 2026 — Hyperstack](https://www.hyperstack.cloud/blog/case-study/best-open-source-video-generation-models) — accessed 2026-09-28
- [What is the Best AI Video Model in 2026 — Medium/Data Science Collective](https://medium.com/data-science-collective/what-is-the-best-ai-video-model-in-2026-f93f0793657e) — accessed 2026-09-28
- [RunPod: Build a custom Pod template (docs)](https://docs.runpod.io/pods/templates/create-custom-template) — accessed 2026-09-28
- [GitHub: runpod-workers/pod-template](https://github.com/runpod-workers/pod-template) — accessed 2026-09-28
- [RunPod Container Exited / Health Check troubleshooting — Markaicode](https://markaicode.com/errors/runpod-docker-deployment-failed-fix/) and [Health Check Failed](https://markaicode.com/errors/runpod-health-check-failed-fix/) — accessed 2026-09-28
- [RunPod Troubleshooting docs (serverless)](https://docs.runpod.io/serverless/troubleshooting) — accessed 2026-09-28 (WebFetch)
- [How to Run ComfyUI on RunPod with Network Volume — NextDiffusion](https://www.nextdiffusion.ai/tutorials/how-to-run-comfyui-on-runpod) — accessed 2026-09-28
- [GitHub: runpod-workers/worker-comfyui](https://github.com/runpod-workers/worker-comfyui) — accessed 2026-09-28
- [GitHub: runpod/runpodctl](https://github.com/runpod/runpodctl) and [runpodctl docs](https://github.com/runpod/runpodctl/blob/main/docs/runpodctl.md) — accessed 2026-09-28
- [Docker Setup for PyTorch, CUDA — RunPod guide](https://www.runpod.io/articles/guides/docker-setup-pytorch-cuda-12-8-python-3-11) — accessed 2026-09-28
