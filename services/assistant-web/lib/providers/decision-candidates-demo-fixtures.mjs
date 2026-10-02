// Synthetic Decisions fixtures (bamware-ai#78): one decision deck plus two
// fixture "worker" adapters, used only to prove the response/handoff
// lifecycle end to end (recorded -> handoff_pending|pickup_confirmed ->
// completed) without any real worker interface. Always clearly labeled
// (source.kind: "synthetic", obviously-fictional ids/content) so these can
// never be mistaken for the real candidates in decision-candidates.mjs.

export const DEMO_DECISION_CANDIDATES = Object.freeze([
  {
    id: "demo-reservations-partner",
    version: "1",
    title: "[SYNTHETIC] BrewDesk wants native reservations — build or integrate a partner?",
    project: "BrewDesk (demo)",
    context: "Demo fixture from the PRD's own worked example: BrewDesk (a hypothetical client) asked for a reservations feature.",
    source: { kind: "synthetic", ref: "fixture:demo-reservations-partner", url: null },
    recommendation: { optionId: "integrate_partner", rationale: "Demo: a partner integration ships faster with lower maintenance than a native build." },
    options: [
      { id: "build_native", label: "A. Build native reservations" },
      { id: "integrate_partner", label: "B. Integrate a partner" },
      { id: "defer_feature", label: "C. Defer" },
    ],
    urgency: "medium",
    owner: "Demo Owner",
    blockedWork: ["demo: BrewDesk reservations epic"],
    escalationReason: "high_impact",
  },
]);

/** Always tagged synthetic regardless of caller, same safety rule as the rate-limit/work-usage demo adapters. */
export function demoDecisionCandidates() {
  return DEMO_DECISION_CANDIDATES.map((c) => ({ ...c, source: { ...c.source, kind: "synthetic" } }));
}

/** A worker that always reports it cannot accept the handoff — the default, honest outcome with no live worker interface. */
export const fixtureWorkerUnavailable = {
  async dispatch() {
    return { status: "unavailable", reason: "[SYNTHETIC] fixture worker is intentionally unavailable for this test." };
  },
  async checkStatus() {
    return { status: "unavailable" };
  },
};

/** A worker that accepts a handoff, then reports completion on a later check — proves the full lifecycle exists in code. */
export function makeFixtureWorkerAccepting({ receiptPrefix = "demo-receipt" } = {}) {
  let counter = 0;
  const receipts = new Map();
  return {
    async dispatch({ candidate }) {
      counter += 1;
      const receiptId = `${receiptPrefix}-${candidate.id}-${counter}`;
      receipts.set(receiptId, { completed: false });
      return { status: "accepted", receiptId, acceptedAt: new Date().toISOString(), note: "[SYNTHETIC] fixture worker accepted the handoff." };
    },
    async checkStatus(receiptId) {
      const r = receipts.get(receiptId);
      if (!r) return { status: "unknown" };
      // Simulate work finishing by the time it's checked.
      r.completed = true;
      return { status: "completed", completedAt: new Date().toISOString(), evidence: { kind: "synthetic", receiptId } };
    },
  };
}
