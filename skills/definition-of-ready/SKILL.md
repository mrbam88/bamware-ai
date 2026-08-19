---
name: definition-of-ready
description: The grooming gate a ticket must pass BEFORE it is marked Agent-ready. Run while Bilal is awake, so nothing fails at 3am over something checkable at 3pm. Use when grooming the backlog, filing tickets, or deciding whether the overnight runner may take a ticket.
---

# Definition of Ready — the grooming gate

The overnight run is a sprint commitment. Once a ticket is Agent-ready and in
Todo, the runner does NOT re-litigate whether the ticket deserves work — it
works. Every predictable reason to stop must therefore be caught here, at
grooming time, by a human-supervised session.

Why this exists: on 2026-08-19 the runner aborted a P0 ticket at night over a
missing CI config that had been missing for weeks. Nothing about that was a
surprise; it was just checked at the worst possible time. Grooming is where
that check belongs.

## The checklist — all six, in order

A ticket may be set to `Worker: Agent-ready` only when ALL pass:

1. **Spec is complete.** All five sections from `agent-ready-tickets`
   (Story / Scope / Out of scope / Acceptance criteria / Context). No
   section may be implied. The spec IS the prompt.
2. **The repo has a runnable gate.** Run `scripts/check-ci-gate.py <repo>`.
   PASS means a workflow triggers on pull_request AND runs real tests.
   If it fails, the ticket can still be groomed — but fixing CI becomes a
   ticket that lands FIRST, or the acceptance criteria explicitly name the
   local gate commands the agents must run instead.
3. **No human-held resources.** No credentials, no App Store actions, no
   account signups anywhere in scope. Those parts get split out as
   Human-only tickets before this one is Agent-ready.
4. **Right runtime exists.** SwiftUI/Xcode work needs the Mac runner;
   Express/Node work can run anywhere. A ticket whose runtime is offline
   is not ready, no matter how good the spec is.
5. **Sized S or M.** L tickets are split first — one agent, one run, one PR.
6. **Orthogonal.** No other Agent-ready ticket touches the same files.

## What passing means

- Set `Worker: Agent-ready`, `Status: Todo`, all board fields per `board-ops`.
- The runner now owes you a PR or a loud public failure — nothing in between.
  "The repo wasn't set up right" is no longer an acceptable overnight outcome,
  because this checklist already proved it was.

## What failing means

- The ticket stays `Worker: Supervised` with a comment naming exactly which
  check failed. Fix it in daylight.

## Who runs this

Bilal plus whatever session is grooming with him ("Product agent"). Never the
overnight runner — by the time the runner sees a ticket, readiness is settled.
