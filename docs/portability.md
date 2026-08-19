# Portability — the same context on every vendor

Bilal switches between model vendors. No vendor holds his context; this repo does.

The only thing a vendor needs is a **pointer** in whatever field that product
injects on every turn. Everything else is fetched from here at runtime. Moving to
a new assistant is a copy-paste, not a migration.

## The pointer (canonical text)

```
Bilal Malik's context lives in github.com/mrbam88/bamware-ai (public).
Before answering anything about Bilal, his job search, his resume, or any
Bamware repo, fetch and read:
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/AGENTS.md
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/STATE.md
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/INDEX.md
Then fetch the specific skill you need:
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/<name>/SKILL.md
Start at bilal-profile for anything about Bilal. Never answer from memory.
Never cache these facts here. Write durable updates back to the repo.
If you cannot reach the repo, say so and stop.
```

That is the whole vendor-side footprint. Roughly 120 tokens.

## Where it goes, per platform

| Platform | Field |
|---|---|
| **Claude** (web, desktop, mobile) | Account skill `bamware-context`. Export from `skills/bamware-context/`, zip as `.skill`, save in Settings → Skills. |
| **Claude Code / opencode / Codex CLI** | Nothing. They read `AGENTS.md` from the repo directly. This is the reference behaviour — no pointer needed. |
| **ChatGPT** | Settings → Personalization → Custom Instructions, "anything else" box. For a Project, paste into the project's instructions field. |
| **Grok** | Custom instructions / system prompt field. |
| **Gemini** | Create a Gem and paste into its instructions. |
| **Cursor** | `.cursorrules` in the repo root, or Settings → Rules for AI. |
| **Raw API** (any vendor) | Prepend to the system prompt. |
| **Local models** (Ollama, LM Studio) | System prompt / modelfile SYSTEM block. |

## Requirements on the runtime

Only one: the ability to fetch an HTTPS URL. No API key, no OAuth, no connector,
no vendor storage. `bamware-ai` is public precisely so this holds everywhere.

A runtime **without** web access cannot bootstrap. In that case paste the
relevant SKILL.md contents in by hand and treat that session as read-only — it
cannot write updates back.

## New machine (CLI side)

Vendor portability above covers chat products. For a new **laptop**, the same
principle applies: the machine is a cache of this repo. `scripts/bootstrap.sh`
rebuilds the whole CLI harness (sibling repos, skill installs, Claude Code
skill symlinks, opencode config) from a bare `gh auth login` + clone. Nothing
on a machine is authored locally; see README "New machine".

## The private half

Identifying, demographic, and compensation answers live in the private repo
`mrbam88/interviews` at `profile/private-answers.md`. Reaching it needs a GitHub
credential, so it is available to CLI runtimes and to any assistant with a GitHub
connector, and not to a bare chat window. An agent that cannot read it must stop
and ask rather than guess those fields.

## Testing a new vendor

Paste the pointer, start a fresh chat, and ask:

> What is my comp target, and what is my policy on cover letters?

A correct setup fetches the repo and answers: cover letter always, even when
optional; comp figures are in the private repo and it should ask rather than
guess. A vendor that answers from memory, guesses a number, or claims not to know
where to look has not picked up the pointer.

## Rule

If a vendor ever offers to "remember" these facts for you, decline. That is how
the drift started: an account-synced snapshot went stale and an application
nearly went out against an incomplete profile. The repo is the memory.
