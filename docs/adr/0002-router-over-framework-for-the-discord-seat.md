---
status: accepted (Bilal, 2026-10-20: "Go. ASAP, highest priority, deploy.")
date: 2026-10-20
---
# Router over framework for the Discord seat

The Discord seat was a Hermes gateway: a self-hosted agent framework that ran
its own agent loop, tool set, approvals, skill loader and session store, pinned
to one provider per profile. Every outage of the seat in September and October
2026 was inside that box (timeouts, the `tirith` approval that stalled a
release check, "collector not deployed", one daemon and one cron per role), and
when the pinned provider was rate-limited the seat went silent. Rate limits are
the company's binding constraint and Bilal wants no vendor lock. We decided the
seat is a **router, not an agent**: a ~200-line Node process we own that reads
the CFO's headroom, picks the first installed agent CLI with quota (Claude Code,
Codex, opencode, then any other logged-in CLI as a one-file plugin), execs it
non-interactively inside the repo checkout, and posts the answer back naming the
vendor. The repo (`AGENTS.md`, `STATE.md`, `skills/`) is the only shared brain,
so swapping vendors moves nothing; a vendor-neutral thread note, not any CLI's
session store, is the record of a conversation.

## Considered options

- **Keep Hermes and fix it.** Rejected: the bugs are in framework code we
  cannot read in an afternoon, and it still pins one provider per profile.
- **Claude Code's official Discord channel plugin.** Rejected as the whole
  answer: it is Claude-only, so the seat dies with the Claude Max window. It
  remains a fine first runner.
- **A custom bot that is itself an agent.** Rejected: that is Hermes again.

## Consequences

- Roles become skills a runner wears, not daemons. Hermes profiles and crons
  are retired (#197) after the router has run 48 h.
- The seat routes and never executes: engineering goes to the Overnight
  executor; the seat claims, dispatches and reports.
- Runners spawn in bypass mode (no permission prompts). The policy gates in
  `AGENTS.md` still bind by text: no surprise bills (company Rule #1, the CFO
  holds a halt that every seat and batch honours), App Store rules, no secrets
  in git.
- Quality drops on failover and live threads do not cross vendors; the thread
  note is the mitigation, accepted as good enough for chat.
- Design and diagrams: https://claude.ai/artifact/XDqEyLndAJuavvi6sD69fA
