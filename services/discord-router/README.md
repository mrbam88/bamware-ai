# discord-router — the Bamware Discord seat

The seat behind `#chief-of-staff`. It **routes, never executes**: reads the
CFO's headroom, picks the first agent CLI with quota, execs it inside the repo
checkout, posts the answer back naming the vendor. ADR 0002; terms in
`CONTEXT.md` (Seat, Runner, Pool, Headroom, Halt, Thread note, Role, Executor).

```
Discord ──msg──▶ seat ──reads──▶ ~/.local/state/bamware/cfo/capacity.json
                   │                 (and halt.json: CFO kill switch)
                   ├─ 1st ▶ claude -p … --dangerously-skip-permissions
                   ├─ 2nd ▶ codex exec … --dangerously-bypass-approvals-and-sandbox
                   └─ 3rd ▶ opencode run …
          all three read AGENTS.md / STATE.md / skills in ~/code/worktrees/bamware-ai-main
```

## Rules it enforces

- Only `DISCORD_USER_ID` is answered; only `DISCORD_HOME_CHANNEL` and its threads.
- **CFO halt** (`halt.json` with `{"halted": true, "reason": "…"}`) → nothing is spawned, nothing dispatched. Company Rule #1.
- Runner order, `floor_pct` and `cooldown_min` come from `config/model-routing.yaml` → `runners:`. The CFO owns that file.
- A runner under the floor is skipped. A runner that returns a rate-limit error is cooled down for `cooldown_min` and the next one answers. Pools with no usage API (unknown headroom) always go last.
- Name a runner first to force it: `claude status?`, `codex: status?` (a leading `!` still works). Still subject to halt and dead-login.
- `do #196` / `run ticket owner/repo#N` → claim comment + board Status → In Progress, one-ticket manifest, `services/overnight/runner.py start`. The seat does no engineering itself.
- Every turn is appended to the **thread note** (`~/.local/state/bamware/discord-router/threads/<key>.md`) and prepended to the next prompt, so a different vendor can continue the conversation. A Discord thread is one session; top-level channel messages share one session per ET day (reset 04:00).
- Login sweep at start and every 30 min; a dead runner is skipped and `#cron` gets one line.
- Replies over 1,900 chars are chunked; very long ones become a `reply.md` attachment. Footer: `claude 4% · **codex** 70% · opencode ?%`.

## Install on omarchy

```bash
# repo checkout the seat runs in (already exists for the CFO timer)
git -C ~/code/bamware-ai worktree add --detach ~/code/worktrees/bamware-ai-main origin/main 2>/dev/null || git -C ~/code/worktrees/bamware-ai-main checkout --detach origin/main
cd ~/code/worktrees/bamware-ai-main/services/discord-router && npm install --omit=dev --no-audit --no-fund

# env (0600): DISCORD_BOT_TOKEN, DISCORD_USER_ID, DISCORD_HOME_CHANNEL, DISCORD_CRON_CHANNEL
chmod 600 ~/.config/bamware/discord.env

# runners must be logged in as the service user
claude auth status; codex login status; opencode auth list

# units
cp systemd/*.service systemd/*.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now bamware-board-cache.timer discord-router.service
systemctl --user status discord-router --no-pager
journalctl --user -u discord-router -f
```

Optional env: `BAMWARE_REPO`, `BAMWARE_ROUTING`, `BAMWARE_CFO_CAPACITY`, `BAMWARE_CFO_HALT`,
`BAMWARE_ROUTER_STATE`, `BAMWARE_BOARD_CACHE`, `BAMWARE_OVERNIGHT_STATE`, `BAMWARE_OPENCODE_MODEL`.

## Smoke test (acceptance, #196)

1. `status?` in `#chief-of-staff` → reply within 60 s, footer names the runner and three headroom values.
2. `!codex status?` then `!claude what did you just say?` in one thread → the Claude reply reflects the Codex turn.
3. Write `{"halted":true,"reason":"test"}` to `halt.json` → any message answers "CFO halt: test"; delete the file.
4. `systemctl --user restart discord-router` → bot back without manual steps.
5. `do #<ticket>` → claim comment on the issue, board Status In Progress, executor started; `#cron` shows progress.

## Add a runner

One file in `src/runners/<name>.mjs` exporting `name`, `command({prompt, meta, cwd, env})`,
`sessionFrom(output)`, optional `answerFrom(output)` and `authCheck {argv, deadPattern}`;
register it in `src/runners/index.mjs`; add it to `runners.order` in `config/model-routing.yaml`
with the pool prefixes the CFO publishes. Next up: cursor-agent, grok, qwen, kimi, gemini.

## Tests

`npm test` — pure unit tests with a fake CLI; no Discord, no model calls.
CI: `.github/workflows/discord-router.yml`.

## Header line and standups

Every reply begins `Runner: <cli>  Model: <model>  Agent: <role|NA>` (`src/header.mjs`).
The model comes from the CLI itself: Claude Code's JSON `modelUsage`, Codex's
event stream or the thread's rollout log under `~/.codex/sessions`, opencode's
`modelID` or `BAMWARE_OPENCODE_MODEL`. The last seen model per runner is cached
in `router-state.json` for replies that carry none.

`status update` / `status?` / `standup` is a standup, not a one-liner: one
runner turn, one section per role in `STANDUP_ROLES` (`src/handoff.mjs`) with
Yesterday / Today / Blockers and a closing `Needs you:` line.

## Deploying a seat change from inside the seat

The service runs from the `bamware-ai-main` worktree, and every runner it spawns
lives in its cgroup. A runner that calls `systemctl --user restart discord-router`
kills its own turn before the reply reaches Discord. Instead: merge, `git pull`
main in the worktree, then schedule the restart outside the cgroup:

```
systemd-run --user --on-active=90s systemctl --user restart discord-router.service
```

and say in the reply that the restart lands after it.
