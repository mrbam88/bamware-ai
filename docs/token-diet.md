# Token diet

One-page policy for cutting token/rate-limit cost across Bamware harnesses.
Companion to `skills/agent-fanout` "Session hygiene = token cost" (that doc
covers supervisor sessions; this one covers per-ticket subagent runs).

## Evidence table (2026-08-22/23, measured)

| Agent | Tokens | Tool uses | Time | Notes |
|---|---|---|---|---|
| code, WITH screenshots (bd#75 UI r2) | 384k | 275 | 84 min | screenshot reads dominate |
| code, no screenshots (bd#88) | 193k | 63 | — | |
| code, no screenshots (bd#87) | 134k | 24 | — | |
| code, no screenshots (bd#89) | 152k | 33 | — | |
| code, no screenshots (bd#93) | 432k | 259 | — | new feature + UI test + 3 real bugs found — legitimately large |
| code, refactor (bd#101) | 246k | 125 | — | |
| docs, audit (bd#90+#32) | 83k | 40 | — | |
| docs, URL check, Haiku (bd#70) | 32k | 18 | — | cheapest run of the night |
| docs, architecture walk | 88k | 40 | — | |
| docs, explore-map | 87k | 24 | — | |

Screenshots-into-model roughly **2x** the token cost of an equivalent
code ticket (384k vs. 134-246k for comparable scope). bd#93's 432k is not
waste — it's a bigger ticket (feature + test + 3 bugs) — so raw token
count alone is not a red flag; check it against scope first.

Observed waste (not itemized per-ticket, but real):
- 4 parallel Mac agents caused simulator contention — agents stalled
  "waiting for background gate" 3x each, one `simctl shutdown all`
  incident, flaky re-runs.
- Full-suite re-runs per iteration instead of `-only-testing`.
- Screenshot reads into the model (see above).
- Agents stopping idle and needing supervisor nudges — each nudge costs
  supervisor tokens too.

## Levers (expected saving, risk)

- **Sonnet/Haiku model defaults** — done (2026-08-22). Mechanical/well-specified
  tickets on Sonnet, docs drafting on Haiku. Saving: baseline, already banked.
  Risk: none, already adopted.
- **No screenshots-into-model** — use snapshot tests + a11y audits + captures
  as PR evidence (not model input). Saving: ~50% on UI tickets (384k → ~150-200k
  range, matching non-screenshot code runs). Risk: low — snapshot/a11y checks
  catch most regressions; occasional visual bug slips through, catch in human
  QA pass.
- **`-only-testing` discipline, full matrix once** — run the targeted test
  during iteration, full suite once before PR. Saving: 20-40% on any ticket
  with a test loop (scales with iteration count). Risk: low — full run still
  happens once before merge.
- **Sequential, not parallel, on the Mac** — one simulator-using agent at a
  time; batch the rest as a night queue (ai#17). Saving: eliminates the
  3x-stall/`simctl shutdown all` waste seen tonight — hard to put a percent
  on, but it was a full re-run's worth of tokens on affected tickets. Risk:
  low — slower wall-clock, no token cost.
- **One ticket per agent, with a fence** — already policy; keeps scope (and
  token spend) bounded and auditable. Saving: prevents unbounded runs.
  Risk: none.
- **Prompt caching / shorter supervisor prompts** — smaller, stabler system
  prompt content increases cache hit rate. Saving: hard to isolate from this
  data; agent-fanout's session-hygiene numbers (99% of the $800/4-day burn
  was cache reads) suggest this matters more for supervisor sessions than
  subagents. Risk: none.
- **Agent `effort` levels** — cap reasoning effort for mechanical work.
  Saving: unmeasured tonight, worth a follow-up spike. Risk: low for
  well-specified tickets; do not lower effort for ambiguous/design work.
- **CI as second witness** — defer until billing returns; would remove some
  local re-run tokens. Saving: unmeasured, blocked.
- **Worktree reuse** — avoid re-cloning/re-setup cost per ticket. Saving:
  small, mostly wall-clock not tokens.
- **Graphify-style repo indexes** — threshold is 500+ files; our repos run
  67-164 files. Skip — not worth the index-maintenance overhead at this size.
- **Matt Pocock spec-first flow (grill -> ticket -> tdd)** — front-loads
  clarification into cheap human/Haiku time instead of expensive agent
  back-and-forth. Saving: unmeasured, plausible on ambiguous tickets;
  agent-ready-tickets already pushes this direction.

## Per-ticket budget

| Ticket type | Budget | Stop-and-report threshold |
|---|---|---|
| Doc | ≤100k tokens | 150k |
| Small fix | ≤150k tokens | 225k |
| Feature | ≤300k tokens | 450k |
| Refactor | ≤250k tokens | 375k |

"Stop and report" = exceeded budget by 50%: pause, post current state and
token count to the ticket/PR, wait for direction rather than continuing to
burn quota. A ticket that's over budget but visibly making progress
(bd#93-style: bigger real scope) should say so explicitly rather than
silently blowing through.

## Rate limits: agents per 5-hour window

Claude Max 20x, 5-hour windows, extra usage OFF — no paid fallback when the
window fills. Using tonight's non-screenshot code-agent range (~130-250k
tokens) and doc-agent range (~30-90k tokens), and assuming roughly
**1.5M tokens/window for subagent work (assumption — verify against the
usage page)**:

- All-code-ticket window: ~1.5M / ~190k avg ≈ **6-8 code agents**.
- All-doc-ticket window: ~1.5M / ~60k avg ≈ **20-25 doc agents**.
- Mixed night queue (realistic): budget **~8-10 agents per window**,
  fewer if any UI/screenshot-heavy tickets are in the mix (those effectively
  count as ~2 agents each).
- Screenshots-into-model or 4x parallel Mac contention both blow this
  estimate — see levers above for why to avoid both.

Rule of thumb: **plan a night queue to ~8 tickets per 5-hour window**,
sequential on Mac-simulator work, and re-check against the actual usage
page after a few nights to replace the 1.5M assumption with a measured
number.

## Measurement recipe

1. Per-agent tokens/tool-uses/time: read the transcript usage fields (or
   the harness's own end-of-run summary) — don't re-derive from raw logs.
2. Classify the run: code-with-screenshots / code-without / doc, and note
   ticket scope (fix vs. feature vs. refactor) before judging the number —
   raw token count without scope context is not a verdict.
3. Compare against the budget table above; flag anything over threshold in
   the PR description, don't silently absorb it.
4. Re-run this table every few weeks (or after a lever changes) so the
   assumption fields (window token capacity, per-type averages) get
   replaced with fresh measurements instead of going stale.
