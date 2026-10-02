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

## Tell Discord

After publishing a milestone, post one line to the Bamware status channel with
`scripts/discord-post.sh "..."` (docs/discord.md). Lead with what Bilal needs to
do, if anything. Skip it if the machine has no webhook configured.

## Completion alerts and Command Center

Bilal's directive (2026-10-02): Discord is his push-alert channel. Return completed
work through the chief-of-staff bot and show it on the relevant Command Center
card; a chat reply, commit or issue update alone is not delivery.

For a requested completion handoff, report the exact completed milestone, evidence
link, remaining work, next owner/pickup state and any real decision needed. Keep
milestone completion distinct from whole-ticket closure. Mention Bilal through the
existing assistant bot channel for the completion alert, with bounded mentions.
Verify the posted message by reading its ID back; record a durable receipt keyed
by ticket + milestone/evidence revision to avoid repeated alerts. Verify the live
authenticated card separately. Discord acceptance does not prove phone push delivery.
Do not fabricate an approval gate or worker pickup to populate a decision card.

Current automation is incomplete: #72's research receipt and deployed card were
verified manually; generic recurring completion detection/reconciliation is tracked
in #79. A future milestone still needs an executing agent to return its result.
See `docs/discord.md` for the concrete receipt and runtime details.

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
