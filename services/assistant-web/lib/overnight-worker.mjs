// Adapter for the existing overnight-mode/runner.py contract. Dispatch is opt-in;
// receipt inspection never invokes a worker, reads logs or exposes task prompts.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = x => JSON.stringify(x && typeof x === 'object' ? Array.isArray(x) ? x.map(v=>JSON.parse(canonical(v))) : Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])) : x);
const read = file => { if (fs.statSync(file).size > 1024*1024) throw Error('Receipt exceeds size bound'); return fs.readFileSync(file, 'utf8'); };
const json = file => JSON.parse(read(file));
const roots = directory => fs.existsSync(directory) ? fs.readdirSync(directory).filter(n=>/^\d+$/.test(n) && fs.lstatSync(path.join(directory,n)).isDirectory()).sort().reverse().slice(0,100).map(n=>path.join(directory,n)) : [];
function atomic(file, value) { const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file); }
export function inspectOvernightReceipt(root) {
  const bytes=read(path.join(root,'batch.json')), batch=JSON.parse(bytes);
  const launch=json(path.join(root,'launch.json')), pickup=json(path.join(root,'pickup.json')), status=json(path.join(root,'status.json'));
  const batchHash=hash(bytes);
  if(pickup.batch_sha256!==batchHash || !Number.isInteger(pickup.task_pid) || pickup.task_pid<=0 || !Number.isFinite(pickup.at)) throw Error('Pickup does not match batch');
  if(launch.unit!==`bamware-overnight-${path.basename(root)}` || !Array.isArray(batch.tasks) || !batch.tasks.some(t=>t.id===pickup.task)) throw Error('Worker identity mismatch');
  const tasks=(status.tasks??[]).map(t=>({id:t.id,state:t.state,exitCode:t.exit_code,startedAt:t.started_at,finishedAt:t.finished_at}));
  const expected=batch.tasks.map(t=>t.id);
  if(new Set(expected).size!==expected.length || new Set(tasks.map(t=>t.id)).size!==tasks.length || tasks.some(t=>!expected.includes(t.id))) throw Error('Task identity mismatch');
  const complete=status.phase==='finished' && Number.isFinite(status.finished_at) && tasks.length===expected.length && tasks.every(t=>t.state==='verified'&&t.exitCode===0&&Number.isFinite(t.finishedAt));
  return { id:path.basename(root), unit:launch.unit, runtime:'existing server overnight runner', smokeTest:launch.smoke_test===true,
    requestId:batch.coordinator_request_id??null, manifestHash:hash(canonical(batch)), batchHash,
    accepted:true, state:complete?'verified_result_recorded':status.phase==='finished'?'finished_with_failures':'pickup_recorded_activity_unverified',
    pickupTask:pickup.task, pickupAt:pickup.at, finishedAt:status.finished_at??null, tasks };
}
export function inspectOvernightReceipts(directory) {
  return roots(directory).map(root=>{try{return inspectOvernightReceipt(root);}catch{return{id:path.basename(root),state:'source_unavailable',runtime:'existing server overnight runner'};}});
}
export function createOvernightWorker({directory, intentDirectory, runner, enabled=false, now=Date.now, execute=exec}) {
  const intentPath=key=>path.join(intentDirectory,`${hash(key)}.json`);
  async function lookup(key) {
    const file=intentPath(key);
    if(!fs.existsSync(file)) return {accepted:false,state:'no_intent'};
    const intent=json(file);
    const matches=[];let unreadable=false;
    for(const root of roots(directory)) {
      try {
        const batch=json(path.join(root,'batch.json'));
        if(batch.coordinator_request_id!==intent.requestId) continue;
        if(hash(canonical(batch))!==intent.manifestHash) return {accepted:false,state:'manifest_mismatch'};
        matches.push(inspectOvernightReceipt(root));
      } catch { unreadable=true; }
    }
    if(matches.length!==1) return {accepted:false,state:matches.length>1?'ambiguous_receipts':unreadable?'source_unavailable':'pickup_unconfirmed'};
    const receipt=matches[0];
    if(receipt.pickupAt*1000<intent.createdAt-1000) return {accepted:false,state:'receipt_predates_intent'};
    return {...receipt,id:`overnight:${receipt.id}`,scope:intent.scope,sourceRevision:intent.sourceRevision};
  }
  async function dispatch({idempotencyKey,authorization,manifestPath}) {
    if(!enabled) return {accepted:false,state:'disabled',detail:'No live worker launch authorized.'};
    if(typeof idempotencyKey!=='string'||!idempotencyKey||!authorization?.scope||!authorization?.revision||!authorization?.manifestSha256||!authorization?.approvedTaskIds?.length) throw Error('Explicit scope, revision, manifest hash and approved task IDs required');
    if(!path.isAbsolute(manifestPath??'')) throw Error('Absolute approved manifest required');
    const bytes=read(manifestPath),batch=JSON.parse(bytes);
    if(hash(bytes)!==authorization.manifestSha256) throw Error('Authorized manifest hash mismatch');
    if(batch.schema!==1 || batch.unresolved_decisions?.length!==0 || !Array.isArray(batch.tasks) || !batch.tasks.length || batch.tasks.some(t=>t.approved!==true) || canonical(batch.tasks.map(t=>t.id).sort())!==canonical([...authorization.approvedTaskIds].sort())) throw Error('Manifest task scope mismatch');
    fs.mkdirSync(intentDirectory,{recursive:true,mode:0o700});
    const file=intentPath(idempotencyKey),requestId=hash(idempotencyKey);
    const effective={...batch,coordinator_request_id:requestId};
    const manifestHash=hash(canonical(effective));
    if(fs.existsSync(file)) {
      const old=json(file);if(old.manifestHash!==manifestHash||old.scope!==authorization.scope||old.sourceRevision!==authorization.revision) throw Error('Idempotency key reused with changed authorization');
      return lookup(idempotencyKey);
    }
    const intent={requestId,manifestHash,scope:authorization.scope,sourceRevision:authorization.revision,createdAt:now(),status:'launch_intent'};
    try {fs.writeFileSync(file,JSON.stringify(intent),{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST'){const old=json(file);if(old.manifestHash!==manifestHash||old.scope!==authorization.scope||old.sourceRevision!==authorization.revision)throw Error('Concurrent authorization mismatch');return lookup(idempotencyKey);}throw e;}
    // Intent is permanent even if the launch call times out. Never re-launch it.
    const effectivePath=path.join(intentDirectory,`${requestId}.manifest`);fs.writeFileSync(effectivePath,JSON.stringify(effective),{mode:0o600});
    try {await execute('python3',[runner,'start',effectivePath,'--state-dir',directory],{timeout:180000,maxBuffer:1024*1024});intent.status='launch_returned';}
    catch {intent.status='launch_unknown';}
    atomic(file,intent);
    return lookup(idempotencyKey);
  }
  async function probe({idempotencyKey,taskId,expectedManifestHash,expectedRevision,maxAgeMs=86400000}) {
    if(!expectedManifestHash||!expectedRevision||!taskId) return {state:'unavailable',detail:'Expected task, manifest and source revision required.'};
    const receipt=await lookup(idempotencyKey);
    if(!receipt.accepted||receipt.manifestHash!==expectedManifestHash||receipt.sourceRevision!==expectedRevision) return {state:'unavailable',detail:'No matching authorized worker receipt.'};
    const task=receipt.tasks.find(t=>t.id===taskId);
    if(!task||!Number.isFinite(task.finishedAt)||now()-task.finishedAt*1000>maxAgeMs||task.finishedAt*1000>now()+1000) return {state:'unavailable',detail:'Task result missing, stale or future-dated.'};
    if(task.state!=='verified'||task.exitCode!==0) return {state:'blocked',detail:'Existing runner did not verify the requested task.'};
    return {state:'resolved',evidence:{ref:`${receipt.id}/${taskId}`,manifestHash:receipt.manifestHash,sourceRevision:receipt.sourceRevision,finishedAt:task.finishedAt},detail:'Existing runner recorded successful execution and verification commands; independent product QA remains separate.'};
  }
  return {dispatch,lookup,probe};
}
