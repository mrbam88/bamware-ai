// Read-only projection for the server-local Chief of Staff; never initializes state.
import fs from 'node:fs';
import path from 'node:path';
export function readScrumMasterSummary(directory,{now=Date.now()}={}) {
  try {
    const roleFile=path.join(directory,'.scrum-master.json'),statusFile=path.join(directory,'.coordinator.json');
    if(fs.statSync(roleFile).size>2_000_000||fs.statSync(statusFile).size>100_000)throw Error();
    const s=JSON.parse(fs.readFileSync(roleFile,'utf8')),c=JSON.parse(fs.readFileSync(statusFile,'utf8'));
    if(s.version!==1||!Array.isArray(s.assignments))throw Error();
    const age=now-Date.parse(c.checkedAt);const stale=!Number.isFinite(age)||age<0||age>180_000;
    return {role:'scrum_master',runtime:'assistant-web.service / deterministic resident supervision',status:stale?'stale':c.status,checkedAt:c.checkedAt??null,nextSweepAt:c.nextSweepAt??null,coverage:c.coverage??'Unknown coverage',lastSuccessfulReconciliationAt:s.lastSuccessfulReconciliationAt??null,failures:(c.failures??[]).map(f=>({id:f.id,error:f.error})),mandate:{id:s.mandate.id,status:s.mandate.status,revision:s.mandate.revision,acceptanceReceiptId:s.mandate.acceptanceReceiptId},lastRun:s.lastRun?{id:s.lastRun.id,status:s.lastRun.status,pickedUpAt:s.lastRun.pickedUpAt,finishedAt:s.lastRun.finishedAt}:null,assignments:s.assignments.map(a=>({id:a.id,title:a.title,source:a.source,status:a.status,checkpoint:a.nextCheckpoint,assessment:a.assessment?{status:a.assessment.status,nextAction:a.assessment.nextAction,at:a.assessment.at,runReceiptId:a.assessment.runReceiptId,workerExecutionVerified:false}:null,lastSourceCheckAt:a.lastSourceCheckAt??null,nextCheckAt:a.nextCheckAt??null,acceptanceReceiptId:a.acceptance.receiptId,importedAt:a.importedEvidence?.importedAt??null})),limitation:'Read-only disk projection; not a live service heartbeat or model execution. In-memory persistence failures require the authenticated API or service logs; stale disk timestamps are flagged.'};
  } catch {return {role:'scrum_master',status:'unavailable',coverage:'Supervisor files unavailable or invalid; no assignment progress inferred.',failures:[{error:'Read-only supervisor state unavailable.'}]};}
}
