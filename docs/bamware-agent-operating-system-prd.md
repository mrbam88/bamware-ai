# Bamware Agent Operating System PRD

**Status:** Draft
**Date:** 2026-10-01
**Owner:** Bilal Malik

## Summary

Bamware needs an executive control system for managing a growing portfolio of projects and AI agents without forcing the CEO to monitor low-level execution.

The product model is organizational:

- Bilal is the Stakeholder / CEO.
- A persistent executive layer manages the company and portfolio.
- Each project has its own execution team.
- Project agents are replaceable workers.
- Durable knowledge belongs to projects and the organization, not to agent sessions.
- The CEO interface aggressively compresses execution noise into decisions, blockers, risks, and meaningful changes.

The system should make it possible to run Bamware primarily through a small number of high-value decisions.

## Problem

Bamware has many projects, experiments, client engagements, and products. Each can involve multiple agents across engineering, product, design, QA, research, and operations.

The problem is no longer access to capable agents. The problem is coordination and information overload.

Current pain:

- Too many agents and agent sessions to follow directly.
- Activity is fragmented across tools and runtimes.
- Low-level execution events drown out important changes.
- Agent state and project state are easy to confuse.
- Important blockers and decisions can get buried.
- Long-running multi-agent conversations are fragile and expensive.
- The CEO lacks one clear view of what requires attention.

## Product Vision

Bamware becomes an AI-native company operating environment.

The CEO sets direction.

Persistent executive agents manage the organization.

Project leads translate outcomes into execution.

Specialist agents perform the work.

Observability captures detailed execution.

The system continuously compresses activity upward until the CEO sees only what requires judgment.

The goal is not to maximize autonomous activity.

The goal is to minimize CEO attention while preserving complete drill-down when needed.

## Organizational Model

```text
Stakeholder / CEO
    |
Chief of Staff — executive direction and primary founder interface
    |
    +-- Engineering Lead — how it is built, and is it built right
    |
    +-- Scrum Master — what runs: delivery, pickup, follow-through
    |
    +-- CFO — on what model and budget: spend, limits, provider routing
    |
    +-- Accountant — the founder's personal finances; privileged, read-only
    |
Project engineering / research / review workers — transient execution
```

| Role | Harness | Where |
|---|---|---|
| Chief of Staff | Hermes, `default` profile (Discord bot + Assistant web) | omarchy |
| Engineering Lead | Claude Code headless (Opus), on demand: ticket shaping, PR review, batch planning, failure review | omarchy (Xcode work: the Mac) |
| Scrum Master | Hermes, `scrum-master` profile | omarchy |
| CFO | Hermes, `cfo` profile, over a deterministic routing policy | omarchy |
| Accountant | Hermes, `accountant` profile, small model, private ledger | omarchy |
| Workers | Claude Code headless, launched by the Overnight Mode executor | omarchy (Xcode work: the Mac) |

Models are chosen per profile and can change; no role is tied to a vendor.

This is the approved initial chain (founder decision, 2026-10-03). Product,
engineering, design and operations specialties can grow within it; they do not
create separate executive channels by default. Role definitions are organization
policy, not proof that every runtime capability is deployed.

### Stakeholder / CEO and escalation policy

This applies to **every agent and project**, including onboarding and handoffs.

- **Stakeholder / CEO:** sets outcomes and priorities, resolves conflicting
  executive priorities and owns reserved decisions. The CEO is not the routine
  task chaser or delivery manager.
- **Chief of Staff:** one primary assistant with two hats: COO accountable for
  healthy operations and the whole organization, and personal-life assistant /
  trusted friendly sounding board. Owns founder priorities, cross-project
  coordination and decision framing; receives delivery summaries and exceptions
  from the Scrum Master. Supports practical personal planning and thoughtful
  conversation without implying human reciprocity or exclusivity.
- **Scrum Master:** accountable for accurate task ownership/pickup, progress,
  reconciliation, stalled-work recovery, review routing, completion evidence and
  follow-through/escalation. One shared role resides on omarchy independently of
  conversations; model calls occur only when needed, not continuously. Durable
  service state, startup/restart recovery and scheduled/event processing must be
  verified before claiming resident operation.
  **Harness (founder decision, 2026-10-03):** a Hermes agent on omarchy, like
  the Chief of Staff: its own Hermes profile, `scrum-master`. It plans, tracks
  and dispatches; it does not write code. Engineering work goes to Claude Code
  workers through the Overnight Mode executor, because Hermes subagents are
  process-local and not durable workers (`docs/hermes-integration.md`).
- **CFO (founder decision, 2026-10-03):** owns AI spend, token allowances, rate
  limits and provider/model routing for every agent and project. Tasks carry a
  tier (top / mid / small) from their scope; the CFO maps each tier to the best
  available provider and model from live quota, reset times, cost and observed
  quality. Any provider is eligible: OpenAI, Anthropic, xAI, Google, open-weight.
  Paces weekly allowances, alerts on burn rate, shifts or pauses work before a
  limit is hit. Publishes the routing policy that dispatchers read; it is not a
  model call in front of every task. Others stop making spend decisions: the
  Scrum Master decides what runs, the CFO decides on what. New spend, accounts
  or API keys still need the CEO. Reports to the Chief of Staff; budget
  breaches are critical alerts. Origin: one day of `gpt-6-astra` on everything
  used ~90% of a weekly OpenAI limit (2026-10-02). Detail: #100.
- **Accountant (founder decision, 2026-10-03):** the one agent with privileged,
  read-only access to the founder's financial information (Gmail receipts and
  invoices first; other sources only with explicit approval). Keeps a private
  ledger: subscriptions, recurring charges, prices, renewal dates. Other agents
  ask it questions and get facts back, never raw emails, receipts or account
  numbers. The CFO gets plan and price facts here; live usage still comes from
  provider counters. Never pays, cancels, signs up or moves money; it
  recommends and the founder acts. Ledger lives in a private store, never in
  this repo or in tickets. Event-driven on a small model: refresh on a new
  receipt, answer from the ledger otherwise. Starts with subscriptions only.
- **Engineering Lead (founder decision, 2026-10-03):** architect and engineering
  manager, accountable for **high-quality software at low cost, not AI slop**.
  Owns and enforces the Bamware engineering constitution
  (`docs/engineering-operating-contract.md`: SOLID where it improves boundaries,
  DRY for knowledge, KISS, YAGNI, single source of truth, abstractions must earn
  their cost) and `docs/definition-of-done.md`.
  - Shapes work: turns epics into Agent-ready tickets with real acceptance
    criteria, and sets each ticket's tier (top / mid / small) for the CFO.
  - Reviews before merge: workers never self-certify. Reads the diff for design,
    duplication, test quality and scope creep; owns the QA verdict and the merge
    decision under the MVP delivery default. Store submissions, spend, data and
    security changes stay with the CEO.
  - Guards the codebase: finds redundancy and drift as repos grow, and files
    refactor tickets with a measured payoff. Owns cross-repo contracts
    (`docs/contracts.md`), ADRs (`docs/adr/`) and tech debt.
  - Routes the work: Xcode tickets to the Mac, everything else to the executor;
    reviews repeated failures to fix the ticket or the process, not just retry.
  - Absorbs the Release Manager contract and the `qa-engineer` verdict role.
  Runs on demand, not resident: when a batch is planned, a PR opens, or a ticket
  fails twice. Reports to the Chief of Staff. Peer of the Scrum Master: the Lead
  decides what is technically ready and right; the Scrum Master keeps it moving.
- **Workers:** implement, research or test within assigned authority, producing
  source-linked evidence and clear unknowns. They do not redefine priorities,
  approve their own reserved gates or silently expand scope/spend.

The two Chief of Staff hats stay together for now. This is an intentionally
lightweight, evolving role design: get the operation working and refine it from
observed use. Split COO and personal-assistant responsibilities only when real
competing demands, missed follow-through or context overload justify it, with
CEO direction. The CEO role remains with the human stakeholder.

The Chief of Staff helps the stakeholder maintain their chosen work/life
boundaries: filter routine interruptions, honor availability and priorities,
and let the Scrum Master sustain authorized delivery while the stakeholder is
away. It does not independently decide the stakeholder's personal priorities.
Keep private preferences in the private store.

Personal context and preferences belong in the private personal store, never
public repositories or engineering-worker prompts. Delegate only the minimum
work context needed. This role design grants no new calendar, email, contact or
external-action permission, and does not claim those capabilities are shipped.

Normal reporting follows workers → Scrum Master → Chief of Staff → CEO.
Escalate when authority is exceeded, priorities conflict, material risk requires
judgment, an owner capability is missing, or an explicit human gate applies.
Ordinary implementation choices stay below the CEO. A critical owner alert must
not be delayed solely to follow ceremonial routing.

Every escalation gives the concrete decision/action, impact, recommendation,
evidence and next checkpoint. Persist the Command Center card before sending a
deduplicated Discord notification; verify delivery, track owner action, recheck
the source, resume authorized work and resolve only with evidence. An
acknowledgment is not resolution. Keep independent work moving.

For incorrect or missing status/escalation, start the investigation with the
Scrum Master and trace to the specific worker/source where necessary. Preserve
worker/source evidence → Scrum Master assessment → CoS executive summary →
founder card/Discord, with timestamps, revisions, receipts and unknowns.
Accountability for follow-through does not mean the Scrum Master caused every
underlying defect. Last successful reconciliation and failures must remain
visible independently of model success. Summarize worker chatter without hiding
genuine uncertainty or loss of coverage.


### Core principle

**Org-level agents manage outcomes. Project-level agents manage execution.**

## Executive Layer

Executive roles preserve durable state across projects; distinct roles do not require duplicate services or always-running model inference.

### Chief of Staff

The Chief of Staff is the CEO's primary interface.

Responsibilities:

- Maintain current organizational priorities.
- Summarize company activity.
- Surface blockers and risks.
- Surface decisions requiring CEO input.
- Coordinate executive agents.
- Detect conflicts and dependencies across projects.
- Suppress low-value noise.
- Produce on-demand and scheduled briefings.
- Route CEO requests to the correct executive, project, or tool.
- Own executive outcomes for board follow-through; delegate delivery supervision
  and evidence reconciliation to the Scrum Master (role split approved 2026-10-03).

Primary question:

> What needs my attention?

### Chief of Staff board follow-through

The following delivery responsibilities now execute through the Scrum Master;
the Chief of Staff retains executive direction and receives summaries/exceptions.

Founder decision, 2026-10-02: the Chief of Staff should have a standing drive
to clear the board by resolving work, not by hiding or prematurely closing it.
Bilal should not have to remember to ask about forgotten tickets.

- Sweep the authoritative board and linked issues/PRs on a bounded recurring
  schedule, before briefings, and after batch handoffs. Use existing scheduling
  infrastructure; deployment and actual schedule execution need separate proof.
- Every active ticket needs an accountable owner (or explicit unassigned state),
  next action, blocker/dependency if any, last evidence and a next-check time.
  Deliberately deferred backlog is different from forgotten active work.
- Detect missing owners, requested dispatch without pickup, expired follow-up
  times, stale worker heartbeats, unresolved dependencies, unclaimed QA and
  completed research/code whose result was never returned to its requester.
- Recover available artifacts and evidence before asking Bilal to reconstruct
  context. Route authorized follow-up through the existing execution interface;
  confirm receipt and actual pickup. An issue comment, label or approval is not
  worker execution. No usable execution interface means handoff pending.
- Resolve routine coordination within existing authority. For a real founder
  decision, create a bounded Decision Queue card with context, recommendation,
  options and affected work. Keep independent work moving while it waits.
- Respect explicit pauses, scope/permission/spend boundaries and worker leases.
  Do not repeatedly nudge an active worker or silently start duplicate agents.
  Deduplicate reminders and cap retries; distinguish source outage from no work.
- Close only with acceptance evidence or an explicit cancellation/deferral
  decision, preserving the reason and outcome. Never optimize for an empty board
  by marking unfinished tickets done.
- Briefings should show recovered handoffs, remaining stuck work, real decision
  requests and next checks. Record a sweep receipt with time, coverage, source
  failures and actions; a design document is not evidence a sweep ran.

Concrete first regression case: bamware-ai#72 reports completed marketing
research whose detailed shortlist has not been reconciled into the shared
record. Recover the shortlist and present an installation recommendation before
calling this blocked on Bilal. Do not install skills or publish marketing content
without the separately applicable authorization.

Implementation status: responsibility recorded; recurring supervisor deployment,
worker routing and live sweep verification remain unconfirmed. This requirement
does not turn the existing Hermes personal assistant into a deployed Chief of
Staff automatically.

### Head of Product

Responsibilities:

- Maintain the portfolio roadmap.
- Define outcomes and major features.
- Prioritize work across projects.
- Delegate outcomes to project teams.
- Track product progress.
- Escalate product decisions.

### Head of Engineering

Responsibilities:

- Monitor technical health across projects.
- Maintain architecture and engineering standards.
- Identify systemic risks.
- Review major technical decisions.
- Escalate decisions requiring CEO involvement.

### Head of Design

Responsibilities:

- Maintain UX and visual consistency.
- Review major product experiences.
- Maintain shared design standards.
- Coordinate project-level design agents.

### Operations / Personal Ops

Potential scope:

- Company administration.
- Career workflows.
- Scheduling.
- Research.
- Personal projects.
- General executive assistance.

This scope should remain logically separate from project execution while still being available through the Chief of Staff.

## Project Layer

Each project has durable identity and context.

A project owns:

- Goals.
- Requirements.
- Features and outcomes.
- Architecture.
- Documentation.
- Tasks.
- Decisions.
- Repository references.
- Historical context.
- Agent activity.
- Cost.
- Current status.

Agents operate on behalf of the project.

Execution agents should generally be replaceable. No critical project knowledge should exist only inside an agent conversation.

## Work Hierarchy

```text
Company
  -> Project
      -> Feature / Outcome
          -> Task
              -> Agent Run
```

Example:

```text
Bamware
  -> BrewDesk
      -> Cafe Owner Onboarding
          -> Implement account creation API
              -> Backend Agent Run #482
```

This lets the CEO operate at the outcome level while preserving traceability to a specific execution.

## CEO Experience

The CEO should primarily see:

- What changed?
- What is blocked?
- What needs my decision?
- What is at risk?
- What can I ignore?

Example briefing:

```text
Bamware

3 active projects
1 blocker
2 decisions needed

Needs you
- BrewDesk: approve onboarding direction
- Client A: scope change needs signoff

Watchlist
- Project X timeline slipping

No action needed
- 14 other tasks progressing normally
```

The interface should default to hiding implementation details.

## Decision Queue

Decision management is a first-class domain concept.

The Chief of Staff should convert messy project activity into small, bounded CEO decisions.

Example:

```text
BrewDesk wants to add reservations.

Product recommends:
A. Build native reservations
B. Integrate a partner
C. Defer

Recommendation: B

[Approve] [Reject] [Discuss]
```

Another example:

```text
Engineering wants to upgrade React Native this sprint.

Impact: 2 days
Risk: Medium
Blocks current work: No

[Yes] [No] [Ask why]
```

A CEO response must become durable organizational state, not another chat message. To ensure CEO requests are findable and traceable, every CEO-originated instruction or question must have an associated GitHub issue in mrbam88/bamware-ai. If no issue exists when the CEO asks, the Scrum Master will create one immediately in the repo with the title prefixed by "CEO Request:" and include timestamps, the executing machine (e.g. X1), and receipt paths. The issue number is the canonical lookup handle for that request. The Chief of Staff and Scrum Master will not route CEO messages as ephemeral chat-only items; they become the item's comment history. This change enforces discoverability and a single source of truth. (Policy update — Scrum Master, 2026-10-04)

A decision should record:

- Context.
- Project.
- Feature or outcome.
- Decision owner.
- Options.
- Executive recommendation.
- Urgency.
- Consequences.
- CEO response.
- Timestamp.
- Downstream actions.
- Result after execution.

### Decision throttling

The system must not recreate information overload at the executive layer.

The Chief of Staff should:

- Resolve routine choices using existing policy.
- Reuse prior decisions when applicable.
- Escalate only genuinely CEO-level decisions.
- Prioritize urgent and high-impact decisions.
- Prefer a small queue of high-value decisions over a large backlog.


## Decision Domain Model

A `Decision` exists only when the system cannot safely infer the answer from existing policy, precedent, or delegated authority.

Routine choices should never become CEO work.

### Decision escalation filter

Before creating a CEO decision, the Chief of Staff should evaluate:

```text
Can existing policy answer it?
  yes -> execute

Has Bilal already made an equivalent decision?
  yes -> reuse precedent

Is this within an executive's delegated authority?
  yes -> executive decides

Is it low impact and reversible?
  yes -> proceed and log

Otherwise
  -> create CEO Decision
```

Typical CEO-level escalation reasons include:

- Missing policy.
- High impact.
- High cost.
- Irreversible action.
- Cross-project conflict.
- Executive disagreement.
- Explicit CEO gate.

Typical non-CEO decisions include:

- Library selection.
- Test retries.
- Variable naming.
- Routine implementation choices.
- Agent assignment.
- QA reruns.

### Proposed Decision type

```ts
type Decision = {
  id: string

  projectId?: string
  featureId?: string

  title: string
  context: string

  escalationReason:
    | "policy_missing"
    | "high_impact"
    | "high_cost"
    | "irreversible"
    | "cross_project_conflict"
    | "executive_disagreement"
    | "explicit_ceo_gate"

  options: DecisionOption[]

  recommendation?: {
    optionId: string
    rationale: string
  }

  urgency: "low" | "medium" | "high"

  status: "pending" | "answered" | "dismissed"

  source: {
    executive?: string
    projectId?: string
    taskId?: string
    traceId?: string
  }

  answer?: {
    optionId: string
    decidedAt: string
    note?: string
  }
}
```

The key property is `escalationReason`: every CEO decision must explain why it reached the CEO.

## Policy and Precedent Loop

The system should reduce future CEO work by converting repeated decisions into durable policy.

Core loop:

```text
Decision
  -> precedent
  -> repeated precedent
  -> proposed policy
  -> approved policy
  -> fewer future decisions
```

Example:

1. The CEO approves the same category of low-risk infrastructure change several times.
2. The Chief of Staff detects a stable pattern.
3. It proposes a standing policy.
4. The CEO approves the policy.
5. Future equivalent cases are handled automatically and logged instead of escalated.

The Chief of Staff should be able to ask:

> You've consistently approved this class of decision. Should I make it a standing policy?

A policy should define:

- Scope.
- Trigger conditions.
- Allowed action.
- Limits.
- Exceptions.
- Owner.
- Source decisions or precedent.
- Effective date.
- Review date where appropriate.

### Proposed Policy type

```ts
type Policy = {
  id: string
  title: string
  scope: {
    projectId?: string
    executiveRole?: string
    category?: string
  }

  conditions: string[]
  action: string

  limits?: {
    maxCostUsd?: number
    reversibleOnly?: boolean
    riskLevel?: "low" | "medium" | "high"
  }

  exceptions?: string[]

  sourceDecisionIds: string[]
  approvedAt: string
  approvedBy: "ceo"

  status: "active" | "paused" | "retired"
}
```

Policy matching must be explainable. When the system auto-handles something based on policy, it should record which policy authorized the action.

## Decision Learning Objective

The Decision Queue should shrink over time.

A healthy system should gradually move recurring judgment from:

```text
CEO decision
```

to:

```text
executive precedent
```

to:

```text
standing policy
```

without removing the ability to inspect or override any automated action.

The long-term measure of success is not the number of decisions processed. It is the reduction in repeated CEO decisions while preserving safety and accountability.

## Core Operating Loop

```text
Execution
  -> low-level events
  -> project teams
  -> summaries / exceptions
  -> executive agents
  -> Chief of Staff compression
  -> Decision Queue
  -> CEO decision
  -> decision propagates downward
  -> execution
```

## Interaction Model

Voice and chat are interfaces to the Chief of Staff, not separate organizational brains.

Possible clients:

- Voice.
- Discord.
- Web dashboard.
- Mobile app.
- Future messaging surfaces.

All clients should connect to the same organizational state and executive layer.

Example drill-down:

```text
"Give me the state of Bamware."
  -> company summary

"Why is BrewDesk blocked?"
  -> product / project summary

"What is the engineering issue?"
  -> project execution context

"Show me the failing run."
  -> observability trace
```

The experience should become increasingly visual and detailed as the user drills down.

## Observability

Detailed execution observability should sit below the executive interface.

Langfuse is a candidate observability layer for:

- Agent traces.
- Model calls.
- Tool calls.
- Token usage.
- Cost.
- Latency.
- Errors.
- Retries.
- Execution graphs.
- Timelines.

Every run should carry organizational metadata such as:

```text
company = bamware
project = brewdesk
feature = cafe-owner-onboarding
task = create-auth-api
agent = backend-developer
run = 482
```

Langfuse is a microscope, not the primary CEO dashboard.

## Information Layers

### Level 1: CEO

Shows:

- Portfolio.
- Major outcomes.
- Health.
- Risks.
- Blockers.
- Decisions requiring attention.

### Level 2: Executive

Shows:

- Feature ownership.
- Dependencies.
- Project plans.
- Important product and technical context.
- Team activity summaries.

### Level 3: Project

Shows:

- Tasks.
- Project agents.
- Pull requests.
- Tests.
- Design work.
- Execution status.

### Level 4: Agent Observability

Shows:

- Traces.
- Tool calls.
- Prompts.
- Failures.
- Retries.
- Model usage.
- Tokens.
- Cost.

The CEO should normally operate at Levels 1 and 2.

## Persistence Model

Persistent:

- Executive roles.
- Projects.
- Features and outcomes.
- Decisions.
- Policies.
- Organizational context.
- Project knowledge.

Replaceable:

- Individual project execution agents.
- Model sessions.
- Vendor-specific runtimes.

Likely systems of record:

- `bamware-ai` for organizational knowledge, policies, architecture, and agent context.
- Product repositories for product code and project-specific durable artifacts.
- GitHub for source code, issues, pull requests, and engineering history.
- Structured storage for runtime project, feature, and decision state.
- Langfuse or equivalent for execution telemetry.

## Existing Bamware Foundation

This product should evolve the current Bamware architecture rather than replace it.

Existing pieces already align with the model:

- `bamware-ai` is the shared organizational brain and durable cross-repo context.
- Product and service code lives in separate repositories.
- `bamware-workspace` aggregates repositories for development.
- Hermes explored standing role-based agents.
- Discord already acts as an early conversational surface.
- Existing agent portability rules keep durable context independent of model vendor.

The new work is to add a formal organizational control plane above the existing foundation.

## MVP

The first version should prioritize clarity and control rather than maximum autonomy.

### MVP capabilities

1. Project registry.
2. Feature and outcome tracking.
3. CEO portfolio view.
4. Decision Queue.
5. Blocker and risk queue.
6. Agent and task association.
7. GitHub integration.
8. Chief of Staff briefing.
9. Drill-down from Company -> Project -> Feature -> Task -> Agent Run.
10. Basic observability integration.

### First vertical slice

The first build should center on the **CEO Decision Queue**.

Flow:

1. Chief of Staff reads project state.
2. Important issues become structured decision objects.
3. Decision cards present context, recommendation, options, urgency, and owner.
4. CEO chooses an action or opens discussion.
5. The answer is stored as durable state.
6. The decision is routed to the responsible project or executive.
7. Downstream execution occurs.
8. Outcome is eventually summarized back to the CEO.

## Non-Goals for the First Version

Do not initially build:

- Fully autonomous executives.
- Giant long-running multi-agent conversations.
- General-purpose agent swarms.
- A replacement for existing agent runtimes.
- Custom model infrastructure.
- Complex autonomous scheduling.
- Deep planning engines before the basic organizational model works.

## Design Principles

### 1. Compression over chatter

The system should reduce information, not create more of it.

### 2. Outcomes over tasks at the executive layer

The CEO delegates outcomes. Project teams create and manage implementation tasks.

### 3. Durable state outside agents

Agents are workers, not databases.

### 4. Exceptions bubble upward

Routine execution remains below the executive layer.

### 5. Progressive disclosure

Any high-level status must be traceable to its underlying evidence, but details remain hidden until requested.

### 6. Runtime independence

Claude Code, Codex, LangGraph, Hermes, custom agents, and future runtimes are execution providers. The Bamware organizational model should not depend on one of them.

### 7. Less attention is the product

Success is measured by how little CEO attention is required to keep the organization moving safely.

## Long-Term Vision

The ideal CEO experience is:

```text
Everything is running.

Three things need your attention.

Here they are.
```

Bamware should become an operating system for running a company composed substantially of AI workers, while keeping human judgment at the points where it creates the most value.
