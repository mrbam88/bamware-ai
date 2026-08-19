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

## Rules

- Each fact has exactly one home. Skills reference each other; they never copy values.
- This repo is the source of truth. A vendor-synced copy is a cache and may be stale.
- When you learn something durable, commit it here. Context that lives only in a chat is lost.
