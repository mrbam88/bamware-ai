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
  "id": "auth-email-aws-access-85",
  "version": "1",
  "title": "Action needed: enable live account-email verification",
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
      "action": "discuss",
      "label": "I signed in \u2014 recheck access"
    },
    {
      "id": "help",
      "action": "discuss",
      "label": "I need help with AWS sign-in"
    },
    {
      "id": "defer",
      "action": "defer",
      "label": "Defer live-email verification"
    }
  ],
  "urgency": "high",
  "owner": "Bilal Malik",
  "blockedWork": [
    "Verify deployed account-email configuration for #85",
    "Controlled inbox verification after separate test consent"
  ],
  "escalationReason": "owner_access_required"
},
{
  "id": "brewdesk-first-carousel-72",
  "version": "1",
  "title": "Approve BrewDesk\u2019s first checklist carousel",
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
      "label": "Approve publishing this one carousel"
    },
    {
      "id": "revise",
      "action": "discuss",
      "label": "Discuss changes before publishing"
    },
    {
      "id": "defer",
      "action": "defer",
      "label": "Defer publishing"
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
  "version": "1",
  "title": "BrewDesk #72: research complete \u2014 review the proposed experiment",
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
      "label": "Discuss the research and next step"
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
