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

- Present on: `thinkpad`.
- To-do: add it to the vault as `/bamware/shared/discord-webhook-status` and
  have `scripts/secrets-pull.sh` write `discord.env`, so `omarchy` and `mac`
  get it too. The ThinkPad has no AWS profile yet.
- If it leaks, delete the webhook in Discord (channel → Integrations), create a
  new one, and update the vault and the 13 GitHub hooks.

## Verified timer placement (2026-09-24)

The Hermes integration audit found both digest user timers enabled and active
on the **ThinkPad** (`omarchy-1`), with services installed in its user systemd
directory. They were preserved, not migrated or fired. Hermes cron has no
replacement jobs. The earlier server-install plan below remains blocked;
before moving these routines, choose one owner and preserve deadline sent-state.
See `docs/hermes-integration.md` for the cutover checks. `--dry-run` still
invokes the configured Claude summarizer; it is not a no-model test.

## Open

- Installing the digest timers on `omarchy`: blocked on Tailscale SSH re-auth
  (check mode) and on `discord.env` existing there.
- Board data (the project board) needs a `read:project` gh scope on the
  posting machine.
- **Two-way bot (wanted, Bilal 2026-09-25):** check status and capture ideas
  from Discord. Planned route: the Hermes Discord gateway (`hermes gateway
  setup`), which already loads this repo's skills, so no custom bot code. It
  only calls a cloud model, so it belongs on an always-on machine, not the
  ThinkPad. Machine choice is pending (see `docs/machines.md`, `mac`).
- The digest timers on the ThinkPad fire late when the laptop sleeps (the
  2026-09-25 morning briefing posted at 12:36). Move them to the always-on
  machine along with the gateway.
