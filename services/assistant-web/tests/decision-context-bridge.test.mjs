import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../../scripts/decision-discussion-context.mjs',import.meta.url));
test('read-only bridge requires task-local Discord owner turn, never user-supplied IDs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'discussion-context-'));
 const record={decisionId:'fixture',threadId:'100000000000000000',ownerId:'200000000000000000',seedMessageId:'300000000000000000',candidateVersion:'1',fingerprint:'fixture',status:'ready',proposal:{title:'Scoped fixture'}};
 fs.writeFileSync(path.join(dir,'a'.repeat(64)+'.json'),JSON.stringify(record));fs.writeFileSync(path.join(dir,'b'.repeat(64)+'.json'),'bad unrelated ledger');
 const env={PATH:process.env.PATH,ASSISTANT_WEB_DISCUSSIONS_DIR:dir,HERMES_SESSION_PLATFORM:'discord',HERMES_SESSION_THREAD_ID:record.threadId,HERMES_SESSION_USER_ID:record.ownerId,HERMES_SESSION_MESSAGE_ID:'400000000000000000'};
 const run=(extra={},args=[])=>spawnSync(process.execPath,[script,...args],{env:{...env,...extra},encoding:'utf8'});
 const valid=run();assert.equal(valid.status,0);assert.equal(JSON.parse(valid.stdout).summaryFormat.ownerMessageId,env.HERMES_SESSION_MESSAGE_ID);
 for(const extra of [{HERMES_SESSION_PLATFORM:'cli'},{HERMES_SESSION_USER_ID:'900000000000000000'},{HERMES_SESSION_MESSAGE_ID:record.seedMessageId},{HERMES_SESSION_THREAD_ID:'900000000000000000'},{HERMES_SESSION_MESSAGE_ID:''}]){const r=run(extra);assert.notEqual(r.status,0);assert.equal(r.stdout,'');}
 assert.notEqual(run({},[record.threadId]).status,0);
});
