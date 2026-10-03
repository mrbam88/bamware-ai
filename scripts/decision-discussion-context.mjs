#!/usr/bin/env node
// Read-only gateway context bridge. Never accepts model-supplied IDs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const thread = process.env.HERMES_SESSION_THREAD_ID;
const owner = process.env.HERMES_SESSION_USER_ID;
const message = process.env.HERMES_SESSION_MESSAGE_ID;
const snowflake = x => /^\d{16,22}$/.test(x ?? '');
if (process.argv.length !== 2 || process.env.HERMES_SESSION_PLATFORM !== 'discord' || ![thread,owner,message].every(snowflake)) throw Error('Trusted Discord turn context is unavailable. Do not supply or guess IDs.');
const directory = process.env.ASSISTANT_WEB_DISCUSSIONS_DIR || path.join(os.homedir(), '.local/state/bamware/decision-discussions');
const matches = fs.readdirSync(directory).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).flatMap(f=>{try{return [JSON.parse(fs.readFileSync(path.join(directory,f),'utf8'))];}catch{return [];}}).filter(s=>s?.threadId===thread);
if (matches.length!==1) throw Error('No unique decision mapping for this thread; do not guess context.');
const s=matches[0];
if (s.ownerId!==owner || s.status!=='ready' || !snowflake(s.seedMessageId) || BigInt(message)<=BigInt(s.seedMessageId)) throw Error('This owner turn is not current for this ready decision discussion.');
console.log(JSON.stringify({decisionId:s.decisionId,candidateVersion:s.candidateVersion,fingerprint:s.fingerprint,proposal:s.proposal,status:s.status,authority:'discussion_only_no_execution',summaryFormat:{decisionId:s.decisionId,candidateVersion:s.candidateVersion,fingerprint:s.fingerprint,ownerMessageId:message,summary:'short summary',proposedRevision:'proposed change, not approval'}},null,2));
