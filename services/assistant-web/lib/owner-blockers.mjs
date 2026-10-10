// Server-owned reconciliation; no model invocation or implicit execution authority.
import fs from 'node:fs';
import path from 'node:path';
import { createScrumMaster } from './scrum-master.mjs';
import { assertValidCandidate } from './decisions.mjs';

const iso = n => new Date(n).toISOString();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function save(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
export function createOwnerBlockers({ directory, candidates, checks = {}, resumes = {}, notify, now = Date.now, intervalMs = 60_000, checkEveryMs = 300_000, supervisionAssignments = [], readSupervisionSource, onFailure = () => {} }) {
  let busy = false, timer, activeSweepReceipt, currentRuntimeFailure = null;
  const scrumMaster = createScrumMaster({directory, assignments:supervisionAssignments, now, ...(readSupervisionSource?{readSource:readSupervisionSource}:{})});
  const statusFile = path.join(directory, '.coordinator.json');
  const candidateMap = new Map(candidates.map(c => [c.id, c]));
  const files = () => fs.existsSync(directory) ? fs.readdirSync(directory).filter(n => /^[a-z0-9][a-z0-9-]*\.json$/.test(n)).map(n => path.join(directory, n)) : [];
  function snapshot(id) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return null;
    const file = path.join(directory, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    try { return read(file); } catch { return { id, status: 'source_error', error: 'Blocker ledger is unreadable; no action taken.' }; }
  }
  function status() {
    try { return { ...read(statusFile), ...(currentRuntimeFailure?{status:"unavailable"}:{}), running: Boolean(timer), runtime: 'assistant-web.service / Scrum Master / deterministic supervision', scrumMaster:scrumMaster.status(), currentRuntimeFailure }; }
    catch { return { running: Boolean(timer), status: 'not_yet_checked', runtime: 'assistant-web.service / Scrum Master / deterministic supervision', scrumMaster:scrumMaster.status(), currentRuntimeFailure }; }
  }
  function candidateFor(b) {
    const c = candidateMap.get(b.id) ?? b.candidate;
    assertValidCandidate(c);
    if (c.id !== b.id) throw Error('Candidate id mismatch');
    return c;
  }
  function additionalCandidates() {
    return files().flatMap(file => { try { const b = read(file); return candidateMap.has(b.id) ? [] : [candidateFor(b)]; } catch { return []; } });
  }
  async function reconcile(file) {
    let original = fs.readFileSync(file, 'utf8');
    let b = JSON.parse(original);
    const persist = () => {
      scrumMaster.assertAllowed();
      if (fs.readFileSync(file, 'utf8') !== original) throw Error('Concurrent ledger change; retry next sweep');
      save(file, b); original = fs.readFileSync(file, 'utf8');
    };
    const candidate = candidateFor(b);
    if (path.basename(file) !== `${b.id}.json` || !candidate) throw Error('No matching durable Command Center candidate');
    if (['paused', 'cancelled'].includes(b.status)) return;
    if (b.nextCheckAt && Date.parse(b.nextCheckAt) > now()) return;
    b.candidateVersion ??= candidate.version;
    if (b.candidateVersion !== candidate.version) {
      b.reconciliation = { state: 'source_changed', checkedAt: iso(now()), detail: 'Candidate revision changed; fresh scope verification required.' };
      b.nextCheckAt = iso(now() + checkEveryMs); persist(); return;
    }
    b.notifications ??= {};
    // Adopt the original manual delivery receipt. Never replay it after restart.
    if (b.notification && !b.notifications.waiting_for_owner) b.notifications.waiting_for_owner = { ...b.notification };
    b.runtime = 'assistant-web.service / Scrum Master / deterministic supervision';
    b.operationalOwner = 'scrum_master'; b.executiveOwner = 'chief_of_staff'; b.sweepReceiptId = activeSweepReceipt;
    b.lastSweepAt = iso(now());
    b.nextCheckAt = iso(now() + checkEveryMs);
    if (b.status !== 'resolved') {
      let result;
      try { result = checks[b.id] ? await checks[b.id](structuredClone(b)) : { state: 'unavailable', detail: 'No verified probe for this blocker’s originating machine. Owner response alone cannot prove resolution.' }; }
      catch { result = { state: 'unavailable', detail: 'Resolution source failed; no resolution or resume inferred.' }; }
      if (!['blocked', 'resolved', 'unavailable'].includes(result?.state)) result = { state: 'unavailable', detail: 'Resolution source returned an invalid result.' };
      if (result.state === 'resolved' && !result.evidence?.ref) result = { state: 'unavailable', detail: 'Resolution requires an evidence reference.' };
      b.reconciliation = { ...result, checkedAt: iso(now()) };
      if (result.state === 'resolved') { b.status = 'resolved'; b.resolvedAt = iso(now()); b.resolutionEvidence = result.evidence; }
    }
    persist(); // Card state always durable before outbound delivery.
    if (b.status === 'resolved' && b.resume?.status !== 'pickup_confirmed') {
      const adapter = resumes[b.id];
      if (!adapter || !b.authorization?.scope || !b.authorization?.revision) {
        b.resume = { status: 'resume_pending', detail: 'No registered worker with recorded authorization; no work dispatched.' };
      } else {
        const key = `${b.id}:${b.candidateVersion}:${b.authorization.revision}`;
        let receipt;
        try {
          if (b.resume?.intent) receipt = await adapter.lookup(b.resume.intent);
          else {
            b.resume = { status: 'dispatching', intent: key, scope: b.authorization.scope, attemptedAt: iso(now()) }; persist();
            receipt = await adapter.dispatch({ idempotencyKey: key, authorization: b.authorization, evidence: b.resolutionEvidence });
          }
          b.resume = receipt?.accepted && receipt?.id ? { ...b.resume, status: 'pickup_confirmed', receipt } : { ...b.resume, status: 'dispatch_unknown', detail: 'Pickup not verified; reconciliation will query the existing intent, never redispatch.' };
        } catch { b.resume = { ...b.resume, status: 'dispatch_unknown', detail: 'Worker receipt unavailable; no duplicate dispatch.' }; }
      }
      persist();
    }
    const transition = b.status === 'resolved' ? 'resolved' : 'waiting_for_owner';
    let n = b.notifications[transition];
    if (n?.status === 'sending') { n.status = 'unknown'; n.detail = 'Interrupted send; inspect receipt before retrying.'; persist(); }
    if (['delivered', 'unknown'].includes(n?.status) || (n?.attempts ?? 0) >= 3 || (n?.nextAttemptAt && Date.parse(n.nextAttemptAt) > now())) return;
    if (!notify) { b.notifications[transition] = { status: 'unavailable', detail: 'Notification adapter unavailable.' }; persist(); return; }
    n = { status: 'sending', attempts: (n?.attempts ?? 0) + 1, attemptedAt: iso(now()) };
    b.notifications[transition] = n; persist();
    try {
      const receipt = await notify({ blocker: structuredClone(b), candidate, transition });
      if (!receipt?.messageId || !receipt?.verifiedAt) throw Error('Unverified delivery');
      b.notifications[transition] = { ...n, ...receipt, status: 'delivered' };
    } catch (error) {
      // Only an explicit rejected request is safe to retry. Network ambiguity is not.
      b.notifications[transition] = error?.safeToRetry ? { ...n, status: 'failed', nextAttemptAt: iso(now() + checkEveryMs * n.attempts), detail: 'Delivery rejected; bounded retry scheduled.' } : { ...n, status: 'unknown', messageId: error?.messageId, detail: 'Delivery ambiguous; inspect Discord before retrying.' };
    }
    persist();
  }
  async function sweep() {
    if (busy) return;
    busy = true;
    const startedAt = iso(now());
    const failures = [];
    let roleRun;
    try {
      activeSweepReceipt = scrumMaster.beginRun();
      if (!activeSweepReceipt) {
        save(statusFile, {status:'paused',startedAt,checkedAt:iso(now()),nextSweepAt:iso(now()+intervalMs),failures:[],coverage:'Scrum Master mandate paused or revoked; no reconciliation or notifications attempted.'});
        return;
      }
      for (const file of files()) {
        try {scrumMaster.assertAllowed();await reconcile(file);}
        catch {failures.push({id:path.basename(file,'.json'),error:'Ledger, role mandate or card source unavailable; no further action inferred.'});}
      }
      await scrumMaster.reconcileAssignments(activeSweepReceipt);
      const records=files().map(f=>snapshot(path.basename(f,'.json')));
      roleRun=scrumMaster.finishRun(activeSweepReceipt,{failures,blockerSummary:{registered:records.length,unavailable:records.filter(b=>b?.reconciliation?.state==='unavailable').length,paused:records.filter(b=>['paused','cancelled'].includes(b?.status)).length}});
    } catch {
      failures.push({id:'scrum-master',error:'Supervision state or source unavailable; inspect role receipts. No model or coding dispatch attempted.'});
      if(activeSweepReceipt){try{roleRun=scrumMaster.finishRun(activeSweepReceipt,{failures});}catch{}}
    } finally {
      try { if(activeSweepReceipt || failures.length){
        let previous;try{previous=read(statusFile);}catch{}
        save(statusFile,{status:failures.length?(roleRun?'partial':'failed'):roleRun?.status==='partial'?'partial':'checked',startedAt,checkedAt:iso(now()),nextSweepAt:iso(now()+intervalMs),lastSuccessfulReconciliationAt:roleRun?.status==='completed'?iso(now()):previous?.lastSuccessfulReconciliationAt??null,failures,roleRunId:activeSweepReceipt??null,coverage:'Registered owner blockers and explicitly accepted assignments only; no general board sweep or coding dispatch.'});
      }
      if(!failures.length)currentRuntimeFailure=null;
      } catch {currentRuntimeFailure={at:iso(now()),detail:'Supervisor receipt could not be persisted; last durable status may be stale.'};try{onFailure({event:'scrum-master.persistence-failed',at:currentRuntimeFailure.at});}catch{}}
      finally {activeSweepReceipt=null;busy=false;}
    }
  }
  function recordResponse(id, response) {
    const b = snapshot(id);
    if (!b || b.status === 'source_error') return;
    if (response.action === 'defer') b.status = 'paused';
    else if (response.action === 'reject') b.status = 'cancelled';
    else if (response.action === 'approve' && b.status !== 'resolved') {
      // CEO confirmed a choice. Probe continues for SM; CC archives Needs-you on approve.
      b.status = 'waiting_for_owner';
    } else if (response.action === 'discuss' && b.status !== 'resolved') b.status = 'waiting_for_owner';
    b.nextCheckAt = iso(now());
    b.ownerResponse = { action: response.action, at: iso(now()), note: response.note ?? null, selectedOptionId: response.selectedOptionId ?? null };
    save(path.join(directory, `${id}.json`), b);
  }
  function start() { if (timer) return; timer = setInterval(() => { sweep().catch(() => {}); }, intervalMs); timer.unref(); return sweep(); }
  function stop() { clearInterval(timer); timer = null; }
  return { sweep, start, stop, snapshot, status, additionalCandidates, recordResponse };
}
