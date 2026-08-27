# InstaLILY Case Study Playbook

_InstaLILY · Mobile Engineer · Round 3 of 4. Plain-English guide to the 4-hour take-home. Comp and status live in the `interviews` tracker, not here._

Everything the internet knows about their take-home, rewritten so you can read it once and remember it. **Nothing here came from the portal link** — it came from Instalily's own public template repo, 14 candidates' public solutions, their product pages, and Glassdoor.

**Window:** 4 hours from first click **Submit:** private GitHub repo → add bill@, victor@, iris@instalily.ai → reply in Iris's thread **Updated:** Aug 25, 2026

## What you're walking into

You are at step 3 of 4. The AI video screen and the call with Sean are behind you. Next is this build, then an onsite where you present it.

- **The clock is real.** Their portal records the moment you open the link. Four hours later they expect an email with a repo link. Nobody who submitted publicly mentions an extension.
- **Who reads it.** Bill Soronzonbold and Victor Brown are software engineers (Tufts, UChicago/ex-Google). Iris Cheng is a founding engineer who judged their hackathon. These are peers who will open your code, not a hiring manager skimming a deck.
- **What comes after.** On Glassdoor, "Presentation" is the single most common stage in their loop (25% of reports). One hire described "4 hours on a case study and 1 hour presenting to the team." Questions on record: *"Explain your approach to the take-home,"* *"What did you learn from this case study?"*, *"What would you rate your case study, 1 to 10?"*, and at every stage, *"Why Instalily?"*
- **The format is new.** Every public solution from 2024–2025 was built over days. The first submissions that look like a timed sprint appear in February 2026. So the bar for "done in 4 hours" is lower than the polished repos you downloaded — those took 25 to 40 hours.

## The assignment, in plain English

**PartSelect.com** sells replacement parts for appliances. Every candidate whose work is public got the same assessment since 2024: **build a chat assistant for that website, limited to refrigerator and dishwasher parts.** It should help a customer find a part, check whether a part fits their appliance model, walk them through installing it, figure out what's wrong from a symptom, and help with their order. It must politely refuse anything else — no dryers, no ovens, no recipes.

They hand you a starter: a React chat window with a fake backend function that literally returns the string `"Connect your backend here...."`. You build the brain behind it.

### The three example questions (verbatim)

1.  "How can I install part number PS11752778?"
2.  "Is this part compatible with my WDT780SAEM1 model?"
3.  "The ice maker on my Whirlpool fridge is not working. How can I fix it?"

The assessment says the agent must not be confined to these — but every reviewer types these three first.

### The four things they say they grade

#### Design of your interface

Does it look and feel like a product? Cards, badges, and buttons — not walls of markdown.

#### Agentic architecture

Does the AI look things up with tools instead of guessing? Can you draw the flow on a whiteboard?

#### Extensibility and scalability

Could someone add a new tool, appliance type, or data source next week without rewriting it?

#### Accuracy and efficiency

Right answers, fast, with zero invented part numbers or prices.

### What people actually handed in

A repo with a README, plus — for the strong ones — a screen-recorded walkthrough (Loom, 7–12 minutes) and sometimes a short slide deck. The assessment almost certainly recommends **DeepSeek** as the model (six unrelated candidates defaulted to it); it's a cheap API that speaks the same protocol as OpenAI, so one setting swaps it for Claude or GPT.

**Your version may differ.**

No mobile-specific assessment has ever appeared publicly. Yours might be exactly this, this with a "make it a mobile app" twist, or something modeled on their field-rep product. The brain (tools, grounding, evals) is the same in every case. Only the tools and the screens change.

## How much of this is backend and AI?

Most of it. Three of the four grading criteria are about the brain. In the one public build that fits the timed format, roughly 70% of the code was routing, tools, data, and fallbacks; 30% was cards and chips.

- **The Python is a coincidence.** The public solutions come from AI/full-stack applicants whose default is FastAPI. The assessment says "choose any backend." Write it in TypeScript with Express and Zod — your Bamware shape — and you also tick the JD's "proficient across the full stack" box with one language.
- **You don't need RAG.** The "hybrid retrieval" in the good repos was really: exact lookup in a table for facts (price, stock, fit), and fuzzy search only for symptoms. A JSON file of 25 real parts and a symptom map covers it. Say in the README where embeddings would slot in later.
- **You don't need MCP.** It's the same idea as a folder of tools with typed inputs. The one MCP-based solution was middle of the pack. You built an MCP server at Bamware — mention it as the extensibility path; don't build it on the clock.
- **Where you win.** Nobody public has combined grader-bait on the backend with a real mobile client. Offline outbox, visible sync state, big tap targets, quick-action chips — the combination doesn't exist yet.

## Words you'll see, and whether you need them in 4 hours

Mobile/Node analogies throughout. Chips: Need build it · Nice only if free · Skip mention in README, don't build · Mobile for the mobile variant.

**LLM / model**  
The text engine (Claude, GPT, DeepSeek). You call it over HTTPS with a list of messages; it returns text. Think of it as a very smart, very forgetful contractor who will confidently make things up.

**System prompt** — _Need_  
The standing instructions at the top of every call: who the assistant is, what it may talk about, what it must never do. The good ones are sectioned: tool use rules, grounding rules, scope, style.

**Tool calling** — _Need_  
You give the model a menu of functions with typed inputs (`check_compatibility(part, model)`). Instead of answering, it can reply "call this tool with these arguments." Your code runs the function and feeds the result back; then the model writes the answer. The model is the dispatcher; your Express handlers are the tools.

**Agent loop** — _Need_  
The while-loop around tool calling: send messages → if the reply is a tool call, run it and append the result → repeat until the model produces a final answer. Cap it (5 iterations) so it can't spin forever.

**Grounding** — _Need_  
The rule that the assistant only states facts that came back from a tool. If `get_part` didn't return a price, the model may not say a price. Instalily's team page lists their dog as "Chief Hallucination Officer" — this is a house value.

**Hallucination gate** — _Need_  
Fifteen lines that enforce grounding: find every `PS\d+` in the draft answer, subtract the ones your tools returned this turn, and if anything is left, block or regenerate. The single cheapest "senior" feature in any public repo.

**Scope guard** — _Need_  
A check that runs *before* you spend an LLM call: does this message mention a dryer/oven/microwave and not a fridge/dishwasher? Then reply with a polite redirect and the four starter chips. Cheap regex first, model second.

**Seed data** — _Need_  
A small JSON file of real parts, models, and symptoms committed to the repo, so the app runs on a fresh clone with no scraping and no database. The data section below gives you 30 verified rows.

**Mock mode** — _Need_  
`MOCK_LLM=1`: a fake model that returns canned tool calls and answers. Reviewers can run your app without a key, and your tests are deterministic. One investment, two payoffs.

**Evals** — _Need_  
A JSON file of questions with expected behavior ("must call check_compatibility," "must not contain any PS number other than…") and a script that runs them and prints a table. Ten cases is enough to be in the top two of every public submission.

**Streaming** — _Nice_  
Words appear as the model writes them (server-sent events). Feels alive, costs plumbing. Only two of twelve solutions had it. A "Checking compatibility…" status line gets 80% of the feeling for 5% of the work.

**RAG** — _Skip_  
Retrieval-augmented generation: chop documents into chunks, turn them into vectors, find the nearest chunks to the question, paste them into the prompt. Useful for fuzzy questions over lots of text. Not needed for 25 parts.

**Vector DB / embeddings** — _Skip_  
The storage and math under RAG. One timed candidate faked it with a hash trick. Don't.

**MCP** — _Skip_  
A protocol for exposing tools to any model. Same concept as your tools folder, with a network boundary. You've built one; say so in "extensibility," don't ship one.

**Multi-agent** — _Skip_  
Several models handing work to each other. One candidate shipped both modes and measured multi-agent at 25–45 seconds vs 8–20 for a single agent. Same accuracy. Don't.

**Loom** — _Nice_  
A screen-recording tool that gives you a shareable link. Record your screen and voice walking through the three questions and a refusal, 5–8 minutes, paste the link at the top of the README. QuickTime plus a Drive link works too. Cheapest insurance that a reviewer sees it working.

**DeepSeek**  
A cheap model API that speaks OpenAI's protocol. Probably recommended in the assessment. Use three env vars — `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` — and it, Claude, and GPT are all one config change apart.

**Dev build vs Expo Go** — _Mobile_  
Expo Go is Expo's prebuilt sandbox app; a dev build is your own native binary with `expo-dev-client`. The JD says "cross platform development with development builds." Ship `eas.json` and one README line on why.

**Outbox** — _Mobile_  
Writes land in a local queue first; a sync engine drains it when the network is back. Each record shows pending / synced / failed. The JD's "spotty warehouse Wi-Fi" line, in code.

## What a great answer looks like to the person typing

Picture the reviewer opening your app. This is the experience the best public submissions deliver, built from real PartSelect data.

```
ASSISTANT  I can help with refrigerator and dishwasher parts: finding a part,
           checking fit, install steps, and troubleshooting.
           [Find a part] [Check compatibility] [Start a repair guide] [Track an order]

USER       How can I install part number PS11752778?

ASSISTANT  (status: Looking up PS11752778 · Finding install guide)
           ┌ Refrigerator Door Shelf Bin ─────────────────────────────┐
           │ PS11752778 · WPW10321304 · Whirlpool     $47.40 · In stock │
           │ Really easy · under 15 min · no tools                      │
           └────────────────────────────────────────────────────────────┘
           1. Open the fridge door and empty the bin.
           2. Grip the old bin with both hands and lift straight up off the door rails.
           3. Line up the new bin over the rails and press down until it seats.
           [Check fit for my model] [Show related parts] [I'm stuck]

USER       Is this part compatible with my WDT780SAEM1 model?

ASSISTANT  (status: Checking compatibility)
           ✗ NOT A VERIFIED FIT
           PS11752778 is a refrigerator door bin. WDT780SAEM1 is a Whirlpool
           dishwasher, so it won't fit. Popular parts for that model:
           ┌ Lower Dishrack Wheel      PS3406971 · W10195416   $33.95 · In stock ┐
           ┌ Upper Rack Adjuster Kit   PS10065979 · W10712395  $55.29 · In stock ┐

USER       The ice maker on my Whirlpool fridge is not working. How can I fix it?

ASSISTANT  (status: Diagnosing: ice maker not making ice)
           Check in this order: 1. water fill tube (frozen?)  2. water inlet valve
           (200–500 Ω on a multimeter)  3. water filter (older than 6 months?)
           4. ice maker assembly.
           ┌ Ice Maker Assembly   PS11765620 · W10884390    $104.39 · In stock ┐
           ┌ Water Inlet Valve    PS11749668 · WPW10179146   $78.26 · In stock ┐
           What's your model number? I can confirm which of these fits.

USER       My dryer won't heat, what do I check?

ASSISTANT  I only cover refrigerator and dishwasher parts. For dryers, PartSelect.com
           has a repair guide. Anything I can help with on a fridge or dishwasher?
           [Find a part] [Check compatibility] [Start a repair guide]
```

Notice what's doing the work: every number came from a lookup; the compatibility answer is a **three-state verdict** (fits / not a verified fit / can't verify), never a bare no; the refusal is two sentences with a way forward; and each reply ends in chips so the reviewer never has to think about what to type next.

## The traps

**Trap 1 · Question 2 is a trick**

PS11752778 is a refrigerator door bin. WDT780SAEM1 is a dishwasher. The honest answer is "not a verified fit." One public submission hard-coded "Yes, compatible." That's the failure they're fishing for, and it's why compatibility must be a data lookup, never something the model decides.

**Trap 2 · The starter repo is junk**

Its `package.json` is named `chrome-side-panel` and drags in `@anthropic-ai/sdk`, `langchain`, `pdf-parse`, `antd`, `rsuite`, `mui` — none used. One candidate shipped a Chrome extension because of it. Don't `npm install` it blind. Prune it with a one-line README note, or build beside it and point the README at your app.

**Trap 3 · Scraping eats the clock**

PartSelect sits behind Cloudflare. A plain fetch from a server gets a 403. The 5-hour candidate's README admits the scraper needed a browser user-agent and 3–10 second delays and "can take tens of minutes to hours." Hand-copy 25 parts into JSON in the first 20 minutes and move on.

**Trap 4 · Letting the model decide facts**

If the LLM answers "is it compatible" from memory, you've built a liar with a nice UI. Facts come from tools; the model only phrases them. The gate enforces it.

**Trap 5 · A demo that dies**

Three of the four live candidate demos are dead today — their backends were on a free host that expired. If you deploy, keep the API inside the same app. Otherwise make "runs locally from a fresh clone with no key" the guaranteed path.

**Trap 6 · Tests that assert on prose**

The timed candidate weakened his tests twice because the LLM's wording kept changing. Assert on structured things: which tool was called, which card rendered, which PS numbers appear. Prose is for humans.

**Trap 7 · Building the cart**

Orders, auth, and cart are stubs in every public repo; the strongest one deleted them in its last commit. If the assessment mentions "customer transactions," a separate "order support" form with a stub is enough. Say what's stubbed.

**Trap 8 · Four hours of code, zero minutes of README**

Reviewers spend 5–20 minutes. They run it first, then read a few hundred lines. If the README doesn't run verbatim, nothing else gets read. Budget 40 minutes for it.

## What 3 hours actually bought someone (February 2026)

One public submission has a commit history that looks like a timed sprint: 2 hours 46 minutes, 12 commits. Reconstructed from the diffs, in plain English:

- **0:00 — README first**

  He replaced the boilerplate README with a design doc: scope, the intents he'd route, the tools he'd expose, an "extending to production" section. Before any code was committed.

- **0:11 — The whole app lands at once**

  About 2,000 lines: chat page, product card, citations drawer, order form, a keyword-based intent router, six tool contracts with schemas and timeouts, a 3-part dataset, two API routes. No LLM yet — every reply was a canned sentence assembled from lookups. Note: this was clearly built before the first commit; his clock started when he opened the editor, not when he pushed.

- **0:16 — Five end-to-end tests + CI**

  One Playwright test per example question, one for the out-of-scope dryer, one for the order form. A GitHub Actions workflow to run them.

- **0:54 — Real LLM, but only for wording**

  The model rewrites the already-decided answer in a friendlier voice, with a system prompt saying "never invent compatibility facts." If there's no API key, the app still works with the canned text. Facts never came from the model.

- **1:01 — More data**

  A fourth part, more install checklists, and a fix so "install PS11752778" infers the appliance type from the part instead of the dropdown.

- **2:16 — Storage adapters**

  After a 74-minute silent gap: Postgres if `DATABASE_URL` is set, in-memory otherwise; a fake "vector DB" built from a hashing trick. Optional remote-service client with a 900 ms timeout and fallback.

- **2:46 — Action buttons**

  A mini-spec file, then "Checkout now / Show alternatives / Notify me" buttons that appear only when the data justifies them, with three stub routes.

**What to copy:** deterministic vertical slice first, LLM second; tests on the three questions from minute 16; a README that reads like a design doc. **What not to copy:** seed data that reused real PS numbers with made-up names (his "dishwasher water inlet valve" is really a dishrack wheel), a fake vector DB, and an LLM that never actually decides anything — a reviewer who asks "what does the model do here?" gets an awkward answer.

For contrast, the 5-hour-24-minute candidate spent most of the window scraping and fighting 403s, committed `node_modules`, and shipped plain markdown bubbles with no cards. Same assessment, same day, very different four hours.

## The data you'll need — real and verified this week

Learn this now so the first 20 minutes of the clock go to typing JSON, not browsing. Prices as fetched August 2026. A part page URL only needs the PS number: `partselect.com/PS3406971-x.htm` resolves.

### Parts that actually fit dishwasher WDT780SAEM1

| PS number  | Name                                | Price   | Fixes                               |
|------------|-------------------------------------|---------|-------------------------------------|
| PS3406971  | Lower Dishrack Wheel (W10195416)    | $33.95 | Most popular part for this model    |
| PS10065979 | Upper Rack Adjuster Kit (W10712395) | $55.29 | Rack won't roll, falls off track    |
| PS11753379 | Drain Pump (WPW10348269)            | $62.60 | Not draining · Leaking · Noisy      |
| PS11752927 | Water Inlet Valve (WPW10327249)     | $54.24 | Will not fill with water            |
| PS12348515 | Door Seal (W11177741)               | $57.38 | Leaking                             |
| PS11756967 | Door Latch, black (WPW10653840)     | $28.42 | Door latch failure · Will not start |
| PS9494999  | Heating Element (W10703867)         | $79.80 | Not drying dishes                   |
| PS11755592 | Lower Spray Arm (WPW10491331)       | $44.23 | Not cleaning dishes                 |
| PS11759673 | Filter (W10872845)                  | $48.45 | Not cleaning dishes                 |
| PS11731570 | Detergent Dispenser (W10861000)     | $80.82 | Will not dispense detergent         |

### Refrigerator parts (Whirlpool unless noted)

| PS number  | Name                                                   | Price    | Fixes                                                                |
|------------|--------------------------------------------------------|----------|----------------------------------------------------------------------|
| PS11752778 | Door Shelf Bin (WPW10321304) — **the question-1 part** | $47.40  | Door won't close · bin cracked · Really easy, under 15 min, no tools |
| PS11765620 | Ice Maker Assembly (W10884390)                         | $104.39 | Not making ice · won't dispense · Easy, 30–60 min                    |
| PS11738120 | Ice Maker (W10873791)                                  | $77.34  | Not making ice · Leaking                                             |
| PS11749668 | Water Inlet Valve (WPW10179146)                        | $78.26  | Not making ice · Leaking                                             |
| PS3497634  | Water Inlet Valve (W10408179)                          | $78.77  | Not making ice · too little ice                                      |
| PS11701542 | Ice & Water Filter, Filter 1 (EDR1RXD1)                | $84.45  | Replace every 6 months                                               |
| PS11759515 | Door Gasket, gray (W10830162)                          | $144.93 | Door sweating · Fridge too warm                                      |
| PS11739119 | Crisper Drawer (WP2188656)                             | $88.88  | Drawer cracked                                                       |
| PS12364147 | Ice Maker Assembly, Frigidaire (241798231)             | $87.51  | Clicking · Not making ice                                            |
| PS12364199 | Door Shelf Bin, Frigidaire (242126602)                 | $50.35  | Bin cracked                                                          |

### Symptoms PartSelect uses (their exact words)

#### Refrigerator

Noisy · Leaking · Will not start · Ice maker not making ice · Fridge too warm · Not dispensing water · Fridge and freezer too warm · Door sweating · Light not working · Fridge too cold · Runs too long · Freezer too cold

#### Dishwasher

Noisy · Leaking · Will not start · Door latch failure · Not cleaning dishes properly · Not draining · Will not fill with water · Will not dispense detergent · Not drying dishes properly

### Cause chains worth encoding

- **Not making ice:** water fill tube (frozen) → water inlet valve (200–500 Ω) → water filter (6–12 months) → ice maker assembly.
- **Not draining:** drain pump & motor → check valve flapper → drain hose → timer.
- **Dishwasher leaking:** door seal → pump → water inlet valve.
- **Won't start (dishwasher):** door latch/switch → thermal fuse → control board.
- **Not drying:** heating element → high-limit thermostat → rinse-aid dispenser.

Real model numbers for variety: dishwashers WDT730PAHZ0, WDT750SAHZ0, WDTA50SAHZ0, KDTM354DSS4, WDF520PADM7; fridges WRS325FDAM04, WRX735SDBM00, WRF535SMBM00, LFSS2612TF0, GFSS2HCYCSS.

## Your 4 hours

Built from the timed candidate's timeline, the strongest repo's playbook, and published take-home guidance (reviewers run it first, then read ~200 lines). Adapt the tool names to whatever your assessment says.

**0:00–0:15 — Read twice, write the checklist, create the repo**

Copy the success criteria and example questions into the README as a checklist. Write the "not doing" list under it. Create the private repo and add the three collaborators now, so you can't forget.

_Don't open the editor yet._

**0:15–0:35 — Seed data**

`data/parts.json`, `data/fits.json`, `data/symptoms.json` from the tables above. 20–30 parts, both example numbers, 5 cause chains. Commit.

_Don't scrape._

**0:35–1:30 — Deterministic vertical slice, no LLM**

Express + Zod. Five tools: `search_parts`, `get_part`, `check_compatibility`, `diagnose_symptom`, `install_guide`. Regex scope guard. A `/chat` route that, for now, picks a tool by keyword and returns a structured reply (text + cards + verdict + chips). Chat UI renders those blocks. The three questions and the dryer refusal work end to end.

_Don't touch the model yet._

**1:30–2:20 — Make it an agent**

Swap the keyword picker for the real thing: system prompt with the sectioned rules, tool schemas from your Zod types, the loop with a 5-iteration cap, the hallucination gate, and `MOCK_LLM=1`. Three env vars for the provider. Status line per tool call.

_Don't add streaming unless it's free._

**2:20–2:50 — Proof**

`evals/cases.json` with 10 cases (the three questions, a yes-fit, the trick no-fit, two symptoms, a dryer, an oven, an injection attempt) + a script that prints a results table. Three unit tests on the guard and gate. A 12-line GitHub Actions workflow running typecheck + tests.

_Don't chase coverage._

**2:50–3:35 — README and the recording**

Order: one-line pitch → 30-second GIF or Loom link → quickstart that runs keyless → the three questions with screenshots → architecture diagram → a five-row "decision / why / revisit when" table → honest limitations → next steps → how tested, how documented → AI tools used and what you authored.

_Don't add features after 2:50._

**3:35–3:55 — Fresh clone, push, send**

Clone into a new folder and follow your own README. Remove debug prints. Push. Confirm the three collaborators. Reply in Iris's thread with the link and two sentences.

_Don't cut it closer than 5 minutes._

**The fairness line.**

Bring your **generic** starter into the real run: Expo + Express/Zod skeleton, the agent loop, the eval runner, the CI file, the README skeleton — and say so in the README ("scaffolded from my personal starter"). Build the **domain** on the clock: the seed data, the five tools, the prompt, the screens. Reviewers will ask how you built it in the presentation round; every answer should be one you'd give looking them in the eye.

## If yours is the mobile version

Their one mobile-shaped product is **InstaCoach**: a sales rep on an iPad in a customer's home, the app capturing the conversation, the camera panning across a crawlspace to scope the job, and afterward the CRM entry, quote, and follow-up drafted automatically. Their field-service page promises to put "the exact page, part, or procedure in the tech's hand." If your assessment is mobile, expect that shape: a rep or technician on a phone, voice or photo in, structured notes and a next step out, scoped tools, and an approval before anything is sent.

The JD, translated into things that fit in 4 hours:

| JD says                               | Ship                                                                                                                                      | Mention only           |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|------------------------|
| Offline-first, spotty warehouse Wi-Fi | Local-first writes + an outbox; each record shows pending / synced / failed                                                               | Conflict resolution UI |
| React Native with development builds  | `expo-dev-client` + `eas.json`; one README line on why not Expo Go                                                                        | Native modules         |
| Gloved-hand inputs                    | Big tap targets, quick-action chips, minimal typing                                                                                       | Voice input            |
| On-device inference where relevant    | One paragraph: small model on device for routine and offline, big model in cloud for reasoning, a router decides — their own architecture | Core ML / ML Kit       |
| CI/CD, Expo builds, GitHub Actions    | `.github/workflows/ci.yml` running typecheck + tests                                                                                      | EAS submit, Fastlane   |
| Datadog / Sentry / Firebase           | `Sentry.init` behind an env flag + a breadcrumb on sync failure                                                                           | Real DSN, dashboards   |
| MVVM / Coordinator / Redux-style      | Hooks as the view-model seam, dumb screens, one store for the outbox; name it in the README                                               | A full state library   |
| Client-facing, defend decisions       | The decision / why / revisit-when table; a demo section a non-engineer can follow                                                         | —                      |

Run it on the web too (`npx expo start --web`) so a reviewer without Xcode can click through in a browser, and include a simulator GIF to prove the native polish. Say that trade-off out loud in the README.

## After you submit

The presentation is where the real evaluation happens. Hiring managers say the follow-up is where AI-generated code gets caught: they change a requirement and ask what you'd change. Fill about two thirds of the slot; leave a third for questions.

1.  **60 seconds:** the problem in your words and the two assumptions you made.
2.  **3 minutes:** live demo — a happy path, the trick question, a symptom, a refusal, and one error state.
3.  **3 minutes:** one diagram. Point at where the scope guard, the loop cap, the gate, and the provider abstraction live.
4.  **2 minutes:** the eval table and one thing it caught.
5.  **2 minutes:** the cut list as decisions, not apologies. Then what day two looks like.

Have these cold: *"Why this architecture?"* (the simplest thing that's honest — single agent, tools for facts, model for words). *"What would you change with more time?"* (evals depth, real offline queue, streaming, observability). *"What did you learn?"* (pick something true — e.g., that question 2 taught you compatibility can never be a model decision). *"Rate it 1–10."* (a 7 with reasons beats a 9 with none). *"If we needed to add ovens next week?"* (one new entry in the appliance enum, one data file, zero prompt surgery — that's what extensibility meant). And *"Why Instalily?"* — you have the answer from the first-round prep.

## Running the practice round

Two mock assessments come with this playbook. Run each exactly like the real thing: start a 4-hour timer, don't read the grader's packet at the bottom until you've "submitted," then spend 30 minutes on the post-mortem.

- **Mock A** is the PartSelect assessment as candidates received it, with the real public starter repo. It's the most likely shape of your real assessment.
- **Mock B** is a mobile variant modeled on their field-rep product: a technician on a phone, offline, with a post-visit summary. It's the hedge, and the version that shows off what you specifically are good at.
- Do A first. If you finish A with time to spare and a clean README, you're ready. B is for the second day if you want it.
- After each: where did the minutes go? What did you rebuild that should be in your generic starter? What did you skip that you'd regret?

## Sources

- The assessment, verbatim: [ScooterStuff playbook/CONTEXT.md](https://github.com/ScooterStuff/case-study/blob/main/playbook/CONTEXT.md); corroborated by [Sankalp](https://github.com/SankalpSTiwari/partselect-chatbot), [apratim](https://github.com/apratim-mishra/partselect_chat), [zehuiwu](https://github.com/zehuiwu/partselect-agent), [icecreamlun](https://github.com/icecreamlun/Instalily_chatbot), [Yeok](https://github.com/Yeok-c/instalily-case-study).
- The starter and the timed PRs: [Instalily/case-study](https://github.com/Instalily/case-study), [PR \#9](https://github.com/Instalily/case-study/pull/9), [PR \#6](https://github.com/Instalily/case-study/pull/6).
- Data: [PS11752778](https://www.partselect.com/PS11752778-Whirlpool-WPW10321304-Refrigerator-Door-Shelf-Bin.htm), [WDT780SAEM1](https://www.partselect.com/Models/WDT780SAEM1/), [fridge repair](https://www.partselect.com/Repair/Refrigerator/), [dishwasher repair](https://www.partselect.com/Repair/Dishwasher/).
- Interview accounts: [Glassdoor](https://www.glassdoor.com/Interview/Instalily-Interview-Questions-E8832609.htm), [AI SWE page](https://www.glassdoor.com/Interview/Instalily-AI-Software-Engineer-Interview-Questions-EI_IE8832609.0,9_KO10,30.htm), [Design Intern page](https://www.glassdoor.com/Interview/Instalily-Design-Intern-Interview-Questions-EI_IE8832609.0,9_KO10,23.htm).
- Instalily's own words: [Team](https://www.instalily.ai/team), [InstaCoach](https://www.instalily.ai/instacoach), [InstaControl](https://www.instalily.ai/instacontrol), [Field service](https://www.instalily.ai/solutions/field-service), [Hackathon](https://ship26.instalily.ai/).
- Take-home craft: [Orosz](https://dev.to/gergelyorosz/9-insider-tips-to-ace-your-next-takehome-project-for-frontend-fullstack-and-mobile-interviews-41nn), [BigPanda reviewer](https://medium.com/bigpanda-engineering/secrets-from-the-interview-room-what-reviewers-look-for-in-a-take-home-coding-assignment-1aaec70dabe0), [HN hiring managers](https://news.ycombinator.com/item?id=43980289), [Anthropic on tools](https://www.anthropic.com/engineering/writing-tools-for-agents), [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf).
