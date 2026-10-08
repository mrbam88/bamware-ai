import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the exact browser classifier without starting a server or adding a
// public asset/API contract just to expose this presentation-only function.
const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = js.indexOf('  const STATUS_FACE =');
const end = js.indexOf('  let decisionActionPending =');
const present = vm.runInNewContext(`${js.slice(start, end)}; decisionPresentation`);
const approved = { response: { action: 'approve' }, handoff: { status: 'handoff_pending' } };
const cases = [
  ['unanswered asks', { urgency: 'low' }, 'awaiting', false, /When you can/],
  ['approval is not completion', approved, 'working', false, /awaiting worker/],
  ['checker completion is not worker completion', { ...approved, handoffCheck: { status: 'completed' } }, 'working', false, /awaiting worker/],
  ['Discord pickup is not worker execution', { ...approved, discussion: { status: 'ready', pickup: {} } }, 'working', false, /awaiting worker/],
  ['real pickup', { ...approved, handoff: { status: 'pickup_confirmed' } }, 'working', false, /Worker picked/],
  ['worker completion', { ...approved, handoff: { status: 'completed' } }, 'resolved', true, /Worker finished/],
  ['source retirement', { resolution: { status: 'resolved' } }, 'resolved', true, /Resolved/],
  ['supersession is not completion', { resolution: { status: 'superseded' } }, 'resolved', true, /Replaced/],
  ['stale completion stays actionable', { ...approved, handoff: { status: 'completed' }, stale: true }, 'awaiting', false, /fresh look/],
  ['open blocker outranks completed handoff', { ...approved, handoff: { status: 'completed' }, ownerBlocker: { status: 'waiting_for_owner' } }, 'awaiting', false, /your action/],
  ['deferred remains visible', { response: { action: 'defer' } }, 'paused', false, /still open/],
  ['rejection without follow-through can collapse', { response: { action: 'reject' }, handoff: { status: 'not_applicable' } }, 'paused', true, /not dispatched/],
  ['rejected but checker running remains visible', { response: { action: 'reject' }, handoff: { status: 'not_applicable' }, handoffCheck: { status: 'running' } }, 'working', false, /follow-through open/],
  ['rejected blocker remains visible', { response: { action: 'reject' }, handoff: { status: 'not_applicable' }, ownerBlocker: { status: 'cancelled' } }, 'working', false, /follow-through open/],
  ['discussion remains visible', { response: { action: 'discuss' } }, 'working', false, /not approved/],
];
for (const [name, data, tone, archive, label] of cases) test(name, () => {
  const result = present(data);
  assert.equal(result.tone, tone);
  assert.equal(result.archive, archive);
  assert.match(result.label, label);
});
for (const fault of [
  { handoffCheck: { status: 'failed' } },
  { handoffCheck: { status: 'interrupted' } },
  { handoffCheck: { notification: { status: 'unknown' } } },
  { ownerBlocker: { status: 'source_error' } },
  { ownerBlocker: { reconciliation: { state: 'unavailable' } } },
  { ownerBlocker: { resume: { status: 'dispatch_unknown' } } },
  { ownerBlocker: { notification: { status: 'failed' } } },
  { discussion: { status: 'repair_required' } },
  { handoff: { status: 'handoff_pending', reason: 'Worker error: Fixture dispatch failed' } },
]) test(`errors stay visible, even with completion: ${JSON.stringify(fault)}`, () => {
  const result = present({ ...approved, handoff: { status: 'completed' }, ...fault });
  assert.equal(result.tone, 'error');
  assert.equal(result.archive, false);
});
