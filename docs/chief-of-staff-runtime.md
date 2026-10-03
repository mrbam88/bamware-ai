# Chief of Staff server reconciliation — first slice (#79)

The Assistant service owns a deterministic, recurring owner-blocker sweep independent of any chat. Opt in with `ASSISTANT_WEB_OWNER_BLOCKERS=1`. It scans registered records every minute and rechecks due blockers every five minutes. Durable state lives in `~/.local/state/bamware/owner-blockers`; `.coordinator.json` records sweep coverage/time/failures. GET /api/decisions exposes coordinator and per-card ledger status after owner authentication.

This is NOT a full project/board coordinator. No live resolution probes or engineering worker adapters are registered in the first deployment. The AWS and Docker blockers originate on X1, which this server cannot verify. They explicitly report source unavailable; clicking a response is not resolution, pickup or permission expansion. Independent engineering work remains managed by its existing workers.

## Registration and transitions

An authorized coordinator atomically writes `<id>.json` with `id`, `status: waiting_for_owner`, `observer`, `checkedAt`, `ownerAction`, `completion`, and a validated Decisions `candidate` for new IDs. Existing static IDs reuse their candidate. New candidate IDs must match filenames and candidate IDs. No credentials belong in this ledger. The candidate supplies affected work, source, urgency and discuss/defer options. The website reads the durable card before notification is attempted.

Existing legacy `notification` receipts are adopted without reposting. Each waiting/resolved transition has its own receipt, intent and at most three retries for explicit request rejection. Ambiguous network delivery or interrupted sends stay unknown for inspection, never automatic resend. No phone push delivery is claimed. Defer persists paused; Reject persists cancelled; Discuss requests another source check. Neither can launch engineering work. Concurrent ledger changes interrupt reconciliation rather than overwrite owner action.

A future registered resolution probe must return evidence before the card becomes resolved. Resume requires a registered adapter and recorded scope/revision. Intent is durable before dispatch; ambiguous pickup is recovered via receipt lookup only. With no adapter, resolved records stay resume pending. Such adapters still require source and authorization checks; the registry is an extension seam, not shipped runtime capability.

## Validation and limitations

125 tests pass, including restart receipt adoption, concurrent pause, source failure, bounded retry, ambiguous-send no replay, scheduler activity without requests, dispatch-intent lookup and preventing legacy Hermes checks from duplicating owner-blocker alerts. Option/action compatibility now rejects approve-on-discuss. Browser Defer persists paused; mobile layout fits390px. These tests use fake check/worker hooks. They do not establish actual engineering pickup or resumption.

Deployment uses existing assistant-web.service and release branch worktree-assistant-web-slice; no new infrastructure, model calls or paid service. #79 remains open for real sources, worker pickup/resumption, board coverage and chat-close end-to-end evidence.

## Release evidence — 2026-10-03

PR #86 deployed as5e44a0b on the existing server rail; rollback baseline2dfece6. Owner-blocker opt-in enabled. Authenticated live Decisions returned200 with both AWS operator-access and Docker integration-runtime blockers. Docker notification delivered and read back once; the preexisting AWS notification receipt was preserved. Actual service restart recovered both ledgers without replaying notifications. Scheduler is deterministic infrastructure, not a Hermes worker or conversational agent.

After restart, the durable sweep timestamp advanced from02:38:56Z to02:39:56Z with no API-triggered sweep; both notification receipts remained unchanged (Docker attempts1). Closing the originating conversation and actual worker pickup/resumption have not been verified; those remain #79 acceptance gaps.
