# InstaLILY Case Study — Research Notes

> **Start with the playbook:** `instalily-case-study-playbook.md` (plain English). This file is the raw research behind it. Practice assessments: `instalily-mock-a-partselect.md`, `instalily-mock-b-field-tech.md`. Comp and status live in the `interviews` tracker, not here.

_Researched 2026-08-25 (evening), before opening the portal link. Public sources only; the portal was not touched. Everything below is what the internet says about InstaLILY's take-home, not what your assessment will say — read yours first, then use this._

---

## 1. TL;DR

- The loop is stable: AI video screen → senior-engineer call → **take-home build** → onsite (often a presentation of your build). You're at step 3.
- Two formats seen: a multi-day take-home (2023) and a **~4-hour build + 1-hour team presentation** (2025 onsite). Your timed portal = the 4-hour format, moved remote. Expect to walk them through it afterward.
- The dominant prompt since 2024 is **"build a chat agent for PartSelect.com, scoped to refrigerator + dishwasher parts."** A second variant exists: **voice-first sales-rep assistant** (notes + follow-up tasks). No mobile-specific variant is public anywhere — yours may be new.
- Graders' stated criteria (verbatim from the prompt): **interface design, agentic architecture, extensibility/scalability, accuracy + efficiency of answers.**
- The single most differentiating things strong submissions did: **grounding (never state a part/price/compat verdict the tools didn't return), a scope guard, and proof it works (evals + a README that runs from a fresh clone).**
- Reviewers Bill, Victor, Sean are **IC software engineers** (Tufts/UChicago/Google), Iris is a **founding engineer**. They will read code, not just slides.

---

## 2. The prompt, as candidates have quoted it (PartSelect variant)

Recovered verbatim from a June 2026 submission's committed playbook and corroborated by 4+ independent repos:

> **Background** — This case study aims to design and develop a chat agent for the PartSelect e-commerce website. Given the extensive product catalog, the focus will be on Refrigerator and Dishwasher parts. The agent's primary function is to provide product information and assist with customer transactions. It is crucial that the chat agent remains focused on this specific use case, avoiding responses to questions outside this scope. Focus on the user experience and the extensibility of your implementation.
>
> **Frontend** — Use a modern framework (e.g., NextJS) for the chat interface, ensuring it aligns with PartSelect's branding. You will also select the features that you want available on the chat agent (think broadly – what do users want to use the chat for, how should users see products in the chat, order support, etc.).
>
> **Backend** — Choose any backend architecture that you would like. You are free to use any online tools, vector databases, and supplementary materials in your approach.
>
> **Success Criteria** — Your case study will be evaluated based on but not limited to the design of your interface, agentic architecture, extensibility and scalability of your approach, and ability to answer user queries accurately and efficiently.
>
> Example inquiries (must not be confined to these):
> 1. "How can I install part number PS11752778?"
> 2. "Is this part compatible with my WDT780SAEM1 model?"
> 3. "The ice maker on my Whirlpool fridge is not working. How can I fix it?"

Deliverables seen: forked repo (their template is a bare Create React App chat shell with a stub `api.js`), a **Loom walkthrough**, optional slides. DeepSeek is the LLM most READMEs default to (suggests the prompt recommended it). No public source states a time limit for this variant.

**The trick in query 2:** PS11752778 is a Whirlpool *refrigerator door shelf bin* (WPW10321304). WDT780SAEM1 is a Whirlpool *dishwasher*. The correct answer is "not a verified fit — here's how to check your model," and one public submission hard-coded "yes, compatible" — exactly the hallucination they're fishing for.

## 3. The other variant (sales assistant)

One repo: "Instalily Sales Assistant — a voice-first chat experience that helps sales reps quickly ask questions during/after calls, capture structured post-call notes, and create follow-up tasks." Next.js + OpenAI Realtime API, mobile-responsive, cost-aware. This maps to InstaWorkers for sales reps. If your assessment is a field-persona app (technician or rep), expect this shape: scoped tools, structured capture (notes/tasks), grounding, quick actions.

## 4. What strong submissions have in common

- **One agent + a tool registry (4–8 tools), not multi-agent.** A submission that shipped both modes measured multi-agent at 25–45 s vs 8–20 s. Another's decision log: "single agent — lower latency, simpler failures, easier evals."
- **Hybrid retrieval:** deterministic lookup (SQL/JSON) for facts — price, stock, compatibility — plus vector/RAG only for fuzzy symptoms. "Compatibility is a database join, never an LLM guess."
- **Scope guard before the LLM** (regex/keyword fast path → cheap classifier), with an on-brand deflection and quick-action chips instead of a flat refusal.
- **Hallucination gate:** regex every `PS\d+` in the reply; strip/caveat anything not present in tool results. ~15 lines, reads as senior.
- **Rich blocks over markdown:** product card (name, price, stock, image), compat verdict with 3 states (verified / not in verified list / unknown), numbered install steps + video link.
- **Seed data committed** (30–120 real parts), so the reviewer runs it without scraping or keys; several shipped a `MOCK_LLM=1` keyless mode.
- **Provider-agnostic LLM** via 3 env vars (`LLM_BASE_URL / LLM_API_KEY / LLM_MODEL`). Cheap, repeatedly framed as "extensibility."
- **Proof:** the strongest repo (June 2026) shipped a 40-case eval harness with published results (40/40, p50 2.2 s), 83% coverage, an ADR-style `TRADEOFFS.md`, an honest limitations section, a Loom script and two decks. Almost nobody else proved their agent worked.
- **Cuts they made on purpose:** cart/orders/auth stubbed or dropped ("drop cart, order_support tool, and e2e suite" was the strongest submission's last commit). Streaming with tool-status pills only in 2 of 12.
- Branding: PartSelect teal `#337778`, yellow `#f3c04c`.

## 5. What graders and the company say they value

- Prompt criteria: interface design · agentic architecture · extensibility & scalability · accurate + efficient answers.
- Careers page "Three C's" — Code: "commitment to quality and impact, building scalable AI solutions on reliable technology." Tagline: "the systems you ship run real businesses."
- Hackathon selection language: "engineering track record with production code," "you build it, you ship it, you own it," "high learning quotient."
- Their org PR template asks: **How has this been tested? (unit / CI / manual) · How has this been documented? · Screenshots.** Answer all three in the README.
- Post-take-home questions on record: "What did you learn from this case study?" and "Describe your approach to the take-home." Also, every loop: "Why InstaLILY?"
- Model-routing worldview (their words): large models in the cloud for reasoning, small models at the edge for routine tasks. A stub router with a one-paragraph rationale mirrors it.

## 6. Pitfalls seen in the wild

- Hard-coding answers to the 3 example queries (one PR did exactly that, and got query 2 wrong).
- Multi-agent orchestration that doubles latency for no accuracy gain.
- Scrapers that don't finish → no data → nothing to demo.
- Letting the model state part numbers/prices/verdicts from memory.
- Repos that need keys or a DB to boot; READMEs that don't run verbatim from a fresh clone.
- Unfinished ambitious scope (an OpenAI Agents SDK orchestrator that never worked).
- Heavy unused deps left from the template (`langchain`, `antd`, `rsuite` are in their CRA `package.json`) — prune and say so.
- Ghosting is a known complaint after the *video* round; nobody complains about the case study itself.

## 7. Mobile-role angle (inference, not sourced)

- No mobile case study is public, no InstaLILY app is on either store, and the mobile stack is undetermined (Nick Karkut is the only Senior Mobile Engineer listed). Follow whatever the assessment specifies.
- If the assessment hands you the web template or leaves the stack open: reviewers are web/backend ICs. A repo that needs Xcode to evaluate is friction. **Expo (RN + `expo start --web`)** shows mobile chops while staying demoable in a browser; say so in the README.
- If it's a field-persona assessment: technician on a phone in a warehouse → offline-tolerant, fast diagnosis, quick actions, structured capture, honest sync state. That's your Mobile Inspector / FreedomCare story in code.

## 7b. JD → repo signals (Mobile Engineer JD, received 8/21; posted title is "Mobile Engineer", 5–8 yrs — confirm "Senior" before offer)

| JD line | Ship in 4 hours | Skip (mention in "next steps") |
|---|---|---|
| Offline-first sync, spotty warehouse Wi-Fi | Local-first writes + outbox; per-record `pending / synced / failed` visible in UI | Conflict resolution UI |
| RN with development builds | `expo-dev-client` + `eas.json`; README line on why not Expo Go | Native modules |
| Gloved-hand inputs | Large tap targets, quick-action chips, minimal typing | Voice input |
| On-device inference where relevant | One paragraph: small model on device for routine/offline, big model in cloud for reasoning, router decides (their own architecture) | Core ML / ML Kit |
| CI/CD: Expo Builds, Fastlane, GitHub Actions | `.github/workflows/ci.yml` running typecheck + tests | EAS submit, Fastlane lanes |
| Datadog / Sentry / Firebase | `Sentry.init` behind an env flag + a breadcrumb on sync failure | Real DSN, RUM dashboards |
| MVVM / Coordinator / Redux-style | Hooks as ViewModel seam, dumb screens, one store for the outbox; name it in README | Full state library |
| Defend decisions under pressure | Decision → why → revisit-when table | — |
| AI-serious: agents, voice, vision | Scoped tool-calling agent + grounding gate | Voice, vision |
| Client-facing / stakeholders | Demo section a non-engineer can follow | — |

Stories for the presentation round: Mobile Inspector outbox → warehouse Wi-Fi; NuvoAir BLE → gloved-hand/edge cases; Bamware EAS rail → CI/CD; Baat pagination-drift fix → API contracts + offline sync.

## 8. A 4-hour game plan (if the prompt is the PartSelect shape; adapt otherwise)

| Window | Do | Don't |
|---|---|---|
| 0:00–0:15 | Read everything. Write the 5 tools + 3 canonical queries + refusal case as a checklist in the README first. Create the private repo, add collaborators. | Start coding. |
| 0:15–0:45 | Hand-curate seed data: 20–40 real parts (incl. PS11752778 and true WDT780SAEM1 parts), model cross-refs, 5–8 symptom→parts entries. JSON/SQLite, committed. | Scrape. |
| 0:45–2:15 | Single agent, tools: `search_parts`, `get_part`, `check_compatibility`, `diagnose_symptom`, `install_guide`. Regex scope guard. Hallucination gate. Provider-agnostic env + `MOCK_LLM`. | Multi-agent, cart, auth, streaming (unless free). |
| 2:15–2:50 | UI: chat + product card + compat verdict (3 states) + install steps + quick-action chips on refusal. Brand colors. | Pixel polish. |
| 2:50–3:15 | 10–20 case eval JSON + script; assert tool choice and no invented PS numbers; paste results table. 2–3 unit tests on the guard + gate. | 80% coverage. |
| 3:15–3:45 | README: pitch · quickstart that runs verbatim · the 3 queries with screenshots · Mermaid architecture · 5-row "decision → why → revisit when" · honest limitations · next steps · how tested/documented. Record a 5–8 min Loom. | New features. |
| 3:45–4:00 | Fresh-clone test. Push. Confirm collaborators. Reply in Iris's thread. | Cut it close. |

## 9. Off-the-clock prep that's fair game

- Environment: Node/Expo/Python ready, LLM key in env, GitHub private repo flow rehearsed, README/`TRADEOFFS.md` skeleton, Loom set up.
- Domain: know PartSelect's site structure, the two example part/model numbers, common fridge/dishwasher failure modes.
- Story: how you'll explain "single agent + grounding + evals" and what you'd do with a week.
- AI tooling: no public source says whether it's allowed; the strongest public submission was openly built with Claude Code from a committed playbook. Check your assessment's policy; if allowed, disclose and frame it as your Bamware workflow (every line reviewed, evals as the gate).
- Don't pre-build the PartSelect solution: the timer exists to measure your 4 hours, and a mobile-role assessment may be a different prompt anyway. Having the plan in your head is the honest advantage of this research.

## 10. Reviewers (public team page)

| Email | Person | Title / background |
|---|---|---|
| bill@ | Bill Soronzonbold | Software Engineer (Tufts) |
| victor@ | Victor Brown | Software Engineer (UChicago; ex-Google; early-career per a 2024 internship post) |
| sean@ (round 1) | Sean Traynor | Software Engineer (Tufts) |
| iris@ | Iris Cheng | Founding Engineer; judge at their 2026 SF hackathon |
| — | Chris Scholz | VP Eng (ex-Meta, Palantir; previously Director of Eng, Infrastructure) |
| — | Nick Karkut | Senior Mobile Engineer (still listed) |

---

# Round 2 additions (2026-08-25, later evening)

## R2-1. The timed format is new, and the PartSelect prompt survived into it

- Commit spans across 14 cloned solutions: 2024–2025 candidates built over 1–14 days. The first timed-looking submissions appear **Feb 2026**: Kolin Huang's PR #9 is **2h46m, 14 progressive commits** (README → Next.js migration → e2e tests → real LLM → Postgres/vector adapters → action buttons), and Cesar's PR #8 is a single "Final code" dump the same week. Both are PartSelect. The June 2026 ScooterStuff build (41h) was not timed.
- Low-confidence corroboration (1point3acres, login-walled, extraction partly garbled): Dec 2025 SDE loop = 15-min screen → **48-hour take-home "AI agent chat application" with e-commerce website data, pushed to GitHub** → NYC onsite → comp quoted $200–220K.
- Glassdoor stage mix for SWE: **"Presentation" is the single most common stage (25%)**. A Design Intern was asked "What would you rate your case study from 1–10?" Expect to self-grade honestly.
- **So:** the prior that your assessment is PartSelect-shaped went up. What's achievable in 4 hours has a public reference point (Kolin's PR: intent router, JSON-schema tool contracts with latency budgets, product cards, citation drawer, separate order form, Playwright e2e for the 3 canonical queries).

## R2-2. Things the assessment probably says that round 1 couldn't confirm

- **DeepSeek is almost certainly named** in the assessment: six independent candidates defaulted to it (one README: "Recommended: Get a free key from deepseek.com"). Keep the LLM provider-agnostic; DeepSeek is OpenAI-compatible, so `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL` covers it, Anthropic, and OpenAI.
- **The template is a leftover Chrome side-panel app** — `package.json` name `chrome-side-panel`, deps include `chrome`, `@anthropic-ai/sdk`, `langchain`, `pdf-parse`, `antd`, `rsuite`, `mui`. One 2024 candidate literally shipped a Chrome extension because of it. If you're handed it: don't `npm install` 20 unused packages; either prune with a one-line README note or build beside it.
- The `internship-case-study` repo is gone (404, no Wayback). The sales-voice variant repo (`lordcrawford/instalily`) went private since round 1; its live demo (instalily-five.vercel.app) is a voice call transcript + follow-up tasks + notes for a sales rep.

## R2-3. Instalily's own vocabulary (mirror it, don't name-drop it)

From instalily.ai/platform, /lily, /instacontrol, /instabrain, /security, /fde:

| Their term | Their words |
|---|---|
| Contracts | "typed, versioned, tested" |
| Capabilities (= tools) | "Budget caps per capability"; gates: "declaration, permissioning, observability, versioning, testing" |
| Routes judgment / approvals | "Approval design: predicate, route, timeout"; "Discount above 20% needs sign-off before Lily sends" |
| Policy runtime, not prompts | "Policy is configuration, not a release" |
| Trace | "Every action, exception, correction, and outcome is traced"; "hash-chained steps" |
| Eval gate | "graded continuously against datasets your own experts validated"; "Accuracy, latency and cost are tracked on every release"; "nothing deploys if a metric moves the wrong way" |
| Hybrid routing | large models for complex reasoning, smaller models for routine work, "routing tasks appropriately" |
| Placement follows the work | cloud / on-prem / edge, "close to operational sites with limited connectivity" |
| Six gates on every agent action | identity → permission scoping → input sanitization ("injection guard") → human approval → rate-limit + logging → traceability ("versioned prompts and model registry") |
| Progressive disclosure | "reads your records and nothing more" |
| Amplify, not replace | "How do we amplify the human work" (Amit Shah) |

Bonus: the team page lists a dog as "Chief Hallucination Officer." A grounded-answers-only stance lands with this crowd.

**Cheap ways to sound native:** call your tools folder `capabilities/` with a typed, versioned contract per tool; one action gated by an approval predicate (e.g., "add to cart over $200 needs confirm"); a per-turn trace record (request id, model, prompt version, tools called, latency, cost); a 10–20 case eval with accuracy/latency/cost in the README and a CI check that fails on regression; an explicit small-vs-large model router even if both env vars point at the same model; a "what I learned / time-to-value" closing section.

## R2-4. Mobile clues: InstaCoach is the mobile-shaped product

- InstaCoach (instalily.ai/instacoach): "works on iPad and mobile devices during appointments," "captures the conversation," camera used to "scope jobs by panning across spaces," recording rules "configured per state, per brand, per channel," post-visit CRM/quote/contract drafted and "follow-up sent in the rep's voice," documentation "45 minutes to under 10 min." Integrations: ServiceTitan, Salesforce, HubSpot, Dynamics.
- Field-service page: "puts the exact page, part, or procedure in the tech's hand on demand," "technician lookup" in 2 seconds. Series B PR: "equipment diagnostics in field environments," edge = "limited connectivity."
- If your assessment is a mobile variant, this is the likely shape: a rep/tech on a phone, voice or photo in, structured notes/tasks/quote out, scoped tools, approval before anything is sent, offline-tolerant. The PartSelect skeleton (agent loop + tools + guard + gate + evals) carries over unchanged; only the tools and the UI change.
- Still no InstaLILY app on either store; no public evidence of RN vs Swift. The Mobile Engineer JD is not posted on Greenhouse (19 roles), Built In, WTTJ, LinkedIn, or Wellfound — it's a private-pipeline req.

## R2-5. Hackathon = how they grade builds (Iris Cheng was a judge)

- ship26.instalily.ai: "A history of shipping code that lives in production." "You build it, you ship it, you own it." Format: 8-hour build, two checkpoints, **code freeze 6:00 PM, lightning demos 6:30 PM** — they grade a working demo. Judges: Iris Cheng (Founding Engineer), Logan Ge, Dhiraj Khanal (model distillation), Sai Koushik (inference optimization), Maya Magavi, **Alex Kim (Founding Designer)** → UI polish is scored.
- Themes: edge-native AI, small language models, inference optimization, agentic systems — their hybrid-routing worldview again.

## R2-6. What strong submissions actually contain (specifics to plan against)

- **Tools (ScooterStuff):** `search_parts(query, appliance_type?)`, `get_part_details(part_identifier)`, `check_compatibility(part_identifier, model_number)`, `diagnose_issue(symptom, appliance_type, brand?)`, `get_installation_guide(part_identifier)`. Schemas generated from typed models.
- **System prompt sections:** TOOL USE (mandatory, never answer from own knowledge; symptom→diagnose, description→search, PS#→details, fit→compatibility "NEVER guess") · GROUNDING (non-negotiable) · COMPATIBILITY HONESTY with three verdicts `verified_fit / no_match_found / unknown` ("NEVER a bare no") · SCOPE · STYLE ("ask at most ONE clarifying question").
- **Scope guard, layered cheap→expensive:** injection regex → other-appliance regex (washer/dryer/oven/microwave → deflect) → in-scope regex (keywords + `\bPS\d{5,9}\b` + model-number pattern) → short follow-ups (≤12 words) pass if history is in scope → 8-token LLM classifier fallback.
- **Hallucination gate:** regex all `PS\d+` in the draft, subtract the set seen in tool results, fail/regenerate on leftovers; log to `hallucination_log.jsonl`.
- **Eval case format:** `{id, suite, turns[], expect:{tools_called, answer_contains_any, must_be_in_scope, allowed_ps_numbers}}`, suites: spec_canonical, compatibility, diagnosis, grounding, injection, scope, search_fuzzy. Results header records model, date, git sha, p50/p95.
- **Kolin's tool contracts:** each tool declares `description`, `auth:{required, level}`, `latencyBudgetMs`, JSON-schema in/out, `fallback:{strategy, value}`; `GET /api/chat` returns the contracts for inspection. Cheap "production-minded" signal.
- **Demo assets that exist:** Loom scripts targeting 7–12 min (intro → architecture → live demo of the 3 queries + a refusal → extensibility → limitations); ScooterStuff also built a *second* 8–9 min technical deck (system architecture → anatomy of one turn → agent loop → scope control) — plan for a technical follow-up.
- **The only published metrics:** Mendonça's deck ("10/10 correct, ~7 s, gpt-4o, $7 total") and ScooterStuff's 40-case table. A 10-case table puts you in the top two.
- **Real-time scraping vs pre-scraped catalog** is the recurring fork; Mendonça's numbers ("800+ GB, 100+ hours" to pre-scrape) settle it for 4 hours: committed fixture set + documented live-fetch fallback. Every public solution except one failed "fresh clone runs without scraping."

## R2-7. How graders read take-homes (general, sourced)

- Reviewers **run it first**; a broken run "signals negligence," usually undeclared deps. First pass is **5–20 minutes**: runs per README → edge cases → readability → UI polish; seniors also get judged on architecture pattern, SRP, tests, docs. "I have time to review a couple hundred lines, not a few thousand." Even one test stands out.
- README order that works: what it does → run (keyless + with key) → assumptions → decisions vs alternatives → **what I left out and why** → next steps → AI assistance. "Never apologize for constraints; frame cuts as decisions."
- Logical, unsquashed commits show process. Fresh-clone test before submitting. Remove TODOs/debug prints.
- The follow-up is where AI-generated code gets caught: "if requirements change to X, what changes?" One manager noted a candidate who re-submitted after 8h scored *lower* than the 3h version.
- Agent-specific: few high-signal tools with new-hire-quality descriptions; iteration cap + stop conditions; scope enforced in deterministic code, not just the prompt (OWASP LLM01/06); a FakeProvider/`MOCK_LLM` path doubles as the reviewer's keyless run and your test harness; an out-of-scope eval set ("can your app say I don't know").
- Mobile-specific: separation of concerns, folder structure, error/loading/empty states, offline handling, keyboard handling, RNTL tests, `accessibilityRole/Label` on interactive elements. Web-runnable Expo removes the Xcode barrier for a 20-minute reviewer; ship a simulator GIF to prove native polish.
- AI disclosure norms: GitLab requires disclosure; Anthropic allows AI in take-homes only when instructed and asks for transparency. If your assessment is silent, ask before starting; if allowed, one README section: tools used, what they did, what you authored, "every line reviewed."

## R2-8. Culture and comp context (Aug 2026 Glassdoor)

- Aug 14, 2026 review (Ops): ~75% of the company under 25; leadership "through fear and pressure"; leadership generates AI mockups and expects teams to ship production-quality at the same speed without scope definition; work judged by output volume. Jul 17 (SWE II): friendly team, smooth onboarding, 5-day in-office, fast ramp.
- Comp anchors: SWE II posted **$120–140K**; Glassdoor SWE $112–177K; 1point3acres SDE onsite quoted **$200–220K**. Your offered base (figure in the `interviews` tracker) sits at the top of anything public — upward room is likely small; the title ("Senior") and the hybrid definition are the levers.
- Two Jul 2026 reviewers complain of ghosting after the *video* round; nobody complains about the case study itself.

## R2-9. Practice-round reference points

- **Floor (achievable in the window):** Kolin PR #9 at 2h46m — router, 5 tools with contracts, cards, citations, separate order form, e2e for the 3 queries.
- **Ceiling (what "exceptional" looks like, 41h):** ScooterStuff — SSE streaming with tool-status pills, 40-case eval, MOCK_LLM, hallucination gate, trace panel, Docker, CI, two decks.
- **Your target in 4h:** Kolin's scope + ScooterStuff's three cheapest wins (hallucination gate, 10-case eval table, MOCK_LLM) + the mobile client (Expo, outbox, quick-action chips) + a README in the R2-7 order.

## 11. Unknowns (after round 2)

- Whether your assessment is PartSelect, sales/InstaCoach-shaped, or a new mobile prompt. Prior after round 2: PartSelect-shaped is most likely; a mobile twist on it is plausible.
- Grading rubric beyond the four stated criteria; AI-tool policy; whether a Loom/deck is expected inside the timed window or after.
- Instalily's mobile stack (RN vs Swift); Nick Karkut's role in review.
- Anything about the portal itself — nothing public mentions it. The 1point3acres account is the only hint at the newer format and it's low-confidence.

## Sources

- Prompt text: [ScooterStuff/case-study playbook/CONTEXT.md](https://github.com/ScooterStuff/case-study/blob/main/playbook/CONTEXT.md) · corroborated by [SankalpSTiwari/partselect-chatbot](https://github.com/SankalpSTiwari/partselect-chatbot), [apratim-mishra/partselect_chat](https://github.com/apratim-mishra/partselect_chat), [zehuiwu/partselect-agent](https://github.com/zehuiwu/partselect-agent), [icecreamlun/Instalily_chatbot](https://github.com/icecreamlun/Instalily_chatbot), [kohsheen1234/case-study](https://github.com/kohsheen1234/case-study)
- Sales-assistant variant: [lordcrawford/instalily](https://github.com/lordcrawford/instalily)
- Template + PRs: [Instalily/case-study](https://github.com/Instalily/case-study) · org PR template: [Instalily/.github](https://github.com/Instalily/.github) · [Instalily org](https://github.com/Instalily)
- Live candidate demos: [partselect-chat-agent.vercel.app](https://partselect-chat-agent.vercel.app/), [part-select.vercel.app](https://part-select.vercel.app/), [partselect-agent-ten.vercel.app](https://partselect-agent-ten.vercel.app/), [website-chat-agent.vercel.app](https://website-chat-agent.vercel.app/)
- Query-2 trick: [PS11752778 — Whirlpool refrigerator door shelf bin](https://www.partselect.com/PS11752778-Whirlpool-WPW10321304-Refrigerator-Door-Shelf-Bin.htm) · [WDT780SAEM1 — Whirlpool dishwasher](https://www.partselect.com/Models/WDT780SAEM1/)
- Interview accounts: [Glassdoor — Instalily interviews](https://www.glassdoor.com/Interview/Instalily-Interview-Questions-E8832609.htm) · [Glassdoor — AI Software Engineer](https://www.glassdoor.com/Interview/Instalily-AI-Software-Engineer-Interview-Questions-EI_IE8832609.0,9_KO10,30.htm) · [Glassdoor — Software Engineer](https://www.glassdoor.com/Interview/Instalily-Software-Engineer-Interview-Questions-EI_IE8832609.0,9_KO10,27.htm) · [1point3acres (login-walled)](https://www.1point3acres.com/interview/thread/1158960)
- Round 2 — more solutions: [Kolin PR #9](https://github.com/Instalily/case-study/pull/9) · [khushalidaga PR #6](https://github.com/Instalily/case-study/pull/6) · [Yeok-c/instalily-case-study](https://github.com/Yeok-c/instalily-case-study) · [aashrivastava/instalily-case-study](https://github.com/aashrivastava/instalily-case-study) · [gmunhoz0810/PartSelect-LLM-Assistant](https://github.com/gmunhoz0810/PartSelect-LLM-Assistant) · [Mendonça deck](https://docs.google.com/presentation/d/1rUMNNZMqPISBXdqyCz0qJ7a7BEeGBwN1db08ah7F804) · [Tiku deck](https://docs.google.com/presentation/d/1C1cYQ6B2ONgeRiIXZ4P3HS0U2kkieBi5Fw2xB2TA3Mc) · [Sankalp Loom folder](https://loom.com/share/folder/afc5061ec246487fb6f3950363ea2889) · [sales-voice demo](https://instalily-five.vercel.app/)
- Round 2 — Instalily pages: [Platform](https://www.instalily.ai/platform) · [Lily](https://www.instalily.ai/lily) · [InstaControl](https://www.instalily.ai/instacontrol) · [InstaBrain](https://www.instalily.ai/instabrain) · [InstaCoach](https://www.instalily.ai/instacoach) · [Field service](https://www.instalily.ai/solutions/field-service) · [Security](https://www.instalily.ai/security) · [FDE](https://www.instalily.ai/fde) · [Greenhouse board](https://job-boards.greenhouse.io/instalilyai) · [SWE II posting](https://job-boards.greenhouse.io/instalilyai/jobs/4296649009) · [Amit Shah podcast](https://www.buzzsprout.com/1889238/episodes/18203996)
- Round 2 — interview accounts: [Glassdoor Design Intern](https://www.glassdoor.com/Interview/Instalily-Design-Intern-Interview-Questions-EI_IE8832609.0,9_KO10,23.htm) · [Glassdoor reviews](https://www.glassdoor.com/Reviews/Instalily-Reviews-E8832609.htm) · [Glassdoor salaries](https://www.glassdoor.com/Salary/Instalily-Salaries-E8832609.htm) · [1point3acres BBS (low confidence)](https://www.1point3acres.com/bbs/thread-1158960-1-1.html)
- Round 2 — take-home craft: [Orosz — take-home tips](https://dev.to/gergelyorosz/9-insider-tips-to-ace-your-next-takehome-project-for-frontend-fullstack-and-mobile-interviews-41nn) · [BigPanda reviewer](https://medium.com/bigpanda-engineering/secrets-from-the-interview-room-what-reviewers-look-for-in-a-take-home-coding-assignment-1aaec70dabe0) · [FAANG manager on take-homes](https://educative.io/blog/faang-manager-demystifies-take-home-coding-project) · [Rankid time plan](https://www.rankid.dev/blog/take-home-assignment) · [HN hiring managers](https://news.ycombinator.com/item?id=43980289) · [Anthropic — writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) · [Anthropic — building effective agents](https://www.anthropic.com/engineering/building-effective-agents) · [Hamel Husain — evals](https://hamel.dev/blog/posts/evals/) · [OWASP LLM Top 10 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf) · [FakeProvider pattern](https://dev.to/mukundakatta/how-to-test-llm-agents-without-calling-the-real-api-17oc) · [Proxify RN code tests](https://proxify.io/articles/five-suggestions-for-react-native-code-test-assignments) · [Expo web](https://docs.expo.dev/workflow/web/) · [Expo unit testing](https://docs.expo.dev/develop/unit-testing/) · [HelloInterview — project presentation](https://www.hellointerview.com/guides/openai/l5) · [GitLab AI interview policy](https://about.gitlab.com/jobs/ai-interview-process/) · [Anthropic hiring AI policy (Fortune)](https://fortune.com/2025/07/21/billion-dollar-giant-anthropic-ai-ban-hiring-policy-change-job-seekers-interview-process)
- Company signals: [Team](https://www.instalily.ai/team) · [Careers](https://www.instalily.ai/careers) · [SF hackathon](https://ship26.instalily.ai/) · [hackathon-gpu](https://github.com/Instalily/hackathon-gpu) · [Small Data Center launch](https://www.businesswire.com/news/home/20260527505925/en/InstaLILY-Launches-the-Small-Data-Center-Extending-Autonomous-AI-to-the-Physical-Economy) · [Series B](https://siliconangle.com/2026/07/14/instalily-developer-ai-teammates-can-automate-complex-business-specific-work-raises-60m/) · [Series B celebration](https://www.instalily.ai/news/seriesb-celebration)
