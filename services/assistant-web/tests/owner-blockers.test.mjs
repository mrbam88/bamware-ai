import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createOwnerBlockers} from '../lib/owner-blockers.mjs';
import {respondToDecision} from '../lib/decisions.mjs';
const candidate={id:'test-blocker',version:'1',title:'Test',context:'Test only',source:{kind:'fixture',ref:'test'},options:[{id:'done',label:'Recheck',action:'discuss'}],urgency:'high',owner:'Test',blockedWork:['Test']};
function setup(t, extra={}) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'owner-blockers-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const file=path.join(directory,'test-blocker.json');let time=1000000000000;
 const state={id:candidate.id,status:'waiting_for_owner',ownerAction:'Test',completion:'Test',...extra};fs.writeFileSync(file,JSON.stringify(state));
 return {file,directory,advance:()=>time+=600000,make:opts=>createOwnerBlockers({directory,candidates:[candidate],now:()=>time,...opts}),read:()=>JSON.parse(fs.readFileSync(file))};
}
test('adopts legacy receipt and keeps unavailable probe honest across restart',async t=>{
 const s=setup(t,{notification:{status:'delivered',messageId:'old'}});let sends=0;
 await s.make({notify:async()=>{sends++}}).sweep();s.advance();await s.make({notify:async()=>{sends++}}).sweep();
 assert.equal(sends,0);assert.equal(s.read().status,'waiting_for_owner');assert.equal(s.read().reconciliation.state,'unavailable');assert.equal(s.read().notifications.waiting_for_owner.messageId,'old');
});
test('notification state persists before send; repeats and restart do not duplicate',async t=>{
 const s=setup(t);let sends=0;const notify=async()=>{sends++;assert.equal(s.read().notifications.waiting_for_owner.status,'sending');return {messageId:'one',verifiedAt:'now'}};
 await s.make({notify}).sweep();s.advance();await s.make({notify}).sweep();assert.equal(sends,1);
});
test('ambiguous and interrupted sends never automatically resend',async t=>{
 const s=setup(t);let sends=0;const notify=async()=>{sends++;throw Error('timeout')};
 await s.make({notify}).sweep();s.advance();await s.make({notify}).sweep();assert.equal(sends,1);assert.equal(s.read().notifications.waiting_for_owner.status,'unknown');
 const b=s.read();b.notifications.waiting_for_owner.status='sending';fs.writeFileSync(s.file,JSON.stringify(b));s.advance();await s.make({notify}).sweep();assert.equal(sends,1);
});
test('explicit delivery rejection retries at most three times',async t=>{
 const s=setup(t);let sends=0;const runtime=s.make({notify:async()=>{sends++;throw Object.assign(Error(),{safeToRetry:true})}});
 for(let i=0;i<7;i++){await runtime.sweep();s.advance();}assert.equal(sends,3);
});
test('paused/cancelled and concurrent owner pause prevent work and alerts',async t=>{
 const s=setup(t,{status:'paused'});let calls=0;const runtime=s.make({checks:{'test-blocker':async()=>{calls++;runtime.recordResponse('test-blocker',{action:'defer'});return{state:'resolved',evidence:{ref:'fixture'}}}},notify:async()=>{calls++}});
 await runtime.sweep();assert.equal(calls,0);runtime.recordResponse('test-blocker',{action:'discuss'});await runtime.sweep();assert.equal(s.read().status,'paused');assert.equal(calls,1);
});
test('resolution needs source evidence; no worker registered means resume pending',async t=>{
 const s=setup(t,{notification:{status:'delivered'}});
 await s.make({checks:{'test-blocker':async()=>({state:'resolved'})}}).sweep();assert.equal(s.read().status,'waiting_for_owner');s.advance();
 await s.make({checks:{'test-blocker':async()=>({state:'resolved',evidence:{ref:'verified-fixture'}})}}).sweep();assert.equal(s.read().status,'resolved');assert.equal(s.read().resume.status,'resume_pending');
});
test('dispatch intent survives ambiguous worker and restart only looks up receipt',async t=>{
 const s=setup(t,{authorization:{scope:'fixture-only',revision:'v1'}});let dispatches=0,lookups=0;
 const opts={checks:{'test-blocker':async()=>({state:'resolved',evidence:{ref:'fixture'}})},resumes:{'test-blocker':{dispatch:async()=>{dispatches++;assert.equal(s.read().resume.status,'dispatching');throw Error()},lookup:async()=>{lookups++;return{accepted:true,id:'receipt'}}}}};
 await s.make(opts).sweep();s.advance();await s.make(opts).sweep();assert.equal(dispatches,1);assert.equal(lookups,1);assert.equal(s.read().resume.status,'pickup_confirmed');
});
test('dynamic card is validated and malformed ledgers are visible failures',async t=>{
 const s=setup(t,{candidate});const runtime=createOwnerBlockers({directory:s.directory,candidates:[]});assert.equal(runtime.additionalCandidates().length,1);
 fs.writeFileSync(path.join(s.directory,'broken.json'),'{');await runtime.sweep();assert.equal(runtime.status().status,'partial');assert.equal(runtime.status().failures[0].id,'broken');
});
test('scheduled sweep runs without request and survives a new coordinator instance',async t=>{
 const s=setup(t,{notification:{status:'delivered'}});const runtime=s.make({intervalMs:15});await runtime.start();t.after(()=>runtime.stop());const first=runtime.status().checkedAt;s.advance();await new Promise(r=>setTimeout(r,45));assert.notEqual(runtime.status().checkedAt,first);runtime.stop();s.advance();const next=s.make({intervalMs:15});await next.start();t.after(()=>next.stop());assert.equal(next.status().running,true);
});
test('approve cannot execute an option declared discuss',async t=>{
 const s=setup(t);await assert.rejects(()=>respondToDecision(path.join(s.directory,'responses.json'),candidate,{action:'approve',selectedOptionId:'done',candidateVersion:'1'}),/does not authorize/);
});

test('server recovery excludes owner blockers from legacy model check and notification',async t=>{
 const {createServer,loadConfig}=await import('../server.mjs');
 const {DECISION_CANDIDATES}=await import('../lib/providers/decision-candidates.mjs');
 const c=DECISION_CANDIDATES.find(c=>c.id==='auth-email-aws-access-85');
 const s=setup(t);fs.unlinkSync(s.file);
 fs.writeFileSync(path.join(s.directory,c.id+'.json'),JSON.stringify({id:c.id,status:'waiting_for_owner',notification:{status:'delivered',messageId:'existing'}}));
 const storeFile=path.join(s.directory,'.responses.json');
 await respondToDecision(storeFile,c,{action:'discuss',candidateVersion:c.version});
 const {cfg}=loadConfig({ASSISTANT_WEB_ENV_FILE:'/nonexistent',ASSISTANT_WEB_PASSWORD:'test-password-long',ASSISTANT_WEB_SESSION_SECRET:'test-secret-test-secret-test-secret-123',ASSISTANT_WEB_OWNER_BLOCKERS:'1',ASSISTANT_WEB_OWNER_BLOCKERS_DIR:s.directory,ASSISTANT_WEB_HANDOFF_CHECKS:'1',ASSISTANT_WEB_HANDOFF_CHECKS_DIR:path.join(s.directory,'checks'),ASSISTANT_WEB_DECISIONS_FILE:storeFile});
 let calls=0;const server=createServer(cfg,{log:()=>{},handoffRun:async()=>{calls++;return{summary:'fixture'}},handoffNotify:async()=>{calls++;return{messageId:'fixture'}}});
 await new Promise(r=>setTimeout(r,30));assert.equal(calls,0);assert.equal(fs.readdirSync(path.join(s.directory,'checks')).length,0);server.close();
});

test('status persistence failure stays visible and cannot freeze following supervision sweep',async t=>{
 const s=setup(t,{notification:{status:'delivered',messageId:'existing'}});const logs=[];
 const runtime=s.make({onFailure:event=>logs.push(event)});
 const original=fs.writeFileSync;let deny=true;
 t.mock.method(fs,'writeFileSync',function(file,...args){if(deny&&String(file).includes('.coordinator.json'))throw Error('synthetic disk failure');return original.call(fs,file,...args);});
 await runtime.sweep();assert.equal(runtime.status().currentRuntimeFailure.detail.includes('could not be persisted'),true);assert.equal(logs.length,1);
 deny=false;s.advance();await runtime.sweep();assert.equal(runtime.status().currentRuntimeFailure,null);assert.equal(runtime.status().scrumMaster.lastRun.status,'partial');assert.equal(runtime.status().scrumMaster.runs.length,2);
});
