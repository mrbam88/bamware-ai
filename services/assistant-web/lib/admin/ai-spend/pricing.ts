import type { TokenCounts } from './types.ts'

/**
 * Model rates and the cache multipliers, in one place.
 *
 * Rates are USD per million tokens, as published on Anthropic's pricing page
 * (values cached 2026-06-24 via the bundled `claude-api` skill). They are
 * deliberately NOT inferred from model-name patterns: a wrong rate silently
 * produces a wrong dollar figure, which is worse than no figure at all. A model
 * absent from this table is reported as unpriced, never estimated.
 */

export interface ModelRate {
  /** USD per million uncached input tokens. */
  inputPerMTok: number
  /** USD per million output tokens. */
  outputPerMTok: number
  /**
   * Cache-read multiplier against the input rate. 0.1x everywhere except
   * Claude Fable 5.1, where reads are $0.25/MTok against a $10 input rate.
   */
  cacheReadMultiplier: number
}

/** Cache writes: 1.25x input for the 5-minute TTL, 2x for the 1-hour TTL. */
export const CACHE_WRITE_5M_MULTIPLIER = 1.25
export const CACHE_WRITE_1H_MULTIPLIER = 2.0

const DEFAULT_CACHE_READ_MULTIPLIER = 0.1

const OPUS: ModelRate = {
  inputPerMTok: 5,
  outputPerMTok: 25,
  cacheReadMultiplier: DEFAULT_CACHE_READ_MULTIPLIER,
}

const FABLE: ModelRate = {
  inputPerMTok: 10,
  outputPerMTok: 50,
  cacheReadMultiplier: DEFAULT_CACHE_READ_MULTIPLIER,
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'claude-opus-5': OPUS,
  'claude-opus-4-8': OPUS,
  'claude-opus-4-7': OPUS,
  'claude-opus-4-6': OPUS,
  'claude-sonnet-5': {
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheReadMultiplier: DEFAULT_CACHE_READ_MULTIPLIER,
  },
  'claude-sonnet-4-6': {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadMultiplier: DEFAULT_CACHE_READ_MULTIPLIER,
  },
  'claude-haiku-4-5': {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheReadMultiplier: DEFAULT_CACHE_READ_MULTIPLIER,
  },
  'claude-fable-5': FABLE,
  'claude-mythos-5-1': FABLE,
  // Fable 5.1 reads at $0.25/MTok against a $10 input rate — 0.025x, not 0.1x.
  'claude-fable-5-1': { ...FABLE, cacheReadMultiplier: 0.025 },
}

/**
 * Strip the decorations harnesses add to a model id so it matches the table.
 *
 * Claude Code records a context-window suffix on long-context sessions
 * (`claude-opus-5[1m]`), and some providers prefix the vendor
 * (`anthropic.claude-opus-5` on Bedrock).
 */
export function normalizeModelId(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/^(anthropic|openai|google)[./]/, '')
    .replace(/\[[^\]]*\]$/, '')
}

export function rateFor(model: string): ModelRate | null {
  return MODEL_RATES[normalizeModelId(model)] ?? null
}

/**
 * What this usage would cost on metered billing, in USD.
 *
 * Returns `null` for a model with no published rate in the table (e.g. the
 * OpenAI models Codex runs). `null` means "we do not know", and callers must
 * render it as unknown rather than as zero — a zero would understate spend and
 * read as if the work were free.
 *
 * For subscription-covered work this is API-equivalent value, not a bill. See
 * `Billing` in ./types.ts.
 */
export function costUsd(model: string, t: TokenCounts): number | null {
  const rate = rateFor(model)
  if (!rate) return null

  const inputRate = rate.inputPerMTok / 1_000_000
  const outputRate = rate.outputPerMTok / 1_000_000

  return (
    t.input * inputRate +
    t.cacheRead * inputRate * rate.cacheReadMultiplier +
    t.cacheWrite5m * inputRate * CACHE_WRITE_5M_MULTIPLIER +
    t.cacheWrite1h * inputRate * CACHE_WRITE_1H_MULTIPLIER +
    t.output * outputRate
  )
}

export function formatUsd(v: number | null): string {
  if (v === null) return 'n/a'
  if (v === 0) return '$0.00'
  if (v < 0.01) return '<$0.01'
  return `$${v.toFixed(2)}`
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}