# OpenCode setup

`bamware-ai` is the durable, tool-independent memory for Bamware. Store curated
facts, decisions, handoffs, and reusable workflows here. Do not store raw chat
transcripts, secrets, credentials, or large command logs.

## New laptop

1. Clone this repository at `~/code/bamware-ai`.
2. Merge the following into `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["/Users/bilalmalik/code/bamware-ai/AGENTS.md"],
  "skills": {
    "paths": ["/Users/bilalmalik/code/bamware-ai/skills"]
  },
  "references": {
    "bamware-ai": {
      "path": "/Users/bilalmalik/code/bamware-ai",
      "description": "Bamware system map, current state, durable decisions, skills, and templates"
    }
  },
  "compaction": { "auto": true, "tail_turns": 10 },
  "tool_output": { "max_lines": 200, "max_bytes": 8192 }
}
```

3. Keep provider credentials and machine-specific local-model configuration in
   that laptop's global config. Never commit credentials here.
4. Restart OpenCode; configuration and skills are loaded only at startup.
5. Use `/models` to switch models. The active session keeps its context; use
   `/new` for a clean context and `/compact` when a long session grows.

If the macOS username or clone location differs, update the absolute paths.

## Persistence model

- GitHub persists `AGENTS.md`, `STATE.md`, skills, docs, and templates.
- Each laptop keeps provider authentication, local models, and raw session
  history locally.
- Meaningful session outcomes are committed and pushed to this repository at
  verified milestones.
