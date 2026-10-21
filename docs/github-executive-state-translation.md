# GitHub to Executive State Translation

**Status:** Draft
**Date:** 2026-10-01
**Pilot project:** BrewDesk

GitHub remains the execution system of record. The Bamware control plane derives executive state from GitHub plus durable organizational context in `bamware-ai`.

## Translation Rules

### Outcome

Create or update an executive Outcome when one of these is true:

- A GitHub epic groups multiple related tickets.
- A milestone represents a meaningful product result.
- `bamware-ai` has an approved roadmap item that spans multiple tickets or repos.
- Cross-repo work clearly serves one business result.

Do not create one Outcome per issue.

### Blocker

Translate to a Blocker when:

- An issue is explicitly marked human-only.
- Work cannot continue until Bilal provides access, approval, credentials, capability, spend approval, store action, or another external dependency.
- A required dependency is open and prevents progress on the current Outcome.
- A failed gate blocks release or merge.

Blockers should name the blocked Outcome and the required action.

### Risk

Translate to a Risk when:

- An open issue describes regression, quality degradation, privacy/security exposure, migration risk, or a deadline threat.
- A critical dependency remains unresolved but does not yet stop all work.
- An epic has multiple unresolved prerequisites with sequencing risk.
- Recent regressions suggest an Outcome may miss expectations even though work can continue.

Risks do not automatically require Bilal.

### Candidate Decision

Create a candidate Decision only when:

- Existing policy cannot answer it.
- A human-only gate requires Bilal's judgment rather than a mechanical action.
- Cost, scope, architecture, privacy, launch, or product direction crosses delegated authority.
- Two viable paths have materially different consequences.
- A cross-project dependency requires prioritization.

Do not turn routine implementation choices into Decisions.

### Recent Meaningful Change

Include a merged PR or release when it:

- Completes or materially advances an Outcome.
- Changes user-visible behavior.
- Changes a cross-repo contract.
- Removes a blocker.
- Introduces or resolves a material risk.

Do not include every commit or maintenance PR.

### Project Health

Derive project health from the executive objects, not raw ticket count.

- `healthy`: no unresolved executive blocker; risks are contained.
- `at_risk`: work continues, but one or more material risks threaten an Outcome.
- `blocked`: at least one active Outcome cannot progress due to an executive or external dependency.
- `paused`: explicitly deferred by roadmap or policy.

### Needs Bilal

Set `needsBilal = true` only when there is at least one pending Decision or human-only Blocker requiring Bilal specifically.


## Executive Severity and Briefing Thresholds

The executive layer must optimize for attention, not completeness.

### Item classes

Every executive item must be classified as exactly one primary type:

- `decision`: Bilal must choose between materially different paths.
- `action`: Bilal must perform a concrete step, but judgment is minimal.
- `blocker`: an active Outcome cannot progress.
- `risk`: an active Outcome can progress, but success is threatened.
- `watch`: noteworthy signal with no current intervention required.
- `info`: meaningful change worth preserving in history, not briefing by default.

A human-only issue is not automatically a Decision. If Bilal simply needs to perform a known console/configuration step, classify it as an `action`.

### Severity

Use four severity levels:

- `S0` — immediate: active customer/security/privacy/release harm, destructive risk, or a hard deadline within 24 hours.
- `S1` — important: materially blocks an active Outcome or requires Bilal's judgment soon.
- `S2` — watch: material risk or action that matters, but work can continue.
- `S3` — background: useful context with no near-term executive intervention.

Severity describes executive urgency, not engineering difficulty.

### Escalation rules

An item reaches the default Chief of Staff briefing only when:

- it is an open `S0` or `S1` item; or
- it is an `S2` item whose state materially changed since the last briefing; or
- Bilal explicitly asked to watch that item.

`S3` items stay in project history and drill-down views.

### Briefing caps

Default morning/on-demand briefing:

- maximum **3 Needs You** items.
- maximum **3 Watchlist** items.
- maximum **3 Recent Changes** items.
- collapse the remainder into counts, e.g. "7 other items progressing normally."

If more than 3 S0/S1 items exist, rank by:

1. irreversible or safety/privacy impact.
2. deadline.
3. number of Outcomes blocked.
4. financial impact.
5. opportunity cost.

### Stability / anti-flapping

Do not repeatedly surface the same unchanged item.

- An unresolved item stays visible until acknowledged once.
- After acknowledgement, resurface only when severity increases, deadline approaches, evidence changes, or Bilal asks.
- Do not mark a project `at_risk` because of a single low-severity bug.
- Project health changes only from material Outcome-level state.

### Decision vs Action

Use this test:

```text
Does Bilal need to choose between materially different consequences?
  yes -> Decision

Does Bilal simply need to perform or authorize a known step?
  yes -> Action

Can the project team resolve it within delegated policy?
  yes -> keep below executive layer
```

### BrewDesk calibration

Using the 2026-10-01 pilot snapshot:

- Account-platform console/configuration work -> `action`, S1 while it blocks the active account rollout.
- Venue filtering regression -> `risk`, S1 if it materially affects live trust; otherwise S2.
- Map-pan performance regression -> `risk`, S2 unless evidence shows severe user impact.
- Database migration epic -> below executive briefing by default; escalate only hosting/spend/cutover/privacy decisions.
- Auth seeded-user repair -> engineering risk, S2 while remediation PR is active; no CEO attention by default.

A good default briefing should therefore contain roughly one Needs You item and one or two Watchlist items, not every open concern.

## BrewDesk Source Set

Initial ingestion sources:

- `mrbam88/bamware-brewdesk`
- `mrbam88/bamware-brewdesk-flutter`
- `mrbam88/bamware-venue-engine`
- `mrbam88/bamware-auth-service`
- `mrbam88/bamware-ios`
- `mrbam88/bamware-push-service`
- BrewDesk roadmap and architecture docs in `bamware-ai`

## Rule of Thumb

GitHub answers: **what is happening?**

`bamware-ai` answers: **why does it matter?**

The Chief of Staff answers: **what needs Bilal's attention?**
