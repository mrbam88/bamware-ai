> **ARCHIVED 2026-08-18.** Superseded. It recommended a dedicated
> `bamware-skills` repo; skills instead landed in `bamware-ai/skills/`, and the
> proposed Wave-0/1 skills were largely replaced by the shipped skill set in
> `skills/INDEX.md`. Kept for the portability reasoning, which still holds.

# bamware — Skills Portfolio & Repo Strategy

_Companion to `local-agents-and-context.md`. Started 2026-07-24. This note decides **what skills to build, in what order, and where they live in GitHub** — designed so a single skill file feeds both Claude/Cowork and your local OpenCode agents._

## How this connects to the strategy you already wrote

Your core principle is "externalize context so models are swappable." Skills are the same move applied one level up: `AGENTS.md` externalizes the **facts** (what the app is, its conventions, its gotchas); skills externalize the **procedures** (how we repeatably do a thing — seed a repo, log a decision, route a task, review a diff). Both are model-independent files in the repo. Neither lives in a chat.

## The portability rule (why one file works everywhere)

`SKILL.md` is an open standard that runs across many agent tools. A skill stays portable given three rules:

1. **Minimal, standard frontmatter.** Only `name` and `description` are required and universal. Claude-specific extensions are ignored by other tools — safe to add, but nothing important should depend on them.
2. **Plain-markdown body, no Claude-only assumptions.** Imperative instructions that don't assume a Claude-specific tool exists.
3. **Progressive disclosure via standard folders.** Keep `SKILL.md` lean (<500 lines); heavy material into `references/`, executables into `scripts/`, templates into `assets/`.

**How OpenCode consumes them.** OpenCode reads durable context from `AGENTS.md` and from an `instructions` array in `opencode.json` accepting globs and remote URLs. Either eager (`"instructions": ["skills/**/SKILL.md"]`) or on-demand (reference the skills directory from `AGENTS.md` and let the agent `Read` one when the task calls for it — preferred).

## Repo layout — recommendation (NOT the path taken)

Two kinds of thing wanting different homes:

- **App-specific durable context** — `AGENTS.md`, `/docs`, decision log, domain conventions. Versions **with the code** → stays in the app repo.
- **Reusable workflow skills** — how you seed an `AGENTS.md`, log a decision, route a task, wire OpenCode. Encodes *how Bilal works* → proposed a dedicated `bamware-skills` repo.

**The honest tradeoff (recorded at the time):** skills inside one repo let a single PR change code *and* the skill describing it atomically. That is the option that actually won — `bamware-ai` holds both context and skills.

## The skill portfolio (as proposed)

### Wave 0 — Foundation

| Skill | What it does |
|---|---|
| **`agents-md-authoring`** | Seeds and maintains `AGENTS.md`: what durable context belongs in it, structure, how to keep it current. |
| **`decision-capture`** | Turns a decision into a durable record — a lightweight ADR / decision-log entry with context, options, choice, consequences. |

### Wave 1 — OpenCode & local-model operations

| Skill | What it does |
|---|---|
| **`opencode-setup`** | Generates/maintains `opencode.json` with architect/coder/reviewer pinned to models, 64k+ context, aligned to `AGENTS.md`. |
| **`model-routing`** | Given a task, pick frontier vs local and which role, including the caveat that local 32B trails frontier on hard reasoning. |
| **`local-model-ops`** | Ollama model selection for a 36 GB M3 Pro: which model fits at what context, pulls, tok/s expectations. |

### Wave 2 — The development loop

| Skill | What it does |
|---|---|
| **`task-spec`** | Writes a spec a coder agent can execute: goal, constraints, acceptance criteria, files in scope, pointers into `AGENTS.md`. |
| **`session-primer`** | Compact context bundle to bring a fresh model/session up to speed — the anti-lock switch move itself. |
| **`code-review` (Bamware-tuned)** | Review a diff against Bamware conventions + `AGENTS.md`. Extend the generic skill rather than rebuild. |

### Later — domain-specific

Blocked at the time on capturing the app stack: `testing-strategy`, `deploy-checklist`, `migration-runbook`.

## What actually happened

Skills shipped in `bamware-ai/skills/` — see `skills/INDEX.md`. `agent-ready-tickets`
covers the `task-spec` idea, `session-handoff` covers `session-primer`, and
`opencode-setup` became `docs/opencode-setup.md`.
