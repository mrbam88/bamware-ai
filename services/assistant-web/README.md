# assistant-web — website for the Bamware assistant (real Hermes)

Owner-only website that sends text (and browser voice) to the **installed
Hermes runtime** on `omarchy`. Epic: mrbam88/bamware-ai#62. Audit: #63.
Canonical findings, gates and plan: `docs/assistant-website.md`.

Node ≥ 22.18. Install the isolated admin dependencies with `npm run setup:admin`
before startup; the deploy script includes this step. Each chat turn runs

```sh
hermes chat -Q -q "<text>" [--resume <session_id>]
```

inside the bamware-ai checkout, so a web turn uses the same `~/.hermes/state.db`,
the same `pre_llm_call` context hook, the same skills and the same plugins
(Langfuse) as the Discord bot and the CLI. Nothing is restarted or duplicated.

## Run

```sh
# 1. Secrets, local only, never committed (chmod 600):
#    ~/.config/bamware/assistant-web.env
#      ASSISTANT_WEB_PASSWORD=<12+ chars>
#      ASSISTANT_WEB_SESSION_SECRET=$(openssl rand -hex 32)
#      ASSISTANT_WEB_HOST=127.0.0.1      # or the Tailscale IP for phone access
#      ASSISTANT_WEB_PORT=8765
# 2. From the repo:
cd services/assistant-web && node server.mjs
# 3. Open http://127.0.0.1:8765 and sign in with the password.
```

Other variables: `HERMES_BIN` (default `hermes`), `HERMES_CWD` (default: this
repo root), `HERMES_TIMEOUT_MS` (180000), `HERMES_HOME` (`~/.hermes`),
`ASSISTANT_WEB_SECURE_COOKIES=1` when behind HTTPS, `ASSISTANT_WEB_MAX_QUEUE` (3).
Environment variables override the env file.

Service unit (already deployed on the server; existing-service updates authorized in #81):
`scripts/systemd/assistant-web.service`.

## API

Private admin migration (#82): owner-gated `/admin`, existing backend adapters,
preserved PR43 spend and PR45 ingest/CSV, per-capability cutover and known gaps
are documented in [admin migration](../../docs/admin-migration.md). Keep the
locked PR43 collector worktree: its existing data/capabilities are read in place.

| Route | Auth | What |
|---|---|---|
| `GET /api/health` | no | `{ok, queueDepth}` |
| `POST /api/login` `{password}` | no | sets `aw_session` cookie (HttpOnly, SameSite=Strict, 7 days); 5 failures / 15 min per client → 429 |
| `POST /api/logout` | no | clears cookie |
| `GET /api/me` | cookie | Hermes bin/cwd and Langfuse **presence booleans** (never values) |
| `GET /api/agents` | cookie | Agents tab V3: machine state, needs-you, executor work, CFO capacity, board (`docs/agents-tab.md`). |
| `GET /api/decisions[?mode=demo]` | cookie | Command Center Decisions deck (bamware-ai#78): a small explicit, hand-curated set of founder-level decision candidates (`lib/providers/decision-candidates.mjs`), each merged with any durable response on file. Default `mode=live` serves active, source-backed asks plus read-only `history`; reviewed retirements live in `lib/providers/decision-resolutions.mjs` and verified dynamic blocker resolutions come from their durable ledgers. It never treats every open issue as a decision or every closed parent as proof of resolution. `mode=demo` serves one clearly `source.kind:"synthetic"` fixture decision for previewing the full lifecycle. |
| `POST /api/decisions/:id/respond[?mode=demo]` `{action, selectedOptionId?, note?, candidateVersion}` | cookie | Records a durable, versioned response (`approve｜reject｜discuss｜defer`) to a decision in a file-backed store (`~/.config/bamware/assistant-web-decisions*.json`, path overridable via `ASSISTANT_WEB_DECISIONS_FILE`/`_DEMO_FILE`). `candidateVersion` must match the current candidate or the call is `409 stale_decision`. Only `approve` attempts a handoff; in `mode=live` there is no confirmed worker interface, so it always and honestly records `handoff.status:"handoff_pending"` — never a fabricated pickup. Resubmitting an identical response is idempotent (`duplicate:true`, no second handoff dispatch); submitting a different action is a legitimate reconsideration. `mode=demo` can also dispatch to a fixture worker (`simulateWorker:"unavailable"` or the default accepting fixture) to prove `pickup_confirmed`/`completed` exist as real, reachable states — synthetic only. |
| `POST /api/decisions/:id/handoff/refresh[?mode=demo]` | cookie | Re-checks a `pickup_confirmed` handoff against the worker (fixture-only in `mode=demo`; a no-op in `mode=live` since no worker is wired). Never self-promotes a status without worker evidence. |
| `POST /api/chat` `{text, sessionId?}` | cookie | runs one Hermes turn → `{reply, sessionId, requestId, elapsedMs, trace}` |
| `GET /api/sessions/:id/export` | cookie | `hermes sessions export --format jsonl -` (download) |
| `DELETE /api/sessions/:id` | cookie | `hermes sessions delete --yes` |

### Source reconciliation and history (#141)

`GET /api/decisions` returns active `decisions` and an additive `history` array.
The collapsed History section is read-only. Existing response files are not
rewritten; response and handoff evidence stay separate from source resolution.
Stale browser actions against retired asks return `409 retired_decision`.

To retire a curated ask, verify the exact source (not just a closed parent), then
add an ID-keyed record to `lib/providers/decision-resolutions.mjs` with status,
plain-English reason, verification time and evidence link. Keep the original
candidate and tombstone: refresh, restart and a version bump cannot resurrect
that ask. A genuinely new ask needs a new ID. This is reviewed reconciliation,
not automatic interpretation of arbitrary GitHub prose. Newly resolved dynamic
blockers also move to history when their durable ledger has matching ID/version,
`resolvedAt` and `resolutionEvidence.ref`. Unavailable probes, owner responses,
approvals and parent closure alone never retire an ask. Keep ledger files for history.

The October 7 reconciliation retires the superseded X1 AWS-login request and
research handoff, and the merged/green push CI permission fix. It does **not**
claim AWS configuration, email delivery, Docker integration or publishing is done.
The carousel approval and remaining unverified work stay visible.

Read-only deployed verification (existing credentials stay in process):
`ASSISTANT_VERIFY_URL=https://omarchy.tailb7fa1e.ts.net node scripts/verify-decisions.mjs`.
Checks authenticated active/history IDs, 401 protection, unchanged response store
and served history UI. No chat, model, Discord operation or decision submission.

### Decision card copy rules (bamware-ai#141)

Decision candidates in `lib/providers/decision-candidates.mjs` are written for
a CEO scanning the Command Center on a phone, not for an engineer re-deriving
context:

- `title`: the decision in plain English.
- `summary`: one plain-English sentence, no jargon, no ids/ticket numbers —
  this is what renders on the card face under the title.
- `blockedWork`: short bullets, ~50 words total, plain language.
- `context`: the full source-grounded paragraph (issue refs, verification
  detail, etc.) still lives here for audit/trust, but the UI tucks it behind
  a collapsed "Full details" control instead of showing it by default.

`summary` is optional on the candidate shape (`assertValidCandidate` only
validates it when present) so older dynamically-created ledger candidates
keep rendering; add one on every new hand-curated candidate.

`sessionId` is the Hermes session id; send it back to continue the same
conversation. Langfuse groups traces under that same id (trace name
"Hermes turn", environment tag `assistant-web`), so `trace.langfuseSessionId`
is the correlation key.

Runs are serialised (the Hermes CLI claims one active `cli` session per host).
Server logs are JSON lines with request ids, timings and byte counts, never
message content.

## Voice

Browser-side only, no new services: Web Speech API for speech-to-text,
`speechSynthesis` for the reply. Talking while the assistant speaks cancels the
speech (barge-in). The mic needs a **secure context** (HTTPS or `localhost`);
the button explains when it is unavailable.

- Laptop with no HTTPS: `ssh -L 8765:127.0.0.1:8765 omarchy`, then open
  `http://localhost:8765` (localhost is a secure context).
- iPhone: needs HTTPS on the tailnet (`tailscale serve`), a network-config gate.

## Test

```sh
cd services/assistant-web && npm test      # auth, contracts, usage and decisions
python3 scripts/test_collect_server_quota.py
python3 scripts/test_export_codex_quota.py
# Existing credentials remain in memory; no model call, transcript or password output:
node scripts/verify-admin.mjs               # read-only production verification
```

Mocked tests are not integration proof. The real check is one authenticated
`POST /api/chat` against the installed Hermes (evidence in #63).

## Gates (Bilal)

- New services, network bindings, accounts and spend remain gated. The existing
  assistant-web service and quota timer are already enabled; #81 authorizes
  reversible updates on that same deployment, not new services.
- Enabling Hermes' built-in API server (`API_SERVER_KEY`, gateway restart):
  the streaming/SSE upgrade path, see `docs/assistant-website.md`.

## Recovery release (2026-10-02)

The Agents tab reads executor runs, CFO capacity and owner blockers directly; see `docs/agents-tab.md`.

### Quota feeds removed (bamware-ai#115)

The per-provider meter widget described below, its API endpoint and its
contract/adapter modules were deleted: nothing rendered them after Agents tab
V3 shipped, and they duplicated the CFO's capacity calculation
(`services/cfo`, `cfo/capacity.json`). `scripts/collect-server-quota.py` is
kept because `services/cfo/burn_alert.py` still reads its `server-quota.json`
output directly; assistant-web itself no longer reads it. See `services/cfo/README.md`
for the current, single capacity calculation.

#### Verified release evidence (2026-10-02, #81)

- Implementation `538c04b` published to `feat/quota-coverage-81` and
  `worktree-assistant-web-slice`; production fast-forwarded after fetch/rebase.
- `assistant-web` restarted and is active. Existing quota service ran its new
  pre-step with exit 0; existing ten-minute timer still active. No new scheduler.
- 92/92 Node tests, 8/8 server-collector Python tests, 1/1 X1-exporter test;
  `node --check public/app.js`, context check and diff check passed.
- Real production verifier: health 200; unauthenticated and wrong-password
  401; authenticated readback 200; module/meter assets and demo isolation pass.
  Claude, X1 and independent server observations read back fresh. Missing
  secondary allowance remains unknown; hosted OpenCode provider remains unsupported.
- Optional visual browser QA **not verified**: direct Chromium CDP handshakes
  failed/pipe startup timed out; the browser tool independently reported
  `CDP WebSocket connect failed: ... Handshake not finished`. No screenshot or
  visual pass is claimed. Meter DOM/ARIA semantics are regression-tested.
- Worker-written pickup/result receipts live under the private local state
  directory `~/.local/state/bamware/chief-of-staff/81/`; public evidence is in
  [issue #81](https://github.com/mrbam88/bamware-ai/issues/81). This is a bounded
  direct assignment, not evidence that recurring Chief of Staff sweep #79 runs.

### Automatic chief-of-staff checks

Each saved live card response queues a durable coordination check, keyed by
candidate version, response timestamp and signature. All four actions trigger a
check; duplicates reuse the receipt. Hermes runs through the existing serialized
runner with no toolset and a one-turn bound. The input is the card and recorded
response; the check does not claim fresh external-source inspection or dispatch.
Its completion is separate from the downstream worker handoff.

`handoffCheck` on live Decisions responses exposes queued/running/completed/failed/
interrupted/superseded state, summary, session ID and Discord delivery receipt.
Jobs live in `~/.local/state/bamware/handoff-checks`. Queued jobs recover on restart;
running jobs become interrupted rather than silently rerun. New responses supersede
older in-flight results. Discord send/read-back failures are visible on the card;
ambiguous sends are not retried automatically. Phone push receipt is not observable.
Set `ASSISTANT_WEB_HANDOFF_CHECKS=0` to disable; custom storage can use
`ASSISTANT_WEB_HANDOFF_CHECKS_DIR`. The existing app service owns execution; no
second cron or bot instance is introduced. Refresh the deck to see asynchronous
results. An agent recommendation is not confirmed worker pickup.
