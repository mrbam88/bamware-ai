import test from 'node:test';
import assert from 'node:assert/strict';
import { pick, parseForce, looksRateLimited, coolDown } from '../src/router.mjs';
import { headroom, footer } from '../src/headroom.mjs';
import { DEFAULTS } from '../src/config.mjs';

const runners = { ...DEFAULTS, floor_pct: 10, cooldown_min: 60 };
const NOW = 1_760_000_000;

function cap(claudeUsed, codexUsed, extra = {}) {
  return {
    generated_at: NOW,
    pools: [
      { key: 'claude-max:weekly', label: 'Claude Max weekly', used_pct: claudeUsed, stale: false, reset_at: NOW + 3600 * 24 },
      { key: 'claude-max:5h', label: 'Claude Max 5-hour', used_pct: Math.max(0, claudeUsed - 30), stale: false, reset_at: NOW + 3600 },
      { key: 'openai-codex:acct:weekly-10080min', label: 'Codex weekly', used_pct: codexUsed, stale: false, reset_at: NOW + 3600 * 48 },
      ...(extra.pools || []),
    ],
  };
}

test('headroom is the tightest fresh window', () => {
  const h = headroom(runners.order[0], cap(96, 30));
  assert.equal(h.pct, 4);
  assert.equal(h.unknown, false);
  assert.equal(h.reset_at, NOW + 3600 * 24);
});

test('headroom is unknown when no pool matches or all are stale', () => {
  assert.equal(headroom(runners.order[2], cap(0, 0)).unknown, true);
  const stale = { pools: [{ key: 'copilot:premium', used_pct: 10, stale: true }] };
  const h = headroom(runners.order[2], stale);
  assert.equal(h.unknown, true);
  assert.equal(h.stale, true);
});

test('Claude 4%, Codex 70% → codex', () => {
  const c = pick({ runners, capacity: cap(96, 30), halt: null, forced: null, state: {}, now: NOW });
  assert.deepEqual(c, { kind: 'run', runner: 'codex', reason: 'headroom 70%' });
});

test('!claude prefix forces claude even under the floor', () => {
  const { forced, text } = parseForce('!claude status?', runners);
  assert.equal(forced, 'claude');
  assert.equal(text, 'status?');
  const c = pick({ runners, capacity: cap(96, 30), halt: null, forced, state: {}, now: NOW });
  assert.equal(c.runner, 'claude');
  assert.equal(c.reason, 'forced');
});

test('force prefix tolerates Discord symbol rewrites', () => {
  assert.equal(parseForce('❯ claude status?', runners).forced, 'claude');
  assert.equal(parseForce('> codex hi', runners).forced, 'codex');
  assert.equal(parseForce('@opencode hi', runners).text, 'hi');
});

test('unknown prefix is left in the text', () => {
  const r = parseForce('!gemini hi', runners);
  assert.equal(r.forced, null);
  assert.equal(r.text, '!gemini hi');
});

test('CFO halt stops everything, even a forced runner', () => {
  const c = pick({ runners, capacity: cap(0, 0), halt: { halted: true, reason: 'weekly burn 95%' }, forced: 'claude', state: {}, now: NOW });
  assert.equal(c.kind, 'halt');
  assert.match(c.reason, /weekly burn/);
});

test('a dead login is skipped; forcing a dead runner says so', () => {
  const state = { dead: { claude: 'logged out' } };
  const c = pick({ runners, capacity: cap(0, 0), halt: null, forced: null, state, now: NOW });
  assert.equal(c.runner, 'codex');
  const f = pick({ runners, capacity: cap(0, 0), halt: null, forced: 'claude', state, now: NOW });
  assert.equal(f.kind, 'dead');
});

test('a cooling-down runner is skipped until its cooldown passes', () => {
  let state = coolDown({}, 'claude', runners, NOW);
  assert.equal(state.cooldowns.claude, NOW + 3600);
  assert.equal(pick({ runners, capacity: cap(0, 0), halt: null, forced: null, state, now: NOW }).runner, 'codex');
  assert.equal(pick({ runners, capacity: cap(0, 0), halt: null, forced: null, state, now: NOW + 3601 }).runner, 'claude');
});

test('unknown-headroom runners come after every known one, then queue', () => {
  const c = pick({ runners, capacity: cap(96, 95), halt: null, forced: null, state: {}, now: NOW });
  assert.equal(c.runner, 'opencode');
  assert.equal(c.reason, 'unknown headroom');
  const q = pick({ runners, capacity: cap(96, 95), halt: null, forced: null, state: { dead: { opencode: 'not installed' } }, now: NOW });
  assert.equal(q.kind, 'queued');
  assert.equal(q.reset_at, NOW + 3600 * 24); // claude weekly resets first
});

test('no capacity file at all → first runner is tried (unknown headroom)', () => {
  const c = pick({ runners, capacity: null, halt: null, forced: null, state: {}, now: NOW });
  assert.equal(c.runner, 'claude');
});

test('rate-limit detection needs the words and a failure signal', () => {
  assert.equal(looksRateLimited('Error: rate limit reached, try again later', 1), true);
  assert.equal(looksRateLimited('You have reached your usage limit for this week', 0), true);
  assert.equal(looksRateLimited('Here is how rate limiting works in Express...', 0), false);
  assert.equal(looksRateLimited('', 1), false);
});

test('footer names every runner and bolds the chosen one', () => {
  const f = footer(runners, cap(96, 30), 'codex');
  assert.equal(f, 'claude 4% · **codex** 70% · opencode ?%');
});
