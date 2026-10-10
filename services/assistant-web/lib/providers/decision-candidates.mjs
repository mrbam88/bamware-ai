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
//
// CEO copy rules (bamware-ai#141): title + one-line summary on the face;
// no owner_* / ticket-id jargon in title/summary/option labels; long
// grounding stays in `context` (collapsed under Details in the UI).

export const REPO_URL = "https://github.com/mrbam88/bamware-ai";

export const DECISION_CANDIDATES = Object.freeze([
{
  "id": "auth-email-aws-access-85",
  "version": "3",
  "title": "Sign in so we can check live email setup",
  "summary": "Sign back into AWS on the laptop so agents can verify email is configured — no send, no spend.",
  "project": "Bamware shared account recovery",
  "context": "Blocker auth-email-aws-access-85; status: waiting for owner action. Checked 2026-10-03T02:21Z: X1 AWS STS returned NoCredentials; server has no AWS CLI. This is operator access, not proof that Lambda lacks permissions or email configuration. On X1 run: aws login. Complete the AWS browser sign-in for the existing Bamware account, then say done here. Do not paste credentials. Chief of Staff will recheck identity and inspect only configuration presence/sender readiness before resuming delivery verification. This does not authorize sending email or spending; a controlled recipient and explicit test consent are separate. Auth code and web work continue meanwhile.",
  "source": {
    "kind": "github-issue",
    "ref": "mrbam88/bamware-ai#85",
    "url": "https://github.com/mrbam88/bamware-ai/issues/85"
  },
  "recommendation": {
    "optionId": "access_ready",
    "rationale": "Restore the existing operator AWS session so live email configuration can be checked without moving credentials. Completion requires successful authenticated identity/configuration read, not merely clicking Done."
  },
  "options": [
    {
      "id": "access_ready",
      "action": "approve",
      "label": "I signed in — recheck"
    },
    {
      "id": "help",
      "action": "discuss",
      "label": "I need help signing in"
    },
    {
      "id": "defer",
      "action": "defer",
      "label": "Not now"
    }
  ],
  "urgency": "high",
  "owner": "Bilal Malik",
  "blockedWork": [
    "Verify deployed account-email configuration",
    "Controlled inbox test after separate consent"
  ],
  "escalationReason": "owner_access_required"
},
{
  "id": "brewdesk-first-carousel-72",
  "version": "2",
  "title": "Post BrewDesk’s first Instagram carousel?",
  "summary": "One organic post. No ads, no spend.",
  "project": "BrewDesk marketing",
  "context": "Review the five final slides and exact caption: https://app.notion.com/p/3eef2b09d2298126ad88c32d2fda14e0 . Approve ONE organic carousel on @_brew.desk from immutable asset revision 2ff6d64, save-only-v2. No ads, messages, profile changes or app-download CTA. Seven-day content-usefulness test; acquisition campaign remains pending photo-cost controls. Identity and quota checks pass; first publish/read-back and token expiry remain unverified. Approval triggers a coordination check, not automatic publishing; actual publisher pickup must be recorded.",
  "source": {
    "kind": "notion-page",
    "ref": "BrewDesk #72 first-carousel review",
    "url": "https://app.notion.com/p/3eef2b09d2298126ad88c32d2fda14e0"
  },
  "recommendation": {
    "optionId": "publish_one",
    "rationale": "Test whether people save a useful NYC laptop-work checklist before expanding the campaign."
  },
  "options": [
    {
      "id": "publish_one",
      "action": "approve",
      "label": "Yes — publish this one"
    },
    {
      "id": "revise",
      "action": "discuss",
      "label": "Discuss changes first"
    },
    {
      "id": "defer",
      "action": "defer",
      "label": "Not now"
    }
  ],
  "urgency": "low",
  "owner": "Bilal Malik",
  "blockedWork": [
    "Publish the reviewed first carousel"
  ],
  "escalationReason": "specific_publication_approval"
},
{
  "id": "brewdesk-marketing-research-72",
  "version": "2",
  "title": "Review BrewDesk marketing research",
  "summary": "Research is done. Look at the proposed Instagram test before anything publishes.",
  "project": "BrewDesk marketing",
  "context": "Completed: shared marketing skills and NYC audience/competitor research (commit ddb3009). Brief: https://github.com/mrbam88/bamware-ai/blob/main/docs/brewdesk-marketing-research-2026-10-02.md . Recommendation: one seven-day Instagram laptop-work checklist test. Ticket remains open: actual slides, measurement and destination checks remain before publishing approval. Nothing posted. Research owner: Codex; no next-stage worker pickup confirmed.",
  "source": {
    "kind": "github-issue",
    "ref": "mrbam88/bamware-ai#72",
    "url": "https://github.com/mrbam88/bamware-ai/issues/72"
  },
  "recommendation": {
    "optionId": "review_research",
    "rationale": "Review the completed evidence and proposed experiment. This card does not authorize publishing, outreach or spend."
  },
  "options": [
    {
      "id": "review_research",
      "action": "discuss",
      "label": "Discuss next step"
    },
    {
      "id": "defer",
      "action": "defer",
      "label": "Review later"
    }
  ],
  "urgency": "medium",
  "owner": "Bilal Malik",
  "blockedWork": [],
  "escalationReason": "requested_completion_handoff"
},
  {
    id: "backlog-triage-view-77",
    version: "3",
    title: "Build a backlog planning view now?",
    summary: "Decide whether agents build a triage board next, or wait.",
    project: "Bamware Assistant / Command Center",
    context:
      "Issue #77 asks for a private backlog-triage view so Bilal can filter/prioritize tickets and plan overnight batches from one place. It is explicitly intake-only today: \"not selected for tonight,\" no owner/session assigned. It depends on the same Decisions design shipped in #78 and the Agents data from #75/#76, whose initial implementation is now available.",
    source: { kind: "github-issue", ref: "mrbam88/bamware-ai#77", url: `${REPO_URL}/issues/77` },
    recommendation: {
      optionId: "defer",
      rationale: "Use Agents and Decisions for a few days first so the triage view matches real needs instead of guessing ahead.",
    },
    options: [
      { id: "select_next_batch", action: "approve", label: "Build it next" },
      { id: "defer", action: "defer", label: "Wait — use current tools first" },
      { id: "reject", action: "reject", label: "Skip it" },
    ],
    urgency: "low",
    owner: "Bilal Malik",
    blockedWork: ["Backlog planning view"],
    escalationReason: "explicit_ceo_gate",
  },
  // Owner-blocker catalog face (ledger version 2). Without a summary the UI
  // falls back to the first context sentence — technical Docker jargon on the face.
  {
    id: "auth-atomic-docker-access-85",
    version: "2",
    title: "Pick where recovery tests run",
    summary: "Choose Docker on this laptop or another approved machine. Unit tests keep going either way.",
    project: "Bamware shared account recovery",
    context:
      "Status: waiting for owner. On X1, docker ps was denied access to /var/run/docker.sock by host Docker permissions. This blocks local DynamoDB transaction integration verification only; implementation and unit tests continue. Choose either approved Docker access on X1 using your intended host policy, or explicitly reassign the integration tests to an existing Docker-capable runtime. No sudo, group change, or alternate access bypass has been attempted. Completion means the approved runtime can execute the DynamoDB integration suite and its atomicity/concurrency checks pass; unit mocks are not integration proof. CoS note: omarchy Docker is active — reassign here is a valid choice.",
    source: {
      kind: "github-issue",
      ref: "mrbam88/bamware-ai#85",
      url: "https://github.com/mrbam88/bamware-ai/issues/85",
    },
    recommendation: {
      optionId: "runtime",
      rationale: "Use an already approved Docker-capable runtime if available; do not silently grant root-equivalent daemon access.",
    },
    options: [
      { id: "runtime", action: "approve", label: "Use approved test machine" },
      { id: "access", action: "approve", label: "I fixed laptop Docker — recheck" },
      { id: "defer", action: "defer", label: "Defer integration tests" },
    ],
    urgency: "medium",
    owner: "Bilal Malik",
    blockedWork: ["DynamoDB atomic-reset integration verification for #85"],
    escalationReason: "owner_runtime_access_required",
  },
]);
