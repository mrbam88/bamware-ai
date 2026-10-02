import type { Rollup } from './types.ts'

// API list prices, $ per million tokens (Anthropic pricing as of 2026-09).
// Claude Max is flat-rate, so these give an "API-equivalent" cost: what the
// same traffic would have cost on the API. It is a comparison number, not a bill.
// Cache writes are 1.25x input (5-minute TTL) or 2x (1-hour TTL).
interface Price {
  input: number
  output: number
  cacheRead: number
}

const PRICES: Array<[prefix: string, price: Price]> = [
  ['claude-fable-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-fable-5', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-mythos', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-opus-5-5', { input: 4, output: 20, cacheRead: 0.2 }],
  ['claude-opus-5', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-sonnet-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['claude-sonnet-4', { input: 3, output: 15, cacheRead: 0.3 }],
  ['claude-haiku-4', { input: 1, output: 5, cacheRead: 0.1 }],
]

// Longest prefix first, so "claude-opus-5-5" isn't priced as "claude-opus-5".
PRICES.sort((a, b) => b[0].length - a[0].length)

export function priceFor(model: string): Price | null {
  const hit = PRICES.find(([prefix]) => model.startsWith(prefix))
  return hit ? hit[1] : null
}

/** API-equivalent $ for a rollup; 0 for models we can't price (e.g. local ones). */
export function costOf(r: Rollup): number {
  if (typeof r.costUsd === 'number') return r.costUsd
  const p = priceFor(r.model)
  if (!p) return 0
  return (
    (r.input * p.input +
      r.output * p.output +
      r.cacheWrite5m * p.input * 1.25 +
      r.cacheWrite1h * p.input * 2 +
      r.cacheRead * p.cacheRead) /
    1_000_000
  )
}