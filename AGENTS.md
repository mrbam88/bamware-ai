# Bamware — read me first (as of 2026-08-18)

Solo-founder startup (Bilal Malik, NYC) building white-label mobile apps.
Entry map for every session; details in `docs/` and `skills/`.

## First-class principle: continuity across agents

Bilal constantly switches models, vendors and harnesses. **Context must survive
every switch.** Make the next agent's job easier—even with less context or
weaker reasoning. Never rely on model memory.

- At verified milestones and after corrections, save the decision **and why**,
  exact next action, relevant paths/commands, evidence, blockers and pause state.
- Put durable procedures in canonical docs; link critical rules from entry
  instructions. Explicit precedence prevents generic defaults replacing decided
  workflows. Don't bury rules only in incident logs.
- Use capabilities and task ownership, not model names, to route work.
- Distinguish **edited locally / published / deployed**. Unpublished context
  is not available to another machine. Publish when authorized; otherwise
  explicitly flag the pending handoff. Procedure: `skills/session-handoff`;
  portability contract: `docs/portability.md`.

## 1. Where is the truth?

This repo: github.com/mrbam88/bamware-ai (public). Everything durable about
Bilal and Bamware lives here or is linked from here.

- Any copy outside git (Claude Project, vendor account, chat) is a CACHE.
  If a cache and the repo disagree, the repo wins. Never edit the cache.
- Staleness check: fetch CONTEXT_VERSION and state its contents in your
  first reply as `context: <marker>`. An answer without a version is an
  unverifiable claim.
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/CONTEXT_VERSION
- Can't reach the repo? Say so and STOP. Never work from memory or a cache.

## 2. How do I write to it?

Resolve this BEFORE starting work, and state it next to the context marker:
`write-path: composio/github` or `write-path: native git`.

| Runtime | Write path |
|---|---|
| Claude Cowork (Desktop/Web) | Composio connector → GITHUB_COMMIT_MULTIPLE_FILES |
| Claude Code CLI / Sol / opencode | native git + gh |

- A missing `gh` binary or a container-git 403 does NOT mean "no access."
  Check the connector first.
- No write path at all? STOP and hand Bilal the patch. Never write durable
  context into a vendor cache instead.
- New facts go to this repo, never to chat. Ending a session that made
  decisions? Run the session-handoff skill.

## 3. How does Bilal work?

- Short and sweet. Bullets over prose. No re-summaries. Limit his reading.
- Direct recommendations, not option menus. Plan before building.
- RN + Express mental model; mobile/Node analogies land.
- Specs are GitHub issues: story / scope / out-of-scope / acceptance criteria.
- Tool use proportional to the ask. Fan-outs need an explicit ask.
- Never mention Baat in responses or career materials (Bilal, 2026-09-16).
  Project wording: skills/bilal-answers.

## Before you touch these, read the linked doc first

- **Deploying Venue Engine? Read `docs/venue-engine-deployment.md` first.**
  Default: local validation → direct deployment to the existing Vercel project.
  Actions is NOT a prerequisite. Resolve this before PR/CI planning or CI spend.
  Missing tool/auth access does not authorize switching to CI. This overrides
  generic release sequencing, not checks required for an actual PR merge.
- Committing anything? Never commit credential values or PII — this repo is
  public. Rules: docs/security.md
- Changing a service API response shape? It breaks the mobile app silently.
  Read docs/contracts.md first.
- App Store submissions: don't resubmit the rejected dating concept. Make
  differentiation visible in the binary and listing. BrewDesk was approved
  2026-09-12; evidence and template: docs/app-review-field-notes.md.
- About to run git or Xcode from Cowork? Check docs/runtimes.md first.
- Merging agent PRs? QA merges after CI green + evidenced QA pass
  (adopted 2026-08-21). Bilal-only gates: store submission, spend,
  CI/signing/deploy config, cross-repo contracts. See skills/qa-engineer.
- **HARD SPEND RULE:** anything that could cost **more than $20** requires
  an immediate STOP and Bilal's explicit permission, even mid-task. Below $20,
  paid runs still require a prior quote-and-confirm with a cheapest-option
  offer. Prefer free. Mobile builds/uploads use local Mac tooling; Actions is
  BACKUP only. Agent usage consumes quota too. Before agent runs, read
  `docs/token-diet.md` for model-cost defaults, session hygiene and budgets.
  No idle polling loops. Overnight procedure: `skills/night-supervisor`.
- Models/harnesses are interchangeable; machine capabilities are not. Only
  the M3 Mac can do Xcode, iOS simulators, signing or physical-iPhone smoke.
  Before Apple work, read `docs/machines.md`; reassign rather than improvise.

## Table of contents — read on demand

| Need | Where |
|---|---|
| All repos: what each is, deploy targets, endpoints | docs/repos.md |
| Venue Engine release route, local checks, direct Vercel deployment | docs/venue-engine-deployment.md |
| Which runtime can do what (capability matrix) | docs/runtimes.md |
| Bilal's rig: machines, displays, gear | docs/machines.md |
| Security rules: credentials, PII, accounts | docs/security.md |
| Cross-repo API contracts | docs/contracts.md |
| App Review / 4.3(b) evidence base, what works | docs/app-review-field-notes.md |
| Current state: building / blocked / shipped | STATE.md |
| CRM context | docs/bamware-crm.md |
| All skills (procedures) | skills/INDEX.md |
| Interview prep: what to study, what's dead | docs/interview-prep/README.md |
| Definition of done, test gates | docs/definition-of-done.md |
| Brand, design tokens | docs/brand.md |
| Why these context rules exist (incident history) | docs/incidents.md |
| Session-end ritual: what to save, how to publish | skills/session-handoff |
| Running this setup on other vendors | docs/portability.md |
