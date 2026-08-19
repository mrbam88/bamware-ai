# Bamware — read me first (as of 2026-08-18)

Solo-founder startup (Bilal Malik, NYC) building white-label mobile apps.
This file loads in every session. It answers three questions, then links out.
Detail lives in `docs/` and `skills/` — read those when the task needs them.

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
  Check the connector first. (This mistake cost a session on 2026-08-18.)
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

## Before you touch these, read the linked doc first

- Committing anything? Never commit credential values or PII — this repo is
  public. Rules: docs/security.md
- Changing a service API response shape? It breaks the mobile app silently.
  Read docs/contracts.md first.
- Submitting anything to the App Store? Baat was rejected under 4.3(b) on
  2026-08-04 (verbatim in STATE.md log). Don't resubmit the dating concept;
  every new app's differentiator must be visible in the binary and listing.
- About to run git or Xcode from Cowork? Check docs/runtimes.md first.

## Table of contents — read on demand

| Need | Where |
|---|---|
| All repos: what each is, deploy targets, endpoints | docs/repos.md |
| Which runtime can do what (capability matrix) | docs/runtimes.md |
| Security rules: credentials, PII, accounts | docs/security.md |
| Cross-repo API contracts | docs/contracts.md |
| Current state: building / blocked / shipped | STATE.md |
| All skills (procedures) | skills/INDEX.md |
| Definition of done, test gates | docs/definition-of-done.md |
| Brand, design tokens | docs/brand.md |
| Why these context rules exist (incident history) | docs/incidents.md |
| Session-end ritual: what to save, how to publish | skills/session-handoff |
| Running this setup on other vendors | docs/portability.md |
