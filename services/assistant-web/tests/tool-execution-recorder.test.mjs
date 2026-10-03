import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {runRecordedNodeTests,testCommandHash,readToolExecutionEvents} from '../lib/tool-execution-recorder.mjs';
import {normalizeUsageEvent,deriveActiveAgents} from '../lib/work-usage.mjs';
function setup(t,source){const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'recorded-tests-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));fs.writeFileSync(path.join(cwd,'proof.test.mjs'),source);const testFiles=['proof.test.mjs'];return{cwd,testFiles,directory:path.join(cwd,'receipts'),identity:{project:'fixture',repo:'fixture',taskId:'fixture-testing',title:'Synthetic recorder verification'},authorization:{approved:true,scope:'Run synthetic local Node tests only',scopeRevision:'fixture-v1',commandHash:testCommandHash(cwd,testFiles)}};}
test('real child pickup/output opens Testing lease; silence expires; completion closes it',async t=>{
 const options=setup(t,'import test from "node:test";test("fixture",async()=>{console.log("PRIVATE-COMMAND-OUTPUT");await new Promise(r=>setTimeout(r,300));});');
 const events=[];const began=Date.now();const receipt=await runRecordedNodeTests({...options,leaseMs:100,observe:e=>events.push(e)});
 assert.ok(Date.now()-began>=300,'actual child test awaited its timer');assert.equal(receipt.exitCode,0);const active=events.find(e=>e.execution.status==='working');assert.ok(active.execution.pickupReceiptId);
 const at=Date.parse(active.execution.observedAt);assert.equal(deriveActiveAgents([normalizeUsageEvent(active)],{now:at})[0].executionPhase,'testing');
 assert.equal(deriveActiveAgents([normalizeUsageEvent(active)],{now:at+150})[0].state,'stale');
 const records=readToolExecutionEvents(options.directory);assert.equal(records[0].execution.status,'done');const terminal=deriveActiveAgents(records.map(normalizeUsageEvent),{now:Date.now()+86400000})[0];assert.equal(terminal.state,'recorded');assert.equal(terminal.executionStatus,'done');assert.equal(terminal.executionScope,'test-command');assert.ok(terminal.executionRecordedAt);assert.equal(terminal.executionLeaseExpiresAt,null);
 assert.ok(!fs.readFileSync(receipt.file,'utf8').includes('PRIVATE-COMMAND-OUTPUT'));assert.equal(records[0].authorization,undefined);
});
test('exact authorization mismatch never launches or creates telemetry',async t=>{const options=setup(t,'throw Error("must not run")');await assert.rejects(()=>runRecordedNodeTests({...options,authorization:{...options.authorization,commandHash:'bad'}}),/authorization required/);assert.equal(fs.existsSync(options.directory),false);});
test('routine test failure stays noncritical and never claims verified task completion',async t=>{const options=setup(t,'import test from "node:test";test("failure",()=>{throw Error("fixture failure")});');const r=await runRecordedNodeTests(options);const raw=JSON.parse(fs.readFileSync(r.file));assert.notEqual(r.exitCode,0);assert.equal(raw.event.result.critical,false);assert.equal(raw.event.execution.status,'failed');assert.equal(raw.event.outcome.verified,false);});
test('silent live child cannot renew a lease; timeout records failure and closes receipt',async t=>{
 const options=setup(t,'import test from "node:test";test("silent",async()=>{await new Promise(r=>setTimeout(r,5000));});');
 const running=runRecordedNodeTests({...options,leaseMs:100,timeoutMs:600});
 await new Promise(r=>setTimeout(r,350));
 const before=readToolExecutionEvents(options.directory);assert.equal(before[0].execution.status,'working');assert.equal(deriveActiveAgents(before.map(normalizeUsageEvent))[0].state,'stale');
 const result=await running;assert.equal(result.timedOut,true);
 const terminal=deriveActiveAgents(readToolExecutionEvents(options.directory).map(normalizeUsageEvent))[0];assert.equal(terminal.state,'recorded');assert.equal(terminal.executionStatus,'failed');assert.equal(terminal.executionLeaseExpiresAt,null);
});
test('observer failure is isolated and receipt write failure terminates safely',async t=>{
 const options=setup(t,'import test from "node:test";test("fixture",async()=>{await new Promise(r=>setTimeout(r,100));console.log("event")});');
 const receipt=await runRecordedNodeTests({...options,observe:()=>{throw Error('observer');}});assert.equal(receipt.exitCode,0);
 let removed=false;
 await assert.rejects(()=>runRecordedNodeTests({...options,observe:()=>{if(!removed){removed=true;fs.rmSync(options.directory,{recursive:true,force:true});}}}),/persistence failed/);
});
test('invalid receipt isolation preserves valid observations and nested extras never export',async t=>{
 const options=setup(t,'import test from "node:test";test("fixture",()=>{});');const r=await runRecordedNodeTests(options);
 const raw=JSON.parse(fs.readFileSync(r.file));for(const k of ['task','agent','source','outcome','execution'])raw.event[k].credential='PRIVATE-EXTRA';raw.event.agent.machine.credential='PRIVATE-EXTRA';fs.writeFileSync(r.file,JSON.stringify(raw));
 fs.writeFileSync(path.join(options.directory,'aaaa.json'),'{malformed');fs.writeFileSync(path.join(options.directory,'bbbb.json'),'x'.repeat(100001));
 const diagnostics=[];const events=readToolExecutionEvents(options.directory,{onInvalid:x=>diagnostics.push(x)});assert.equal(events.length,1);assert.equal(diagnostics.length,2);assert.ok(!JSON.stringify(events).includes('PRIVATE-EXTRA'));assert.deepEqual(diagnostics[0],{code:'invalid-tool-receipt'});
});
