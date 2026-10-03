# Execution activity evidence (#79)

Repository metadata, page fetch time, an open session, process existence and a finished attempt are not execution heartbeats. The Agents projection must never label them Active. Metadata without a session identity is not counted as an agent.

The additive `execution` envelope is version1, source `worker-lifecycle`, with explicit `status`, `phase`, `observedAt`, `leaseExpiresAt` and `pickupReceiptId`. Active requires a known session/provider/project/task, pickup, a working phase, no finished attempt, an observation not in the future and an unexpired lease bounded to120 seconds from observation. Conflicting same-time observations cannot activate. Expired execution evidence becomes stale; missing or invalid evidence stays unknown. Refreshing the website cannot renew a lease.

Known phases: coding, testing, researching, reviewing, tool-use. Known statuses: queued, working, blocked, review, done, failed. Only `state: active` with `executionStatus: working` may support a live working indicator; phase alone cannot. Source-observed time is distinct from collector fetch time. Synthetic demo receipts are explicitly fixture data.

## Source coverage discovered 2026-10-03

- Server overnight runner has pickup PID/task/batch hash and recorded task outcomes. These are durable execution receipts; they are not ongoing phase heartbeats.
- Server Hermes SQLite has session start/end and timestamped messages/tool calls. No reliable phase heartbeat contract was found. Message creation cannot establish continuing coding.
- Server Codex JSONL has task_started/task_complete/turn_aborted and tool events. Inspected recent server sessions were historical and complete. A started turn can be idle; it cannot by itself establish Coding.
- Session Codex work on X1 is not observed by the server. No automatic cross-machine collector or credential relocation was introduced.

No live phase producer is registered by this hotfix. Current live agents may therefore report unknown, and metadata-only rows disappear. This is a correction of false activity, not a claim that all workers are visible.

## Next source and incident contract

A bounded recorder around a genuinely authorized noninteractive tool can record pickup on spawn and phase activity from tool start/output events. A silent process must not renew execution evidence merely because its PID exists; it should age to unavailable. Completion ends activity. Do not launch billable model work as a telemetry test.

Critical errors require explicit source severity and durable occurrence identity, affected project/task/agent, failure/last occurrence and concrete next action. Generic nonzero exit, retry, stale observation and owner access blocker are not automatically critical. Acknowledgment is not source-confirmed recovery; critical state persists until a matching recovery event/evidence. No live structured critical producer has been established yet. UI and alert delivery must wait for that evidence contract rather than infer severity.

Hotfix release2ae7655 verified on live API and authenticated Chrome: four historical sessions unknown, zero active, metadata-only self row excluded. Tests134 full-suite and24 focused passed. The additive executionLeaseExpiresAt field exposes the validated active lease only, enabling client-side expiry without renewing evidence on refresh.
