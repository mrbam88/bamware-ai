# Discord: Bamware status channel

Set up 2026-09-24 so Bilal can see Bamware status at a glance. For now there is
**one channel for everything** (Bilal's choice); split into #github /
#ci-deploys / #agents later by adding webhooks.

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

- Board data (the project board) needs a `read:project` gh scope on the
  posting machine.
