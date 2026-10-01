# Release Manager Contract

Purpose: keep Bamware products moving through a lightweight continuous-delivery loop without sprint ceremony.

## Scope

GitHub is the execution source of truth. The Release Manager acts on repository state; it does not replace product strategy, invent requirements, or create a second project-management system.

This contract sits under the Chief of Staff layer and above product-specific engineering/release rails.

## Flow

`Backlog → Ready → In Progress → Review → Release Ready → Shipped`

A ticket may also be `Deferred`, `Human Only`, or `Not Planned`.

## Hard rules

1. **WIP limit = 2.** Never have more than two agent-ready implementation items in progress for a product.
2. **Only Ready work is pulled.** Backlog does not imply authorization to build.
3. **Deferred/post-approval work stays out of the active queue** until explicitly promoted.
4. **Human-only work never blocks independent work.** Surface it as `Needs You`, park that action, and continue authorized work.
5. **Do not clean the board by lying.** Never close valid future/deferred work merely to reduce counts.
6. **Use the engineering operating contract.** SOLID/DRY/KISS/YAGNI, explicit ownership/dependencies, testability, single source of truth, lightweight spec-first flow when ambiguity warrants it.
7. **PR + evidence before merge.** Small tested changes; QA/review and CI evidence must support merge.
8. **Release only coherent green batches.** A batch becomes Release Ready when all selected items are merged and required checks are green.
9. **Use the existing product release rail.** Do not rebuild deployment. For BrewDesk, use the established automated agent/TestFlight path.
10. **Verify delivery before Shipped.** A merged commit is not a shipped release. Confirm the build/deployment state before marking the batch Shipped.
11. **Exceptions wake Bilal; routine work does not.** Surface only human decisions/actions, failed release rails, or meaningful release outcomes.
12. **Then pull again.** Once a batch is shipped or safely parked, refill available WIP from Ready.

## Selection policy

When WIP has capacity, choose the highest-priority Ready items that are:
- release-relevant,
- agent-ready,
- independently executable,
- small enough to complete and verify cleanly.

Prefer fixing correctness, regressions, accessibility, and release-quality bugs before discretionary polish. Do not infer urgency from age alone.

## State semantics

### Backlog
Valid work, not yet selected for execution.

### Ready
Clear enough to execute now with no unresolved product decision or known human gate.

### In Progress
An agent is actively implementing the item.

### Review
Implementation exists and is awaiting review, QA evidence, or CI.

### Release Ready
The selected batch is merged and all required checks are green; product release rail may run.

### Shipped
The resulting build/deployment has been verified as delivered through the established release rail.

### Deferred
Intentionally postponed. It remains valid work but must not be pulled automatically.

### Human Only
Requires Bilal or another human-controlled external action. Show as `Needs You`; do not let it stall unrelated work.

### Not Planned
Explicitly rejected/superseded/duplicate work. Close with an honest reason.

## Per-run algorithm

1. Read repo/project state, open PRs, CI, recent merges, and current release state.
2. Reconcile stale status against reality.
3. Classify active items using the states above.
4. If WIP < 2, pull Ready work until WIP = 2 or no Ready items remain.
5. Advance In Progress/Review work through implementation, tests, PR, review, and merge.
6. When the batch is green, run the existing release rail.
7. Verify delivery.
8. Mark completed batch Shipped.
9. Surface only actionable exceptions or meaningful release outcomes.
10. Repeat on the next scheduled run.

## Product adapter

Each product may define:
- repository/repositories,
- project/board mapping,
- required CI checks,
- release rail,
- human-only gates,
- release verification method.

The core state machine and rules above should stay shared across Bamware.

Current adapters:
- BrewDesk iOS: first implementation (repo: `mrbam88/bamware-brewdesk`)
  - Venue Engine service: `docs/release-manager-adapters/brewdesk-venue-engine.md`
- Bamware Web: `docs/release-manager-adapters/bamware-web.md`
