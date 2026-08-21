# AI data pipeline — plan before more building (2026-08-20)

_Written after a day of testing that proved the mechanism and surprised on
cost discipline. Rule now in force: **no paid run without a prior
quote-and-confirm from Bilal**, cheap-model option always offered._

## What exists and works (all merged, all rerunnable)

| Rail | Status | One-time cost paid |
|---|---|---|
| Place-id backfill (2,174/2,180 venues) | ✅ deployed | ~free tier |
| Photo proxy + app gallery + fullscreen attribution | ✅ deployed | — |
| Photo labeling (workspace/food/other), keyed placeId#index | ✅ code; 2,540/~10k photos labeled | ~$10 (incl. ~$10 lost to the name-keying bug) |
| Venue analysis → rating evidence (seating/laptops/retail-flag) | ✅ code; 1 venue smoke-tested | pennies |
| Agent research pipeline (ve#4) | 📋 ticket only | — |

## What the data says (measured 2026-08-20, n=2,540)

- **50% of Google café photos are food**, 44% workspace, 5% other — the
  filter halves gallery noise.
- Venue-level judgment works: Gregorys → "a couple of small tables… limited
  seating" → seating: scarce → score dropped. Discernment is real.

## Unit economics (measured / estimated)

| Job | Model | Per unit | Full dataset | Refresh need |
|---|---|---|---|---|
| Photo label (3-way) | Haiku 4.5 | ~$0.0006/photo | **~$5** | quarterly at most |
| Venue analysis (judgment) | Opus 5 | ~$0.016/venue | ~$35 | quarterly at most |
| Venue analysis (judgment) | Sonnet 5 | ~$0.005/venue | **~$10** | quarterly at most |
| Google photo media | — | ~$7/1k past 10k free/mo | ~$0–20/run | rides the above |
| Text research pipeline (ve#4) | TBD | unmeasured | unmeasured | staleness-driven |

Steady state if everything ran quarterly on cheap models: **~$15–35/quarter.**
The scary number was never the steady state — it was unplanned runs.

## Decisions (Bilal, 2026-08-20)

1. **Monthly data budget cap:** $______ (hard ceiling; console caps set to match)
2. **Finish the photo relabel now?** yes / hold (2,540 done; ~$3 remains)
3. **Post-approval gate for evidence-at-scale:** run a ~50-venue Sonnet
   sample (~$1) first; ship the full analysis run only if it materially
   moves rankings (≥15% of sampled venues change score by ≥5 points).
   agreed / revise

## Phasing (proposed)

- **P0 — close out photos** (≤$3, if approved): finish relabel → commit →
  deploy → galleries done. Then data work stops.
- **P1 — submission sprint ($0 data spend):** screenshots (galleries make
  them pop), TestFlight 1.0(3), go-live checklist, submit to Apple. The
  photo/evidence work is a nice-to-have for review, not a blocker — approval
  does not wait on data.
- **P2 — post-approval, gated:** the 50-venue sample (decision 3), then full
  venue analysis on Sonnet if it clears the bar. Retail-flag review by Bilal.
- **P3 — the real pipeline (ve#4):** text research agents with a per-run
  budget in the script, staleness-driven refresh, monthly cap from decision 1.
  Photo evidence becomes one input among several, refreshed quarterly.

## Guardrails (in force)

- Quote-and-confirm before any paid run (saved to agent memory 2026-08-20).
- Script-level cost ceilings on every future paid job.
- Console caps: Anthropic monthly spend limit + Google Places daily quota —
  Bilal to set, makes runaway spend structurally impossible.
- Cheap-model default for mechanical jobs; Opus only where judgment is the
  product and a sample proves the delta matters.
