---
name: standing-engineer
description: The loop a headless Claude Code agent runs on the Mac to pull one Agent-ready card off board 2, implement it in an isolated worktree, and open a PR. Use when running or debugging the unattended engineering runner, or when deciding whether a card is safe to hand it.
---

# Standing engineer — the unattended loop

One wake, one card, one PR. This skill IS the prompt the runner executes.

Fan-out (`agent-fanout`) is supervised and parallel. This is unattended and
serial, because nobody is awake to resolve a merge conflict at 3am. If you
want four cards done, the runner takes four wakes.

## The runtime contract

This loop runs on the Mac, under Claude Code CLI, because it is the only
runtime with Xcode (docs/runtimes.md). That is the whole reason it exists —
a cloud agent could do the Express work but not the SwiftUI work.

Requires: `gh` authenticated, Xcode installed, permissions pre-cleared per
the `agent-fanout` preconditions. If any is missing, log it and exit
non-zero. Never improvise around a missing capability.

## Hard stops — check before anything else

Abort the wake, log the reason, touch nothing:

- The card is not `Worker: Agent-ready`. Supervised and Human-only cards are
  Bilal's, always, no matter how easy they look.
- The card is brewdesk#7 (community v1). It is DO-NOT-BUILD until App Store
  approval lands. Guard on the issue number, not on the title.
- The card's repo has no PR-level CI. An unattended agent with no test gate
  is how silent breakage ships.
- Another runner holds the lock, or the previous wake left a worktree behind.
- The work needs a credential, an account, or an App Store action. Reassign,
  never self-serve.

## Step 1 — take exactly one card

Board conventions and the `gh project` commands live in `board-ops`. Pull
`Status: Todo` + `Worker: Agent-ready`, order P0 → P1 → P2, take the first.

Take one. Not the top three. Serial is the point.

## Step 2 — verify the spec before trusting it

Read the issue. It must have all five sections from `agent-ready-tickets`.
If it does not, do NOT guess the missing half. Comment on the issue naming
exactly which section is absent, set the card to Supervised, and exit. A
badly specced card that an agent attempts anyway produces a wrong-direction
PR, and per the fan-out lesson the fix is the spec, not the patch.

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

Gate fails and you cannot fix it inside the ticket's scope? That is a spec
gap, not a licence to widen scope. Go to Step 6 with the failure.

## Step 5 — ship a PR, never a merge

Push the branch, open the PR with "Closes #N". **Never merge. Never push to
`main`.** Several Bamware repos deploy on push to main, so an unattended
merge is an unattended deploy.

Move the card to In Progress — not Done. Done is what merging does.

Then write the handoff into the PR body: files changed, gates run and their
results, and every spec-gap decision you made. That last list is the most
valuable output of the wake. It becomes the next ticket.

## Step 6 — fail loudly, and in public

On any abort or gate failure: comment the reason on the issue, return the
card to Todo, and increment a retry note in the comment. Two failed wakes on
one card means the card is wrong, not the runner — set it to Supervised and
stop retrying it.

Comment on the issue even when the failure is the runner's own. **GitHub is
the only place the outside world can see this loop.** The daily digest runs
in the cloud with no access to this machine, so a failure that exists only
in a local log is invisible to it — and an invisible failure reads as a calm
day. Per the standing-agents thesis, a feed that goes quiet must alarm
rather than return zero.

## Step 7 — heartbeat

Every wake, success or abort, writes a timestamped line to the log and
updates the heartbeat file the runner script owns. That pair is for Bilal at
the terminal: it distinguishes "ran and found nothing" from "never fired."

The cloud digest cannot read either file. It infers liveness from GitHub
instead — Agent-ready cards present but no runner-authored PR or comment in
48h is the alarm. That is a weaker signal than the heartbeat, which is
exactly why Step 6 insists failures reach GitHub.

## What this loop deliberately does not do

- It does not merge, tag, release, or submit to Apple.
- It does not file its own tickets. It reports gaps; Bilal specs them.
- It does not touch STATE.md. Unattended edits to the state file from a
  process that only sees one card would make it worse, not fresher.
