import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkUsageSnapshot } from '../lib/work-usage.mjs';
const NOW = Date.parse('2026-10-02T12:00:00Z');
const e = (id, state, minute = 0, more = {}) => ({ id, project: 'p', repo: 'r', task: { id: '1', title: 'Task' }, attempt: { id, kind: 'implementation' }, agent: { sessionId: id }, timing: { endedAt: new Date(NOW - minute * 60000).toISOString() }, outcome: { state, verified: state === 'verified-pass' }, source: { fetchedAt: new Date(NOW).toISOString() }, ...more });
const snapshot = events => buildWorkUsageSnapshot([{name:'fixture',run:async()=>events}], {}, { now: NOW });
test('duplicates do not inflate runs; later pass supersedes failure', async () => {
 const s=await snapshot([e('fail','qa-fail',20),e('pass','verified-pass',10),e('pass','verified-pass',10)]);
 const p=s.workTree.projects[0]; assert.equal(p.taskCount,1); assert.equal(p.runCount,2); assert.equal(p.attentionCount,0); assert.equal(p.tasks[0].state,'Verified pass recorded');
});
test('recorded failure rolls up without asserting live activity', async () => {
 const s=await snapshot([e('fail','qa-fail',30)]); const p=s.workTree.projects[0];
 assert.equal(p.attentionCount,1); assert.equal(p.tasks[0].runs[0].freshness,'Historical observation');
});
test('fresh metadata is neither a worker run nor a heartbeat', async () => {
 const s=await snapshot([{id:'self',project:'p',source:{fetchedAt:new Date(NOW).toISOString()}}]); const p=s.workTree.projects[0];
 assert.equal(p.taskCount,0); assert.equal(p.runCount,0); assert.equal(p.uncertainCount,1); assert.equal(p.tasks[0].runs[0].state,'Activity unknown');
});
test('unallocated records remain visible; task ids are repo-scoped', async () => {
 const s=await snapshot([e('a','verified-pass'),e('b','qa-fail',0,{repo:'other'}),{id:'unknown'}]);
 assert.equal(s.workTree.projects.length,3); assert.ok(s.workTree.projects.some(p=>p.name==='Unallocated work'));
});
test('conflicting or missing dates cannot establish latest state', async () => {
 for(const events of [[e('a','verified-pass'),e('b','qa-fail')],[e('a','verified-pass'),e('b','qa-fail',0,{timing:{}})]]) {
 const s=await snapshot(events); const t=s.workTree.projects[0].tasks[0]; assert.equal(t.state,'Latest state uncertain'); assert.equal(t.attention,false);
 }
});
test('multiple model buckets for one attempt count as one run',async()=>{
 const a=e('a','verified-pass'); const b={...a,id:'bucket2',agent:{sessionId:'a',model:'other'}};
 const s=await snapshot([a,b]); assert.equal(s.workTree.projects[0].runCount,1);
});
