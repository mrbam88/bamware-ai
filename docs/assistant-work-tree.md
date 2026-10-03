# Assistant work tree — first slice

Founder direction, October 2, 2026: Bamware Assistant is the home base for directing, supervising and joining work. The founder should not have to hold the project/task/worker hierarchy in his head. Keep multiple views over shared evidence: retain the Agents list and add a collapsible two-dimensional work tree. Optimize for recognizing where attention belongs, not visual spectacle.

## Implemented scope

Ticket #83 adds an optional `workTree` projection to the authenticated work-usage snapshot. It groups known project/repo membership, tasks and recorded attempts, preserving explicit unknown/unallocated observations. The interface uses native disclosure controls, List/Work tree switching, source details and expansion preservation on refresh. Existing response fields remain unchanged.

It does not establish parent-agent delegation, current ownership, live heartbeats or founder-decision links. Those relationships require authoritative source adapters. Conceptual roles must not be rendered as working agents. Voice integration and runtime control are separate slices.

Project rollups count tasks with unresolved **recorded signals**, not confirmed current blockers. The latest known pass supersedes an older failed attempt; conflicting or missing observation times produce uncertainty. Fetch time is never used as evidence of a running worker. Same-attempt model buckets are one run; the upstream deduplicator removes duplicate event readings.

## Validation and handoff

- Based on deployed server revision 5ba78cc; isolated branch feat/assistant-work-tree. The deployed Assistant code is on origin/worktree-assistant-web-slice, not current main; target that release branch for a focused review.
- 114 automated tests passed, including six new projection regressions. JavaScript syntax checks passed.
- Local authenticated browser inspected at 1280x900 and 390x844 using labeled demo data; tree renders without phone-width horizontal overflow. Programmatic DOM activation verified view switching and expansion retention after refresh. Browser CLI pointer actions intermittently no-oped; physical touch/pointer use remains unverified. No model invocation was made by the preview.
- No deployment or full fleet coverage claimed. Tree currently reflects the source coverage already available to the existing list.
- GitHub Projects updates blocked by missing project scopes. Ticket exists; runner pickup not claimed.

Next: review first slice, verify actual pointer/touch behavior and real server snapshot, then promote through existing release rail. Subsequent work should add explicit delegation and founder-decision links; only implement join/pause/redirect when a runtime can acknowledge those operations.
