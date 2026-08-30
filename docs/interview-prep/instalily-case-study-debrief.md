# InstaLILY case study — debrief

_Written 2026-08-28, the day after submission, upon advancing to the final round. This is the postmortem of the whole case-study round: what the assessment really was, what the research got right and wrong, and the process lessons. Onsite: Wed Sept 2, 12–3 PM, 455 Broadway._

## Outcome

**Passed.** Submitted the case study on 8/27 within the 4-hour window; invited to the final round onsite the next day. Loop so far: recruiter screen (8/20) → first-round call with Sean (8/24) → case study (8/27) → onsite (9/2, final round).

## What the assessment actually was (record this — it's not public anywhere)

Not the PartSelect chat-agent build every public submission shows. A **new mobile variant**:

- A small **React Native (Expo, TypeScript) work-order app** for warehouse field technicians: paginated order list from a stubbed backend with latency, pagination, and ~30% random write failures.
- **Task 1: PR review.** Treat the code as a junior engineer's PR; leave comments in the code with severity and reasoning, GitHub-review style.
- **Task 2: one small feature.** "Mark Complete" with optimistic update and rollback on failure; graceful degradation against the 30% write failures.
- **Task 3: three questions.** What you fixed/flagged and in what priority order; where the app breaks in real warehouses; what you'd cut to stay in scope.
- **`submissions.md` must be hand-written — AI generation explicitly forbidden for that file.** LLMs otherwise allowed, with an explicit warning: you defend everything in a follow-up round.
- Graded on: review judgment for a junior, mobile-production awareness, communication. Stated outright: "we would rather see fully fleshed out reasoning behind a tradeoff than a perfectly working demo app."
- Repo shared with five collaborators: iris@, victor@, bill@, sean@, **and nick@** (the senior mobile engineer).
- Starter delivered as a Google Drive zip; deadline enforced by the portal (4 hours, hard timestamp).

## Prediction scorecard — what the research got right and wrong

| Prediction (from 3 research rounds) | Result |
|---|---|
| 4-hour timed format, portal-tracked | ✅ Exact |
| Graders = iris/victor/bill, peer engineers who run it first | ✅ Plus sean and nick |
| Warehouse / field-technician domain, flaky connectivity as the core theme | ✅ Exact — the 30% write failures ARE the "spotty warehouse Wi-Fi" |
| Optimistic update + rollback would matter (Mock B's whole premise) | ✅ It was literally the feature |
| LLM use allowed, with disclosure/defense expected | ✅ Stated in the assessment, including a follow-up defense round |
| A presentation/defense round follows the case study | ✅ Final round scheduled |
| Reasoning valued over demo polish | ✅ Stated verbatim |
| **The task: PartSelect chat-agent web build (2:1 odds)** | ❌ It was a React Native **PR-review exercise**, a variant with zero public trace |
| Nick not involved (not on the invite email) | ❌ He's a collaborator on the repo |
| Agent/LLM feature would be the core of the build | ❌ No AI feature at all — pure mobile engineering judgment |

**The meta-lesson:** research nails the *frame* (format, graders, values, domain) but the company can swap the *task*. Prep the transferable layer — judgment, offline patterns, optimistic updates, review communication — not the specific prompt. Mock B (field-tech app, outbox, optimistic rollback, 30% failure handling) was the prep that transferred; the PartSelect-specific work (seed data, chat agent) did not, and pre-building it would have been wasted anyway. The fairness line held on its own.

**Also true:** the AI-engineering crash course wasn't wasted either — the follow-up round explicitly requires defending LLM use, and the company's product context (InstaCoach, field service, hybrid routing) is exactly what the onsite conversation will touch.

## Process lessons (repo-worthy)

1. **Cowork for research, CLI for code and repo writes.** Three parallel research fan-outs (14 repos cloned, every Glassdoor page, the company's own pages) took ~10 minutes each in Cowork and would have been an afternoon in a terminal. Everything that touches git belongs in Claude Code CLI.
2. **The 20-minute write-back incident.** Pushing ~180KB of docs through the GitHub API from Cowork (re-sending every byte) took 20 minutes and burned trust. Rule now in preferences: give a time estimate before anything over ~2 minutes; large repo writes are handed over as files for native git; the connector is for small commits only.
3. **Stale-cache incident, again.** An early WebFetch returned a summarized/old AGENTS.md, so the session initially missed that AGENTS.md already mandates the Composio write path ("this mistake cost a session on 2026-08-18" — and then cost part of this one). Fetch raw bytes or clone; never trust a summarizing fetch for context files.
4. **Plain words win.** Mid-session feedback: define every term, no jargon ("assessment" not "brief"), heavy code documentation so unfamiliar patterns don't read as code smells. This produced the documentation standard now baked into the take-home-assessment skill — and it's also just good submission practice, since graders (human or AI-assisted) read the README first.
5. **Hand-written deliverables are becoming a rule.** InstaLILY forbade AI on `submissions.md`. Expect this pattern everywhere: the writing-by-hand portion is the judgment test. Budget real time for it (an hour of the four).

## For the onsite (Wed Sept 2, 12–3 PM)

- Three hours ≈ multiple sessions. Near-certain: defending the case study line by line (review comments, Mark Complete tradeoffs, LLM use) — Nick likely in the room. Possible: live pairing or a design conversation; a founder/values conversation ("Why Instalily" — asked at every stage on record).
- Prep from the actual submission: walk the repo cold, re-justify every severity call, the "rate it 1–10" answer with reasons, what you'd do with a week, the on-device-inference paragraph, and the two negotiation levers (the "Senior" title and the real hybrid policy — comp figure in the `interviews` tracker).
- Morning-of ritual per medal-deepdive-debrief.md: 20 minutes in their product/site, questions on paper, one out-loud rep.

## Where everything lives

- Procedure: `take-home-assessment` skill (+ run-prompt template).
- Study docs: docs/interview-prep/ — instalily-case-study-playbook.md, instalily-case-study-research.md, ai-basics-for-mobile-devs.md, this debrief.
- Not yet committed from the prep session: the two mock assessments (instalily-mock-a-partselect.md, instalily-mock-b-field-tech.md — listed in the index but pending), the `interviews` tracker record for InstaLILY, and the interviews README fix. Commit from CLI when convenient.
- Application status: `interviews` → tracker/applications/ (comp and personal details live there, not here).
