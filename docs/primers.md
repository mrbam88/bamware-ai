# Primers — how we engineer together

**Principle (Bilal, 2026-10-24, after reading the BrewDesk Cloud Primer: "I'm in
love... this is our new way to communicate... new first principle"):** when a
piece of work carries a decision about money, scale, reliability, security or
architecture, the agent doing it publishes a **primer**: a short, readable page
that teaches the CEO what he needs to know to decide, then records the decision.
Chat is for steering; the primer is where we think together.

First one: [BrewDesk Cloud Primer](https://claude.ai/artifact/Qbpye7fBG2vmAnjjXUk9AG)
(2026-10-24). Second: the Discord router design page
(https://claude.ai/artifact/XDqEyLndAJuavvi6sD69fA, 2026-10-20).
Third and fourth (2026-10-25, study pages for Bilal's AI-engineering pivot):
[AI Engineering Primer](https://claude.ai/artifact/NboNzEuhXTW3FJBYapQwwQ) (evals,
guardrails, traces, structured output, with mobile analogies and a self-test) and
[How Bamware Works](https://claude.ai/artifact/1RVSQUexbApdSkKM698a6m) (architecture
in plain words plus a file-level scorecard of which of those practices exist in
the code: guardrails, tools and human-in-the-loop present; evals, traces,
structured output, rollout and privacy partial; model-accuracy evals absent).
Fifth (2026-10-26): [Connectors vs Local Tools](https://claude.ai/artifact/PSW9i9ABk6WyRFJBXrjNsh)
(native tools first on the CLIs, Composio last resort rather than banned;
measured per-session token cost of attached connectors; two one-word
decisions on the Discord seat and account-synced plugins).
Sixth (2026-10-28): [BrewDesk Chat Primer](https://claude.ai/artifact/Y7h3uGgshKuu3YycQXRvuV)
(a grounded cafe chatbot: server-side Claude call through a new engine endpoint,
tool use over the existing venue search, Haiku 5.5 at about $0.001 a turn, prepaid
credit with auto-reload off as the hard cap; four one-word decisions before tickets).

## When to write one

- Any hosting, vendor, database, or infrastructure choice.
- Any spend above $0, any new account, any change to how production runs.
- Any plan with more than three steps that Bilal will be asked to approve.
- Any time he says "explain this" about a system, or "I'm forgetting".

Not for: a single bug fix, a routine PR, a status update. Those stay in the
ticket and the standup.

## Shape (keep it to one scroll per chapter)

1. **The system today** — what exists, in plain words, with one diagram of the
   mechanism (data flow, who talks to whom), not a box with a name on it.
2. **What changed / what we're deciding** — the actual question.
3. **Teach boxes** — two to four plain sentences per concept the decision
   depends on, with an Express or React Native analogy where one fits. Bilal:
   "these are the type of things I want you to gently teach me along the way."
4. **Options with numbers** — a table: monthly floor, cost at 10× load, what
   you get, ops burden, lock-in. Cite the source and the date read. Recommended
   row marked.
5. **Scalability, step by step** — today, 10×, 100×, 1,000×: what scales it,
   what breaks first, the fix, the cost.
6. **Reliability and recovery** — what fails, what the user sees, how we roll
   back, recovery targets, single points of failure.
7. **Decisions made** — dated list.
8. **Decisions coming, in order** — each one phrased so it can be answered in
   one word, with the recommendation stated.
9. **Glossary** — every term of art used above, one line each.

## Rules

- Plain English for a founder on a phone. No internal jargon, no bare numbers:
  every percentage says what it measures, used or left, of what, for what period.
- Blue for the recommended path, orange for cost and risk. Never red vs green
  (Bilal is red-green colorblind).
- Honest about what was not verified. "Vendor pricing read 2026-10-21, re-check
  before paid signup" beats a confident wrong number.
- Build it as an Artifact page (private link), then link it from the ticket,
  the ADR if there is one, and STATE.md. The page is the record; chat is not.
- Keep it current: when a decision in it is made, update the page, don't write
  a second one. Same URL, new version.
- Rule #1 still applies inside the primer: any ongoing cost is a CEO decision
  with an explicit approval line.

## Why it works

Reading beats being told: Bilal can go at his own speed, re-read when he
forgets ("got a lot going on as CEO"), and approve from a phone. Writing it
forces the agent to actually know the numbers. And it survives vendor switches:
the page is a URL in STATE.md, not a memory in one model's session.
