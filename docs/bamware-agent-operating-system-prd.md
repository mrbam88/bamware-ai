# Bamware Agent Operating System PRD

**Status:** Draft
**Date:** 2026-10-01
**Owner:** Bilal Malik

## Summary

Bamware needs an executive control system for managing a growing portfolio of projects and AI agents without forcing the CEO to monitor low-level execution.

The product model is organizational:

- Bilal is the CEO.
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
Bilal
CEO
|
+-- Chief of Staff
|
+-- Head of Product
|
+-- Head of Engineering
|
+-- Head of Design
|
+-- Operations / Personal Ops
        |
        v
   Bamware Portfolio
        |
        +-- Project A
        |    +-- Project Lead
        |    +-- Dev agents
        |    +-- QA agents
        |    +-- Design agents
        |
        +-- Project B
        |    +-- Project Lead
        |    +-- Dev agents
        |    +-- Research agents
        |
        +-- Client Project C
             +-- Project Lead
             +-- Dev agents
             +-- QA agents
```

### Core principle

**Org-level agents manage outcomes. Project-level agents manage execution.**

## Executive Layer

Executive agents are persistent and operate across projects.

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

Primary question:

> What needs my attention?

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

A CEO response must become durable organizational state, not another chat message.

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
