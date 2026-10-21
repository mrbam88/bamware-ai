# Bamware control plane

How Bilal gives orders to the software factory and how agents answer. Decided 2026-10-20 (ADR 0002).

## Language

**Seat**:
The always-on process that receives short asks on the Discord notice board and routes them. It never runs a model itself and is not where Bilal chats.
_Avoid_: bot, gateway, assistant, Hermes

**Chat session**:
A long-lived agent CLI session (Claude Code, Codex, Grok, …) that Bilal talks to directly, wearing the Chief of Staff role. Vendor-agnostic by rule.
_Avoid_: the bot, the seat

**Runner**:
One installed agent CLI (Claude Code, Codex, opencode, cursor-agent, …) that a Seat hands a message to. Each Runner brings its own tools, approvals and sessions.
_Avoid_: harness, provider, worker (a Worker executes tickets; a Runner answers a message)

**Pool**:
One vendor subscription's quota, as the CFO measures it. A Runner draws from exactly one Pool.
_Avoid_: account, limit, budget

**Headroom**:
The percent of a Pool left in its tightest window. Unknown when the vendor exposes no usage API.
_Avoid_: remaining, capacity, quota left

**Floor**:
The Headroom below which a Runner is skipped. The CFO sets it.

**Halt**:
The CFO's kill switch. While a Halt is on, no Seat spawns any Runner and no batch starts.
_Avoid_: pause, emergency stop, freeze

**Thread note**:
The vendor-neutral record of one conversation that every Runner reads before answering and appends to after. The source of truth for a session; a Runner's own session store is a cache.
_Avoid_: session, history, memory

**Role**:
A skill a Runner wears for one message (Chief of Staff, Scrum Master, CFO, Engineering Lead). Named in the message, not a separate process.
_Avoid_: profile, agent, daemon

**Executor**:
The Overnight Mode service that runs one ticket to a PR. A Seat dispatches to it; it never answers chat.
_Avoid_: worker runner, batch runner
