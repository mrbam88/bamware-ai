import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Seat } from '../src/seat.mjs';
import { sessionKey, etDay, buildPrompt, roleIn, Notes, lastEntry } from '../src/handoff.mjs';
import { parseDispatch, manifestFor, boardItemFor, claimCommands } from '../src/dispatch.mjs';
import { chunks } from '../src/reply.mjs';
import * as codex from '../src/runners/codex.mjs';
import * as claude from '../src/runners/claude.mjs';

const NOW = 1_760_000_000;

function fixture({ claudeUsed = 96, codexUsed = 30, halt = null } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'seat-'));
  const cfo = path.join(dir, 'cfo');
  mkdirSync(cfo);
  writeFileSync(path.join(cfo, 'capacity.json'), JSON.stringify({
    generated_at: NOW,
    pools: [
      { key: 'claude-max:weekly', label: 'Claude Max weekly', used_pct: claudeUsed, stale: false, reset_at: NOW + 86400 },
      { key: 'openai-codex:a:weekly-10080min', label: 'Codex weekly', used_pct: codexUsed, stale: false, reset_at: NOW + 172800 },
    ],
  }));
  if (halt) writeFileSync(path.join(cfo, 'halt.json'), JSON.stringify(halt));
  writeFileSync(path.join(dir, 'model-routing.yaml'), [
    'runners:', '  floor_pct: 10', '  cooldown_min: 60', '  order:',
    '    - {name: claude, pools: ["claude"]}', '    - {name: codex, pools: ["openai-codex"]}', '    - {name: opencode, pools: ["copilot"]}', '',
  ].join('\n'));
  const paths = {
    repo: dir, routing: path.join(dir, 'model-routing.yaml'), capacity: path.join(cfo, 'capacity.json'),
    halt: path.join(cfo, 'halt.json'), state: path.join(dir, 'router'), board: path.join(dir, 'board.json'), overnight: path.join(dir, 'overnight'),
  };
  return { dir, paths };
}

/** A fake CLI: records argv, returns canned output per command name. */
function fakeRun(script) {
  const calls = [];
  const fn = async (argv) => { calls.push(argv); return script(argv, calls.length); };
  fn.calls = calls;
  return fn;
}

test('session key: thread is its own session, channel rolls per ET day at 04:00', () => {
  assert.equal(sessionKey({ channelId: 'C', threadId: 'T' }), 'thread-T');
  const oneAm = Date.UTC(2026, 9, 21, 5, 30); // 01:30 ET on Oct 21 → still Oct 20's session
  assert.equal(etDay(oneAm), '2026-10-20');
  const fiveAm = Date.UTC(2026, 9, 21, 9, 30); // 05:30 ET Oct 21
  assert.equal(etDay(fiveAm), '2026-10-21');
  assert.equal(sessionKey({ channelId: 'C', threadId: null, epochMs: fiveAm }), 'channel-C-2026-10-21');
});

test('lastEntry reads the newest note block', () => {
  const note = '## 2026-10-20T23:00:00.000Z · claude\nask: status?\nanswer: all good\n\n## 2026-10-20T23:05:00.000Z · codex\nask: newest PR?\nanswer: #181 fix(cc)\n\n';
  assert.deepEqual(lastEntry(note), { runner: 'codex', answer: '#181 fix(cc)' });
  assert.equal(lastEntry(''), null);
});

test('roles are named in the message, not configured', () => {
  assert.equal(roleIn('Scrum Master, what is stuck?'), 'Scrum Master');
  assert.equal(roleIn('cfo: status'), 'CFO');
  assert.equal(roleIn('what is stuck?'), null);
  assert.match(buildPrompt({ note: '', ask: 'hi', role: 'CFO' }), /Wear the CFO role/);
});

test('codex turn, then a forced claude turn sees the codex answer via the thread note', async () => {
  const { paths } = fixture();
  const run = fakeRun((argv) => {
    if (argv[0] === 'codex') return { code: 0, output: '{"type":"thread.started","thread_id":"abc-123"}\n{"type":"item.completed","item":{"type":"agent_message","text":"Two PRs open, one stale."}}\n' };
    if (argv[0] === 'claude') return { code: 0, output: 'Earlier codex said two PRs open.' };
    throw new Error(`unexpected ${argv[0]}`);
  });
  const seat = new Seat({ paths, runFn: run, now: () => NOW, log: () => {} });
  const msg = { text: 'status?', channelId: 'C', threadId: 'T1', authorId: 'U' };
  const r1 = await seat.handle(msg);
  assert.equal(r1.runner, 'codex');
  assert.equal(r1.text, 'Two PRs open, one stale.');
  assert.match(r1.footer, /Quota left: claude 4% · \*\*codex\*\* 70% · opencode \?%/);
  const r2 = await seat.handle({ ...msg, text: '!claude what did you just say?' });
  assert.equal(r2.runner, 'claude');
  const claudeArgv = run.calls.find((a) => a[0] === 'claude');
  const prompt = claudeArgv[claudeArgv.length - 1];
  assert.match(prompt, /Thread note/);
  assert.match(prompt, /Two PRs open, one stale\./);
  assert.match(prompt, /LAST TURN of the seat \(by codex\): Two PRs open, one stale\./);
  assert.match(prompt, /ONE voice/);
  assert.ok(claudeArgv.includes('--dangerously-skip-permissions'));
  assert.ok(claudeArgv.includes('--session-id'));
  // codex session id persisted for the next codex turn
  const meta = new Notes(paths.state).meta('thread-T1');
  assert.equal(meta.codex.sessionId, 'abc-123');
  const r3 = await seat.handle({ ...msg, text: '!codex and now?' });
  assert.equal(r3.runner, 'codex');
  const resumeArgv = run.calls[run.calls.length - 1];
  assert.deepEqual(resumeArgv.slice(0, 3), ['codex', 'exec', 'resume']);
  assert.ok(resumeArgv.includes('abc-123'));
  assert.ok(!resumeArgv.includes('-C'), 'codex exec resume rejects -C');
});

test('a rate-limited runner is cooled down and the next one answers', async () => {
  const { paths } = fixture({ claudeUsed: 20 }); // claude would be first
  const run = fakeRun((argv) => {
    if (argv[0] === 'claude') return { code: 1, output: 'Error: usage limit reached. Resets at 7pm.' };
    if (argv[0] === 'codex') return { code: 0, output: 'codex here' };
    throw new Error(`unexpected ${argv[0]}`);
  });
  const seat = new Seat({ paths, runFn: run, now: () => NOW, log: () => {} });
  const r = await seat.handle({ text: 'hi', channelId: 'C', threadId: null, authorId: 'U', epochMs: NOW * 1000 });
  assert.equal(r.runner, 'codex');
  assert.equal(r.text, 'codex here');
  const state = JSON.parse(readFileSync(path.join(paths.state, 'router-state.json'), 'utf8'));
  assert.equal(state.cooldowns.claude, NOW + 3600);
});

test('CFO halt: nothing is spawned, the reply says why', async () => {
  const { paths } = fixture({ halt: { halted: true, reason: 'OpenAI weekly 97%' } });
  const run = fakeRun(() => { throw new Error('must not spawn'); });
  const seat = new Seat({ paths, runFn: run, now: () => NOW, log: () => {} });
  const r = await seat.handle({ text: 'status?', channelId: 'C', threadId: null, authorId: 'U', epochMs: NOW * 1000 });
  assert.equal(r.runner, null);
  assert.match(r.text, /CFO halt: OpenAI weekly 97%/);
  assert.equal(run.calls.length, 0);
  const d = await seat.handle({ text: 'do #196', channelId: 'C', threadId: null, authorId: 'U', epochMs: NOW * 1000 });
  assert.match(d.text, /Not dispatching mrbam88\/bamware-ai#196/);
});

test('dispatch: claim + manifest + executor start, nothing executed in-process', async () => {
  const { paths } = fixture();
  writeFileSync(paths.board, JSON.stringify({ items: [{ id: 'PVTI_x', content: { number: 196, url: 'https://github.com/mrbam88/bamware-ai/issues/196' } }] }));
  const run = fakeRun((argv) => ({ code: 0, output: argv[0] === 'python3' ? 'launched run 2026-10-20T20-00' : '' }));
  const seat = new Seat({ paths, runFn: run, now: () => NOW, log: () => {} });
  const r = await seat.handle({ text: 'do ticket #196', channelId: 'C', threadId: 'T9', authorId: 'U' });
  assert.equal(r.runner, 'executor');
  assert.equal(run.calls.length, 3);
  assert.deepEqual(run.calls[0].slice(0, 3), ['gh', 'issue', 'comment']);
  assert.deepEqual(run.calls[1].slice(0, 3), ['gh', 'project', 'item-edit']);
  assert.ok(run.calls[1].includes('PVTI_x'));
  assert.equal(run.calls[2][0], 'python3');
  assert.equal(run.calls[2][2], 'start');
  assert.match(r.text, /Dispatched mrbam88\/bamware-ai#196/);
  assert.ok(run.calls.every((a) => !['claude', 'codex', 'opencode'].includes(a[0])));
});

test('dispatch parsing and manifest shape', () => {
  assert.deepEqual(parseDispatch('do #12'), { ticket: 'mrbam88/bamware-ai#12', repo: 'mrbam88/bamware-ai', number: 12 });
  assert.deepEqual(parseDispatch('run ticket mrbam88/bamware-venue-engine#151 please'), { ticket: 'mrbam88/bamware-venue-engine#151', repo: 'mrbam88/bamware-venue-engine', number: 151 });
  assert.equal(parseDispatch('what does #12 do?'), null);
  const m = manifestFor({ ticket: 'mrbam88/bamware-ai#12', requestedBy: 'U', at: new Date(0) });
  assert.equal(m.schema, 1);
  assert.deepEqual(m.unresolved_decisions, []);
  assert.deepEqual(m.tasks, [{ ticket: 'mrbam88/bamware-ai#12' }]);
  assert.equal(boardItemFor('/nonexistent/latest.json', 'mrbam88/bamware-ai', 12), null);
  assert.equal(claimCommands({ repo: 'r/r', number: 1, itemId: null, project: null }).length, 1);
});

test('login sweep marks dead runners from each CLI auth check', async () => {
  const { paths } = fixture();
  const run = fakeRun((argv) => {
    if (argv[0] === 'claude') return { code: 0, output: '{\n  "loggedIn": false,\n  "authMethod": "none"\n}' };
    if (argv[0] === 'codex') return { code: 1, output: 'Not logged in' };
    if (argv[0] === 'opencode') return { code: 127, output: 'spawn opencode ENOENT' };
    return { code: 0, output: '' };
  });
  const seat = new Seat({ paths, runFn: run, now: () => NOW, log: () => {} });
  const { dead, changed } = await seat.checkLogins();
  assert.deepEqual(dead, { claude: 'logged out', codex: 'logged out', opencode: 'not installed' });
  assert.equal(changed, true);
  const r = await seat.handle({ text: '!codex hi', channelId: 'C', threadId: null, authorId: 'U', epochMs: NOW * 1000 });
  assert.match(r.text, /codex is logged out/);
});

test('reply chunking respects the Discord limit and prefers line breaks', () => {
  const text = Array.from({ length: 60 }, (_, i) => `line ${i} ${'x'.repeat(50)}`).join('\n');
  const parts = chunks(text, 1900);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((p) => p.length <= 1900));
  assert.equal(parts.join('\n'), text);
  assert.deepEqual(chunks('', 10), ['(empty)']);
});

test('runner adapters: session ids and answers are parsed from JSON streams', () => {
  assert.equal(codex.sessionFrom('noise\n{"type":"thread.started","thread_id":"t-1"}'), 't-1');
  assert.equal(codex.answerFrom('{"type":"item.completed","item":{"type":"agent_message","text":"final"}}'), 'final');
  assert.equal(codex.answerFrom('plain text'), 'plain text');
  const { argv, meta } = claude.command({ prompt: 'p', meta: {} });
  assert.equal(argv[0], 'claude');
  assert.ok(meta.sessionId);
  const again = claude.command({ prompt: 'p', meta });
  assert.ok(again.argv.includes('--resume'));
});
