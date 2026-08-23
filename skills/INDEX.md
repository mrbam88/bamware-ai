# Skills index

Every skill in this repo. Fetch any of them over plain HTTPS:

```
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/<name>/SKILL.md
```

## Job search

| Skill | Use it for |
|---|---|
| `bilal-profile` | **Start here for anything about Bilal.** Identity, links, what he wants, and a router to the rest. |
| `bilal-resume` | Resume content, work history, upload rules. Also `resume.txt` for paste-only sites. |
| `bilal-answers` | Every reusable form answer: authorization, salary, logistics, EEO, consents. Read before filling any form. |
| `bilal-cover-letter` | The send-ready letter and his binding voice rules. |
| `bilal-references` | Reference policy. Contact details are deliberately not in git. |
| `job-guardrails` | Which companies may be auto-applied to, which are hard-blocked. |
| `apply-to-job` | The application procedure, thin orchestration over the above. |
| `ats-playbooks` | Per-ATS quirks: Greenhouse, Lever, Ashby, Workday, SmartRecruiters, LinkedIn. |
| `form-verify` | Proving a web form is actually filled before submitting. |

Interview prep is **docs, not skills** — study material, indexed at
[`docs/interview-prep/README.md`](../docs/interview-prep/README.md). Read that
index before writing any new prep doc; the bank is closed by default.

## Engineering — organized by team role

Bilal is admin/master. Agents fill roles; the loop is:
groom → DEV builds → QA verifies → Bilal merges. See `board-ops` for the
status flow. Roles will grow (Architect, Product) as the team builds up.

### Product / grooming

| Skill | Use it for |
|---|---|
| `agent-ready-tickets` | Writing specs an agent can execute. The spec IS the prompt. |
| `definition-of-ready` | The grooming gate a ticket passes BEFORE it becomes Agent-ready. Catch problems in daylight. |
| `board-ops` | Board statuses, fields, the Dev-QA loop, gh commands. Tickets, never "cards". |

### DEV

| Skill | Use it for |
|---|---|
| `standing-engineer` | The unattended DEV loop: one ticket, one PR, hand off to QA, never a merge. Runs headless on the Mac. |
| `agent-fanout` | Running parallel agents across repos (supervised, daytime). |
| `night-supervisor` | The bedtime loop: run `night`-labelled tickets sequentially overnight, one Sonnet agent per ticket, QA-merge, morning STATE.md report. |
| `native-ios-workspace` | The Xcode workspace for the shared Swift packages. |
| `simulator-driving` | Driving the iOS simulator. |

### QA

| Skill | Use it for |
|---|---|
| `qa-engineer` | Verify PRs against gates + acceptance criteria with evidence; pass the ticket or file bug tickets back to DEV. |

### Release (Bilal-gated)

| Skill | Use it for |
|---|---|
| `baat-release` | Releasing the Baat mobile app. |
| `native-app-to-testflight` | Taking a new native SwiftUI app from concept through a processed, physically installed first TestFlight build. |
| `store-submission` | App Store submission. |

### Ops

| Skill | Use it for |
|---|---|
| `session-handoff` | Preserving durable context at the end of a session. |

## Meta

| Skill | Use it for |
|---|---|
| `bamware-context` | The vendor-account bootstrap pointer. Contains no facts. Exported to assistants that support account-level skills. |

## Third-party (vendored)

Installed with the vercel-labs `skills` CLI from the repo root (`npx skills add
<owner/repo> -s <name>`, remove with `npx skills remove <name>`). Real copies
live in `.agents/skills/`; `skills/<name>` (read by opencode) and
`.claude/skills/<name>` (read by Claude Code) are symlinks into it. Manifest:
`skills-lock.json` (source repo + hash per skill). They are not listed in the
tables above and `scripts/check-context.py` skips symlinked entries — upstream
prose is not ours to gate. Raw-HTTPS fetches of these paths do not resolve
symlinks, so vendor-hosted runtimes (Cowork) do not see them; only CLI runtimes do.

## Rules

- Each fact has exactly one home. Skills reference each other; they never copy values.
- This repo is the source of truth. A vendor-synced copy is a cache and may be stale.
- When you learn something durable, commit it here. Context that lives only in a chat is lost.
