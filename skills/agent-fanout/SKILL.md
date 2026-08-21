---
name: agent-fanout
description: Launch parallel coding agents on Bamware feature issues — worktree isolation, house-rules prompt blocks, scope fencing. Use when running a multi-agent fan-out or preparing overnight agent runs.
---

# Parallel agent fan-out

Proven pattern (first run 2026-07-22: 3 agents on dating-app issues
#2/#4/#5).

## Preconditions

- **Permissions are pre-cleared — verify BEFORE launching.** Background
  agents inherit the session's permission mode; an unattended fleet
  stalls at the first prompt (2026-07-23: 4 agents froze ~8h overnight
  on install/push prompts). Requirements:
  - `~/.claude/settings.json` has `permissions.defaultMode:
    "bypassPermissions"` + the command allowlist (set 2026-07-23), OR
    launch with `--dangerously-skip-permissions`. Repo-level
    `.claude/settings.json` only applies when the session STARTS in
    that repo — a session run from `~` never loads them.
  - Smoke-test ONE mutating command (e.g. a no-op commit in a scratch
    worktree) before launching the fleet.
  - Never flip PLAN MODE on while agents are mid-write: every agent
    action becomes an approval request (prompt storm).
- Issues are agent-ready (see skills/agent-ready-tickets) and
  **file-level orthogonal** — no two agents touch the same file.
- CI gates exist on PRs (tsc + tests + secrets tripwire).
- Explicitly assign shared files to ONE agent (e.g. only one may edit
  `src/components/index.ts` barrel) and give every other agent a
  DO-NOT-touch list naming the siblings' files.

## Isolation

Each agent creates its own git worktree (harness auto-worktrees fail
when the session root isn't a git repo):

```bash
cd ~/code/<repo> && git worktree add <scratch>/wt-issueN -b feat/N-slug origin/main
# work only there; yarn install (node_modules isn't shared)
# after push: git worktree remove --force <scratch>/wt-issueN
```

## Prompt block per agent (adapt, don't skip)

1. `gh issue view N` — the spec is the source of truth.
2. House rules: theme tokens only (Colors/Fonts/Spacing/Radius from
   src/theme), zero hex literals, optional API fields with
   render-nothing fallbacks, read neighboring files first, match style.
3. Done = `npx tsc --noEmit` exit 0 AND `npx jest --ci` green.
4. Scope fence: explicit touch-list + DO-NOT-touch list.
5. Ship: branch `feat/N-slug`, push, `gh pr create` with "Closes #N",
   commit + PR footers per repo convention.
6. Ask agents to report back: PR URL, files changed, verification
   results, and **spec-gap decisions they made** (that list improves
   the next ticket).

## After the PRs land

- Review + merge sequentially, smallest first; re-run app boot +
  simulator check after each merge (agents can't boot — Metro/simulator
  conflicts across worktrees).
- Expect ~2 clean / 1 nudge / 1 redo per 4 PRs. Redo = fix the SPEC,
  then relaunch, don't hand-patch a wrong-direction PR.
- Update STATE.md in this repo with outcomes.

## Round-2+ learnings (2026-07-23)

- Fences hold for FILES but not for RESTRUCTURES: two agents can each
  respect their scope yet still conflict when one moves code the other
  edited (discoverService round 2). Supervisor resolves the merge and
  re-runs the FULL suite on the combined tree before merging.
- Every repo agents touch needs PR-level CI first (the service repo
  didn't — we added test.yml before round 3).
- In auto-deploy-on-main repos, agents are PR-ONLY. Never let an agent
  merge into a repo that ships on push.
- Deploy-verify race: "latest run succeeded" may be the PREVIOUS
  deploy. Match the run's headSha to your merge commit before probing.
- Agents' spec-gap decision lists are gold — several became new board
  tickets (matchedName enrichment, prompt catalogs, legal URLs).

## Parallel interactive sessions (2026-08-20)

Two Claude Code terminals on one machine, each owning a ticket (brewdesk#26
and #27), is a fan-out too — the fence just has to be negotiated instead of
assigned. What worked:

- Build the collision map BEFORE picking: `ListAgents` for live peers, their
  plan files under `~/.claude/plans/`, and `git branch -r` — not the board
  alone (it was stale: merged tickets still sat in Ready for QA).
- Pick the ticket with zero file overlap; declare the fence to the peer via
  `SendMessage` (mine / do-not-touch / interfaces I will consume). The peer
  pinned the shared interface (`-UITestScenario offline`, ids) in the
  ticket body so it survives whichever session implements it.
- New files only beats shared-file edits: a second workflow file instead of
  editing `ci.yml`; a new doc instead of the one doc both tickets touch.
- Xcode: synchronized folders mean new test files need no pbxproj edit —
  the one file two iOS agents would always conflict on.
- `XCTExpectFailure` honours `continueAfterFailure = false` and ends the
  test early as "passed" — check the attachment count, not the verdict.
  Allow continuation around that one assertion only.

## Session hygiene = token cost (2026-08-21)

Measured from the local transcripts (`~/.claude/projects/*/*.jsonl`, usage
fields summed per assistant message), Aug 18–21, all Fable 5: **422M
cache-read tokens, 5M cache-write, 1.1M output ≈ $800 API-equivalent.** One
session — a 1-day-old terminal kept alive as a "QA agent" — was **$650 of
it (80%)**; four ticket sessions were $40–56 each. 99% of volume is cache
reads: a session re-reads its entire context every turn, so cost scales
with context size × turns, not with work done. Bilal is on Claude Max 20x
with **extra-usage overage turned OFF (decided 2026-08-21)** — when the
quota bar fills, the CLI pauses; there is no paid fallback, by design.

Rules:

- **One session per ticket, then exit.** Never keep a terminal alive as a
  standing QA/board agent — spawn a fresh session per QA pass or wake
  (`standing-engineer` is one wake, one ticket, one PR for this reason).
- **`/compact` past ~2–3 hours** or after any big evidence dump; a session
  that survived a compaction should grep, not re-read.
- **Never cat whole files or logs into context.** `grep … | tail`, `sed -n`
  ranges, `wc -l` first. Test output: quote the summary lines, keep the
  full log in the scratchpad and point to it. (#28's turns were ~⅓ the
  size of #29's for the same kind of work, purely from this.)
- **Sonnet for mechanical turns** (board hygiene, QA re-runs, digest
  reads) via `/model`; Fable/Opus for design and debugging only.
- **Before a fan-out, say how many sessions and how long.** Four parallel
  sessions at 20M cached tokens each is exactly the pattern that hits the
  5-hour cap; stagger instead of all-at-once.
- Check spend the same way this was measured — sum the transcripts — not
  from memory. `/usage` in the CLI shows the quota bars and whether any
  dollar figure is *extra usage* (billed) or *equivalent* (informational).

