# bamware-ai

The shared brain for Bamware's AI agents — org-level context, reusable
skills, and templates that any agent harness (Claude Code, Cursor,
opencode, cloud agents) can consume. Everything is markdown on purpose.

## Why this repo exists

Per-repo `AGENTS.md` files describe one codebase. Nothing described the
*system* — which is how a backend agent shipped an API contract change
(matches pagination, Jun 2026) that silently broke the mobile app for
six weeks. This repo is the cross-repo context that prevents that class
of failure.

## Layout

```
AGENTS.md            The system map: repos, deployed infra, contracts,
                     gates, security ground rules. Start here.
skills/              Reusable skills (SKILL.md format). Copy or symlink
                     into a project's .claude/skills/ — or paste into
                     any other tool's context.
templates/           ADR, agent-ready issue template.
```

## How to use with each tool

- **Claude Code:** symlink a skill into a repo:
  `ln -s ../../bamware-ai/skills/agent-ready-tickets .claude/skills/`
  or reference `AGENTS.md` from a repo's `CLAUDE.md`/`AGENTS.md`.
- **Cursor / opencode / anything else:** these are plain markdown —
  attach or paste as context. No lock-in.

## Rules for this repo

1. Facts only — if it's stale, it's worse than nothing. Date claims
   that will age (`as of 2026-07`).
2. Nothing secret. Ever. Names of secrets are fine; values never.
   A private repo is NOT a secrets store — secrets live in EAS
   credentials / GitHub secrets / AWS Secrets Manager.
3. Small files, one concern each. Agents load selectively.
4. **Repo-first policy:** durable knowledge lives HERE, not on
   anyone's laptop. Agent sessions may keep local working memory, but
   anything worth surviving a laptop switch gets committed and pushed
   the same session it's learned. Commit early, push often.
