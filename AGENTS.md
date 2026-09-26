# Bamware — read me first (as of 2026-08-18)

Solo-founder startup (Bilal Malik, NYC) building white-label mobile apps.
Entry map for every session; details in `docs/` and `skills/`.

## RULE #1 — COMPANY POLICY: never lose Bilal's time to a permission block

Set by Bilal 2026-09-24. Claude-specific diagnoses below apply only to Claude;
other runtimes identify the actual denying component. Never bypass a denial. Detail:
[docs/agent-permission-blocks.md](docs/agent-permission-blocks.md).

1. **A denial is CLAUDE'S restriction, never Bilal's setup** — he has no
   permission rules. Say that in one sentence on the FIRST denial.
2. **Hand him the line to paste, then STOP.** No retries, no other routes, no
   `/permissions` UI (he finds it confusing).
3. **A denial NEVER stalls a batch.** Park that action; continue independent,
   authorized work on the other tickets.
4. **Before any unattended run, dry-run every gated command** (`gh pr create`,
   `gh pr merge`, `git push`, deploy). `bypassPermissions` does NOT beat the
   classifier. If one fails, tell him *while he is awake* and do not start.
5. **Verify merge state with `gh pr list --state merged`.** Silent output
   is not failure; ve#149 had merged when reported blocked.
6. **Prefer routes with no gated step** — Venue Engine deploys by pushing
   `main` (Vercel Git integration), no merge needed.

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

- **Venue Engine deploy: read `docs/venue-engine-deployment.md` first.** Local
  validation → existing Vercel project. Actions is NOT a prerequisite; an
  access gap never authorizes CI spend.
- Committing? Never commit credentials or PII — public repo. docs/security.md
- **Need a login to test?** A super-user pool exists (basketball-player names,
  cross-tenant) so nobody asks Bilal to type a password:
  `docs/test-superusers.md`. It is a **proposed carve-out** from the
  credentials rule above and is not in force until Bilal accepts it — read both
  before acting. A blank `JWT_SECRET` 401s every account and looks exactly like
  a wrong password; check that before blaming credentials.
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
| All repos: purpose, deploy targets, endpoints | docs/repos.md |
| Venue Engine release route | docs/venue-engine-deployment.md |
| Which runtime can do what (capability matrix) | docs/runtimes.md |
| Machines, displays, gear | docs/machines.md |
| Security: credentials, PII, accounts | docs/security.md |
| **Test logins: the super-user pool** | **docs/test-superusers.md** |
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
