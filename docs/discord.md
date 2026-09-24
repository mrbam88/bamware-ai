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
- **Status summaries:** a short Markdown digest built from `STATE.md` (awaiting
  review / blocked on Bilal / shipped). The first one was posted by hand on
  2026-09-24. The plan is a daily post from the always-on `omarchy` server.
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

## Open

- Daily summary timer on `omarchy`: blocked on Tailscale SSH re-auth, which
  Tailscale's check mode requires periodically.
- Board data (the project board) needs a `read:project` gh scope on the
  posting machine.
