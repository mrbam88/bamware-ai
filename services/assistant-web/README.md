# assistant-web — website for the Bamware assistant (real Hermes)

Owner-only website that sends text (and browser voice) to the **installed
Hermes runtime** on `omarchy`. Epic: mrbam88/bamware-ai#62. Audit: #63.
Canonical findings, gates and plan: `docs/assistant-website.md`.

Zero npm dependencies. Node ≥ 22. Each chat turn runs

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

Service unit (not enabled by agents; see gates below):
`scripts/systemd/assistant-web.service`.

## API

| Route | Auth | What |
|---|---|---|
| `GET /api/health` | no | `{ok, queueDepth}` |
| `POST /api/login` `{password}` | no | sets `aw_session` cookie (HttpOnly, SameSite=Strict, 7 days); 5 failures / 15 min per client → 429 |
| `POST /api/logout` | no | clears cookie |
| `GET /api/me` | cookie | Hermes bin/cwd and Langfuse **presence booleans** (never values) |
| `GET /api/rate-limits[?mode=demo]` | cookie | Rate-limit/reset snapshot (bamware-ai#75). Default `mode=live` reports real providers honestly — today just Claude Max, always `"unsupported"` (no read-only quota source is wired; see `lib/providers/claude-max-adapter.mjs`). `mode=demo` returns only synthetic fixtures covering fresh/stale/exhausted/unknown/reset-transition states, always tagged `source.kind:"synthetic"`, for widget preview/QA — never blended with live data. |
| `GET /api/work-usage[?mode=demo]` | cookie | Work/agents-analytics snapshot (bamware-ai#76): usage by project/ticket (with an explicit unallocated bucket), active agents with heartbeat freshness, active-vs-waiting time, outcomes/rework, and a routing-recommendation signal. Default `mode=live` reports only a safe, credential-free self-correlation (this service's own repo/branch/machine identity via `lib/providers/work-usage-self-adapter.mjs`) with no usage numbers — the only real collector (bamware-ai#60 → bamware-web#45) needs AWS DynamoDB credentials this service doesn't have, same gap as the rate-limits adapter. `mode=demo` returns the full synthetic fixture set (implementation → retry → QA, dedup, stale vs active agents), always tagged `source.kind:"synthetic"`. |
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
cd services/assistant-web && npm test      # 82 tests: fake Hermes fixture + rate-limit + work-usage + decisions contract/fixtures
```

Mocked tests are not integration proof. The real check is one authenticated
`POST /api/chat` against the installed Hermes (evidence in #63).

## Gates (Bilal)

- Enabling the systemd unit (always-on service on the server).
- Binding to the Tailscale IP or `tailscale serve` HTTPS (network config).
- Langfuse keys in `~/.hermes/.env` (account/project creation).
- Enabling Hermes' built-in API server (`API_SERVER_KEY`, gateway restart):
  the streaming/SSE upgrade path, see `docs/assistant-website.md`.

## Recovery release (2026-10-02)

Live Agents usage now includes an allowlisted metadata export of the four overnight implementation/QA runs, via `scripts/export-overnight-metrics.py`. It includes runtime-reported token totals and list-price cost estimates, never conversation content. This is a recorded batch snapshot, not continuous fleet ingestion. Active versus waiting time remains unknown where unavailable. Provider quota remains unsupported. Obsolete Langfuse/HTTPS decision cards were removed; the backlog-planning decision remains. Real worker dispatch is still pending.

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
