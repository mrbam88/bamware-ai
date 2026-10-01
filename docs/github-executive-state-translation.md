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
