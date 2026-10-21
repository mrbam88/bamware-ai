# Bamware Engineering Operating Contract

**Status:** Active
**Date:** 2026-10-01
**Scope:** All Bamware software projects and engineering agents

This document defines the lightweight engineering contract underneath the Bamware Agent Operating System. Principles come first. Process exists only to protect quality and reduce wasted work.

## 1. Engineering Constitution

Bamware engineering should optimize for changeability, clarity, testability, and low operational drag.

### Core principles

- **SOLID where it improves boundaries.** Use single responsibility, explicit interfaces, and dependency inversion when they make code easier to change and test.
- **DRY for knowledge, not syntax.** Do not abstract merely because two code blocks look similar. Prefer duplication over the wrong abstraction.
- **KISS by default.** Choose the simplest design that satisfies current requirements.
- **YAGNI aggressively.** Do not build extension points, frameworks, or generality without a real current need.
- **Explicit ownership.** State, behavior, and decisions should have one obvious owner.
- **Explicit dependencies.** Prefer dependency injection and visible composition over hidden globals or service locators.
- **Single source of truth.** Avoid duplicated state and mirrored facts that can drift.
- **Testability by construction.** Important behavior should be isolatable and verifiable without heroic test setup.
- **Composition over inheritance.** Prefer small composable modules and protocols/interfaces where they create useful seams.
- **Thin composition roots.** Apps wire modules together; business logic belongs in owned modules.
- **Shared modules stay generic.** Product-specific behavior remains in the product layer.
- **Simple and explicit beats clever.** Readability and maintainability win over novelty.
- **No architecture for architecture's sake.** Abstractions must earn their cost.

These principles outrank any workflow, framework, tool, model, or agent preference.

**Owner: the Engineering Lead** (founder decision, 2026-10-03). It enforces this
constitution on every PR, finds redundancy and drift as codebases grow, and
files refactors with a measured payoff. Goal: high-quality software at low
cost. Role: `docs/bamware-agent-operating-system-prd.md` → Engineering Lead.

### Worker hard stops

Carried over from the retired standing engineer (2026-10-03). A worker stops
and hands back only when:

- the work needs a credential, an account, or an App Store action (Human-only;
  reassign, never self-serve);
- the ticket is marked DO-NOT-BUILD (guard on the issue number, not the title);
- finishing would need a direct push to `main`. Several repos deploy on push;
  changes reach `main` only through a PR the Engineering Lead approved.

Everything else is a flag in the PR body, not a stop.

### One deployed copy — no collisions

Added 2026-10-03 after five collisions in one audit (docs/incidents.md). The
Engineering Lead enforces these in every review and deploy:

- **Production runs only from a git checkout of `main`**, detached at a known
  commit (on omarchy: `~/code/worktrees/bamware-ai-main`). Never a hand-copied
  folder, never a feature branch, never a `.claude/worktrees` directory.
- **Services merge to `main`.** A PR that targets a feature branch does not
  ship a service; it parks it.
- **Code is generic; batch and run facts are data.** Ticket numbers, PR
  numbers, branches, dates and machine paths go in a config or state file,
  never in a service's source. A hard-coded one is a review rejection.
- **One copy of each script.** A second copy is a fork; delete it or make it
  the source and delete the other.
- **Drift is checked, not assumed:** deployed code is compared with `main`
  before a deploy and on a schedule.

## 2. Lightweight Delivery Workflow

Default flow:

```text
clarify when needed
  -> spec
  -> agent-ready ticket
  -> implement
  -> review / QA
  -> handoff
```

The flow is intentionally light. Skip ceremony that does not reduce risk or ambiguity.

### Matt Pocock skills

Use Matt Pocock's skills as tools, not mandatory rituals:

- Ambiguous or high-impact work -> `grill-with-docs`, `to-spec`
- Turn approved work into execution -> `to-tickets` plus Bamware `agent-ready-tickets`
- Implementation -> `implement`
- TDD when valuable -> `tdd`
- Review -> `code-review` plus Bamware QA
- Bugs with unclear cause -> `diagnosing-bugs`
- Continuity -> `handoff`
- Architecture/domain work -> `wayfinder`, `domain-modeling`, `codebase-design` only when justified
- Retros -> only after meaningful failures or repeated friction

### TDD rule

Use TDD when failure is costly, subtle, regression-prone, or core to business logic. Do not force TDD for trivial UI polish or mechanical changes where it adds ceremony without confidence.

### Review rule

DEV does not self-certify. A separate QA or review pass verifies acceptance criteria and required gates.

### MVP delivery default — founder decision, 2026-10-02

Bamware is in its MVP phase. Bias toward publishing and deploying useful,
reversible work through the existing release rail. Routine publication, merge
and reversible application deployment within approved feature scope do not need
another founder confirmation merely because optional QA is incomplete.

- Publish completed code and a useful result report promptly. Failed or partial
  QA must not hide commits, test evidence, limitations or the actionable failure.
  Never publish credentials or private data as part of a diagnostic report.
- Distinguish an actual defect, an unavailable check, and an orchestration/tool
  failure. A QA process exit code alone is not a product verdict. Evaluate the
  recorded evidence and the relevance of any missing coverage to this change.
- Run the applicable automated checks and a proportionate smoke check. Ship
  reversible MVP improvements when available evidence supports them; disclose
  optional coverage gaps and follow up. Do not add a new approval gate because
  a browser tool or reviewer was unavailable. Required external branch rules
  still apply; do not bypass enforced protections.
- Preserve a known-good revision and concrete rollback procedure, verify the
  deployed behavior, and roll back a failed smoke check. Rollback is operational
  recovery, not a reason to avoid ordinary deployment indefinitely.
- Actual auth/privacy failures, credible data-loss risks or broken core flows
  must be fixed or isolated before release. Destructive data changes, new spend,
  account/security-access changes and store submissions retain their specific
  authorization requirements; this default is not blanket authority for them.
- Completion reports must separate published, tested and deployed. A partial
  report states exactly what works, what is missing and the next action. Missing
  live data cannot be described as a working live integration.

This decision supersedes older blanket “QA unavailable means stop” or
“production rollout always needs another approval” assumptions for routine,
reversible application delivery. It does not weaken verification or authorize
invented success. Keep the nightly delivery report available even when code
publication or deployment fails.

## 3. Execution and Executive Control

### GitHub owns execution

GitHub is the operational system of record for:

- Issues and tickets
- Project boards
- Status
- Milestones
- Pull requests
- Reviews
- Execution history

Do not rebuild Jira inside Bamware.

### bamware-ai owns organizational context

`bamware-ai` is the organizational system of record for:

- Engineering principles
- Policies
- Cross-project context
- Durable decisions
- Architecture constraints
- Agent procedures
- Executive control semantics

### Bamware control plane owns executive attention

The control plane translates GitHub execution state into:

- Outcomes
- Risks
- Blockers
- Decisions
- Policies
- Exceptions
- Briefings

The Chief of Staff should never need to care which engineering skill ran. It should care about outcome state, risk, blockers, and whether Bilal's judgment is required.

## 4. Escalation Principle

Agents and project teams should resolve implementation detail below the executive layer.

Escalate only when:

- Existing policy cannot answer the question.
- Authority is exceeded.
- Risk or cost crosses a defined threshold.
- The action is meaningfully irreversible.
- Projects or executives conflict.
- Bilal explicitly owns the gate.

Everything else should continue without creating CEO noise.

## 5. Success Criterion

A healthy system lets project teams execute with strong engineering quality while reducing Bilal's attention burden.

The target experience is:

```text
Everything is moving.

A few things need your judgment.

Here they are.
```

If process creates more noise, delay, or token spend than the risk it removes, simplify it.

## 6. Minimal Technical Documentation

**Founder requirement, 2026-10-02:** Every shipped component or meaningful
engineering change needs a short, discoverable explanation for the founder
and the next agent. Keep this high-level and proportional to the work.

Maintain the existing README or nearest technical overview with:

- What the component does and which problem it solves.
- How the main components connect; include a small diagram when it clarifies
  the flow. For automation, distinguish event triggers and scheduled checks.
- Where durable state lives, its source of truth, and important dependencies.
- How to run or verify it, where failures appear, and the basic recovery path.
- What is actually deployed versus planned, including meaningful limitations.

A few clear paragraphs are usually enough. Update documentation alongside
behavior changes, link it from the project entry point, and include its
accuracy in review. Reuse existing documentation rather than duplicating it.
Do not substitute tickets, conversation history, exhaustive code narration,
or long process manuals for this overview. Keep credentials and private
operational data out of public documentation.
