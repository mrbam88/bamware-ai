# Bamware factory manual

How to run the software factory from Discord. One page. Since 2026-10-20 (ADR 0002).

## The idea in three lines

- You talk to **one seat** in `#chief-of-staff`. It answers as one voice.
- Behind it, whichever agent CLI has quota does the thinking: Claude Code, Codex, opencode, more later. The seat picks; you don't have to.
- The seat **routes, never executes**. Engineering goes to the Overnight executor, one ticket at a time, and comes back as a PR.

## Talking to the seat

| You type | What happens |
|---|---|
| `status update` / `status?` / `standup` | a **standup**: every role (Scrum Master, Engineering Lead, CFO, Chief of Staff, Accountant) gives Yesterday / Today / Blockers, then one `Needs you:` line. Up to 250 words |
| anything else, e.g. `newest open PR?` | best runner by headroom answers in under 100 words |
| `claude …` / `codex …` / `opencode …` first word | forces that runner (`!claude` works too) |
| `Scrum Master, …` / `CFO, …` / `Engineering Lead, …` | the runner wears that role's skill for this message |
| `do #196` or `run ticket owner/repo#N` | claims the ticket, starts the executor, reports in `#cron`, finish line back to you |
| a message in a **thread** | its own conversation; the channel itself is one conversation per day (resets 04:00 ET) |

Every reply starts with one header line (Bilal, 2026-10-20):

```
Runner: Claude  Model: Fable 5.1  Agent: Scrum Master
```

Runner is the CLI that answered (Claude, Codex, opencode, or Seat when the router replied itself). Model is what that CLI reported using. Agent is the role the message named, the standup roster, or `NA`.

Reply footer, always: `claude 85% · **codex** 100% · opencode 82%`. Bold is who answered. `?%` means the CFO has no reading for that pool yet.

## How the seat talks (Bilal, 2026-10-20)

Plain English for a founder on a phone. No internal jargon, codenames,
abbreviations or commit hashes. Say what a thing is and what it means for
Bilal, in that order: "the spending kill-switch is off, so agents may run",
never "CFO halt: absent". Lead with the one thing he needs to know or do; if
nothing needs him, one sentence says so. Under 100 words.

Why: the 2026-10-20 status reply ("All green", "CFO halt: absent") was
unreadable to him. Replies he cannot parse hide signals and cause bad approvals.

## What the seat will tell you instead of doing

- **`CFO halt: <reason>`** — the CFO stopped all spend. Nothing runs until the halt file is removed. This is Rule #1 working, not a bug.
- **`Every pool is under the floor`** — every vendor is near its limit; the reply names the earliest reset. Wait, or force a runner.
- **`<runner> is logged out on the server`** — log that CLI in on omarchy (`ssh omarchy`, then `claude auth login`, `codex login`, or `opencode auth login`).
- **`needs you: <command>`** — a runner hit something only you can do. Run the command, say "done".

## The daily loop

1. **Morning:** `status update`. Every role reports Yesterday / Today / Blockers. That is the checkpoint.
2. **Pick work:** `do #N` for each Agent-ready ticket you want moving. One ticket, one PR, one worker. Don't dispatch two tickets that touch the same files.
3. **Decide:** PRs that pass QA get merged by the agents. Store submissions, spend over $20, and secrets wait for you, by policy.
4. **Evening:** `status update` again. Anything "stuck > 1 cycle" gets split, reassigned, or cut.

## Where things live

| Thing | Place |
|---|---|
| rules every agent reads | `AGENTS.md`, `STATE.md`, `skills/`, `CONTEXT.md` (glossary) |
| which runner, in what order, the headroom floor | `config/model-routing.yaml` → `runners:` (CFO owns it) |
| the board | GitHub Project 2; cached every 10 min for reads |
| conversations | `~/.local/state/bamware/discord-router/threads/` on omarchy |
| quota readings and the halt | `~/.local/state/bamware/cfo/capacity.json`, `halt.json` |
| the seat's code and install | `services/discord-router/README.md` |

## If the seat goes quiet

```
ssh omarchy
systemctl --user status discord-router --no-pager
journalctl --user -u discord-router -n 30 --no-pager
systemctl --user restart discord-router
```

## Adding a vendor

One file in `services/discord-router/src/runners/`, one line in `config/model-routing.yaml`, log the CLI in on omarchy. The README has the template. Next: cursor-agent, grok, qwen, kimi, gemini.
