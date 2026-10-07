// Synthetic fixtures only; never written to production state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionsSnapshot } from '../lib/decisions.mjs';
import { DEMO_DECISION_CANDIDATES } from '../lib/providers/decision-candidates-demo-fixtures.mjs';
const candidate = { ...DEMO_DECISION_CANDIDATES[0], id: 'test-retired-ask' };
const pending = { ...candidate, id: 'test-pending-approval' };
test('verified matching blocker resolution retires the ask; unavailable, unproven, mismatched and closed-parent sources do not', () => {
  const resolved = { id: candidate.id, candidateVersion: candidate.version, status: 'resolved', resolvedAt: '2026-10-07T00:00:00Z', resolutionEvidence: { ref: 'https://example.test/probe' } };
  for (const blocker of [resolved, { ...resolved, status: 'waiting_for_owner' }, { ...resolved, resolutionEvidence: null }, { ...resolved, candidateVersion: 'old' }, { ...resolved, id: pending.id }, { status: 'closed' }]) {
    const result = buildDecisionsSnapshot([candidate, pending], { responses: {} }, { blockers: { [candidate.id]: blocker } });
    assert.equal(result.decisions.length, blocker === resolved ? 1 : 2);
  }
  const unverified = buildDecisionsSnapshot([candidate], { responses: {} }, { resolutions: { [candidate.id]: { status: 'resolved' } } });
  assert.equal(unverified.decisions.length, 1);
});
const resolution = { status: 'superseded', reason: 'Test-only replacement ask prepared; publication still needs approval.', evidence: { ref: 'https://example.test/source' }, verifiedAt: '2026-10-07T00:00:00Z' };
test('source-backed retirement removes only the exact ask, preserving history and responses across reload/version bumps', () => {
  const store = { responses: { [candidate.id]: { candidateVersion: candidate.version, current: { action: 'discuss', decidedAt: '2026-10-06T00:00:00Z', handoff: { status: 'not_applicable' } } } } };
  const options = { resolutions: { [candidate.id]: resolution } };
  for (const version of [candidate.version, 'later-version']) {
    const result = buildDecisionsSnapshot([{ ...candidate, version }, pending], JSON.parse(JSON.stringify(store)), options);
    assert.deepEqual(result.decisions.map(d => d.id), [pending.id]);
    assert.equal(result.history[0].response.action, 'discuss');
    assert.deepEqual(result.history[0].resolution, resolution);
    assert.equal(result.history[0].handoff.status, 'not_applicable');
  }
});
