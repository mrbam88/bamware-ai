import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from '../lib/rate-limits.mjs';

const now = Date.parse('2026-10-02T19:00:00Z');
const reading = (harness, account = 'acct-test') => ({
  provider: 'openai-codex', account, identityEvidence: account ? 'provider-account-id-sha256' : null,
  scope: 'primary-300min', harness, machine: 'server', utilizationPct: 40,
  source: { kind: 'live', label: 'usage endpoint', fetchedAt: new Date(now).toISOString() },
});

test('one account and scope across harnesses has one meter with both observation sources', async () => {
  const s = await buildSnapshot([{ name: 'test', run: () => [reading('hermes'), reading('opencode')] }], {}, { now });
  assert.equal(s.windows.length, 1);
  assert.deepEqual(s.windows[0].observations.map(o => o.harness), ['hermes', 'opencode']);
  assert.equal(s.windows[0].account, 'acct-test');
});

test('unknown identity, unproven alias, different accounts and scopes never collapse', async () => {
  for (const rows of [
    [reading('hermes', null), reading('opencode', null)],
    [reading('hermes', 'acct-a'), reading('opencode', 'acct-b')],
    [reading('hermes'), { ...reading('opencode'), scope: 'secondary-10080min' }],
    [reading('hermes'), { ...reading('opencode'), identityEvidence: null }],
  ]) {
    const s = await buildSnapshot([{ name: 'test', run: () => rows }], {}, { now });
    assert.equal(s.windows.length, 2);
    assert.equal(new Set(s.windows.map(w => w.id)).size, 2);
  }
});

test('dedup chooses newest observation, never sums percentages or revives a pre-reset reading', async () => {
  const old = { ...reading('opencode'), utilizationPct: 100, source: { kind: 'live', fetchedAt: new Date(now - 3600000).toISOString() } };
  const current = { ...reading('hermes'), utilizationPct: 25 };
  const s = await buildSnapshot([{ name: 'test', run: () => [old, current] }], {}, { now });
  assert.equal(s.windows[0].utilizationPct, 25);
  assert.equal(s.windows[0].state, 'fresh');
});
