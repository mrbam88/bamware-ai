import { createHash } from 'node:crypto'
import type { Rollup } from './types.ts'

// Manual import for tools with no local transcripts or usable API (Cursor,
// Cowork, provider console exports). One row per day+tool+model:
//
//   date,source,model,input_tokens,output_tokens,cost_usd
//   2026-09-29,cursor,claude-sonnet-5,120000,40000,1.20
//
// Optional columns: cache_read_tokens, cache_write_tokens, messages.
// cost_usd is optional too; without it the price table is used.
// Re-importing the same row overwrites it (the key is a hash of date+source+model).

const REQUIRED = ['date', 'source', 'model', 'input_tokens', 'output_tokens'] as const

export interface CsvResult {
  rollups: Rollup[]
  errors: string[]
}

function splitLine(line: string): string[] {
  // Exports quote fields containing commas; nothing here needs escaped quotes.
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

function int(v: string | undefined): number {
  if (!v) return 0
  const n = Number(v.replace(/[_,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN
}

export function parseUsageCsv(text: string): CsvResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { rollups: [], errors: ['CSV is empty'] }
  const header = splitLine(lines[0]).map((h) => h.toLowerCase())
  const missing = REQUIRED.filter((c) => !header.includes(c))
  if (missing.length) return { rollups: [], errors: [`missing column(s): ${missing.join(', ')}`] }

  const rollups: Rollup[] = []
  const errors: string[] = []
  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line)
    const row = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']))
    const where = `row ${i + 2}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return void errors.push(`${where}: date must be YYYY-MM-DD`)
    if (!row.source || !row.model) return void errors.push(`${where}: source and model are required`)
    const input = int(row.input_tokens)
    const output = int(row.output_tokens)
    const cacheRead = int(row.cache_read_tokens)
    const cacheWrite = int(row.cache_write_tokens)
    const messages = int(row.messages)
    if ([input, output, cacheRead, cacheWrite, messages].some(Number.isNaN)) {
      return void errors.push(`${where}: token counts must be non-negative numbers`)
    }
    const cost = row.cost_usd ? Number(row.cost_usd.replace(/^\$/, '')) : undefined
    if (cost !== undefined && !(Number.isFinite(cost) && cost >= 0)) {
      return void errors.push(`${where}: cost_usd must be a non-negative number`)
    }
    const source = row.source.toLowerCase()
    const id = createHash('sha256').update(`${row.date}|${source}|${row.model}`).digest('hex').slice(0, 16)
    // Pin a daily total to noon UTC so it lands on the same calendar day in any US zone.
    const noon = `${row.date}T12:00:00.000Z`
    rollups.push({
      hourStart: noon, host: 'manual', source, sessionId: `csv-${id}`, stream: 'csv', model: row.model,
      repo: '', branch: '', ticket: '', input, output, cacheWrite5m: cacheWrite, cacheWrite1h: 0, cacheRead,
      messages, firstTs: noon, lastTs: noon, ...(cost !== undefined ? { costUsd: cost } : {}),
    })
  })
  return { rollups, errors }
}