---
name: session-handoff
description: Preserve durable Bamware session context in bamware-ai and publish it. Use after verified milestones, cross-repo decisions, API contract changes, or reusable workflow discoveries.
---

# Bamware session handoff

## Capture

- Update `STATE.md` when the current build, blocker, or shipped picture changed.
- Update `AGENTS.md` only for durable system-wide facts and rules.
- Improve an existing skill when a workflow gained a reusable lesson; create a
  skill only when its trigger and procedure are distinct.
- Record API changes on both provider and consumer sides. Never trust a client
  type without checking the current backend schema.

## Exclude

- Raw transcripts, chain-of-thought, temporary debugging notes, and build logs.
- Credentials, tokens, secret values, personal data, or generated artifacts.
- Claims that were not verified against code, tests, or external state.

## Publish

1. Read the diff and remove stale or speculative statements.
2. Run the smallest relevant validation. For context changes that means
   `python3 scripts/check-context.py`.
3. Commit only intended `bamware-ai` files using a conventional commit.
4. Push to `origin/main` at meaningful milestones unless the remote diverged or
   the user paused publishing.

## Record what you read

Every commit that changes context carries a trailer naming the version the
author was working from:

```
Context-Version: 2026-08-14T18:13:24Z e5826f3
```

Take the value verbatim from `CONTEXT_VERSION` at the time you read the repo,
not at the time you commit. This is provenance: when a batch of agent work turns
out to be wrong, the trailer says exactly which bytes each agent acted on, so
the blast radius is a query instead of a guess.
