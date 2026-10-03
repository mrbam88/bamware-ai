// One resident logical role, hosted by the existing scheduler. No model/worker launch.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const iso=n=>new Date(n).toISOString();
const MANDATE_ID='cos-to-scrum-master-supervision-v1';
const SCOPE='registered-owner-blockers-and-explicit-supervision-assignments';
const REVISION='founder-2026-10-03-v1';
export const ROLE_DEFINITIONS={
  stakeholder_ceo:{name:'Stakeholder / CEO',responsibility:'Outcomes, priorities and reserved decisions; not routine task chasing or delivery management.'},
  chief_of_staff:{name:'Chief of Staff',responsibility:'Primary executive interface: COO responsibility for healthy operations, founder priorities and cross-project decisions; personal assistant and trusted sounding board. Delegate delivery supervision to Scrum Master; personal context remains private and is not forwarded to workers.'},
  scrum_master:{name:'Scrum Master',responsibility:'Shared execution supervision: ownership, pickup evidence, progress, stalled handoffs, review routing and completion evidence. Current executor only reconciles registered blockers and read-only assignment sources.'},
};
export async function readGitHubSource(source) {
  if(!/^mrbam88\/[a-z0-9-]+$/.test(source.repo)||!['issue','pull'].includes(source.kind)||!Number.isSafeInteger(source.number)||source.number<1)throw Error('Invalid source');
  const response=await fetch(`https://api.github.com/repos/${source.repo}/${source.kind==='pull'?'pulls':'issues'}/${source.number}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'Bamware-Scrum-Master'},redirect:'error',signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!response.ok)throw Error('Source unavailable');
  const data=await response.json();
  const expected=`https://github.com/${source.repo}/${source.kind==='pull'?'pull':'issues'}/${source.number}`;
  if(data.number!==source.number||data.html_url!==expected||!['open','closed'].includes(data.state)||!Number.isFinite(Date.parse(data.updated_at)))throw Error('Invalid source');
  return {ref:expected,state:data.state,updatedAt:data.updated_at,...(source.kind==='pull'?{draft:data.draft===true,merged:data.merged===true,headRevision:typeof data.head?.sha==='string'?data.head.sha:null}:{})};
}
export function assessAssignment(assignment, observations) {
  const findings=observations.map(o=>{
    if(o.status!=='available')return {source:o.source,status:'unknown',nextAction:'Recheck the unavailable source; do not infer progress.'};
    if(o.source.kind==='pull') {
      if(o.source.reviewedRevision && (!o.headRevision || !o.headRevision.startsWith(o.source.reviewedRevision)))return {source:o.source,status:'review_evidence_stale',nextAction:'Route the changed revision to independent review before release.',observedRevision:o.headRevision??null,reviewedRevision:o.source.reviewedRevision};
      if(o.merged)return {source:o.source,status:'merge_recorded_verification_pending',nextAction:'Verify deployment and acceptance evidence; merge alone is not completion.'};
      if(o.state==='closed')return {source:o.source,status:'closed_without_merge',nextAction:'Reconcile replacement or cancellation with the assigned worker.'};
      return {source:o.source,status:o.draft?'draft_pending_review_release':'review_release_pending',nextAction:'Obtain current review evidence and existing release prerequisites; do not merge automatically.'};
    }
    return {source:o.source,status:o.state==='closed'?'closure_recorded_completion_unverified':'open_issue',nextAction:o.state==='closed'?'Check acceptance evidence before reporting completion.':'Check assigned worker checkpoint; issue state is not execution evidence.'};
  });
  const selected=findings.find(f=>f.status==='unknown')??findings.find(f=>f.status==='review_evidence_stale')??(assignment.worker?.kind==='unassigned'?{status:'handoff_pending',nextAction:'Chief of Staff must route an authorized implementation handoff; no worker pickup exists.'}:null)??findings.find(f=>f.status!=='open_issue')??{status:'checkpoint_pending',nextAction:'Request the recorded checkpoint from the existing session worker; do not duplicate dispatch.'};
  return {status:selected.status,nextAction:selected.nextAction,findings,engineeringCompletionVerified:false,workerExecutionVerified:false,escalateToCEO:false};
}
export function createScrumMaster({directory,assignments=[],now=Date.now,readSource=readGitHubSource,sourceIntervalMs=900_000}) {
  const file=path.join(directory,'.scrum-master.json');
  const instanceId=randomUUID();
  const read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
  function save(state){fs.mkdirSync(directory,{recursive:true,mode:0o700});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(tmp,file);}
  function validate(s){if(s.version!==1||s.mandate?.id!==MANDATE_ID||s.mandate?.scope!==SCOPE||s.mandate?.revision!==REVISION||!['enabled','paused','revoked'].includes(s.mandate.status)||!Array.isArray(s.assignments))throw Error('Role mandate unavailable or changed');return s;}
  function initialize(){
    if(fs.existsSync(file))return validate(read());
    const at=iso(now());
    const state={version:1,roles:ROLE_DEFINITIONS,mandate:{id:MANDATE_ID,scope:SCOPE,revision:REVISION,status:'enabled',from:'chief_of_staff',to:'scrum_master',approvedSource:'https://github.com/mrbam88/bamware-ai/issues/79',acceptedAt:at,acceptanceReceiptId:randomUUID()},assignments:assignments.map(a=>({...structuredClone(a),importedEvidence:{...structuredClone(a.importedEvidence),importedAt:at,timestampMeaning:'Time received by this supervisor; source artifact completion times are not independently reverified.'},status:'supervising',executiveOwner:'chief_of_staff',operationalOwner:'scrum_master',acceptance:{receiptId:randomUUID(),acceptedAt:at,from:'chief_of_staff',to:'scrum_master',scope:'read-only-supervision-no-coding-dispatch'},observations:[],nextCheckAt:at})),runs:[],runtime:{service:'assistant-web.service',host:'omarchy',kind:'deterministic-resident-role',modelInvocations:0,workerDispatches:0}};
    save(state);return state;
  }
  function allowed(){try{return validate(read()).mandate.status==='enabled';}catch{return false;}}
  function assertAllowed(){if(!allowed())throw Error('Mandate not enabled');}
  function beginRun(){
    const s=initialize();if(s.mandate.status!=='enabled')return null;
    if(s.activeRun){s.runs.push({...s.activeRun,status:'failed',finishedAt:iso(now()),detail:'Previous sweep interrupted; no task outcome inferred.'});}
    const run={id:randomUUID(),mandateId:MANDATE_ID,role:'scrum_master',instanceId,status:'pickup',scope:SCOPE,pickedUpAt:iso(now())};
    s.activeRun=run;s.runs=s.runs.slice(-30);save(s);return run.id;
  }
  async function reconcileAssignments(runId){
    const initial=validate(read());
    for(const assignment of initial.assignments){
      assertAllowed();if(['paused','cancelled'].includes(assignment.status)||Date.parse(assignment.nextCheckAt)>now())continue;
      const results=[];
      for(const source of assignment.sources){
        assertAllowed();try{results.push({source,observedAt:iso(now()),status:'available',...await readSource(source)});}catch{results.push({source,observedAt:iso(now()),status:'unavailable',detail:'Read-only source unavailable; no progress or completion inferred.'});}
      }
      assertAllowed();const latest=validate(read());if(latest.activeRun?.id!==runId)throw Error('Sweep ownership changed');
      const current=latest.assignments.find(a=>a.id===assignment.id);
      if(!current||current.revision!==assignment.revision||['paused','cancelled'].includes(current.status))continue;
      current.observations=results;current.lastSourceCheckAt=iso(now());current.nextCheckAt=iso(now()+sourceIntervalMs);current.lastSweepReceiptId=runId;
      current.assessment={...assessAssignment(current,results),by:'scrum_master',runReceiptId:runId,at:iso(now()),executiveSummary:'Not produced by this deterministic sweep; Chief of Staff consumes the evidence.'};
      current.coverage='Issue/PR metadata only; not live worker execution, QA rerun, merge authorization or task completion.';
      save(latest);
    }
  }
  function finishRun(runId,{failures=[],blockerSummary={}}={}){
    const s=validate(read());if(s.activeRun?.id!==runId)throw Error('Sweep ownership changed');
    const unavailable=s.assignments.reduce((n,a)=>n+a.observations.filter(o=>o.status==='unavailable').length,0);
    const status=failures.length?'failed':unavailable||blockerSummary.unavailable?'partial':'completed';
    const run={...s.activeRun,status,finishedAt:iso(now()),failures,blockerSummary,assignmentCount:s.assignments.length,unavailableSources:unavailable,meaning:'Supervision sweep only; not engineering task completion.'};
    s.runs.push(run);s.runs=s.runs.slice(-30);s.lastRun=run;if(status==='completed')s.lastSuccessfulReconciliationAt=run.finishedAt;delete s.activeRun;save(s);return run;
  }
  function status(){try{const s=validate(read());return {...s,runHistoryRetained:s.runs.length,coverage:'Registered owner blockers and explicit assignments only; no general board discovery, model reasoning or coding dispatch.'};}catch{return {status:'unavailable',role:'scrum_master',coverage:'Role state unavailable; no supervision pickup claimed.'};}}
  function setMandateStatus(status){if(!['enabled','paused','revoked'].includes(status))throw Error('Invalid mandate status');const s=initialize();if(s.mandate.status==='revoked'&&status!=='revoked')throw Error('Revoked mandate requires a new reviewed revision');s.mandate.status=status;s.mandate.changedAt=iso(now());save(s);}
  return {beginRun,reconcileAssignments,finishRun,status,allowed,assertAllowed,setMandateStatus};
}
