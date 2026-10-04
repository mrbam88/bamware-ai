# Discord: Bamware status channel and assistant

Set up 2026-09-24 so Bilal can see Bamware status at a glance.
**Channel split (CEO, 2026-10-04):** more channels, less noise in CoS chat.
Factory cadence: `docs/factory-cadence.md`.

## Channels

- **Status channel** (the first one, webhook): GitHub events and agent
  milestone posts.
- **`#bamware-bot`**: Chief of Staff ↔ CEO only (decisions, short status).
  Critical owner alerts still land here. Digests/deadlines may post here so
  Bilal can reply; prefer moving routine job noise to `#cron`.
- **`#cron`**: scheduled job / CFO snapshot noise; optional CEO read. CoS
  consumes and surfaces actions on status. Bot posts via
  `BAMWARE_POST_TO=cron` + `DISCORD_CRON_CHANNEL` (see
  `scripts/cfo-capacity-snapshot.sh`).

## What posts there

- **GitHub:** repo webhooks (Discord's built-in `/github` endpoint) on the 13
  Bamware repos: venue-engine, brewdesk, ios, web, auth-service,
  express-auth-service, auth-middleware, push-service, infra, mcp, demo,
  brewdesk-web and bamware-ai. The events are `pull_request`, `issues` and
  `release` only. Pushes are left out on purpose: agents push constantly and
  would flood the channel. Personal repos (nvim, dotfiles, interviews,
  Practice, ...) are not connected. Add a repo with the same hook config
  (`gh api repos/mrbam88/<repo>/hooks`).
- **Morning briefing (8 AM ET) and evening recap (9 PM ET):**
  `scripts/discord-digest.sh morning|evening` (#37). It reads STATE.md, open
  PRs and the last 24h of merges/issues, summarized by Claude Code on the
  subscription ($0, ~80 s). If that fails, it posts a plain list. Use
  `--dry-run` to preview. Timers are in `scripts/systemd/` and are meant for
  `omarchy`: copy them to `~/.config/systemd/user/`, then
  `systemctl --user enable --now bamware-digest-{morning,evening}.timer`.
  **On omarchy the units run from the deploy clone `~/srv/bamware-ai`**
  (drop-in `ExecStart` override, decided 2026-10-02) so the development
  checkout's branch never changes what gets posted; pull that clone to
  deploy. The full briefing goes to `#bamware-bot` and a **one-line pointer
  with a link to it goes to `#general`** (Bilal, 2026-10-02; the Sep 29–Oct 1
  "missed" briefings had all posted to `#bamware-bot`, #37).
  Every post logs `discord-post: posted … id=<message id> channel=<id>` to
  the journal (`journalctl --user -u bamware-digest-morning`); a failed post
  fails the unit; GitHub outages show as `(unavailable: …)` rather than
  "none". `BAMWARE_DIGEST_LABEL="…"` marks a manual run in both messages and
  `BAMWARE_SKIP_DEADLINES=1` keeps it from consuming deadline reminders.
- **Deadlines:** `docs/deadlines.md` with `scripts/discord-deadlines.sh` (#38).
  Runs with the morning briefing and reminds once per window (7-4 days, 3-2,
  1, the day, overdue). Set `DISCORD_USER_ID` in `discord.env` for @mentions.
  Sent-state lives per machine in `~/.local/state/bamware/deadlines-sent`, so
  copy it along when moving the timers or the reminders will repeat.
- **Agents:** after a verified milestone (merged PR, QA pass, session
  handoff), post one line with `scripts/discord-post.sh "..."`. Keep it
  short, and lead with what Bilal needs to do, if anything.

## The webhook is a secret

The repo is public, so never commit the URL. Each machine keeps it in
`~/.config/bamware/discord.env` (`DISCORD_WEBHOOK_STATUS=...`, chmod 600).

- Present on: `thinkpad`. Vault path: `/bamware/shared/discord-webhook-status`;
  `scripts/secrets-pull.sh` writes `discord.env` from it (server setup below).
- If it leaks, delete the webhook in Discord (channel → Integrations), create a
  new one, and update the vault and the 13 GitHub hooks.

## Always-on server (decided 2026-09-25)

Bilal chose the Intel `omarchy` server for everything scheduled or always-on:
the digest timers (moved off the ThinkPad, which sleeps; the 2026-09-25
morning briefing posted at 12:36) and the two-way bot. The M3 still travels,
so it hosts nothing that must stay up. Never run the timers on two machines.

**Two-way bot:** Bilal wants to check status and capture ideas from Discord.
It is the Hermes Discord gateway, which loads this repo's skills, so no
custom bot code. Hermes is used sparingly now (docs/hermes-integration.md)
and has been buggy with timeouts. It's a trial: if it doesn't hold up, the
fallback is a small bot that shells out to `claude -p` on the server, like
`scripts/discord-digest.sh` already does. Everything else here works without
Hermes.

### Server setup

**Status 2026-09-26: live.** On the server: linger, the digest timers (the
ThinkPad's are disabled; deadline sent-state copied, checksum verified),
`discord.env` from the vault with `DISCORD_USER_ID` (@mentions on), and the
Hermes gateway as a user service (`hermes-gateway`, OpenAI Codex
`gpt-6-astra`). `Bamware Bot#5303` answers Bilal (allow-listed by numeric ID)
in `#bamware-bot` without an @mention; first reply verified by Bilal.
Logs: `~/.hermes/logs/gateway.log`. To-do for Bilal: reset the bot token (it
was pasted into a chat once) and re-run the setup script with the new one.

Bilal does these once. Agents were denied applying the Hermes hook on the
server, so it is his step. On the **ThinkPad**:

```sh
# `command ssh` skips the themed ssh wrapper, which breaks piped stdin.
# 1. webhook into the vault (the ThinkPad has it, the server has AWS)
. ~/.config/bamware/discord.env && printf %s "$DISCORD_WEBHOOK_STATUS" |
  command ssh bilal@omarchy.tailb7fa1e.ts.net 'umask 077; f=$(mktemp); cat > "$f";
  ~/.local/share/mise/shims/aws --profile bamware --region us-east-1 ssm put-parameter \
  --name /bamware/shared/discord-webhook-status --type SecureString --overwrite \
  --value "file://$f" --query Version --output text; rm -f "$f"'
# 2. cut over: stop the ThinkPad timers, then carry the sent-state across
systemctl --user disable --now bamware-digest-{morning,evening}.timer
command ssh bilal@omarchy.tailb7fa1e.ts.net 'mkdir -p .local/state/bamware &&
  cat > .local/state/bamware/deadlines-sent' < ~/.local/state/bamware/deadlines-sent
```

In Discord: create the bot (Developer Portal → New Application → Bot: turn on
the Message Content and Server Members intents, Reset Token), invite it with
`https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot+applications.commands&permissions=274878286912`,
create `#bamware-bot`, and copy your user ID and that channel's ID
(Settings → Advanced → Developer Mode, then right-click → Copy ID).

Then on the **server** (`ssh server`, inside tmux):

```sh
cd ~/code/bamware-ai && git pull
scripts/secrets-pull.sh               # writes discord.env
hermes model                          # log in to a subscription provider, never Bedrock
python3 scripts/install-hermes.py --apply && hermes hooks list   # approve the hook
scripts/setup-discord-server.sh <your-user-id> <bamware-bot-channel-id>
```

`setup-discord-server.sh` enables linger, sets `DISCORD_USER_ID`, installs
and enables the timers, asks for the bot token (hidden), writes the Hermes
Discord settings and starts the gateway as a user service. Add `--no-bot` to
set up only the timers. `#bamware-bot` answers without an @mention; elsewhere
the bot needs one. Only Bilal's user ID is allowed.

Hermes on the server is 0.19 (the newest PyPI release); the ThinkPad runs
0.21 from git. 0.19 has the Discord gateway, but its `config set` saves the
hook list as a string so no hook loads; `install-hermes.py` now repairs that.

## Verified timer placement (2026-09-24, superseded by the move above)


The Hermes integration audit found both digest user timers enabled and active
on the **ThinkPad** (`omarchy-1`), with services installed in its user systemd
directory. They were preserved, not migrated or fired. Hermes cron has no
replacement jobs. The earlier server-install plan below remains blocked;
before moving these routines, choose one owner and preserve deadline sent-state.
See `docs/hermes-integration.md` for the cutover checks. `--dry-run` still
invokes the configured Claude summarizer; it is not a no-model test.

## Open

- ~~Board data needs a `read:project` gh scope on the posting machine.~~
  Done 2026-09-26: the server's gh has `project`, so the assistant can file
  delegated tickets onto board 2 and the digests can read it.


## Completion handoffs — October 2, 2026

Discord is Bilal's requested push-alert system. Chief-of-staff completion reports
must also appear on the corresponding private Command Center card. The handoff
procedure is in `skills/session-handoff/SKILL.md`; recurring implementation is #79.

First verified case: #72 research completion (`ddb3009`). The Assistant deployment
branch `worktree-assistant-web-slice` carries card commit `45dcb9a`; 103 tests passed
on omarchy. Authenticated `/api/decisions` returned `brewdesk-marketing-research-72`
version 1 after restart. The assistant bot sent a user-mentioned completion message
and read it back (message ID `1555669487167209534`). Durable server receipt:
`~/.local/state/bamware/handoffs/72-research-ddb3009.json`.

The receipt records card verification and Discord read-back separately. Phone push
receipt and rendered-browser verification were not observed. No whole-ticket
closure, new-stage worker pickup or automatic future monitoring is claimed.
The existing card explains that creative and measurement preparation remain.


### Card-action trigger deployed — October 2

Founder clarified that every Command Center action must trigger an agent handoff
check. Implemented on Assistant deployment branch in `0d1b525`, with test-isolation
fix `5ba78cc`. Production explicitly enables `ASSISTANT_WEB_HANDOFF_CHECKS=1`.
All actions queue one durable coordination check, independently of downstream worker
handoff. The checker uses the existing serialized Hermes runner, supplied card and
response evidence, no toolset and a one-turn bound. It does not fetch fresh project
state or dispatch project execution. Queued work recovers; interrupted work is
visible and not silently retried. Results and Discord delivery receipts appear in
`handoffCheck` on the authenticated Decisions API and on refreshed cards.

108 tests pass. Real #72 check: `db76500a664fca54f2ba452c657c4dec`, Hermes session
`20261002_161131_a7085d`, Discord read-back `1555673662663819264`. Authenticated API
verified check completed and delivery confirmed; downstream worker handoff correctly
remains pending. Phone push and rendered-browser verification were not observed.

Verification incident: the first test run shared the production check directory
and Discord notifier; two fixture echo alerts were sent. They were deleted after
read-back, fixture artifacts quarantined, and the real approval was preserved.
Checks now default disabled unless explicitly configured; HTTP tests disable them
and use isolated directories. The real #72 job was requeued only after verifying
it had no prior agent result or notification. No automatic retry of ambiguous
Discord sends is allowed.
