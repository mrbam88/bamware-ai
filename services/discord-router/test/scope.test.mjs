import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeFor } from '../src/scope.mjs';
import { buildPrompt } from '../src/handoff.mjs';

const ids = { home: 'H', interviews: 'I' };
const text = (id) => ({ id, parentId: null, isThread: () => false });
const thread = (id, parentId) => ({ id, parentId, isThread: () => true });

test('home channel and its threads are the Chief of Staff seat', () => {
  assert.deepEqual(scopeFor(text('H'), ids), { channelId: 'H', threadId: null, kind: 'home' });
  assert.deepEqual(scopeFor(thread('T1', 'H'), ids), { channelId: 'H', threadId: 'T1', kind: 'home' });
});

test('#interviews and its threads are the Interview Coach', () => {
  assert.deepEqual(scopeFor(text('I'), ids), { channelId: 'I', threadId: null, kind: 'interviews' });
  assert.deepEqual(scopeFor(thread('T2', 'I'), ids), { channelId: 'I', threadId: 'T2', kind: 'interviews' });
});

test('other channels are ignored; interviews is optional', () => {
  assert.equal(scopeFor(text('X'), ids), null);
  assert.equal(scopeFor(thread('T3', 'X'), ids), null);
  assert.equal(scopeFor(text('I'), { home: 'H' }), null);
});

test('the coach hat is in the prompt only for #interviews', () => {
  const coach = buildPrompt({ note: '', ask: 'quiz me on Swift concurrency', kind: 'interviews' });
  assert.match(coach, /INTERVIEW COACH/);
  assert.match(coach, /ONE question at a time/);
  assert.match(coach, /~\/code\/interviews/);
  assert.doesNotMatch(buildPrompt({ note: '', ask: 'quiz me', kind: 'home' }), /INTERVIEW COACH/);
  assert.doesNotMatch(buildPrompt({ note: '', ask: 'quiz me' }), /INTERVIEW COACH/);
});
