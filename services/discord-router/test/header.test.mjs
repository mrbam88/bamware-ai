import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { displayModel, header } from '../src/header.mjs';
import { isStandup, buildPrompt, STANDUP_ROLES } from '../src/handoff.mjs';
import { agentFor } from '../src/seat.mjs';
import { deliver } from '../src/reply.mjs';
import * as claude from '../src/runners/claude.mjs';
import * as codex from '../src/runners/codex.mjs';
import * as opencode from '../src/runners/opencode.mjs';

test('model ids become the names Bilal uses', () => {
  assert.equal(displayModel('claude-fable-5-1[1m]'), 'Fable 5.1');
  assert.equal(displayModel('claude-opus-5'), 'Opus 5');
  assert.equal(displayModel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  assert.equal(displayModel('gpt-6-astra'), 'GPT-6 Astra');
  assert.equal(displayModel('github-copilot/gpt-5'), 'GPT-5');
  assert.equal(displayModel(null), 'unknown');
});

test('header: Runner / Model / Agent, every reply', () => {
  assert.equal(header({ runner: 'claude', model: 'claude-fable-5-1', agent: 'Chief of Staff' }), 'Runner: Claude  Model: Fable 5.1  Agent: Chief of Staff');
  assert.equal(header({ runner: 'codex', model: null, agent: null }), 'Runner: Codex  Model: unknown  Agent: NA');
  assert.equal(header({ runner: null }), 'Runner: Seat  Model: none  Agent: NA');
  assert.equal(agentFor('Scrum Master, what is stuck?'), 'Scrum Master');
  assert.equal(agentFor('hi'), 'NA');
  assert.equal(agentFor('status update'), 'Standup: Scrum Master | Engineering Lead | CFO | Chief of Staff | Accountant');
});

test('"status update" is a standup: round robin, yesterday / today / blockers, 100-word rule lifted', () => {
  for (const t of ['status update', 'Status Update?', 'status?', 'standup', 'stand-up!', 'daily']) assert.ok(isStandup(t), t);
  for (const t of ['status of #181', 'what is the status', 'Scrum Master, status update']) assert.ok(!isStandup(t), t);
  const p = buildPrompt({ note: '', ask: 'status update', standup: true });
  assert.match(p, /STANDUP: a round robin/);
  assert.match(p, /"Yesterday:", "Today:", "Blockers:"/);
  assert.match(p, /100-word rule is lifted/);
  for (const r of STANDUP_ROLES) assert.match(p, new RegExp(`${r.role} \\(~/.local/state/bamware/${r.slug}/\\)`));
  assert.doesNotMatch(buildPrompt({ note: '', ask: 'hi' }), /STANDUP/);
});

test('claude JSON output: answer from .result, model from modelUsage (haiku is a helper)', () => {
  const out = JSON.stringify({ type: 'result', subtype: 'success', result: 'ok, two PRs', modelUsage: { 'claude-haiku-4-5-20251001': { outputTokens: 900 }, 'claude-fable-5-1': { outputTokens: 120 } } });
  assert.equal(claude.answerFrom(out), 'ok, two PRs');
  assert.equal(claude.modelFrom(out), 'claude-fable-5-1');
  assert.equal(claude.answerFrom('Not logged in. Please run claude login.'), 'Not logged in. Please run claude login.');
  assert.equal(claude.modelFrom('plain text'), null);
  assert.ok(claude.command({ prompt: 'x', meta: {} }).argv.includes('json'));
});

test('codex model: event stream, else the rollout log of that thread, else config.toml', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'codex-home-'));
  const env = { CODEX_HOME: home };
  const day = path.join(home, 'sessions', '2026', '10', '20');
  mkdirSync(day, { recursive: true });
  writeFileSync(path.join(day, 'rollout-2026-10-20T19-40-55-abc-123.jsonl'), '{"type":"session_meta","payload":{"id":"abc-123"}}\n{"type":"turn_context","payload":{"model":"gpt-6-astra"}}\n');
  const stream = '{"type":"thread.started","thread_id":"abc-123"}\n';
  assert.equal(codex.modelFrom(stream, { env }), 'gpt-6-astra');
  assert.equal(codex.modelFrom('{"type":"turn.started","model":"gpt-5-codex"}\n', { env }), 'gpt-5-codex');
  writeFileSync(path.join(home, 'config.toml'), 'model = "o3"\n');
  assert.equal(codex.modelFrom('{"type":"thread.started","thread_id":"nope"}\n', { env }), 'o3');
  assert.equal(codex.modelFrom('', { env: { CODEX_HOME: path.join(home, 'missing') } }), null);
});

test('opencode model: providerID/modelID from events, else the pinned env model', () => {
  assert.equal(opencode.modelFrom('{"type":"step_start","part":{"type":"step-start","providerID":"github-copilot","modelID":"gpt-5"}}\n'), 'github-copilot/gpt-5');
  assert.equal(opencode.modelFrom('', { env: { BAMWARE_OPENCODE_MODEL: 'github-copilot/gpt-5' } }), 'github-copilot/gpt-5');
  assert.equal(opencode.modelFrom('', { env: {} }), null);
});

test('deliver: header is the first line, footer the last', async () => {
  const sent = [];
  const channel = { send: async (m) => { sent.push(m); } };
  await deliver(channel, 'the answer', 'claude 90%', null, 'Runner: Claude  Model: Fable 5.1  Agent: NA');
  assert.deepEqual(sent.map((m) => m.content), ['Runner: Claude  Model: Fable 5.1  Agent: NA\nthe answer', '_claude 90%_']);
  sent.length = 0;
  await deliver(channel, 'x'.repeat(5000), 'f', (b) => ({ body: b }), 'H');
  assert.equal(sent[0].content, 'H\n_f_');
  assert.ok(sent[0].files);
});

test('seat.handle returns the header with the real runner and its reported model', async () => {
  const { Seat } = await import('../src/seat.mjs');
  const dir = mkdtempSync(path.join(tmpdir(), 'seat-h-'));
  const cfo = path.join(dir, 'cfo');
  mkdirSync(cfo);
  writeFileSync(path.join(cfo, 'capacity.json'), JSON.stringify({ generated_at: 1, pools: [{ key: 'claude-max:weekly', used_pct: 10, stale: false }] }));
  writeFileSync(path.join(dir, 'routing.yaml'), 'runners:\n  order:\n    - {name: claude, pools: ["claude"]}\n');
  const paths = { repo: dir, routing: path.join(dir, 'routing.yaml'), capacity: path.join(cfo, 'capacity.json'), halt: path.join(cfo, 'halt.json'), state: path.join(dir, 'router'), board: path.join(dir, 'b.json'), overnight: dir };
  const out = JSON.stringify({ type: 'result', result: 'Standup text', modelUsage: { 'claude-fable-5-1': { outputTokens: 10 } } });
  const seat = new Seat({ paths, env: { HOME: dir }, runFn: async () => ({ code: 0, output: out }), now: () => 1, log: () => {} });
  const r = await seat.handle({ text: 'status update', channelId: 'C', threadId: 'T', authorId: 'U' });
  assert.equal(r.header, 'Runner: Claude  Model: Fable 5.1  Agent: Standup: Scrum Master | Engineering Lead | CFO | Chief of Staff | Accountant');
  assert.equal(r.text, 'Standup text');
  const r2 = await seat.handle({ text: 'CFO, how much is left?', channelId: 'C', threadId: 'T', authorId: 'U' });
  assert.equal(r2.header, 'Runner: Claude  Model: Fable 5.1  Agent: CFO');
});

test('waitNotice: nothing before the first delay, then a notice that updates and is removed on stop', async () => {
  const { waitNotice } = await import('../src/reply.mjs');
  const events = [];
  const w = waitNotice({
    post: async (t) => events.push(['post', t]),
    edit: async (t) => events.push(['edit', t]),
    remove: async () => events.push(['remove']),
    firstAfterMs: 20, everyMs: 15,
  });
  w.setWhat('Claude is working on it');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(events.length, 0);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(events[0][0], 'post');
  assert.match(events[0][1], /^Claude is working on it \(\d+s so far\)\. Keep going/);
  assert.ok(events.some((e) => e[0] === 'edit'));
  await w.stop();
  assert.equal(events[events.length - 1][0], 'remove');
  const quick = waitNotice({ post: async () => events.push(['late']), edit: async () => {}, remove: async () => events.push(['remove2']), firstAfterMs: 20 });
  await quick.stop();
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(!events.some((e) => e[0] === 'late' || e[0] === 'remove2'));
});
