/**
 * Normalized AI usage model shared by every harness source.
 *
 * One `UsageEvent` is one billable model response. Harnesses record wildly
 * different shapes (Claude Code writes per-request JSONL, Codex writes
 * cumulative counters, opencode keeps per-session SQLite rows), so each source
 * adapter is responsible for flattening its own format into this type. Nothing
 * downstream — pricing, rollups, the API route, the UI — knows which harness a
 * row came from beyond the `harness` tag.
 */

export type Harness = 'claude-code' | 'codex' | 'opencode' | 'cursor'

/**
 * Where the money actually comes from. This distinction is the whole point of
 * the dashboard and must never be collapsed:
 *
 * - `subscription`: covered by a flat monthly fee (Claude Max 20x, Codex).
 *   Tokens here burn *quota*, not cash. Any dollar figure is API-equivalent
 *   value — what the same work would have cost on metered billing — and is NOT
 *   a bill. `docs/token-diet.md` makes the same distinction for the $650/$800
 *   figure it quotes.
 * - `metered`: real dollars, billed per token (the venue pipeline's API usage).
 * - `local`: runs on Bilal's own hardware. Always $0 (Ollama).
 */
export type Billing = 'subscription' | 'metered' | 'local'

export interface TokenCounts {
  /** Uncached input tokens, billed at the model's full input rate. */
  input: number
  /** Cache hits. Billed at 0.1x input (0.025x on Claude Fable 5.1). */
  cacheRead: number
  /** Cache writes with the 5-minute TTL. Billed at 1.25x input. */
  cacheWrite5m: number
  /** Cache writes with the 1-hour TTL. Billed at 2x input. */
  cacheWrite1h: number
  /** Output tokens, billed at the output rate. Includes `thinking`. */
  output: number
  /**
   * Thinking tokens, already counted inside `output`. Tracked separately for
   * visibility only — adding this to `output` would double-count.
   */
  thinking: number
}

export interface UsageEvent {
  /**
   * Stable per-response identity, used to deduplicate. Transcripts can be
   * rewritten (compaction, replay) and the same response may appear more than
   * once; ingesting twice must not inflate the totals.
   */
  id: string
  harness: Harness
  billing: Billing
  /** Raw model identifier as the harness recorded it. */
  model: string
  /** ISO-8601 instant the response completed. */
  at: string
  tokens: TokenCounts
  /** Groups events into one conversation/run. */
  sessionId?: string
  /** Working directory, used to attribute spend to a repo. */
  cwd?: string
  /** Repo basename derived from `cwd`. */
  repo?: string
  gitBranch?: string
  /** True when this was a subagent, not the main session. */
  subagent?: boolean
  /** Machine that produced the event, so snapshots can later be merged. */
  machine?: string
  /**
   * Cost in USD when the source itself reports one (opencode does). When
   * absent, cost is computed from the pricing table; when the model is unknown
   * to the pricing table, cost stays null rather than being invented.
   */
  reportedCostUsd?: number
}

/** A file or table we have already ingested, so the next run can skip it. */
export interface SourceCursor {
  /** Bytes already consumed, for append-only JSONL. */
  bytes: number
  /** Last-modified time observed, as epoch millis. */
  mtimeMs: number
}

export interface IngestWarning
  { source: Harness | 'store'; message: string }

/**
 * A quota reading the provider itself reported, rather than one we inferred.
 *
 * Codex writes this into every `token_count` event (`used_percent`,
 * `window_minutes`, `resets_at`, `plan_type`). It is strictly better than any
 * estimate, so where a provider gives us one we show it and say so. Claude Code
 * transcripts carry no equivalent field, which is exactly why the Claude window
 * cap has to be calibrated instead of read.
 */
export interface ProviderQuota {
  harness: Harness
  /** Percent of the window consumed, as the provider reported it. */
  usedPercent: number
  /** Length of the provider's window in minutes (Codex reports 10080 = weekly). */
  windowMinutes: number
  /** ISO instant the window resets, when the provider supplies it. */
  resetsAt?: string
  /** Subscription plan name as the provider reported it. */
  plan?: string
  /** When this reading was taken. */
  observedAt: string
}

export interface Snapshot {
  /** Snapshot format version, so a stale file can be detected and rebuilt. */
  version: 1
  /** When this snapshot was last written. */
  generatedAt: string
  /** Machine that wrote it. v1 is single-machine; merging is a follow-up. */
  machine: string
  events: UsageEvent[]
  /** Latest provider-reported quota reading per harness, when available. */
  quotas: ProviderQuota[]
  cursors: Record<string, SourceCursor>
  /**
   * Things that went wrong or could not be read. Surfaced in the UI rather
   * than swallowed — a source that silently contributes zero looks identical
   * to a source with no usage, and that would quietly understate spend.
   */
  warnings: IngestWarning[]
}

export function emptySnapshot(machine: string): Snapshot {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    machine,
    events: [],
    quotas: [],
    cursors: {},
    warnings: [],
  }
}

export function zeroTokens(): TokenCounts {
  return { input: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 0, thinking: 0 }
}

export function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: a.input + b.input,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
    output: a.output + b.output,
    thinking: a.thinking + b.thinking,
  }
}

/**
 * Every token that moved, cached or not. This is the number to compare against
 * a rate-limit window, because the window is consumed by total throughput and
 * not by what it would have cost.
 *
 * `thinking` is excluded on purpose: it is already part of `output`.
 */
export function totalTokens(t: TokenCounts): number {
  return t.input + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h + t.output
}