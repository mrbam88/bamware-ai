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

## Engineering

| Skill | Use it for |
|---|---|
| `agent-fanout` | Running parallel agents across repos. |
| `agent-ready-tickets` | Writing specs an agent can execute. |
| `baat-release` | Releasing the Baat mobile app. |
| `board-ops` | Project board conventions. |
| `native-app-to-testflight` | Taking a new native SwiftUI app from concept through a processed, physically installed first TestFlight build. |
| `native-ios-workspace` | The Xcode workspace for the shared Swift packages. |
| `session-handoff` | Preserving durable context at the end of a session. |
| `simulator-driving` | Driving the iOS simulator. |
| `standing-engineer` | The unattended loop: one Agent-ready card, one PR, never a merge. Runs headless on the Mac. |
| `store-submission` | App Store submission. |

## Meta

| Skill | Use it for |
|---|---|
| `bamware-context` | The vendor-account bootstrap pointer. Contains no facts. Exported to assistants that support account-level skills. |

## Rules

- Each fact has exactly one home. Skills reference each other; they never copy values.
- This repo is the source of truth. A vendor-synced copy is a cache and may be stale.
- When you learn something durable, commit it here. Context that lives only in a chat is lost.
