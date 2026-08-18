> **ARCHIVED 2026-08-18.** Superseded by `AGENTS.md`, `docs/portability.md`, and
> `docs/opencode-setup.md`. Kept for provenance: this 2026-07-20 note is the
> origin of the externalize-context principle that `bamware-ai` implements.

# bamware — Local Models, Agents & Context Strategy

_Living strategy note. Started 2026-07-20. This is the "war room → repo" bridge: decisions made in chat get captured here so they don't die in a thread. Copy the relevant parts into the app repo's `AGENTS.md` too._

## The core problem we're solving
Two things kept getting tangled: **vendor lock** (being trapped on one AI provider) and **context** (losing our place when switching models or moving between chat and code). The unlock is one idea:

> **Externalize context.** Important context (architecture, decisions, conventions) must live in **files/repo/project**, never inside a single model's or chat's memory. Then models become swappable engines and the context stays in the tank.

This single principle solves both problems at once — swappable models = no vendor lock, and file-based context = nothing lost on a switch.

## Two kinds of "context"
1. **Durable context** — codebase, architecture decisions, task specs, conventions, gotchas. Lives in the repo (`AGENTS.md`, `/docs`, decision log) and in this Project. Model-independent. This is the stuff that matters.
2. **Conversational context** — the running back-and-forth of a session. Ephemeral, cheap to reconstruct. Don't rely on it for anything important.

## The toolchain
- **Ollama** — runs open-weight models locally (Qwen, Llama, DeepSeek…). Exposes an OpenAI-compatible API at `http://localhost:11434`. No keys, no per-token billing, private.
- **OpenCode** — model-agnostic terminal coding agent. Points at Ollama *or* frontier providers via config. Stores sessions itself, so switching the model mid-task keeps the conversation.

## Hardware (decided)
- Machine: **MacBook Pro, M3 Pro, 36 GB** unified memory.
- Usable model+context budget: ~18–24 GB → comfortably runs up to **32B** models.
- Speed note: M3 Pro bandwidth means 32B runs ~10–15 tok/s (usable, not instant); 14B ~2x faster.

## Recommended local models (for OpenCode agentic use)
- **`qwen2.5-coder:32b`** — best quality that fits; primary local coder. (~20 GB)
- **`qwen2.5-coder:14b`** — faster, roomy context; quick tasks. (~9–10 GB)
- **`qwen3`** — newer Qwen gen, try for tool-use reliability.
- Rule: OpenCode wants **64k+ context**. 14B + 64k = relaxed; 32B + 64k = tight on 36 GB.

## Multi-agent routing pattern (route tasks by value)
- **Architect / Plan** → frontier model (low-token, high-value planning).
- **Build / Coder** → local `qwen2.5-coder:32b` (high-token grunt work, free & private).
- **Reviewer** → frontier model (catches what local missed).
- Each OpenCode agent can be pinned to its own model in `opencode.json`. Architect can auto-hand-off to the coder subagent (child session), all aligned by `AGENTS.md`.

## Workflow model (chat vs terminal — use BOTH)
- **Chat (Claude desktop / this Project)** = war room. Think, decide, learn, draft specs. Capture conclusions here.
- **Terminal (OpenCode)** = workshop. Has hands on the files. Executes the plan.
- **Repo + this Project** = shared long-term memory both draw from. The discipline: decisions from chat get written into the repo's `AGENTS.md` and/or this Project so nothing evaporates.

## Honest caveat
Local 32B won't match a frontier model on hard reasoning. The win isn't "local replaces frontier" — it's that *you* decide per task when the frontier model is worth paying for. Leverage stays with you, not the vendor.

## Open / next
- Capture the app's stack (language, framework, DB) → seed `AGENTS.md`.
- Generate starter `opencode.json` (architect/coder/reviewer wired up) + `AGENTS.md` template.
