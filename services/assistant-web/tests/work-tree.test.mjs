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
 assert.equal(p.taskCount,0); assert.equal(p.runCount,0); assert.equal(p.uncertainCount,0); assert.equal(p.tasks.length,0); assert.equal(p.metadata.length,1);
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
test('issue descriptions replace overnight labels while preserving identity and provenance', async () => {
 const events = ['75','76','78'].map(id=>e(id,'verified-pass',30,{project:'Bamware Assistant',repo:'mrbam88/bamware-ai',ticket:`mrbam88/bamware-ai#${id}`,batch:'2026-10-02',task:{id,title:`Overnight #${id}`}}));
 const s=await snapshot(events);const p=s.workTree.projects[0];
 assert.equal(p.name,'Assistant development');assert.equal(p.project,'Bamware Assistant');
 assert.equal(p.repositoryUrl,'https://github.com/mrbam88/bamware-ai');
 for(const t of p.tasks){assert.ok(t.purpose);assert.ok(!t.title.includes('Overnight'));assert.ok(!t.title.includes('Bamware Assistant'));assert.equal(t.batch,'2026-10-02');assert.equal(t.metadataAsOf,'2026-10-02');assert.match(t.sourceUrl,/\/issues\/(75|76|78)$/);assert.match(t.sourceTitle,/^Overnight batch:/);}
 assert.equal(p.tasks[1].title,'Agents dashboard — work analytics and model-routing evidence');
 assert.equal(p.tasks[2].title,'Command Center Decisions card MVP');
 assert.equal(p.tasks[1].id,JSON.stringify([JSON.stringify(['Bamware Assistant','mrbam88/bamware-ai']),'76']));
});
test('unrecognized repositories and tasks retain recorded labels without invented descriptions or links', async () => {
 for(const repo of ['other/bamware-ai',null,'r']){
 const s=await snapshot([e('a','verified-pass',0,{repo,task:{id:'76',title:'Recorded title'}})]);const p=s.workTree.projects[0];
 assert.equal(p.repositoryUrl,null);assert.equal(p.tasks[0].title,'Recorded title');assert.equal(p.tasks[0].purpose,null);assert.equal(p.tasks[0].sourceUrl,null);
 }
 const s=await snapshot([e('qa','verified-pass',0,{repo:'bamware-ai',task:{id:'qa',title:'Batch QA'}})]);
 assert.equal(s.workTree.projects[0].tasks[0].title,'Batch QA');assert.equal(s.workTree.projects[0].tasks[0].sourceUrl,null);
});

test('real self-adapter shape remains repository context, never an uncertain worker', async()=>{
 const s=await snapshot([{id:'self:bamware-ai:release',project:'bamware-ai',repo:'bamware-ai',task:null,attempt:{id:null,kind:'unknown'},agent:{provider:null,model:null,sessionId:null,machine:{id:'fixture-server'}},trace:{commit:'abc123'},timing:{},outcome:{state:'unknown',verified:false},source:{kind:'live',label:'assistant-web self (repo/branch/machine only)',fetchedAt:new Date(NOW).toISOString()}}]);
 const p=s.workTree.projects[0];assert.equal(p.tasks.length,0);assert.equal(p.runCount,0);assert.equal(p.uncertainCount,0);assert.equal(p.attentionCount,0);assert.equal(p.metadata[0].commit,'abc123');assert.match(p.metadata[0].source,/repo\/branch\/machine only/);
});
test('list and tree share title, purpose, batch and cost semantics; duplicates count once',async()=>{
 const a=e('bucket','verified-pass',30,{repo:'mrbam88/bamware-ai',task:{id:'76',title:'Overnight #76'},batch:'2026-10-02',cost:{kind:'estimated',amountUsd:0.25,pricingSource:'fixture'}});
 const s=await snapshot([a,a]); const tree=s.workTree.projects[0].tasks[0];const list=s.usageByProjectTask[0];
 assert.equal(list.description.title,tree.title);assert.equal(list.description.purpose,tree.purpose);assert.equal(list.description.batch,tree.batch);assert.equal(list.state,tree.state);assert.deepEqual(list.cost,tree.cost);assert.equal(tree.cost.estimated,0.25);
});
test('cost distinguishes zero, unknown, partial and separate billed/estimated amounts',async()=>{
 const withCost=(id,kind,amount)=>e(id,'verified-pass',30,{cost:{kind,amountUsd:amount}});
 let s=await snapshot([withCost('zero','estimated',0)]);assert.equal(s.usageByProjectTask[0].cost.estimated,0);assert.equal(s.usageByProjectTask[0].cost.incomplete,false);
 s=await snapshot([withCost('unknown','unknown',null)]);assert.equal(s.usageByProjectTask[0].cost.estimated,null);
 s=await snapshot([withCost('est','estimated',0.5),withCost('billed','billed',0.2),withCost('unknown','unknown',null)]);
 assert.equal(s.usageByProjectTask[0].cost.estimated,0.5);assert.equal(s.usageByProjectTask[0].cost.billed,0.2);assert.equal(s.usageByProjectTask[0].cost.incomplete,true);
});
test('potentially overlapping attempt/model cost records are excluded rather than double-counted',async()=>{
 const a=e('a','verified-pass',30,{attempt:{id:'same',kind:'implementation'},cost:{kind:'estimated',amountUsd:0.5}});const b={...a,id:'b'};
 const s=await snapshot([a,b]);assert.equal(s.usageByProjectTask[0].cost.estimated,null);assert.equal(s.usageByProjectTask[0].cost.overlapping,2);
});

test('list costs remain repository scoped just like the tree',async()=>{
 const a=e('a','verified-pass',30,{repo:'one',cost:{kind:'estimated',amountUsd:1}});const b=e('b','verified-pass',30,{repo:'two',cost:{kind:'estimated',amountUsd:2}});
 const s=await snapshot([a,b]);assert.equal(s.usageByProjectTask.length,2);assert.deepEqual(s.usageByProjectTask.map(t=>t.cost.estimated),[1,2]);
});

test('attempt totals never add to model buckets from the same work',async()=>{
 const event=(id,model,amount)=>e(id,'verified-pass',30,{attempt:{id:'same-attempt',kind:'implementation'},agent:{provider:'fixture',model},cost:{kind:'estimated',amountUsd:amount}});
 const s=await snapshot([event('attempt-total',null,1),event('model-a','a',0.6),event('model-b','b',0.4)]);
 for(const cost of [s.usageByProjectTask[0].cost,s.workTree.projects[0].tasks[0].cost]){assert.equal(cost.estimated,null);assert.equal(cost.incomplete,true);assert.equal(cost.overlapping,3);}
});
test('distinct model buckets sum only without a competing attempt total',async()=>{
 const event=(id,model,amount)=>e(id,'verified-pass',30,{attempt:{id:'same-attempt',kind:'implementation'},agent:{provider:'fixture',model},cost:{kind:'estimated',amountUsd:amount}});
 const s=await snapshot([event('model-a','a',0.6),event('model-b','b',0.4)]);assert.equal(s.usageByProjectTask[0].cost.estimated,1);assert.equal(s.usageByProjectTask[0].cost.incomplete,false);
});
