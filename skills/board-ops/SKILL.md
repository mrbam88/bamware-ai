---
name: board-ops
description: Work the Bamware GitHub Projects board — fields, conventions, and gh commands for adding/updating cards. Use when filing issues, planning fan-outs, or updating work status.
---

# Board operations

Board: https://github.com/users/mrbam88/projects/2 (project number **2**,
owner **mrbam88**, cross-repo).

## Fields & meanings

| Field | Options | Meaning |
|---|---|---|
| Status | Todo / In Progress / Done | Todo = specced + ready to pull |
| Priority | P0 — now / P1 — next / P2 — later | P0 = drop everything |
| Area | Mobile / Backend / Infra / AI-Ops | which repo family |
| Size | S / M / L | S ≈ one agent run; L = supervised/split |
| Worker | Agent-ready / Supervised / Human-only | who may execute |

## Conventions

- Every new issue gets added to the board + all four fields set at
  filing time. An unfielded card is an unfinished thought.
- **Fan-outs pull only `Worker: Agent-ready` cards**, orthogonal set,
  highest priority first. `Supervised` = Bilal in the loop. `Human-only`
  = credentials/accounts (see AGENTS.md security rules).
- "Closes #N" in the PR auto-closes the issue → card to Done (enable
  the built-in "item closed → Done" workflow in board Settings → UI-only).
- L-sized cards should be split before a fan-out — one agent, one run,
  one PR.

## Commands

```bash
# add an issue to the board
gh project item-add 2 --owner mrbam88 --url <issue-url>

# list items / fields (JSON has ids needed for edits)
gh project item-list 2 --owner mrbam88 --format json
gh project field-list 2 --owner mrbam88 --format json

# set a single-select value
gh project item-edit --id <ITEM_ID> --project-id <PROJ_ID> \
  --field-id <FIELD_ID> --single-select-option-id <OPT_ID>
```

Project ID: `gh project view 2 --owner mrbam88 --format json --jq .id`
