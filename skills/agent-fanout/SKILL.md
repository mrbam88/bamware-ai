---
name: agent-fanout
description: Launch parallel coding agents on Bamware feature issues — worktree isolation, house-rules prompt blocks, scope fencing. Use when running a multi-agent fan-out or preparing overnight agent runs.
---

# Parallel agent fan-out

Proven pattern (first run 2026-07-22: 3 agents on dating-app issues
#2/#4/#5).

## Preconditions

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
