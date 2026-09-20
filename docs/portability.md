# Portability — the same context on every vendor

Bilal switches between model vendors. No vendor holds his context; this repo does.

**This is a first-class Bamware design principle, not an optional convenience.**
An agent should leave the next agent less to infer, regardless of model quality
or harness. A stronger model remembering a convention is not the continuity
mechanism; a discoverable, current repo instruction is.

## The handoff contract

After a verified milestone, a changed decision, or a user correction, update
the canonical context before ending the task:

- **Decision and reason:** what was selected, what it replaces, and why.
- **Current state:** local edits, published source and deployed behavior are
  separate facts. Include the relevant revision and verification evidence.
- **Next action:** concrete paths, commands and acceptance criteria. Mark an
  unverified command/access path as unverified rather than inventing a recipe.
- **Constraints:** cost limits, scope ownership, blocked access, active pauses
  and withdrawn approvals. Never make the next agent rediscover these in chat.
- **Discoverability:** critical rules belong in entry instructions or linked
  runbooks, with precedence over generic defaults stated explicitly. A log
  entry alone does not make a procedure discoverable.

Use `skills/session-handoff` for publication. Commit/push only when authorized;
if publication is pending, say so and provide the exact changed paths/patch.
Do not call local edits a completed cross-machine handoff. Store facts once,
link them elsewhere, and replace superseded operational guidance while keeping
the rationale in the incident/decision history. No transcript dumps or secrets.

The only thing a vendor needs is a **pointer** in whatever field that product
injects on every turn. Everything else is fetched from here at runtime. Moving to
a new assistant is a copy-paste, not a migration.

## The pointer (canonical text)

```
Bilal Malik's context lives in github.com/mrbam88/bamware-ai (public).
Before answering anything about Bilal, his job search, his resume, or any
Bamware repo, resolve the runtime's repo write path, then fetch current main:
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/CONTEXT_VERSION
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/AGENTS.md
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/STATE.md
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/INDEX.md
Then fetch the specific skill you need:
  https://raw.githubusercontent.com/mrbam88/bamware-ai/main/skills/<name>/SKILL.md
Start at bilal-profile for anything about Bilal. Never answer from memory.
State context: <CONTEXT_VERSION contents> and write-path: <resolved path>.
Use native git in CLI runtimes or the GitHub connector in Cowork; raw HTTPS
is the read fallback. Never cache these facts here. Update the canonical repo
after verified milestones/corrections so the next model can continue.
If you cannot reach the repo, say so and stop.
```

That pointer is the vendor-side footprint; durable facts remain in the repo.

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

Reading the public bootstrap needs repo/network access; raw HTTPS is available
as a fallback without credentials. Writing/publishing also needs the runtime's
authorized GitHub path. Resolve both before accepting context-changing work;
see `skills/bamware-context` for runtime-specific access instructions.

A runtime that cannot reach the current repo must say so and stop. Pasted or
vendor-cached instructions are not a substitute for verifying current context.

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
