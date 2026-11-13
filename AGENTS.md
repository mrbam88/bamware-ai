# Bamware — read me first

Solo-founder startup (Bilal Malik, NYC) building white-label mobile apps.
Entry map; the shape of the system is [DESIGN.md](DESIGN.md); details in
`docs/` and `skills/`.

## RULE #1 — COMPANY POLICY: never a surprise bill

Bilal, 2026-10-20: an unexpected bill "will kill this company overnight."
The **CFO owns money** and a **halt** (`~/.local/state/bamware/cfo/halt.json`)
every seat, runner, timer and batch honours. New spend over **$20** = STOP and
ask, even mid-task; under $20 = quote-and-confirm, cheapest option. Prefer
free. Agent usage is spend (`docs/token-diet.md`). No idle polling loops.

**Permissions:** seat runners run with prompts off (ADR 0002); written policy
still binds. Stuck on a prompt? [docs/agent-permission-blocks.md](docs/agent-permission-blocks.md).

## First-class principle: engineer together through primers (2026-10-24)

A decision about money, scale, reliability, security or architecture gets a
**primer**: a short readable Artifact page that teaches Bilal what the choice
depends on, shows options with numbers, and records the decision. Chat steers;
the primer is where we think. Shape and rules: [docs/primers.md](docs/primers.md).

## First-class principle: continuity across agents

Bilal switches models, vendors and harnesses constantly. **Context must survive
every switch.** Never rely on model memory.

- At milestones and after corrections, save the decision **and why**, next
  action, paths/commands, evidence, blockers, pause state.
- Durable procedures go in canonical docs linked from here — never bury a rule
  in an incident log only. Route work by capability, not model name.
- Distinguish **edited locally / published / deployed** — unpublished context
  does not exist for the next machine.

## 1. Where is the truth?

Public operating map: github.com/mrbam88/bamware-ai.

- Notion is the organizational source of truth and shared working canvas.
  Discord is the primary channel for alerts, reminders and direct communication;
  the seat behind it is a router over agent CLIs (`services/discord-router`,
  ADR 0002, glossary in `CONTEXT.md`).
  Git owns code and versioned operating instructions; Drive owns shared files.
  Vendor memories are caches, not substitutes for these authoritative stores.
  `skills/bamware-assistant/SKILL.md`: drafting and email boundaries.
- Staleness check: fetch CONTEXT_VERSION and state its contents in your
  first reply as `context: <marker>`.
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/CONTEXT_VERSION
- Can't reach the repo? Say so and STOP. Never work from memory or a cache.

## 2. How do I write to it?

Resolve BEFORE starting work; state it next to the context marker:
`write-path: composio/github` or `write-path: native git`.

| Runtime | Write path |
|---|---|
| Cowork (Desktop/Web/mobile) | Composio → GITHUB_COMMIT_MULTIPLE_FILES |
| Claude Code CLI / Sol / opencode | native git + gh |

- **Native first (Bilal, 2026-10-27):** on a CLI use `git`/`gh`/`vercel`,
  then first-party connectors; Composio last, never for GitHub.
- A missing `gh` binary or container-git 403 does NOT mean "no access."
  Check the connector first.
- No write path? STOP and hand Bilal the patch. Never write durable
  context into a vendor cache instead.
- Save facts in their authoritative store, not only chat: operating rules
  here, organization and drafts in Notion. Run session-handoff after durable
  decisions.

## 3. How does Bilal work?

**100-word rule (Bilal, 2026-10-03):** every reply is 100 words max by default.
Answer or decision first; anything to approve in one line. He asks when he wants
more. Enforced by a Claude Code Stop hook since 2026-10-27. When a text rule
keeps failing, propose a mechanism (hook, check, gate), not more text.

**Roles:** Bilal is the Stakeholder / CEO, not a task chaser. Escalation per the
[role policy](docs/bamware-agent-operating-system-prd.md#stakeholder--ceo-and-escalation-policy).

- Short and sweet. Bullets over prose. No re-summaries.
- **Numbers (Bilal, 2026-10-20):** never a bare percentage. Say what it
  measures, used or left, of what total and period.
- Direct recommendations, not option menus. Plan before building.
- RN + Express mental model; mobile/Node analogies land.
- Specs are GitHub issues: story / scope / out-of-scope / acceptance criteria.
- Tool use proportional to the ask. Fan-outs need an explicit ask.
- **Apartment lights, stereo, TVs:** `skills/bamware-smart-home` (server only;
  he is red-green colorblind, so no red/green).
- Never mention Baat in responses or career materials (Bilal, 2026-09-16).
  Project wording: skills/bilal-answers.

## Shared storage (2026-10-02)

Drive is shared agent file storage (`docs/shared-storage.md`). Gmail stays
read-only: no sends or drafts.

## Before you touch these, read the linked doc first

- **Venue Engine deploy: read `docs/venue-engine-deployment.md` first.** Local
  validation → existing Vercel project. Actions is NOT a prerequisite; an
  access gap never authorizes CI spend.
- Committing? Never commit credentials or PII — public repo. docs/security.md
- Changing an API response shape silently breaks the app — docs/contracts.md.
- App Store: never resubmit the rejected dating concept; show differentiation
  in binary + listing. docs/app-review-field-notes.md.
- git/Xcode from Cowork? docs/runtimes.md first.
- **Ship it: green + verified = merged and deployed the same day; breaking
  changes go expand → migrate → contract. `docs/release-strategy.md`.**
- Agent PRs: QA merges after CI green + evidenced pass. Policy gates (by
  text, not prompts): store submission, spend over $20, secrets. Mobile builds
  use the Mac rail; Actions is BACKUP only.
- Machines are not interchangeable: only the M3 Mac does Xcode, simulators,
  signing. `docs/machines.md`; reassign, never improvise.

## Reference map

See [agent context index](docs/agent-context-index.md) for repos, runtime
capabilities, procedures, state and technical docs.
