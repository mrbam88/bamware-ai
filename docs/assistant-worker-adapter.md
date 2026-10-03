# Existing overnight worker adapter

Draft next slice of #79. Code exists; no production dispatch is enabled or wired.
It reuses the server's existing overnight runner rather than creating an agent
runtime. The website/Discord blocker loop remains a separate coordinator.

## Data flow and state

The runner owns batch.json, launch.json, pickup.json and status.json under its
existing state directory. Read-only receipt inspection validates batch hashes,
unit/task identity and recorded result state; it never reads task logs/prompts or
claims that a recorded PID is still running. An authenticated receipt endpoint
exposes bounded safe summaries, not task commands.

Optional dispatch requires an explicitly enabled factory, an authorized manifest
hash, exact task IDs, scope and revision. It adds a unique coordinator request
marker to the manifest and durably saves launch intent before invoking the runner.
A timeout or crash leaves an ambiguous intent. Later reconciliation only looks for
a matching receipt; it never launches a second copy. Multiple matching receipts
are ambiguous, not success. Authorization revision is recorded provenance; actual
repository/code correctness still needs task verification and separate review.

A result probe requires matching task, manifest and authorization revision plus a
fresh finished result. It reports the runner's verification-command outcome, not
independent product QA. X1 AWS/Docker blockers cannot be resolved by this probe.

## Verification and rollout

Fixture tests cover disabled dispatch, scope/hash mismatch, unique intent,
restart/ambiguous receipts, source identity and freshness. No model invocation,
new paid service, credential transfer or live launch was performed.

Production currently runs the bounded owner-blocker scheduler documented in
[chief-of-staff-runtime.md](chief-of-staff-runtime.md). This adapter
still needs explicit composition with registered checks/resume hooks and an
approved real task before end-to-end worker pickup/resumption can be claimed.
Do not erase an ambiguous intent to retry; reconcile its receipt or record an
operator decision. Preserve intent/receipt state across service rollback/restart.
