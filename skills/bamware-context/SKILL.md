---
name: bamware-context
description: Entry point for all of Bilal Malik's context. Loads the bamware-ai operating map and routes to authoritative Notion organization, private career assets, and engineering conventions. Use at the START of EVERY session in the bamware project or that mentions Bilal, Bamware, or any mrbam88 repo — regardless of topic (a GitHub, security, or general question is still a Bamware session). Invoke it before answering from memory or from any other skill.
---

# Bamware context — read the repo first

This skill contains **no facts**. It tells you where the facts live.

Start at **`github.com/mrbam88/bamware-ai`** on `main` for operating rules and
source routing across providers. Notion is the organizational source of truth
and shared drafting canvas; Discord is the primary communication/alert channel.
Git owns code and versioned instructions, Drive shared files, and the private
interviews repo existing career assets. See `skills/bamware-assistant/SKILL.md`.

## Hermes runtime

Hermes reads this skill directly through `skills.external_dirs`; never install
an independent copy. The approved startup hook `scripts/hermes-context.py`
fetches and pins current main, injects AGENTS.md, an explicitly bounded STATE
excerpt and the skill index, and reports local drift without merging anything.
A successful startup marker is evidence of that fetch, not of push access.

Read `docs/hermes-integration.md` for install, verification, role routing,
automation ownership and rollback. If the hook is absent, run the ordinary
bootstrap below. A failed fetch is a stop, not permission to use cached facts.
Use the native git/gh path. Hermes session history is useful evidence, not the
canonical store. Operating procedures belong here; save other facts in their authoritative stores.

## Step 0 — resolve your WRITE path first, before reading anything

Reading this repo needs no connector. **Writing does.** If you discover that gap
mid-session you will improvise, and improvising means putting durable context in
a vendor cache — the one thing this system forbids. So settle it first.

Find the GitHub path for YOUR runtime:

| Runtime | Write path |
|---|---|
| **Cowork (Claude Desktop/Web)** | The **Composio** connector. Search its tools for GitHub, commit with `GITHUB_COMMIT_MULTIPLE_FILES` (atomic, multi-file, no checkout). This is the path — check it FIRST. |
| **Claude Code CLI / Sol / opencode** | Native `git` + `gh` on the machine. No connector needed. |

Then **state it in your first reply**, next to the context marker:
`write-path: composio/github` or `write-path: native git`.

If no path exists: say so and **STOP**. Hand Bilal the patch. Do not write the
content somewhere else instead.

Never conclude "no write access" from a missing `gh` binary, or from a container
`git push` 403 ("not in this session's authorized repository set"). Neither is
the write path in Cowork, so neither tells you anything.

## Step 1 — read

**If your runtime has a shell with `git` and network, clone — don't fetch files
one at a time:**

```
git clone --depth 50 https://github.com/mrbam88/bamware-ai.git
```

Public, so no auth. You get every doc and skill in one call *and* you get
`git log`, which is the only way to see what actually changed in a session you
were not in. A recap built from `STATE.md` alone is a paraphrase of whatever the
last agent chose to write down; one built from history is evidence.

**Cowork: read through the Composio GitHub connector (`GITHUB_GET_REPOSITORY_CONTENT`
on `mrbam88/bamware-ai`, ref `main`), not through the assistant's web-fetch tool.**
Incident 2026-09-16: a Cowork session read `bilal-resume` and `bilal-answers` via
web-fetch. That tool caches and summarizes; it returned a resume three weeks stale
and dropped the "never mention Baat" rule entirely. Three applications were filled
with the excluded project and had to be redone. The connector returns the exact
bytes on `main`. Use it.

Without a shell or connector, use the raw URLs as a last resort. The repo is **public**, so these three
fetches need no credentials, no API key, and no connector — plain HTTPS from any
agent.

```
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/AGENTS.md
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/STATE.md
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/INDEX.md
```

1. **`AGENTS.md`** — the system map, conventions, runtime capability matrix,
   security rules, and how Bilal wants to be talked to.
2. **`STATE.md`** — what is being built right now and what is blocked.
3. **`skills/INDEX.md`** — every skill and what it is for. Then fetch the one
   that matches the task:

```
https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/<name>/SKILL.md
```

Start at **`bilal-profile`** for anything about Bilal. It routes to the rest.

Do **not** depend on `api.github.com` for this. It is rate-limited without auth
and blocked or proxied in some agent sandboxes. Raw always works.

## Writing back

Use the resolved write path for versioned operating rules. Put organizational
decisions, plans and drafts in Notion; private application records in its Job
Tracker; career assets in the private library. Publish only non-private routing
and procedures here. Never rely on vendor memory or chat as the durable record.

Incident 2026-08-18: a Cowork session checked for a `gh` binary, found none,
declared "no push access," and wrote an App Store rejection record into the
Claude Project instead. The Composio connector was live the entire session. Two
project-only docs had already gone stale enough to produce confidently wrong
advice. That is why Step 0 exists and why it comes before reading.

## Rules

- **Never answer about Bilal from memory.** Read the repo. His resume, comp
  target, and application history change.
- **Never cache these facts into a vendor account skill.** That is what this
  skill replaced. A vendor copy goes stale silently and cannot be written back
  to from a session.
- **Write updates back to the repo.** A new standard answer, a new ATS quirk, a
  changed preference belongs in its authoritative store. Commit non-private
  operating rules here; keep private records private. Chat alone is not durable.
- **If you cannot reach the repo, say so and stop.** Do not proceed from a
  stale copy or from guesswork.

## Private companion

Notion Job Tracker owns current application state; email is source evidence.
`mrbam88/interviews` holds private resumes, cover letters, prep, provenance and
historical tracker records. Read its README and `library.json` before using assets.
Never put private career or mailbox content in this public repository.
