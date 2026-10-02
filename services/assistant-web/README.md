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
cd services/assistant-web && npm test      # 13 tests, fake Hermes fixture
```

Mocked tests are not integration proof. The real check is one authenticated
`POST /api/chat` against the installed Hermes (evidence in #63).

## Gates (Bilal)

- Enabling the systemd unit (always-on service on the server).
- Binding to the Tailscale IP or `tailscale serve` HTTPS (network config).
- Langfuse keys in `~/.hermes/.env` (account/project creation).
- Enabling Hermes' built-in API server (`API_SERVER_KEY`, gateway restart):
  the streaming/SSE upgrade path, see `docs/assistant-website.md`.
