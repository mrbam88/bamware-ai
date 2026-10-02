import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DECISION_CONTRACT_VERSION,
  assertValidCandidate,
  reconcileDecision,
  buildDecisionsSnapshot,
  respondToDecision,
  refreshHandoff,
  StaleDecisionError,
  InvalidDecisionResponseError,
} from "../lib/decisions.mjs";
import { loadDecisionStore } from "../lib/decision-store.mjs";
import { DECISION_CANDIDATES } from "../lib/providers/decision-candidates.mjs";
import {
  DEMO_DECISION_CANDIDATES,
  demoDecisionCandidates,
  fixtureWorkerUnavailable,
  makeFixtureWorkerAccepting,
} from "../lib/providers/decision-candidates-demo-fixtures.mjs";

function tmpStoreFile() {
  const dir = mkdtempSync(path.join(tmpdir(), "aw-decisions-"));
  return path.join(dir, "decisions.json");
}

const CANDIDATE = DEMO_DECISION_CANDIDATES[0];

test("real decision candidates are all well-formed and explicitly sourced", () => {
  assert.ok(DECISION_CANDIDATES.length >= 1);
  for (const c of DECISION_CANDIDATES) {
    assertValidCandidate(c);
    assert.notEqual(c.source.kind, "synthetic");
    assert.ok(c.source.ref);
  }
});

test("demo candidates are always tagged synthetic even if a fixture forgets", () => {
  const stripped = { ...CANDIDATE, source: { kind: "live", ref: "oops" } };
  const [c] = [stripped].map((x) => ({ ...x, source: { ...x.source, kind: "synthetic" } }));
  assert.equal(c.source.kind, "synthetic");
  for (const c2 of demoDecisionCandidates()) assert.equal(c2.source.kind, "synthetic");
});

test("reconcileDecision: no stored response is pending with not_applicable handoff", () => {
  const d = reconcileDecision(CANDIDATE, undefined);
  assert.equal(d.response, null);
  assert.equal(d.stale, false);
  assert.equal(d.handoff.status, "not_applicable");
});

test("buildDecisionsSnapshot carries contract version and reconciles every candidate", () => {
  const snapshot = buildDecisionsSnapshot(demoDecisionCandidates(), { responses: {} });
  assert.equal(snapshot.version, DECISION_CONTRACT_VERSION);
  assert.equal(snapshot.decisions.length, demoDecisionCandidates().length);
  assert.equal(snapshot.decisions[0].response, null);
});

test("reject/discuss/defer never dispatch a handoff, even with a worker configured", async () => {
  const file = tmpStoreFile();
  const worker = makeFixtureWorkerAccepting();
  let dispatched = false;
  const spyWorker = { dispatch: async (...a) => { dispatched = true; return worker.dispatch(...a); }, checkStatus: worker.checkStatus };
  const { decision } = await respondToDecision(file, CANDIDATE, { action: "defer", candidateVersion: CANDIDATE.version }, { worker: spyWorker });
  assert.equal(decision.handoff.status, "not_applicable");
  assert.equal(dispatched, false);
});

test("approve with no worker configured (the real default) honestly reports handoff_pending, never completed", async () => {
  const file = tmpStoreFile();
  const { decision } = await respondToDecision(
    file,
    CANDIDATE,
    { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: CANDIDATE.version },
    { worker: undefined },
  );
  assert.equal(decision.handoff.status, "handoff_pending");
  assert.match(decision.handoff.reason, /no confirmed live worker/i);
});

test("approve against an unavailable fixture worker also reports handoff_pending with the worker's reason", async () => {
  const file = tmpStoreFile();
  const { decision } = await respondToDecision(
    file,
    CANDIDATE,
    { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: CANDIDATE.version },
    { worker: fixtureWorkerUnavailable },
  );
  assert.equal(decision.handoff.status, "handoff_pending");
  assert.match(decision.handoff.reason, /SYNTHETIC/);
});

test("approve against an accepting fixture worker proves pickup_confirmed -> completed via refreshHandoff", async () => {
  const file = tmpStoreFile();
  const worker = makeFixtureWorkerAccepting();
  const first = await respondToDecision(
    file,
    CANDIDATE,
    { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: CANDIDATE.version },
    { worker },
  );
  assert.equal(first.decision.handoff.status, "pickup_confirmed");
  assert.ok(first.decision.handoff.receiptId);

  const refreshed = await refreshHandoff(file, CANDIDATE, { worker });
  assert.equal(refreshed.refreshed, true);
  assert.equal(refreshed.decision.handoff.status, "completed");
  assert.ok(refreshed.decision.handoff.evidence);
});

test("durable response survives a reload of the store from disk (restart simulation)", async () => {
  const file = tmpStoreFile();
  await respondToDecision(file, CANDIDATE, { action: "reject", selectedOptionId: CANDIDATE.options[1].id, candidateVersion: CANDIDATE.version }, {});
  // Simulate a process restart: nothing in memory, just the file path.
  const reloaded = loadDecisionStore(file);
  const decision = reconcileDecision(CANDIDATE, reloaded.responses[CANDIDATE.id]);
  assert.equal(decision.response.action, "reject");
  assert.equal(decision.response.selectedOptionId, CANDIDATE.options[1].id);
});

test("duplicate submission of the identical response is idempotent: no second handoff dispatch", async () => {
  const file = tmpStoreFile();
  let dispatchCount = 0;
  const worker = {
    dispatch: async () => {
      dispatchCount += 1;
      return { status: "accepted", receiptId: `r-${dispatchCount}` };
    },
  };
  const payload = { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: CANDIDATE.version };
  const first = await respondToDecision(file, CANDIDATE, payload, { worker });
  assert.equal(first.duplicate, false);
  assert.equal(dispatchCount, 1);

  const second = await respondToDecision(file, CANDIDATE, payload, { worker });
  assert.equal(second.duplicate, true);
  assert.equal(dispatchCount, 1, "a duplicate submission must not re-dispatch a handoff");
  assert.equal(second.decision.handoff.receiptId, first.decision.handoff.receiptId);
});

test("changing the action after a prior response is a legitimate reconsideration, not a duplicate", async () => {
  const file = tmpStoreFile();
  await respondToDecision(file, CANDIDATE, { action: "defer", candidateVersion: CANDIDATE.version }, {});
  const { decision, duplicate } = await respondToDecision(
    file,
    CANDIDATE,
    { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: CANDIDATE.version },
    {},
  );
  assert.equal(duplicate, false);
  assert.equal(decision.response.action, "approve");
});

test("a stale candidateVersion is rejected (409) and never silently applied", async () => {
  const file = tmpStoreFile();
  const bumped = { ...CANDIDATE, version: "2" };
  await assert.rejects(
    () => respondToDecision(file, bumped, { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: "1" }, {}),
    (err) => {
      assert.ok(err instanceof StaleDecisionError);
      assert.equal(err.status, 409);
      return true;
    },
  );
  const store = loadDecisionStore(file);
  assert.equal(store.responses[CANDIDATE.id], undefined);
});

test("a decision answered under an older candidate version is flagged stale on reconciliation", async () => {
  const file = tmpStoreFile();
  await respondToDecision(file, CANDIDATE, { action: "defer", candidateVersion: CANDIDATE.version }, {});
  const store = loadDecisionStore(file);
  const bumped = { ...CANDIDATE, version: "2" };
  const decision = reconcileDecision(bumped, store.responses[CANDIDATE.id]);
  assert.equal(decision.stale, true);
});

test("approve without selectedOptionId is rejected as invalid, not silently defaulted", async () => {
  const file = tmpStoreFile();
  await assert.rejects(
    () => respondToDecision(file, CANDIDATE, { action: "approve", candidateVersion: CANDIDATE.version }, {}),
    (err) => err instanceof InvalidDecisionResponseError,
  );
});

test("an unknown action is rejected", async () => {
  const file = tmpStoreFile();
  await assert.rejects(
    () => respondToDecision(file, CANDIDATE, { action: "yolo", candidateVersion: CANDIDATE.version }, {}),
    (err) => err instanceof InvalidDecisionResponseError,
  );
});

test("a worker that throws is treated as unavailable, not as a server error", async () => {
  const file = tmpStoreFile();
  const worker = { dispatch: async () => { throw new Error("ECONNREFUSED"); } };
  const { decision } = await respondToDecision(
    file,
    CANDIDATE,
    { action: "approve", selectedOptionId: CANDIDATE.options[0].id, candidateVersion: CANDIDATE.version },
    { worker },
  );
  assert.equal(decision.handoff.status, "handoff_pending");
  assert.match(decision.handoff.reason, /Worker error: ECONNREFUSED/);
});
