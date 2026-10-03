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
| `GET /api/rate-limits[?mode=demo]` | cookie | Live Claude sample feed, X1 Codex events, and independent server Hermes/OpenCode OpenAI usage readings. Windows carry harness/machine/account provenance and accessible visual meters; additive `coverage` lists server capability gaps and observed credit controls. Proven shared account/scope windows merge; unknown identity never merges or adds capacity. Missing capacity stays unknown. Demo fixtures are isolated and always synthetic. See feeds below. |
| `GET /api/work-usage[?mode=demo]` | cookie | Work/agents analytics (#76): safe self-correlation plus the sanitized overnight metadata export (not continuous fleet ingestion). Project/ticket usage, unallocated bucket, heartbeat freshness, timing and outcomes retain unknowns. Demo fixtures remain isolated and synthetic. Override the overnight metadata path with `ASSISTANT_WEB_OVERNIGHT_USAGE_FILE`. |
| `GET /api/decisions[?mode=demo]` | cookie | Command Center Decisions deck (bamware-ai#78): a small explicit, hand-curated set of founder-level decision candidates (`lib/providers/decision-candidates.mjs`), each merged with any durable response on file. Default `mode=live` serves 3 real candidates grounded in already-verified repo facts (issue #77, and the Langfuse/Tailscale blockers documented in `docs/assistant-website.md`) — never an extraction over every open issue. `mode=demo` serves one clearly `source.kind:"synthetic"` fixture decision for previewing the full lifecycle. |
| `POST /api/decisions/:id/respond[?mode=demo]` `{action, selectedOptionId?, note?, candidateVersion}` | cookie | Records a durable, versioned response (`approve｜reject｜discuss｜defer`) to a decision in a file-backed store (`~/.config/bamware/assistant-web-decisions*.json`, path overridable via `ASSISTANT_WEB_DECISIONS_FILE`/`_DEMO_FILE`). `candidateVersion` must match the current candidate or the call is `409 stale_decision`. Only `approve` attempts a handoff; in `mode=live` there is no confirmed worker interface, so it always and honestly records `handoff.status:"handoff_pending"` — never a fabricated pickup. Resubmitting an identical response is idempotent (`duplicate:true`, no second handoff dispatch); submitting a different action is a legitimate reconsideration. `mode=demo` can also dispatch to a fixture worker (`simulateWorker:"unavailable"` or the default accepting fixture) to prove `pickup_confirmed`/`completed` exist as real, reachable states — synthetic only. |
| `POST /api/decisions/:id/handoff/refresh[?mode=demo]` | cookie | Re-checks a `pickup_confirmed` handoff against the worker (fixture-only in `mode=demo`; a no-op in `mode=live` since no worker is wired). Never self-promotes a status without worker evidence. |
| `POST /api/chat` `{text, sessionId?}` | cookie | runs one Hermes turn → `{reply, sessionId, requestId, elapsedMs, trace}` |
| `GET /api/sessions/:id/export` | cookie | `hermes sessions export --format jsonl -` (download) |
| `DELETE /api/sessions/:id` | cookie | `hermes sessions delete --yes` |

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
cd services/assistant-web && npm test      # auth, contracts, quota dedup, meter semantics, usage and decisions
python3 scripts/test_collect_server_quota.py
python3 scripts/test_export_codex_quota.py
# Existing credentials remain in memory; no model call, transcript or password output:
node scripts/verify-quota.mjs --local       # this checkout on loopback
node scripts/verify-quota.mjs               # configured production endpoint
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

Live Agents usage now includes an allowlisted metadata export of the four overnight implementation/QA runs, via `scripts/export-overnight-metrics.py`. It includes runtime-reported token totals and list-price cost estimates, never conversation content. This is a recorded batch snapshot, not continuous fleet ingestion. Active versus waiting time remains unknown where unavailable. Provider quota is connected through the feeds below. Obsolete Langfuse/HTTPS decision cards were removed; the backlog-planning decision remains. Real decision-card worker dispatch is still pending; #81's direct worker pickup does not change that flow or implement recurring sweep #79.

### Claude quota feed
`ASSISTANT_WEB_QUOTA_SAMPLES_FILE` points to the existing server collector's
sanitized JSONL samples (`at`, `meters[].kind/percent/resetsAt`). The private
Assistant reads only the last 64 KiB; it does not read provider credentials or
transcripts. Provider percentages remain separate from token totals. Samples
older than 15 minutes are stale; after a reported reset the old percentage is
hidden until a new sample arrives. The existing collector runs every ten minutes.
A missing/malformed sample remains unavailable. Codex uses a separate sanitized snapshot adapter. The upstream collector uses an undocumented Claude usage endpoint;
endpoint/schema changes must be treated as missing data, never an inferred cap.

### Codex quota feed
The X1 runs `scripts/export-codex-quota.py` via the supplied user systemd timer
every two minutes. It exports only provider quota percentages, window lengths,
reset times and original event timestamps from recent Codex events to
`~/.local/state/bamware/codex-quota.json` on the server over existing SSH.
No credentials, prompts, responses, file paths or token transcripts are copied.
SSH failure leaves the old timestamp intact; after 15 minutes the UI marks it
stale. Laptop sleep/offline or expired SSH authentication therefore cannot
masquerade as a fresh reading. This reads the most recent provider event; it
does not spend tokens to force a quota update. Override server snapshot path
with `ASSISTANT_WEB_CODEX_QUOTA_FILE`.

### Independent server coverage (#81)

`scripts/collect-server-quota.py` reads existing default-profile Hermes and
OpenCode OpenAI OAuth capabilities in memory and GETs the same usage endpoint
used by installed Hermes `agent/account_usage.py`. No model call, OAuth refresh,
provider switch, token copying, credit redemption or new grant occurs. Requests
are pinned to the provider host and redirects are refused. It never reads
transcripts; OpenCode inventory selects only provider IDs from SQLite metadata.

The collector writes only allowlisted percentages, scopes, resets, credit
booleans/numbers, observation times and opaque account aliases to
`~/.local/state/bamware/server-quota.json` (atomic, mode 0600). The web process
reads that sanitized snapshot, not provider auth. Override with
`ASSISTANT_WEB_SERVER_QUOTA_FILE`. Both harnesses' account identifiers matched
locally during #81; aliases are a domain-separated SHA-256 digest, never an
email, name or raw identifier. Distinct/unknown accounts stay separate. An
ambiguous Hermes credential pool is not silently resolved to another account.

Known account + provider + quota scope + source kind identifies one meter. The
newest reading wins, all observation sources remain attached, percentages are
never summed. The X1 feed does not yet carry identity evidence: it is explicitly
unmatched and potentially overlapping, not an extra allowance. OpenCode-hosted
provider usage is observed in metadata but has no authoritative quota collector.
Credit/spend fields unavailable from a source remain unknown (including Claude
credit controls absent from the existing sample schema); token usage is not a cap.

Meters show used/remaining, warning/exhausted labels, reset timezone and age.
Stale numbers are labelled historical; a passed reset hides the old percentage.
Unknowns render a dashed placeholder with no numeric ARIA meter. The browser
refreshes visible widgets every minute; it does not call a provider on refresh.

Reuse the existing ten-minute `ai-quota-sample.timer` on the server, with a
drop-in that collects OpenAI first so Claude ingestion failures cannot block it:

```sh
install -Dm644 services/assistant-web/systemd/ai-quota-sample-server.conf \
  ~/.config/systemd/user/ai-quota-sample.service.d/server-quota.conf
systemctl --user daemon-reload
systemctl --user start ai-quota-sample.service
```

The template intentionally targets the existing `~/srv/bamware-ai` production
checkout. Fetch/reconcile `worktree-assistant-web-slice` before moving that
checkout, never copy a worktree over it. Restart `assistant-web`, then run the
readback verifier above. Roll back code with a revert on the release branch;
remove only `server-quota.conf` and reload systemd to detach the new collection.
The old Claude collector, X1 timer and other services remain untouched.

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
