// Records actual authorized Node-test execution. No model calls and no PID polling.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function nodeTestCommand(cwd,testFiles) {
  if(!path.isAbsolute(cwd)||!Array.isArray(testFiles)||!testFiles.length) throw Error('Absolute test workdir and test files required');
  const base=fs.realpathSync(cwd);
  const files=testFiles.map(file=>{
    const resolved=fs.realpathSync(path.resolve(base,file));
    if(!resolved.startsWith(base+path.sep))throw Error('Test source must belong to approved workdir');
    return resolved;
  });
  return {cwd:base,argv:[process.execPath,'--test',...files]};
}
export const testCommandHash=(cwd,testFiles)=>hash(nodeTestCommand(cwd,testFiles));
export async function runRecordedNodeTests({cwd,testFiles,directory,identity,authorization,leaseMs=30000,timeoutMs=300000,observe=()=>{}}) {
  const command=nodeTestCommand(cwd,testFiles);
  if(authorization?.approved!==true||!authorization.scope||!authorization.scopeRevision||authorization.commandHash!==hash(command)) throw Error('Exact test command, scope and supplied scope revision authorization required');
  if(!identity?.project||!identity?.taskId||!identity?.title||!identity?.repo)throw Error('Explicit project, repo, task and title required');
  if(!Number.isInteger(leaseMs)||leaseMs<100||leaseMs>120000||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>900000)throw Error('Execution lease/timeout outside bounds');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const id=randomUUID(),file=path.join(directory,`${id}.json`);
  const event={id:`tool:${id}`,project:identity.project,repo:identity.repo,task:{id:identity.taskId,title:identity.title},attempt:{id,kind:'qa'},agent:{provider:'node-test',sessionId:`tool:${id}`,machine:{id:os.hostname(),source:'hostname'}},timing:{startedAt:null,endedAt:null},outcome:{state:'unverified',verified:false},source:{kind:'live',label:'Authorized local Node tests; activity from command start/output, not process polling'},authorization:{scope:authorization.scope,scopeRevision:authorization.scopeRevision,commandHash:authorization.commandHash}};
  const persist=()=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,event}),{mode:0o600});fs.renameSync(tmp,file);try{observe(structuredClone(event));}catch{/* Observer cannot alter command lifecycle. */}};
  return new Promise((resolve,reject)=>{
    const env={...process.env};delete env.NODE_TEST_CONTEXT;
    const child=spawn(command.argv[0],command.argv.slice(1),{cwd:command.cwd,env,stdio:['ignore','pipe','pipe'],detached:true});
    let started=false,timedOut=false,killTimer,settled=false;
    const terminate=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
    const save=()=>{if(settled)return false;try{persist();return true;}catch{settled=true;clearTimeout(timer);clearTimeout(killTimer);terminate();reject(Error('Tool receipt persistence failed; command terminated'));return false;}};
    const update=()=>{if(!started)return;const at=Date.now();event.execution={version:1,source:'worker-lifecycle',scope:'test-command',status:'working',phase:'testing',pickupReceiptId:id,observedAt:new Date(at).toISOString(),leaseExpiresAt:new Date(at+leaseMs).toISOString()};save();};
    child.once('spawn',()=>{started=true;event.timing.startedAt=new Date().toISOString();update();});
    // Raw command output is consumed, never stored or exported as telemetry.
    child.stdout.on('data',update);child.stderr.on('data',update);
    const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},3000);killTimer.unref();},timeoutMs);timer.unref();
    child.once('error',error=>{clearTimeout(timer);clearTimeout(killTimer);if(!settled){settled=true;reject(error);}});
    child.once('close',(code,signal)=>{
      clearTimeout(timer);clearTimeout(killTimer);
      if(!started||settled)return;
      const at=new Date().toISOString();event.timing.endedAt=at;
      event.execution={...event.execution,status:code===0&&!timedOut?'done':'failed',observedAt:at,leaseExpiresAt:at};
      event.result={exitCode:code,signal,timedOut,classification:'tool-result',critical:false};
      event.outcome.notes='Recorded test command result; broader task completion and independent review remain separate.';
      if(save()){settled=true;resolve({receiptId:id,file,exitCode:code,timedOut});}
    });
  });
}
export function readToolExecutionEvents(directory, {onInvalid=()=>{}}={}) {
  if(!fs.existsSync(directory))return [];
  const names=fs.readdirSync(directory).filter(n=>/^[a-f0-9-]+\.json$/.test(n));
  const candidates=names.flatMap(name=>{try{return [{name,mtime:fs.statSync(path.join(directory,name)).mtimeMs}];}catch{return [];}}).sort((a,b)=>b.mtime-a.mtime).slice(0,100);
  const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>typeof obj?.[k]==='string'||typeof obj?.[k]==='boolean'||typeof obj?.[k]==='number').map(k=>[k,obj[k]]));
  return candidates.flatMap(({name})=>{
    try {
      const file=path.join(directory,name);if(fs.statSync(file).size>100000)throw Error();
      const record=JSON.parse(fs.readFileSync(file,'utf8')),e=record.event;
      if(record.version!==1||e?.execution?.source!=='worker-lifecycle'||e?.agent?.provider!=='node-test')throw Error();
      return [{...pick(e,['id','project','repo']),task:pick(e.task,['id','title']),attempt:pick(e.attempt,['id','kind']),agent:{...pick(e.agent,['provider','sessionId']),machine:pick(e.agent.machine,['id','source'])},timing:pick(e.timing,['startedAt','endedAt']),outcome:pick(e.outcome,['state','verified']),source:pick(e.source,['kind','label']),execution:pick(e.execution,['version','source','scope','status','phase','pickupReceiptId','observedAt','leaseExpiresAt'])}];
    } catch {try{onInvalid({code:'invalid-tool-receipt'});}catch{}return [];}
  });
}
