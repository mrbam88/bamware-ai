import { readFile } from 'node:fs/promises';
import { unsupportedWindow } from '../rate-limits.mjs';

const providers = new Set(['openai-codex', 'opencode', 'anthropic', 'google', 'openrouter', 'unknown']);
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const bool = value => typeof value === 'boolean' ? value : null;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const alias = value => typeof value === 'string' && /^acct-[a-f0-9]{24}$/.test(value) ? value : null;
const identity = row => ({
  harness: row.harness === 'hermes' ? 'hermes' : 'opencode', machine: 'server',
  provider: providers.has(row.provider) ? row.provider : 'unknown', account: alias(row.account),
  identityEvidence: alias(row.account) && row.identityEvidence === 'provider-account-id-sha256' ? row.identityEvidence : null,
});

export async function readServerQuota({ serverQuotaFile, now = Date.now() } = {}) {
  let data;
  try { data = JSON.parse(await readFile(serverQuotaFile, 'utf8')); } catch {}
  const rows = Array.isArray(data?.coverage) ? data.coverage : ['hermes', 'opencode'].map(harness => ({
    harness, provider: 'unknown', status: 'unavailable', reason: 'No server collector snapshot available.',
  }));
  const coverage = rows.filter(r => r && ['hermes', 'opencode'].includes(r.harness)).map(row => {
    const checkedAt = date(row.checkedAt);
    const freshnessSec = checkedAt ? Math.max(0, (now - Date.parse(checkedAt)) / 1000) : null;
    const status = !checkedAt ? 'unknown' : freshnessSec > 900 ? 'stale' :
      ['observed', 'unknown', 'unavailable', 'unsupported'].includes(row.status) ? row.status : 'unknown';
    const c = row.controls || {};
    return { ...identity(row), checkedAt, freshnessSec, status,
      reason: typeof row.reason === 'string' ? row.reason.slice(0, 160) : null,
      controls: { hasCredits: bool(c.hasCredits), unlimited: bool(c.unlimited), balance: numeric(c.balance), resetCredits: numeric(c.resetCredits), spendLimit: numeric(c.spendLimit) },
    };
  });
  const windows = (Array.isArray(data?.windows) ? data.windows : []).filter(w => w &&
    ['hermes', 'opencode'].includes(w.harness) && w.provider === 'openai-codex' &&
    /^(primary|secondary)-(\d+(\.\d+)?min|unknown-window)$/.test(w.scope)
  ).map(w => ({ ...identity(w), scope: w.scope, utilizationPct: numeric(w.utilizationPct),
    resetAt: date(w.resetAt), resetTimezone: 'UTC',
    source: { kind: 'live', label: 'OpenAI usage endpoint · server collector', fetchedAt: date(w.source?.fetchedAt) },
    notes: 'Provider allowance, not a token cap. Matching account windows across harnesses share one meter.',
  }));
  for (const c of coverage) {
    if (!windows.some(w => w.harness === c.harness && w.provider === c.provider)) {
      windows.push({ ...unsupportedWindow({ provider: c.provider, scope: 'quota', reason: c.reason || 'Quota observation unavailable.' }), ...identity(c) });
    }
  }
  return { windows, coverage };
}
