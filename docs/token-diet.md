# Token diet

One-page policy for cutting token/rate-limit cost across Bamware harnesses.
Companion to `skills/agent-fanout` "Session hygiene = token cost" (that doc
covers supervisor sessions; this one covers per-ticket subagent runs).

## Cost-aware distribution priority (Bilal, 2026-09-24)

A primary reason for adopting Hermes is repeatedly exhausting rate-limited
agent access. Bilal wants work distributed to cheaper models across his
machines. Treat quota preservation as an architectural requirement, not a
later optimization. This states a goal, not approval for paid runs or fallback.
Bilal specifically wants to explore the M3 MacBook as a local-inference server
for offloading work and backup capacity, not only as an Apple build executor.
Unified memory, serving software, model quality and contention with Apple work
must be measured before choosing a model or promising throughput.

Route execution location separately from inference provider/model: moving a
worker to another laptop does not add quota when it uses the same account's
shared limit. Local inference requires verified model-serving capability;
remote workers calling cloud models still consume that provider's allowance.
Before selecting worker models, inventory current subscriptions, model access,
shared limits, hardware readiness and an approved spending ceiling. Use scripts
for deterministic work, bounded cheaper-model tasks for well-specified work,
and stronger reasoning for ambiguity/review or explicit escalation. Measure
accepted outcomes and rework, not only nominal token price. No model purchases,
new endpoints, fallback billing or worker runs were authorized by this goal.

## Standing session rules

Bilal's 2026-08-21 spend rule is critical: prefer free (local Mac mobile builds,
OpenStreetMap where suitable); Actions is backup-only for mobile builds/uploads.
Paid runs require quote-and-confirm; anything that could exceed $20 is an
immediate stop for explicit permission, including accumulated minutes.

Agent usage itself is budgeted: Claude Max 20x with extra-usage overage OFF
(2026-08-21). A day-old session consumed roughly $650 API-equivalent out of an
$800 week; this is historical quota evidence, not a current cash bill. Keep one
session per ticket, compact early, avoid whole-file/log dumps, and keep
supervisors short-lived. No idle polling loops; use event notifications.
Cost defaults adopted 2026-08-22: Sonnet for mechanical/well-specified tickets,
Haiku for docs drafting; frontier reasoning for QA verdicts, design judgment
and ambiguity. These are cost-routing defaults, not permanent model ownership
of a repo. Check current available capabilities and budget when switching tools.

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
- **Bound visual evidence, do not skip required review.** The earlier blanket
  "no screenshots-into-model" recommendation is superseded for visual tickets
  by the 2026-09-19 `skills/agent-fanout` rule: real-speed recording and a
  supervisor-reviewed contact sheet. Keep captures targeted; snapshot/a11y
  tests supplement that review rather than replace it. Do not claim savings
  from omitting a required visual gate.
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

## Rate limits: what is actually enforced (verified 2026-09-26)

The old "1.5M tokens per 5-hour window" figure here was an assumption; the
dashboard measured a single window at 98M that completed uncut. Do not plan
against 1.5M. The real structure, from Anthropic's help center and the
provider's own usage endpoint:

- **One weekly budget shared by every model**, resetting at a fixed time
  assigned to the account. Bilal's resets **Friday 9:59 PM Eastern**. That is
  why the wall lands on Wednesday after a heavy Thursday/Friday.
- **Fable is capped at 50% of that weekly budget.** Not an extra allowance:
  the same pool, half of it. Bilal's default model is Fable 5.1 as of
  2026-09-25, so routine sessions eat the Fable half unless routed elsewhere.
- **A rolling 5-hour session limit** sits underneath, also shared.
- Extra usage is OFF (out of credits): a full window is a hard stop.
- Codex is a separate pool and reports its own weekly percent.

**Read, don't estimate.** `bamware-web` `/admin/ai-spend` shows the three
meters live (session, weekly, Fable share) with reset countdowns, from the
endpoint Claude Code's own `/usage` uses. A 10-minute sampler on omarchy
(`scripts/systemd/ai-quota-sample.timer`) logs percent against tokens counted
in the same window; once the meter has moved between samples the dashboard
shows **tokens per 1%** and **tokens left**, which is the number to budget
tickets against. Until then, the largest completed window is the floor.

Measured mix (2026-09-18 to 09-26, 332M tokens): Opus 5 83%, Fable 5%,
Sonnet/Haiku **0%**. The cheap-model routing this doc assumes is not happening
yet; that is the next lever (`docs/model-routing.md` when it exists).

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
