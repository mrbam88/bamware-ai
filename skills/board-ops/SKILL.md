---
name: board-ops
description: Work the Bamware GitHub Projects board — statuses, fields, conventions, and gh commands for adding/updating tickets. Use when filing issues, grooming the backlog, moving work through the Dev-QA loop, or updating work status.
---

# Board operations

Board: https://github.com/users/mrbam88/projects/2 (project number **2**,
owner **mrbam88**, cross-repo).

**Terminology: they are TICKETS.** Never "cards", never "items" in prose.
(Bilal's convention, 2026-08-19.)

## Status — the Dev-QA loop

| Status | Meaning | Who moves it here |
|---|---|---|
| Todo | Groomed and ready to pull (`definition-of-ready` passed) | Bilal / Product |
| In Progress | DEV actively building, or QA bounced it back | DEV / QA |
| Ready for QA | PR open, gates run, awaiting verification | DEV |
| QA Passed | Verified with evidence; awaiting Bilal's merge | QA |
| Done | Merged ("Closes #N" auto-closes → Done workflow) | Bilal's merge |

```
Todo → In Progress → Ready for QA → QA Passed → Done
            ↑              |
            └─ bug ticket ─┘   (QA fail: bug ticket filed, back to DEV)
```

Merging is always Bilal's. Several repos deploy on push to main.

## Other fields & meanings

| Field | Options | Meaning |
|---|---|---|
| Priority | P0 — now / P1 — next / P2 — later | P0 = drop everything |
| Area | Mobile / Backend / Infra / AI-Ops | which repo family |
| Size | S / M / L | S ≈ one agent run; L = must be split before Agent-ready |
| Worker | Agent-ready / Supervised / Human-only | who may execute |

## Conventions

- Every new ticket gets added to the board + all four fields set at
  filing time. An unfielded ticket is an unfinished thought.
- `Worker: Agent-ready` is EARNED, not assumed — a ticket gets it only by
  passing `definition-of-ready`. Fan-outs and the runner pull only
  Agent-ready tickets, orthogonal set, highest priority first.
- `Supervised` = Bilal in the loop. `Human-only` = credentials/accounts
  (see AGENTS.md security rules).
- Bug tickets (QA rejections) carry the `bug` label, link the PR and the
  original ticket, and inherit the original's Priority.
- "Closes #N" in the PR auto-closes the issue → ticket to Done (the
  built-in "item closed → Done" workflow, board Settings → UI-only).

## Commands

```bash
# add an issue to the board
gh project item-add 2 --owner mrbam88 --url <issue-url>

# list tickets / fields (JSON has ids needed for edits)
gh project item-list 2 --owner mrbam88 --format json
gh project field-list 2 --owner mrbam88 --format json

# set a single-select value
gh project item-edit --id <ITEM_ID> --project-id <PROJ_ID> \
  --field-id <FIELD_ID> --single-select-option-id <OPT_ID>
```

Project ID: `gh project view 2 --owner mrbam88 --format json --jq .id`

Status option ids (as of 2026-08-19, re-fetch if edits fail): Todo
`96db1540` · In Progress `33504b24` · Ready for QA `6ec39f28` · QA Passed
`07548314` · Done `3c492372`. Field id `PVTSSF_lAHOAR0OWc4BeGkczhYjQ1A`.

⚠️ Adding/renaming Status options via `updateProjectV2Field` REPLACES the
option set and WIPES every ticket's status. Snapshot all item statuses
first, mutate, then restore (it happened 2026-08-19; the snapshot saved us).
