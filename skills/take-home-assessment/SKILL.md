---
name: take-home-assessment
description: Procedure for a timed take-home coding assessment (case study) built with Claude Code as the pair. Use when Bilal has a take-home, case study, or timed build to submit as a repo. Covers pre-clock setup, the first 15 minutes, build order, design defaults graders reward, the documentation standard, evals, README order, fresh-clone check, submission, and the presentation round.
---

# Take-home assessment

Trigger: Bilal has a timed build to submit as a repo. Origin: InstaLILY 4-hour
case study prep, 2026-08-25. Worked example, real data, and traps live in
docs/interview-prep/instalily-case-study-playbook.md. Foundations for the AI
parts: docs/interview-prep/ai-basics-for-mobile-devs.md.

Ground rules from `bilal-profile` and AGENTS.md still apply: plain words,
short sentences, RN + Express analogies, no secrets in git, hard spend rule.

## 0. Before the clock starts

- Environment ready: Node 22, Expo, an LLM key in the shell env (never in a
  repo), the private repo created with reviewers added as collaborators, a
  screen recorder tested.
- Read the company archive doc if one exists (docs/interview-prep/COMPANY-*).
- Fill in run-prompt-template.md (this folder) with the assessment text and
  keep it ready to paste into Claude Code the moment the link is opened.
- Fairness line: a generic personal starter (agent loop, eval runner, CI,
  README skeleton) may come in and is disclosed in the README. Domain work —
  data, tools, prompt, screens — is built on the clock.
- AI-tool policy: read the assessment for it. Silent → ask before starting.
  Allowed → one README section: tools used, what they did, what Bilal
  authored, "every line reviewed."

## 1. The first 15 minutes (no editor yet)

- Read the assessment twice. Copy the success criteria and every example
  input into the README as a checklist. Write the "not doing" list under it.
- Name the entities: things, contexts, relationships, knowledge (for a parts
  assistant: parts, models, fits, symptoms). Each becomes a data file.
- Name 4–6 tools. Each is one typed function over that data.
- Pick the stack: one app when possible (Next.js route handlers, one
  `npm run dev`); Expo app + Express server + a shared pure-TypeScript agent
  package when it must be mobile. TypeScript throughout, Zod for schemas.

## 2. Build order — vertical slice first

1. Seed data: 20–30 real rows, hand-copied from the browser in 15 minutes.
   Never write a scraper (sites block servers; it eats an hour). Cite the
   pages in DATA.md. Put the data behind a repository interface so the JSON
   is a fixture, not a dependency.
2. Deterministic slice: tools + scope guard + keyword router + cards on
   screen. No model yet. Working demo by the 90-minute mark.
3. Make it an agent: sectioned system prompt, tool schemas from the Zod
   types, loop capped at 5 rounds, hallucination gate, provider interface
   with an OpenAI-compatible adapter (three env vars) and a mock adapter so
   it runs with no key.
4. Proof: 10+ eval cases with a results table, 3+ unit tests (guard, gate,
   one tool), a CI workflow running typecheck + tests + evals.
5. README in the reviewer order below, screenshots or a short recording,
   TRADEOFFS.
6. Fresh clone into a new folder, follow the README verbatim, push, confirm
   collaborators, send the reply with 15+ minutes to spare.

## 3. Design defaults graders reward

- Facts come only from tools; the model phrases. Lookups (price, stock,
  compatibility) are data joins with three-state verdicts: verified / not
  verified / unknown. Never a bare no for an unknown.
- Scope guard runs before the model call. Out of scope → two-sentence
  redirect plus suggestion chips, no model spend.
- Cards are built from tool results in code, never from model text. Chips
  after every reply. A status line while a tool runs.
- One agent. No RAG, vector DB, MCP, multi-agent, or streaming unless the
  assessment asks; each gets one line in "next steps."
- Any action with consequences (save, send, order) needs a human confirm tap.
- A trace per request (tools, latency, model, prompt version, gate result).
- Example inputs flow through the same generic path as any other input.
  Code that recognizes them is disqualifying.

## 4. Documentation standard — a hard requirement

Bilal must be able to follow every decision from comments alone.

- File headers: what the file is for, which pattern it implements, what
  changes in production.
- Numbered comments per step in the loop, guard, gate, and any outbox.
- DATA.md: which fields were copied from which pages, which were written by
  hand, why there is no scraping, how to swap in the real source.
- docs/ARCHITECTURE.md written for a mobile engineer: the request path with
  a React Native analogy per layer, plus a glossary of every term used.
- No domain identifiers in logic outside tests, evals, and data files.
- README gets a "Reading the code" section: the files to read, in order.

## 5. Time-box (4-hour version)

| Window | Do |
|---|---|
| 0:00–0:15 | Read twice, checklist, not-doing list, repo + collaborators |
| 0:15–0:35 | Seed data, DATA.md |
| 0:35–1:30 | Deterministic slice with cards on screen |
| 1:30–2:20 | Agent loop, gate, mock mode, provider env |
| 2:20–2:50 | Evals, unit tests, CI |
| 2:50–3:35 | README, screenshots or recording, TRADEOFFS |
| 3:35–3:55 | Fresh clone, push, collaborators, reply |

Stop adding features at 2:50. A documented cut beats a half-built feature.

## 6. README order (reviewers run it first, then read ~200 lines)

Pitch → demo image or recording → quickstart that runs keyless → the example
inputs with screenshots → architecture diagram → decisions table (decision /
why / revisit when) → evals and tests → extensibility → honest limitations →
next steps → how tested and documented → AI assistance.

## 7. Traps seen in the wild

Hardcoded answers to the example inputs · trick questions where the example
identifiers don't match (verify against real data) · starter repos with junk
dependencies · scraping · the model deciding facts · a demo backend on a host
that dies · tests asserting on prose instead of structured fields · cart,
auth, and orders as scope creep · four hours of code and no README time.

## 8. After submission

- Write the debrief: docs/interview-prep/COMPANY-debrief.md (template:
  medal-deepdive-debrief.md). Update the tracker in `interviews`.
- Presentation round: 60 s problem and assumptions → 3 min live demo (happy
  path, trick input, refusal, one error state) → 3 min one diagram → 2 min
  evals and what they caught → 2 min cuts as decisions. Leave a third for
  questions. Have cold: why this architecture, with more time, what did you
  learn, rate it 1–10, what changes if we add X.
