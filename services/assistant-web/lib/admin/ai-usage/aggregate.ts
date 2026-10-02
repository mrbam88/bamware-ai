import { costOf } from './pricing.ts'
import type { Rollup } from './types.ts'

const HOUR = 3_600_000
const WINDOW_MS = 5 * HOUR
const RUNNING_MS = 10 * 60_000

/**
 * Tokens that count against the Claude plan window. Cache reads are excluded:
 * they are ~10x cheaper and would drown the signal. The limit this is compared
 * against (AI_USAGE_WINDOW_TOKEN_LIMIT) is itself an assumption — see
 * bamware-ai docs/token-diet.md — so treat the percentage as a gauge.
 */
export function windowTokens(r: Rollup): number {
  return r.input + r.output + r.cacheWrite5m + r.cacheWrite1h
}

export function totalTokens(r: Rollup): number {
  return windowTokens(r) + r.cacheRead
}

export interface Totals {
  tokens: number
  windowTokens: number
  cacheRead: number
  output: number
  costUsd: number
  messages: number
  sessions: number
}

export function totals(rows: Rollup[]): Totals {
  const sessions = new Set<string>()
  const t: Totals = { tokens: 0, windowTokens: 0, cacheRead: 0, output: 0, costUsd: 0, messages: 0, sessions: 0 }
  for (const r of rows) {
    t.tokens += totalTokens(r)
    t.windowTokens += windowTokens(r)
    t.cacheRead += r.cacheRead
    t.output += r.output
    t.costUsd += costOf(r)
    t.messages += r.messages
    sessions.add(`${r.host}/${r.sessionId}`)
  }
  t.sessions = sessions.size
  return t
}

export interface Group {
  key: string
  tokens: number
  costUsd: number
}

/** Sum rows by a key, largest cost first. Empty keys become "(none)". */
export function groupBy(rows: Rollup[], key: (r: Rollup) => string, limit = 10): Group[] {
  const map = new Map<string, Group>()
  for (const r of rows) {
    const k = key(r) || '(none)'
    const g = map.get(k) ?? { key: k, tokens: 0, costUsd: 0 }
    g.tokens += totalTokens(r)
    g.costUsd += costOf(r)
    map.set(k, g)
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens).slice(0, limit)
}

export interface Session {
  host: string
  sessionId: string
  source: string
  repo: string
  branch: string
  ticket: string
  models: string[]
  firstTs: string
  lastTs: string
  tokens: number
  costUsd: number
}

/** Collapse rollups (all streams, models and hours) into one row per session. */
export function sessions(rows: Rollup[]): Session[] {
  const map = new Map<string, Session>()
  for (const r of rows) {
    const k = `${r.host}/${r.sessionId}`
    let s = map.get(k)
    if (!s) {
      s = {
        host: r.host, sessionId: r.sessionId, source: r.source, repo: r.repo, branch: r.branch,
        ticket: r.ticket, models: [], firstTs: r.firstTs, lastTs: r.lastTs, tokens: 0, costUsd: 0,
      }
      map.set(k, s)
    }
    if (!s.models.includes(r.model)) s.models.push(r.model)
    if (r.firstTs < s.firstTs) s.firstTs = r.firstTs
    if (r.lastTs > s.lastTs) s.lastTs = r.lastTs
    s.tokens += totalTokens(r)
    s.costUsd += costOf(r)
  }
  return [...map.values()]
}

export function topSessions(rows: Rollup[], n = 10): Session[] {
  return sessions(rows).sort((a, b) => b.costUsd - a.costUsd).slice(0, n)
}

/** Sessions with a message in the last 10 minutes, newest first. */
export function runningNow(rows: Rollup[], now: Date): Session[] {
  const cutoff = now.getTime() - RUNNING_MS
  return sessions(rows)
    .filter((s) => Date.parse(s.lastTs) >= cutoff)
    .sort((a, b) => b.lastTs.localeCompare(a.lastTs))
}

export interface Window {
  start: string | null // ISO; null when no window is open
  resetsAt: string | null // when open: its reset; when idle: when the last one reset
  windowTokens: number
  costUsd: number
}

/**
 * Reconstruct the current Claude plan window. A window opens at the first
 * message after the previous one expired, floored to the hour, and lasts five
 * hours. Only Claude-plan sources count (the Max limit is per account, across
 * every machine). Walks buckets oldest-first, which is why rows from the
 * previous ~10 hours must be passed in.
 */
export function currentWindow(rows: Rollup[], now: Date, planSources = ['claude-code', 'cowork']): Window {
  const plan = rows
    .filter((r) => planSources.includes(r.source))
    .sort((a, b) => a.firstTs.localeCompare(b.firstTs))
  let start: number | null = null
  for (const r of plan) {
    const t = Date.parse(r.firstTs)
    if (start === null || t >= start + WINDOW_MS) start = Math.floor(t / HOUR) * HOUR
  }
  if (start === null || now.getTime() >= start + WINDOW_MS) {
    const lastReset = start === null ? null : new Date(start + WINDOW_MS).toISOString()
    return { start: null, resetsAt: lastReset, windowTokens: 0, costUsd: 0 }
  }
  const s = start
  const inWindow = plan.filter((r) => Date.parse(r.hourStart) >= s)
  const t = totals(inWindow)
  return {
    start: new Date(s).toISOString(),
    resetsAt: new Date(s + WINDOW_MS).toISOString(),
    windowTokens: t.windowTokens,
    costUsd: t.costUsd,
  }
}

export interface HourPoint {
  hourStart: string
  tokens: number
  costUsd: number
}

/** A dense hourly series ending at `now` — empty hours are zeros, not gaps. */
export function hourlySeries(rows: Rollup[], now: Date, hours: number): HourPoint[] {
  const end = Math.floor(now.getTime() / HOUR) * HOUR
  const points: HourPoint[] = []
  const index = new Map<number, HourPoint>()
  for (let t = end - (hours - 1) * HOUR; t <= end; t += HOUR) {
    const p = { hourStart: new Date(t).toISOString(), tokens: 0, costUsd: 0 }
    points.push(p)
    index.set(t, p)
  }
  for (const r of rows) {
    const p = index.get(Date.parse(r.hourStart))
    if (!p) continue
    p.tokens += windowTokens(r)
    p.costUsd += costOf(r)
  }
  return points
}

/** Midnight of `now`'s calendar day in `timeZone`, as a UTC instant. */
export function startOfDay(now: Date, timeZone: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const elapsed = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000
  return new Date(Math.floor((now.getTime() - elapsed) / 1000) * 1000)
}

/** Rows whose hour starts at or after `from` (callers pass an hour boundary). */
export function since(rows: Rollup[], from: Date): Rollup[] {
  const f = from.getTime()
  return rows.filter((r) => Date.parse(r.hourStart) >= f)
}