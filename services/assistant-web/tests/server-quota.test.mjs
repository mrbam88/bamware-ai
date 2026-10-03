import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readServerQuota } from '../lib/providers/server-quota-adapter.mjs';
import { buildSnapshot } from '../lib/rate-limits.mjs';

const now = Date.parse('2026-10-02T19:00:00Z');
const at = new Date(now).toISOString();
const identity = { machine: 'server', provider: 'openai-codex', account: 'acct-' + 'a'.repeat(24), identityEvidence: 'provider-account-id-sha256' };

test('server snapshot is allowlisted, shared windows merge, missing controls stay unknown', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'server-quota-'));
  try {
    const serverQuotaFile = join(dir, 'quota.json');
    const data = {
      coverage: ['hermes', 'opencode'].map(harness => ({ ...identity, harness, checkedAt: at, status: 'observed', controls: { hasCredits: false, secret: 'do-not-export' }, secret: 'do-not-export' })),
      windows: ['hermes', 'opencode'].map(harness => ({ ...identity, harness, scope: 'primary-300min', utilizationPct: 87, resetAt: new Date(now + 3600000).toISOString(), source: { fetchedAt: at, secret: 'do-not-export' }, secret: 'do-not-export' })),
    };
    await writeFile(serverQuotaFile, JSON.stringify(data));
    const result = await readServerQuota({ serverQuotaFile, now });
    assert.ok(!JSON.stringify(result).includes('do-not-export'));
    assert.equal(result.coverage[0].controls.balance, null);
    assert.equal(result.coverage[0].controls.hasCredits, false);
    const snapshot = await buildSnapshot([{ name: 'server', run: () => result.windows }], {}, { now });
    assert.equal(snapshot.windows.length, 1);
    assert.equal(snapshot.windows[0].warning, true);
    assert.equal(snapshot.windows[0].observations.length, 2);
    const stale = await readServerQuota({ serverQuotaFile, now: now + 16 * 60000 });
    assert.equal(stale.coverage[0].status, 'stale');
    const rolled = await buildSnapshot([{ name: 'server', run: () => result.windows }], {}, { now: now + 3600000 });
    assert.equal(rolled.windows[0].state, 'stale');
    assert.equal(rolled.windows[0].utilizationPct, null);
    await writeFile(serverQuotaFile, '{malformed');
    const missing = await readServerQuota({ serverQuotaFile, now });
    assert.equal(missing.windows.length, 2);
    assert.ok(missing.windows.every(w => w.usedTokens === null));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
