# Assistant website — text and voice on the real Hermes runtime

Epic mrbam88/bamware-ai#62 (founder-authorized 2026-10-01). Audit #63.
Code: `services/assistant-web` (README there). Children: #64 API streaming,
#65 Langfuse keys, #66 HTTPS + voice test, #67 systemd service, #68 session
linking. Written from a Claude Code session running **on `omarchy` itself**
(server-local, not over Tailscale), context 2026-10-01T03:39:08Z 929bb82.

## State line (keep current)

| Layer | State as of 2026-10-01 |
|---|---|
| Website text → real Hermes → reply | **Deployed and verified** on the tailnet URL (11.2 s, session `20261002_000131_177661`; 2026-10-02) |
| Auth (owner password → signed cookie) | Implemented, tested (401 paths, rate limit) |
| Export / delete of a web session | Implemented via `hermes sessions`; export verified |
| Browser voice (STT/TTS, barge-in) | Implemented, **not human-tested**; iPhone needs HTTPS (#66) |
| Langfuse trace | **Running and verified** (self-host 4.49.0 on omarchy, loopback): website turn `20261002_001227_923a76` → trace `83602cc719c629c6b57a1ba0c70100e8`, env `assistant-web`; wrong-key turn → 401 at export, no row (#65) |
| Deployed as a service | **Yes, 2026-10-02** — `assistant-web.service` enabled, bound to `100.88.99.117:8765` (tailnet only, HTTP). Bilal ran `scripts/deploy-assistant-web.sh`; restart survival verified; reboot pending; HTTPS blocked (tailnet certs disabled) (#67) |
| Streaming via Hermes API server | **No.** Needs `API_SERVER_KEY` + gateway restart (#64) |
| Decisions card deck (#78, Command Center MVP) | **Implemented and tested** (82/82 `npm test`), not yet run through a local dev server or browser (permission gap below). 3 explicit, real candidates sourced from #77 and this doc's own Langfuse/Tailscale gaps; durable file-backed responses; `approve` always honestly reports `handoff_pending` in live mode — no confirmed worker interface exists. See `services/assistant-web/README.md` |
| Chief of Staff coordination | **Does not exist** as software; see below |

Distinguish: *edited locally* (worktree) → *published* (merged to main) →
*deployed* (unit enabled on omarchy). Only the first two apply until #67.

## 1. Installed runtime (evidence)

- `hermes --version` → **Hermes Agent v0.19.0 (2026.7.20)**, pip install under
  mise (`~/.local/share/mise/installs/pipx-hermes-agent/0.19.0`).
- `hermes-gateway.service` (user unit) **active since 2026-09-26 01:42 EDT**;
  `~/.hermes/gateway_state.json`: platforms `{discord: connected}` only.
- `~/.hermes/config.yaml` (no secret values): provider `openai-codex`, model
  `gpt-6-astra`; `skills.external_dirs` → this repo's `skills/`; one
  `pre_llm_call` hook → `scripts/hermes-context.py` (✓ allowed);
  `session_reset: idle, 240 min`; Discord channel prompt → `bamware-assistant`.
  Plus, from this session: `plugins.enabled: [observability/langfuse]`
  (backup: `~/.hermes/backups/config-before-langfuse-2026-10-01.yaml`).
- `~/.hermes/.env` holds only `DISCORD_*` names. `hermes cron list`: no jobs.
  `hermes profile list`: `default` only. `hermes kanban`: no tasks.
- Note: the main `bamware-ai` checkout on omarchy sits on `spike/video-gen`,
  so the context hook reports `CHECKOUT_DIFFERS`; it still pins origin/main.

## 2. Programmatic interfaces Hermes 0.19.0 actually supports

| Surface | Auth | Sessions | Needs gateway restart? |
|---|---|---|---|
| `hermes chat -Q -q "<text>" [--resume <id>]` (CLI) | local user | writes `state.db`, `source=cli`; stdout = reply, stderr ends `session_id: <id>`, exit 1 on failure | **No** — chosen for the slice |
| Gateway platform `api_server` (`gateway/platforms/api_server.py`) | Bearer `API_SERVER_KEY` (≥16 chars, refuses to start without) | `/v1/chat/completions` (stateless + `X-Hermes-Session-Id`), `/v1/responses`, `/api/sessions/*` CRUD + `/chat/stream` SSE, `/v1/runs` SSE, `/health` | **Yes** (`API_SERVER_ENABLED`/`API_SERVER_KEY` read at gateway start) |
| `hermes serve` (JSON-RPC/WebSocket backend for the desktop app, port 9119) | password/OAuth required off-loopback | same store | separate process; not a web-page protocol |
| `hermes gateway` Discord | allow-listed user id | `source=discord`, keyed by channel | running today |

Hooks and plugins are agent-level, so the CLI path fires the same context
hook (verified: `~/.hermes/hook_outputs/20261001_210753_e89a74/` contains
`[BAMWARE_CONTEXT_CHECK]` pinned to 929bb82) and loads the same plugins.

## 3. Persistent history

- Store: `~/.hermes/state.db` (SQLite, 2.6 MB). Tables: `sessions`
  (id, source, user_id, chat_id, model, cwd, started/ended, token counts,
  title, archived…), `messages` (role, content, tool calls, timestamps),
  `session_model_usage`, `gateway_routing`, `delivery_obligations`, etc.
  On 2026-10-01: 4 sessions (3 discord, 1 cli) + the two from this session.
- Persistence across restart: rows survive; the gateway log shows routing-key
  recovery after restart (2026-09-26). Discord sessions **reset** after 4
  idle hours or `/new` — a new session row, old rows remain.
- Export: `hermes sessions export --session-id <id> --format jsonl -`
  (also md/qmd/html/trace). Delete: `hermes sessions delete --yes <id>`;
  `prune`, `archive` for bulk. The website wraps export/delete for its own
  session. Conversation contents were not read or published for this audit.
- Memory plugin and skill curator also write under `~/.hermes` (curator
  snapshots nightly); they are Hermes-owned, not Bamware truth (AGENTS.md).

## 4. How website and Discord share state

Same `state.db`, same hook, same skills, same model/provider. Different
session rows unless linked explicitly. `--resume <discord session id>` works
mechanically, but the gateway owns live Discord sessions, so linking is its
own ticket with guards (#68). Langfuse traces are **not** memory (#62 rule).

## 5. Langfuse

- Searched: Hermes venv (`langfuse` module absent before this session), env,
  `~/.hermes`, `~/.config`, Docker (daemon inactive, user not in `docker`
  group), every repo under `~/code`. **Nothing existed** except the PRD
  mention. No Langfuse Cloud account is known to agents.
- Hermes ships `plugins/observability/langfuse` (hooks: pre/post api request,
  llm call, tool call). Enabled now; `langfuse` SDK 4.16.0 installed in the
  Hermes venv (`.../hermes-agent/bin/python -m pip install langfuse`;
  rollback `pip uninstall langfuse` + `hermes plugins disable observability/langfuse`).
- Verified without a model: SDK imports; with no keys `_get_langfuse()` → `None`
  (inert). A real website turn with the plugin enabled and no keys completed
  with **no warning in `~/.hermes/logs`** — that is the fail-open case.
  Caveat: plausible-but-wrong keys build a client and only fail at flush;
  set `HERMES_LANGFUSE_DEBUG=true` when verifying #65.
- Trace shape: name "Hermes turn", `session_id` = Hermes session id,
  metadata platform/provider/model/task_id; full content inventory below
  (the earlier "input = last user message" summary understated it).
  No metadata-only mode exists in the plugin.
- Website correlation: `POST /api/chat` returns
  `trace.langfuseSessionId` (= Hermes session id) and tags turns
  `HERMES_LANGFUSE_ENV=assistant-web` unless the operator set a global tag.
- Bilal chose **self-host on omarchy** (2026-10-01). Implemented in
  `services/langfuse` (README there): upstream compose pinned to main
  9a29212e855c with loopback-only ports, telemetry off, required secrets;
  `~/.config/bamware/langfuse.env` generated (chmod 600, headless-init org
  `bamware`, project `hermes`, `pk-lf-`/`sk-lf-` keys, first user); scripts
  `up.sh` → `connect-hermes.sh` → `verify.sh`. `docker compose config` renders.
- **Not running.** Exact blocked step: `docker.service` is inactive/disabled,
  `bilal` is not in group `docker`, `systemctl start docker` is refused by
  polkit, sudo needs a password, and rootless Docker is not packaged
  (no rootlesskit/slirp4netns). Gate: `sudo systemctl enable --now docker &&
  sudo usermod -aG docker bilal`, then a new login shell. `up.sh` exits 2 with
  `BLOCKED: cannot reach the Docker daemon` until then.
- Hermes is **not** connected yet on purpose: the plugin blocks on flush, so
  keys pointing at a dead URL would slow every website/CLI turn.
  `connect-hermes.sh` refuses unless Langfuse is healthy and the keys
  authenticate. `~/.hermes/.env` still holds only `DISCORD_*`.
- **What the plugin records** (read from the installed source, not the
  docstring): trace input = last user message (which carries the injected
  Bamware context block); each `LLM call N` generation = the **last 12
  request messages incl. system prompt on short sessions**, assistant
  content, reasoning, tool calls with arguments, usage/cost; each `Tool:`
  span = arguments in, result out (`read_file` reduced to head/tail);
  trace output = final assistant text. Only `data:` URIs are redacted;
  all else is **truncated per field** to `HERMES_LANGFUSE_MAX_CHARS`.
  Truncation is a size cap, not redaction. Mitigation: local, loopback-only
  store; `MAX_CHARS=500` set by `connect-hermes.sh`.
- **Verified 2026-10-02 (Bilal ran `up.sh`/`connect-hermes.sh`; checks by the
  omarchy session):** Langfuse 4.49.0 healthy on `127.0.0.1:3000`; headless
  init created org `bamware` / project `hermes`; `HERMES_LANGFUSE_*` written to
  `~/.hermes/.env` (`MAX_CHARS=500`); `/api/me` → `keysPresent: true`.
  Stored spans read from the stack's ClickHouse (`events_full`): website turn
  session `20261002_001227_923a76` → trace `83602cc719c629c6b57a1ba0c70100e8`
  (`Hermes turn` + `LLM call 1`, environment `assistant-web`, output
  `WEB-DEPLOY-OK`); CLI turn `20261002_001157_1fdfa6` → trace
  `1b86afe7bf708e202ed8fbec431696ee`. UI route
  `http://127.0.0.1:3000/project/hermes/traces/<id>` serves 200.
- **Failure case verified:** wrong `sk-lf-` in `~/.hermes/.env` (restored
  after) → turn still answered `PONG`, `agent.log`: `Failed to export spans
  batch code: 401, reason: Unauthorized`, zero rows for that session.
  Note: an exported env var does **not** work for this test because Hermes
  loads `~/.hermes/.env` with `override=True`; `verify.sh` swaps the file.
- **Langfuse v4 runs in `events_only` mode:** `/api/public/traces`,
  `/sessions`, `/observations`, `/metrics` return 404 by design. Programmatic
  verification reads ClickHouse on loopback (`verify.sh`); the UI is unaffected.
- **Not verified: Discord traces** (gateway not restarted; same restart as #64).

## 6. Network and deployment

### Deployment state (2026-10-01, late)

- Bilal authorized enabling the service and private Tailscale HTTPS in #67.
- Done without privileges: deploy clone `~/srv/bamware-ai` (branch
  `worktree-assistant-web-slice`; switch to `main` after #69 merges) so the
  service does not run out of an auto-cleaned `.claude/worktrees/` path;
  `~/.config/bamware/assistant-web.env` now binds `ASSISTANT_WEB_HOST=100.88.99.117`
  (Tailscale IP, tailnet-only; backup `*.bak-deploy-*` beside it);
  `scripts/deploy-assistant-web.sh` installs the unit plus a drop-in
  (`WorkingDirectory` → deploy clone, `HERMES_CWD` → `~/code/bamware-ai` so the
  context hook activates) and enables it; `scripts/verify-assistant-web.sh`
  runs the #67 checks and prints the session id.
- **Blocked in the agent session by the Claude Code auto-mode classifier**
  (Claude's restriction, not Bilal's setup): `cp … ~/.config/systemd/user/ &&
  systemctl --user enable --now assistant-web` ("Modify Shared Resources"),
  `tailscale serve …` ("External Ingress Tunnel"), and even read-only
  MagicDNS/sqlite checks ("Expose Local Services"). Not retried.
- **HTTPS is blocked independently:** `tailscale cert omarchy.tailb7fa1e.ts.net`
  → "your Tailscale account does not support getting TLS certs". Enable
  HTTPS certificates on the tailnet DNS page of the Tailscale admin console,
  then set the bind back to `127.0.0.1` and run
  `tailscale serve --bg --https=443 http://127.0.0.1:8765`
  (operator user is already `bilal`, no sudo). Until then the tailnet URL is
  plain HTTP: text only, no microphone, cookies non-Secure.
- **Deployed 2026-10-02 by Bilal running the script.** `scripts/verify-assistant-web.sh`
  against `http://100.88.99.117:8765`: health OK, unauth chat 401, wrong
  password 401, login OK, real turn `WEB-DEPLOY-OK` (session
  `20261002_001227_923a76`, export 32,649 bytes containing the turn),
  `systemctl --user restart` → healthy, `active`. MagicDNS name
  `http://omarchy.tailb7fa1e.ts.net:8765` not exercised from another device.
- **Context hook under systemd:** the first website turns carried
  `[BAMWARE_CONTEXT_BLOCKED]` because the unit's `PrivateTmp=true` breaks
  git-over-SSH (isolated with `systemd-run`: `PrivateTmp` fails, `NoNewPrivileges`
  passes). Fix in the drop-in: `GIT_CONFIG_*` rewrite of `git@github.com:` to
  HTTPS for the service only (verified with the same reproduction). Needs one
  re-run of `scripts/deploy-assistant-web.sh` to apply.
- Reboot persistence: pending (no reboot authorized); linger is on.

- `omarchy` Tailscale IP `100.88.99.117`, MagicDNS, `tailscale serve`: no
  config. Ports 80/443/8642/8765/9119 free. No reverse proxy. Docker inactive.
- Browser mic needs a secure context: HTTPS or `localhost`. Options: `tailscale
  serve --bg --https=443 http://127.0.0.1:8765` (network config, Bilal, #66) or
  `ssh -L 8765:127.0.0.1:8765 omarchy` for laptop-only voice today.
- Service unit: `scripts/systemd/assistant-web.service`; enabling is a deploy
  step (#67). Secrets: `~/.config/bamware/assistant-web.env` (created
  2026-10-01, chmod 600, never committed).

## 7. Verification log (2026-10-01, omarchy)

| Step | Command / route | Result |
|---|---|---|
| CLI smoke | `hermes chat -Q -q "…PONG…"` | `PONG`, session `20261001_210753_e89a74`, exit 0 |
| CLI resume | same + `--resume 20261001_210753_e89a74` | answered from history, 8 s |
| Unit/integration tests | `npm test` in `services/assistant-web` | 13/13 pass (fake Hermes fixture) |
| Website real turn | `POST /api/chat` after login | `WEB-OK`, `elapsedMs: 8225`, session `20261001_211656_1f0aff` |
| Auth | unauth `/api/chat`, wrong password | 401, 401; 6th bad login → 429 |
| Export | `GET /api/sessions/<id>/export` | JSONL, 32 KB |
| Page render | headless Chromium 390×844 and 1280×800 | login view renders, `data-view="login"` |
| Model calls made | 3 turns on the ChatGPT subscription (`openai-codex`) | $0 marginal; no paid service touched |

Not verified: voice by a human, Langfuse ingestion (stack not running: Docker root gate), iPhone access, service
survival across reboot, Discord↔web linking, API-server streaming.

## 8. Chief of Staff: does coordination exist?

**No.** "Chief of Staff" appears only in docs (`docs/bamware-agent-operating-
system-prd.md`, contracts, an executive snapshot). There is no script, service,
timer, Hermes profile, cron job or kanban task implementing it, and
`skills/bamware-assistant` states the Discord bot "is not a chief of staff".
#62/#63 were created by a cloud session with no server access and were
**not dispatched**; this slice ran because a Claude Code session on omarchy
picked #63 up by hand. Report intake as: requested (yes), claimed (this
session), implemented (text slice), verified (loopback), deployed (no).

## 9. Fallback if Hermes is unsuitable

`docs/discord.md` already names it: a small bot on `claude -p`. For the
website that is a one-line swap in `server.mjs` (`HERMES_BIN` → a wrapper that
runs `claude -p` with the same stdout/stderr contract), losing the shared
`state.db`. Trigger: repeated timeouts or failed turns in the server log.
