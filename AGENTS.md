# Bamware — read me first (as of 2026-08-18)

Solo-founder startup (Bilal Malik, NYC) building white-label mobile apps.
Entry map for every session; details in `docs/` and `skills/`.

## RULE #1 — COMPANY POLICY: never lose Bilal's time to a permission block

Set by Bilal 2026-09-24. Before a merge, unattended run, or blocked-work
report, read [docs/agent-permission-blocks.md](docs/agent-permission-blocks.md).
Never bypass a denial. Identify the actual denying component immediately,
give Bilal the command to run, and stop that action; continue independent,
authorized work. Preflight gated commands before unattended work. Verify merge
state before reporting failure. Claude-specific diagnoses apply only to Claude.

## First-class principle: continuity across agents

Bilal switches models, vendors and harnesses constantly. **Context must survive
every switch.** Never rely on model memory.

- At milestones and after corrections, save the decision **and why**, next
  action, paths/commands, evidence, blockers, pause state.
- Durable procedures go in canonical docs linked from here — never bury a rule
  in an incident log only. Route work by capability, not model name.
- Distinguish **edited locally / published / deployed** — unpublished context
  does not exist for the next machine. Procedure: `skills/session-handoff`;
  contract: `docs/portability.md`.

## 1. Where is the truth?

Public operating map: github.com/mrbam88/bamware-ai.

- Notion is the organizational source of truth and shared working canvas.
  Discord is the primary channel for alerts, reminders and direct communication.
  Git owns code and versioned operating instructions; Drive owns shared files.
  Vendor memories are caches, not substitutes for these authoritative stores.
  Read `skills/bamware-assistant/SKILL.md` for drafting and email boundaries.
- Staleness check: fetch CONTEXT_VERSION and state its contents in your
  first reply as `context: <marker>`.
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
- Save facts in their authoritative store, not only chat. Publish operating
  rules here; organization and working drafts belong in Notion. Run the
  session-handoff skill after durable decisions.

## 3. How does Bilal work?

**Organization-wide role:** Bilal is the **Stakeholder / CEO**, not a routine task
chaser. All agents follow the approved [role and escalation policy](docs/bamware-agent-operating-system-prd.md#stakeholder--ceo-and-escalation-policy):
workers → Scrum Master → Chief of Staff → CEO. Chief of Staff is the primary
executive interface; critical owner alerts need not wait for ceremonial routing.
Reserved decisions, evidence, Command Center/Discord delivery and resolution
tracking remain mandatory. Read this policy when onboarding any role.

- Short and sweet. Bullets over prose. No re-summaries. Limit his reading.
- Direct recommendations, not option menus. Plan before building.
- RN + Express mental model; mobile/Node analogies land.
- Specs are GitHub issues: story / scope / out-of-scope / acceptance criteria.
- Tool use proportional to the ask. Fan-outs need an explicit ask.
- Never mention Baat in responses or career materials (Bilal, 2026-09-16).
  Project wording: skills/bilal-answers.

## Shared storage — confirmed 2026-10-02

Drive is shared agent file storage; ordinary task storage is authorized.
Prefer local filesystem access and deterministic transfers. Archive boundaries
and rollout: `docs/shared-storage.md`. Gmail stays read-only: no sends or drafts.

## Before you touch these, read the linked doc first

- **Venue Engine deploy: read `docs/venue-engine-deployment.md` first.** Local
  validation → existing Vercel project. Actions is NOT a prerequisite; an
  access gap never authorizes CI spend.
- Committing? Never commit credentials or PII — public repo. docs/security.md
- Changing an API response shape silently breaks the app — docs/contracts.md.
- App Store: never resubmit the rejected dating concept; show differentiation
  in binary + listing. docs/app-review-field-notes.md.
- git/Xcode from Cowork? Check docs/runtimes.md first.
- Agent PRs: QA merges after CI green + evidenced pass. Bilal-only gates:
  store submission, spend, CI/signing/deploy config, cross-repo contracts.
- **HARD SPEND RULE:** over **$20** = STOP and ask, even mid-task. Under $20
  needs quote-and-confirm with a cheapest option. Prefer free. Mobile builds
  use the Mac rail; Actions is BACKUP only. Agent usage is spend too
  (`docs/token-diet.md`). No idle polling loops.
- Machine capabilities are not interchangeable: only the M3 Mac does Xcode,
  simulators, signing. Read `docs/machines.md`; reassign, never improvise.

## Table of contents

| Need | Where |
|---|---|
| **Permission blocks (RULE #1 detail)** | **docs/agent-permission-blocks.md** |
| **Engineering operating contract** | **docs/engineering-operating-contract.md** |
| **Release manager contract** | **docs/release-manager-contract.md** |
| All repos: purpose, deploy targets, endpoints | docs/repos.md |
| Venue Engine release route | docs/venue-engine-deployment.md |
| Which runtime can do what (capability matrix) | docs/runtimes.md |
| Machines, displays, gear | docs/machines.md |
| Security: credentials, PII, accounts | docs/security.md |
| Cross-repo API contracts | docs/contracts.md |
| App Review / 4.3(b) evidence base | docs/app-review-field-notes.md |
| Current state | STATE.md |
| CRM | docs/bamware-crm.md |
| All skills (procedures) | skills/INDEX.md |
| Interview prep | docs/interview-prep/README.md |
| Definition of done | docs/definition-of-done.md |
| Brand, design tokens | docs/brand.md |
| Incident history | docs/incidents.md |
| Session-end ritual | skills/session-handoff |
| Other-vendor portability | docs/portability.md |
| Hermes runtime | docs/hermes-integration.md |
