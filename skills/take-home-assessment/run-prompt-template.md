# Run prompt template — timed take-home with Claude Code

Fill the placeholders, save as PROMPT.md in the new private repo, start Claude
Code, and say: "Read PROMPT.md fully, then execute it." Worked, filled-in
examples (with real seed data for a PartSelect-style parts assistant):
docs/interview-prep/instalily-mock-a-partselect.md (web) and
docs/interview-prep/instalily-mock-b-field-tech.md (Expo + offline).

---

You are my pair programmer. We are building a complete, submission-quality
solution to a timed take-home assessment in this repository. The clock is
running: {{WINDOW}} from {{START_TIME}}, submission by {{DEADLINE}}. Read this
entire prompt before doing anything. Then print a short plan and build end to
end, verifying as you go. Do not ask me questions unless truly blocked; make
sensible decisions and document them in the README.

## 1. The assessment (verbatim)

{{ASSESSMENT_TEXT}}

Example inputs the reviewers will try first:

{{EXAMPLE_INPUTS}}

Deliverables and submission: {{DELIVERABLES}}. Reviewers: {{REVIEWERS}}.

## 2. Non-negotiables

1. Runs from a fresh clone with no API key (mock mode); with a key via
   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL.
2. Facts come only from tools; the model phrases. Lookups are data joins with
   three-state verdicts (verified / not verified / unknown).
3. Every example input works end to end through the generic path. No code
   path may recognize the example inputs.
4. Out-of-scope inputs get a two-sentence redirect plus suggestion chips, with
   no model call.
5. Any side-effecting action needs an explicit human confirm before it runs.
6. No scraping. Seed data only: {{SEED_DATA_SOURCE}}. Cite sources in DATA.md.
   Do not invent identifiers, prices, or relationships beyond the seed.
7. No secrets in git. .env.example only.
8. Single agent. No RAG, vector DB, MCP, multi-agent, or streaming unless the
   assessment asks. Mention where each would slot in.
9. Logical commits at each working checkpoint.
10. The documentation standard in section 9 is a hard requirement.

## 3. Stack

{{STACK}}
(Default web: Next.js App Router + TypeScript strict, route handlers, agent
core with zero framework imports. Default mobile: npm workspaces — Expo app
with dev client and web support, Express + Zod server, shared pure-TS
agent-core package.)

## 4. Agent design

- Tools (typed with Zod, registry-driven, one file each): {{TOOLS}}
- Loop: normalize → extract identifiers → merge session context → guard →
  provider call with tool schemas → run validated tool calls (cap 5; errors
  become results) → build blocks from tool results → gate (identifiers in the
  answer must be a subset of tool-returned ∪ user-typed; retry once, then
  strip and caveat; log) → chips → reply { text, blocks, chips, trace }.
- System prompt sections: ROLE · TOOL USE, MANDATORY · GROUNDING,
  NON-NEGOTIABLE · VERDICT HONESTY · SCOPE · STYLE. Export PROMPT_VERSION.
- Providers: LlmProvider interface; openaiCompatible (chat completions with
  tools; 20 s timeout; one retry on 429/5xx); mock (deterministic, regex-picked
  tool, templated answer; used when MOCK_LLM=1 or no key).

## 5. Seed data

{{SEED_DATA}}

## 6. UI

{{UI_SPEC}}
(Defaults: header with brand, context bar, welcome with four chips, cards per
block type, three-state verdict card, numbered steps card, diagnosis card,
status line while tools run, chips under every reply, mobile-width friendly,
loading/error/empty states. For Expo: 48 pt targets, offline banner, outbox
with pending/synced/failed per record, confirm tap before sending.)

## 7. Proof

- evals/cases.json with 10+ cases (every example input, the trick cases, a
  verified case, an unknown case, two out-of-scope, one injection, one
  clarify). `npm run eval` prints a table and writes RESULTS.md (model,
  prompt version, date, git sha, p50/p95).
- Unit tests: guard, gate, each verdict state, identifier normalization, the
  loop with the mock provider (tool called; cap enforced).
- End-to-end: the example inputs, asserting on structured elements only.
- Screenshots of each example input in docs/screenshots.
- .github/workflows/ci.yml: typecheck, lint, tests, evals.

## 8. README (write last, in this order)

Pitch + screenshot → quickstart (keyless and with key; verified on a fresh
clone) → the example inputs with screenshots and one sentence each → Mermaid
architecture → agentic design → decisions table (6–8 rows: decision / why /
revisit when) → evals and tests → extensibility → honest limitations → next
steps (5) → how tested and documented → AI assistance → reading the code.

## 9. Documentation standard

Write for a mobile engineer who has never built an LLM feature. Plain words;
explain each term the first time. File headers (purpose, pattern, production
change). Numbered comments per step in the loop, guard, gate, outbox. DATA.md
with provenance (copied vs written). docs/ARCHITECTURE.md with a React Native
analogy per layer and a glossary. No domain identifiers in logic outside
tests, evals, and data. README "Reading the code" section.

## 10. Process

Plan → scaffold → data → tools + tests → guard/gate → providers (mock first)
→ loop → API → UI → evals → e2e + screenshots → README. Commit each step.
Before each checkpoint: typecheck, lint, tests, evals. Fresh-clone check at
the end: clone to a temp dir, run the quickstart verbatim in mock mode, hit
the trick input, confirm the verdict. Finish with a summary: what's built,
eval table, exact commands, what was stubbed or cut and why.

## 11. Definition of done

- [ ] Fresh clone runs keyless; runs with a key via three env vars.
- [ ] Every example input correct; trick inputs answered honestly.
- [ ] Out-of-scope → redirect with no model call.
- [ ] Gate blocks an invented identifier (test proves it).
- [ ] 10+ evals pass in mock mode; unit + e2e green; CI present.
- [ ] Screenshots embedded; README in order; decisions table; limitations;
      AI assistance; reading-the-code section.
- [ ] Documentation standard met end to end.
- [ ] No secrets, no scraping, no debug leftovers, logical commits.
