// Fixtures only; no network. Exercises the pure asset-identity helper used
// by scripts/verify-decisions.mjs to prove deployed bytes match this checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkAssetIdentity, sha256Hex } from '../scripts/lib/asset-identity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const expectedAppJs = readFileSync(path.join(HERE, '..', 'public', 'app.js'));
const expectedAppCss = readFileSync(path.join(HERE, '..', 'public', 'app.css'));

test('real current app.js bytes over an HTTP200 response pass identity', () => {
  const result = checkAssetIdentity({ label: 'app.js', status: 200, body: expectedAppJs, expected: expectedAppJs });
  assert.equal(result.ok, true);
  assert.equal(result.sha256, sha256Hex(expectedAppJs));
  assert.equal(result.bytes, expectedAppJs.length);
});

test('real current app.css bytes over an HTTP200 response pass identity', () => {
  const result = checkAssetIdentity({ label: 'app.css', status: 200, body: expectedAppCss, expected: expectedAppCss });
  assert.equal(result.ok, true);
});

test('stale app.js bytes (old source text) fail identity even at HTTP200', () => {
  const stale = Buffer.from(expectedAppJs.toString('utf8').replace('History (${archived.length})', 'History (${data.history.length})'));
  const result = checkAssetIdentity({ label: 'app.js', status: 200, body: stale, expected: expectedAppJs });
  assert.equal(result.ok, false);
  assert.match(result.reason, /byte mismatch/);
});

test('stale app.css bytes fail identity even at HTTP200', () => {
  const stale = Buffer.concat([expectedAppCss, Buffer.from('\n/* stale */')]);
  const result = checkAssetIdentity({ label: 'app.css', status: 200, body: stale, expected: expectedAppCss });
  assert.equal(result.ok, false);
});

test('a non-200 response fails identity without comparing bytes', () => {
  for (const status of [304, 404, 500]) {
    const result = checkAssetIdentity({ label: 'app.js', status, body: Buffer.alloc(0), expected: expectedAppJs });
    assert.equal(result.ok, false);
    assert.match(result.reason, /HTTP 200/);
    assert.equal(result.status, status);
  }
});

test('an HTML fallback page served at the asset route fails identity', () => {
  const htmlFallback = Buffer.from('<!DOCTYPE html><html><body>Not found</body></html>');
  const result = checkAssetIdentity({ label: 'app.js', status: 200, body: htmlFallback, expected: expectedAppJs });
  assert.equal(result.ok, false);
  assert.match(result.reason, /byte mismatch/);
});

test('identity does not claim rendered behavior, only source byte equality', () => {
  const result = checkAssetIdentity({ label: 'app.js', status: 200, body: expectedAppJs, expected: expectedAppJs });
  assert.deepEqual(Object.keys(result).sort(), ['bytes', 'expectedBytes', 'expectedSha256', 'label', 'ok', 'reason', 'sha256', 'status'].sort());
});
