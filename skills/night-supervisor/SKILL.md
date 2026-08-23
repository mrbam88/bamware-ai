---
name: night-supervisor
description: Run the overnight queue — one local Claude Code session started at bedtime that works `night`-labelled tickets sequentially, one Sonnet DEV agent per ticket, QA-merges on quoted evidence, and leaves a morning STATE.md report. Use when starting, running, or debugging a bedtime/overnight agent session.
---

# Night supervisor — the bedtime loop

Bilal labels tickets `night` before bed, sleeps, wakes to merged PRs and a
report. This session IS both DEV-launcher and QA — see `agent-fanout` for
isolation/prompt mechanics, `qa-engineer` for the merge rules it inherits
unchanged.

## 1. Preconditions (verify before the first agent)

- Permissions pre-cleared (`bypassPermissions` or
  `--dangerously-skip-permissions`, `agent-fanout` preconditions);
  smoke-test one mutating command first.
- `gh auth status` green; simulators/Xcode idle (§4); every touched repo has
  a clean `main` to worktree from.
- Note each repo's CI status once (`check-ci-gate.py`) — no gate isn't a
  stop, just less corroboration to trust.

## 2. Get the queue

```bash
scripts/night-queue.sh          # repo#N  P?  title  url, priority-ordered
scripts/night-queue.sh --json   # same, machine-readable
```

Zero tickets is a normal, successful night — report it and stop, don't
invent work. Take tickets in the order printed.

## 3. Per ticket

1. **Definition-of-ready check** (`definition-of-ready`, all six). Fails →
   comment naming the gap, `Worker: Supervised`, skip to next ticket.
2. **Worktree**: `/private/tmp/<repo><N>`, branch `feat/N-slug` off
   `origin/main` (isolation block, `agent-fanout`).
3. **Launch ONE agent** — Sonnet for code, Haiku for docs-only — with the
   prompt block below.
4. **Supervisor QA** on the returned evidence: run the gates yourself, walk
   acceptance criteria, check scope + secrets tripwire (`qa-engineer`,
   unchanged). Its human-gate exceptions still apply — stop at
   `Ready for QA`, comment why, do not merge, move on.
5. **Merge** (merge commit, delete branch) when clean.
6. **Deploy-path check**: diff touching `api/`, `vercel.json`, or cold-start
   init gets one curl against the deployed instance post-merge (`qa-engineer`
   deploy-path rule) — no polling.
7. Remove the worktree. Next ticket.

### Standard agent prompt block

```
You are the DEV agent for <repo>#<N>. Spec: `gh issue view <N> -R mrbam88/<repo>`
— it is the whole prompt, nothing implied.

House rules: read neighboring files first and match style; theme tokens only
where the repo has a theme system; optional fields render-nothing on absence.
Scope fence: touch only files in this ticket's Scope, nothing in its Out of
scope, work only inside this worktree.

Gates before you claim done: run this repo's real gates yourself (tsc/tests
for Node, package+app tests and a Release build for SwiftUI) — quote command
and output for every gate and criterion. Unquoted = unverified.

Hard stops — abort and comment on the issue instead of continuing: any
credential/account/App Store action, any spend, any CI/signing/deploy-config
or cross-repo API contract change. Human-gate surfaces, never yours to cross.

Token hygiene: grep/sed -n, not cat; quote log summaries, not full logs; no
screenshots into the model — snapshot tests / a11y / captures as PR evidence
only; `-only-testing` while iterating, full suite once before PR. Budget:
<doc ≤100k / small ≤150k / feature ≤300k / refactor ≤250k> (token-diet.md)
— stop and report at +50% over.

Ship: rebase onto current `origin/main`, push `feat/<N>-slug`, `gh pr create`
with "Closes #<N>". PR body = files changed + gates with output quoted +
spec-gap decisions + Flags. Never merge, never push to main.

Report: PR URL, gate evidence, measured tokens/tool-uses.
```

## 4. Concurrency

ONE Mac-bound (simulator/Xcode) agent at a time — parallel Mac agents caused
simulator contention and stalls before (`token-diet.md`). Doc agents may run
alongside it; max 2 total.

## 5. Budget guard

Budgets: see the prompt block above. At +50% over: stop, post current state
+ token count, comment `parked: over budget`, move to next ticket.

## 6. Stall handling

An agent reporting "waiting on a background run" gets ONE nudge via
`SendMessage`, after confirming the run is actually alive (`pgrep xcodebuild`
or the equivalent — never nudge a genuinely-running process). Second stall on
the same ticket: supervisor finishes it from the worktree, or parks it
`parked: stalled twice` and moves on. Never let a stall block the queue.

## 7. Never overnight

Spend of any kind; CI/signing/App-Store-submission/deploy-config changes;
cross-repo contract changes; visibility flips a human should see first;
force-push anywhere — the `qa-engineer` human-gate list plus the
`standing-engineer` hard stops, no looser version for being unattended.

## 8. Morning report

One dated entry in this repo's `STATE.md`: merged (PR links) / parked-human
(why + issue link) / skipped-over-budget (measured tokens), per ticket.
Commit, push, `PushNotification` if available. Never touch another repo's
STATE.md.

## 9. Cleanup

Remove every worktree created tonight (`git worktree remove --force`), no
stray branches for merged tickets, simulators shut down — a leftover
worktree or hot simulator blocks tomorrow's queue.

## Mac concurrency trap (measured 2026-08-23)

Two agents running `xcodebuild` in different worktrees share the default
DerivedData and block on each other's lock at 0% CPU for 20+ minutes —
it looks like a hang and costs a supervisor nudge each time. Rule: every
agent prompt that runs xcodebuild MUST pass `-derivedDataPath
/private/tmp/<worktree>-dd`, run gates in the foreground with `timeout`,
and never `xcrun simctl shutdown all`. Verify a "waiting" agent with
`ps -o etime=,pcpu= -p $(pgrep -f xcodebuild)` — 0.0 CPU after 5 min = stuck.
