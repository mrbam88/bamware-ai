import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createScrumMaster,readGitHubSource} from '../lib/scrum-master.mjs';
const assignment={id:'fixture',revision:'v1',title:'Fixture supervision',project:'fixture',source:'fixture',nextCheckpoint:'Verify fixture evidence',worker:{kind:'session-only',liveExecutionObserved:false},importedEvidence:{at:'2026-01-01T00:00:00Z',detail:'Historical'},sources:[{repo:'mrbam88/bamware-ai',kind:'issue',number:79}]};
function setup(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'scrum-master-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let time=Date.parse('2026-10-03T00:00:00Z');return{directory,advance:()=>time+=900001,create:opts=>createScrumMaster({directory,assignments:[assignment],now:()=>time,...opts})};}
test('CoS delegation accepted once, actual pickup and completed scoped receipt survive restart',async t=>{
 const s=setup(t);let calls=0;const opts={readSource:async()=>{calls++;return{state:'open',ref:'fixture',updatedAt:'2026-10-02T00:00:00Z'}}};
 const role=s.create(opts),id=role.beginRun();assert.equal(role.status().activeRun.status,'pickup');const receipt=role.status().assignments[0].acceptance.receiptId;
 await role.reconcileAssignments(id);role.finishRun(id);assert.equal(role.status().lastRun.status,'completed');
 const restarted=s.create(opts),next=restarted.beginRun();await restarted.reconcileAssignments(next);restarted.finishRun(next);
 assert.equal(calls,1);assert.equal(restarted.status().assignments[0].acceptance.receiptId,receipt);assert.equal(restarted.status().assignments[0].worker.liveExecutionObserved,false);assert.equal(restarted.status().runtime.workerDispatches,0);assert.ok(restarted.status().lastSuccessfulReconciliationAt);
 s.advance();const third=restarted.beginRun();await restarted.reconcileAssignments(third);restarted.finishRun(third);assert.equal(calls,2);
});
test('pause and revoke survive restart, never regain authority automatically',async t=>{
 const s=setup(t);const role=s.create();role.beginRun();role.setMandateStatus('paused');assert.equal(s.create().beginRun(),null);
 role.setMandateStatus('revoked');assert.equal(s.create().beginRun(),null);assert.throws(()=>role.setMandateStatus('enabled'),/reviewed revision/);
});
test('interrupted sweep does not become project completion, unavailable source stays partial',async t=>{
 const s=setup(t);const first=s.create();const old=first.beginRun();const next=s.create({readSource:async()=>{throw Error('private source error')}});const id=next.beginRun();
 assert.equal(next.status().runs.find(r=>r.id===old).status,'failed');await next.reconcileAssignments(id);next.finishRun(id);
 assert.equal(next.status().lastRun.status,'partial');assert.equal(next.status().assignments[0].status,'supervising');assert.equal(JSON.stringify(next.status()).includes('private source error'),false);
});
test('explicit pause during source await prevents result write and further checks',async t=>{
 const s=setup(t);let role;role=s.create({readSource:async()=>{role.setMandateStatus('paused');return{state:'closed'}}});const id=role.beginRun();await assert.rejects(()=>role.reconcileAssignments(id),/not enabled/);assert.equal(role.status().assignments[0].observations.length,0);role.finishRun(id,{failures:[{error:'Mandate paused'}]});assert.equal(role.status().mandate.status,'paused');
});
test('malformed or changed mandate fails closed without overwriting durable state',t=>{
 const s=setup(t);const role=s.create();role.beginRun();const file=path.join(s.directory,'.scrum-master.json');const state=JSON.parse(fs.readFileSync(file));state.mandate.revision='new-unreviewed';fs.writeFileSync(file,JSON.stringify(state));assert.throws(()=>s.create().beginRun());assert.equal(role.allowed(),false);assert.equal(JSON.parse(fs.readFileSync(file)).mandate.revision,'new-unreviewed');
});
test('GitHub reader uses bounded public metadata and validates source identity',async t=>{
 const previous=globalThis.fetch;t.after(()=>globalThis.fetch=previous);globalThis.fetch=async(url,options)=>{assert.equal(new Headers(options.headers).has('authorization'),false);assert.equal(options.redirect,'error');assert.ok(options.signal);return Response.json({number:79,html_url:'https://github.com/mrbam88/bamware-ai/issues/79',state:'open',updated_at:'2026-10-03T00:00:00Z',body:'DO-NOT-PERSIST'});};
 const observation=await readGitHubSource(assignment.sources[0]);assert.equal(observation.state,'open');assert.equal(JSON.stringify(observation).includes('DO-NOT-PERSIST'),false);await assert.rejects(()=>readGitHubSource({...assignment.sources[0],repo:'evil/../secret'}));
});

test('source assessment routes changed review revisions and unassigned work without inventing execution',async()=>{
 const {assessAssignment}=await import('../lib/scrum-master.mjs');
 const source={repo:'mrbam88/bamware-web',kind:'pull',number:47,reviewedRevision:'abc1234'};
 const changed=assessAssignment(assignment,[{source,status:'available',state:'open',draft:true,headRevision:'def1234'}]);assert.equal(changed.status,'review_evidence_stale');assert.equal(changed.escalateToCEO,false);
 const draft=assessAssignment(assignment,[{source,status:'available',state:'open',draft:true,headRevision:'abc123400'}]);assert.equal(draft.status,'draft_pending_review_release');
 const voice=assessAssignment({...assignment,worker:{kind:'unassigned'}},[{source:assignment.sources[0],status:'available',state:'open'}]);assert.equal(voice.status,'handoff_pending');assert.equal(voice.workerExecutionVerified,false);
 const unavailable=assessAssignment(assignment,[{source,status:'unavailable'}]);assert.equal(unavailable.status,'unknown');assert.equal(unavailable.engineeringCompletionVerified,false);
});
