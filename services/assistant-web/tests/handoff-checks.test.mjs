import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHandoffChecks} from '../lib/handoff-checks.mjs';
import {respondToDecision} from '../lib/decisions.mjs';
import {DECISION_CANDIDATES} from '../lib/providers/decision-candidates.mjs';
const candidate=DECISION_CANDIDATES.find(c=>c.options.some(o=>o.action==='approve'));
function setup(run=async()=>({summary:'Checked; no worker pickup claimed'}),notify=async()=>({messageId:'fixture-only'})) {
 const dir=mkdtempSync(path.join(os.tmpdir(),'handoff-check-'));
 const storeFile=path.join(dir,'decisions.json');
 const options={directory:path.join(dir,'checks'),storeFile,candidates:[candidate],run,notify};
 return {storeFile,options,checks:createHandoffChecks(options)};
}
async function response(s,action='approve',note=null) {
 return respondToDecision(s.storeFile,candidate,{action,candidateVersion:candidate.version,selectedOptionId:action==='approve'?candidate.options.find(o=>o.action==='approve').id:null,note});
}
test('all four actions queue one coordination check; duplicates/restart do not rerun',async()=>{
 for(const action of ['approve','reject','discuss','defer']) {
  let calls=0,sends=0;const s=setup(async()=>{calls++;return {summary:action};},async()=>{sends++;return {messageId:'synthetic'};});
  await response(s,action);s.checks.enqueue(candidate);s.checks.enqueue(candidate);await s.checks.drain();
  assert.equal(calls,1);assert.equal(sends,1);assert.equal(s.checks.snapshot(candidate).status,'completed');
  const restart=createHandoffChecks(s.options);restart.recover();await restart.drain();assert.equal(calls,1);
 }
});
test('changed response supersedes an in-flight result and queues its own check',async()=>{
 let release;const wait=new Promise(r=>release=r);let calls=0,sends=0;
 const s=setup(async()=>{calls++;if(calls===1)await wait;return {summary:'checked'};},async()=>{sends++;return {};});
 await response(s);s.checks.enqueue(candidate);const running=s.checks.drain();
 await response(s,'reject');s.checks.enqueue(candidate);release();await running;await s.checks.drain();
 assert.equal(calls,2);assert.equal(sends,1);assert.equal(s.checks.snapshot(candidate).response,undefined);
});
test('agent failure and Discord failure remain visible without infinite retry',async()=>{
 const s=setup(async()=>{throw new Error('agent unavailable')},async()=>{throw new Error('Discord unavailable')});
 await response(s);s.checks.enqueue(candidate);await s.checks.drain();
 assert.equal(s.checks.snapshot(candidate).status,'failed');assert.equal(s.checks.snapshot(candidate).notification.status,'failed');
});
test('restart recovers queued work but interrupts running work without replay',async()=>{
 const s=setup();await response(s);const j=s.checks.enqueue(candidate);
 const p=path.join(s.options.directory,j.id+'.json');const data=JSON.parse(readFileSync(p));data.status='running';writeFileSync(p,JSON.stringify(data));
 const restart=createHandoffChecks(s.options);restart.recover();await restart.drain();assert.equal(restart.snapshot(candidate).status,'interrupted');
});
test('stale candidate cannot queue a check',async()=>{
 const s=setup();await response(s);assert.equal(s.checks.enqueue({...candidate,version:'changed'}),null);
});
