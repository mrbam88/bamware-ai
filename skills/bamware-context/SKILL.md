---
name: bamware-context
description: Entry point for all of Bilal Malik's context. Loads the bamware-ai repo, which is the single source of truth for his profile, resume, job applications, job-search guardrails, and every Bamware engineering convention. Use at the START of any session involving Bilal's job search, applications, resume, cover letters, recruiters, interviews, or any work in a Bamware repo — before answering from memory or from any other skill.
---

# Bamware context — read the repo first

This skill contains **no facts**. It tells you where the facts live.

Everything about Bilal and Bamware lives in **`github.com/mrbam88/bamware-ai`**
on `main`. That repo is the single source of truth across every vendor and
runtime he uses. This skill exists only so a vendor-hosted assistant can find it.

## Do this first

1. Fetch **`AGENTS.md`** — the system map, conventions, runtime capability
   matrix, security rules, and how he wants to be talked to.
2. Fetch **`STATE.md`** — what is being built right now and what is blocked.
3. List **`skills/`** and read the one that matches the task.

The repo is **public**, so plain HTTPS works from any agent with no credentials:

```
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/AGENTS.md
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/STATE.md
https://api.github.com/repos/mrbam88/bamware-ai/git/trees/main?recursive=1
```

If a GitHub connector or `gh` is available, prefer it — it also reaches the
private repos.

## Skills in that repo

**Job search:** `bilal-profile` (index), `bilal-resume`, `bilal-answers`,
`bilal-cover-letter`, `bilal-references`, `job-guardrails`, `apply-to-job`,
`ats-playbooks`, `form-verify`.

**Engineering:** `agent-fanout`, `agent-ready-tickets`, `baat-release`,
`board-ops`, `native-ios-workspace`, `session-handoff`, `simulator-driving`,
`store-submission`.

Start at `bilal-profile` for anything about Bilal. It routes to the rest.

## Rules

- **Never answer about Bilal from memory.** Read the repo. His resume, comp
  target, and application history change.
- **Never cache these facts into a vendor account skill.** That is what this
  skill replaced. A vendor copy goes stale silently and cannot be written back
  to from a session.
- **Write updates back to the repo.** A new standard answer, a new ATS quirk, a
  changed preference — commit it to `bamware-ai`, or hand Bilal the change if
  the runtime cannot push. Context that lives only in a chat is lost.
- **If you cannot reach the repo, say so and stop.** Do not proceed from a
  stale copy or from guesswork.

## Private companion

Application history lives in `mrbam88/interviews` at `tracker/applications.md`
(private, needs a connector). That repo holds the tracker and nothing else.
