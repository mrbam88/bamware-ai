// Command Center Decisions card MVP (bamware-ai#78). Reuses the CEO Decision
// Queue design in docs/bamware-agent-operating-system-prd.md: a small set of
// explicit, source-backed decision candidates -> a durable, versioned CEO
// response -> a handoff record kept separate from that response.
//
// Hard rules encoded here, matching the #75/#76 contract style:
// - Candidates are an explicit curated list, never "every open issue".
// - A response is only ever durable (file-backed), never a chat message.
// - Approving never performs a consequential action itself; it only
//   *records* an approval and attempts a handoff. With no confirmed live
//   worker interface, the handoff honestly stays "handoff_pending" forever
//   — it must never be reported as picked up or completed without evidence
//   from an actual worker call.
// - A stale candidateVersion (the source decision changed) is rejected
//   outright; the caller must re-fetch and reconsider, not silently proceed.
// - Resubmitting the same action with the same inputs is idempotent: it
//   returns the existing record and never re-dispatches a second handoff.

import { loadDecisionStore, saveDecisionStore } from "./decision-store.mjs";

export const DECISION_CONTRACT_VERSION = "1";

/** @type {readonly string[]} */
export const DECISION_ACTIONS = Object.freeze(["approve", "reject", "discuss", "defer"]);

/**
 * "not_applicable": reject/discuss/defer never dispatch a handoff.
 * "handoff_pending": approved, but no confirmed live worker interface
 *   accepted it (the honest default — never upgraded without evidence).
 * "pickup_confirmed": a worker adapter actually accepted the handoff.
 * "completed": a worker adapter actually reported the work done, on a
 *   later check — never inferred from a comment/label change.
 * @type {readonly string[]}
 */
export const HANDOFF_STATUSES = Object.freeze(["not_applicable", "handoff_pending", "pickup_confirmed", "completed"]);

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Validates a candidate definition's shape; throws on a malformed built-in candidate (programmer error, not user input). */
export function assertValidCandidate(c) {
  const problems = [];
  if (!isNonEmptyString(c?.id)) problems.push("id is required");
  if (!isNonEmptyString(c?.version)) problems.push("version is required");
  if (!isNonEmptyString(c?.title)) problems.push("title is required");
  if (!isNonEmptyString(c?.context)) problems.push("context is required");
  if (c?.summary != null && !isNonEmptyString(c.summary)) problems.push("summary, when present, must be a non-empty string");
  if (!c?.source || !isNonEmptyString(c.source.kind) || !isNonEmptyString(c.source.ref)) problems.push("source.kind and source.ref are required");
  if (!Array.isArray(c?.options) || c.options.length === 0) problems.push("options must be a non-empty array");
  else if (c.options.some((o) => !isNonEmptyString(o?.id) || !isNonEmptyString(o?.label))) problems.push("every option needs id and label");
  if (!["low", "medium", "high"].includes(c?.urgency)) problems.push("urgency must be low|medium|high");
  if (!isNonEmptyString(c?.owner)) problems.push("owner is required");
  if (!Array.isArray(c?.blockedWork)) problems.push("blockedWork must be an array (may be empty)");
  if (problems.length) throw new Error(`Invalid decision candidate "${c?.id ?? "?"}": ${problems.join("; ")}`);
  return c;
}

/** Merges a static candidate definition with its stored response (if any) into one display object. Pure. */
export function reconcileDecision(candidate, stored) {
  if (!stored || !stored.current) {
    return { ...candidate, response: null, stale: false, handoff: { status: "not_applicable" } };
  }
  const stale = stored.candidateVersion !== candidate.version;
  const { signature: _signature, ...current } = stored.current;
  return {
    ...candidate,
    response: { action: current.action, selectedOptionId: current.selectedOptionId, note: current.note, decidedAt: current.decidedAt, actor: current.actor },
    stale,
    handoff: current.handoff,
  };
}

/** Explicit evidence retires one ask, never its entire parent project.
 * Tombstones are keyed by immutable ask ID: a genuinely new ask needs a new ID.
 * No response, issue-closed flag, or missing source implies resolution.
 */
export function decisionResolution(candidate, { resolutions = {}, blockers = {} } = {}) {
  const resolution = resolutions[candidate.id];
  if (['resolved', 'superseded'].includes(resolution?.status)
      && isNonEmptyString(resolution.reason) && isNonEmptyString(resolution.evidence?.ref)
      && Number.isFinite(Date.parse(resolution.verifiedAt))) return resolution;
  const blocker = blockers[candidate.id];
  if (blocker?.id === candidate.id && blocker.candidateVersion === candidate.version
      && blocker.status === 'resolved' && isNonEmptyString(blocker.resolutionEvidence?.ref)
      && Number.isFinite(Date.parse(blocker.resolvedAt))) {
    return { status: 'resolved', reason: 'This specific blocker has verified resolution evidence. Downstream work is tracked separately.', evidence: blocker.resolutionEvidence, verifiedAt: blocker.resolvedAt };
  }
  return null;
}

/** Builds the full /api/decisions list payload. Pure given an already-loaded store. */
export function buildDecisionsSnapshot(candidates, store, opts = {}) {
  const now = opts.now ?? Date.now();
  for (const c of candidates) assertValidCandidate(c);
  const decisions = [], history = [];
  for (const candidate of candidates) {
    const decision = reconcileDecision(candidate, store.responses[candidate.id]);
    const resolution = decisionResolution(candidate, opts);
    if (resolution) history.push({ ...decision, resolution });
    else decisions.push(decision);
  }
  return {
    version: DECISION_CONTRACT_VERSION,
    generatedAt: new Date(now).toISOString(),
    decisions, history,
  };
}

export class StaleDecisionError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
    this.code = "stale_decision";
  }
}
export class InvalidDecisionResponseError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = "invalid_decision_response";
  }
}
function validateResponsePayload(candidate, payload) {
  if (!payload || typeof payload !== "object") throw new InvalidDecisionResponseError("Body must be a JSON object.");
  if (!DECISION_ACTIONS.includes(payload.action)) throw new InvalidDecisionResponseError(`action must be one of ${DECISION_ACTIONS.join(", ")}.`);
  if (!isNonEmptyString(payload.candidateVersion)) throw new InvalidDecisionResponseError("candidateVersion is required (send the version shown with the decision).");
  if (payload.candidateVersion !== candidate.version) {
    throw new StaleDecisionError("This decision's source has changed since you loaded it. Reload and reconsider before responding.");
  }
  let selectedOptionId = null;
  if (payload.selectedOptionId != null) {
    if (!isNonEmptyString(payload.selectedOptionId)) throw new InvalidDecisionResponseError("selectedOptionId must be a string.");
    if (!candidate.options.some((o) => o.id === payload.selectedOptionId)) throw new InvalidDecisionResponseError("selectedOptionId is not one of this decision's options.");
    const option = candidate.options.find(o => o.id === payload.selectedOptionId);
    if (option.action && option.action !== payload.action) throw new InvalidDecisionResponseError("Selected option does not authorize that action.");
    selectedOptionId = payload.selectedOptionId;
  }
  if (payload.action === "approve" && selectedOptionId == null) throw new InvalidDecisionResponseError("approve requires selectedOptionId.");
  const note = payload.note != null ? (isNonEmptyString(payload.note) ? payload.note.trim().slice(0, 2000) : null) : null;
  return { action: payload.action, selectedOptionId, note };
}

function signatureOf({ action, selectedOptionId, note, candidateVersion }) {
  return JSON.stringify({ action, selectedOptionId, note, candidateVersion });
}

/**
 * Attempts a handoff for an approved decision. `worker` is optional:
 * {dispatch({candidate, entry}) -> {status:"accepted", receiptId, acceptedAt?, note?} | {status:"unavailable", reason?}}.
 * A missing worker, a thrown error, or an explicit "unavailable" all collapse
 * to the same honest "handoff_pending" outcome — never silently promoted.
 */
async function dispatchHandoff(worker, candidate, entry) {
  if (!worker || typeof worker.dispatch !== "function") {
    return { status: "handoff_pending", reason: "No confirmed live worker interface exists for automated handoff execution.", checkedAt: new Date().toISOString() };
  }
  try {
    const res = await worker.dispatch({ candidate, entry });
    if (res && res.status === "accepted" && isNonEmptyString(res.receiptId)) {
      return { status: "pickup_confirmed", receiptId: res.receiptId, acceptedAt: res.acceptedAt ?? new Date().toISOString(), note: res.note ?? null };
    }
    return { status: "handoff_pending", reason: (res && res.reason) || "Worker reported it could not accept the handoff.", checkedAt: new Date().toISOString() };
  } catch (err) {
    return { status: "handoff_pending", reason: `Worker error: ${err.message}`, checkedAt: new Date().toISOString() };
  }
}

/**
 * Records a durable response to a decision and (only for "approve") attempts
 * a handoff. Reads and writes the file-backed store synchronously around the
 * decision so a restart/reload always sees the latest state.
 */
export async function respondToDecision(storeFilePath, candidate, payload, { worker, now = Date.now(), actor = "owner" } = {}) {
  assertValidCandidate(candidate);
  const { action, selectedOptionId, note } = validateResponsePayload(candidate, payload);
  const store = loadDecisionStore(storeFilePath);
  const existing = store.responses[candidate.id];
  const signature = signatureOf({ action, selectedOptionId, note, candidateVersion: candidate.version });

  if (existing && existing.current && existing.current.signature === signature) {
    // Idempotent duplicate: identical resubmission of the current response.
    // Never re-dispatch — that would risk a second handoff for one approval.
    return { decision: reconcileDecision(candidate, existing), duplicate: true };
  }

  const entry = {
    action,
    selectedOptionId,
    note,
    actor,
    decidedAt: new Date(now).toISOString(),
    signature,
    handoff: { status: "not_applicable" },
  };
  if (action === "approve") {
    entry.handoff = await dispatchHandoff(worker, candidate, entry);
  }

  const history = existing ? [...existing.history, entry] : [entry];
  store.responses[candidate.id] = { candidateVersion: candidate.version, history, current: entry };
  saveDecisionStore(storeFilePath, store);

  return { decision: reconcileDecision(candidate, store.responses[candidate.id]), duplicate: false };
}

/**
 * Re-checks a previously-dispatched handoff against the worker (e.g. a
 * fixture worker that later reports completion). A no-op if there is no
 * receipt to check, or no worker — handoff_pending never self-promotes.
 */
export async function refreshHandoff(storeFilePath, candidate, { worker, now = Date.now() } = {}) {
  const store = loadDecisionStore(storeFilePath);
  const record = store.responses[candidate.id];
  if (!record || !record.current || record.current.handoff.status !== "pickup_confirmed") {
    return { decision: reconcileDecision(candidate, record), refreshed: false };
  }
  if (!worker || typeof worker.checkStatus !== "function") {
    return { decision: reconcileDecision(candidate, record), refreshed: false };
  }
  const receiptId = record.current.handoff.receiptId;
  let result;
  try {
    result = await worker.checkStatus(receiptId);
  } catch (err) {
    return { decision: reconcileDecision(candidate, record), refreshed: false, error: err.message };
  }
  if (!result || result.status !== "completed") {
    return { decision: reconcileDecision(candidate, record), refreshed: false };
  }
  const updatedEntry = {
    ...record.current,
    handoff: { ...record.current.handoff, status: "completed", completedAt: result.completedAt ?? new Date(now).toISOString(), evidence: result.evidence ?? null },
  };
  record.current = updatedEntry;
  record.history = [...record.history.slice(0, -1), updatedEntry];
  store.responses[candidate.id] = record;
  saveDecisionStore(storeFilePath, store);
  return { decision: reconcileDecision(candidate, record), refreshed: true };
}
