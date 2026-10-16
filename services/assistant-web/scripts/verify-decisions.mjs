#!/usr/bin/env node
// Read-only production verification using the existing documented login rail.
// Credentials/cookies stay in memory; never print notes or mutate decisions.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadConfig } from '../server.mjs';
import { DECISION_RESOLUTIONS } from '../lib/providers/decision-resolutions.mjs';
import { checkAssetIdentity } from './lib/asset-identity.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, '..', 'public');
const { cfg, problems } = loadConfig();
assert.equal(problems.length, 0);
const base = process.env.ASSISTANT_VERIFY_URL || `http://${cfg.host}:${cfg.port}`;
const baseUrl = new URL(base);
// HTTPS preferred. HTTP allowed on loopback or the process-configured bind host
// (private Tailscale IP on omarchy) so deploy proof can hit the live service.
const httpAllowed = baseUrl.protocol === 'http:' && (
  ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)
  || baseUrl.hostname === cfg.host
);
assert.ok(baseUrl.protocol === 'https:' || httpAllowed, 'Verification requires HTTPS except on loopback or the configured bind host');
assert.ok(!baseUrl.username && !baseUrl.password && !baseUrl.search && !baseUrl.hash && baseUrl.pathname === '/', 'Verification URL must be a bare origin');
const digest = () => {
  try { return createHash('sha256').update(readFileSync(cfg.decisionsFile)).digest('hex'); }
  catch (error) { if (error.code === 'ENOENT') return 'missing-store'; throw error; }
};
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
  assert.ok(active.includes('auth-atomic-docker-access-85') || snapshot.history.some(d => d.id === 'auth-atomic-docker-access-85' && d.resolution?.evidence?.ref), 'Docker blocker preserved or retired with evidence');
  assert.ok(active.includes('backlog-triage-view-77'), 'backlog follow-through preserved');
  assert.equal(digest(), before, 'decision responses must not be rewritten');
  // Byte-identity against this checkout proves the deployed source matches;
  // it does not prove a browser fetched, parsed or rendered it correctly.
  const assets = await Promise.all([
    ['/app.js', 'app.js'],
    ['/app.css', 'app.css'],
  ].map(async ([route, file]) => {
    const response = await request(route);
    const body = Buffer.from(await response.arrayBuffer());
    const expected = readFileSync(path.join(PUBLIC_DIR, file));
    return checkAssetIdentity({ label: file, status: response.status, body, expected });
  }));
  for (const asset of assets) assert.ok(asset.ok, `deployed ${asset.label} does not match checkout: ${asset.reason}`);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base, unauthorized: 401, authorized: 200, generatedAt: snapshot.generatedAt, active, history, responsesUnchanged: true, responseStoreSha256: before, assets: assets.map(({ label, ok, status, sha256, bytes }) => ({ label, ok, status, sha256, bytes })) }, null, 2));
} finally {
  if (cookie) await request('/api/logout', { method: 'POST', headers: { cookie } });
}
