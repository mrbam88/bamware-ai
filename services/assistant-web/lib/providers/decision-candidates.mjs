// Explicit, hand-curated Decisions candidates (bamware-ai#78). Per the
// issue's scope ("explicit decision candidates rather than unbounded
// autonomous extraction"), this is a small fixed list, not an extraction
// over every open issue. Each candidate is grounded in something already
// read and verified in this repo (an issue or a doc section) — no invented
// context, numbers, or blockers. source.kind is "github-issue" or "doc" so
// the UI never confuses these with the synthetic fixtures used for the
// lifecycle tests (lib/providers/decision-candidates-demo-fixtures.mjs).
//
// Bump a candidate's `version` whenever its context/options materially
// change; a stored response pinned to an older version is flagged stale and
// must be reconsidered before any further action (see lib/decisions.mjs).

export const REPO_URL = "https://github.com/mrbam88/bamware-ai";

export const DECISION_CANDIDATES = Object.freeze([
  {
    id: "backlog-triage-view-77",
    version: "2",
    title: "Select #77 (backlog triage / Command Center view) for a future batch, or keep it backlog-only?",
    project: "Bamware Assistant / Command Center",
    context:
      "Issue #77 asks for a private backlog-triage view so Bilal can filter/prioritize tickets and plan overnight batches from one place. It is explicitly intake-only today: \"not selected for tonight,\" no owner/session assigned. It depends on the same Decisions design shipped in #78 and the Agents data from #75/#76, whose initial implementation is now available.",
    source: { kind: "github-issue", ref: "mrbam88/bamware-ai#77", url: `${REPO_URL}/issues/77` },
    recommendation: {
      optionId: "defer",
      rationale: "#75/#76/#78 have initial implementations; using them for a few days first will shape what #77's triage view actually needs instead of guessing ahead of it.",
    },
    options: [
      { id: "select_next_batch", label: "Select #77 for the next overnight batch" },
      { id: "defer", label: "Defer — revisit after using #75/#76/#78" },
      { id: "reject", label: "Reject — not worth building" },
    ],
    urgency: "low",
    owner: "Bilal Malik",
    blockedWork: ["#77 backlog triage view implementation"],
    escalationReason: "explicit_ceo_gate",
  },
]);
