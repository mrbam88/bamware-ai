// CEO interaction contract for Command Center (bamware-ai#141 / Confirm-stuck).
// Guards the failure mode: choice looks Confirm-able but option.action is discuss,
// so the card never leaves Needs-you.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_CANDIDATES } from '../lib/providers/decision-candidates.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(root, '../public/app.js'), 'utf8');

/** Labels that mean "I decided" — must authorize approve/reject/defer, not discuss. */
const DECISIONISH = /recheck|signed in|choose|yes\b|publish|build it|not now|skip|defer|reject|review later/i;
/** Labels that are intentionally chat-only. */
const CHAT_ONLY = /discuss|need help|help signing|changes first|talk/i;

test('Confirm archives terminal responses out of Needs-you', () => {
  assert.match(appJs, /Confirm\/Reject\/Defer leave the Needs-you deck/);
  assert.match(appJs, /Confirmed · team following up/);
  assert.match(appJs, /card left Needs you/);
  assert.match(appJs, /!d\.response \|\| d\.stale\)/);
  assert.doesNotMatch(
    appJs,
    /!d\.response \|\| d\.stale \|\| d\.ownerBlocker/,
    'open owner blocker must not keep Confirm controls after a response',
  );
});

test('choice options are not silent discuss traps', () => {
  for (const c of DECISION_CANDIDATES) {
    for (const o of c.options || []) {
      const label = o.label || '';
      if (CHAT_ONLY.test(label)) {
        assert.equal(
          o.action,
          'discuss',
          `${c.id}/${o.id} chat-only label should stay discuss`,
        );
        continue;
      }
      if (DECISIONISH.test(label) || !o.action) {
        assert.notEqual(
          o.action,
          'discuss',
          `${c.id}/${o.id} "${label}" looks like a decision but action=discuss (Confirm-stuck trap)`,
        );
      }
    }
  }
});

test('Confirm commit path exists and discuss is chat-labeled', () => {
  assert.match(appJs, /commitActionFor/);
  assert.match(appJs, /Send to chat/);
});
