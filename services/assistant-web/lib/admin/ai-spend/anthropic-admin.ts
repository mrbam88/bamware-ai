/**
 * Metered Anthropic spend, via the Usage & Cost Admin API.
 *
 * This is the only part of the dashboard that reports *cash*. Everything from
 * the local transcripts is subscription-covered quota burn, whose dollar figures
 * are API-equivalent value rather than a bill.
 *
 * Facts that shape this client (docs: platform.claude.com/docs/en/manage-claude/usage-cost-api):
 *
 * - These endpoints are **not in any Anthropic SDK** — raw HTTP only.
 * - Credentials: an Admin API key (`***...`), an `org:admin` OAuth
 *   token, or a personal/service-account key that is *not* workspace-scoped.
 *   Workspace-scoped keys are rejected. So the existing vault key
 *   `/bamware/shared/anthropic-api-key` is worth trying before creating a new
 *   one — hence `ANTHROPIC_ADMIN_KEY` falling back to `ANTHROPIC_API_KEY`.
 * - The Admin API is unavailable for individual (non-organization) accounts.
 *   That returns an auth error, which is surfaced verbatim rather than hidden.
 * - **Costs come back as decimal strings in cents**, not dollars. Dividing by
 *   100 is required; forgetting it overstates spend 100x.
 * - Cost buckets are daily only; the usage endpoint allows 1m/1h/1d with a
 *   maximum of 31 daily buckets per request.
 */

const API_BASE = 'https://api.anthropic.com'
const ANTHROPIC_VERSION = '2023-06-01'
const USER_AGENT = 'bamware-web-ai-spend/0.1.0 (https://bamware.io)'

/** Daily buckets are capped at 31 per request by the API. */
export const MAX_DAILY_BUCKETS = 31

/** Per-request ceiling. The dashboard awaits this, so it must not hang. */
const REQUEST_TIMEOUT_MS = 10_000

export interface MeteredDay {
  /** YYYY-MM-DD. */
  date: string
  /** Real dollars for that day. */
  costUsd: number
  /** Cost lines for the day, e.g. per model or "Code Execution Usage". */
  items: { description: string; costUsd: number }[]
}

export type MeteredReport =
  | { configured: false; reason: string }
  | { configured: true; ok: false; error: string }
  | {
      configured: true
      ok: true
      from: string
      to: string
      totalUsd: number
      days: MeteredDay[]
      /** True when the API reported more pages than we fetched. */
      truncated: boolean
    }

export function adminKey(): string | null {
  // A dedicated admin key wins; otherwise try the existing shared key, which
  // works if it is not workspace-scoped.
  return process.env.ANTHROPIC_ADMIN_KEY || process.env.ANTHROPIC_API_KEY || null
}

/** Cents-as-decimal-string -> dollars. */
export function centsToUsd(raw: unknown): number {
  if ((typeof raw !== 'number' && typeof raw !== 'string') || raw === '') throw new Error('Missing cost amount')
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid cost amount')
  return n / 100
}

interface CostBucket {
  starting_at?: string
  ending_at?: string
  results?: {
    amount?: string | number
    currency?: string
    description?: string
    model?: string
  }[]
}

/**
 * Fetch the metered cost report for the last `days` days.
 *
 * Never throws: a dashboard panel that explodes on a missing credential is
 * worse than one that says "not configured".
 */
export async function fetchMeteredCost(
  days = 30,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
  key: string | null = adminKey(),
): Promise<MeteredReport> {
  if (!key) {
    return {
      configured: false,
      reason:
        'No ANTHROPIC_ADMIN_KEY (or ANTHROPIC_API_KEY) in the environment. Metered spend is unknown — this is not the same as $0.',
    }
  }

  const bucketDays = Math.min(days, MAX_DAILY_BUCKETS)
  const endingAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 86_400_000,
  )
  const startingAt = new Date(endingAt.getTime() - bucketDays * 86_400_000)

  const params = new URLSearchParams({
    starting_at: startingAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ending_at: endingAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })
  params.append('group_by[]', 'description')

  const days_: MeteredDay[] = []
  let truncated = false
  let page: string | null = null
  let guard = 0

  try {
    do {
      const url = new URL(`${API_BASE}/v1/organizations/cost_report`)
      url.search = params.toString()
      if (page) url.searchParams.set('page', page)

      const res = await fetchImpl(url.toString(), {
        redirect: 'error',
        headers: {
          'anthropic-version': ANTHROPIC_VERSION,
          'x-api-key': key,
          'User-Agent': USER_AGENT,
        },
        // The dashboard route awaits this call, so an upstream that accepts the
        // connection and then hangs would stall the whole page rather than
        // degrade one panel. Bound it.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!res.ok) {
        await res.body?.cancel()
        return {
          configured: true,
          ok: false,
          error: `Cost report returned ${res.status}.`,
        }
      }

      const json = (await res.json()) as {
        data?: CostBucket[]
        has_more?: boolean
        next_page?: string | null
      }

      if (!Array.isArray(json.data)) throw new Error('Missing cost buckets')
      for (const bucket of json.data) {
        if (!Array.isArray(bucket.results)) throw new Error('Missing cost results')
        const date = (bucket.starting_at ?? '').slice(0, 10)
        const items = (bucket.results ?? []).map((r) => ({
          description: r.description ?? r.model ?? 'unknown',
          costUsd: centsToUsd(r.amount),
        }))
        days_.push({
          date,
          costUsd: items.reduce((a, b) => a + b.costUsd, 0),
          items,
        })
      }

      // `has_more` with no cursor means the API says there is more but gave us
      // no way to ask for it. Ending the loop there is right, but it must be
      // reported as truncated rather than presented as a complete total.
      if (json.has_more && !json.next_page) truncated = true
      page = json.has_more ? (json.next_page ?? null) : null
      guard++
      if (guard > 20 && page) {
        truncated = true
        break
      }
    } while (page)
  } catch (err) {
    const e = err as Error
    const message =
      e.name === 'TimeoutError' || e.name === 'AbortError'
        ? `Cost report timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
        : 'Cost report request failed.'
    return { configured: true, ok: false, error: message }
  }

  return {
    configured: true,
    ok: true,
    from: startingAt.toISOString(),
    to: endingAt.toISOString(),
    totalUsd: days_.reduce((a, d) => a + d.costUsd, 0),
    days: days_,
    truncated,
  }
}