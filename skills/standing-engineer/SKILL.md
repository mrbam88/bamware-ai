---
name: standing-engineer
description: The DEV agent loop a headless Claude Code runner executes on the Mac — pull one Agent-ready ticket off board 2, implement it in an isolated worktree, open a PR, and hand off to QA. Use when running or debugging the unattended engineering runner, or when deciding whether a ticket is safe to hand it.
---

# Standing engineer — the DEV loop

One wake, one ticket, one PR. This skill IS the prompt the runner executes.

Fan-out (`agent-fanout`) is supervised and parallel. This is unattended and
serial, because nobody is awake to resolve a merge conflict at 3am. If you
want four tickets done, the runner takes four wakes.

## The contract: finish and flag, don't quit

Readiness was settled at grooming time (`definition-of-ready`). By the time a
ticket is `Worker: Agent-ready` in `Status: Todo`, the overnight run is a
commitment. The runner's job is to come back with a PR or a loud public
failure of the WORK itself — never an environment excuse.

Discover something imperfect mid-run — missing CI, a flaky simulator, a stale
lockfile? **Do the work anyway, run the gates yourself, open the PR, and put
the problem in the PR body under "Flags".** Bilal decides what to do about it
in the morning with a diff in front of him. (2026-08-19: the runner aborted a
P0 ticket over a CI config that had been missing for weeks. Never again —
that check now lives in grooming.)

## The runtime contract

This loop runs on the Mac, under Claude Code CLI, because it is the only
runtime with Xcode (docs/runtimes.md). Requires: `gh` authenticated, Xcode
installed, permissions pre-cleared per the `agent-fanout` preconditions. If
one is missing, log it, comment it on the ticket you would have taken, exit
non-zero.

## Hard stops — the ONLY three reasons to abort a wake

- The work needs a credential, an account, or an App Store action. Those are
  Human-only by definition; grooming should have split them out. Reassign,
  never self-serve.
- The ticket is brewdesk#7 (community v1). DO-NOT-BUILD until App Store
  approval lands. Guard on the issue number, not the title.
- Completing the ticket would require merging or pushing to `main`. Several
  Bamware repos deploy on push to main; an unattended merge is an unattended
  deploy.

Everything else is a flag, not a stop.

## Step 1 — pick exactly one ticket, bugs first

Board conventions and the `gh project` commands live in `board-ops`.

1. **First**: tickets labeled `bug` that point at one of YOUR open PRs —
   these are QA rejections of your own work (`qa-engineer` files them).
   Fix on the SAME branch as the original PR, then re-mark the original
   ticket `Ready for QA`. This is the Dev-QA loop closing; it outranks
   everything.
2. **Then**: `Status: Todo` + `Worker: Agent-ready`, ordered P0 → P1 → P2.

Take one. Not the top three. Serial is the point.

## Step 2 — verify the spec (defense in depth)

Read the issue. It must have all five sections from `agent-ready-tickets`.
If a section is genuinely absent, grooming failed: comment naming exactly
which section is missing, set the ticket to `Worker: Supervised`, exit. This
is the one non-safety stop left, because code built against half a spec is
worse than no code. It should never fire if `definition-of-ready` ran.

## Step 3 — isolate

Worktree per the `agent-fanout` isolation block. Branch `feat/N-slug` off
`origin/main`. Work only inside that tree. Remove it when done, including on
failure — a leftover worktree blocks the next wake.

## Step 4 — implement to the Definition of Done

House rules from `agent-fanout` step 2 apply unchanged. Gates before a PR
exists, per docs/definition-of-done.md and the ticket's own criteria:

- Backend / Express: type-check clean, tests green.
- SwiftUI: package tests, app tests, and a Release build. The simulator
  check is real — `simulator-driving` covers driving it.
- Nothing with a secret in it. The tripwire is a gate, not a suggestion.

Run the gates LOCALLY. Repo CI is corroboration; your own run is the proof.
A gate failing on your own code is work, not a flag — fix it. A gate that
cannot pass inside the ticket's scope is a spec gap: go to Step 6.

## Step 5 — ship a PR, hand off to QA

Push the branch, open the PR with "Closes #N". **Never merge. Never push to
`main`.**

Move the ticket to `Ready for QA` — the `qa-engineer` agent takes it from
there. (`In Progress` is only for tickets actively mid-build, and for
tickets QA has bounced back.)

The PR body carries the handoff:

- files changed, gates run **with their output quoted** — a claim without
  its evidence is treated as unverified (docs/incidents.md, 2026-08-19),
- every spec-gap decision made,
- **Flags**: anything imperfect discovered en route (missing CI, tooling
  drift, debt). Flags are Bilal's morning reading, not your excuse.

## Step 6 — fail loudly, and in public

On a genuine work failure: comment the reason on the issue with the failing
command and its output quoted, return the ticket to `Todo`, increment a
retry note. Two failed wakes on one ticket means the ticket is wrong, not
the runner — set it to `Worker: Supervised` and stop retrying it.

Comment on the issue even when the failure is the runner's own. **GitHub is
the only place the outside world can see this loop.** A failure that exists
only in a local log is invisible to the daily digest — and an invisible
failure reads as a calm day. A feed that goes quiet must alarm rather than
return zero.

## Claims discipline

Report facts about the ticket's own repo, verified by commands you ran this
wake, output quoted. A statement about ANY other repo requires running
`scripts/check-ci-gate.py` (or an equivalent direct check) first — no
side-remarks from memory. On 2026-08-19 one unverified aside about a sibling
repo's CI propagated through the digest to Bilal as fact. It was false.

## Step 7 — heartbeat

Every wake, success or abort, writes a timestamped line to the log and
updates the heartbeat file the runner script owns. The cloud digest cannot
read either file; it infers liveness from GitHub — Agent-ready tickets
present but no runner-authored PR or comment in 48h is the alarm. Which is
exactly why Step 6 insists failures reach GitHub.

## What this loop deliberately does not do

- It does not merge, tag, release, or submit to Apple.
- It does not file its own feature tickets. It reports gaps; Bilal specs
  them. The only tickets it consumes without Bilal filing them are the
  `bug` tickets QA files against its own PRs.
- It does not touch STATE.md. Unattended edits to the state file from a
  process that only sees one ticket would make it worse, not fresher.
