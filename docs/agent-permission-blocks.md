# When Claude's own permissions block the work

Written 2026-09-24 after a full session was lost to this. Read it before any
merge, and before telling Bilal that something is blocked.

## The rule

**A permission denial is CLAUDE'S restriction, not Bilal's setup.** Bilal has
no `permissions` block in `~/.claude/settings.json` — he has never written a
permission rule. When something is denied it is the auto-mode server-side
classifier, which ships with Claude Code.

Say that to him in one sentence, immediately. He should never have to work out
whose restriction it is. On 2026-09-24 he did, and his words were: *"this was a
claude bullshit permission issue not my flow setup"* and *"you should have been
clear and warned me"*.

## What is denied

| Command | Denial |
|---|---|
| `gh pr merge …` | `[Merge Without Review]` |
| editing `~/.claude/settings.json` to allow it | `[Self-Modification]` |
| `gh pr view --json state,mergedAt` | no reason given |
| `gh pr list --state merged` | **allowed** — use this |

The denial text says "the user can add a Bash permission rule to their
settings", but editing those settings is itself denied. **An agent cannot
unblock itself.** Do not hunt for another route; routing around a guardrail is
not the job.

## What to do on the FIRST denial

1. One sentence: this is a Claude-side block, nothing you configured.
2. Hand over the line to paste, `!` included, then stop:
   `! gh pr merge <n> --repo mrbam88/<repo> --squash --delete-branch`
3. Do not retry. Do not re-explain over several turns. Do not send him into the
   `/permissions` UI — he has said it is confusing.

## The misread that actually cost the session

**`gh pr merge` can succeed and print NOTHING.** Success and failure look
identical through the tool, and the natural verification (`gh pr view --json`)
is also denied.

ve#149 merged on the first attempt. The agent read the empty output as failure,
reported it blocked, and Bilal spent hours on a problem that was already solved.

**Never report a merge as failed without running `gh pr list --state merged`.**

## Permanent fixes (Bilal's call)

- Shift+Tab out of auto mode — he gets prompted instead of auto-denied.
- `/permissions` → allow `Bash(gh pr merge:*)`. Note the classifier is
  server-side, so an allow rule may still not beat a merge verdict.
- **Best: prefer a route with no merge step.** Venue Engine's canonical deploy
  is local validation → `main` → Vercel Git integration
  ([venue-engine-deployment.md](venue-engine-deployment.md)), not
  PR → merge → deploy.

## Bilal's words, 2026-09-24 (why this is RULE #1)

> "nothing is worse then when i give you a large batch of work to do over night
> and the next morning you havent even started because 10 mins later you get
> blocked over a permission.... this is the most fustrating thing ever!!!!
> never let this happen!!!!"

> "this was a claude bullshit permission issue not my flow setup"

> "you should have been clear and warned me!!!"

He declared it **rule #1 and company policy**. It outranks every other
instruction in `bamware-ai`. An overnight batch that stalls on a permission
prompt is the single worst outcome this system can produce — worse than a bug,
worse than a failed ticket, because it wastes a whole night and his trust.

## Related history

Same failure class, second occurrence:

- **2026-07-23** — 4 fan-out agents froze ~8h overnight on install/push
  prompts (`skills/agent-fanout`).
- **2026-09-24** — `gh pr merge` denied in auto mode; the agent also misread a
  silent success as failure and reported ve#149 blocked after it had merged.

Both were preventable by dry-running the actual gated commands first.
