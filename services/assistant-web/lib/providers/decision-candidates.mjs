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
    version: "1",
    title: "Select #77 (backlog triage / Command Center view) for a future batch, or keep it backlog-only?",
    project: "Bamware Assistant / Command Center",
    context:
      "Issue #77 asks for a private backlog-triage view so Bilal can filter/prioritize tickets and plan overnight batches from one place. It is explicitly intake-only today: \"not selected for tonight,\" no owner/session assigned. It depends on the same Decisions design shipped in #78 and the Agents data from #75/#76, which landed in this same overnight batch.",
    source: { kind: "github-issue", ref: "mrbam88/bamware-ai#77", url: `${REPO_URL}/issues/77` },
    recommendation: {
      optionId: "defer",
      rationale: "#75/#76/#78 just shipped in the same batch; using them for a few days first will shape what #77's triage view actually needs instead of guessing ahead of it.",
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
  {
    id: "langfuse-docker-enable-65",
    version: "1",
    title: "Run the two sudo commands that unblock self-hosted Langfuse",
    project: "Assistant website / Observability (#65)",
    context:
      "services/langfuse is fully built and reviewed (compose pinned, up.sh/connect-hermes.sh/verify.sh scripts, secrets already generated), but it cannot start: docker.service is inactive, bilal is not in the docker group, and systemctl start docker is refused by polkit without a password. No agent session holds sudo, so this is strictly a founder action. Until it's done, the website's Langfuse plugin stays enabled but inert (fail-open, zero traces recorded).",
    source: { kind: "doc", ref: "docs/assistant-website.md § Langfuse", url: `${REPO_URL}/blob/main/docs/assistant-website.md` },
    recommendation: {
      optionId: "approve",
      rationale: "Everything else is already implemented and verified; the only remaining gap is two commands only Bilal can run.",
    },
    options: [
      { id: "approve", label: "Run: sudo systemctl enable --now docker && sudo usermod -aG docker bilal, then re-login" },
      { id: "defer", label: "Defer — leave Langfuse stopped for now" },
      { id: "discuss", label: "Discuss — consider a different Langfuse hosting approach" },
    ],
    urgency: "medium",
    owner: "Bilal Malik",
    blockedWork: ["#65 Langfuse trace ingestion end-to-end", "Observability for every website/CLI turn"],
    escalationReason: "explicit_ceo_gate",
  },
  {
    id: "tailnet-https-certs-66",
    version: "1",
    title: "Enable Tailscale HTTPS certs so browser voice works on iPhone",
    project: "Assistant website / Voice (#66)",
    context:
      "Browser voice (STT/TTS) needs a secure context. It already works on the laptop via an SSH tunnel to localhost. iPhone access needs HTTPS on the tailnet, and `tailscale cert` currently fails with \"your Tailscale account does not support getting TLS certs.\" The fix is a toggle on the Tailscale admin console's DNS page — an account-level setting no agent session can reach.",
    source: { kind: "doc", ref: "docs/assistant-website.md § Network and deployment", url: `${REPO_URL}/blob/main/docs/assistant-website.md` },
    recommendation: {
      optionId: "approve",
      rationale: "One admin-console toggle unlocks iPhone voice with no new infrastructure or spend.",
    },
    options: [
      { id: "approve", label: "Enable HTTPS certs on the tailnet admin console, then bind to 127.0.0.1 and run tailscale serve --https" },
      { id: "defer", label: "Defer — laptop-only voice is enough for now" },
    ],
    urgency: "low",
    owner: "Bilal Malik",
    blockedWork: ["#66 browser voice on iPhone"],
    escalationReason: "explicit_ceo_gate",
  },
]);
