import {
  CACHE_WRITE_1H_MULTIPLIER,
  CACHE_WRITE_5M_MULTIPLIER,
  costUsd,
  rateFor,
} from './pricing.ts'
import {
  addTokens,
  totalTokens,
  zeroTokens,
  type Billing,
  type Harness,
  type TokenCounts,
  type UsageEvent,
} from './types.ts'

/** Claude's subscription rate limit runs in rolling 5-hour windows. */
export const WINDOW_HOURS = 5

/**
 * Deduplicate by event id, newest ingest winning.
 *
 * Both halves matter. Claude Code can write the same response into more than
 * one transcript record, so duplicates must collapse. Codex events are keyed by
 * transcript path and are re-emitted with larger totals as a session grows, so
 * the later value must replace the earlier one rather than be discarded.
 */
export function mergeEvents(existing: UsageEvent[], incoming: UsageEvent[]): UsageEvent[] {
  const byId = new Map<string, UsageEvent>()
  for (const e of existing) byId.set(e.id, e)
  for (const e of incoming) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * Cost for one event, in USD, or null when it cannot be known.
 *
 * A source that computes its own cost wins over our pricing table. Otherwise we
 * price it from the table, and a model absent from the table yields null — never
 * a zero standing in for "unknown".
 */
export function eventCost(e: UsageEvent): number | null {
  if (typeof e.reportedCostUsd === 'number') return e.reportedCostUsd
  return costUsd(e.model, e.tokens)
}

export interface Bucket {
  key: string
  tokens: TokenCounts
  total: number
  costUsd: number
  /** True when at least one event in the bucket had no known rate. */
  hasUnpriced: boolean
  events: number
}

function bucketize(events: UsageEvent[], keyOf: (e: UsageEvent) => string | undefined): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const e of events) {
    const key = keyOf(e) ?? 'unknown'
    let b = map.get(key)
    if (!b) {
      b = { key, tokens: zeroTokens(), total: 0, costUsd: 0, hasUnpriced: false, events: 0 }
      map.set(key, b)
    }
    b.tokens = addTokens(b.tokens, e.tokens)
    b.total += totalTokens(e.tokens)
    b.events += 1
    const c = eventCost(e)
    if (c === null) b.hasUnpriced = true
    else b.costUsd += c
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export const byModel = (e: UsageEvent[]) => bucketize(e, (x) => x.model)
export const byRepo = (e: UsageEvent[]) => bucketize(e, (x) => x.repo)
export const byHarness = (e: UsageEvent[]) => bucketize(e, (x) => x.harness)
export const byDay = (e: UsageEvent[]) => bucketize(e, (x) => x.at.slice(0, 10))

export interface WindowState {
  /** Start of the rolling window. */
  from: string
  /** End of the rolling window (usually now). */
  to: string
  tokens: TokenCounts
  /** Every token that moved in the window — what a rate limit actually consumes. */
  total: number
  costUsd: number
  hasUnpriced: boolean
  events: number
  /** Tokens per hour, measured over the window's elapsed portion. */
  tokensPerHour: number
  /**
   * The configured window cap. This is NOT reported by Anthropic anywhere —
   * `docs/token-diet.md` carries it as an explicit assumption. It is
   * calibratable, and `peakWindowTotal` below is the measured evidence to
   * calibrate it against.
   */
  assumedCap: number
  /** Fraction of the assumed cap consumed, clamped to [0, 1] for display. */
  fractionOfCap: number
  /**
   * When the window is projected to be exhausted at the current rate, or null
   * when the rate is zero or the cap is already passed.
   */
  projectedExhaustionAt: string | null
}

/**
 * Burn inside the rolling window ending at `now`.
 *
 * Only pass events that share one quota pool — mixing harnesses here would
 * produce a meaningless number, since Claude Max and Codex have separate limits
 * (and separate window lengths: 5 hours versus Codex's reported 10080 minutes).
 */
export function rollingWindow(
  events: UsageEvent[],
  now: Date,
  assumedCap: number,
  hours: number = WINDOW_HOURS,
): WindowState {
  const toMs = now.getTime()
  const fromMs = toMs - hours * 3600_000

  let tokens = zeroTokens()
  let cost = 0
  let hasUnpriced = false
  let count = 0
  let earliestMs = toMs

  for (const e of events) {
    const t = Date.parse(e.at)
    if (!Number.isFinite(t) || t < fromMs || t > toMs) continue
    tokens = addTokens(tokens, e.tokens)
    count += 1
    if (t < earliestMs) earliestMs = t
    const c = eventCost(e)
    if (c === null) hasUnpriced = true
    else cost += c
  }

  const total = totalTokens(tokens)

  // Rate is measured over the part of the window that actually contains
  // activity. Dividing by the full 5 hours after a 20-minute burst would
  // understate the rate by an order of magnitude and hide an imminent wall.
  const elapsedHours = Math.max((toMs - earliestMs) / 3600_000, 1 / 60)
  const tokensPerHour = count > 0 ? total / elapsedHours : 0

  const remaining = assumedCap - total
  const projectedExhaustionAt =
    tokensPerHour > 0 && remaining > 0
      ? new Date(toMs + (remaining / tokensPerHour) * 3600_000).toISOString()
      : null

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    tokens,
    total,
    costUsd: cost,
    hasUnpriced,
    events: count,
    tokensPerHour,
    assumedCap,
    fractionOfCap: assumedCap > 0 ? Math.min(total / assumedCap, 1) : 0,
    projectedExhaustionAt,
  }
}

/**
 * The largest token total observed in any `hours`-long window across all
 * history.
 *
 * This is the measured counterweight to the assumed cap. Bilal's sessions run
 * with extra usage OFF, so any window he completed without being cut off proves
 * the real cap is at least this high. If the peak exceeds the configured cap,
 * the configured cap is provably wrong.
 */
export function peakWindowTotal(
  events: UsageEvent[],
  hours: number = WINDOW_HOURS,
): { total: number; endingAt: string | null } {
  const points = events
    .map((e) => ({ t: Date.parse(e.at), n: totalTokens(e.tokens) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)

  const spanMs = hours * 3600_000
  let best = 0
  let bestEnd: number | null = null
  let sum = 0
  let head = 0

  for (let tail = 0; tail < points.length; tail++) {
    sum += points[tail].n
    while (points[tail].t - points[head].t > spanMs) {
      sum -= points[head].n
      head++
    }
    if (sum > best) {
      best = sum
      bestEnd = points[tail].t
    }
  }

  return { total: best, endingAt: bestEnd === null ? null : new Date(bestEnd).toISOString() }
}

export interface Totals {
  tokens: TokenCounts
  total: number
  /** API-equivalent value of subscription work. Not a bill. */
  subscriptionEquivalentUsd: number
  /** Real money, billed per token. */
  meteredUsd: number
  hasUnpriced: boolean
  events: number
}

export function totalsFor(events: UsageEvent[]): Totals {
  let tokens = zeroTokens()
  let subscriptionEquivalentUsd = 0
  let meteredUsd = 0
  let hasUnpriced = false

  for (const e of events) {
    tokens = addTokens(tokens, e.tokens)
    const c = eventCost(e)
    if (c === null) {
      hasUnpriced = true
      continue
    }
    if (e.billing === 'metered') meteredUsd += c
    else if (e.billing === 'subscription') subscriptionEquivalentUsd += c
  }

  return {
    tokens,
    total: totalTokens(tokens),
    subscriptionEquivalentUsd,
    meteredUsd,
    hasUnpriced,
    events: events.length,
  }
}

export function eventsInLastDays(events: UsageEvent[], days: number, now: Date): UsageEvent[] {
  const cutoff = now.getTime() - days * 86_400_000
  return events.filter((e) => {
    const t = Date.parse(e.at)
    return Number.isFinite(t) && t >= cutoff
  })
}

export function filterHarness(events: UsageEvent[], harness: Harness): UsageEvent[] {
  return events.filter((e) => e.harness === harness)
}

export function filterBilling(events: UsageEvent[], billing: Billing): UsageEvent[] {
  return events.filter((e) => e.billing === billing)
}

export interface ClassLine {
  /** Token class: input, cacheRead, cacheWrite5m, cacheWrite1h, output. */
  key: keyof TokenCounts
  label: string
  tokens: number
  /** USD attributable to this class, across every priced event. */
  costUsd: number
}

export interface Composition {
  lines: ClassLine[]
  totalTokens: number
  totalCostUsd: number
  /**
   * What the cached tokens would have cost at the full input rate, minus what
   * they actually cost. The single clearest argument for prompt caching, and it
   * is measured rather than asserted.
   */
  cacheSavingsUsd: number
  /**
   * What the 1-hour cache writes would have cost on the 5-minute TTL (1.25x
   * instead of 2x). Not a free win — the long TTL is what keeps a slow agent
   * session warm — but it is the largest single lever in the cost mix.
   */
  write1hAtShortTtlUsd: number
  write1hActualUsd: number
}

const CLASS_LABELS: { key: keyof TokenCounts; label: string }[] = [
  { key: 'cacheRead', label: 'cache read' },
  { key: 'cacheWrite1h', label: 'cache write 1h' },
  { key: 'cacheWrite5m', label: 'cache write 5m' },
  { key: 'output', label: 'output' },
  { key: 'input', label: 'fresh input' },
]

/**
 * Split tokens and dollars by token class.
 *
 * Volume and cost diverge violently here — cache reads dominate the token count
 * while costing a tenth of the input rate — so showing one without the other
 * misleads. Only events with a known rate contribute cost; their tokens still
 * count toward the volume of their class.
 */
export function composition(events: UsageEvent[]): Composition {
  const tokens = new Map<keyof TokenCounts, number>()
  const cost = new Map<keyof TokenCounts, number>()
  let cacheSavingsUsd = 0
  let write1hActualUsd = 0
  let write1hAtShortTtlUsd = 0

  for (const e of events) {
    const rate = rateFor(e.model)
    for (const { key } of CLASS_LABELS) {
      const n = e.tokens[key]
      if (!n) continue
      tokens.set(key, (tokens.get(key) ?? 0) + n)
      if (!rate) continue

      const inputRate = rate.inputPerMTok / 1_000_000
      let c = 0
      if (key === 'input') c = n * inputRate
      else if (key === 'cacheRead') c = n * inputRate * rate.cacheReadMultiplier
      else if (key === 'cacheWrite5m') c = n * inputRate * CACHE_WRITE_5M_MULTIPLIER
      else if (key === 'cacheWrite1h') c = n * inputRate * CACHE_WRITE_1H_MULTIPLIER
      else if (key === 'output') c = n * (rate.outputPerMTok / 1_000_000)
      cost.set(key, (cost.get(key) ?? 0) + c)

      if (key === 'cacheRead') cacheSavingsUsd += n * inputRate - c
      if (key === 'cacheWrite1h') {
        write1hActualUsd += c
        write1hAtShortTtlUsd += n * inputRate * CACHE_WRITE_5M_MULTIPLIER
      }
    }
  }

  const lines = CLASS_LABELS.map(({ key, label }) => ({
    key,
    label,
    tokens: tokens.get(key) ?? 0,
    costUsd: cost.get(key) ?? 0,
  })).filter((l) => l.tokens > 0)

  return {
    lines,
    totalTokens: lines.reduce((a, l) => a + l.tokens, 0),
    totalCostUsd: lines.reduce((a, l) => a + l.costUsd, 0),
    cacheSavingsUsd,
    write1hAtShortTtlUsd,
    write1hActualUsd,
  }
}

/** Models seen in the data that have no rate in the pricing table. */
export function unpricedModels(events: UsageEvent[]): string[] {
  const out = new Set<string>()
  for (const e of events) {
    if (typeof e.reportedCostUsd === 'number') continue
    if (!rateFor(e.model)) out.add(e.model)
  }
  return [...out].sort()
}