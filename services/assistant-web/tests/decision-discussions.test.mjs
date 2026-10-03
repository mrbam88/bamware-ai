import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDecisionDiscussions } from '../lib/decision-discussions.mjs';
import { DEMO_DECISION_CANDIDATES } from '../lib/providers/decision-candidates-demo-fixtures.mjs';
const candidate = DEMO_DECISION_CANDIDATES[0];
function fixture() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'discussion-test-'));
  let seq=100000000000000000n; const messages=[]; const threads=new Map(); let ambiguous=false, unavailable=false;
  const transport={
    identity:async()=>({channelId:'200000000000000000',guildId:'300000000000000000',ownerId:'400000000000000000',botId:'500000000000000000'}),
    sendMessage:async(channel,content)=>{ const m={id:String(++seq),channel,content,author:{id:'500000000000000000',bot:true}}; messages.push(m); if(ambiguous){ambiguous=false;throw Error('unknown');} return m; },
    findMessage:async(channel,op)=>messages.find(m=>m.channel===channel&&m.content.endsWith(op.marker)),
    ensureThread:async(parent,id)=>{threads.set(id,{id});return{id};},
    checkThread:async id=>{if(unavailable)throw Error('locked or deleted');return threads.get(id);},
    messages:async(thread,after)=>messages.filter(m=>m.channel===thread&&BigInt(m.id)>BigInt(after)),
  };
  return { directory, transport, messages, threads, make:()=>createDecisionDiscussions({directory,transport}), setAmbiguous:()=>ambiguous=true,setUnavailable:()=>unavailable=true, add:(thread,content,owner=false)=>{const m={id:String(++seq),channel:thread,content,author:{id:owner?'400000000000000000':'500000000000000000',bot:!owner}};messages.push(m);return m;} };
}
test('repeat, restart and separate decisions reuse exact mapping without duplicated context', async()=>{
  const f=fixture(), d=f.make(); const a=await d.open(candidate,candidate.version), count=f.messages.length;
  assert.equal(a.status,'ready'); assert.equal((await f.make().open(candidate,candidate.version)).threadId,a.threadId); assert.equal(f.messages.length,count);
  const b=await d.open({...candidate,id:'other'},candidate.version);assert.notEqual(a.threadId,b.threadId);assert.equal(f.threads.size,2);
});
test('ambiguous send adopts exact marker without replay after restart',async()=>{
  const f=fixture();f.setAmbiguous();assert.equal((await f.make().open(candidate,candidate.version)).status,'repair_required');assert.equal(f.messages.length,1);
  const a=await f.make().open(candidate,candidate.version);assert.equal(a.status,'ready');assert.equal(f.messages.filter(m=>m.channel==='200000000000000000').length,1);
});
test('ambiguous missing message never causes automatic resend',async()=>{
  const f=fixture();f.setAmbiguous();await f.make().open(candidate,candidate.version);f.messages.length=0;
  assert.equal((await f.make().open(candidate,candidate.version)).status,'repair_required');assert.equal(f.messages.length,0);
});
test('concurrent request cannot send twice and interrupted lock is fail-closed',async()=>{
  const f=fixture(), d=f.make(); let unblock;const old=f.transport.sendMessage; f.transport.sendMessage=async(...a)=>{await new Promise(r=>unblock=r);return old(...a);};
  const first=d.open(candidate,candidate.version);await new Promise(r=>setImmediate(r));
  await assert.rejects(d.open(candidate,candidate.version),/in progress or interrupted/);
  f.transport.sendMessage=old;unblock();await first;
  const file=fs.readdirSync(f.directory).find(x=>x.endsWith('.json'));fs.writeFileSync(path.join(f.directory,file+'.lock'),'{}');await assert.rejects(f.make().open(candidate,candidate.version),/interrupted/);
});
test('version updates retain thread and history while stale open and sync are rejected',async()=>{
  const f=fixture(),d=f.make(),a=await d.open(candidate,candidate.version), revised={...candidate,version:'v-next',context:'Revised context'};
  await assert.rejects(d.open(revised,candidate.version),/changed/);await assert.rejects(d.sync(revised,revised.version),/current proposal/);
  const b=await d.open(revised,revised.version);assert.equal(b.threadId,a.threadId);assert.equal(f.threads.size,1);
});
test('locked/deleted mapping stays repairable without new thread or context',async()=>{
  const f=fixture(),d=f.make();await d.open(candidate,candidate.version);const count=f.messages.length;f.setUnavailable();
  assert.equal((await d.open(candidate,candidate.version)).status,'repair_required');assert.equal(f.messages.length,count);assert.equal(f.threads.size,1);
});
test('writeback requires exact bot/owner/thread/source/version and remains proposal-only',async()=>{
  const f=fixture(),d=f.make(),a=await d.open(candidate,candidate.version); const state=JSON.parse(fs.readFileSync(path.join(f.directory,fs.readdirSync(f.directory).find(x=>x.endsWith('.json'))),'utf8'));
  const owner=f.add(a.threadId,'Discuss changes',true);
  const p={decisionId:candidate.id,candidateVersion:candidate.version,fingerprint:state.fingerprint,ownerMessageId:owner.id,summary:'We considered changes',proposedRevision:'Proposed context'};
  f.add(a.threadId,'```bamware-decision\n'+JSON.stringify({...p,decisionId:'wrong'})+'\n```');
  assert.equal((await d.sync(candidate,candidate.version)).summary,null);
  const m=f.add(a.threadId,'```bamware-decision\n'+JSON.stringify(p)+'\n```');
  const synced=await d.sync(candidate,candidate.version);assert.equal(synced.summary.messageId,m.id);assert.equal(synced.summary.authority,'proposal_only');assert.equal(synced.pickup.status,'reply_observed');
  assert.equal((await f.make().sync(candidate,candidate.version)).summaries.length,1);
  assert.equal(fs.existsSync(path.join(f.directory,'responses.json')),false);
});
test('new revision clears current pickup and summary and requires new owner turn',async()=>{
  const f=fixture(),d=f.make(),a=await d.open(candidate,candidate.version);
  const read=()=>JSON.parse(fs.readFileSync(path.join(f.directory,fs.readdirSync(f.directory).find(x=>x.endsWith('.json'))),'utf8'));
  const oldOwner=f.add(a.threadId,'Old owner request',true);
  const envelope=(c,owner)=>'```bamware-decision\n'+JSON.stringify({decisionId:c.id,candidateVersion:c.version,fingerprint:read().fingerprint,ownerMessageId:owner.id,summary:'Summary'})+'\n```';
  f.add(a.threadId,envelope(candidate,oldOwner));assert.ok((await d.sync(candidate,candidate.version)).summary);
  const revised={...candidate,version:'next'};const next=await d.open(revised,revised.version);
  assert.equal(next.summary,null);assert.equal(next.pickup,null);assert.equal(next.summaries.length,1);
  f.add(a.threadId,envelope(revised,oldOwner));const stale=await d.sync(revised,revised.version);assert.equal(stale.summary,null);assert.equal(stale.pickup,null);
  const owner=f.add(a.threadId,'New owner request',true);f.add(a.threadId,envelope(revised,owner));assert.ok((await d.sync(revised,revised.version)).summary);
});
test('enriched card matches canonical proposal and corrupt unrelated ledger is isolated',async()=>{
 const f=fixture(),d=f.make();await d.open(candidate,candidate.version);
 assert.equal(d.snapshot({...candidate,response:null,handoff:{status:'not_applicable'},stale:false}).stale,false);
 assert.equal(d.snapshot({...candidate,context:'changed without version bump'}).stale,true);
 const file=fs.readdirSync(f.directory).find(x=>x.endsWith('.json'));fs.writeFileSync(path.join(f.directory,file),'private malformed material');
 assert.equal(d.snapshot(candidate).status,'repair_required');assert.equal(d.snapshot({...candidate,id:'other'}),null);
 assert.doesNotMatch(d.snapshot(candidate).detail,/private malformed/);
});
