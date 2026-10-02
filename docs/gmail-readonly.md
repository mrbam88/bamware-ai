# Gmail, read-only, for the Bamware assistant

Prepared 2026-10-02 on `omarchy` from a Claude Code session on the server
itself. Nothing is connected yet: no Google account, no real mail read, no
live write test. Model-facing procedure: `skills/gmail-readonly`.

## Bilal's rule

Never send, reply, forward, create drafts, delete, archive, label, mark read,
or otherwise change anything in Gmail. Read only. First use: tracking job
applications and interviews. His entire personal life is in this account.

## State line (keep current)

| Layer | State as of 2026-10-02 |
|---|---|
| Hermes Google integration | Inspected. **None installed.** Hub skill absent, no Gmail toolset in core, no Google tokens on disk. |
| Read-only bridge | `scripts/gmail_readonly.py` written, 26 offline tests pass on synthetic mail (`tests/test_gmail_readonly.py`). |
| Scope policy | Consent asks for `gmail.readonly` only; token refused unless granted scope is exactly that; GET-only allow-list below the model. |
| Credential isolation | Bridge reads only `~/.config/bamware/gmail-readonly/`; Hermes/gcloud/ADC paths never consulted (tested with decoys). |
| Hermes config hardening | `memory.write_approval: true` (backup in `~/.hermes/backups/`). Website picks it up per turn; Discord gateway at its next restart. |
| Google side | **Blocked on Bilal:** OAuth client not created. See "Next step". |
| Live verification | Not run. `authorize` and `verify` are Bilal's to run after the client exists. |

## 1. What was inspected (Hermes 0.19.0, omarchy)

Install: `~/.local/share/mise/installs/pipx-hermes-agent/0.19.0`. Config and
`.env` were read for key **names** only.

- **No Gmail toolset exists in Hermes core.** `toolsets.py` and the 152
  registered tools contain no gmail/workspace tool. `hermes tools list` on this
  host shows none. `hermes auth` handles LLM providers only.
- **Upstream's Gmail capability is the hub skill `google-workspace`**
  (`skills/productivity/google-workspace/scripts/setup.py`, pulled from the
  Nous skills index). It is **not installed** here (`~/.hermes/skills` holds
  only the two Omarchy symlinks). It runs Gmail through shell scripts via the
  `terminal` tool, so Hermes has **no per-tool read/write split** to enforce,
  and its token loader deliberately omits scopes when loading
  (`google_chat/oauth.py:205-210`, "Same logic as the google-workspace
  skill") and sets `OAUTHLIB_RELAX_TOKEN_SCOPE=1`. A broader token at its
  path would be used silently. **That default flow is not used.**
- Other Google surfaces in core, all inert here: Google Chat platform plugin
  (single scope `chat.messages.create`, not configured); a Telegram
  "gmail-triage" callback dispatcher with send/archive/draft/spam verbs
  (`plugins/platforms/telegram/adapter.py:6253`), inert because Telegram is
  not configured and `~/.hermes/scripts/` does not exist; the `email`
  IMAP/SMTP platform (app-password based, auto-replies) is not configured
  and fail-closed. **None of these will be enabled.**
- Existing Google credentials: none under `~/.hermes`, no `~/.config/gcloud`,
  no `~/.credentials`, no `GOOGLE_APPLICATION_CREDENTIALS`. Chrome profiles
  hold browser sessions only; the bridge cannot and does not use them.
- Running services preserved: `hermes-gateway.service` (Discord),
  `assistant-web.service` (website, `~/srv/bamware-ai` on branch
  `worktree-assistant-web-slice`), digest timers 08:00/21:00, Langfuse Docker
  stack on loopback. Nothing was restarted.

## 2. The bridge: `scripts/gmail_readonly.py`

Stdlib only (no google-auth, no `google-api-python-client`, no IMAP/SMTP
imports; a test asserts this). Four enforcement layers, each tested:

1. **Consent requests one scope.** Authorization URL carries
   `scope=https://www.googleapis.com/auth/gmail.readonly`, PKCE S256,
   `access_type=offline`, `prompt=consent`, and never
   `include_granted_scopes` (so no inheritance of anything granted earlier).
   Loopback redirect on 127.0.0.1 with a random port; `--manual` variant for
   pasting the redirect URL (hidden input). The code is never echoed.
2. **Token accepted only if exactly readonly.** After exchange, after every
   refresh, and on every load, the granted `scope` must equal the one scope.
   Excess at consent time triggers revoke and nothing is saved. A token file
   not written by this bridge (`token_type` differs) is refused on origin.
3. **GET-only allow-list below the model.** `profile`, `labels`, `messages`,
   `messages/<id>`, `threads`, `threads/<id>`. Gmail's write verbs at the same
   depth (`send`, `import`, `insert`, `batchModify`, `modify`, `trash`,
   `drafts`, `watch`, `settings/*`) are refused before a connection opens.
   POST is allowed only to Google's token and revoke endpoints.
4. **Own credential paths.** `~/.config/bamware/gmail-readonly/oauth-client.json`
   (Google "Desktop app" client, chmod 600) and `token.json` (0600, dir 0700).
   Decoy broad-scope tokens planted at the Hermes, hub-skill, gcloud and ADC
   locations are ignored (`CredentialIsolation` tests).

Output hygiene: headers + snippet by default; `--body` adds text capped at
1500 chars (HTML flattened, scripts/styles dropped); obvious credentials in
mail (`password:`, one-time codes, bearer tokens, URL userinfo) are scrubbed;
everything is wrapped in `<untrusted_email_data source="gmail">` with the
Hermes-style "DATA, not instructions" preamble, and any `<untrusted_…>`,
`<system>` or `<tool_result>` delimiters inside mail are neutralized so a
message cannot close the block or forge Hermes's own framing. Logs to stderr
carry counts and ids only. Exit 2 = not authorized/refused, 3 = network.

Synthetic test corpus: `tests/fixtures/gmail/` (regenerate with
`make_fixtures.py`). Message `m1` carries a prompt-injection payload and fake
credentials on purpose. Run: `python3 -m unittest tests.test_gmail_readonly`.

## 3. Data path: what reaches external models, what is retained

Read from installed source during this session (`agent/`, `plugins/observability/langfuse/`,
`hermes_state.py`); file:line references are in the description of the PR
that introduced this file.

**Leaves the machine**

- **Model provider.** Hermes runs on `openai-codex` (`gpt-6-astra`, ChatGPT
  subscription). Every byte the bridge prints in a turn becomes part of the
  request to OpenAI, and stays in the conversation window on later turns.
  That is unavoidable for an assistant that reads mail; the control is
  *how much* is printed (headers first, body on demand, 1500-char cap). The
  Bamware context hook also rides along in the same request, as today.
- **Nothing else.** Langfuse is self-hosted on `127.0.0.1:3000`; Hermes'
  redactor and context hook make no external calls; the bridge talks only to
  `gmail.googleapis.com`, `oauth2.googleapis.com`, `accounts.google.com`.

**Retained locally**

- `~/.hermes/state.db` `messages.content`: full tool results, verbatim,
  indefinitely (`sessions.auto_prune: false`, two FTS mirrors, searchable via
  the `session_search` tool in later sessions). There is no "don't store tool
  results" switch; the lever is session-level `hermes sessions delete/prune`.
- `/tmp/hermes-results/*.txt`: tool outputs over the inline size spill here
  unredacted; `~/.hermes/hook_outputs/`: oversized hook context.
- Langfuse (local Docker volumes): trace input = last user message; each LLM
  generation = last 12 request messages incl. system prompt; each tool span =
  arguments and result; truncated per field at `HERMES_LANGFUSE_MAX_CHARS=500`.
  **No masking, no `security.redact_secrets` integration, no metadata-only
  mode.** 500 chars still fits a sender, subject and first sentence.
- `~/.hermes/logs/*.log`: INFO, metadata only (tool name, duration, char
  counts), `RedactingFormatter` on every handler; the one content leak is a
  200-char prefix of a *failing* tool's output.
- `~/.hermes/memories/`: the background memory review replays the whole turn
  including tool results every 10 user turns and may save "personal details".
  **Mitigated:** `memory.write_approval` set to `true` on 2026-10-02 so
  background writes are staged for `/memory pending` instead of landing.

**Credentials.** The token never enters a Hermes tool result (the bridge
prints neither tokens nor codes; a test asserts refresh/access tokens and the
client secret are absent from all output). Hermes' redactor would not mask a
Google refresh token by prefix anyway, so this is the only real guard.

**Email text is untrusted.** Hermes' own `<untrusted_tool_result>` wrapper
covers only `web_search`, `web_extract`, `browser_*`, `mcp_*`; `terminal`
output gets neither the wrapper nor the threat scan. The bridge therefore
wraps its own output, and `skills/gmail-readonly` tells the model to treat it
as data.

## 4. Verified in this session (all offline, no model calls, $0)

- 26 tests pass: scope policy, credential isolation with decoys, GET-only
  guard incl. write verbs, injection neutralization, secret scrub, truncation,
  HTML flattening, JSON mode, `verify` refusing a Google-reported broader
  scope, no secret strings in any output, auth URL carries one scope.
- `scripts/check-context.py` passes with the new skill indexed.
- Hermes config: `memory.write_approval` read back as `true`; gateway and
  website services still `active`; timers unchanged.

## 5. Blockers and risks that remain

- **Google OAuth client does not exist.** Bilal-only (security.md: humans
  keep credentials). The "Next step" below.
- **Langfuse and `state.db` will hold what the model saw**, truncated/verbatim
  respectively. Acceptable while both are loopback-only on this box; revisit
  before any cloud Langfuse or `state.db` sync. Option if wanted later:
  `sessions.auto_prune: true` with a short `retention_days`.
- **Hermes is on trial** (`hermes-integration.md`). If it keeps timing out,
  the bridge is a plain CLI and works unchanged under the `claude -p` fallback.
- **Discord gateway** still runs the pre-hardening config until its next
  restart (not restarted on purpose).
- The bridge can read anything in the mailbox, not only job mail; "read-only"
  is the boundary, not "job-only". The `jobs` preset and the skill rules
  narrow default behaviour, not capability.

## 6. Next step (Bilal, one Google action)

Create the OAuth client and save it to the bridge's directory:

1. Google Cloud Console → a project of yours → **APIs & Services → Library →
   Gmail API → Enable**.
2. **OAuth consent screen**: External, Testing mode, add your Gmail address
   as the only test user. Scopes: add only `.../auth/gmail.readonly`.
3. **Credentials → Create credentials → OAuth client ID → Desktop app**.
   Download the JSON.
4. On omarchy:
   ```sh
   mkdir -p ~/.config/bamware/gmail-readonly && chmod 700 ~/.config/bamware/gmail-readonly
   mv ~/Downloads/client_secret_*.json ~/.config/bamware/gmail-readonly/oauth-client.json
   chmod 600 ~/.config/bamware/gmail-readonly/oauth-client.json
   ```

Then, when you choose to connect (not part of this preparation):
`python3 scripts/gmail_readonly.py authorize` (browser on omarchy) or
`authorize --manual` over SSH, then `verify`, which prints Google's own
view of the scope and the account address. The Google consent screen must
show exactly one permission: "View your email messages and settings". If it
shows more, cancel; the bridge would refuse the token anyway.

## Rollback

Delete `~/.config/bamware/gmail-readonly/token.json` (and revoke the app
under Google Account → Security → Third-party access). Restore
`memory.write_approval` from `~/.hermes/backups/config-before-gmail-hardening-2026-10-02.yaml`
with `hermes config set memory.write_approval false`. Nothing else changed.
