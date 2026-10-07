#!/usr/bin/env node
// Read-only production verification using the existing documented login rail.
// Credentials/cookies stay in memory; never print notes or mutate decisions.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../server.mjs';
import { DECISION_RESOLUTIONS } from '../lib/providers/decision-resolutions.mjs';
const { cfg, problems } = loadConfig();
assert.equal(problems.length, 0);
const base = process.env.ASSISTANT_VERIFY_URL || `http://${cfg.host}:${cfg.port}`;
const digest = () => createHash('sha256').update(readFileSync(cfg.decisionsFile)).digest('hex');
const before = digest();
const request = (route, options = {}) => fetch(base + route, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
let cookie;
try {
  assert.equal((await request('/api/decisions')).status, 401);
  const login = await request('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: cfg.password }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  const res = await request('/api/decisions', { headers: { cookie } });
  assert.equal(res.status, 200);
  const snapshot = await res.json();
  const active = snapshot.decisions.map(d => d.id);
  const history = snapshot.history.map(d => d.id);
  for (const id of Object.keys(DECISION_RESOLUTIONS)) {
    assert.ok(!active.includes(id), `retired ask active: ${id}`);
    assert.ok(history.includes(id), `missing history: ${id}`);
  }
  assert.ok(active.includes('brewdesk-first-carousel-72'), 'publication approval preserved');
  assert.ok(active.includes('auth-atomic-docker-access-85'), 'unverified Docker blocker preserved');
  assert.ok(active.includes('backlog-triage-view-77'), 'backlog follow-through preserved');
  assert.equal(digest(), before, 'decision responses must not be rewritten');
  const ui = await (await request('/app.js')).text();
  assert.ok(ui.includes('History (${data.history.length})'), 'deployed history UI');
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base, unauthorized: 401, authorized: 200, generatedAt: snapshot.generatedAt, active, history, responsesUnchanged: true, responseStoreSha256: before, historyUiServed: true }, null, 2));
} finally {
  if (cookie) await request('/api/logout', { method: 'POST', headers: { cookie } });
}
