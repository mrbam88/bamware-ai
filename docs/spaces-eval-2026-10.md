# Spaces (rayedbajwa) vs Bamware agent ops — eval spike

**Date:** 2026-10-03  
**Ticket:** [#128](https://github.com/mrbam88/bamware-ai/issues/128)  
**Method:** Read-only public docs + public source. **No install, no Docker, no API keys, $0 spend.**  
**Sources:** [docs site](https://rayedbajwa.github.io/spaces/), [github.com/rayedbajwa/spaces](https://github.com/rayedbajwa/spaces) (`main` as of spike), [spacesos.dev](https://spacesos.dev) (try site; not used), Bamware `AGENTS.md` / `STATE.md` / board + delivery skills / `docs/hermes-integration.md` at `origin/main`.

---

## 1. License first (binding constraint)

Spaces ships under the **Spaces Personal Use License** (Copyright 2026 Rayed Bajwa; `LICENSE` in the repo).

**Plain language:**

- An **individual** may use, copy, and modify the software for **personal, non-commercial** purposes only.
- **Forbidden without written permission:** commercial use; use **on behalf of any company, organization, government, or other entity** (explicitly including **internal business use**); providing services to others; hosting for others; **redistribution** (modified or not).
- License ends automatically if conditions are broken. Software is “AS IS.”

**Bamware rule for this product:**

> **Do not install, run, Docker-compose, fork-into-company-use, or wire Spaces to Bamware GitHub/Jira/Linear against company work** unless Rayed Bajwa grants written commercial/internal permission.  
> This spike is **ideas only** from public README/docs/source. **Do not copy Spaces code** into Bamware repos.

Ideas below are architecture patterns already common in open AIDLC / Spec Kit / agent-ops literature; implement them in Bamware’s own skills, docs, and harnesses — not by vendoring Spaces.

---

## 2. What Spaces is

**Positioning:** “AI software factory” — specs (or tickets/ideas) in → reviewed, tested, Conventional-Commits PRs out. Human gates between stages; inspectable markdown artifacts per stage.

### Stack (from `package.json` + docs)

| Layer | Choice |
|---|---|
| Runtime | Bun + TypeScript |
| Data / queue | Postgres + **pg-boss** (job queue, per-project concurrency, SKIP LOCKED, LISTEN/NOTIFY) |
| UI | React web app (board, project page, live agent dock) |
| Browser / E2E tools | Playwright (+ `pi-playwright`, `@playwright/cli`) |
| Coding agent SDK | `@earendil-works/pi-coding-agent` |
| Spec pipeline kit | `@the-agency/pi-spec-kit` (GitHub Spec Kit patterns; Spaces shortens skills/templates) |
| Integrations | GitHub App, Jira, Confluence, Linear, Slack (org-level OAuth; credentials encrypted in app, not `.env`) |
| Knowledge | Org RAG: chunk + full-text + **pgvector**; `org_knowledge_search` |
| Models | BYOK (Anthropic / OpenAI / OpenRouter); **no model names in templates** — tier routing (small/medium/large) by cost/speed + org policy |

### Pipeline stages (canonical line)

```
research → specify → plan → tasks → implement → review → verify → deliver
```

Also present in templates/docs: `init`, `clarify`, `constitution`, `testplan`, `parallelize`, `orchestrate`, `analyze` / `checklist`, `taskstoissues`.

**Human gates** (typical): after specify, plan, tasks, testplan, implement/orchestrate, verify; deliver pauses before merge/deploy. **Autonomous mode** can auto-approve gates.

**Built-in loops (declarative YAML `onComplete.branch`):**

- implement ↔ review until approved (`CHANGES_REQUESTED` → back to implement; max iterations)
- implement ↔ verify until pass / near-pass accept
- deliver until `delivery_status == merged`

**YAML pipeline templates** under `data/pipelines/` (e.g. `aidlc-feature`, `aidlc-express`, `aidlc-bugfix`, `aidlc-mvp`, enterprise/security variants): ordered steps with `stage`, `role` persona, optional `review`, `humanGate`, `thinking`, `parallel` workstreams, `maxIterations`, branch rules.

**Board:** lanes derived from artifacts — Backlog → Initialized → Specified → Planned → Tasked → Implementing → Releasing → Done. “Done” only when delivery reports merged.

**Intents:** one piece of work (Spec Kit feature dir `specs/<NNN-slug>/`); Postgres is the durable record; files are the agents’ working copy. Repo-local change committed **with code** on the same PR: `change.yaml`, `tasks.md`, delta `spec.md`.

**GitHub delivery:** App bot identity (`<app>[bot]`) opens/updates PRs; Conventional Commits; stacked PRs per workstream; review/verify comments on PRs; human gate before merge.

**Data guardrails:** Mask (default) / Strict / Warn / Off — secrets + PII tokenized before model calls; restored only for local shell/file tools; logs/Slack/PR bodies/embeddings masked; Spaces’ own `DATABASE_URL` / encryption / provider keys **unset** in agent shells.

**Upstream ideas cited (not copied workflow files):** GitHub Spec Kit, Pi Coding Agent SDK, AWS AIDLC methodology.

---

## 3. Map to Bamware (1:1)

| Spaces concept | Bamware equivalent | Notes |
|---|---|---|
| Kanban board + artifact-derived lanes | GitHub Projects board 2 + Status (`skills/board-ops`) | Bamware: Todo → In Progress → Ready for QA → QA Passed → Done. Spaces collapses build+review+QA into **Implementing**, then **Releasing**. |
| Project / “space” (team world) | Repo family + board Area field; Hermes profiles for roles | Bamware multi-repo; Spaces multi-tenant org/team UI is heavier than we need solo. |
| Intent (one feature lifecycle) | GitHub issue ticket (story/scope/OOS/AC) | Ticket **is** the prompt (`agent-ready-tickets`). Spaces also stores full artifact history in Postgres. |
| `research` before `specify` | Grooming / DoR context; optional spike tickets | Bamware does research ad hoc in grooming or spike tickets — not a mandatory factory stage. |
| `specify` / `plan` / `tasks` / `testplan` | Issue body + optional plan docs; DoR checklist | Bamware front-loads quality into **grooming** (`definition-of-ready`) so overnight doesn’t re-litigate. |
| Human gates mid-pipeline | Bilal/Engineering Lead gates; Worker: Supervised / Human-only | Bamware fewer mid-build gates; more “groom once, agent runs, QA proves.” |
| `implement` + worktrees + parallel workstreams | `standing-engineer` / Overnight executor + `agent-fanout` worktrees | Same isolation idea. Bamware overnight prefers **serial** one-ticket wakes to avoid 3am merge hell. |
| `review` agent + loop | Engineering Lead PR review (org chart 2026-10-03); PR comments | Spaces auto-loops CHANGES_REQUESTED → implement. Bamware: Lead reviews; workers don’t self-certify. |
| `verify` + evidence | `skills/qa-engineer` | Same evidence culture (“claims carry evidence”). Spaces writes `verification-report.md`; Bamware comments AC table on PR. |
| `deliver` (merge/deploy/UAT) | QA merge rules + Bilal human-gates (store/spend/CI/contracts) | Bamware QA may merge when clean; Spaces always human-gates merge in deliver templates. |
| Claim / run ownership | Claim protocol in `board-ops` (Status + issue comment) | Spaces: job queue + pause/resume/cancel on run. Bamware: board is live anti-collision truth. |
| Night / unattended queue | `night-supervisor` + Overnight Mode; Scrum Master (decided, Hermes profile TBD) | Spaces: always-on workers + supervisor process. Bamware: bedtime/serial + CoS/SM dispatch. |
| Declarative pipeline YAML + loops | Skills + procedural docs (not a stage DSL yet) | Biggest structural gap: Bamware encodes loops in prose skills, not machine-checked templates. |
| Model tier routing (no hard-coded model names) | CFO tier → provider/model policy (`docs/hermes-integration.md`, #100); AGENTS “route by capability” | Aligned direction; Bamware CFO is the policy owner. |
| Org knowledge pgvector | `bamware-ai` git canon + Notion + skills; no pgvector factory | Public-repo / no-PII posture fights bulk ingest of mail/Drive into a model-facing RAG without guardrails. |
| PII/secret mask before model | `docs/security.md`, tripwire in QA, public-repo discipline | Bamware relies on process + public-repo rules more than runtime token vaults. |
| GitHub App bot PRs | Native `gh` as authenticated user/agent | Bot identity would clarify agent vs human PRs and play nicer with branch protection. |
| Live agent-output dock | Discord CoS + Agents tab / Overnight receipts; not a streaming factory UI | Spaces UX is a real product surface; Bamware is board + chat + STATE. |
| Spec committed on same PR as code | Sometimes docs in PR; not standardized `specs/<N>/` | Steal-worthy convention for multi-repo features. |
| Stacked PRs per workstream | Orthogonal tickets + separate PRs (`agent-ready-tickets` orthogonality) | Bamware prefers orthogonal issues over stacked branches when possible. |
| Hermes Discord CoS | `docs/hermes-integration.md` — Bamware remains canonical; Hermes = execution surface | Spaces is an all-in-one factory; Hermes is deliberately not the source of truth. |
| Conventional Commits / PR delivery | PR “Closes #N”, gates quoted in body | Bamware already ships via PR; CC style is optional hygiene. |
| Postgres + workers ops cost | Prefer free / local / existing Mac+omarchy rails; hard **$20** spend stop | Spaces self-host = Postgres + workers + BYOK — real ops and token cost. |

**Lifecycle alignment (compressed):**

| Phase | Spaces | Bamware |
|---|---|---|
| Ready to pull | Groomed project + intent | `definition-of-ready` → Worker Agent-ready + Todo |
| Build | implement (+ parallel) | standing-engineer / Overnight DEV |
| Review | review stage loop | Engineering Lead |
| QA | verify stage | qa-engineer |
| Merge | deliver + human gate | QA merge **or** Bilal; human-gate exceptions |
| Continuity | Postgres intents + memory | STATE.md + session-handoff + board claims |

---

## 4. Steal-worthy patterns (ideas only — no code copy)

Prioritized for Bamware skill/doc follow-ups. None require installing Spaces.

1. **Declarative stage loops with caps**  
   Encode “fix-until-green / review-until-approved / deliver-until-merged” as explicit max-iteration + branch rules in Overnight / Scrum Master docs (or a tiny YAML the executor reads). Today this is buried in skill prose.

2. **Research brief before specify (for L / multi-repo tickets)**  
   Optional DoR step or spike artifact: repos to touch, patterns to reuse, risks, open questions — then the agent-ready issue. Mirrors Spaces `research` → `specify` without a factory.

3. **Specs travel with the code**  
   Convention: for non-trivial features, PR includes `specs/<issue-or-slug>/{spec,tasks}.md` (or links + checklist) so the next harness doesn’t depend on chat. Aligns with continuity principle in `AGENTS.md`.

4. **Model tier routing without baking model names into worker prompts**  
   Worker briefs say tier (S/M/L or doc/small/feature); CFO/Hermes policy resolves provider+model. Matches Spaces routing tables and Bamware CFO direction.

5. **Secret/PII masking posture for anything that hits a model**  
   Especially if org RAG or Gmail-derived context ever feeds agents: mask before prompt; never embed raw secrets; keep public-repo tripwire. Process doc + lightweight redaction helpers beat a full Spaces vault clone.

6. **GitHub App (or dedicated bot user) for agent PRs**  
   Attribution, branch-protection friendliness, cleaner “agent vs human” review. Optional infra ticket; not urgent for solo.

7. **Live run dock / interrupt channel semantics**  
   Pause / resume / cancel / mid-run feedback as first-class Overnight/Agents-tab behaviors (Spaces dock). Bamware already wants “Needs you” + capacity; streaming logs are polish.

**Already covered well enough — don’t re-build:**

- Board Dev–QA loop, claim protocol, worktree isolation, evidence-or-it-didn’t-happen QA, human gates on spend/store/CI/contracts, Conventional-ish PR delivery, multi-harness continuity via git.

---

## 5. Gaps / risks for Bamware

| Risk | Why it matters |
|---|---|
| **License** | Personal non-commercial only; **internal business use forbidden**. Install/run for Bamware = legal risk. No fork-as-product. |
| **Pi SDK + Spec Kit dependency** | Factory value is glued to those packages and Spaces’ own templates — not a drop-in under Hermes/Claude Code. |
| **Ops cost** | Postgres + workers + Playwright browsers + BYOK tokens. Fights $20 stop, free-first, and “don’t add idle infrastructure.” |
| **Overlap** | We already have board, DoR, DEV, QA, Overnight, CoS, CFO tiering. A second factory would duplicate the control plane. |
| **Public repo / no-PII** | Spaces org knowledge + integrations encourage ingesting Confluence/Jira/Slack into embeddings. Bamware public `bamware-ai` + security rules reject that shape without a private vault and strict mask. |
| **Harness fight** | Bamware truth is git + GitHub issues/Projects + Hermes as thin surface. Spaces wants to be the board, the queue, the UI, and the bot. Adopting it splits “where is the truth?” |
| **standing-engineer / night-supervisor status** | Org chart (2026-10-03) is moving toward Engineering Lead + Scrum Master + Overnight executor; those skills may retire. Don’t bolt Spaces patterns onto soon-obsolete loop names — target the **executor + SM + Lead** contracts. |
| **Human-gate density** | Spaces pauses often (good for teams). Bamware solo overnight wants fewer wakes; DoR front-loading is the intentional opposite of mid-pipeline ceremony. |
| **Redistribution** | Even “borrowed” large template dumps from the repo could violate no-redistribution if treated as derivative product code — stick to **re-expressed ideas** in our own words. |

---

## 6. Recommendation

### **Borrow 5 patterns into bamware-ai skills/docs** — do **not** adopt or install Spaces.

Not **Ignore** (useful mirror of AIDLC). Not **Watch-only** (actionable). Not **Talk to author about commercial license** unless Bilal later wants a hosted multi-tenant factory product (out of scope; human-only negotiation).

**Borrow list (follow-up tickets, not this PR):**

1. Stage-loop caps + explicit fix-until-green / review-until-approved language in Overnight / Scrum Master / QA docs.  
2. Optional **research brief** gate on L / multi-repo tickets in `definition-of-ready` or `agent-ready-tickets`.  
3. **Specs-on-PR** convention for non-trivial agent PRs.  
4. **Tier-not-model-name** in worker briefs (CFO owns resolution).  
5. **Prompt-side secret/PII mask** checklist when feeding external context to models (link `docs/security.md`).

**Explicit non-goals:** Spaces install, Docker, GitHub App via Spaces, pgvector factory, Pi SDK in Bamware, commercial license talk, rewriting standing-engineer production wiring in this spike.

### Bilal next action (one)

**Approve this eval (or comment deltas), then file ≤2 follow-up tickets** for (a) DoR/research-brief + specs-on-PR convention and (b) Overnight/SM loop-cap language — both Worker: Agent-ready or Supervised as he prefers. **No Spaces install.**

---

## 7. Spike hygiene

- Read-only: public LICENSE, README, `package.json`, `data/pipelines/*.yml`, `data/org/model-routing.yml`, `data/org/review-policies.yml`, concept docs (`pipelines-and-stages`, `delivery`, `data-guardrails`, `agents-and-workers`, `intents`).  
- No `bun install`, no `docker compose`, no spacesos.dev login, no Bamware secrets touched.  
- Bamware comparison from `origin/main` AGENTS/STATE/skills/docs (local checkout may differ; standing-engineer / night-supervisor skills exist on disk and remain the named comparison targets from #128 even as org chart evolves).

---

## 8. References

- Spaces LICENSE, README, docs: https://github.com/rayedbajwa/spaces  
- Docs site: https://rayedbajwa.github.io/spaces/  
- Spec Kit: https://github.com/github/spec-kit  
- AWS AIDLC (ideas only): https://github.com/awslabs/aidlc-workflows  
- Bamware: `skills/board-ops`, `skills/standing-engineer`, `skills/night-supervisor`, `skills/agent-ready-tickets`, `skills/definition-of-ready`, `skills/qa-engineer`, `docs/hermes-integration.md`, `AGENTS.md`
