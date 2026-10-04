# Three on-demand checkpoints — trial

**Factory default rhythm (2026-10-04):** rolling 24h sprints — see
`docs/factory-cadence.md`. Prepaid capacity steer: `docs/cfo-capacity-analytics.md`.
These checkpoints remain the CEO on-demand review lenses; they do not pause
eligible execution.

Founder-approved trial starts **2026-10-03**, America/New_York (local date was
2026-10-02 when “tomorrow” was agreed). This is an informal iteration rhythm,
not meetings or engineering work hours. All checkpoints happen when the founder
asks: no reminders, fixed clock times, calendar invites or new timer/Discord
jobs. Existing unrelated digests are unchanged. Urgent real owner blockers still
follow the separate Command Center + deduplicated Discord policy.

## Checkpoint templates

- **Morning review + plan:** prior batch completed/blocked/carryover with evidence;
  decisions needing CEO judgment; outcomes and priorities for the next batch.
- **Afternoon inspect + adjust:** actual pickup/progress and costs versus plan;
  blockers/dependencies, changed assumptions and authorized adjustments.
- **Evening review + handoff:** completed/blocked/carryover, lessons and recorded
  evidence; agree eligible overnight scope, owners, limits and next review.

Chief of Staff prepares and reviews with the Stakeholder / CEO. Scrum Master
owns batch follow-through and evidence. The CEO chooses outcomes/priorities and
reserved decisions, not routine task chasing. Record outcome, scope, owner,
dependencies, authority/spend bounds, source revisions, next action and review
checkpoint. Keep a completed milestone distinct from a completed issue.

The private continuity record is
`~/.local/state/bamware/batches/2026-10-03.json` on omarchy for this first trial;
subsequent days use the same date-keyed pattern. Start from
[the template](../templates/batches/on-demand-day.json). Checkpoints append
source-linked results and decisions; preserve prior history and carryover.
Empty records mean awaiting discussion, not a planned or authorized batch.
The first trial record is a manually initialized state artifact, not an automatic
checkpoint service or model scheduler. The conversation/role must update it
when a checkpoint actually occurs. No private personal detail belongs in this
public template or in engineering assignments.

## Continuous eligible work, bounded cost

CEO attention follows these checkpoints; eligible execution need not wait for
one. Backlog is not an approved ready queue. The dispatch predicate is:
**ready + authorized scope + dependencies met + verified budget/quota capacity**.
Dispatch a bounded worker only when all are evidenced; respect concurrency and
existing pickup to prevent duplicate workers. Idle with no eligible work. Record
budget/quota/blocker pauses and resume only after verified capacity/reset or
clearance, without inventing funds or permission.

This is the intended operating policy, not unlimited spend authorization or proof
of an implemented continuous dispatcher. Before unattended paid operation, agree
per-batch/day ceilings and concurrency policy using observed cost/usage. Unknown
limits are not unlimited. Current trial limits remain unset; no new model/paid
worker launch is authorized by the cadence. Use cheap deterministic checks for
monitoring and model calls only for judgment within approved bounds.

## Verification and recovery

Confirm a checkpoint by its actual time, source evidence and recorded decisions;
never infer it from a timer or reminder. Validate the JSON before writing, write
atomically, and retain existing record/history on conflict. Reopen the same
record after a chat or service restart. No scheduled reminder delivery is claimed.
Related work: #77 batch planning, #79 resident Scrum Master, existing overnight
runner. Live worker pickup, approved budgets and resume are separate evidence.
