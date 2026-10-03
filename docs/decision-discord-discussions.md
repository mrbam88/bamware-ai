# Decision discussion in Discord (#92)

Discord is the conversation surface; Decisions is the visibility and explicit
approval surface. Chat navigation stays hidden under its separate readiness gate.
The existing Hermes gateway is the sole conversational responder. This adapter
sends context and reads mapped thread messages; it never invokes a model, resumes
a gateway session, dispatches work or treats discussion as approval.

## Flow and contract

Authenticated `POST /api/decisions/:id/discussion` with `candidateVersion` creates
or reopens one thread. The generic Discuss response also opens it after recording
the response. Cards retain a separate reopen/repair control even after a response.
A canonical HTTPS backlink selects the exact decision; phone/laptop access still
requires membership of the existing Tailscale network. Discord links open the
same thread. Existing private channel membership is unchanged; no new access is
granted. Posts suppress all mentions.

`POST /api/decisions/:id/discussion/sync` is also owner-authenticated and version
checked. It reads only the recorded thread. A reply from the configured bot after
the configured owner's message is reply evidence, not worker pickup. Structured
`bamware-decision` summaries must match exact decision/version/context fingerprint
and owner message. They appear as source-linked proposals only, never replace the
candidate or update approval. Apply proposed source changes through the existing
source/version workflow before explicitly approving changed work. A revision
resets current pickup, owner cursor and latest summary; historical summaries stay
in the private ledger with original provenance.

## State and duplicate prevention

Opt in with `ASSISTANT_WEB_DISCUSSIONS=1`. Private state defaults to
`~/.local/state/bamware/decision-discussions` (override
`ASSISTANT_WEB_DISCUSSIONS_DIR`); directory mode700, state/lock files mode600.
Files use a hash of the decision ID and atomic rename. State records decision and
source version/fingerprint, proposal, channel/guild/thread/bot/owner IDs, message
operation intents and receipts, sync cursor, reply evidence and summary history.

An exclusive per-decision lock serializes network mutations across processes.
No timer steals it: slow networking does not prove a writer is dead. Every send
persists intent before calling Discord. A known rejection is retryable; a timeout
or ambiguous result is reconciled by exact marker, channel and bot author. Missing
ambiguous messages never auto-replay. Discord nonce enforcement is additional
short-term protection, not the durability guarantee. Thread creation from a
source message uses that message's ID, preserving one mapping. Message context
is split into bounded chunks; the gateway also has the read-only context bridge
below, avoiding reliance on thread history backfill to recover every chunk.

## Gateway context and operational repair

Installed Hermes reports version 0.19.0; inspected terminal environment source
SHA256 `92384375cea9f015bbdd9dc020e637c1498511e1a69d0b19104463b664d716ec`.
Recheck this contract after Hermes upgrades. The Discord adapter was inspected read-only: owner admission
includes thread parent, channel prompts inherit from parent, own bot messages
are ignored, and history backfill is thread-scoped. These facts do not prove live
pickup. The updated `bamware-assistant` skill directs a mapped discussion to
`node ~/srv/bamware-ai/scripts/decision-discussion-context.mjs` (no arguments or
environment overrides).
The script reads the unique mapping and proposal; it never reads credentials or
writes messages. The bridge requires task-local HERMES_SESSION_PLATFORM/THREAD_ID/USER_ID/MESSAGE_ID
from the installed gateway terminal subprocess environment. Installed
`tools/environments/local.py::_inject_session_context_env` supplies these from
ContextVars and strips unbound values to prevent cross-session leaks. No new
Discord tools or permissions are enabled. The live model-visible IDs block is
currently disabled; this terminal mechanism avoids depending on it. Wrong owner,
non-Discord, stale turns and model-supplied arguments fail closed.
The gateway's installed skill mapping must be checked before enabling live.

For an interrupted lock: stop the Assistant service and confirm the recorded PID
and all other writers are stopped; inspect the corresponding operation receipts
and the existing Discord thread, then remove only that decision's `.lock` file
and restart. Reopen performs receipt/marker recovery. Never remove the ledger or
clear a sending intent just to make a retry succeed. If marker recovery cannot
prove what happened, leave repair_required until the operator reconciles the
message receipt. Archived unlocked threads reopen in place. Locked, deleted,
foreign or inaccessible threads require operator repair; no silent replacement.
A sync window of 100 messages fails closed without advancing its cursor, requiring
operator reconciliation rather than skipping earlier context.

Existing server identity capability files are used in memory; no credential
values belong in logs, issues, fixtures or this public repository. Failure text
from the transport is sanitized. Do not export private discussion transcripts.

## Evidence and remaining gates

156 local tests pass, including real HTTP authorization/version/no-dispatch,
concurrent requests, interrupted locks, restart/adoption, ambiguous missing sends,
archived/locked mapping, mention suppression, scoped provenance and revision
isolation. Tests use fake Discord transport; no real messages are sent by tests.

Not yet enabled/deployed. Real thread creation, owner reply → gateway pickup,
source-linked summary writeback, restart continuation and laptop/phone interaction
must be verified separately before claiming end-to-end completion. A founder
reply cannot be fabricated. Role instructions are not cognitive-worker proof.

Protocol references: Discord's official message create contract documents nonce
uniqueness only over the past few minutes; its thread-from-message contract uses
the source message ID as the thread ID:
https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx
https://github.com/discord/discord-api-docs/blob/main/developers/resources/channel.mdx

Local browser fixture verification: authenticated desktop and 390px cards show a
ready thread link, reopen/repair and refresh controls. Summary/proposed revision
is explicitly synthetic in the preview and marked not approved. No horizontal
overflow or captured browser errors; Chat navigation remains absent. Keyboard
Enter activates discussion opening. This is local transport-fixture UI evidence,
not a live Discord conversation or physical-phone test.
