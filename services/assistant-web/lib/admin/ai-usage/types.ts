// One hourly rollup of AI token usage: everything one transcript stream spent
// on one model within one UTC hour. The collector in bamware-ai
// (scripts/ai-usage-collect.py) recomputes these from local transcripts and
// re-posts them whole, so writes are idempotent overwrites keyed by
// (hourStart, host, source, sessionId, stream, model) — never increments.
export interface Rollup {
  hourStart: string // ISO UTC, truncated to the hour: 2026-09-30T14:00:00Z
  host: string // machine that produced it (thinkpad, omarchy, mac) or "manual"
  source: string // claude-code | opencode | cursor | cowork | ...
  sessionId: string
  stream: string // transcript file stem; a subagent has its own stream
  model: string
  repo: string
  branch: string
  ticket: string // "" when the branch names no ticket
  input: number
  output: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
  messages: number
  firstTs: string // ISO of the first message in this bucket
  lastTs: string // ISO of the last message in this bucket
  costUsd?: number // set only when the source reports cost itself (CSV)
}