import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { overnightUsageAdapter } from '../lib/providers/overnight-usage-adapter.mjs';
test('overnight metadata adapter distinguishes missing, valid and invalid exports', async () => {
 const dir = await mkdtemp(path.join(os.tmpdir(), 'overnight-metrics-'));
 try {
  const file = path.join(dir, 'usage.json');
  assert.deepEqual(await overnightUsageAdapter(file), []);
  await writeFile(file, JSON.stringify({version:1,events:[{id:'fixture',usage:{input:12}}]}));
  assert.equal((await overnightUsageAdapter(file))[0].usage.input,12);
  await writeFile(file, '{bad');
  await assert.rejects(overnightUsageAdapter(file), /unavailable or invalid/);
 } finally { await rm(dir, {recursive:true, force:true}); }
});
