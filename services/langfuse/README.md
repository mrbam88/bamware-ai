# Langfuse, self-hosted on omarchy

Observability for Hermes turns (website, CLI, later Discord). Approved by
Bilal 2026-10-01 (#62/#65): official Docker Compose deployment, private,
persistent, free. Traces are **not** assistant memory; `~/.hermes/state.db` is.

## What is here

| File | Purpose |
|---|---|
| `docker-compose.yml` | Upstream langfuse/langfuse compose (main 9a29212e855c), five deliberate edits listed in its header: loopback-only ports, telemetry off, required secrets, project name |
| `init-secrets.sh` | Writes `~/.config/bamware/langfuse.env` once (chmod 600): DB/cache/object-store passwords, `NEXTAUTH_SECRET`, `SALT`, `ENCRYPTION_KEY`, headless-init org/project/API keys/first user |
| `up.sh` | `docker compose up -d`, waits for `/api/public/health` |
| `connect-hermes.sh` | Writes `HERMES_LANGFUSE_*` into `~/.hermes/.env` after checking Langfuse is healthy **and** the keys authenticate. Does not restart the gateway |
| `verify.sh` | Real CLI turn → trace with the same Hermes `session_id`; then wrong-secret turn → reply OK, no trace. Prints the trace URL |
| `langfuse.env.example` | Key names only |

Images (upstream pins): `langfuse/langfuse:4`, `langfuse-worker:4`,
`clickhouse-server:25.12`, `postgres:17`, `redis:7`, chainguard `minio`.
State lives in named Docker volumes `langfuse_{postgres,clickhouse,minio,redis}_*`;
`restart: always` brings them back after a reboot once `docker.service` is enabled.

## Gate (root, once) — the only step an agent cannot do

Docker is installed (29.7.2, compose 5.5.1) but `docker.service` is inactive and
disabled, `bilal` is not in the `docker` group, polkit refuses `systemctl start
docker` without interactive auth, and the rootless extras (rootlesskit,
slirp4netns) are not packaged on this host. Bilal runs, on omarchy:

```sh
sudo systemctl enable --now docker
sudo usermod -aG docker bilal
```

Then open a **new login shell** (group membership is per-login) and check
`docker info` works without sudo. The user must be in the docker group;
`DOCKER_HOST` tricks are not used.

## Bring-up (no sudo after the gate)

```sh
cd ~/code/bamware-ai/services/langfuse
./init-secrets.sh          # already done on omarchy 2026-10-01; no-op if the file exists
./up.sh                    # pulls ~2 GB of images on first run, then waits for health
./connect-hermes.sh        # HERMES_LANGFUSE_* → ~/.hermes/.env, MAX_CHARS=500
./verify.sh                # two model turns; paste the printed trace URL into #65
```

Website check afterwards: `/api/me` must report `langfuse.keysPresent: true`,
and a `POST /api/chat` reply's `trace.langfuseSessionId` must match a trace's
session in the UI. Discord turns trace only after `hermes-gateway` restarts
(do it together with #64; never kill the gateway just for this).

## Access

UI on `http://127.0.0.1:3000` only. From a laptop:
`ssh -L 3000:127.0.0.1:3000 omarchy` then `http://localhost:3000`. Login is the
`LANGFUSE_INIT_USER_EMAIL` / `LANGFUSE_INIT_USER_PASSWORD` pair in
`~/.config/bamware/langfuse.env`. No public bind, no Tailscale Serve, no TLS,
no paid tier. MinIO console (`127.0.0.1:9091`) and all datastores are loopback.

## What the Hermes plugin sends (read from the installed 0.19.0 source)

Per turn, one trace "Hermes turn" with `session_id` = Hermes session id and
metadata `source/task_id/turn_id/platform/provider/model/api_mode`, then:

- **Trace input:** the **last user message** text. With the Bamware hook this
  message carries the injected context block (AGENTS.md, STATE excerpt, skill
  index), so it is large.
- **Per LLM call** (`generation`): input = the **last 12 request messages**
  including the system prompt on short sessions, each role/content; assistant
  output = content, reasoning, tool calls with arguments; usage and cost.
- **Per tool call** (`tool` span): input = arguments, output = result,
  metadata = arguments again. `read_file` results are reduced to head/tail
  previews; other results go through as text/JSON.
- **Trace output:** the final assistant content.

Only `data:` URIs (images/audio) are redacted. Everything else is **truncated
per field** to `HERMES_LANGFUSE_MAX_CHARS` (`connect-hermes.sh` sets 500;
plugin default 12000). Truncation is a size cap, not redaction: a 500-char cap
still ships the first 500 chars of every message, tool argument and tool
result. Secrets in tool output rely on Hermes' own `redact_secrets` running
before hooks, which is not verified here. Mitigation is that the store is
local and loopback-only; a metadata-only mode would need a plugin change.

## Reading traces programmatically (v4)

Langfuse 4 runs in `events_only` mode: the public `/api/public/traces`,
`/sessions`, `/observations` and `/metrics` read endpoints answer 404 by
design. The UI works normally (`/project/hermes/traces/<trace_id>`), and
`verify.sh` reads stored spans from the stack's own ClickHouse on
`127.0.0.1:8123` (`events_full`, one row per span, `session_id` on the root
`CHAIN` row). Ingestion is OTLP at `/api/public/otel/v1/traces`.

## Operate

```sh
E=~/.config/bamware/langfuse.env
docker compose --env-file $E ps
docker compose --env-file $E logs -f langfuse-web langfuse-worker
docker compose --env-file $E pull && docker compose --env-file $E up -d   # upgrade (check upstream compose diff first)
docker compose --env-file $E down                                         # stop, keep data
docker run --rm -v langfuse_langfuse_postgres_data:/d -v "$PWD":/b alpine tar czf /b/pg-$(date +%F).tgz -C /d .   # crude volume backup, stack stopped
```

Rollback: `docker compose --env-file $E down -v` deletes all Langfuse data;
remove the `HERMES_LANGFUSE_*` lines from `~/.hermes/.env` (a timestamped
`.bak-langfuse-*` sits beside it); `hermes plugins disable observability/langfuse`
if the plugin should go too. Nothing else on the host was changed.
