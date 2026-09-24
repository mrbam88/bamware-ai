# Bamware — read me first (as of 2026-08-18)

Solo-founder startup (Bilal Malik, NYC) building white-label mobile apps.
Entry map for every session; details in `docs/` and `skills/`.

## 🚨 READ FIRST — a permission denial is CLAUDE'S fault, never Bilal's

Bilal has **no permission rules configured**. If `gh pr merge` (or anything)
is denied, it is auto mode's built-in classifier — say that to him in one
sentence immediately. He must never have to work out whose restriction it is.
You cannot unblock yourself: editing settings to allow it is denied too.

**First denial → one sentence + the line to paste, then STOP.** No retries, no
alternative routes, no sending him to `/permissions` (he finds it confusing).

**`gh pr merge` can succeed and print NOTHING.** Always check
`gh pr list --state merged` before saying a merge failed — ve#149 had already
merged when it was reported blocked, and that misread cost a whole session.

Full detail: [docs/agent-permission-blocks.md](docs/agent-permission-blocks.md)

## First-class principle: continuity across agents

Bilal constantly switches models, vendors and harnesses. **Context must survive
every switch.** Make the next agent's job easier—even with less context or
weaker reasoning. Never rely on model memory.

- At milestones and after corrections, save the decision **and why**, the next
  action, paths/commands, evidence, blockers and pause state.
- Durable procedures go in canonical docs, linked from here. Never bury a rule
  only in an incident log.
- Route work by capability, not model name.
- Distinguish **edited locally / published / deployed** — unpublished context
  does not exist for the next machine. Procedure: `skills/session-handoff`;
  contract: `docs/portability.md`.

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
  Local validation → the existing Vercel project. Actions is NOT a
  prerequisite; an access gap never authorizes CI or CI spend.
- Committing? Never commit credentials or PII — public repo. docs/security.md
- Changing a service API response shape? It breaks the mobile app silently.
  Read docs/contracts.md first.
- App Store submissions: never resubmit the rejected dating concept; make
  differentiation visible in binary and listing. docs/app-review-field-notes.md.
- About to run git or Xcode from Cowork? Check docs/runtimes.md first.
- Merging agent PRs? QA merges after CI green + evidenced QA pass
  (adopted 2026-08-21). Bilal-only gates: store submission, spend,
  CI/signing/deploy config, cross-repo contracts. See skills/qa-engineer.
- **HARD SPEND RULE:** anything over **$20** = STOP and ask, even mid-task.
  Under $20 still needs quote-and-confirm with a cheapest option. Prefer free.
  Mobile builds use the local Mac rail; Actions is BACKUP only. Agent usage is
  spend too — `docs/token-diet.md`. No idle polling loops.
- Machine capabilities are not interchangeable: only the M3 Mac does Xcode,
  simulators, signing. Read `docs/machines.md`; reassign, never improvise.

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
