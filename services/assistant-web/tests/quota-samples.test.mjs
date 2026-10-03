import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {claudeMaxAdapter} from '../lib/providers/claude-max-adapter.mjs';
import {buildWindow} from '../lib/rate-limits.mjs';

test('existing collector sample produces real percentages without invented token caps or transcript fields', async () => {
 const dir=await mkdtemp(join(tmpdir(),'quota-test-'));
 try {
  const file=join(dir,'samples.jsonl'); const now=Date.now();
  await writeFile(file,JSON.stringify({at:new Date(now).toISOString(),meters:[{kind:'weekly',percent:87,resetsAt:new Date(now+3600000).toISOString(),tokensInWindow:999}],secret:'do-not-export'})+'\n{"torn":');
  const [raw]=await claudeMaxAdapter({quotaSamplesFile:file});
  const w=buildWindow(raw,{now});
  assert.equal(w.utilizationPct,87);assert.equal(w.state,'fresh');assert.equal(w.warning,true);
  assert.equal(w.usedTokens,null);assert.equal(w.limitTokens,null);
  assert.ok(!JSON.stringify(w).includes('do-not-export'));
  assert.equal(buildWindow(raw,{now:now+16*60000}).state,'stale');
  const reset=buildWindow(raw,{now:now+3600001});assert.equal(reset.utilizationPct,null);
  assert.equal(buildWindow({...raw,utilizationPct:100},{now}).state,'exhausted');
  assert.equal(buildWindow({...raw,utilizationPct:100},{now:now+16*60000}).state,'stale');
  await writeFile(file,JSON.stringify({at:new Date(now).toISOString(),meters:[{kind:'weekly',percent:null}]}));
  assert.equal((await claudeMaxAdapter({quotaSamplesFile:file}))[0].source.kind,'unsupported');
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('Codex percentage snapshots preserve provider timestamps and missing data is unavailable', async () => {
 const {codexQuotaAdapter}=await import('../lib/providers/codex-quota-adapter.mjs');
 const dir=await mkdtemp(join(tmpdir(),'codex-quota-'));
 try {
  const file=join(dir,'quota.json');const now=Date.now();
  await writeFile(file,JSON.stringify({windows:[{provider:'codex',scope:'primary-10080min',utilizationPct:34,source:{kind:'live',fetchedAt:new Date(now).toISOString()},secret:'excluded'}]}));
  const [raw]=await codexQuotaAdapter({codexQuotaFile:file});
  assert.equal(buildWindow(raw,{now}).utilizationPct,34);
  assert.equal(buildWindow(raw,{now:now+16*60000}).state,'stale');
  assert.ok(!JSON.stringify(raw).includes('excluded'));
  assert.equal((await codexQuotaAdapter({codexQuotaFile:file+'.missing'}))[0].source.kind,'unsupported');
 } finally {await rm(dir,{recursive:true,force:true});}
});
