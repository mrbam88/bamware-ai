#!/usr/bin/env node
// Auth + sanitized quota readback, zero npm dependencies and no model calls.
// The owner password and session cookie stay in memory and are never logged.
// --local tests this checkout on loopback. Default tests configured production.
import assert from 'node:assert/strict';
import { loadConfig, createServer } from '../server.mjs';

const { cfg, problems } = loadConfig();
if (problems.length) throw new Error('Valid existing assistant-web config is required.');
let server;
let base = `http://${cfg.host}:${cfg.port}`;
if (process.argv.includes('--local')) {
  server = createServer(cfg, { log() {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
const get = (url, options = {}) => fetch(base + url, { ...options, signal: AbortSignal.timeout(10000) });
try {
  assert.equal((await get('/api/health')).status, 200);
  assert.equal((await get('/api/rate-limits')).status, 401);
  assert.equal((await get('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'deliberately-wrong-password' }) })).status, 401);
  const auth = await get('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: cfg.password }) });
  assert.equal(auth.status, 200);
  assert.match(auth.headers.get('set-cookie'), /HttpOnly/);
  assert.match(auth.headers.get('set-cookie'), /SameSite=Strict/);
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const response = await get('/api/rate-limits', { headers: { cookie } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.mode, 'live');
  assert.ok(data.coverage.some(c => c.harness === 'hermes'));
  assert.ok(data.coverage.some(c => c.harness === 'opencode'));
  assert.ok(data.windows.some(w => w.provider === 'openai-codex' && w.observations.length === 2));
  const keys = data.windows.filter(w => w.account && w.identityEvidence).map(w => `${w.provider}:${w.account}:${w.scope}`);
  assert.equal(new Set(keys).size, keys.length, 'No duplicate known account/scope meters');
  assert.ok(data.windows.every(w => w.source.kind !== 'synthetic'));
  assert.match(await (await get('/app.js')).text(), /renderQuotaMeter/);
  assert.match(await (await get('/quota-meter.js')).text(), /aria-valuenow/);
  assert.match(await (await get('/')).text(), /type="module"/);
  const demo = await (await get('/api/rate-limits?mode=demo', { headers: { cookie } })).json();
  assert.ok(demo.windows.every(w => w.source.kind === 'synthetic'));
  console.log(JSON.stringify({ health: 200, auth: '401 unauthenticated / 401 wrong password / 200 authenticated',
    windows: data.windows.length,
    serverCoverage: data.coverage.map(c => ({ harness: c.harness, provider: c.provider, status: c.status })),
    sharedWindows: data.windows.filter(w => w.observations.length > 1).length,
    sources: data.windows.map(w => ({ provider: w.provider, scope: w.scope, state: w.state })),
    meterAssets: 'PASS', demoIsolation: 'PASS' }));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
}
