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
  // Confirm clears Needs-you (archive) — CEO bar bamware-ai#141.
  ['approval leaves Needs-you', approved, 'working', true, /awaiting worker/],
  ['checker completion still archived after approve', { ...approved, handoffCheck: { status: 'completed' } }, 'working', true, /awaiting worker/],
  ['Discord pickup is not worker execution', { ...approved, discussion: { status: 'ready', pickup: {} } }, 'working', true, /awaiting worker/],
  ['real pickup archives', { ...approved, handoff: { status: 'pickup_confirmed' } }, 'working', true, /Worker picked/],
  ['worker completion', { ...approved, handoff: { status: 'completed' } }, 'resolved', true, /Worker finished/],
  ['source retirement', { resolution: { status: 'resolved' } }, 'resolved', true, /Resolved/],
  ['supersession is not completion', { resolution: { status: 'superseded' } }, 'resolved', true, /Replaced/],
  ['stale completion stays actionable', { ...approved, handoff: { status: 'completed' }, stale: true }, 'awaiting', false, /fresh look/],
  // Open blocker must NOT pin a confirmed card in Needs-you.
  ['confirm clears card even with open blocker', { ...approved, handoff: { status: 'handoff_pending' }, ownerBlocker: { status: 'waiting_for_owner' } }, 'working', true, /Confirmed · team following up/],
  ['deferred leaves Needs-you', { response: { action: 'defer' } }, 'paused', true, /Deferred/],
  ['rejection leaves Needs-you', { response: { action: 'reject' }, handoff: { status: 'not_applicable' } }, 'paused', true, /Rejected/],
  ['rejected but checker running remains visible', { response: { action: 'reject' }, handoff: { status: 'not_applicable' }, handoffCheck: { status: 'running' } }, 'working', false, /follow-through open/],
  ['rejected cancelled blocker archives', { response: { action: 'reject' }, handoff: { status: 'not_applicable' }, ownerBlocker: { status: 'cancelled' } }, 'paused', true, /Rejected/],
  ['discussion remains visible', { response: { action: 'discuss' } }, 'working', false, /not approved/],
  ['unanswered blocker still needs CEO', { ownerBlocker: { status: 'waiting_for_owner' } }, 'awaiting', false, /your action/],
];
for (const [name, data, tone, archive, label] of cases) test(name, () => {
  const result = present(data);
  assert.equal(result.tone, tone, name);
  assert.equal(result.archive, archive, name);
  assert.match(result.label, label, name);
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
