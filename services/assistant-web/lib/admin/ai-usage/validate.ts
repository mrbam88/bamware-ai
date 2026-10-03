import { z } from 'zod'
import type { Rollup } from './types.ts'

const count = z.number().int().nonnegative().max(1e12)
const label = z.string().max(200)
const iso = z.string().datetime()

export const RollupSchema = z.object({
  hourStart: iso.refine((s) => /T\d\d:00:00(\.000)?Z$/.test(s), 'hourStart must be on the hour, UTC'),
  host: label.min(1),
  source: label.min(1),
  sessionId: label.min(1),
  stream: label.min(1),
  model: label.min(1),
  repo: label.default(''),
  branch: label.default(''),
  ticket: label.default(''),
  input: count,
  output: count,
  cacheWrite5m: count.default(0),
  cacheWrite1h: count.default(0),
  cacheRead: count.default(0),
  messages: count.default(0),
  firstTs: iso,
  lastTs: iso,
  costUsd: z.number().nonnegative().max(1e6).optional(),
})

// 2,000 rollups is about a month of heavy use on one machine; the collector
// sends only buckets touched since its last run, so real batches are small.
export const IngestSchema = z.object({ rollups: z.array(RollupSchema).min(1).max(2000) })

export function parseIngest(body: unknown): { ok: true; rollups: Rollup[] } | { ok: false; error: string } {
  const parsed = IngestSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: `${issue.path.join('.')}: ${issue.message}` }
  }
  return { ok: true, rollups: parsed.data.rollups }
}